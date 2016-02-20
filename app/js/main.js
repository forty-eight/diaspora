// (function() {

//////////////////////////////
// THREEJS EXTENSIONS SETUP //
//////////////////////////////

THREEx.Planets.baseURL	= 'js/vendor/threex-planets/';

/////////////
// GLOBALS //
/////////////

var newGame = false;
var scene, camera, renderer, mouse, controls;
var clock = new THREE.Clock(true);
var pointLight1, pointLight2, particleSystem, particleOptions, cometOptions, tick = 0, planets = [], comets = [];
var id = 0;
var clicks = [];

/////////////////
// LOBBY STUFF //
/////////////////

// Grab the game ID or randomly generate one.
var gameID = window.location.hash.substr(1).length
           ? window.location.hash.substr(1)
           : Math.random().toString(36).substring(2);
           
// Firebase will define this after authentication.
var players = {};
var currentUser;

// Update the URL if we generated a fresh game ID.
if ( !window.location.hash.substr(1).length ) {
    window.location.hash = gameID;
}


////////////
// MODELS //
////////////

var planetModel = function( x, y, units, spinning ) {
  // var geometry = new THREE.BoxGeometry( 100, 100, 100 );
  // var material = new THREE.MeshBasicMaterial( { color: 'white', wireframe: true } );
  // this.mesh = new THREE.Mesh( geometry, material );

  var geometry = new THREE.SphereGeometry( 50, 16, 16 );
  var material = new THREE.MeshLambertMaterial( {color: 0xffff00} );
  this.mesh = new THREE.Mesh( geometry, material );

  this.mesh.position.set( x || 0, y || 0, 10 );
  this.mesh.id = ++id;
  // this.mesh.owner = 'player1';
  this.mesh.units = units || 10;
  this.mesh.spinning = spinning || false;
  
  // We only want to push the planets to Firebase if this is a new game. Otherwise
  // it means there's another player that already has planets so we want to render
  // those in the exact same locations.
  if ( !newGame ) return;
  var newPlanet = planetsRef.push({
    gameid: gameID,
    units: this.mesh.units,
    owner: this.mesh.owner || null,
    position: {
      x: x || 0,
      y: y || 0
    }
  });
  gameRef.child('planets').push(newPlanet.key());
  
  this.getUnits = function() {
    
  };
  this.setUnits = function() {
    
  };
  
}

var particleOptions = {
	spawnRate: 15000,
	horizontalSpeed: 1.5,
	verticalSpeed: 1.33,
	timeScale: 1
};

var cometOptions = {
	position: new THREE.Vector3(),
	positionRandomness: .3,
	velocity: new THREE.Vector3(),
	velocityRandomness: .5,
	color: 'red',
	colorRandomness: .2,
	turbulence: .5,
	lifetime: 2,
	sizeRandomness: .4
};

var cometModel = function( startX, startY, endX, endY, size ) {
    this.startX = startX;
    this.startY = startY;
    this.endX = endX;
    this.endY = endY;
    this.size = size || getRandomInt(5, 20);
    // @TODO this is incredibly rough and doesn't work very well
    // We need to assign start and end coordinates and move it along that line
    // The start and end coordinates need to come from the two planets selected
    // by the user. The first planet they select is the start, the second is the
    // end. We currently don't even store their clicking anywhere.
    
    // render() is called in the animate loop. it's called every frame (60 times/sec)
    this.render = function() {
      var delta = clock.getDelta() * particleOptions.timeScale;
	    
    	tick += delta;
    	if (tick < 0) tick = 0;
        
      cometOptions.size = this.size;
      
      cometOptions.position.x = this.startX + tick * 100;
  		cometOptions.position.y = this.startY + tick * 100;

  		if (delta > 0) {
    		for (var x = 0; x < 15000 * delta; x++) {
    			particleSystem.spawnParticle(cometOptions);
    		}
  		}
  		
  		// debugging stuff
  		if ((Math.round(tick * 100) / 100) % 1 === 0) {
  		    console.log(cometOptions.position)
  		}
    }
}


////////////////
// AUTH STUFF //
////////////////

// Create some Firebase references.
var authRef = new Firebase("https://ss16-diaspora.firebaseio.com/");
var playersRef = new Firebase("https://ss16-diaspora.firebaseio.com/players");
var planetsRef = new Firebase("https://ss16-diaspora.firebaseio.com/planets");
var gameRef = new Firebase("https://ss16-diaspora.firebaseio.com/game/" + gameID);

// Authenticate the user anonymously.
if ( !authRef.getAuth() ) {
  authRef.authAnonymously( function( error, authData ) {
    if ( error ) {
      console.log('Login Failed!', error);
    }
  }, {remember: 'sessionOnly'});
}

// Store the game.
gameRef.set({
  ready: false,
  over: false,
  timestamp: new Date().getTime()
  // planets: foo()
});

// function foo() {
//   var planets = {};
//   // loop through and create planets
//   planets[id] = planet;
//   return [1,2,3]
// }

// After authentication completes.
authRef.onAuth(function( authData ) {
  if ( !authData ) return;
  // Store the user as a player.
  playersRef.child( authData.uid ).set({
    avatar: 'http://www.gravatar.com/avatar/' + CryptoJS.MD5( authData.uid ) + '?d=retro',
    gameid: gameID,
    ready: false,
    attacking: {
      fromPlanet: null,
      toPlanet: null
    },
    authData: authData,
    timestamp: new Date().getTime()
  });
  // Update the current user.
  currentUser = authData.uid;
  console.log('user id: ', currentUser);
  console.log('game id: ', gameID);
  // If the user closes the tab, delete them.
  this.playersRef.child( authData.uid ).onDisconnect().remove();
});

