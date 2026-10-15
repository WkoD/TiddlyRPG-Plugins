/*\
title: $:/plugins/tiddlyrpg-core/widgets/sections.js
type: application/javascript
module-type: widget
created: 20261007170000000
modified: 20261015122743000

Rendering of the sections of a body (modules/sections.js).

<$trpg-body $tiddler="Title" $mode="block"/>
  the transclude widget, with the parse tree prepared by sections.transform(): every short
  section in a widget trpg-section. $only="spot" renders only the sections of that kind, $omit
  leaves them out, $name="Spot" only the spot of that (plain) name, $marker="no" without the
  marker (the heading of a spot). Sets the variable trpg-sections-of to the tiddler.

<$trpg-section key="..." kind="date">...</$trpg-section>
  made by sections.transform(), not written by hand: one short section.

<$trpg-body $tiddler="Event" $quest="123"/>
  only what the quest marker at position 123 holds (the history of a quest, modules/quests.js)

<$trpg-nest key="..." kind="quest">...</$trpg-nest>
  made by sections.transform(), not written by hand: what a marker of a kind with nest holds - a
  block around its paragraph, a span around the rest of a paragraph.

<$date section="3" label="Caption">...</$date>      block form of a dated section
<$spot name="Name" tiddler="Tiddler" image="a.jpg" map="b.jpg">...</$spot>    block form of a spot
<$secret for="Theren Actia">...</$secret>     locks what it encloses
<$quest name="Name" status="complete">...</$quest>    block form of a quest marker; inside a
  paragraph or a list item it is a span

A section the active view does not see renders nothing. Every section is a div with the classes
trpg-section trpg-section-<kind> (trpg-section-locked with a lock of its own; a quest also
trpg-quest-real or trpg-quest-rumour) - the base for the
styling of its kind; a locked one starts with a marker for whom it is ("Secret: Theren"). The
blocks draw the heading of their kind through the procedures date and spot (functions.tid), so
both forms look the same; the heading of a block carries the position of the block, so the
dated section finds its number (widgets/date.js).

Outside the body of their tiddler (a transclusion into another tiddler) the sections have no
model: they render as they are, a block secret decides by its own attribute for.

\*/

"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget,
	TranscludeWidget = require("$:/core/modules/widgets/transclude.js").transclude,
	sections = require("$:/plugins/tiddlyrpg-core/modules/sections.js"),
	visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js"),
	language = require("$:/plugins/tiddlyrpg-core/modules/language.js");

/* ---------- trpg-body ---------- */

var BodyWidget = function(parseTreeNode,options) {
	this.initialise(parseTreeNode,options);
};

BodyWidget.prototype = Object.create(TranscludeWidget.prototype);
BodyWidget.prototype.constructor = BodyWidget;

BodyWidget.prototype.execute = function() {
	this.setVariable("trpg-sections-of",this.getAttribute("$tiddler",this.getVariable("currentTiddler")));
	TranscludeWidget.prototype.execute.call(this);
};

BodyWidget.prototype.parseTransclusionTarget = function(parseAsInline) {
	var target = TranscludeWidget.prototype.parseTransclusionTarget.call(this,parseAsInline),
		name = this.getAttribute("$name",""),
		options = {
			root: true,
			only: this.getAttribute("$only",""),
			omit: this.getAttribute("$omit",""),
			nomarker: this.getAttribute("$marker","yes") === "no",
			nest: this.getAttribute("$quest","")
		};
	if(name) {
		var wanted = sections.plain(name);
		options.match = function(record) {
			return record.kind === "spot" && record.params.plain === wanted;
		};
	}
	if(target.parser && target.parseTreeNodes) {
		target.parseTreeNodes = sections.transform(this.wiki,this.transcludeTitle,target.parseTreeNodes,options);
	}
	return target;
};

BodyWidget.prototype.refresh = function(changedTiddlers) {
	var changedAttributes = this.computeAttributes();
	if(changedAttributes.$only || changedAttributes.$omit || changedAttributes.$name || changedAttributes.$marker || changedAttributes.$quest) {
		this.refreshSelf();
		return true;
	}
	return TranscludeWidget.prototype.refresh.call(this,changedTiddlers);
};

/* ---------- Shared by trpg-section and the blocks ---------- */

function textNode(text) {
	return {type: "text", text: text};
}

// The marker of a locked section: padlock and for whom
function markerNode(wiki,names) {
	var label = names.length ? language.format(language.t(wiki,"Secret/For"),{names: names.join(", ")}) : language.t(wiki,"Secret/DMOnly");
	return {
		type: "element",
		tag: "div",
		attributes: {"class": {type: "string", value: "trpg-secret-marker"}},
		children: [{type: "transclude", attributes: {"$tiddler": {type: "string", value: "$:/core/images/locked-padlock"}}}, textNode(label)]
	};
}

