/*\
title: $:/plugins/tiddlyrpg-core/modules/types.js
type: application/javascript
module-type: library
created: 20261015194805000
modified: 20261022165822902

The type tags: a tiddler tagged with one of them has a type. They are the hubs (tag Index: Person,
Location, Organisation, Event, Quest, the item categories, ...) and the item categories of the
campaign (tag $:/tags/tiddlyrpg/ItemKind); the hub Index itself is none, nor is Campaign (the
pinned start page, not tagged Index). Secret is no type: it locks, it does not tell what a
tiddler is. Used by checks/types.js.

UNTYPED: pages of the plugin that are no type and need none - checks/types.js leaves them out:
Campaign, the pinned start page.

  list(wiki)          the type tags, sorted (global cache)
  typed(wiki,title)   whether <title> has a type tag
  isType(wiki,title)  whether <title> is a type tag
  of(wiki,title)      the type tags of a tiddler, also typed under a translated name (a draft
                      not saved yet); the preview of a content entry: its trpg-type

\*/

"use strict";

var language = require("$:/plugins/tiddlyrpg-core/modules/language.js");

exports.UNTYPED = ["Campaign"];

var list = exports.list = function(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-type-tags",function() {
		return wiki.filterTiddlers("[all[shadows+tiddlers]tag[Index]] [all[shadows+tiddlers]tag[$:/tags/tiddlyrpg/ItemKind]] -[[Index]] +[sort[]]");
	});
};

exports.isType = function(wiki,title) {
	return list(wiki).indexOf(title) !== -1;
};

exports.typed = function(wiki,title) {
	var tiddler = wiki.getTiddler(title),
		types = list(wiki);
	return !!tiddler && (tiddler.fields.tags || []).some(function(tag) {
		return types.indexOf(tag) !== -1;
	});
};

exports.of = function(wiki,title) {
	var tiddler = wiki.getTiddler(title),
		all = list(wiki),
		out = [];
	// The preview of an entry of a content package has the type of the entry, without its tag
	// (no hub lists it)
	if(tiddler && tiddler.fields["trpg-preview"] && all.indexOf(tiddler.fields["trpg-type"]) !== -1) {
		return [tiddler.fields["trpg-type"]];
	}
	$tw.utils.each(tiddler ? tiddler.fields.tags || [] : [],function(tag) {
		var name = language.internalTitle(wiki,tag);
		if(all.indexOf(name) !== -1 && out.indexOf(name) === -1) {
			out.push(name);
		}
	});
	return out;
};
