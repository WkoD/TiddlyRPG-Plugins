/*\
title: $:/plugins/dndwiki-core/graph/map-fit.js
type: application/javascript
module-type: vis-property
created: 20261006064449000
modified: 20261006064449000

Graph properties for the map of a location (graph/templates/dnd-map), in the manner of the
properties of tw5-vis-network (properties/background.js):

- dndMapImage: the URL of the map image. It is drawn behind the nodes, centred on the origin and
  always MAP_WIDTH units wide, whatever the size of the file. Positions on the map are therefore
  in these units (origin in the middle), and nodes, labels and borders keep about their normal
  size at a usual tiddler width - drawn in image pixels, a large map would shrink them to
  unreadable dots.
- dndMapFit: "image" shows the whole image and every node across the full width of the
  container: the frame is the image, widened to the nodes that lie outside it (a pin placed
  below the map on purpose stays visible); scale = container width / frame width, the height of
  the container follows the frame, so nothing is cut off; "nodes" (a location without a map image) fits the
  view to the nodes, the height stays as the stylesheet sets it. Fitted once the image has
  loaded (or on the first frame), after vis fitted to the nodes (stabilized), and when the
  container changes its width. Once the viewer zooms or drags the view, the automatic fit stops
  until the message dnd-map-fit (graph/map-fit-message.js, button "Fit map") or a change of the
  width. It also switches off the improved layout of vis-network, which would shift the placed
  nodes away from their positions.

Node property dndUnplaced: a fixed node without a saved position. vis-network would put all of
them in a small circle around the origin, one on top of the other; instead each gets a slot in a
grid of three columns around the origin, kept per node id, so it can be seen and dragged.

\*/

"use strict";

exports.name = "dnd-map-fit";

exports.properties = {
	graph: {
		dndMapFit: {type: "string"},
		dndMapImage: {type: "string"}
	},
	nodes: {
		dndUnplaced: {type: "boolean"}
	}
};

var MAP_WIDTH = 600;

exports.MAP_WIDTH = MAP_WIDTH;

var SLOT_COLUMNS = 3, SLOT_WIDTH = 200, SLOT_HEIGHT = 40;

// The grid position of a node without a saved position; the slot stays with the node id
function slot(adapter,id) {
	adapter.dndSlots = adapter.dndSlots || {};
	if(adapter.dndSlots[id] === undefined) {
		adapter.dndSlotCount = adapter.dndSlotCount || 0;
		adapter.dndSlots[id] = adapter.dndSlotCount++;
	}
	var n = adapter.dndSlots[id];
	return {
		x: ((n % SLOT_COLUMNS) - (SLOT_COLUMNS - 1) / 2) * SLOT_WIDTH,
		y: Math.floor(n / SLOT_COLUMNS) * SLOT_HEIGHT
	};
}

exports.slot = slot;

// Size the container and fit the view to the image (or to the nodes without an image); this is
// the adapter of tw5-vis-network
function fit(adapter,force) {
	var image = adapter.dndImage,
		element = adapter.element,
		vis = adapter.vis;
	if(!adapter.dndMapFit || !element || !vis) {
		return false;
	}
	var width = element.clientWidth;
	if(!width) {
		// A tab that is not shown yet: try again when it gets a width
		return false;
	}
	if(adapter.dndMapFit === "nodes") {
		if(!adapter.dndMapMoved || force) {
			vis.fit({animation: false});
			adapter.dndMapMoved = false;
		}
		return true;
	}
	if(!image || !image.width) {
		return false;
	}
	if(adapter.dndMapMoved && !force) {
		return true;
	}
	var frame = frameOf(MAP_WIDTH,MAP_WIDTH * image.height / image.width,vis.getPositions ? vis.getPositions() : {}),
		scale = width / (frame.right - frame.left),
		height = Math.round((frame.bottom - frame.top) * scale);
	if(element.style.height !== height + "px") {
		element.style.height = height + "px";
		vis.setSize("100%",height + "px");
	}
	vis.moveTo({position: {x: (frame.left + frame.right) / 2, y: (frame.top + frame.bottom) / 2}, scale: scale, animation: false});
	adapter.dndMapMoved = false;
	return true;
}

exports.fit = fit;

// Room around a pin (graph/map-pin.js) in map units: its pill hangs below the dot
var PIN_SIDE = 60, PIN_TOP = 10, PIN_BOTTOM = 35;

