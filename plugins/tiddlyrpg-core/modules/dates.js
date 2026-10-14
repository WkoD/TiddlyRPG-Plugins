/*\
title: $:/plugins/tiddlyrpg-core/modules/dates.js
type: application/javascript
module-type: library
created: 20261002082222000
modified: 20261014162944000

The date field and the dated sections of a body - the one place of these rules. Used by the date
filters (filters/date.js), the event table (filters/eventrows.js), the timeline
(widgets/timeline.js) and the section placeholder (widgets/date.js).

Syntax of the date field (whitespace is ignored everywhere, "1351,1352" = "1351, 1352"):

  date    := section ( "," section )*
  section := point | side "/" side
  side    := point | "." | ".." | (empty)
  point   := YYYY[-MM[-DD[-time]]]

  "."   unknown: a start that is not known, or ended at an unknown time
  ".."  forever: since the beginning of time, or ongoing
  an empty side is ignored ("1351/" = "/1351" = "1351") and reported as a warning

"." or ".." as a section of its own, first or last, belongs to the whole field and not to a
section: "1351, 1352, .." goes on after 1352 (1352 itself stays a point), "..,1351" began
before; "." the same with an unknown end/start. Elsewhere it cannot be read.

A single point is a point in time for events. For every other type it is the start and the end
stays open ("1322" = born 1322, alive). A non-event whose last section is a range with an end
other than ".." has ended (dead/destroyed, trpg.dead).

The old format (tiddlyrpg-core before 2.0) separated everything by "." - isOld() recognises it;
scripts/migrate-dates.js converts it.

Dated sections of a body: <<date>> stands for the next section of the date field, <<date 3>>
for section 3 (the following ones count on from there), <<date "Caption">> or
<<date 3 "Caption">> add a caption; <$date n="3" label="Caption">...</$date> is the block form.
sections() takes them from the model of the body (modules/sections.js), together with the links
of each section; text before the first dated section is section 0. hidden() and visibleField()
leave out what the active view does not see.

\*/

"use strict";

var calendar = require("$:/plugins/tiddlyrpg-core/modules/calendar.js"),
	language = require("$:/plugins/tiddlyrpg-core/modules/language.js"),
	spots = require("$:/plugins/tiddlyrpg-core/modules/spots.js"),
	sections = require("$:/plugins/tiddlyrpg-core/modules/sections.js"),
	visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js");

var UNKNOWN = exports.UNKNOWN = "unknown",
	FOREVER = exports.FOREVER = "forever",
	// Text of an unknown date or side, as for undated events in timeline and table
	UNKNOWN_TEXT = exports.UNKNOWN_TEXT = "????";

var POINT = /^(-?\d+)(?:-(\d{1,2}))?(?:-(\d{1,2}))?(?:-(.+))?$/;

/* ---------- Parsing ---------- */

// "YYYY[-MM[-DD[-time]]]" -> {text, year, month, day, time, monthText, dayText} (month/day 0 if
// missing), or null
var parsePoint = exports.parsePoint = function(text) {
	var match = POINT.exec(text || "");
	if(!match) {
		return null;
	}
	var point = {
		text: text,
		year: parseInt(match[1],10),
		month: match[2] ? parseInt(match[2],10) : 0,
		day: match[3] ? parseInt(match[3],10) : 0,
		time: match[4] || "",
		monthText: match[2] || "",
		dayText: match[3] || ""
	};
	if((match[2] && point.month < 1) || (match[3] && point.day < 1)) {
		return null;
	}
	return point;
};

// A side of a range: a point, UNKNOWN, FOREVER, null (empty, ignored) or false (invalid)
function parseSide(text) {
	if(text === "") {
		return null;
	}
	if(text === ".") {
		return UNKNOWN;
	}
	if(text === "..") {
		return FOREVER;
	}
	return parsePoint(text) || false;
}

// {text, range, start, end}: a point has start === end; null if invalid
function parseSection(text,warnings) {
	var parts = text.split("/");
	if(parts.length === 1) {
		var point = parsePoint(text);
		return point ? {text: text, range: false, start: point, end: point} : null;
	}
	if(parts.length > 2) {
		return null;
	}
	var start = parseSide(parts[0]),
		end = parseSide(parts[1]);
	if(start === false || end === false) {
		return null;
	}
	if(start === null || end === null) {
		// One side empty: what remains must be a point
		var other = start === null ? end : start;
		if(!other || typeof other === "string") {
			return null;
		}
		warnings.push("empty side in \"" + text + "\"");
		return {text: text, range: false, start: other, end: other};
	}
	return {text: text, range: true, start: start, end: end};
}

