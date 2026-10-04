/*\
title: $:/plugins/dndwiki-core/filters/eventrows.js
type: application/javascript
module-type: filteroperator
created: 20200311094442101
modified: 20261004170125000

Filter operator for the event table: one table row per point in time of the date field (split
by modules/dates.js, the same rules as the timeline) - a point is one row, a span two (its start
and its end), a side that is unknown or open none. Sorted by date, rows of the same
year/month/day share their cells.

  [subfilter<events>eventrows[]]   newest first; with "!" prefix oldest first

Consecutive rows of the same event (no other event in between) share one title cell, so an
event reads across all the years it covers - whether its dates are points or a span. Rows of
different sections only join if neither has a caption; the caption of a section
(<<date "Caption">>) follows the title. Flags: the first row of an event "start", the last
"end", the rows in between "continued"; an unknown or open start or end (also "."/".." as a
section of its own, "1351, 1352, ..") counts as continued. A joined cell combines them like its
first and last row in time (start...end shows none).

The title jumps to the earliest section of its cell (<$dnd-jump anchor="date-<n>">,
widgets/jump.js); an undated row opens the event as a whole.

\*/

"use strict";

var calendar = require("$:/plugins/dndwiki-core/modules/calendar.js"),
	dates = require("$:/plugins/dndwiki-core/modules/dates.js"),
	language = require("$:/plugins/dndwiki-core/modules/language.js");

// Internal flag values; the text is only translated on output
var FLAG_KEYS = {start: "Event/Start", end: "Event/End", cont: "Event/Continued"};

exports.eventrows = function(source,operator,options) {
	var wiki = options.wiki,
		cal = calendar.active(wiki),
		rows = [];
	source(function(tiddler,title) {
		if(!tiddler) {
			return;
		}
		var parsed = dates.parse(tiddler.fields.date),
			labels = dates.sections(wiki,title).labels,
			campaign = tiddler.hasTag("Campaign"),
			sections = parsed.sections,
			own = [];
		$tw.utils.each(sections,function(section,i) {
			var label = labels[i + 1] || "";
			if(typeof section.start === "object") {
				own.push({point: section.start, section: i + 1, label: label});
				label = "";
			}
			if(section.range && typeof section.end === "object" && !(typeof section.start === "object" && section.start.text === section.end.text)) {
				own.push({point: section.end, section: i + 1, label: label});
			}
		});
		if(own.length === 0) {
			rows.push({title: title, campaign: campaign, point: null, section: 0, label: ""});
			return;
		}
		var first = sections[0],
			last = sections[sections.length - 1],
			openStart = !!parsed.before || (first.range && typeof first.start !== "object"),
			openEnd = !!parsed.after || (last.range && typeof last.end !== "object");
		$tw.utils.each(own,function(row,k) {
			row.title = title;
			row.campaign = campaign;
			if(own.length === 1) {
				row.flag = openStart ? (openEnd ? "cont" : "end") : (openEnd ? "start" : null);
			} else if(k === 0) {
				row.flag = openStart ? "cont" : "start";
			} else if(k === own.length - 1) {
				row.flag = openEnd ? "cont" : "end";
			} else {
				row.flag = "cont";
			}
			row.order = k;
			rows.push(row);
		});
	});
	if(rows.length === 0) {
		return [];
	}
	rows.sort(function(a,b) {
		if(!a.point || !b.point) {
			return (a.point ? 1 : 0) - (b.point ? 1 : 0) || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0);
		}
		return dates.comparePoints(a.point,b.point) || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0) || (a.order - b.order);
	});
	var newestFirst = operator.prefix !== "!";
	if(newestFirst) {
		rows.reverse();
	}
	// Cells: year, month and day through the calendar, or as entered without one
	$tw.utils.each(rows,function(row) {
		var p = row.point;
		row.year = p ? p.year.toString() : dates.UNKNOWN_TEXT;
		row.month = "";
		row.day = "";
		if(p && p.month) {
			if(cal) {
				var md = calendar.monthDay(wiki,cal,p.monthText,p.dayText);
				row.month = md[0];
				row.day = md[1] || "";
			} else {
				row.month = p.monthText;
				row.day = p.dayText;
			}
		}
		row.keys = [row.year, row.year + "|" + row.month, row.year + "|" + row.month + "|" + row.day];
	});
	// Rowspan of the cell of the given level that starts at row i (0 if the row above has it)
	var span = function(i,level) {
		if(i > 0 && rows[i - 1].keys[level] === rows[i].keys[level]) {
			return 0;
		}
		var n = 1;
		while(i + n < rows.length && rows[i + n].keys[level] === rows[i].keys[level]) {
			n++;
		}
		return n;
	};
	// Two neighbouring rows share the title cell: same event, both dated, same section or no
	// caption on either
	var joins = function(a,b) {
		return a.title === b.title && a.point && b.point && (a.section === b.section || (!a.label && !b.label));
	};
	var titleSpan = function(i) {
		if(i > 0 && joins(rows[i - 1],rows[i])) {
			return 0;
		}
		var n = 1;
		while(i + n < rows.length && joins(rows[i + n - 1],rows[i + n])) {
			n++;
		}
		return n;
	};
	// Flag of a joined cell from its first and last row in time
	var groupFlag = function(group) {
		var first = newestFirst ? group[group.length - 1] : group[0],
			last = newestFirst ? group[0] : group[group.length - 1];
		if(group.length === 1) {
			return first.flag;
		}
		if(first.flag === "start") {
			return last.flag === "end" ? null : "start";
		}
		return last.flag === "end" ? "end" : first.flag;
	};
	var out = [];
	$tw.utils.each(rows,function(row,i) {
		var line = "<tr style=\"height: 1em\">",
			n;
		if((n = span(i,0))) {
			line += "<td align=\"right\" rowspan=\"" + n + "\">" + row.year + "</td>";
		}
		if((n = span(i,1))) {
			line += "<td align=\"center\" rowspan=\"" + n + "\">" + row.month + "</td>";
		}
		if((n = span(i,2))) {
			line += "<td rowspan=\"" + n + "\">" + row.day + "</td>";
		}
		if((n = titleSpan(i))) {
			var group = rows.slice(i,i + n),
				flag = groupFlag(group),
				label = group.map(function(r) { return r.label; }).filter(function(text) { return !!text; })[0],
				earliest = newestFirst ? group[group.length - 1] : group[0],
				link = row.campaign ? "__[[" + row.title + "]]__" : "[[" + row.title + "]]";
			if(earliest.section) {
				link = "<$dnd-jump anchor=\"date-" + earliest.section + "\">" + link + "</$dnd-jump>";
			}
			line += "<td rowspan=\"" + n + "\">" + link;
			if(label) {
				line += " – " + label;
			}
			if(flag) {
				line += " //" + language.t(wiki,FLAG_KEYS[flag]) + "//";
			}
			line += "</td>";
		}
		out.push(line + "</tr>");
	});
	return out;
};
