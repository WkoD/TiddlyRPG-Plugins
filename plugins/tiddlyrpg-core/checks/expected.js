/*\
title: $:/plugins/tiddlyrpg-core/checks/expected.js
type: application/javascript
module-type: trpg-check
created: 20261015194805000
modified: 20261017163544851

Fields a tiddler of a type is better with (modules/checks.js runs them). All hints: a tiddler
is fine without them; trpg-noinfo switches one off for a tiddler that never gets it. An event
without date: checks/dates.js. A message names the field it misses (missing), so the form of the
editor shows it - not for the text, which the editor always shows.

  expected/image    hint: a person, a player character or a location without image
  expected/map      hint: a location without map
  expected/player   hint: a player character (tag Player) without the field player - who plays
                    it decides what the view of that player sees
  expected/text     hint: a tiddler without text. Not for a quest (its text is only the planning),
                    a tiddler with a file in the field data (the file is the content, e.g. a
                    book), a hub (tag Index), editor snippets or tiddlers that are no wikitext

\*/

"use strict";

function missing(tiddler,field) {
	return !(tiddler.fields[field] || "").toString().trim();
}

function hint(key,field) {
	return [{level: "hint", key: key, missing: field}];
}

exports.rules = [
	{
		id: "expected/text",
		run: function(wiki,title) {
			var tiddler = wiki.getTiddler(title),
				type = tiddler && tiddler.fields.type;
			if(!tiddler || (type && type !== "text/vnd.tiddlywiki") || tiddler.hasTag("Quest") || tiddler.hasTag("Index") ||
				tiddler.hasTag("$:/tags/TextEditor/Snippet") || !missing(tiddler,"data")) {
				return [];
			}
			return missing(tiddler,"text") ? hint("Check/Expected/Text") : [];
		}
	},
	{
		id: "expected/image",
		run: function(wiki,title) {
			var tiddler = wiki.getTiddler(title);
			return tiddler && (tiddler.hasTag("Person") || tiddler.hasTag("Player") || tiddler.hasTag("Location")) && missing(tiddler,"image") ?
				hint("Check/Expected/Image","image") : [];
		}
	},
	{
		id: "expected/map",
		run: function(wiki,title) {
			var tiddler = wiki.getTiddler(title);
			return tiddler && tiddler.hasTag("Location") && missing(tiddler,"map") ? hint("Check/Expected/Map","map") : [];
		}
	},
	{
		id: "expected/player",
		run: function(wiki,title) {
			var tiddler = wiki.getTiddler(title);
			return tiddler && tiddler.hasTag("Player") && missing(tiddler,"player") ? hint("Check/Expected/Player","player") : [];
		}
	}
];