var cache = Object.create(null),
	cacheSize = 0;

/*
Parses a date field. The result is shared between callers (cached) and must not be changed:
  text      the field as given
  sections  [{text, range, start, end}]; start/end are points, UNKNOWN or FOREVER
  valid     false if any part could not be read
  invalid   the parts that could not be read
  warnings  readable, but probably not meant that way (empty side, empty section)
  before    UNKNOWN or FOREVER if the field starts with "." or ".." (began earlier), else null
  after     UNKNOWN or FOREVER if the field ends with "." or ".." (goes on), else null
  ended     after is UNKNOWN, or (without after) the last section is a range whose end is not
            FOREVER
*/
exports.parse = function(text) {
	text = text || "";
	if(cache[text]) {
		return cache[text];
	}
	var compact = text.replace(/\s+/g,""),
		result = {text: text, sections: [], valid: true, invalid: [], warnings: [], before: null, after: null, ended: false};
	if(compact) {
		var parts = compact.split(",");
		$tw.utils.each(parts,function(part,i) {
			if(!part) {
				result.warnings.push("empty section");
				return;
			}
			// "." or ".." on its own: the whole field began earlier / goes on
			if((part === "." || part === "..") && parts.length > 1 && (i === 0 || i === parts.length - 1)) {
				result[i === 0 ? "before" : "after"] = part === "." ? UNKNOWN : FOREVER;
				return;
			}
			var section = parseSection(part,result.warnings);
			if(section) {
				result.sections.push(section);
			} else {
				result.valid = false;
				result.invalid.push(part);
			}
		});
	}
	var last = result.sections[result.sections.length - 1];
	result.ended = result.after ? result.after === UNKNOWN : (!!last && last.range && last.end !== FOREVER);
	if(cacheSize > 5000) {
		cache = Object.create(null);
		cacheSize = 0;
	}
	cache[text] = result;
	cacheSize++;
	return result;
};

// The format before 2.0: "." between the parts, no "/" and no ","
exports.isOld = function(text) {
	return /\./.test(text || "") && !/[\/,]/.test(text);
};

// Numeric order of two points (missing month/day count as 0)
var comparePoints = exports.comparePoints = function(a,b) {
	return (a.year - b.year) || (a.month - b.month) || (a.day - b.day);
};

/*
Problems of a parsed field beyond the syntax, as readable texts (English, for check-wiki.js):
months and days against the calendar (festivals and leap years included), start after end,
sections out of order. Without a calendar only the order is checked.
*/
exports.check = function(cal,parsed) {
	var problems = [];
	if(!parsed.valid) {
		problems.push("cannot read " + parsed.invalid.map(function(part) { return "\"" + part + "\""; }).join(", "));
	}
	var checkPoint = function(point) {
		if(!cal || typeof point === "string") {
			return;
		}
		if(point.month > cal.months.length) {
			problems.push(point.text + ": month " + point.month + " does not exist");
		} else if(point.day && point.day > calendar.monthLength(cal,point.year,point.month)) {
			problems.push(point.text + ": day " + point.day + " does not exist in month " + point.month + " of " + point.year);
		}
	};
	var previous = null;
	$tw.utils.each(parsed.sections,function(section) {
		checkPoint(section.start);
		if(section.range) {
			checkPoint(section.end);
			if(typeof section.start === "object" && typeof section.end === "object" && comparePoints(section.start,section.end) > 0) {
				problems.push(section.text + ": start after end");
			}
		}
		var first = typeof section.start === "object" ? section.start : (typeof section.end === "object" ? section.end : null);
		if(first && previous && comparePoints(previous,first) > 0) {
			problems.push(section.text + ": before the previous section");
		}
		if(first) {
			previous = first;
		}
	});
	return problems;
};

/* ---------- Positions on a time scale ---------- */

/*
Day numbers for the timeline and for sorting: through the active calendar, or without one 12
months of 30 days (only for positions):
  {cal, months, perYear, dn(y,m,d), monthLength(y,m)}
*/
exports.scale = function(wiki) {
	var cal = calendar.active(wiki);
	if(cal) {
		return {
			cal: cal,
			months: cal.months.length,
			perYear: cal.yearBase + (cal.every > 0 ? cal.leapExtra / cal.every : 0),
			dn: function(y,m,d) { return calendar.dayNumber(cal,y,m,d); },
			monthLength: function(y,m) { return calendar.monthLength(cal,y,m); }
		};
	}
	return {
		cal: null,
		months: 12,
		perYear: 360,
		dn: function(y,m,d) { return y * 360 + (m - 1) * 30 + d; },
		monthLength: function() { return 30; }
	};
};

