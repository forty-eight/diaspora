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
var pointLight1, pointLight2, particleSystem, particleOptions, cometOptions, tick = 0, planets = [], comets = [];
var id = 0;
var clicks = [];
var players = {};
var currentUser;


/////////////////
// LOBBY STUFF //
/////////////////

var currentGame,
    gameID,
    gamesRef = new Firebase("https://ss16-diaspora.firebaseio.com/game"),
    gameRef;


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
      for (var i = getRandomInt(5, 10); i > 0; i--) {
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

  gameRef.child('players').on('value', function(snapshot) {
    // console.log(snapshot.val())
    playersRef.once('value', function(snapshot) {
      var data = snapshot.val();
      players = {};
      Object.keys(data).forEach(function(i) {
        if (data[i].gameid === gameID) {
          players[i] = data[i];
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
  if (players.length < 2) return false;
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
    if (snapshot.val()) console.log('EVERYONE HAS SAID THEY\'RE READY!!!!!');
    // init();
    // animate();
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


var planetSelector = function(){
  var startPlanet = null;

  return function(planet){
    if(startPlanet && startPlanet !== planet){
      adjustPlanetUnits(startPlanet, planet);
      fireComet(startPlanet, planet);
      startPlanet = null;
    }else{
      startPlanet = planet;
    }
  }

}();


attachClickListener(canvas, planetSelector);


//////////
// Draw //
//////////

function draw() {
  // Clear the canvas
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  planets.forEach(function(planet) {
    planet.draw();
  });
  
  comets.forEach(function(comet){
    comet.draw();
  })
}

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
    ctx.font = "bold 25px serif";
    var width = ctx.measureText(this.units).width;
    var height = ctx.measureText('w').width;
    ctx.fillText(this.units, 200 - (width/2), 200 + (height/2));
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
  };

  this.getUnits = function() {
    return this.units;
  };

  this.setUnits = function( numUnits ) {
    this.units = numUnits;
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
    console.log(dataSnapshot.key(), data)
    if ( data.units ) this.setUnits( data.units );
    if ( data.owner ) this.owner = data.owner;
  }.bind(this));
}


function adjustPlanetUnits(startPlanet, endPlanet){
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

    startPlanet.update();
    endPlanet.update();

}


function fireComet(startPlanet, endPlanet){
  var comet = new Comet(startPlanet, endPlanet);
  comets.push(comet);
  
  comet.shoot(function(){
    for(var i=0; i<comets.length; i++){
      if(comets[i] === comet) return comets.splice(i, 1);
    }
  })
  
}



////////////////
//   EVENTS   //
///////////////

//Pass the canvas element and a function that will be called when a planet is clicked
function attachClickListener(canvas, fn){
    canvas.addEventListener('mousedown', function(e){
        var x = e.clientX;
        var y = e.clientY;

        for(var i=0; i<planets.length; i++){
            var planet = planets[i];
            if(euclideanDistance(x, y, planet.mesh.x, planet.mesh.y) <= planet.mesh.radiusX){
                return fn(planet);
            }
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

function planetIsTooClose(x, y) {
  return Object.keys(planets).some(function(i) {
    var distance = Math.sqrt(Math.pow(planets[i].mesh.x - x, 2) + Math.pow(planets[i].mesh.y - y, 2));
    return distance < 50;
  });
}
