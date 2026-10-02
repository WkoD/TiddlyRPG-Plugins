/*\
title: $:/plugins/dndwiki-core/filters/eventrows.js
type: application/javascript
module-type: filteroperator
created: 20200311094442101
modified: 20261002110000000

Filter operator for the event table: one table row per section of the date field (split by
modules/dates.js, the same rules as the timeline). A point in time is a row of its own, a span
one row: its start in the date columns, "until <end>" next to the title. Sorted by the start
(by the end if the start is unknown), rows of the same year/month/day share their cells.

  [subfilter<events>eventrows[]]   newest first; with "!" prefix oldest first

Events with several sections are marked start/continued/end; an open last section counts as
continued. A caption of the section (<<date "Caption">>) follows the title. Consecutive rows of
the same event (no other event in between, no caption, no span) share one title cell.

\*/

"use strict";

var calendar = require("$:/plugins/dndwiki-core/modules/calendar.js"),
	dates = require("$:/plugins/dndwiki-core/modules/dates.js"),
	language = require("$:/plugins/dndwiki-core/modules/language.js");

// Internal flag values; the text is only translated on output
var FLAG_KEYS = {start: "Event/Start", end: "Event/End", cont: "Event/Continued"};

var UNDATED = "????";

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
			count = parsed.sections.length,
			added = false;
		$tw.utils.each(parsed.sections,function(section,i) {
			var start = typeof section.start === "object" ? section.start : null,
				end = typeof section.end === "object" ? section.end : null,
				anchor = start || end;
			if(!anchor) {
				return;
			}
			var row = {title: title, campaign: campaign, point: anchor, section: i + 1, label: labels[i + 1] || ""};
			if(section.range) {
				// Start in the date columns, the rest next to the title
				row.note = start ? language.format(language.t(wiki,"Event/Until"),{date: end ? dates.formatRange(wiki,cal,end,end) : (section.end === dates.UNKNOWN ? dates.UNKNOWN_TEXT : language.t(wiki,"Date/Open"))}) :
					dates.formatSection(wiki,cal,section);
			}
			if(count > 1) {
				row.flag = i === 0 ? "start" : (i === count - 1 && !(section.range && section.end === dates.FOREVER) ? "end" : "cont");
			}
			rows.push(row);
			added = true;
		});
		if(!added) {
			rows.push({title: title, campaign: campaign, point: null, section: 0, label: ""});
		}
	});
	if(rows.length === 0) {
		return [];
	}
	rows.sort(function(a,b) {
		if(!a.point || !b.point) {
			return (a.point ? 1 : 0) - (b.point ? 1 : 0) || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0);
		}
		return dates.comparePoints(a.point,b.point) || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0) || (a.section - b.section);
	});
	if(operator.prefix !== "!") {
		rows.reverse();
	}
	// Cells: year, month and day through the calendar, or as entered without one
	$tw.utils.each(rows,function(row) {
		var p = row.point;
		row.year = p ? p.year.toString() : UNDATED;
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
	/*
	Title cells: consecutive rows of the same event (no other event in between) share one cell,
	as long as none of them has a caption or a span of its own. The flags of such a group
	combine like the first and last row in time: start...end shows none, start...continued
	"start", continued...end "end", continued...continued "continued".
	*/
	var plain = function(row) {
		return row.point && !row.label && !row.note;
	};
	var titleSpan = function(i) {
		if(!plain(rows[i]) || (i > 0 && rows[i - 1].title === rows[i].title && plain(rows[i - 1]))) {
			return plain(rows[i]) ? 0 : 1;
		}
		var n = 1;
		while(i + n < rows.length && rows[i + n].title === rows[i].title && plain(rows[i + n])) {
			n++;
		}
		return n;
	};
	var groupFlag = function(i,n) {
		if(n === 1) {
			return rows[i].flag;
		}
		var group = rows.slice(i,i + n),
			first = group[0],
			last = group[n - 1];
		// rows are newest first unless the "!" prefix is given
		if(operator.prefix !== "!") {
			first = group[n - 1];
			last = group[0];
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
			var flag = groupFlag(i,n);
			line += "<td rowspan=\"" + n + "\">" + (row.campaign ? "__[[" + row.title + "]]__" : "[[" + row.title + "]]");
			if(row.label) {
				line += " – " + row.label;
			}
			if(row.note) {
				line += " //" + row.note + "//";
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
