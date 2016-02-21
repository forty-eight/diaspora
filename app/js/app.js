
///////////////////////
// Set up the canvas //
///////////////////////

var canvas = document.getElementById('canvas');
canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;
var ctx = canvas.getContext('2d');

///////////////////////
// Draw //
///////////////////////

var box = { x:25, y:25, width:100, height:100 };

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.width, box.height);
  ctx.fillStyle = "#8ED6FF";
  ctx.fill();
}

TweenMax.to(box, 2, { x:500, y:500, ease: Bounce.easeOut });

TweenLite.ticker.addEventListener("tick", draw);

