/*\
title: $:/plugins/tiddlyrpg-core/graph/map-pin.js
type: application/javascript
module-type: vis-property
created: 20261006064449000
modified: 20261103173828774

Node property trpgPin (tw5-vis-network, like its own properties/nodes.js): a node of the map of a
location (graph/templates/trpg-map) drawn as a pin - a dot at its position and its name in a pill
below it:

- trpgPin="tiddler": a place that is a tiddler; the dot in the colour of the node, the pill like
  a tag pill - light inside, that colour around (graph/pill.js) -, the text in contrast to it;
  a dead place (trpgDead, graph/pill.js) with the pill striped grey and its colour.
- trpgPin="spot": a spot without a tiddler of its own; a pill striped at 45° in white (the
  background of the graph) and the light colour of the node, with a dashed border in the
  border colour of the node, the dot in that colour.
- trpgPin="quest": an open quest or rumour that leads to the map (graph/templates/trpg-map):
  the pill alone at the position, without the dot - light inside, gold around like its pill
  (graph/pill.js); a rumour (trpgRumour) dashed and striped at 45° in the background and the
  light gold. Hovering or selecting makes its border thicker.

An entry of a content package included without an own version (trpgIncluded, graph/included.js)
has its name in italics.

Dot, pill and text keep their size on screen whatever the zoom - the quests like the places - (all sizes divided by the scale of
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

var DOT = 5, FONT = 12, FAMILY = "arial", PAD_X = 6, PAD_Y = 3, GAP = 4, RADIUS = 8, STRIPE = 16;

function textColour(background) {
	try {
		return $tw.macros.contrastcolour.run(background || "","#ffffff","#000000","#ffffff");
	} catch(e) {
		return "#ffffff";
	}
}

// The ctxRenderer of vis-network for one node; adapter = the adapter of tw5-vis-network
function renderer(adapter,kind,dead,italic,rumour) {
	return function(args) {
		var ctx = args.ctx,
			x = args.x,
			y = args.y,
			style = args.style || {},
			label = args.label || "",
			scale = (adapter.vis && adapter.vis.getScale()) || 1,
			unit = 1 / scale,
			spot = kind === "spot",
			quest = kind === "quest",
			active = !!(args.state && (args.state.selected || args.state.hover)),
			colour = style.borderColor || style.color,
			fill = spot ? "#ffffff" : (quest ? pill.mix(colour,adapter.trpgPillBase) : style.color),
			font = (italic ? "italic " : "") + (FONT * unit) + "px " + FAMILY;
		ctx.font = font;
		var pillWidth = label ? ctx.measureText(label).width + 2 * PAD_X * unit : 0,
			pillHeight = label ? (FONT + 2 * PAD_Y) * unit : 0,
			pillTop = quest ? y - pillHeight / 2 : y + (DOT + GAP) * unit;
		return {
			drawNode: function() {
				ctx.font = font;
				if(active && !quest) {
					ctx.beginPath();
					ctx.arc(x,y,(DOT + 3) * unit,0,2 * Math.PI);
					ctx.lineWidth = 2 * unit;
					ctx.strokeStyle = colour;
					ctx.stroke();
				}
				if(!quest) {
					ctx.beginPath();
					ctx.arc(x,y,DOT * unit,0,2 * Math.PI);
					ctx.fillStyle = colour;
					ctx.fill();
				}
				if(label) {
					roundRect(ctx,x - pillWidth / 2,pillTop,pillWidth,pillHeight,RADIUS * unit);
					if(spot || dead || rumour) {
						// A spot and a rumour: the colour of the node and the background; a dead place: grey and
						// its colour
						var colours = spot || rumour ? [adapter.trpgPillBase || "#ffffff",pill.mix(colour,adapter.trpgPillBase)] : pill.deadColours(adapter,colour);
						pill.stripes(ctx,x - pillWidth / 2,pillTop,pillWidth,pillHeight,colours[0],colours[1],STRIPE * unit);
						roundRect(ctx,x - pillWidth / 2,pillTop,pillWidth,pillHeight,RADIUS * unit);
					} else {
						ctx.fillStyle = fill;
						ctx.fill();
					}
					ctx.lineWidth = (spot ? 1.5 : (quest && active ? 2 : 1)) * unit;
					ctx.setLineDash(spot || rumour ? [4 * unit,3 * unit] : []);
					ctx.strokeStyle = colour;
					ctx.stroke();
					ctx.setLineDash([]);
					ctx.fillStyle = spot || dead || quest ? (adapter.trpgPillText || "#333333") : textColour(fill);
					ctx.textAlign = "center";
					ctx.textBaseline = "middle";
					ctx.fillText(label,x,pillTop + pillHeight / 2);
				}
			},
			nodeDimensions: quest ? {width: pillWidth,height: pillHeight} : {
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
				if(node.trpgPin === "tiddler" || node.trpgPin === "spot" || node.trpgPin === "quest") {
					node.shape = "custom";
					node.ctxRenderer = renderer(this,node.trpgPin,node.trpgDead === "yes",node.trpgIncluded === "yes",node.trpgRumour === "yes");
				}
				node.trpgPin = undefined;
			}
		}
	}
};
