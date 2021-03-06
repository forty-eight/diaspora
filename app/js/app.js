//////////////
// FIREBASE //
//////////////

// Create some Firebase references.
var authRef = new Firebase("https://ss16-diaspora.firebaseio.com/");
var playersRef = new Firebase("https://ss16-diaspora.firebaseio.com/players");
var planetsRef = new Firebase("https://ss16-diaspora.firebaseio.com/planets");


/////////////
// GLOBALS //
/////////////

var newGame = false;
var scene, camera, renderer, mouse, controls;
var tick = 0, planets = [], comets = [];
var id = 0;
var clicks = [];
var players = {};
var owners = {};
var youWin;
var currentUser;
var currentColors = [];
var gameIsReady = false;
var firstShot = true;

var body = document.getElementById('body');

/////////////////
// LOBBY STUFF //
/////////////////

var currentGame,
    gameID,
    gamesRef = new Firebase("https://ss16-diaspora.firebaseio.com/game"),
    gameRef;


starfield();
////////////////
// AUTH STUFF //
////////////////

// Authenticate the user anonymously.
if ( !authRef.getAuth() ) {
  authRef.authAnonymously( function( error, authData ) {
    if ( error ) {
      console.log('Login Failed!', error);
    }
  }, {remember: 'sessionOnly'});
}

function setgameLinks() {
  var shareLink = window.location.href;
  var replayLink = window.location.href.replace(window.location.hash, '');
  var shareLinkBtnText = document.getElementById('share-link-btn-txt');
  var shareLinkHref = document.getElementById('share-link-href');
  var replayLink = document.getElementById('replay-link');
  shareLinkBtnText.textContent = shareLink;
  shareLinkHref.setAttribute('value', shareLink);
  replayLink.textContent = replayLink;
  replayLink.href = replayLink;
}


/////////////////
//  GAME INIT  //
////////////////

// After authentication completes.
authRef.onAuth(function( authData ) {
  if ( !authData ) return;

  // If there's a hash in the URL, we assume it's a game id.
  if ( window.location.hash.substr(1).length ) {
    // console.log('building existing game');
    gameID = window.location.hash.substr(1);
    gameRef = new Firebase("https://ss16-diaspora.firebaseio.com/game/" + gameID);
    gameRef.once('value', function(snapshot) {
      currentGame = snapshot.val();
      if(currentGame.ready){
        gameID = null;
        gameRef = null;
        return createNewGame();
      }
      var planetPromises = Object.keys(currentGame.planets).map(function(planetID) {
        return planetsRef.child(currentGame.planets[planetID]).once('value', function(snapshot) {
          var planet = snapshot.val();
          planets.push( new Planet(snapshot.key(), planet.position.x, planet.position.y) );
        });
      });
      Promise.all( planetPromises ).then(function() {
        setupCurrentPlayer(authData);
      });
      setgameLinks();
    });
  } else {
    createNewGame();
  }

  function createNewGame(){
    // Store the game.
    console.log('Creating a new game.');
    gamesRef.push({
      ready: false,
      timestamp: new Date().getTime(),
      winner: false
    }).then(function(snapshot) {
      gameID = snapshot.key();
      gameRef = new Firebase("https://ss16-diaspora.firebaseio.com/game/" + gameID);
      newGame = true;
      for (var i = getRandomInt(6, 12); i > 0; i--) {
        do {
          x = getRandomInt(50, canvas.width - 150);
          y = getRandomInt(150, canvas.height - 50);
        } while (planetIsTooClose(x, y))
        planets.push( new Planet(null, x, y) );
      }
      window.location.hash = gameID;
      setupCurrentPlayer(authData, 0);
      setgameLinks();
    });
  }
});

function markAsReady() {
  playersRef.child(currentUser).update({
    ready: true
  });
}

function setupCurrentPlayer(authData) {
  // Store the user as a player.
  var playerID = playersRef.push({
    avatar: 'http://www.gravatar.com/avatar/' + CryptoJS.MD5( authData.uid ) + '?d=retro',
    gameid: gameID,
    ready: false,
    authData: authData,
    timestamp: new Date().getTime()
  }).key();
  currentUser = playerID;
  gameRef.child('players/' + playerID).set(currentUser);

  var currentPlayerReadyBtn = document.getElementById('current-player-ready-btn');
  currentPlayerReadyBtn.addEventListener('click', function(e){
    markAsReady();
    var currentPlayerWaiting = document.getElementById('current-player-waiting');
    var currentPlayerReady = document.getElementById('current-player-ready');
    currentPlayerWaiting.style.display = 'none';
    currentPlayerReady.style.display = 'block';
    currentPlayerReadyBtn.style.pointerEvents = 'none';
  });

  gameRef.child('players').on('value', function(snapshot) {
    // console.log(snapshot.val())
    playersRef.once('value', function(snapshot) {
      var data = snapshot.val();
      currentColors = [];
      players = {};
      Object.keys(data).forEach(function(i) {
        if (data[i].gameid === gameID) {
          players[i] = data[i];
          if (i === currentUser) {
            players[i].color = colors[0];
            currentPlayerReadyBtn.style.display = 'inline-block';
          } else {
            var c;
            do {
              c = getColor();
            } while (currentColors.indexOf(c) > -1);
            currentColors.push(c);
            players[i].color = c;
            // console.log('there\'s another player!')
          }
          playersRef.child(i).on('child_changed', function(snapshot) {
            players[i][snapshot.key()] = snapshot.val();
            isGameReady();
          });
        }
      });

    });
  });

  // If the user closes the tab, delete them.
  playersRef.child( currentUser ).onDisconnect().remove();
  gameRef.child('players').child( currentUser ).onDisconnect().remove();

  go();
}

