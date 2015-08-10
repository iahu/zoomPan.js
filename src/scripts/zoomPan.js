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
		if ( typeof image.getBoundingClientRect === 'function' ) {
			return image.getBoundingClientRect();
		}
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

		if ( !(options.box && options.box.parentNode ) ) {
			return false;
		}

		options.box = options.box.jQuery? options.box[0] : options.box;
		this.options = extend({
			box: null,
			zoomFactor: 10
		}, options);
		var box = options.box;
		var img = box.getElementsByTagName('img')[0];
		if (!img) {
			return;
		}
		this.options.image = img;
		img.draggable = false;
		box.draggable = false;
		
		extend(this.options, {
			isMouseDown: false,
			isZoomOut: false,
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
				that.initSize(box, image);
				that.bindUI();
			} else {
				addEvent(image, 'load', function () {
					that.initSize.call(that, box, image);
					that.bindUI.call(that);
				});
			}
		},
		initSize: function (box, image) {
			this.options.naturalSize = getNaturalSize(image);
			this.options.imageSize = getImageSize(image);
			this.options.boxSize = (function () {
				var size = box.getBoundingClientRect();
				if (size.width) {
					return size;
				} else {
					return {
						width: box.clientWidth,
						height: box.clientHeight,
						left: size.left,
						right: size.right,
						top: size.top,
						bottom: size.bottom
					};
				}
			}());
		},

		bindUI: function () {
			var that = this;
			var opts = that.options;
			var box = opts.box;
			var image = opts.image;
			var boxSize = opts.boxSize;
			var diff = opts.diff;
			var reSize = this.reSize;
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

				var delta = getWheelDelta(e);
				var zoomPoint = {
					x: e.pageX - opts.boxSize.left,
					y: e.pageY - opts.boxSize.top
				};
				opts.imageSize = reSize(opts.imageSize, delta, opts.zoomFactor);
				that.setImageStyle(opts.image, opts.boxSize, opts.imageSize, opts.naturalSize, zoomPoint);
				if ( opts.imageSize.width > boxSize.width ) {
					opts.isZoomOut = true;
				} else {
					opts.isZoomOut = false;
				}
				return false;
			}

			addEvent(image, 'dragstart', function (event) {
				var e = event || window.event;
				e.preventDefault();
			});
			addEvent(image, 'mousemove', function(event) {
				if ( !opts.canMove ) {
					return true;
				}
				var e = event || window.event;
				var pointX = e.pageX - opts.boxSize.left;
				var pointY = e.pageY - opts.boxSize.top;
				var offsetX = parseInt(image.style.marginLeft) + pointX-diff.x;
				var offsetY = parseInt(image.style.marginTop) +  pointY-diff.y;
				diff.x = pointX;
				diff.y = pointY;

				that.move(image, offsetX, offsetY);
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

		reSize:function (imgSize, z, factor) {
			var iWidth = imgSize.width;
			var iHeight = imgSize.height;
			var proportion = iWidth / iHeight;
			factor = typeof factor === 'number'? factor : 10;

			return {
				width: iWidth + z*proportion * factor,
				height: iHeight + z * factor
			};
		},

		setImageStyle: function (img, boxSize, imageSize, naturalSize, zoomPoint) {
			var bWidth = boxSize.width;
			var bHeight =boxSize.height;
			var iWidth = imageSize.width;
			var iHeight = imageSize.height;
			var offsetX = parseInt(getStyle(img, 'marginLeft')) || 0;
			var offsetY = parseInt(getStyle(img, 'marginTop')) || 0;
			var deltaX, deltaY, cssText;

			if ( iWidth > bWidth ) {
				imageSize.width = Math.min(iWidth, naturalSize.width);
				imageSize.height = Math.min(iHeight, naturalSize.height);
			} else {
				imageSize.width = Math.max(iWidth, bWidth);
				imageSize.height = Math.max(iHeight, bHeight);
			}
			iWidth = imageSize.width;
			iHeight = imageSize.height;

			deltaX = offsetX -(iWidth - img.width) * (zoomPoint.x/boxSize.width);
			deltaY = offsetY -(iHeight - img.height) * (zoomPoint.y/boxSize.height);
			deltaX = Math.max(boxSize.width-imageSize.width, Math.min(deltaX, 0));
			deltaY = Math.max(boxSize.height-imageSize.height,Math.min(deltaY, 0));
			cssText = 'width:'+ imageSize.width + 'px;' +
				'height:'+imageSize.height + 'px;margin-left:' + deltaX +
					'px;margin-top:' + deltaY + 'px;';
			img.style.cssText = cssText;

			imageSize = getImageSize(img);
			return img;
		},

		move: function (image, offsetX, offsetY) {
			var boxSize = this.options.boxSize;
			var imageSize = this.options.imageSize;
			image.style.marginLeft = Math.max(boxSize.width-imageSize.width ,Math.min(offsetX, 0)) + 'px';
			image.style.marginTop = Math.max(boxSize.height-imageSize.height, Math.min(offsetY, 0)) + 'px';

			return image;
		}
	});
	

	return ZoomPan;
}());