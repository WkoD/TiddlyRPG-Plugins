/*\
title: $:/plugins/dndwiki-core/widgets/date.js
type: application/javascript
module-type: widget
created: 20261002082222000
modified: 20261002082222000

Works out which section of the date field a <<date>> placeholder stands for (procedure "date" in
functions.tid) and sets for its content:

  dnd-section  number of the section, "" if it cannot be determined
  dnd-label    caption
  dnd-first    "yes" if only whitespace or pragmas stand before the placeholder (no rule then)

<$dnd-date n=<<n>> label=<<label>>> ... </$dnd-date>

The placeholder is found by its position: the transclude widget of the <<date>> call carries
the parse tree node with its start offset, and modules/dates.js reads the same offsets from the
parse tree of the current tiddler (counting, captions). Without a position - e.g. a call from a
transcluded snippet - only an explicit number works (<<date 3>>).

\*/

"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget,
	dates = require("$:/plugins/dndwiki-core/modules/dates.js");

var DateWidget = function(parseTreeNode,options) {
	this.initialise(parseTreeNode,options);
};

DateWidget.prototype = new Widget();

DateWidget.prototype.render = function(parent,nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	this.renderChildren(parent,nextSibling);
};

// The parse tree node of the <<date>> call this widget renders for, or null
DateWidget.prototype.callNode = function() {
	var widget = this.parentWidget;
	while(widget) {
		var node = widget.parseTreeNode,
			variable = node && node.attributes && node.attributes["$variable"];
		if(node && node.type === "transclude" && variable && variable.value === "date") {
			return node;
		}
		widget = widget.parentWidget;
	}
	return null;
};

DateWidget.prototype.execute = function() {
	var title = this.getVariable("currentTiddler"),
		n = this.getAttribute("n","").trim(),
		label = this.getAttribute("label","").trim(),
		node = this.callNode(),
		section = "",
		first = "";
	if(n && !/^\d+$/.test(n)) {
		// <<date "Caption">>: the caption binds to the first parameter
		label = label || n;
		n = "";
	}
	if(node && node.start !== undefined) {
		$tw.utils.each(dates.sections(this.wiki,title).placeholders,function(p) {
			if(p.start === node.start && p.end === node.end) {
				section = p.number.toString();
				label = p.label;
				first = p.first ? "yes" : "";
			}
		});
	}
	if(!section && n) {
		section = parseInt(n,10).toString();
	}
	this.setVariable("dnd-section",section);
	this.setVariable("dnd-label",label);
	this.setVariable("dnd-first",first);
	this.makeChildWidgets();
};

DateWidget.prototype.refresh = function(changedTiddlers) {
	var changedAttributes = this.computeAttributes();
	if(changedAttributes.n || changedAttributes.label || changedTiddlers[this.getVariable("currentTiddler")]) {
		this.refreshSelf();
		return true;
	}
	return this.refreshChildren(changedTiddlers);
};

exports["dnd-date"] = DateWidget;
