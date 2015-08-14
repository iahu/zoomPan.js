function controllerFrame(config) {
	var emptyFun = function () {};
	var conf = extend({
		points: [[-9,-9],[-9,-9],[-9,-9],[-9,-9]],
		onUpdateFrame: emptyFun,
		onSave: emptyFun,
		onUndo: config.onUndo || emptyFun,
		onRedo: config.onRedo || emptyFun
	}, config);
	var body = document.body;
	var stage = conf.stage;
	var points = conf.points;
	var NS = 'http://www.w3.org/2000/svg';
	var frame = document.createElementNS(NS, 'svg');
	var group = document.createElementNS(NS, 'g');
	var polygon = document.createElementNS(NS, 'polygon');
	polygon.id = 'polygon';
	polygon.style.fill = 'transparent';
	group.id = 'frame-group';
	frame.setAttribute('width', '100%');
	frame.setAttribute('height', '100%');
	frame.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
	frame.appendChild(polygon);
	frame.appendChild(group);
	stage.appendChild(frame);

	var draggable = false;
	var moveable = false;
	var rotateable = false;
	var needBackup = false;
	var lineIdx = -1;
	var circleIdx = -1;
	var rotateIdx = -1;
	var ARRAY_SLICE = Array.prototype.slice;
	var STROKE_COLOR = '#f00';
	var HISTORY_LEN = 20;
	// var points = [[50,50], [350,50], [350,150], [50,150]];
	var doList = [];
	var redoList = [];
	var len = points.length;
	var diff = [];
	var moveHori;
	var dirctionLocked = false;
	var lines, circles;
	var groupHTML = '';

	// buil frame
	for (var i = 0; i < len; i++) {
		var l = document.createElementNS(NS, 'line');
		var c = document.createElementNS(NS, 'circle');
		l.setAttributeNS(null, 'id', 'line-'+i);
		l.setAttributeNS(null, 'stroke-width', 2);
		l.setAttributeNS(null, 'stroke', '#f00');
		c.setAttributeNS(null, 'id', 'circle-'+i);
		c.setAttributeNS(null, 'r', 3);
		c.setAttributeNS(null, 'fill', '#f00');
		group.appendChild(l);
		group.appendChild(c);
		// groupHTML += '<line id="line-'+i+'"></line><circle id="circle-'+i+'" r="3"></circle>';
	}
	// group.innerHTML = groupHTML;
	lines = ARRAY_SLICE.call(group.getElementsByTagName('line'));
	circles = ARRAY_SLICE.call(group.getElementsByTagName('circle'));

	updateFrame();
	savePoints();

	stage.addEventListener('mousedown', function(event) {
		var target = event.target;
		var point = get_mouse_position(frame, event);
		var i, rArray = [];
		var posX = point.x;
		var posY = point.y;

		if (stage.contains(target)) {
			if ( target === frame ) {
				draggable = false;
				moveable = false;
				rotateable = true;
				for (i = 0; i < points.length; i++) {
					rArray.push(Math.pow(points[i][0]-posX, 2) + Math.pow(points[i][1]-posY, 2));
				}
				rotateIdx = rArray.indexOf(Math.min.apply(this, rArray));
				return;
			}
			for (i = 0; i < points.length; i++) {
				diff[i] = {
					x: point.x - points[i][0],
					y: point.y - points[i][1]
				};
			}
			if ( ['line', 'circle'].indexOf(target.nodeName.toLowerCase()) >= 0 ) {
				draggable = true;
				moveable = false;
				addClass(stage, 'draggable');
			}
			if ( target.id === 'polygon' ) {
				draggable = false;
				moveable = true;
				polygon.setAttributeNS(null, 'class', 'grabbing');
			}

			lineIdx = lines.indexOf( target );
			circleIdx = circles.indexOf( target );
		}
	});

	frame.addEventListener('mousemove', function(event) {
		if ( !draggable & !moveable && !rotateable ) {
			return;
		}
		var point = get_mouse_position(frame, event);
		var isCtrlKey = event.ctrlKey;
		var isShiftKey = event.shiftKey;

		if (rotateable) {
			rotate({
				x: (points[0][0] + points[2][0])/2,
				y: (points[0][1] + points[2][1])/2
			}, rotateIdx, point);
			// updateFrame();
			return;
		}

		if (draggable) {
			needBackup = true;
			var c = circles[circleIdx],
				l = lines[lineIdx],
				nextIdx, c1Idx, c2Idx, x1, x2, y1, y2;
			if (c) {
				movePoint(point, circleIdx, isCtrlKey, isShiftKey);
			}
			if (l) {
				nextIdx = (lineIdx+1)%len;
				if (isCtrlKey) {
					x1 = point.x - diff[lineIdx].x;
					y1 = point.y - diff[lineIdx].y;
					x2 = point.x - diff[nextIdx].x;
					y2 = point.y - diff[nextIdx].y;
				} else {
					if (lineIdx%2) {
						// 右/右边框水平移动
						x1 = point.x - diff[lineIdx].x;
						y1 = +circles[lineIdx].getAttributeNS(null, 'cy');
						x2 = point.x - diff[nextIdx].x;
						y2 = +circles[nextIdx].getAttributeNS(null, 'cy');
					} else {
						// 上/下边框垂直移动
						x1 = +circles[lineIdx].getAttributeNS(null, 'cx');
						y1 = point.y - diff[lineIdx].y;
						x2 = +circles[nextIdx].getAttributeNS(null, 'cx');
						y2 = point.y - diff[nextIdx].y;
					}
				}

				movePoint({
					x: x1,
					y: y1
				}, lineIdx, !isCtrlKey, isShiftKey);
				movePoint({
					x: x2,
					y: y2
				}, nextIdx, !isCtrlKey, isShiftKey);
			}
		}
		if (moveable) {
			var mx,my,i;
			if (isCtrlKey) {
				if (!dirctionLocked) {
					mx = (point.x - diff[0].x) - doList[doList.length-1][0][0];
					my = (point.y - diff[0].y) - doList[doList.length-1][0][1];
					moveHori = Math.abs(mx) > Math.abs(my);
					dirctionLocked = true;
				}
				if (moveHori) {
					for (i = 0; i < points.length; i++) {
						points[i][0] = point.x - diff[i].x;
					}
				} else {
					for (i = 0; i < points.length; i++) {
						points[i][1] = point.y - diff[i].y;
					}
				}

			} else {
				for (i = 0; i < points.length; i++) {
					points[i][0] = point.x - diff[i].x;
					points[i][1] = point.y - diff[i].y;
				}
			}

			needBackup = true;
			updateFrame();
		}
	});
	body.addEventListener('mouseup', function() {
		if (needBackup || draggable || moveable || rotateable) {
			savePoints();
			needBackup = false;
		}
		if (draggable) {
			draggable = false;
			removeClass(stage,'draggable');
		}
		if (moveable) {
			moveable = false;
			polygon.setAttributeNS(null, 'class', '');
		}
		moveHori = false;
		draggable = false;
		moveable = false;
		rotateable = false;
		dirctionLocked = false;
	});
	body.addEventListener('mouseout', function(e) {
		rotateable = false;
	});
	body.addEventListener('keyup', function(e) {
		if ( e.ctrlKey && e.keyCode === 90 ) { // z
			if (e.shiftKey) {
				redo();
			} else {
				undo();
			}
		}
	});


	
	function movePoint(point, index, isCtrlKey, isShiftKey) {
		var cPoint = points[(index+len/2)%len];
		var mPoint = points[index];
		if (isShiftKey) {
			uniformScale([(cPoint[0]+mPoint[0])/2, (cPoint[1]+mPoint[1])/2],
				mPoint, point, true);
		} else if (isCtrlKey) {
			points[index] = pointToArray(point);
		} else {
			uniformScale(cPoint, mPoint, point, false);
		}
		updateFrame();
	}
	function uniformScale(cPoint, mPoint, point, xyUni) {
		var index = circleIdx === -1 ? lineIdx : circleIdx;
		var cX = cPoint[0];
		var cY = cPoint[1];
		var deg0 = Math.atan(mPoint[1]-cY, mPoint[0]-cX);
		var deg1 = Math.atan(point.y-cY, point.x-cX);
		var deg = deg1-deg0;
		var r0 = Math.sqrt( Math.pow(mPoint[0]-cX, 2) + Math.pow(mPoint[1]-cY, 2) );
		var r1 = Math.sqrt( Math.pow(point.x-cX, 2) + Math.pow(point.y-cY, 2) );
		var scaleX, scaleY;
		var s = r1/r0;
		var dx, dy, dl, d;
		if (xyUni) {
			scaleX = scaleY = s;
		} else {
			scaleX = (mPoint[0] - cX) === 0? 1 : (point.x-cX) / (mPoint[0] - cX);
			scaleY = (mPoint[1] - cY) === 0? 1 : (point.y-cY) / (mPoint[1] - cY);
			d = Math.atan2(scaleY, scaleX);
			dl = Math.sqrt( Math.pow(scaleX, 2) + Math.pow(scaleY,2) );
			scaleX = dl * Math.cos(d+deg);
			scaleY = dl * Math.sin(d+deg);
		}

		for (var i = 0; i < len; i++) {
			var p = points[i];
			var p2 = points[(i+1)%len];
			p[0] = cX + (p[0]-cX)*scaleX;
			p2[1] = cY + (p2[1]-cY)*scaleY;
		}

		return points;
	}

	function rotate(cPoint, rotateIdx, position) {
		if (rotateIdx < 0) {
			return true;
		}
		var mPoint = points[rotateIdx];
		var cX = cPoint.x;
		var cY = cPoint.y;
		var posX = position.x - cX;
		var posY = position.y - cY;
		var originalDeg = Math.atan2(mPoint[1]-cY, mPoint[0]-cX);
		var PI = Math.PI;
		var newDeg = Math.atan2(posY, posX);
		var deltaDeg = newDeg - originalDeg;
		var i, p, r, oldDeg;

		for (i = 0; i < points.length; i++) {
			p = points[i];
			r = Math.sqrt( Math.pow(p[0]-cX,2) + Math.pow(p[1]-cY, 2) );
			oldDeg = Math.atan2(p[1]-cY, p[0]-cX);
			p[0] = cX + r * Math.cos( oldDeg + deltaDeg );
			p[1] = cY + r * Math.sin( oldDeg + deltaDeg );
		}
		updateFrame();
	}
	function rotateTo(deg) {
		var radian = deg * Math.PI/180;
		var p0 = points[0];
		var cPoint = {
			x: p0[0] + points[2][0]/2,
			y: p0[1] + points[2][1]/2
		};
		var r0 = Math.sqrt( Math.pow(p0[0]-cPoint.x) + Math.pow(p0[1]-cPoint.y));
		var mPoint = {
			x: r* Math.cos(radian),
			y: r* Math.sin(radian)
		};
		_rotate(cPoint, 0, {
			x: 'x',
			y: 'y'
		});
	}

	function savePoints() {
		if (redoList.length > 0) {
			redoList = [];
		}
		doList.push( cloneArray(points) );
		if ( doList.length > HISTORY_LEN ) {
			doList = doList.slice(-HISTORY_LEN);
		}
		conf.onSave(points);
	}
	function undo() {
		if (doList.length > 1) {
			redoList.push(doList.pop());
			points = cloneArray(doList[doList.length-1]);
			conf.onUndo(points);
			updateFrame();
			return true;
		}
		return points;
	}
	function redo() {
		if (redoList.length > 0) {
			doList.push(redoList.pop());
			points = cloneArray(doList[doList.length-1]);
			conf.onRedo(points);
			updateFrame();
			return true;
		}
		return points;
	}
	function cloneArray(points) {
		return JSON.parse(JSON.stringify(points));
	}

	function pointToArray(point) {
		return [point.x, point.y];
	}

	function updateFrame(newPoints) {
		if (newPoints) {
			points = newPoints;
		}
		var polygonPoints = [];
		for (var i = 0; i < points.length; i++) {
			var p1 = points[i];
			var p2 = points[(i+1)%len];
			var line = lines[i];
			line.setAttributeNS(null, 'x1', p1[0]);
			line.setAttributeNS(null, 'y1', p1[1]);
			line.setAttributeNS(null, 'x2', p2[0]);
			line.setAttributeNS(null, 'y2', p2[1]);

			var circle = circles[i];
			circle.setAttributeNS(null, 'cx', p1[0]);
			circle.setAttributeNS(null, 'cy', p1[1]);

			polygonPoints.push( p1.join(',') );
		}
		polygon.setAttributeNS(null, 'points', polygonPoints.join(' '));
		conf.onUpdateFrame(points);
	}

	function get_mouse_position(box, event) {
		var rect = box.getBoundingClientRect();
		return {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top
		};
	}

	function addClass(el, cls) {
		if (el.classList)
		  el.classList.add(cls);
		else
		  el.className += ' ' + cls;
	}
	function removeClass(el, cls) {
		if (el.classList)
		  el.classList.remove(cls);
		else
		  el.className = el.className.replace(new RegExp('(^|\\b)' + cls.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
	}
	function extend(out) {
	  out = out || {};

	  for (var i = 1; i < arguments.length; i++) {
	    if (!arguments[i])
	      continue;

	    for (var key in arguments[i]) {
	      if (arguments[i].hasOwnProperty(key))
	        out[key] = arguments[i][key];
	    }
	  }

	  return out;
	}

	return {
		config: conf,
		frame: frame,
		updateFrame: updateFrame,
		savePoints: savePoints,
		undo: undo,
		redo: redo,
		cloneArray: cloneArray,
		uniformScale: uniformScale,
		movePoint: movePoint,
		rotate: rotate,
		getPoints: function () {
			return points;
		},
		getSaveHistory: function (idx) {
			return typeof idx === 'undefined'?
			cloneArray(doList)
			: cloneArray(doList.indexOf(idx));
		},
		getRedoHistory: function (idx) {
			return typeof idx === 'undefined'?
			cloneArray( redoList )
			: cloneArray(redoList.indexOf(idx));
		},
		clearHistory: function () {
			doList = [];
			redoList = [];
		}
	};
}

if (typeof module !== 'undefined' && typeof exports !== 'undefined') {
	module.exports = controllerFrame;
}