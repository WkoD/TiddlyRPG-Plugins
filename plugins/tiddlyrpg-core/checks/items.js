/*\
title: $:/plugins/tiddlyrpg-core/checks/items.js
type: application/javascript
module-type: trpg-check
created: 20261015193638000
modified: 20261025191849787

The item rules - the one place of them (modules/checks.js runs them). An item has one base type
and any number of categories:

  base type   Artifact (unique), Item (several of it exist), Material (raw material, ingredient)
  category    a category of the items (modules/categories.js: Book, Consumable, Equipment, or one
              of the campaign); never alone, always next to a base type (checks/categories.js)

A unique item (Artifact) has one owner or one location, never both (checks/locations.js); Item
and Material may have several of each.

  items/base    error: two base types
  items/price   error: the price (field price) against the active currency (modules/currency.js
                check()): with a currency it needs a unit the currency has; without one it is a
                plain number; only a price the view sees (secret-fields, modules/fields.js seen())

\*/

"use strict";

var currency = require("$:/plugins/tiddlyrpg-core/modules/currency.js"),
	fields = require("$:/plugins/tiddlyrpg-core/modules/fields.js"),
	categories = require("$:/plugins/tiddlyrpg-core/modules/categories.js");

var BASES = categories.ITEMS;

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
				bases = BASES.filter(function(base) { return tags.indexOf(base) !== -1; });
			return bases.length > 1 ? [{level: "error", key: "Item/Check/TwoBases"}] : [];
		}
	},
	{
		id: "items/price",
		run: function(wiki,title,view) {
			var price = item(wiki,title) && fields.seen(wiki,title,view).price,
				key = price && currency.check(wiki,currency.active(wiki),price);
			return key ? [{level: "error", key: key}] : [];
		}
	}
];
