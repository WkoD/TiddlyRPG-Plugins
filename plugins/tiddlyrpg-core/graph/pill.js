/*\
title: $:/plugins/tiddlyrpg-core/graph/pill.js
type: application/javascript
module-type: vis-property
created: 20261015160005000
modified: 20261015161851000

Node property trpgPill (tw5-vis-network, like its own properties/color.js): a node drawn like a
tag pill ($:/core/macros/tag) - its colour as the border, inside that colour at 18 % on the
background of the graph, the label in the font colour of the graph. Set by the graph templates
(graph/templates/trpg-ego, trpg-graph, trpg-map) for every node; the pins of a map
(graph/map-pin.js) draw the same from it. A node with a border colour of its own or without a
colour of its own stays as it is.

Node property trpgDead="yes" (the templates set it for trpg.dead): the node is striped at 45°
inside instead, grey and its colour, both at 18 % (as its tag pill, $:/core/macros/tag) - a box
drawn by a ctxRenderer of its own, since a box of vis-network fills with one colour only; the pin
of a map stripes its pill the same way (graph/map-pin.js, stripes()).

The graph properties trpgPillBase and trpgPillText fetch the background and the font colour from
the palette (graph-background, graph-font-color).

\*/

"use strict";

exports.name = "trpg-pill";

exports.properties = {
	graph: {
		trpgPillBase: {type: "color", default: "graph-background", hidden: true, always: true},
		trpgPillText: {type: "color", default: "graph-font-color", hidden: true, always: true}
	},
	nodes: {
		trpgPill: {type: "string"},
		trpgDead: {type: "string"}
	}
};

var SHARE = 0.18, STRIPE = 6, FONT = 14, FAMILY = "arial", MARGIN = 5, RADIUS = 6;

var roundRect = exports.roundRect = function(ctx,x,y,width,height,radius) {
	radius = Math.min(radius,height / 2,width / 2);
	ctx.beginPath();
	ctx.moveTo(x + radius,y);
	ctx.arcTo(x + width,y,x + width,y + height,radius);
	ctx.arcTo(x + width,y + height,x,y + height,radius);
	ctx.arcTo(x,y + height,x,y,radius);
	ctx.arcTo(x,y,x + width,y,radius);
	ctx.closePath();
};

// Fills the current path with stripes at 45° ("\", as in CSS), <a> and <b> alike wide (<width>)
var stripes = exports.stripes = function(ctx,x,y,w,h,a,b,width) {
	ctx.save();
	ctx.clip();
	ctx.fillStyle = a;
	ctx.fillRect(x,y,w,h);
	ctx.fillStyle = b;
	for(var o = -h; o < w + h; o += 2 * width) {
		ctx.beginPath();
		ctx.moveTo(x + o,y);
		ctx.lineTo(x + o + width,y);
		ctx.lineTo(x + o + width + h,y + h);
		ctx.lineTo(x + o + h,y + h);
		ctx.closePath();
		ctx.fill();
	}
	ctx.restore();
};

// The two colours of the stripes of a dead node: grey (the font colour) and <colour>, both mixed
exports.deadColours = function(adapter,colour) {
	return [mix(adapter.trpgPillText || "#333333",adapter.trpgPillBase),mix(colour,adapter.trpgPillBase)];
};

// The ctxRenderer of a dead node: a box like those of vis-network, striped inside
function deadBox(adapter,border) {
	return function(args) {
		var ctx = args.ctx,
			lines = (args.label || "").split("\n"),
			lineHeight = FONT + 2;
		ctx.font = FONT + "px " + FAMILY;
		var textWidth = Math.max.apply(null,lines.map(function(line) { return ctx.measureText(line).width; })),
			w = textWidth + 2 * MARGIN,
			h = lines.length * lineHeight + 2 * MARGIN,
			left = args.x - w / 2,
			top = args.y - h / 2,
			colours = exports.deadColours(adapter,border);
		return {
			drawNode: function() {
				roundRect(ctx,left,top,w,h,RADIUS);
				stripes(ctx,left,top,w,h,colours[0],colours[1],STRIPE);
				roundRect(ctx,left,top,w,h,RADIUS);
				ctx.lineWidth = args.state && (args.state.selected || args.state.hover) ? 2 : 1;
				ctx.strokeStyle = border;
				ctx.stroke();
				ctx.fillStyle = adapter.trpgPillText || "#333333";
				ctx.font = FONT + "px " + FAMILY;
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				lines.forEach(function(line,i) {
					ctx.fillText(line,args.x,top + MARGIN + lineHeight * (i + 0.5));
				});
			},
			nodeDimensions: {width: w,height: h}
		};
	};
}

// A CSS colour as [r,g,b], or null
function rgb(colour) {
	var parsed = $tw.utils.parseCSSColor ? $tw.utils.parseCSSColor(colour || "") : null;
	if(parsed) {
		return parsed.slice(0,3);
	}
	var hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((colour || "").trim());
	if(!hex) {
		return null;
	}
	var h = hex[1].length === 3 ? hex[1].replace(/./g,"$&$&") : hex[1];
	return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
}

// <colour> at SHARE on <base>, as #rrggbb; <colour> itself if either cannot be read
var mix = exports.mix = function(colour,base) {
	var a = rgb(colour),
		b = rgb(base || "#ffffff");
	if(!a || !b) {
		return colour;
	}
	return "#" + a.map(function(value,i) {
		var mixed = Math.round(value * SHARE + b[i] * (1 - SHARE));
		return (mixed < 16 ? "0" : "") + mixed.toString(16);
	}).join("");
};

exports.process = function(objects,changes) {
	var graph = changes.graph;
	if(graph) {
		if(graph.trpgPillBase !== undefined) {
			this.trpgPillBase = graph.trpgPillBase;
			graph.trpgPillBase = undefined;
		}
		if(graph.trpgPillText !== undefined) {
			this.trpgPillText = graph.trpgPillText;
			graph.trpgPillText = undefined;
		}
	}
	if(changes.nodes) {
		for(var id in changes.nodes) {
			var node = changes.nodes[id];
			if(node && node.trpgPill !== undefined) {
				if(node.trpgPill === "yes" && typeof node.color === "string" && node.color && !node.borderColor) {
					var border = node.color,
						inside = mix(border,this.trpgPillBase),
						pin = node.trpgPin !== undefined || node.shape === "custom";
					node.color = {
						background: inside,
						border: border,
						highlight: {background: inside, border: border},
						hover: {background: inside, border: border}
					};
					if(node.trpgDead === "yes" && !pin) {
						node.shape = "custom";
						node.ctxRenderer = deadBox(this,border);
					} else if(this.trpgPillText && !pin) {
						node.font = node.font || {};
						node.font.color = this.trpgPillText;
					}
				}
				node.trpgPill = undefined;
			}
		}
	}
};