// First and last day a point can mean (a year without month = the whole year): {lo, hi}
exports.dayRange = function(scale,point) {
	var m = Math.min(point.month,scale.months),
		d = m ? point.day : 0,
		lo = scale.dn(point.year,m || 1,d || 1),
		hi = d ? lo : (m ? scale.dn(point.year,m,scale.monthLength(point.year,m)) : scale.dn(point.year,scale.months,scale.monthLength(point.year,scale.months)));
	return {lo: lo, hi: hi};
};

/*
The section of a parsed field that a point in time falls into: its number (the first is 1), or
0. A section runs from the first day of its start to the last day of its end; an unknown or
open side ("." or "..") is open. "." and ".." of the whole field (before/after) belong to no
section. Of several sections the narrowest wins, on a tie the first - "1351" matches a section
on 1351-07-01, but a section that only is 1351 loses against it. skip: {<number>: true} of
sections to leave out (hidden from the view, see hidden()).
*/
exports.sectionAt = function(wiki,parsed,point,skip) {
	var scale = exports.scale(wiki),
		at = exports.dayRange(scale,point),
		best = 0,
		bestWidth = Infinity;
	$tw.utils.each(parsed.sections,function(section,i) {
		if(skip && skip[i + 1]) {
			return;
		}
		var lo = typeof section.start === "object" ? exports.dayRange(scale,section.start).lo : -Infinity,
			hi = typeof section.end === "object" ? exports.dayRange(scale,section.end).hi : Infinity,
			width = hi - lo;
		if(at.lo <= hi && at.hi >= lo && (!best || width < bestWidth)) {
			best = i + 1;
			bestWidth = width;
		}
	});
	return best;
};

/* ---------- Text ---------- */

function monthName(wiki,cal,month) {
	return calendar.monthDay(wiki,cal,month.toString(),"")[0].replace(/\s*\(\d+(\/\d+)?\)$/,"");
}

/*
Order of day and month in the long form: $:/config/tiddlyrpg/date/order "dm" ("5. Flamerule 1351")
or "md" ("Flamerule 5, 1351"); anything else follows Date/Order of the wiki language. The patterns
come from the language packs: Date/DayMonth and Date/Day for "dm", Date/MonthDay, Date/MonthDay/Day
and Date/MonthDay/Year ("$date$, $year$" after a day) for "md".
*/
var ORDER_CONFIG = exports.ORDER_CONFIG = "$:/config/tiddlyrpg/date/order";

var dateOrder = exports.dateOrder = function(wiki) {
	var order = (wiki.getTiddlerText(ORDER_CONFIG,"") || "").trim();
	if(order !== "dm" && order !== "md") {
		order = (language.t(wiki,"Date/Order") || "").trim() === "md" ? "md" : "dm";
	}
	return order;
};

// "5. Flamerule" / "Flamerule 5"
function dayAndMonth(wiki,day,month) {
	return language.format(language.t(wiki,dateOrder(wiki) === "md" ? "Date/MonthDay" : "Date/DayMonth"),{day: day, month: month});
}

// The day alone, as the start of a range within one month ("5." in "5. – 24. Flamerule") or, in
// the order "md", as its end ("24" in "Flamerule 5 – 24, 1351")
function dayAlone(wiki,day) {
	return language.format(language.t(wiki,dateOrder(wiki) === "md" ? "Date/MonthDay/Day" : "Date/Day"),{day: day});
}

// A date with its year: "5. Flamerule 1351", "Flamerule 5, 1351" (the comma only after a day)
function withYear(wiki,date,year,afterDay) {
	if(!date) {
		return year;
	}
	return afterDay && dateOrder(wiki) === "md" ? language.format(language.t(wiki,"Date/MonthDay/Year"),{date: date, year: year}) : date + " " + year;
}

