/*\
title: $:/plugins/tiddlyrpg-core/graph/map-pin.js
type: application/javascript
module-type: vis-property
created: 20261006064449000
modified: 20261015161851000

Node property trpgPin (tw5-vis-network, like its own properties/nodes.js): a node of the map of a
location (graph/templates/trpg-map) drawn as a pin - a dot at its position and its name in a pill
below it:

- trpgPin="tiddler": a place that is a tiddler; the dot in the colour of the node, the pill like
  a tag pill - light inside, that colour around (graph/pill.js) -, the text in contrast to it;
  a dead place (trpgDead, graph/pill.js) with the pill striped grey and its colour.
- trpgPin="spot": a spot without a tiddler of its own; a white pill with a dashed border in the
  border colour of the node, the dot in that colour.

Dot, pill and text keep their size on screen whatever the zoom (all sizes divided by the scale of
the view): zooming in, they cover less and less of the map. The node becomes a vis-network
"custom" shape; its size for clicks, hovering and edges is a box around the dot that holds the
pill. Hovering or selecting puts a ring around the dot.

\*/

"use strict";

exports.name = "trpg-map-pin";

exports.properties = {
	nodes: {
		trpgPin: {type: "string"}
	}
};

var pill = require("$:/plugins/tiddlyrpg-core/graph/pill.js"),
	roundRect = pill.roundRect;

var DOT = 5, FONT = 12, FAMILY = "arial", PAD_X = 6, PAD_Y = 3, GAP = 4, RADIUS = 8, STRIPE = 4;

function textColour(background) {
	try {
		return $tw.macros.contrastcolour.run(background || "","#ffffff","#000000","#ffffff");
	} catch(e) {
		return "#ffffff";
	}
}

// The ctxRenderer of vis-network for one node; adapter = the adapter of tw5-vis-network
function renderer(adapter,kind,dead) {
	return function(args) {
		var ctx = args.ctx,
			x = args.x,
			y = args.y,
			style = args.style || {},
			label = args.label || "",
			scale = (adapter.vis && adapter.vis.getScale()) || 1,
			unit = 1 / scale,
			spot = kind === "spot",
			colour = style.borderColor || style.color,
			fill = spot ? "#ffffff" : style.color;
		ctx.font = (FONT * unit) + "px " + FAMILY;
		var pillWidth = label ? ctx.measureText(label).width + 2 * PAD_X * unit : 0,
			pillHeight = label ? (FONT + 2 * PAD_Y) * unit : 0,
			pillTop = y + (DOT + GAP) * unit;
		return {
			drawNode: function() {
				if(args.state && (args.state.selected || args.state.hover)) {
					ctx.beginPath();
					ctx.arc(x,y,(DOT + 3) * unit,0,2 * Math.PI);
					ctx.lineWidth = 2 * unit;
					ctx.strokeStyle = colour;
					ctx.stroke();
				}
				ctx.beginPath();
				ctx.arc(x,y,DOT * unit,0,2 * Math.PI);
				ctx.fillStyle = colour;
				ctx.fill();
				if(label) {
					roundRect(ctx,x - pillWidth / 2,pillTop,pillWidth,pillHeight,RADIUS * unit);
					if(dead && !spot) {
						var colours = pill.deadColours(adapter,colour);
						pill.stripes(ctx,x - pillWidth / 2,pillTop,pillWidth,pillHeight,colours[0],colours[1],STRIPE * unit);
						roundRect(ctx,x - pillWidth / 2,pillTop,pillWidth,pillHeight,RADIUS * unit);
					} else {
						ctx.fillStyle = fill;
						ctx.fill();
					}
					ctx.lineWidth = (spot ? 1.5 : 1) * unit;
					ctx.setLineDash(spot ? [4 * unit,3 * unit] : []);
					ctx.strokeStyle = colour;
					ctx.stroke();
					ctx.setLineDash([]);
					ctx.fillStyle = spot ? "#000000" : dead ? (adapter.trpgPillText || "#333333") : textColour(fill);
					ctx.textAlign = "center";
					ctx.textBaseline = "middle";
					ctx.fillText(label,x,pillTop + pillHeight / 2);
				}
			},
			nodeDimensions: {
				width: Math.max(pillWidth,2 * DOT * unit),
				height: 2 * (pillTop - y + pillHeight)
			}
		};
	};
}

exports.renderer = renderer;

exports.process = function(objects,changes) {
	if(changes.nodes) {
		for(var id in changes.nodes) {
			var node = changes.nodes[id];
			if(node && node.trpgPin !== undefined) {
				if(node.trpgPin === "tiddler" || node.trpgPin === "spot") {
					node.shape = "custom";
					node.ctxRenderer = renderer(this,node.trpgPin,node.trpgDead === "yes");
				}
				node.trpgPin = undefined;
			}
		}
	}
};
