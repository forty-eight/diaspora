
///////////
// Comet //
///////////

function Comet( startPlanet, endPlanet ) {
  var self = this;

  this.mesh = {
    color: '#ff0000',
    x: startPlanet.mesh.x || 0,
    y: startPlanet.mesh.y || 0,
    endX: endPlanet.mesh.x || 0,
    endY: endPlanet.mesh.y || 0,
    radiusX: 5,
    radiusY: 5,
    rotation: 0,
    startAngle: 0,
    endAngle: 2 * Math.PI
  };

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

  this.shoot = function(callback) {
    TweenMax.to(this.mesh, .4, {
      x: this.mesh.endX,
      y: this.mesh.endY,
      ease: Sine.easeOut,
      onComplete: function() {
        TweenMax.to(self.mesh, .15, {
          radiusX: 0,
          radiusY: 0,
          ease: Linear.easeNone
        });
        TweenMax.to(endPlanet.mesh, .15, {
          radiusX: endPlanet.mesh.radiusX+4,
          radiusY: endPlanet.mesh.radiusY+4,
          ease: Sine.easeOut,
          repeat: 1,
          yoyo: true,
          ease: Linear.easeNone,
          onComplete: function() {
            callback();
          }
        });
      }
    });
  }
}