/*
Parts of a point for the short form: {dayMonth, year, time}; dayMonth is "5. Flamerule", a
festival ("Midsummer"), a month ("Flamerule") or "". Without a calendar the point stays as
entered (raw).
*/
function pointParts(wiki,cal,point) {
	if(!cal) {
		return {raw: point.text};
	}
	var parts = {dayMonth: "", day: "", year: point.year.toString(), time: ""};
	if(point.month) {
		var md = calendar.monthDay(wiki,cal,point.monthText,point.day ? point.day.toString() : ""),
			month = md[0].replace(/\s*\(\d+(\/\d+)?\)$/,"");
		if(md[1]) {
			parts.day = point.day.toString();
			parts.dayMonth = dayAndMonth(wiki,parts.day,month);
		} else {
			parts.dayMonth = month;
			parts.festival = !!point.day;
		}
		parts.month = point.month;
	}
	if(point.time) {
		parts.time = language.format(language.t(wiki,"Date/Time"),{time: point.time});
	}
	return parts;
}

function join(wiki,parts,era) {
	if(parts.raw !== undefined) {
		return parts.raw;
	}
	var text = withYear(wiki,parts.dayMonth,parts.year,!!parts.day);
	if(era) {
		text += " " + era;
	}
	if(parts.time) {
		text += " " + parts.time;
	}
	return text;
}

function sideText(wiki,side,isStart) {
	if(side === UNKNOWN) {
		return UNKNOWN_TEXT;
	}
	// An open end ("..") reads like an unknown one; an open start "since time immemorial"
	return isStart ? language.t(wiki,"Date/Ever") : UNKNOWN_TEXT;
}

/*
Short form of a point or a range, shared by the event head, the dated sections, the timeline
card and the table:
  "5. Flamerule 1351", "5. – 24. Flamerule 1351", "5. Flamerule – 24. Uktar 1351",
  "1200 – 1351", "???? – 1339", "1351 – ????" (also for an open end), "time immemorial – ????"
opts: era (append the era after the last year), year (years only)
*/
var formatRange = exports.formatRange = function(wiki,cal,start,end,opts) {
	opts = opts || {};
	var era = opts.era && cal ? calendar.era(wiki,cal) : "",
		dash = " – ";
	if(opts.year) {
		var years = function(side,isStart) {
			return typeof side === "object" ? side.year.toString() : sideText(wiki,side,isStart);
		};
		var a = years(start,true),
			b = years(end,false);
		if(a === b) {
			return a + (era ? " " + era : "");
		}
		if(typeof end === "object") {
			return a + dash + b + (era ? " " + era : "");
		}
		return a + (era && typeof start === "object" ? " " + era : "") + dash + b;
	}
	if(typeof start !== "object" || typeof end !== "object") {
		// An unknown or open side: the other one in full
		var startText = typeof start === "object" ? join(wiki,pointParts(wiki,cal,start),typeof end === "object" ? "" : era) : sideText(wiki,start,true),
			endText = typeof end === "object" ? join(wiki,pointParts(wiki,cal,end),era) : sideText(wiki,end,false);
		return startText + dash + endText;
	}
	var s = pointParts(wiki,cal,start),
		e = pointParts(wiki,cal,end);
	if(start.text === end.text) {
		return join(wiki,s,era);
	}
	if(s.raw !== undefined) {
		return s.raw + dash + e.raw;
	}
	if(s.year === e.year && s.month && e.month && !s.time && !e.time) {
		// Same year: the year only once; same month with days: the month only once - before the
		// first day ("5. – 24. Flamerule 1351") or after it ("Flamerule 5 – 24, 1351")
		if(s.month === e.month && s.day && e.day) {
			if(dateOrder(wiki) === "md") {
				return s.dayMonth + dash + join(wiki,{dayMonth: dayAlone(wiki,e.day), day: e.day, year: e.year},era);
			}
			return dayAlone(wiki,s.day) + dash + join(wiki,e,era);
		}
		return s.dayMonth + dash + join(wiki,e,era);
	}
	return join(wiki,s,"") + dash + join(wiki,e,era);
};

// Short form of a section
var formatSection = exports.formatSection = function(wiki,cal,section,opts) {
	return formatRange(wiki,cal,section.start,section.end,opts);
};

/*
Short form of a whole field: one section as it is, several as the span from the start of the
first to the end of the last ("."/".." before or after taken as the start/end). "" without
sections.
*/
exports.formatField = function(wiki,cal,parsed,opts) {
	var sections = parsed.sections;
	if(sections.length === 0) {
		return "";
	}
	if(sections.length === 1 && !parsed.before && !parsed.after) {
		return formatSection(wiki,cal,sections[0],opts);
	}
	return formatRange(wiki,cal,parsed.before || sections[0].start,parsed.after || sections[sections.length - 1].end,opts);
};

