/*\
title: $:/plugins/tiddlyrpg-core/checks/quests.js
type: application/javascript
module-type: trpg-check
created: 20261015193638000
modified: 20261015201123000

Checks of quests and rumours over the whole wiki (modules/quests.js; modules/checks.js runs
them). The problems of a single marker are those of its section (checks/sections.js).

  quests/marker   hint: a quest tiddler without any marker - it has no history
  quests/similar  hint: two names of quests or rumours that look like one written two ways
                  (checks.similar(): case, spaces and punctuation aside, or one letter or two
                  swapped in longer names) - a typo in a marker makes a new rumour. At both names;
                  a rumour has no tiddler, its message shows only in scripts/check-wiki.js

Only names the view sees (markers in sections it sees, quest tiddlers it sees).

\*/

"use strict";

var quests = require("$:/plugins/tiddlyrpg-core/modules/quests.js"),
	visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js"),
	checks = require("$:/plugins/tiddlyrpg-core/modules/checks.js");

exports.rules = [
	{
		id: "quests/marker",
		scope: "wiki",
		run: function(wiki,view) {
			var marked = quests.index(wiki).names;
			return wiki.getTiddlersWithTag("Quest").filter(function(name) {
				return marked.indexOf(name) === -1 && visibility.visible(wiki,name,view);
			}).map(function(name) {
				return {title: name, level: "hint", key: "Check/Quests/NoMarker", params: {name: name}};
			});
		}
	},
	{
		id: "quests/similar",
		scope: "wiki",
		run: function(wiki,view) {
			var names = quests.names(wiki,view).slice().sort(),
				messages = [];
			var message = function(name,other) {
				return {title: name, level: "hint", key: quests.isQuest(wiki,other) ? "Check/Quests/SimilarQuest" : "Check/Quests/SimilarRumour", params: {other: other}};
			};
			names.forEach(function(name,i) {
				for(var j = i + 1; j < names.length; j++) {
					if(checks.similar(name,names[j])) {
						messages.push(message(name,names[j]),message(names[j],name));
					}
				}
			});
			return messages;
		}
	}
];
