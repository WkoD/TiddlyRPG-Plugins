/*\
title: $:/plugins/tiddlyrpg-core/checks/quests.js
type: application/javascript
module-type: trpg-check
created: 20261015191942000
modified: 20261015191942000

Checks of quests and rumours over the whole wiki (modules/quests.js; modules/checks.js runs
them). The problems of a single marker are those of its section (checks/sections.js).

  quests/marker   hint: a quest tiddler without any marker - it has no history
  quests/similar  hint: two names of quests or rumours that differ only a little (case, spaces
                  and punctuation aside, one letter or two swapped): likely one quest written two
                  ways - a typo in a marker makes a new rumour. At both names; a rumour has no
                  tiddler, its message shows only in scripts/check-wiki.js

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
				plain = names.map(checks.plain),
				messages = [];
			var message = function(name,other) {
				return {title: name, level: "hint", key: quests.isQuest(wiki,other) ? "Check/Quests/SimilarQuest" : "Check/Quests/SimilarRumour", params: {other: other}};
			};
			names.forEach(function(name,i) {
				for(var j = i + 1; j < names.length; j++) {
					if(Math.abs(plain[i].length - plain[j].length) <= 1 && checks.distance(plain[i],plain[j]) <= 1) {
						messages.push(message(name,names[j]),message(names[j],name));
					}
				}
			});
			return messages;
		}
	}
];
