/*\
title: $:/plugins/tiddlyrpg-core/checks/categories.js
type: application/javascript
module-type: trpg-check
created: 20261024152302984
modified: 20261024152302984

The rule of the categories (modules/categories.js; modules/checks.js runs it): a category stands
next to one of its base types, never alone.

  categories/base   error: a category without a base type of it (Book without Artifact, Item or
                    Material; Folk without Information). With one base type the fix sets its
                    tag. Not for the hubs (tag Index)

\*/

"use strict";

var categories = require("$:/plugins/tiddlyrpg-core/modules/categories.js"),
	language = require("$:/plugins/tiddlyrpg-core/modules/language.js"),
	types = require("$:/plugins/tiddlyrpg-core/modules/types.js");

exports.rules = [
	{
		id: "categories/base",
		run: function(wiki,title) {
			var tiddler = wiki.getTiddler(title);
			if(!tiddler || tiddler.hasTag("Index")) {
				return [];
			}
			var own = types.of(wiki,title),
				messages = [];
			own.forEach(function(category) {
				var bases = categories.basesOf(wiki,category);
				if(!bases.length || bases.some(function(base) { return own.indexOf(base) !== -1; })) {
					return;
				}
				var message = {level: "error", key: "Check/Categories/NoBase", params: {
					category: language.title(wiki,category),
					bases: bases.map(function(base) { return language.title(wiki,base); }).join(", ")
				}};
				if(bases.length === 1) {
					message.fix = {kind: "tag", tag: bases[0]};
				}
				messages.push(message);
			});
			return messages;
		}
	}
];
