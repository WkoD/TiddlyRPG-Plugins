/*\
title: $:/plugins/tiddlyrpg-core/checks/legacy.js
type: application/javascript
module-type: trpg-check
created: 20261015191942000
modified: 20261015191942000

Checks for what 1.x wrote and 2.0 reads no more (modules/checks.js runs them).

  legacy/link         hint: the field link - shown no more, where the images come from goes into
                      the field source
  legacy/deadfilter   error: a filter on the old dead marker search:date[.] - use trpg.dead[]
  legacy/eventdate    error: in the body of an event a datelong call or a date written with
                      <<dateformat "...">> - dates belong in the field

\*/

"use strict";

exports.rules = [
	{
		id: "legacy/link",
		run: function(wiki,title) {
			var tiddler = wiki.getTiddler(title);
			return tiddler && tiddler.fields.link !== undefined ? [{level: "hint", key: "Check/Legacy/Link"}] : [];
		}
	},
	{
		id: "legacy/deadfilter",
		run: function(wiki,title) {
			var tiddler = wiki.getTiddler(title);
			return tiddler && /search:date\[\.\]/.test(JSON.stringify(tiddler.fields)) ? [{level: "error", key: "Check/Legacy/DeadFilter"}] : [];
		}
	},
	{
		id: "legacy/eventdate",
		run: function(wiki,title) {
			var tiddler = wiki.getTiddler(title);
			if(!tiddler || !tiddler.hasTag("Event")) {
				return [];
			}
			var text = tiddler.fields.text || "",
				messages = [];
			if(/<\$macrocall\s+\$name=["']datelong|<<datelong[\s>]/.test(text)) {
				messages.push({level: "error", key: "Check/Legacy/Datelong"});
			}
			var formats = text.match(/<<dateformat\s[^>]*>>/g);
			if(formats) {
				messages.push({level: "error", key: "Check/Legacy/Dateformat", params: {calls: formats.join(" ")}});
			}
			return messages;
		}
	}
];
