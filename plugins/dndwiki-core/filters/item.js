/*\
title: $:/plugins/dndwiki-core/filters/item.js
type: application/javascript
module-type: filteroperator
created: 20261006154328000
modified: 20261006154328000

The item rules - the one place of them. An item has one base type and any number of
categories:

  base type   Artifact (unique), Item (several of it exist), Material (raw material, ingredient)
  category    a hub tagged $:/tags/dndwiki/ItemKind (Book, Consumable, Equipment, or one of the
              campaign); never alone, always next to a base type

A unique item (Artifact) has one owner or one location, never both (filters/location.js,
locationcheck); Item and Material may have several of each.

[<title>itemcheck[]]            language keys of the problems of <title> (Item/Check/...)

\*/

"use strict";

var BASES = ["Artifact","Item","Material"];

var KIND_TAG = "$:/tags/dndwiki/ItemKind";

function isKind(wiki,title) {
	var tiddler = wiki.getTiddler(title);
	return !!tiddler && tiddler.hasTag(KIND_TAG);
}

exports.itemcheck = function(source,operator,options) {
	var wiki = options.wiki,
		results = [];
	source(function(tiddler,title) {
		var t = wiki.getTiddler(title);
		if(!t || t.hasTag("Index")) {
			return;
		}
		var tags = t.fields.tags || [],
			bases = BASES.filter(function(base) { return tags.indexOf(base) !== -1; }),
			kinds = tags.filter(function(tag) { return isKind(wiki,tag); });
		if(kinds.length && !bases.length) {
			results.push("Item/Check/NoBase");
		}
		if(bases.length > 1) {
			results.push("Item/Check/TwoBases");
		}
	});
	return results;
};
