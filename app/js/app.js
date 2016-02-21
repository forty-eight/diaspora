
///////////////////////
// Set up the canvas //
///////////////////////

var canvas = document.getElementById('canvas');
canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;
var ctx = canvas.getContext('2d');

var id = 0;


//////////////////////////////
// Demo stuff we can delete //
//////////////////////////////

var demoPlanet = new Planet( 0, 100, 100 );
var demoPlanet2 = new Planet( 0, canvas.width-100, canvas.height-100 );
var demoComet = new Comet( demoPlanet, demoPlanet2 );

window.onclick = function() {
  demoComet.shoot(function() {
    console.log('done bro');
  });
};


//////////
// Draw //
//////////

function draw() {
  // Clear the canvas
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw a demo planet
  demoPlanet.draw();
  demoPlanet2.draw();
  demoComet.draw();
}

// Call draw() using TweenLite
TweenLite.ticker.addEventListener("tick", draw);


////////////
// Planet //
////////////

function Planet( fbID, x, y, units, spinning, owner ) {
  this.id = fbID || null;
  // this.fbRef = this.id ? new Firebase("https://ss16-diaspora.firebaseio.com/planets/" + this.id) : null;

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
  this.spinning = spinning || false;

  this.draw = function() {
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
  // if ( newGame ) {
  //   var newPlanetKey = planetsRef.push({
  //     gameid: gameID,
  //     units: this.units,
  //     owner: this.owner || null,
  //     position: {
  //       x: x || 0,
  //       y: y || 0
  //     }
  //   }).key();
  //   gameRef.child('planets').push(newPlanetKey);
  //   this.id = newPlanetKey;
  //   this.fbRef = new Firebase("https://ss16-diaspora.firebaseio.com/planets/" + this.id);
  // }

  // this.fbRef.on('value', function(dataSnapshot) {
  //   var data = dataSnapshot.val() || {};
  //   console.log(data)
  //   if ( data.units ) this.setUnits( data.units );
  //   if ( data.owner ) this.owner = data.owner;
  // }.bind(this));
}