// Get the players
playersRef.on('value', function(snapshot) {
  var data = snapshot.val() || {};
  Object.keys(data).forEach(function(playerID) {
    if ( data[playerID].gameid == gameID ) {
      players[playerID] = data[playerID];
    }
  });
  // console.log('players', players);
});

playersRef.on('child_removed', function(snapshot) {
  // updates the players object
  delete players[snapshot.key()];
});


// Check if planets already exist for this game
planetsRef.once('value', function(snapshot) {
  var data = snapshot.val() || {},
      x, y;
  // Loop through the planets and check if any of them have a game ID that matches
  // the current game
  Object.keys(data).forEach(function(planetID) {
    // If it does, push it to the planets array.
    if ( data[planetID].gameid == gameID ) {
      planets.push( new planetModel(data[planetID].position.x, data[planetID].position.y) );
    }
  });
  
  // If we didn't end up pushing any planets, make new ones for this game.
  if ( !planets.length ) {
    newGame = true;
    for (var i = getRandomInt(5, 10); i > 0; i--) {
      do {
        x = getRandomInt(-500, 500);
        y = getRandomInt(-500, 500);
        // console.log(x, y)
      } while (planetIsTooClose(x, y))
      planets.push( new planetModel(x, y) );
    }
  }
  console.log(planets);
  
  // After the planets are loaded kick everything off.
  init();
  animate();
  
});


////////////////
// UTIL STUFF //
////////////////

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function planetIsTooClose(x, y) {
  return Object.keys(planets).some(function(i) {
    var distance = Math.sqrt(Math.pow(planets[i].mesh.position.x - x, 2)+ Math.pow(planets[i].mesh.position.y - y, 2));
    // console.log(xIsTooClose);
    // console.log(yIsTooClose)
    return distance < 200;
  });
}


///////////////////
// THREEJS STUFF //
///////////////////

function init() {
    
  projector = new THREE.Projector();
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 10000 );
  
  particleSystem = new THREE.GPUParticleSystem({
		maxParticles: 250000
	});
	
	scene.add( particleSystem );

  pointLight1 = new THREE.PointLight(0xFFFFFF);
  pointLight1.position.x = 0;
  pointLight1.position.y = 800;
  pointLight1.position.z = 800;
  pointLight2 = new THREE.PointLight(0xFFFFFF);
  pointLight2.position.x = 0;
  pointLight2.position.y = -800;
  pointLight2.position.z = -800;

  scene.add(pointLight1);
  scene.add(pointLight2);

  camera.position.z = 1000;
  console.log('planets',planets);
  planets.forEach(function( planet ) {
    scene.add( planet.mesh );
  });

  renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setSize( window.innerWidth, window.innerHeight );

  document.body.appendChild( renderer.domElement );
  document.addEventListener( 'mousedown', onDocumentMouseDown, false );
  
  controls = new THREE.TrackballControls(camera, renderer.domElement);
	controls.rotateSpeed = 5.0;
	controls.zoomSpeed = 2.2;
	controls.panSpeed = 1;
	controls.dynamicDampingFactor = 0.3;

}

function onDocumentMouseDown( event ) {
    
  event.preventDefault();
  
  var vector = new THREE.Vector3( 
      (event.clientX / window.innerWidth) * 2 - 1, 
      -(event.clientY / window.innerHeight) * 2 + 1, 
      0.5
    );
      
  var meshes = planets.map(function(planet) {
    return planet.mesh;
  });
  
  projector.unprojectVector( vector, camera );
  var ray = new THREE.Raycaster( camera.position, vector.sub( camera.position ).normalize() );
  var intersects = ray.intersectObjects( meshes );
  
  // If they clicked on a planet
  if ( intersects.length > 0 ) {
    var clickLocation = clicks.indexOf( intersects[0].object.id );
    if ( clickLocation === -1 ) {
      clicks.push( intersects[0].object.id );
      intersects[0].object.spinning = !intersects[0].object.spinning;
    } else {
      clicks.splice(clickLocation, 1);
    }
    
    // If there are two planet IDs in the clicks array, send a comet from the first
    // planet to the second. Otherwise, return and do nothing;
    if (clicks.length < 2) return;
    
    var startX, startY, endX, endY;

    Object.keys(planets).forEach(function(i) {
      if ( planets[i].mesh.id == clicks[0] ) {
        startX = planets[i].mesh.position.x;
        startY = planets[i].mesh.position.y;
      }
      if ( planets[i].mesh.id == clicks[1] ) {
        endX = planets[i].mesh.position.x;
        endY = planets[i].mesh.position.y;
      }
      setTimeout(function() {
        planets[i].mesh.spinning = false;
      }, 1000);
    });
    comets.push( new cometModel(startX, startY, endX, endY, 15) );
    
    // Clear the clicks if we fired a comet.
    clicks = [];
  }
                    
}

function animate() {

  requestAnimationFrame( animate );
  
  controls.update();
  
  planets.forEach(function( planet ) {
    if (planet.mesh.spinning) {
      planet.mesh.rotation.x += 0.05;
      planet.mesh.rotation.y += 0.05;
      planet.mesh.material.color.set('red');
    } else {
      planet.mesh.material.color.set('yellow');
    }
  });
  
  comets.forEach(function( comet ) {
    comet.render();
  });
			
	particleSystem.update(tick);

  renderer.render( scene, camera );

}

// })();
