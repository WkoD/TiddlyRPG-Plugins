/*\
title: $:/plugins/dndwiki-core/graph/ego-toggle.js
type: application/javascript
module-type: vis-property
created: 20261006064449000
modified: 20261006064449000

Node property dndToggle (tw5-vis-network, like its own properties/events.js): a node that folds
and unfolds with a single click. Used by the ego graph of a location
(graph/templates/dnd-ego): a place within it starts folded ("▸"); a click unfolds it ("▾") and
the graph adds who is there, who leads it and the rest of its neighbours; another click folds it
again.

The value of dndToggle is the state tiddler of the graph; its field "list" holds the unfolded
nodes. tw5-vis-network passes only the double click on to the node actions (that one opens the
tiddler), so this module listens to the click of vis-network itself. A double click also fires
two clicks first: the toggle waits DELAY milliseconds and is dropped when a double click
follows, so opening the tiddler does not fold the node as well.

\*/

"use strict";

exports.name = "dnd-ego-toggle";

exports.properties = {
	nodes: {
		dndToggle: {type: "string"}
	}
};

var DELAY = 300;

exports.DELAY = DELAY;

// Fold or unfold one node: its title in or out of the list field of the state tiddler
function toggle(wiki,state,id) {
	var list = wiki.getTiddlerList(state).slice(),
		index = list.indexOf(id);
	if(index === -1) {
		list.push(id);
	} else {
		list.splice(index,1);
	}
	wiki.addTiddler(new $tw.Tiddler({title: state, list: list}));
}

exports.toggle = toggle;

exports.init = function(visNetwork) {
	var self = this;
	self.dndToggles = self.dndToggles || {};
	var cancel = function() {
		if(self.dndToggleTimer) {
			clearTimeout(self.dndToggleTimer);
			self.dndToggleTimer = null;
		}
	};
	visNetwork.on("click",function(params) {
		var id = params && params.nodes && params.nodes.length === 1 ? params.nodes[0] : null,
			state = id !== null ? self.dndToggles[id] : null;
		cancel();
		if(state) {
			self.dndToggleTimer = setTimeout(function() {
				self.dndToggleTimer = null;
				toggle($tw.wiki,state,id);
			},DELAY);
		}
	});
	visNetwork.on("doubleClick",cancel);
};

exports.process = function(objects,changes) {
	if(changes.nodes) {
		this.dndToggles = this.dndToggles || {};
		for(var id in changes.nodes) {
			var node = changes.nodes[id];
			if(!node) {
				delete this.dndToggles[id];
			} else if(node.dndToggle !== undefined) {
				if(node.dndToggle) {
					this.dndToggles[id] = node.dndToggle;
				} else {
					delete this.dndToggles[id];
				}
				node.dndToggle = undefined;
			}
		}
	}
};

exports.destroy = function() {
	if(this.dndToggleTimer) {
		clearTimeout(this.dndToggleTimer);
		this.dndToggleTimer = null;
	}
};
