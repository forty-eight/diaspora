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
var currentUser;
var currentColor;
var gameIsReady = false;

var body = document.getElementById('body');
var modal = document.getElementById('modal');

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

function setShareLink() {
  var link = window.location;
  var shareLinkBtnText = document.getElementById('share-link-btn-txt');
  var shareLinkHref = document.getElementById('share-link-href');
  shareLinkBtnText.textContent = link;
  shareLinkHref.setAttribute('value', link);
  return link;
}

// After authentication completes.
authRef.onAuth(function( authData ) {
  if ( !authData ) return;

  // If there's a hash in the URL, we assume it's a game id.
  if ( window.location.hash.substr(1).length ) {
    console.log('building existing game');
    gameID = window.location.hash.substr(1);
    gameRef = new Firebase("https://ss16-diaspora.firebaseio.com/game/" + gameID);
    gameRef.once('value', function(snapshot) {
      currentGame = snapshot.val();
      var planetPromises = Object.keys(currentGame.planets).map(function(planetID) {
        return planetsRef.child(currentGame.planets[planetID]).once('value', function(snapshot) {
          var planet = snapshot.val();
          planets.push( new Planet(snapshot.key(), planet.position.x, planet.position.y) );
        });
      });
      Promise.all( planetPromises ).then(function() {
        setupCurrentPlayer(authData);
      });
    });
  } else {
    // Store the game.
    console.log('Creating a new game.');
    gamesRef.push({
      ready: false,
      over: false,
      timestamp: new Date().getTime()
    }).then(function(snapshot) {
      gameID = snapshot.key();
      gameRef = new Firebase("https://ss16-diaspora.firebaseio.com/game/" + gameID);
      newGame = true;
      for (var i = getRandomInt(6, 12); i > 0; i--) {
        do {
          x = getRandomInt(0, canvas.width);
          y = getRandomInt(0, canvas.height);
        } while (planetIsTooClose(x, y))
        planets.push( new Planet(null, x, y) );
      }
      window.location.hash = gameID;
      setupCurrentPlayer(authData, 0);
    });
  }
  setShareLink();
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
      players = {};
      Object.keys(data).forEach(function(i) {
        if (data[i].gameid === gameID) {
          players[i] = data[i];
          if (i === currentUser && !!currentColor) {
            players[i].color = currentColor;
            currentPlayerReadyBtn.style.display = 'inline-block';
            currentPlayerReadyBtn.style.background = players[currentUser].color;
          } else if (i === currentUser && !!!currentColor) {
            currentColor = getRandomColor();
            players[i].color = currentColor;
            currentPlayerReadyBtn.style.display = 'inline-block';
            currentPlayerReadyBtn.style.background = players[currentUser].color;
          } else {
            players[i].color = getRandomColor();
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
  gameRef.child('ready').on('value', function(snapshot) {
    if (snapshot.val()) {
      gameIsReady = true;
      console.log('EVERYONE HAS SAID THEY\'RE READY!!!!!');
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
        // For some reason this is here.
        if ( gameIsReady && onlyOneOwner() ) endTheGame();
      }.bind(this));
      createPlayerPlanets();
    }
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
    if (!planet.owner) return;
    planet.setUnits( planet.getUnits() + 1 );
    planet.update();
  });
}, 1000);

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
    color: '#ffff00',
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
    color: 'red',
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
  this.units = units || 10;
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
  console.log(Object.keys(owners).length === 1)
  return Object.keys(owners).length === 1;
}

function endTheGame(){
  console.log('You won or lost! ');
}

function adjustPlanetUnits(startPlanet, endPlanet) {
  console.log(startPlanet, endPlanet)
  var armySize = Math.floor( startPlanet.getUnits() / 2 );
      startPlanet.setUnits( startPlanet.getUnits() - armySize );

    // If it's a neutral planet
    if ( endPlanet.owner == null ) {
      endPlanet.setUnits( endPlanet.getUnits() + armySize );
      endPlanet.owner = currentUser;
    // If an enemy owns it
    } else if ( endPlanet.owner != currentUser ) {
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
  sounds.shoot.play();
}


////////////////
//   SOUNDZ   //
////////////////

var sounds = {
  lobby: new Howl({
    urls: ['/sfx/lobby.mp3', '/sfx/lobby.ogg'],
    loop: true,
    volume: 0.8
  }),
  game: new Howl({
    urls: ['/sfx/games.mp3', '/sfx/games.ogg'],
    loop: true,
    volume: 0.8
  }),
  boo: new Howl({
    urls: ['/sfx/boo-planet.mp3', '/sfx/boo-planet.ogg', '/sfx/boo-planet.wav']
  }),
  yay: new Howl({
    urls: ['/sfx/yay-planet.mp3', '/sfx/yay-planet.ogg', '/sfx/yay-planet.wav']
  }),
  shoot: new Howl({
    urls: ['/sfx/shoot.mp3', '/sfx/shoot.ogg', '/sfx/shoot.wav']
  }),
  hit: new Howl({
    urls: ['/sfx/hit.mp3', '/sfx/hit.ogg', '/sfx/hit.wav']
  })
}


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

function getRandomColor(){
  return '#' + getRandomInt(0, Math.pow(16,6)).toString(16)
}

function planetIsTooClose(x, y) {
  return Object.keys(planets).some(function(i) {
    var distance = Math.sqrt(Math.pow(planets[i].mesh.x - x, 2) + Math.pow(planets[i].mesh.y - y, 2));
    return distance < 50;
  });
}
