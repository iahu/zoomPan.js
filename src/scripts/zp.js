var Matrix2D = require('./Matrix2D');
var m0 = Matrix2D.identity();
var controllerFrame = require('./controllerFrame');
var points = [
	[0,  0 ], [100,0 ],
	[100,50], [0,  50]
];

var frameController = controllerFrame({
    points: points,
    stage: document.getElementById('stage')
});

function move(points, x, y, o) {
	o = o || [0, 0];
	var ox = o[0],
		oy = o[1],
		m, _m;

	for (var i = 0; i < points.length; i++) {
		m = Matrix2D.translate(m0, points[i][0]+x-ox, points[i][1]+y-oy);
		points[i] = [m[6], m[7]];
	}

	return points;
}
function rotate(points, d, o) {
	o = o || [0, 0];
	var ox = o[0],
		oy = o[1],
		m, _m;
	for (var i = 0; i < points.length; i++) {
		_m = Matrix2D.translate(m0, points[i][0]-ox, points[i][1]-oy);
		_m = Matrix2D.rotate(_m, d);
		points[i] = [_m[6]+ox, _m[7]+oy];
	}

	return points;
}

function getCenterPoint(points) {
	var x = [], y = [];
	points.forEach(function (p, i) {
		x.push(p[0]);
		y.push(p[1]);
	});

	var minX = Math.min.apply(null, x);
	var minY = Math.min.apply(null, y);
	var maxX = Math.max.apply(null, x);
	var maxY = Math.max.apply(null, y);
	return [(maxX + minX)/2, (maxY + minY)/2];
}

var p2 = move(points, 200, 200);
function update() {
	var c = getCenterPoint(p2);
	p2 = rotate(p2, 3, c);
	frameController.updateFrame( p2 );	
}
setInterval(function () {
	update();
}, 40);
update();