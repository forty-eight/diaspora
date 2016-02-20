// (function() {

var fbRef = new Firebase("https://ss16-diaspora.firebaseio.com/");

var scene, camera, renderer, mouse, controls;
var clock = new THREE.Clock(true);
var particleSystem, particleOptions, cometOptions, tick = 0, planets = [], comets = [];
var id = 0;

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

var planetModel = function( x, y, units, spinning ) {
    var geometry = new THREE.BoxGeometry( 100, 100, 100 );
    var material = new THREE.MeshBasicMaterial( { color: 'white', wireframe: true } );
    
    this.mesh = new THREE.Mesh( geometry, material );
    this.mesh.position.set( x || 0, y || 0, 10 );
    this.mesh.id = ++id;
    this.mesh.owner = 'player1';
    this.mesh.units = units || 10;
    this.mesh.spinning = spinning || false;
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
	color: '0xffffff',
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
    this.x = startX;
    this.y= startY;
    this.size = size || getRandomInt(5, 20);
    this.render = function() {
        var delta = clock.getDelta() * particleOptions.timeScale;
	    
    	tick += delta;
    	if (tick < 0) tick = 0;
        
        cometOptions.size = this.size;
        
        cometOptions.position.x = -500 + tick * 100;
		cometOptions.position.y = -500 + tick * 100;

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

function init() {
    
    projector = new THREE.Projector();
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 10000 );
    
    particleSystem = new THREE.GPUParticleSystem({
		maxParticles: 250000
	});
	
	scene.add( particleSystem );
	
    camera.position.z = 1000;

    for (var i = getRandomInt(5, 10); i > 0; i--) {
        planets.push( new planetModel( getRandomInt(-500, 500), getRandomInt(-500, 500)) );
    }
    
    planets.forEach(function( planet ) {
        scene.add( planet.mesh );
    });

    renderer = new THREE.WebGLRenderer();
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
        ( event.clientX / window.innerWidth ) * 2 - 1, 
        - ( event.clientY / window.innerHeight ) * 2 + 1, 
        0.5 );
        
    var meshes = planets.map(function(planet) {
        return planet.mesh;
    });
    
    projector.unprojectVector( vector, camera );
    var ray = new THREE.Raycaster( camera.position, vector.sub( camera.position ).normalize() );
    var intersects = ray.intersectObjects( meshes );    
    if ( intersects.length > 0 ) {
        intersects[0].object.material.color.set('red');
        intersects[0].object.spinning = true;
        comets.push( new cometModel(0, 0, intersects[0].object.position.x, intersects[0].object.position.y, 15) );
    }
                    
}

function animate() {

    requestAnimationFrame( animate );
    
    controls.update();
    
    planets.forEach(function( planet ) {
        if (!planet.mesh.spinning) return;
        planet.mesh.rotation.x += 0.05;
        planet.mesh.rotation.y += 0.05;
    });
    
    comets.forEach(function( comet ) {
        comet.render();
    });
			
	particleSystem.update(tick);

    renderer.render( scene, camera );

}

init();
animate();

// })();
