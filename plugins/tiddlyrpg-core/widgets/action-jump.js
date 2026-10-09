/*\
title: $:/plugins/tiddlyrpg-core/widgets/action-jump.js
type: application/javascript
module-type: widget
created: 20261006064449000
modified: 20261006064449000

Action: jump to a mark inside a tiddler (modules/anchor-jump.js) - for places that have no link
to wrap with trpg-jump, e.g. a double click on a spot in the map of a location.

<$action-trpg-jump $tiddler="Baile" $anchor="spot-schloss-baile"/>

If the tiddler already shows the mark (the map and its spot texts are in the same tab), it
scrolls there at once. Otherwise it opens the tiddler and jumps after the refresh, selecting a
tab first if $tabstate and $tab are given (as trpg-jump does).

\*/

"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget,
	anchorJump = require("$:/plugins/tiddlyrpg-core/modules/anchor-jump.js");

var ActionJumpWidget = function(parseTreeNode,options) {
	this.initialise(parseTreeNode,options);
};

ActionJumpWidget.prototype = new Widget();

ActionJumpWidget.prototype.render = function(parent,nextSibling) {
	this.computeAttributes();
	this.execute();
};

ActionJumpWidget.prototype.execute = function() {
	this.target = this.getAttribute("$tiddler",this.getVariable("currentTiddler"));
	this.anchor = this.getAttribute("$anchor","").trim();
	this.tabState = this.getAttribute("$tabstate","");
	this.tab = this.getAttribute("$tab","");
};

ActionJumpWidget.prototype.refresh = function(changedTiddlers) {
	var changedAttributes = this.computeAttributes();
	if($tw.utils.count(changedAttributes) > 0) {
		this.refreshSelf();
		return true;
	}
	return this.refreshChildren(changedTiddlers);
};

ActionJumpWidget.prototype.invokeAction = function(triggeringWidget,event) {
	if(!this.target) {
		return true;
	}
	if(this.anchor && anchorJump.now(this,this.target,this.anchor)) {
		return true;
	}
	if(this.tabState && this.tab) {
		this.wiki.setText(this.tabState,"text",null,this.tab);
	}
	this.dispatchEvent({type: "tm-navigate", navigateTo: this.target, navigateFromTitle: this.getVariable("storyTiddler")});
	if(this.anchor) {
		anchorJump.jump(this,this.target,this.anchor);
	}
	return true;
};

exports["action-trpg-jump"] = ActionJumpWidget;
