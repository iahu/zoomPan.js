/**
 * Size class help to scale
 * @param {object} size object
 * e.g. {width: 100, height: 100, scaleAt: {x: 50, y: 50}}
 */
function Size (size) {
	size = this.size = clone(size);
	var o = {width: 0, height: 0, scaleAt:{x:0,y:0}};

	for (var key in o) {
		if (!size.hasOwnProperty(key)) {
			size[key] = o[key];
		}
	}

	return this;
}

function clone (size) {
	return JSON.parse(JSON.stringify(size));
}

Size.prototype.scaleAt = function(point) {
	var size = clone(this.size);
	size.scaleAt = point;

	return new Size(size);
};

Size.prototype.scale = function(scale) {
	var size = clone(this.size);
	var at = size.scaleAt;

	var xAt = at.x/size.width;
	var yAt = at.y/size.height;

	size.width = +(size.width * scale).toFixed(10);
	size.height = +(size.height * scale).toFixed(10);
	at.x = +(xAt*size.width).toFixed(10);
	at.y = +(yAt*size.height).toFixed(10);

	return new Size(size);
};

if (typeof module === 'object' && typeof exports !== 'undefined') {
	module.exports = Size;
}
