/*\
title: $:/plugins/tiddlyrpg-core/graph/pill.js
type: application/javascript
module-type: vis-property
created: 20261015160005000
modified: 20261015160005000

Node property trpgPill (tw5-vis-network, like its own properties/color.js): a node drawn like a
tag pill ($:/core/macros/tag) - its colour as the border, inside that colour at 18 % on the
background of the graph, the label in the font colour of the graph. Set by the graph templates
(graph/templates/trpg-ego, trpg-graph, trpg-map) for every node; the pins of a map
(graph/map-pin.js) draw the same from it. A node with a border colour of its own (the dead: grey
inside, the colour of their type around) or without a colour of its own stays as it is.

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
		trpgPill: {type: "string"}
	}
};

var SHARE = 0.18;

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
						inside = mix(border,this.trpgPillBase);
					node.color = {
						background: inside,
						border: border,
						highlight: {background: inside, border: border},
						hover: {background: inside, border: border}
					};
					if(this.trpgPillText && node.shape !== "custom") {
						node.font = node.font || {};
						node.font.color = this.trpgPillText;
					}
				}
				node.trpgPill = undefined;
			}
		}
	}
};
