/*\
title: $:/plugins/tiddlyrpg-core/checks/expected.js
type: application/javascript
module-type: trpg-check
created: 20261015194724000
modified: 20261015194724000

Fields a tiddler of a type is better with (modules/checks.js runs them). All hints: a tiddler
is fine without them; trpg-noinfo switches one off for a tiddler that never gets it. An event
without date: checks/dates.js.

  expected/image    hint: a person, a player character or a location without image
  expected/map      hint: a location without map
  expected/player   hint: a player character (tag Player) without the field player - who plays
                    it decides what the view of that player sees

\*/

"use strict";

function missing(tiddler,field) {
	return !(tiddler.fields[field] || "").toString().trim();
}

function hint(key) {
	return [{level: "hint", key: key}];
}

exports.rules = [
	{
		id: "expected/image",
		run: function(wiki,title) {
			var tiddler = wiki.getTiddler(title);
			return tiddler && (tiddler.hasTag("Person") || tiddler.hasTag("Player") || tiddler.hasTag("Location")) && missing(tiddler,"image") ?
				hint("Check/Expected/Image") : [];
		}
	},
	{
		id: "expected/map",
		run: function(wiki,title) {
			var tiddler = wiki.getTiddler(title);
			return tiddler && tiddler.hasTag("Location") && missing(tiddler,"map") ? hint("Check/Expected/Map") : [];
		}
	},
	{
		id: "expected/player",
		run: function(wiki,title) {
			var tiddler = wiki.getTiddler(title);
			return tiddler && tiddler.hasTag("Player") && missing(tiddler,"player") ? hint("Check/Expected/Player") : [];
		}
	}
];
