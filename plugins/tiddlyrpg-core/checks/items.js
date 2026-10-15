/*\
title: $:/plugins/tiddlyrpg-core/checks/items.js
type: application/javascript
module-type: trpg-check
created: 20261006154328000
modified: 20261015191942000

The item rules - the one place of them (modules/checks.js runs them). An item has one base type
and any number of categories:

  base type   Artifact (unique), Item (several of it exist), Material (raw material, ingredient)
  category    a hub tagged $:/tags/tiddlyrpg/ItemKind (Book, Consumable, Equipment, or one of the
              campaign); never alone, always next to a base type

A unique item (Artifact) has one owner or one location, never both (checks/locations.js); Item
and Material may have several of each.

  items/base    error: a category without base type, two base types
  items/price   error: the price (field price) against the active currency (modules/currency.js
                check()): with a currency it needs a unit the currency has; without one it is a
                plain number

\*/

"use strict";

var currency = require("$:/plugins/tiddlyrpg-core/modules/currency.js");

var BASES = ["Artifact","Item","Material"];

var KIND_TAG = "$:/tags/tiddlyrpg/ItemKind";

function isKind(wiki,title) {
	var tiddler = wiki.getTiddler(title);
	return !!tiddler && tiddler.hasTag(KIND_TAG);
}

function item(wiki,title) {
	var tiddler = wiki.getTiddler(title);
	return tiddler && !tiddler.hasTag("Index") ? tiddler : null;
}

exports.rules = [
	{
		id: "items/base",
		run: function(wiki,title) {
			var t = item(wiki,title);
			if(!t) {
				return [];
			}
			var tags = t.fields.tags || [],
				bases = BASES.filter(function(base) { return tags.indexOf(base) !== -1; }),
				kinds = tags.filter(function(tag) { return isKind(wiki,tag); }),
				messages = [];
			if(kinds.length && !bases.length) {
				messages.push({level: "error", key: "Item/Check/NoBase"});
			}
			if(bases.length > 1) {
				messages.push({level: "error", key: "Item/Check/TwoBases"});
			}
			return messages;
		}
	},
	{
		id: "items/price",
		run: function(wiki,title) {
			var t = item(wiki,title),
				key = t && t.fields.price && currency.check(wiki,currency.active(wiki),t.fields.price);
			return key ? [{level: "error", key: key}] : [];
		}
	}
];
