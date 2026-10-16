/*\
title: $:/plugins/tiddlyrpg-core/checks/types.js
type: application/javascript
module-type: trpg-check
created: 20261015194805000
modified: 20261016184211000

Checks of the type of a tiddler (modules/types.js; modules/checks.js runs them).

  types/missing   hint: a tiddler without a type tag - it is in no hub, has no colour and no
                  image folder. Not for the hubs (tag Index), the pages that need no type
                  (modules/types.js UNTYPED: Campaign), tiddlers that are no wikitext (data,
                  images) or editor snippets

\*/

"use strict";

var types = require("$:/plugins/tiddlyrpg-core/modules/types.js");

exports.rules = [
	{
		id: "types/missing",
		run: function(wiki,title) {
			var tiddler = wiki.getTiddler(title),
				type = tiddler && tiddler.fields.type;
			if(!tiddler || (type && type !== "text/vnd.tiddlywiki") || tiddler.hasTag("Index") || tiddler.hasTag("$:/tags/TextEditor/Snippet") ||
				types.UNTYPED.indexOf(title) !== -1 ||
				types.typed(wiki,title)) {
				return [];
			}
			return [{level: "hint", key: "Check/Types/Missing"}];
		}
	}
];
