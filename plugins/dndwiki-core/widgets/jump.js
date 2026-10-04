/*\
title: $:/plugins/dndwiki-core/widgets/jump.js
type: application/javascript
module-type: widget
created: 20261004170125000
modified: 20261004170125000

Wrapper around ordinary links: a click on a link inside opens the tiddler as always and then
jumps to the mark <anchor> in it (modules/anchor-jump.js).

<$dnd-jump anchor="date-2">[[Der dunkle Turm]]</$dnd-jump>

The widget draws nothing of its own. It sees the tm-navigate of the links inside on its way to
the navigator, passes it on unchanged and starts the jump to the target of that navigation. So
the links stay ordinary links (style, drag, backlinks). Without an anchor, or with Ctrl/Cmd or
the middle button (open in the background), it is a plain container.

\*/

"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget,
	anchorJump = require("$:/plugins/dndwiki-core/modules/anchor-jump.js");

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
	this.makeChildWidgets();
};

JumpWidget.prototype.handleNavigateEvent = function(event) {
	if(this.anchor && event.navigateTo && !event.navigateSuppressNavigation) {
		anchorJump.jump(this,event.navigateTo,this.anchor);
	}
	return true;
};

JumpWidget.prototype.refresh = function(changedTiddlers) {
	var changedAttributes = this.computeAttributes();
	if(changedAttributes.anchor) {
		this.anchor = this.getAttribute("anchor","").trim();
	}
	return this.refreshChildren(changedTiddlers);
};

exports["dnd-jump"] = JumpWidget;
