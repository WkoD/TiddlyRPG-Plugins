/*\
title: $:/plugins/tiddlyrpg-core/graph/ego-toggle.js
type: application/javascript
module-type: vis-property
created: 20261006064449000
modified: 20261006064449000

Node property trpgToggle (tw5-vis-network, like its own properties/events.js): a node that folds
and unfolds with a single click. Used by the ego graph of a location
(graph/templates/trpg-ego): a place within it starts folded ("▸"); a click unfolds it ("▾") and
the graph adds who is there, who leads it and the rest of its neighbours; another click folds it
again.

The value of trpgToggle is the state tiddler of the graph; its field "list" holds the unfolded
nodes. tw5-vis-network passes only the double click on to the node actions (that one opens the
tiddler), so this module listens to the click of vis-network itself. A double click also fires
two clicks first: the toggle waits DELAY milliseconds and is dropped when a double click
follows, so opening the tiddler does not fold the node as well.

\*/

"use strict";

exports.name = "trpg-ego-toggle";

exports.properties = {
	nodes: {
		trpgToggle: {type: "string"}
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
	self.trpgToggles = self.trpgToggles || {};
	var cancel = function() {
		if(self.trpgToggleTimer) {
			clearTimeout(self.trpgToggleTimer);
			self.trpgToggleTimer = null;
		}
	};
	visNetwork.on("click",function(params) {
		var id = params && params.nodes && params.nodes.length === 1 ? params.nodes[0] : null,
			state = id !== null ? self.trpgToggles[id] : null;
		cancel();
		if(state) {
			self.trpgToggleTimer = setTimeout(function() {
				self.trpgToggleTimer = null;
				toggle($tw.wiki,state,id);
			},DELAY);
		}
	});
	visNetwork.on("doubleClick",cancel);
};

exports.process = function(objects,changes) {
	if(changes.nodes) {
		this.trpgToggles = this.trpgToggles || {};
		for(var id in changes.nodes) {
			var node = changes.nodes[id];
			if(!node) {
				delete this.trpgToggles[id];
			} else if(node.trpgToggle !== undefined) {
				if(node.trpgToggle) {
					this.trpgToggles[id] = node.trpgToggle;
				} else {
					delete this.trpgToggles[id];
				}
				node.trpgToggle = undefined;
			}
		}
	}
};

exports.destroy = function() {
	if(this.trpgToggleTimer) {
		clearTimeout(this.trpgToggleTimer);
		this.trpgToggleTimer = null;
	}
};