function isGameReady() {
  if (Object.keys(players).length < 2) return false;
  var weAreReady = Object.keys(players).every(function(p) {
    return players[p].ready;
  });
  if (weAreReady) {
    gameRef.update({
      ready: true
    });
  }
}

function go() {
  sounds.lobby.play();
  gameRef.child('ready').on('value', function(snapshot) {
    if (snapshot.val()) {
      gameIsReady = true;
      nextTip();
      body.className = '';
      gameRef.child('comets').on('child_added', function(snapshot) {
        var comet = snapshot.val(),
                    startPlanet,
                    endPlanet;
        planets.forEach(function(planet) {
          if (planet.id == comet.startPlanet) startPlanet = planet;
          if (planet.id == comet.endPlanet) endPlanet = planet;
        });
        fireComet(startPlanet, endPlanet);
        snapshot.ref().remove()
        if ( gameIsReady && onlyOneOwner() ) {
          youWin = owners[currentUser] >= 1;
          endTheGame();
          gameRef.update({ winner: Object.keys(owners)[0] });
        }
      }.bind(this));
      createPlayerPlanets();
      sounds.lobby.fade(1, 0, 5000, function(){
        sounds.lobby.stop();
      });
      sounds.game.play();
    }
  });
  gameRef.child('winner').on('value', function(snapshot) {
    // console.log('Checking for winner');
    if (!snapshot.val()) return;
    if (currentUser === snapshot.val()) {
      youWin = true;
    }
    endTheGame();
  });
}

// Create a starting planet for every player.
function createPlayerPlanets() {
  Object.keys(players).forEach(function(player, i) {
    planets[i].owner = player;
    planets[i].update();
  });
}

///////////////////////
// Set up the canvas //
///////////////////////

var canvas = document.getElementById('canvas');
canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;
var ctx = canvas.getContext('2d');

var id = 0;


function makeSelector(fn){
  var startPlanet = null;

  return function(planet){
    if(startPlanet && startPlanet !== planet){
      fn(startPlanet, planet);
      startPlanet.unHighLightTween();
      planet.targetTween();
      startPlanet = null;

    }else if(planet.owner === currentUser){
      startPlanet = planet;
      startPlanet.highLightTween();
    }
  }

}

var planetSelector = makeSelector(adjustPlanetUnits);

attachClickListener(canvas, planetSelector);


//////////
// Draw //
//////////

function draw() {
  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  planets.forEach(function(planet) {
    planet.draw();
  });

  comets.forEach(function(comet){
    comet.draw();
  });

}

setInterval(function() {
  planets.forEach(function(planet) {
    // Cap the number of units at 99
    if (!planet.owner || planet.getUnits() >= 99) return;
    planet.setUnits( planet.getUnits() + 1 );
    planet.update();
  });
}, 2000);

// Call draw() using TweenLite
TweenLite.ticker.addEventListener("tick", draw);


////////////
// Planet //
////////////