// The frame of the map: the image (centred on the origin), widened to every node outside it
function frameOf(imageWidth,imageHeight,positions) {
	var frame = {left: -imageWidth / 2, right: imageWidth / 2, top: -imageHeight / 2, bottom: imageHeight / 2};
	for(var id in positions) {
		var p = positions[id];
		if(p && isFinite(p.x) && isFinite(p.y)) {
			frame.left = Math.min(frame.left,p.x - PIN_SIDE);
			frame.right = Math.max(frame.right,p.x + PIN_SIDE);
			frame.top = Math.min(frame.top,p.y - PIN_TOP);
			frame.bottom = Math.max(frame.bottom,p.y + PIN_BOTTOM);
		}
	}
	return frame;
}

exports.frameOf = frameOf;

exports.init = function(visNetwork) {
	var self = this;
	self.dndMapFitted = false;
	visNetwork.on("beforeDrawing",function(ctx) {
		var image = self.dndImage;
		if(image && image.width) {
			var height = MAP_WIDTH * image.height / image.width;
			ctx.drawImage(image,-MAP_WIDTH / 2,-height / 2,MAP_WIDTH,height);
		}
	});
	visNetwork.on("afterDrawing",function() {
		// The image arrives after loading; fit on the first frame after that
		if(!self.dndMapFitted && (self.dndMapFit === "nodes" || (self.dndMapFit && self.dndImage))) {
			self.dndMapFitted = fit(self,true);
		}
	});
	visNetwork.on("stabilized",function() {
		fit(self,false);
	});
	visNetwork.on("zoom",function() {
		self.dndMapMoved = true;
	});
	visNetwork.on("dragEnd",function(params) {
		if(!params.nodes || params.nodes.length === 0) {
			self.dndMapMoved = true;
		}
	});
	var win = self.element && self.element.ownerDocument && self.element.ownerDocument.defaultView;
	if(win && win.ResizeObserver) {
		var lastWidth = 0;
		self.dndMapObserver = new win.ResizeObserver(function() {
			var width = self.element.clientWidth;
			if(width && width !== lastWidth) {
				lastWidth = width;
				// Changing the height inside the callback would report a resize loop
				win.requestAnimationFrame(function() {
					fit(self,true);
				});
			}
		});
		self.dndMapObserver.observe(self.element);
	}
};

// Load the map image; it is set (and the view fitted) once it has loaded
function loadImage(adapter,url) {
	if(adapter.dndImageUrl === url) {
		return;
	}
	adapter.dndImageUrl = url;
	adapter.dndImage = undefined;
	if(!url) {
		return;
	}
	var win = adapter.window ? adapter.window() : null;
	if(!win || !win.Image) {
		return;
	}
	var image = new win.Image();
	image.onload = function() {
		if(adapter.dndImageUrl === url) {
			adapter.dndImage = image;
			adapter.dndMapFitted = false;
			if(adapter.vis) {
				adapter.vis.redraw();
			}
		}
	};
	image.src = url;
}

exports.process = function(objects,changes) {
	if(changes.nodes) {
		for(var id in changes.nodes) {
			var node = changes.nodes[id];
			if(node && node.dndUnplaced !== undefined) {
				if(node.dndUnplaced && node.x === undefined && node.y === undefined) {
					var position = slot(this,id);
					node.x = position.x;
					node.y = position.y;
				}
				node.dndUnplaced = undefined;
			}
		}
	}
	if(changes.graph) {
		// Like background.js: the graph changes carry all graph properties, a missing one is unset
		loadImage(this,changes.graph.dndMapImage || "");
		changes.graph.dndMapImage = undefined;
		if(changes.graph.dndMapFit !== undefined) {
			this.dndMapFit = changes.graph.dndMapFit === "image" || changes.graph.dndMapFit === "nodes" ? changes.graph.dndMapFit : null;
			changes.graph.dndMapFit = undefined;
			if(this.dndMapFit) {
				// The improved layout of vis-network (Kamada-Kawai, while fewer than half of the
				// nodes have a position) shifts all nodes to the centre afterwards - the saved
				// positions on the map would move with it
				changes.graph.layout = $tw.utils.extend({},changes.graph.layout,{improvedLayout: false});
			}
		}
	}
};

exports.destroy = function() {
	if(this.dndMapObserver) {
		this.dndMapObserver.disconnect();
		this.dndMapObserver = null;
	}
};
