/*\
title: $:/plugins/tiddlyrpg-core/modules/quests.js
type: application/javascript
module-type: library
created: 20261015122743000
modified: 20261015122743000

Quests - the one place of these rules. A quest is a name; its markers stand in events
(<<quest "Name">>, <$quest name="Name">, modules/sections.js). A tiddler with the name tagged
Quest makes it a quest (its body is the text for the planning), without one it is a rumour.
Used by filters/quests.js.

- A marker belongs to the dated section it stands in: its date is that section of the date
  field of the event. Markers sort by the start of the section, then its end, then the event
  title, then their place in the text.
- The status of a quest is the status of its newest marker the view sees (open without one);
  a newer marker without status opens it again.
- Two quests are linked where a marker of one stands directly in a marker of the other (both
  ways alike; with three layers only the neighbours).
- What a view sees: markers in an event it sees, in a section it sees (locks, and the quest
  tiddler: a quest tagged Secret hides its markers, sections.visible). A name without a marker
  the view sees counts only through a quest tiddler it sees.

The index (global cache, recomputed after any change) is the same for every view; the
functions below filter it by the view when asked.
\*/

"use strict";

var sections = require("$:/plugins/tiddlyrpg-core/modules/sections.js"),
	dates = require("$:/plugins/tiddlyrpg-core/modules/dates.js"),
	visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js");

// The parts of the start or end of a date section as numbers, for sorting ("1351-12-03" ->
// [1351, 12, 3]); unknown sides sort first
function parts(text) {
	return (text || "").split("-").map(function(p) { return parseInt(p,10) || 0; });
}

function compareParts(a,b) {
	for(var i = 0; i < Math.max(a.length,b.length); i++) {
		var x = a[i] || 0, y = b[i] || 0;
		if(x !== y) {
			return x - y;
		}
	}
	return 0;
}

/*
The index: {marks: [{id, name, status, event, key, sectionId, start, number, firstSection, date,
parent}], names: [names of the markers]} in date order (oldest first). id: "<key>@<event>";
number: the dated section (0 for none), firstSection: it stands at the very start of the body
(no jump mark); date: its text in the date field ("" for none); parent: the name of the quest
whose marker directly encloses this one ("" for none, also for one of the same name).
*/
var index = exports.index = function(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-quests",function() {
		var marks = [];
		$tw.utils.each(wiki.getTiddlersWithTag("Event"),function(event) {
			var tiddler = wiki.getTiddler(event);
			if(!tiddler || !/<<quest|<\$quest/.test(tiddler.fields.text || "")) {
				return;
			}
			var model = sections.read(wiki,event),
				field = dates.parse(tiddler.fields.date || ""),
				dateOf = function(id) {
					for(var up = id; up !== -1; up = model.records[up].parent) {
						if(model.records[up].kind === "date" && model.records[up].counts) {
							return model.records[up];
						}
					}
					return null;
				};
			$tw.utils.each(model.records,function(record) {
				if(record.kind !== "quest" || !record.counts || !record.params.name) {
					return;
				}
				var dated = dateOf(record.id),
					number = dated ? dated.number : 0,
					section = number ? field.sections[number - 1] : null,
					up = record.parent !== -1 ? model.records[record.parent] : null;
				marks.push({
					id: record.key + "@" + event,
					name: record.params.name,
					status: record.params.status === "complete" || record.params.status === "failed" ? record.params.status : "",
					event: event,
					key: record.key,
					sectionId: record.id,
					start: record.start,
					number: number,
					// the first section at the very start of the body has no jump mark
					firstSection: !!(dated && dated.first),
					date: section ? section.text : "",
					parent: up && up.kind === "quest" && up.params.name !== record.params.name ? up.params.name : ""
				});
			});
		});
		marks.sort(function(a,b) {
			var as = a.date.split("/"), bs = b.date.split("/");
			return compareParts(parts(as[0]),parts(bs[0])) || compareParts(parts(as[1] || as[0]),parts(bs[1] || bs[0])) ||
				(a.event < b.event ? -1 : a.event > b.event ? 1 : 0) || a.start - b.start;
		});
		var names = [];
		$tw.utils.each(marks,function(mark) {
			if(names.indexOf(mark.name) === -1) {
				names.push(mark.name);
			}
		});
		return {marks: marks, names: names};
	});
};

// Whether the view sees a marker
function markVisible(wiki,mark,view) {
	return visibility.visible(wiki,mark.event,view) && sections.visible(wiki,mark.event,mark.sectionId,view);
}

// The markers of <name> the active view (or <view>) sees, newest first
var marks = exports.marks = function(wiki,name,view) {
	view = view || visibility.current(wiki);
	return index(wiki).marks.filter(function(mark) {
		return mark.name === name && markVisible(wiki,mark,view);
	}).reverse();
};

// A marker by its id, or null
exports.mark = function(wiki,id) {
	var found = null;
	$tw.utils.each(index(wiki).marks,function(mark) {
		if(mark.id === id) {
			found = mark;
		}
	});
	return found;
};

// Whether <name> has a tiddler tagged Quest (a quest, not a rumour)
var isQuest = exports.isQuest = function(wiki,name) {
	var tiddler = wiki.getTiddler(name);
	return !!tiddler && tiddler.hasTag("Quest");
};

// The names the view sees, newest marker first; quests without a marker it sees last, by title
exports.names = function(wiki,view) {
	view = view || visibility.current(wiki);
	var newest = Object.create(null),
		out = [];
	$tw.utils.each(index(wiki).marks,function(mark,i) {
		if(markVisible(wiki,mark,view)) {
			newest[mark.name] = i;
		}
	});
	Object.keys(newest).sort(function(a,b) { return newest[b] - newest[a]; }).forEach(function(name) {
		if(visibility.visible(wiki,name,view)) {
			out.push(name);
		}
	});
	wiki.getTiddlersWithTag("Quest").slice().sort().forEach(function(name) {
		if(!(name in newest) && visibility.visible(wiki,name,view) && out.indexOf(name) === -1) {
			out.push(name);
		}
	});
	return out;
};

// The status of <name>: of its newest marker the view sees, "open" without one
exports.status = function(wiki,name,view) {
	var list = marks(wiki,name,view);
	return list.length && list[0].status ? list[0].status : "open";
};

/*
Who takes part: on a quest the player characters tagged on its tiddler; on a rumour those tagged
on the events of its markers the view sees. Sorted by title.
*/
exports.players = function(wiki,name,view) {
	var found = [],
		addFrom = function(title) {
			var tiddler = wiki.getTiddler(title);
			$tw.utils.each((tiddler && tiddler.fields.tags) || [],function(tag) {
				if(visibility.isCharacter(wiki,tag) && found.indexOf(tag) === -1 && visibility.visible(wiki,tag,view)) {
					found.push(tag);
				}
			});
		};
	view = view || visibility.current(wiki);
	if(isQuest(wiki,name)) {
		addFrom(name);
	} else {
		$tw.utils.each(marks(wiki,name,view),function(mark) {
			addFrom(mark.event);
		});
	}
	return found.sort();
};

// The quests linked with <name>: a marker of one directly in a marker of the other, both seen
// by the view (a marker seen means its parents are seen too), in title order
exports.links = function(wiki,name,view) {
	view = view || visibility.current(wiki);
	var found = [];
	$tw.utils.each(index(wiki).marks,function(mark) {
		var other = mark.name === name ? mark.parent : (mark.parent === name ? mark.name : "");
		if(other && found.indexOf(other) === -1 && markVisible(wiki,mark,view) && visibility.visible(wiki,other,view)) {
			found.push(other);
		}
	});
	return found.sort();
};
