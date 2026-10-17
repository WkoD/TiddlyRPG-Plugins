/*\
title: $:/plugins/tiddlyrpg-core/checks/dates.js
type: application/javascript
module-type: trpg-check
created: 20261015193638000
modified: 20261017163544851

Checks of the field date and of the dated sections of an event (modules/dates.js;
modules/checks.js runs them).

  dates/format        error: a part that cannot be read, a month or day the calendar does not
                      have, start after end, sections out of order
  dates/field         hint: an empty side or section
  dates/phases        hint: a phase of a non-event without an end before a later one; ".." as
                      start of a non-event (since time immemorial)
  dates/event         hint: an event without date, without <<date>> at the start, sections
                      without heading, text before the first <<date>>
  dates/placeholders  error: <<date n>> beyond the sections of the field; hint: two <<date>> for
                      one section, "---" right before <<date>> (it draws its own rule)

\*/

"use strict";

var dates = require("$:/plugins/tiddlyrpg-core/modules/dates.js"),
	calendar = require("$:/plugins/tiddlyrpg-core/modules/calendar.js");

function tiddlerOf(wiki,title) {
	return wiki.getTiddler(title);
}

function field(tiddler) {
	return tiddler && tiddler.fields.date !== undefined ? tiddler.fields.date : null;
}

function as(level,problems) {
	return problems.map(function(problem) {
		return {level: level, key: problem.key, params: problem.params || {}};
	});
}

exports.rules = [
	{
		id: "dates/format",
		run: function(wiki,title) {
			var date = field(tiddlerOf(wiki,title));
			return date === null ? [] : as("error",dates.check(calendar.active(wiki),dates.parse(date)));
		}
	},
	{
		id: "dates/field",
		run: function(wiki,title) {
			var date = field(tiddlerOf(wiki,title));
			return date === null ? [] : as("hint",dates.parse(date).warnings);
		}
	},
	{
		id: "dates/phases",
		run: function(wiki,title) {
			var tiddler = tiddlerOf(wiki,title),
				date = field(tiddler);
			if(date === null || tiddler.hasTag("Event")) {
				return [];
			}
			var parsed = dates.parse(date),
				messages = dates.openPhases(parsed).map(function(section) {
					return {level: "hint", key: "Check/Dates/OpenPhase", params: {section: section.text}};
				});
			if(parsed.sections.length && parsed.sections[0].start === dates.FOREVER) {
				messages.push({level: "hint", key: "Check/Dates/Forever"});
			}
			return messages;
		}
	},
	{
		id: "dates/event",
		run: function(wiki,title) {
			var tiddler = tiddlerOf(wiki,title);
			if(!tiddler || !tiddler.hasTag("Event")) {
				return [];
			}
			var date = tiddler.fields.date || "",
				messages = [];
			if(!date.trim()) {
				messages.push({level: "hint", key: "Check/Dates/NoDate", missing: "date"});
			}
			var info = dates.sections(wiki,title),
				count = dates.parse(date).sections.length;
			if(!info.placeholders.length) {
				messages.push({level: "hint", key: "Check/Dates/NoPlaceholder"});
			} else if(count > 0) {
				var seen = {},
					missing = [];
				$tw.utils.each(info.placeholders,function(p) {
					seen[p.number] = true;
				});
				for(var n = 1; n <= count; n++) {
					if(!seen[n]) {
						missing.push(n);
					}
				}
				if(missing.length) {
					messages.push({level: "hint", key: "Check/Dates/NoHeading", params: {sections: missing.join(", ")}});
				}
				if(!info.placeholders[0].first) {
					messages.push({level: "hint", key: "Check/Dates/Head"});
				}
			}
			return messages;
		}
	},
	{
		id: "dates/placeholders",
		run: function(wiki,title) {
			var tiddler = tiddlerOf(wiki,title);
			if(!tiddler || !tiddler.hasTag("Event")) {
				return [];
			}
			var text = tiddler.fields.text || "",
				count = dates.parse(tiddler.fields.date || "").sections.length,
				seen = {},
				messages = [];
			$tw.utils.each(dates.sections(wiki,title).placeholders,function(p) {
				if(count > 0 && p.number > count) {
					messages.push({level: "error", key: "Check/Dates/Beyond", params: {n: p.number, count: count}});
				}
				if(seen[p.number]) {
					messages.push({level: "hint", key: "Check/Dates/Twice", params: {n: p.number}});
				}
				seen[p.number] = true;
				if(/(^|\n)---[ \t]*\n\s*$/.test(text.slice(0,p.start))) {
					messages.push({level: "hint", key: "Check/Dates/Rule", params: {n: p.number}});
				}
			});
			return messages;
		}
	}
];