function Planet( fbID, x, y, units, selected, owner ) {
  this.id = fbID || null;
  this.fbRef = this.id ? new Firebase("https://ss16-diaspora.firebaseio.com/planets/" + this.id) : null;

  this.mesh = {
    id: ++id,
    color: '#ffffff',
    x: x || 0,
    y: y || 0,
    radiusX: 25,
    radiusY: 25,
    fixedRadiusX: 25,
    fixedRadiusY: 25,
    rotation: 0,
    startAngle: 0,
    endAngle: 2 * Math.PI
  };

  this.meshHighlight = {
    id: ++id,
    color: 'white',
    x: x || 0,
    y: y || 0,
    radiusX: 25,
    radiusY: 25,
    fixedRadiusX: 25,
    fixedRadiusY: 25,
    rotation: 0,
    startAngle: 0,
    endAngle: 2 * Math.PI
  };

  // @TODO need to set this as the player's ID
  this.owner = null;
  this.units = units || 5;
  this.selected = selected || false;

  this.draw = function() {
    ctx.beginPath();
    ctx.fillStyle = this.mesh.color;
    if (this.selected) {
      ctx.beginPath();
      ctx.fillStyle = this.meshHighlight.color;
      ctx.ellipse(
        this.mesh.x,
        this.mesh.y,
        this.meshHighlight.radiusX,
        this.meshHighlight.radiusY,
        this.mesh.rotation,
        this.mesh.startAngle,
        this.mesh.endAngle
      );
      ctx.fill();
      ctx.closePath();
    }
    ctx.beginPath();
    ctx.shadowBlur = 20;
    ctx.shadowColor = this.mesh.color;
    ctx.fillStyle = this.mesh.color;
    ctx.ellipse(
      this.mesh.x,
      this.mesh.y,
      this.mesh.radiusX,
      this.mesh.radiusY,
      this.mesh.rotation,
      this.mesh.startAngle,
      this.mesh.endAngle
    );
    ctx.fill();
    ctx.closePath();
    // Label stuff
    ctx.fillStyle = "black";
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(this.units, this.mesh.x, this.mesh.y + 8);
  };

  this.targetTween = function() {
    this.selected = true;
    TweenMax.to(this.meshHighlight, .1, {
      radiusX: this.mesh.fixedRadiusX + 3,
      radiusY: this.mesh.fixedRadiusY + 3,
      ease: Circ.easeInOut,
      repeat: 1,
      yoyo: true,
      onComplete: function() {
        this.selected = false;
      }
    });
  }

  this.highLightTween = function() {
    this.selected = true;
    TweenMax.to(this.meshHighlight, .1, {
      radiusX: this.mesh.fixedRadiusX + 3,
      radiusY: this.mesh.fixedRadiusY + 3,
      ease: Circ.easeInOut,
      onComplete: function() {
        this.selected = false;
      }
    });
  }

  this.unHighLightTween = function() {
    TweenMax.to(this.meshHighlight, .1, {
      radiusX: this.mesh.fixedRadiusX,
      radiusY: this.mesh.fixedRadiusY,
      ease: Circ.easeInOut
    });
  }

  this.getUnits = function() {
    return this.units;
  };

  this.setUnits = function( numUnits ) {
    this.units = numUnits;
    // this.mesh.radiusX = this.mesh.fixedRadiusX * (1 + numUnits/200);
    // this.mesh.radiusY = this.mesh.fixedRadiusY * (1 + numUnits/200);
    // this.meshHighlight.radiusX = this.meshHighlight.fixedRadiusX * (1 + numUnits/200);
    // this.meshHighlight.radiusY = this.meshHighlight.fixedRadiusY * (1 + numUnits/200);
  };

  this.setOwner = function( owner ) {
    if (this.owner !== owner && owner == currentUser) {
      sounds.yay.play();
    } else if (this.owner !== owner && owner !== currentUser) {
      sounds.boo.play();
    }
    this.owner = owner;
    this.mesh.color = players[owner].color;
  };

  this.update = function() {
    this.fbRef.update({
      units: this.units,
      owner: this.owner
    });
  }

  // We only want to push the planets to Firebase if this is a new game. Otherwise
  // it means there's another player that already has planets so we want to render
  // those in the exact same locations.
  if ( newGame ) {
    var newPlanetKey = planetsRef.push({
      gameid: gameID,
      units: this.units,
      owner: this.owner || null,
      position: {
        x: x || 0,
        y: y || 0
      }
    }).key();
    gameRef.child('planets').push(newPlanetKey);
    this.id = newPlanetKey;
    this.fbRef = new Firebase("https://ss16-diaspora.firebaseio.com/planets/" + this.id);
  }

  this.fbRef.on('value', function(dataSnapshot) {
    var data = dataSnapshot.val() || {};
    var planetID = dataSnapshot.key();
    //console.log('fbRef updated', planetID, data)
    if ( data.units ) this.setUnits( data.units );
    if ( data.owner ) this.setOwner( data.owner );
  }.bind(this));
}

function onlyOneOwner() {
  owners = {};
  planets.forEach(function(planet) {
    if (!planet.owner) return;
    owners[planet.owner] = 1;
  });
  return Object.keys(owners).length === 1;
}

function endTheGame(){
  // console.log('You won or lost! ');
  var winOrLose = document.getElementById('win-or-lose');
  if (youWin) {
    winOrLose.textContent = 'You won!';
    sounds.game.fade(1, 0, 500, function(){
      sounds.game.stop();
    });
    sounds.win.play();
  } else {
    winOrLose.textContent = 'You lost...';
    sounds.game.fade(1, 0, 500, function(){
      sounds.game.stop();
    });
    sounds.lobby.play();
  }
  body.className = 's-show-modal s-show-end-modal';
}

