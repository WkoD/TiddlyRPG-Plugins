/*\
title: $:/plugins/tiddlyrpg-core/widgets/jump.js
type: application/javascript
module-type: widget
created: 20261004170125000
modified: 20261006064449000

Wrapper around ordinary links: a click on a link inside opens the tiddler as always and then
jumps to the mark <anchor> in it (modules/anchor-jump.js).

<$trpg-jump anchor="date-2">[[Der dunkle Turm]]</$trpg-jump>

A mark inside a tab only exists while that tab is active: tabstate and tab name the state
tiddler of the tab set and the tab to select before the navigation, e.g. the map of a location
(viewtemplates/location):

<$trpg-jump anchor="spot-schloss-baile" tabstate="$:/state/tiddlyrpg-core/location-tab/Baile" tab="map">...</$trpg-jump>

The widget draws nothing of its own. It sees the tm-navigate of the links inside on its way to
the navigator, passes it on unchanged and starts the jump to the target of that navigation. So
the links stay ordinary links (style, drag, backlinks). Without an anchor, or with Ctrl/Cmd or
the middle button (open in the background), it is a plain container.

\*/

"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget,
	anchorJump = require("$:/plugins/tiddlyrpg-core/modules/anchor-jump.js");

var JumpWidget = function(parseTreeNode,options) {
	this.initialise(parseTreeNode,options);
	this.addEventListeners([
		{type: "tm-navigate", handler: "handleNavigateEvent"}
	]);
};

JumpWidget.prototype = new Widget();

JumpWidget.prototype.render = function(parent,nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	this.renderChildren(parent,nextSibling);
};

JumpWidget.prototype.execute = function() {
	this.anchor = this.getAttribute("anchor","").trim();
	this.tabState = this.getAttribute("tabstate","");
	this.tab = this.getAttribute("tab","");
	this.makeChildWidgets();
};

JumpWidget.prototype.handleNavigateEvent = function(event) {
	if(this.anchor && event.navigateTo && !event.navigateSuppressNavigation) {
		if(this.tabState && this.tab) {
			this.wiki.setText(this.tabState,"text",null,this.tab);
		}
		anchorJump.jump(this,event.navigateTo,this.anchor);
	}
	return true;
};

JumpWidget.prototype.refresh = function(changedTiddlers) {
	var changedAttributes = this.computeAttributes();
	if(changedAttributes.anchor || changedAttributes.tabstate || changedAttributes.tab) {
		this.anchor = this.getAttribute("anchor","").trim();
		this.tabState = this.getAttribute("tabstate","");
		this.tab = this.getAttribute("tab","");
	}
	return this.refreshChildren(changedTiddlers);
};

exports["trpg-jump"] = JumpWidget;
