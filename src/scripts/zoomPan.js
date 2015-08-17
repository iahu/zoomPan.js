var ZoomPan = (function() {
	'use strict';
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
	function addClass (el, cls) {
		if (el.classList)
		  el.classList.add(cls);
		else
		  el.className += ' ' + cls;
		return el;
	}
	function removeClass (el, cls) {
		if (el.classList)
		  el.classList.remove(cls);
		else
		  el.className = el.className.replace(new RegExp('(^|\\b)' + cls.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
		return el;
	}

	function getStyle (el, s) {
		var styles = typeof window.getComputedStyle === 'function'? getComputedStyle(el) : el.currentStyle;
		if (s) {
			return styles[s];
		}
		return styles;
	}
	function getWheelDelta (evt) {
		var w=evt.wheelDelta, d=evt.detail;
		if (d){
		  if (w) return w/d/40*d>0?1:-1; // Opera
		  else return -d/3;              // Firefox;         TODO: do not /3 for OS X
		} else return w/120;             // IE/Safari/Chrome TODO: /3 for Chrome OS X
	}
	function ready(fn) {
	  if (document.readyState != 'loading'){
	    fn();
	  } else {
	    document.addEventListener('DOMContentLoaded', fn, false);
	  }
	}
	function proxy(fn, ctx) {
		return function () {
			return fn.apply(ctx, arguments);
		};
	}

	function addEvent(el, e, fn) {
		if ( el.addEventListener ) {
			el.addEventListener(e, fn);
		} else if (el.attachEvent) {
			el.attachEvent('on'+e, function (event) {
				var e = event || window.event;			
				if (typeof e.preventDefault !== 'function') {
					e.preventDefault = function () {
						e.returnValue = false;
					};

				}
				if ( typeof e.pageX === 'undefined' && typeof e.clientX !== 'undefined' ) {
					var doc = document.documentElement, body = document.body;
					e.pageX = e.clientX + (doc && doc.scrollLeft || body && body.scrollLeft || 0) - (doc && doc.clientLeft  || body && body.clientLeft || 0);
					e.pageY = e.clientY + (doc && doc.scrollTop  ||  body && body.scrollTop  || 0) - (doc && doc.clientTop  || body && body.clientTop  || 0);
				}
				fn(e);
			});
		} else {
			el['on'+el] = fn;
		}
	}

	function getNaturalSize (image) {
		if (typeof image.naturalWidth !== 'undefined') {
			return {
				width: image.naturalWidth,
				height: image.naturalHeight
			};
		} else {
			// todo
			var oWidth = image.style.width;
			var oHeight = image.style.height;
			image.style.width = 'auto';
			image.style.height = 'auto';
			var s = {
				width: parseInt(image.clientWidth),
				height: parseInt(image.clientHeight)
			};
			image.style.width = oWidth;
			image.style.height = oHeight;
			return s;
		}
	}
	function getImageSize (image) {
		// if ( typeof image.getBoundingClientRect === 'function' ) {
		// 	return image.getBoundingClientRect();
		// }
		return {
			width: image.width,
			height: image.height
		};
	}

	function ZoomPan(options) {
		// enforces new
		if (!(this instanceof ZoomPan)) {
			return new ZoomPan(options);
		}

		options.box = options.box.jquery? options.box[0] : options.box;
		if ( !(options.box && options.box.parentNode ) ) {
			return false;
		}

		this.options = extend({
			box: null,
			zoomFactor: 10,
			rotateDeg: 0,
			minScale: 1,
			maxScale: 10,
			onZoom: function () {},
			onMove: function () {}
		}, options);
		var box = options.box;
		var img = box.getElementsByTagName('img')[0];
		if (!img) {
			img = new Image();
			// return;
		}
		this.options.image = img;
		img.draggable = false;
		box.draggable = false;
		
		extend(this.options, {
			isMouseDown: false,
			isZoomOut: 0,
			zoomScale: 1,
			canMove: false,
			diff: null,
			boxSize: null,
			naturalSize: null,
			imageSize: null
		});
		

		this.init();
	}

	extend(ZoomPan.prototype, {
		init: function () {
			var that = this;
			var box = this.options.box;
			var image = this.options.image;
			if (image.loaded || image.complete) {
				that.initSize();
				that.bindUI();
			} else {
				addEvent(image, 'load', function () {
					that.initSize.call(that);
					that.bindUI.call(that);
				});
			}
		},
		initSize: function () {
			var box = this.options.box;
			var image = this.options.image;
			this.options.naturalSize = getNaturalSize(image);
			this.options.imageSize = getImageSize(image);
			this.options.boxSize = (function () {
				var size = box.getBoundingClientRect();
				return {
					width: box.clientWidth,
					height: box.clientHeight,
					top: size.top + document.body.scrollTop,
					left: size.left + document.body.scrollLeft,
					right: size.right,
					bottom: size.bottom
				};
			}());
		},

		bindUI: function () {
			var that = this;
			var opts = that.options;
			var box = opts.box;
			var image = opts.image;
			var boxSize = opts.boxSize;
			var diff = opts.diff;
			addEvent(box, 'mousedown', proxy(function (event) {
				that.setIsMouseDown(true);
				var e = event || window.event;
				diff = {
					x: e.pageX - opts.boxSize.left,
					y: e.pageY - opts.boxSize.top
				};
				if (opts.isZoomOut) {
					that.setIsCanMove(true);
				}
			}, this));
			addEvent(document, 'mouseup', proxy(function (event) {
				opts.diff = null;
				that.setIsMouseDown(false);
				that.setIsCanMove(false);
			}, this));
			
			addEvent(box, 'mousewheel', mouseScrollHanler);
			addEvent(box, 'DOMMouseScroll', mouseScrollHanler);
			function mouseScrollHanler(event) {
				var e = event || window.event;
				e.preventDefault();
				// todo 支持旋转缩放
				var delta = getWheelDelta(e);
				var zoomPoint = {
					x: e.pageX - opts.boxSize.left,
					y: e.pageY - opts.boxSize.top
				};
				that.zoom.call(that, delta, zoomPoint);
				return false;
			}

			addEvent(box, 'dragstart', function (event) {
				var e = event || window.event;
				e.preventDefault();
				if (  event.target === opts.image ) {
					return false;
				}
			});
			addEvent(box, 'mousemove', function(event) {
				if( event.target !== opts.image ) {return false;}
				if ( !opts.canMove ) {
					return true;
				}
				var e = event || window.event;
				var pointX = e.pageX - opts.boxSize.left;
				var pointY = e.pageY - opts.boxSize.top;
				var offsetX, offsetY;
				switch(opts.rotateDeg/90 % 4) {
					case 0:
						offsetX = (pointX-diff.x);
						offsetY = (pointY-diff.y);
						break;
					case 1:
						offsetX = (pointY-diff.y);
						offsetY = -(pointX-diff.x);
						break;
					case 2:
						offsetX = -(pointX-diff.x);
						offsetY = -(pointY-diff.y);
						break;
					case 3:
						offsetX = -(pointY-diff.y);
						offsetY = (pointX-diff.x);
						break;
				}
				offsetX += parseInt(opts.image.style.marginLeft);
				offsetY += parseInt(opts.image.style.marginTop);
				diff.x = pointX;
				diff.y = pointY;

				that.move(offsetX, offsetY);
			});
		},
		setIsMouseDown: function (state) {
			this.options.isMouseDown = state;
		},

		setIsCanMove: function (s) {
			this.options.canMove = s;
			if (s === true) {
				addClass(this.options.box, 'zp-canmove');
			} else {
				removeClass(this.options.box, 'zp-canmove');
			}
		},

		zoom: function (delta, zoomPoint) {
			var opts = this.options;
			zoomPoint = zoomPoint || {
				x: opts.boxSize.width/2,
				y: opts.boxSize.height/2
			};
			opts.lastZoomScale = opts.zoomScale;
			opts.zoomScale += delta / 10;
			opts.zoomScale = +opts.zoomScale.toFixed(2);
			this.setImageStyle(opts, zoomPoint);
			if ( opts.image.width > opts.boxSize.width ) {
				if (opts.image.width >= opts.naturalSize.width) {
					opts.isZoomOut = 2;
				} else {
					opts.isZoomOut = 1;
				}
			} else {
				opts.isZoomOut = 0;
				if ( opts.naturalSize.width === opts.boxSize.width &&
					opts.naturalSize.height === opts.boxSize.height ) {
					opts.isZoomOut = -1;
				}
			}
			this.options.onZoom.call(this, delta);
		},

		setImageStyle: function (opts, zoomPoint) {
			var img = opts.image;
			var boxSize = opts.boxSize;
			var imageSize = opts.imageSize;
			var naturalSize = opts.naturalSize;
			opts.zoomScale = Math.min(opts.maxScale, Math.max(opts.minScale, opts.zoomScale));
			var zoomScale = opts.zoomScale;
			var bWidth = boxSize.width;
			var bHeight = boxSize.height;
			var iWidth = imageSize.width * zoomScale;
			var iHeight = imageSize.height * zoomScale;
			var offsetX = parseInt(getStyle(img, 'marginLeft')) || 0;
			var offsetY = parseInt(getStyle(img, 'marginTop')) || 0;
			var deltaX, deltaY, cssText;

			if (!opts.lastZoomPoint) opts.lastZoomPoint = zoomPoint;
			var posX = ((zoomPoint.x-offsetX) * zoomScale/opts.lastZoomScale).toFixed(2);
			var posY = ((zoomPoint.y-offsetY) * zoomScale/opts.lastZoomScale).toFixed(2);
			opts.lastZoomPoint = {
				x : posX,
				y : posY
			};

			deltaX = zoomPoint.x - posX;
			deltaY = zoomPoint.y - posY;
			deltaX = Math.max(boxSize.width-iWidth, Math.min(deltaX, 0));
			deltaY = Math.max(boxSize.height-iHeight,Math.min(deltaY, 0));
			cssText = 'width:'+ iWidth + 'px;' +
				'height:'+ iHeight + 'px;margin-left:' + deltaX +
					'px;margin-top:' + deltaY + 'px;';
			img.style.cssText = cssText;

			imageSize = getImageSize(img);
			return img;
		},

		move: function (offsetX, offsetY) {
			var opts = this.options;
			var image = opts.image;
			var boxSize = opts.boxSize;
			image.style.marginLeft = Math.max(boxSize.width-image.width ,Math.min(offsetX, 0)) + 'px';
			image.style.marginTop = Math.max(boxSize.height-image.height, Math.min(offsetY, 0)) + 'px';
			this.options.onMove({
				offsetX: offsetX,
				offsetY: offsetY
			});
			return image;
		}
	});
	

	return ZoomPan;
}());
// require('./zp');

if (typeof module !== 'undefined' && typeof exports !== 'undefined') {
	module.exports = ZoomPan;
}
window.ZoomPan = ZoomPan;