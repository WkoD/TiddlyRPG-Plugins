/*\
title: $:/plugins/tiddlyrpg-core/checks/events.js
type: application/javascript
module-type: trpg-check
created: 20261015194724000
modified: 20261015194724000

Checks of events (modules/checks.js runs them). The dates of an event: checks/dates.js.

  events/participants   hint: the text links a player character (tag Player or field player)
                        that is not tagged - a tag means it took part, and only then the event
                        counts for the campaign; only links in sections the view sees, to
                        characters it sees

\*/

"use strict";

var sections = require("$:/plugins/tiddlyrpg-core/modules/sections.js"),
	visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js");

exports.rules = [
	{
		id: "events/participants",
		run: function(wiki,title,view) {
			var tiddler = wiki.getTiddler(title);
			if(!tiddler || !tiddler.hasTag("Event")) {
				return [];
			}
			var seen = Object.create(null),
				messages = [];
			$tw.utils.each(sections.read(wiki,title).links,function(link) {
				var name = link.to;
				if(seen[name] || tiddler.hasTag(name) || !visibility.isCharacter(wiki,name) || !visibility.visible(wiki,name,view) ||
					!sections.visible(wiki,title,link.section,view)) {
					return;
				}
				seen[name] = true;
				messages.push({level: "hint", key: "Check/Events/Participant", params: {name: name}});
			});
			return messages;
		}
	}
];
