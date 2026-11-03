/*\
title: $:/plugins/tiddlyrpg-core/graph/included.js
type: application/javascript
module-type: vis-property
created: 20261103173828774
modified: 20261103173828774

Node property trpgIncluded="yes" (tw5-vis-network, like graph/pill.js): an entry of a content
package included in the wiki without an own version (modules/content-include.js) - its label in
italics, as its links and tag pills. Set for every graph by trpg.graphnodes (functions,
[trpgincluded[]]).

vis-network draws a label in italics only as a label of several fonts: font.multi "html" with the
label in <i>...</i> (font.mod does nothing). Every change of tw5-vis-network brings the whole node,
so the label is wrapped anew each time and an own version (no trpgIncluded) is plain again. A
node that draws its own label - a pin of the map (graph/map-pin.js reads trpgIncluded itself),
a dead or a rumour striped by graph/pill.js - keeps its label as it is.

\*/

"use strict";

exports.name = "trpg-included";

exports.properties = {
	nodes: {
		trpgIncluded: {type: "string"}
	}
};

exports.process = function(objects,changes) {
	if(changes.nodes) {
		for(var id in changes.nodes) {
			var node = changes.nodes[id];
			if(node && node.trpgIncluded === "yes" && node.trpgPin === undefined && node.shape !== "custom" &&
				node.trpgDead !== "yes" && node.trpgRumour !== "yes" && typeof node.label === "string" && node.label.indexOf("<i>") !== 0) {
				node.font = node.font || {};
				node.font.multi = "html";
				node.label = "<i>" + node.label + "</i>";
			}
		}
	}
};