/*
Long form of a single point for the calculator of the Calendar hub, as wikitext:
"//1351 DR//<br>//01. Flamerule (07) 10:00 Uhr//" (month numbers, festival with both months).
Without a calendar the point as entered.
*/
exports.formatLong = function(wiki,cal,point) {
	if(!cal) {
		return "//" + point.text + "//";
	}
	var era = calendar.era(wiki,cal),
		text = "//" + point.year + (era ? " " + era : "") + "//<br>";
	if(point.month) {
		var md = calendar.monthDay(wiki,cal,point.monthText,point.dayText);
		text += "//" + (md[1] ? dayAndMonth(wiki,md[1],md[0]) : md[0]);
		if(point.time) {
			text += " " + language.format(language.t(wiki,"Date/Time"),{time: point.time});
		}
		text += "//";
	}
	return text;
};

/* ---------- Dated sections of a body ---------- */

/*
The dated sections of a body (<<date>> and <$date>, modules/sections.js), cached per tiddler:
  placeholders  [{id, start, end, number, label, explicit, first}] in document order; number is
                resolved (counting on from the previous one over both forms, the first is 1);
                first: only whitespace or pragmas stand before it
  links         {<section number>: [{to, id}]}; section 0 is the text before the first dated
                section; links in notes of the DM are left out
  spotlinks     {<section number>: [{place, spot, text, id}]} - the <<spotlink>> calls
                (modules/spots.js), assigned to sections the same way
  labels        {<section number>: caption} of the first section of each number with one
id: the innermost section (modules/sections.js) - whether the active view sees it is decided by
sections.visible() when asked, see hidden() and visibleField().
*/
exports.sections = function(wiki,title) {
	return wiki.getCacheForTiddler(title,"tiddlyrpg-sections",function() {
		var model = sections.read(wiki,title),
			placeholders = [],
			labels = Object.create(null),
			links = Object.create(null),
			spotlinks = Object.create(null);
		var numberOf = function(id) {
			for(var up = id; up !== -1; up = model.records[up].parent) {
				var record = model.records[up];
				if(record.kind === "date" && record.counts) {
					return record.number;
				}
			}
			return 0;
		};
		$tw.utils.each(model.records,function(record) {
			if(record.kind === "date" && record.counts) {
				placeholders.push({id: record.id, start: record.start, end: record.end, number: record.number, label: record.label, explicit: record.explicit, first: record.first});
				if(record.label && !labels[record.number]) {
					labels[record.number] = record.label;
				}
			}
		});
		$tw.utils.each(model.links,function(link) {
			if(!link.frame) {
				var n = numberOf(link.section);
				(links[n] = links[n] || []).push({to: link.to, id: link.section});
			}
		});
		$tw.utils.each(model.spotlinks,function(link) {
			var n = numberOf(link.section),
				ref = spots.reference(link.spec);
			(spotlinks[n] = spotlinks[n] || []).push({place: link.place, spot: ref.spot, text: ref.text, id: link.section});
		});
		return {placeholders: placeholders, links: links, spotlinks: spotlinks, labels: labels};
	});
};

// The numbers of the dated sections of <title> the active view (or <view>) does not see:
// {<number>: true}
var hidden = exports.hidden = function(wiki,title,view) {
	var result = Object.create(null);
	view = view || visibility.current(wiki);
	$tw.utils.each(exports.sections(wiki,title).placeholders,function(p) {
		if(!sections.visible(wiki,title,p.id,view)) {
			result[p.number] = true;
		}
	});
	return result;
};

/*
The date field of <title> as the active view sees it: without the sections it does not see,
"."/".." of the whole field kept; the field unchanged if it sees them all.
*/
exports.visibleField = function(wiki,title,view) {
	var tiddler = wiki.getTiddler(title),
		field = (tiddler && tiddler.fields.date) || "",
		skip = hidden(wiki,title,view);
	if(!Object.keys(skip).length) {
		return field;
	}
	var parsed = exports.parse(field),
		side = function(value) { return value === FOREVER ? ".." : "."; },
		parts = [];
	if(parsed.before) {
		parts.push(side(parsed.before));
	}
	$tw.utils.each(parsed.sections,function(section,i) {
		if(!skip[i + 1]) {
			parts.push(section.text);
		}
	});
	if(parsed.after) {
		parts.push(side(parsed.after));
	}
	return parts.length === (parsed.before ? 1 : 0) + (parsed.after ? 1 : 0) ? "" : parts.join(", ");
};