function render(parent,nextSibling) {
	/*jshint validthis: true */
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	if(!this.shown) {
		return;
	}
	var div = this.document.createElement(this.inline ? "span" : "div");
	div.className = this.className;
	parent.insertBefore(div,nextSibling);
	this.domNodes.push(div);
	this.renderChildren(div,null);
}

// Sets shown, className, the titles to watch and the child widgets for a section of <kind>
// (record may be null)
function setup(widget,record,kind,children,shown) {
	var wiki = widget.wiki,
		def = sections.kind(kind),
		lock = record ? sections.lockOf(wiki,widget.title,record.id) : null;
	widget.shown = record ? sections.visible(wiki,widget.title,record.id) : (shown === undefined ? true : shown);
	widget.className = "trpg-section trpg-section-" + kind + (lock ? " trpg-section-locked" : "") +
		(record && def && def.classes ? " " + def.classes(wiki,record) : "");
	widget.watch = record && def && def.watch ? def.watch(record) : [];
	widget.makeChildWidgets(widget.shown ? (lock ? [markerNode(wiki,lock)] : []).concat(children) : []);
}

function refresh(changedTiddlers) {
	/*jshint validthis: true */
	var changedAttributes = this.computeAttributes();
	if(Object.keys(changedAttributes).length || changedTiddlers[this.title] || changedTiddlers["$:/language"] ||
		(this.watch || []).some(function(title) { return changedTiddlers[title]; }) ||
		visibility.watched.some(function(title) { return changedTiddlers[title]; })) {
		this.refreshSelf();
		return true;
	}
	return this.refreshChildren(changedTiddlers);
}

function modelTitle(widget) {
	return widget.getVariable("trpg-sections-of") || widget.getVariable("currentTiddler");
}

/* ---------- trpg-section ---------- */

var SectionWidget = function(parseTreeNode,options) {
	this.initialise(parseTreeNode,options);
};

SectionWidget.prototype = new Widget();
SectionWidget.prototype.render = render;
SectionWidget.prototype.refresh = refresh;

SectionWidget.prototype.execute = function() {
	this.title = modelTitle(this);
	var record = sections.byKey(this.wiki,this.title,this.getAttribute("key",""));
	setup(this,record,this.getAttribute("kind","section"),this.parseTreeNode.children || []);
};

/* ---------- trpg-nest ---------- */

var NestWidget = function(parseTreeNode,options) {
	this.initialise(parseTreeNode,options);
};

NestWidget.prototype = new Widget();
NestWidget.prototype.render = render;
NestWidget.prototype.refresh = refresh;

NestWidget.prototype.execute = function() {
	this.title = modelTitle(this);
	this.inline = !this.parseTreeNode.isBlock;
	var kind = this.getAttribute("kind","quest"),
		record = sections.byKey(this.wiki,this.title,this.getAttribute("key",""));
	setup(this,record && record.kind === kind ? record : null,kind,this.parseTreeNode.children || []);
};

/* ---------- Blocks ---------- */

// The attributes of a block passed on to the procedure of its heading
var HEADINGS = {
	date: ["section","label"],
	spot: ["name","tiddler","image","map"],
	quest: ["name","status"]
};

function makeBlock(kind) {
	var BlockWidget = function(parseTreeNode,options) {
		this.initialise(parseTreeNode,options);
	};
	BlockWidget.prototype = new Widget();
	BlockWidget.prototype.render = render;
	BlockWidget.prototype.refresh = refresh;
	BlockWidget.prototype.execute = function() {
		var node = this.parseTreeNode,
			wiki = this.wiki;
		this.title = modelTitle(this);
		// A block of a kind with nest (a quest) inside a paragraph or a list item is a span
		this.inline = !!(sections.kind(kind) && sections.kind(kind).nest && !node.isBlock);
		var record = node.start !== undefined ? sections.byKey(wiki,this.title,node.start.toString()) : null;
		if(record && record.kind !== kind) {
			record = null;
		}
		var children = record ? sections.wrapInline(sections.transform(wiki,this.title,node.children || [],{})) : (node.children || []);
		if(HEADINGS[kind]) {
			var heading = {type: "transclude", attributes: {"$variable": {type: "string", value: kind}}, isBlock: !this.inline, start: node.start, end: node.end};
			$tw.utils.each(HEADINGS[kind],function(name) {
				if(node.attributes && node.attributes[name]) {
					heading.attributes[name] = node.attributes[name];
				}
			});
			children = [heading].concat(children);
		}
		var shown;
		if(!record && kind === "secret") {
			var names = ($tw.utils.parseStringArray(this.getAttribute("for","")) || []).filter(function(name) {
				return visibility.isCharacter(wiki,name);
			});
			shown = visibility.allows(wiki,names);
		}
		setup(this,record,kind,children,shown);
	};
	return BlockWidget;
}

exports["trpg-body"] = BodyWidget;
exports["trpg-section"] = SectionWidget;
exports["trpg-nest"] = NestWidget;
exports.date = makeBlock("date");
exports.spot = makeBlock("spot");
exports.secret = makeBlock("secret");
exports.quest = makeBlock("quest");
