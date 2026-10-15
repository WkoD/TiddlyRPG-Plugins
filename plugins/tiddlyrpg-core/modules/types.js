/*\
title: $:/plugins/tiddlyrpg-core/modules/types.js
type: application/javascript
module-type: library
created: 20261015194724000
modified: 20261015194724000

The type tags: a tiddler tagged with one of them has a type. They are the hubs (tag Index: Person,
Location, Organisation, Event, Quest, the item categories, ...) and the item categories of the
campaign (tag $:/tags/tiddlyrpg/ItemKind); the hub Index itself is none. Secret is no type: it
locks, it does not tell what a tiddler is. Used by checks/types.js.

  list(wiki)          the type tags, sorted (global cache)
  typed(wiki,title)   whether <title> has a type tag
  isType(wiki,title)  whether <title> is a type tag

\*/

"use strict";

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