function adjustPlanetUnits(startPlanet, endPlanet) {
  var armySize = Math.floor( startPlanet.getUnits() / 2 );
      startPlanet.setUnits( startPlanet.getUnits() - armySize );


    // If an enemy owns it or it's neutral
    if ( endPlanet.owner != currentUser ) {
      var remaining = endPlanet.getUnits() - armySize;
      if ( remaining < 0 ) {
        endPlanet.setUnits( Math.abs(remaining) );
        endPlanet.owner = currentUser;
      } else if ( remaining == 0 ) {
        endPlanet.setUnits( 0 );
        endPlanet.owner = null;
      } else {
        endPlanet.setUnits( remaining );
      }
    // If you own it
    } else {
      endPlanet.setUnits( endPlanet.getUnits() + armySize );
    }

    gameRef.child('comets').push({
      startPlanet: startPlanet.id,
      endPlanet: endPlanet.id
    }, function() {
      startPlanet.update();
      endPlanet.update();
    });

}


function fireComet(startPlanet, endPlanet){
  var comet = new Comet(startPlanet, endPlanet);
  comets.push(comet);
  startPlanet.highlighted = false;
  comet.shoot(function() {
    sounds.hit.play();
    for(var i=0; i<comets.length; i++){
      if(comets[i] === comet) return comets.splice(i, 1);
    }
  });
  if (startPlanet.owner === currentUser) {
    sounds.shoot.play();
    if (firstShot) {
      firstShot = false;
      nextTip();
      autoTip();
    }
  } else {
    sounds.shootEnemy.play();
  }
}


////////////////
//   SOUNDZ   //
////////////////

var sounds = {
  lobby: new Howl({
    urls: ['/sfx/astronaut-breath.mp3', '/sfx/astronaut-breath.ogg', '/sfx/astronaut-breath.wav'],
    loop: true,
    volume: 0.8
  }),
  game: new Howl({
    urls: ['/sfx/space-cube.mp3', '/sfx/space-cube.ogg', '/sfx/space-cube.wav'],
    loop: true,
    volume: 0.8
  }),
  boo: new Howl({
    urls: ['/sfx/boo-planet.mp3', '/sfx/boo-planet.ogg', '/sfx/boo-planet.wav'],
    volume: 0.9
  }),
  yay: new Howl({
    urls: ['/sfx/yay-planet.mp3', '/sfx/yay-planet.ogg', '/sfx/yay-planet.wav'],
    volume: 0.9
  }),
  shoot: new Howl({
    urls: ['/sfx/shoot2.mp3', '/sfx/shoot2.ogg', '/sfx/shoot2.wav'],
    volume: 0.8
  }),
  shootEnemy: new Howl({
    urls: ['/sfx/shoot2_enemy.mp3', '/sfx/shoot2_enemy.ogg', '/sfx/shoot2_enemy.wav'],
    volume: 0.8
  }),
  hit: new Howl({
    urls: ['/sfx/hit.mp3', '/sfx/hit.ogg', '/sfx/hit.wav'],
    volume: 0.8
  }),
  win: new Howl({
    urls: ['/sfx/win.mp3', '/sfx/win.ogg', '/sfx/win.wav'],
    volume: 0.9
  })
}


////////////////
//   COLORS   //
////////////////

var colors = [
  '#a4d3f0',
  '#f29c9c',
  '#eaa8d3',
  '#cc98e3',
  '#a3ecc5',
  '#e3cc98'
];

////////////////
//   EVENTS   //
////////////////

//Pass the canvas element and a function that will be called when a planet is clicked
function attachClickListener(canvas, fn){
    canvas.addEventListener('mousedown', function(e){
        var x = e.clientX;
        var y = e.clientY;
        var selectedPlanet;
        for(var i=0; i<planets.length; i++){
            var planet = planets[i];
            planet.selected = false;
            if(euclideanDistance(x, y, planet.mesh.x, planet.mesh.y) <= planet.mesh.radiusX){
                selectedPlanet = planet;
            }
        }
        if (selectedPlanet) {
          return fn(selectedPlanet);
        }
    })
}

////////////////
// UTIL STUFF //
////////////////

function euclideanDistance(x1,y1,x2,y2){
  var xdiff = x1-x2;
  var ydiff = y1-y2;
  return Math.sqrt(xdiff*xdiff + ydiff*ydiff)
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function getColor() {
  return colors[getRandomInt(1, colors.length -1)];
}

function getRandomColor(){
  return '#' + getRandomInt(0, Math.pow(16,6)).toString(16)
}

function planetIsTooClose(x, y) {
  return Object.keys(planets).some(function(i) {
    var distance = Math.sqrt(Math.pow(planets[i].mesh.x - x, 2) + Math.pow(planets[i].mesh.y - y, 2));
    return distance < 50;
  });
}
