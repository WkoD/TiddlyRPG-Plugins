/*\
title: $:/plugins/dndwiki-core/modules/dates.js
type: application/javascript
module-type: library
created: 20261002082222000
modified: 20261002100000000

The date field and the dated sections of a body - the one place of these rules. Used by the date
filters (filters/date.js), the event table (filters/eventrows.js), the timeline
(widgets/timeline.js), the section placeholder (widgets/date.js) and the deadlink macro.

Syntax of the date field (whitespace is ignored everywhere, "1351,1352" = "1351, 1352"):

  date    := section ( "," section )*
  section := point | side "/" side
  side    := point | "." | ".." | (empty)
  point   := YYYY[-MM[-DD[-time]]]

  "."   unknown: a start that is not known, or ended at an unknown time
  ".."  forever: since the beginning of time, or ongoing
  an empty side is ignored ("1351/" = "/1351" = "1351") and reported as a warning

A single point is a point in time for events. For every other type it is the start and the end
stays open ("1322" = born 1322, alive). A non-event whose last section is a range with an end
other than ".." has ended (dead/destroyed, dnd.dead).

The old format (dndwiki-core before 2.0) separated everything by "." - isOld() recognises it;
scripts/migrate-dates.js converts it.

Dated sections of a body: <<date>> stands for the next section of the date field, <<date 3>>
for section 3 (the following ones count on from there), <<date "Caption">> or
<<date 3 "Caption">> add a caption. sections() reads them from the parse tree of the tiddler,
together with the links of each section; text before the first placeholder is section 0.

\*/

"use strict";

var calendar = require("$:/plugins/dndwiki-core/modules/calendar.js"),
	language = require("$:/plugins/dndwiki-core/modules/language.js");

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
  ended     the last section is a range whose end is not FOREVER
*/
exports.parse = function(text) {
	text = text || "";
	if(cache[text]) {
		return cache[text];
	}
	var compact = text.replace(/\s+/g,""),
		result = {text: text, sections: [], valid: true, invalid: [], warnings: [], ended: false};
	if(compact) {
		$tw.utils.each(compact.split(","),function(part) {
			if(!part) {
				result.warnings.push("empty section");
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
	result.ended = !!last && last.range && last.end !== FOREVER;
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
Problems of a parsed field beyond the syntax, as readable texts (English, for check-dates.js):
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

/* ---------- Text ---------- */

function monthName(wiki,cal,month) {
	return calendar.monthDay(wiki,cal,month.toString(),"")[0].replace(/\s*\(\d+(\/\d+)?\)$/,"");
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
			parts.dayMonth = language.format(language.t(wiki,"Date/DayMonth"),{day: parts.day, month: month});
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

function join(parts,era) {
	if(parts.raw !== undefined) {
		return parts.raw;
	}
	var text = (parts.dayMonth ? parts.dayMonth + " " : "") + parts.year;
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
	return language.t(wiki,isStart ? "Date/Ever" : "Date/Open");
}

/*
Short form of a point or a range, shared by the event head, the dated sections, the timeline
card and the table:
  "5. Flamerule 1351", "5. – 24. Flamerule 1351", "5. Flamerule – 24. Uktar 1351",
  "1200 – 1351", "???? – 1339", "1351 – open", "time immemorial – open"
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
		var startText = typeof start === "object" ? join(pointParts(wiki,cal,start),typeof end === "object" ? "" : era) : sideText(wiki,start,true),
			endText = typeof end === "object" ? join(pointParts(wiki,cal,end),era) : sideText(wiki,end,false);
		return startText + dash + endText;
	}
	var s = pointParts(wiki,cal,start),
		e = pointParts(wiki,cal,end);
	if(start.text === end.text) {
		return join(s,era);
	}
	if(s.raw !== undefined) {
		return s.raw + dash + e.raw;
	}
	if(s.year === e.year && s.month && e.month && !s.time && !e.time) {
		// Same year: the year only once; same month with days: the month only once
		if(s.month === e.month && s.day && e.day) {
			return language.format(language.t(wiki,"Date/Day"),{day: s.day}) + dash + join(e,era);
		}
		return s.dayMonth + dash + join(e,era);
	}
	return join(s,"") + dash + join(e,era);
};

// Short form of a section
var formatSection = exports.formatSection = function(wiki,cal,section,opts) {
	return formatRange(wiki,cal,section.start,section.end,opts);
};

/*
Short form of a whole field: one section as it is, several as the span from the start of the
first to the end of the last. "" without sections.
*/
exports.formatField = function(wiki,cal,parsed,opts) {
	var sections = parsed.sections;
	if(sections.length === 0) {
		return "";
	}
	if(sections.length === 1) {
		return formatSection(wiki,cal,sections[0],opts);
	}
	return formatRange(wiki,cal,sections[0].start,sections[sections.length - 1].end,opts);
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
		text += "//" + (md[1] ? language.format(language.t(wiki,"Date/DayMonth"),{day: md[1], month: md[0]}) : md[0]);
		if(point.time) {
			text += " " + language.format(language.t(wiki,"Date/Time"),{time: point.time});
		}
		text += "//";
	}
	return text;
};

/* ---------- Dated sections of a body ---------- */

function attribute(node,name) {
	var attr = node.attributes && node.attributes[name];
	return attr && attr.type === "string" ? attr.value : undefined;
}

function hasClass(node,name) {
	var cls = attribute(node,"class");
	return !!cls && (" " + cls + " ").indexOf(" " + name + " ") !== -1;
}

// Number and caption of a placeholder: <<date>>, <<date 3>>, <<date "Caption">>,
// <<date 3 "Caption">>, <<date n:3 label:"Caption">>
function placeholderParams(node) {
	var first = attribute(node,"0"),
		second = attribute(node,"1"),
		n = attribute(node,"n"),
		label = attribute(node,"label");
	if(first !== undefined) {
		if(n === undefined && /^\s*\d+\s*$/.test(first)) {
			n = first;
		} else if(label === undefined) {
			label = first;
		}
	}
	if(second !== undefined && label === undefined) {
		label = second;
	}
	return {n: n !== undefined && /^\s*\d+\s*$/.test(n) ? parseInt(n,10) : null, label: (label || "").trim()};
}

/*
The <<date>> placeholders and the links of a tiddler body, from its parse tree (cached per
tiddler):
  placeholders  [{start, end, number, label, explicit, first}] in document order; number is
                resolved (counting on from the previous one, the first is 1); first: only
                whitespace or pragmas stand before it
  links         {<section number>: [titles]}; section 0 is the text before the first placeholder
  labels        {<section number>: caption} of the first placeholder of each section with one
Placeholders in code are not counted (they are not parsed). Subtrees with the class
tc-tiddler-frame (notes of the DM, snippet "open items") are skipped.
*/
exports.sections = function(wiki,title) {
	return wiki.getCacheForTiddler(title,"dndwiki-sections",function() {
		var tiddler = wiki.getTiddler(title),
			text = (tiddler && tiddler.fields.text) || "",
			parser = tiddler ? wiki.parseTiddler(title) : null,
			placeholders = [],
			found = [];
		var walk = function(nodes,start) {
			$tw.utils.each(nodes,function(node) {
				var at = node.start !== undefined ? node.start : start;
				if(hasClass(node,"tc-tiddler-frame")) {
					return;
				}
				if(node.type === "transclude" && attribute(node,"$variable") === "date" && node.start !== undefined) {
					var params = placeholderParams(node);
					placeholders.push({start: node.start, end: node.end, n: params.n, label: params.label});
				} else if(node.type === "link") {
					var to = attribute(node,"to");
					if(to) {
						found.push({to: to, at: at});
					}
				}
				if(node.children) {
					walk(node.children,at);
				}
			});
		};
		walk(parser && parser.tree ? parser.tree : [],0);
		var number = 0,
			labels = Object.create(null),
			links = Object.create(null);
		$tw.utils.each(placeholders,function(p) {
			p.explicit = p.n !== null;
			number = p.explicit ? p.n : number + 1;
			p.number = number;
			delete p.n;
			p.first = text.substring(0,p.start).replace(/^[ \t]*\\.*$/mg,"").trim() === "";
			if(p.label && !labels[number]) {
				labels[number] = p.label;
			}
		});
		$tw.utils.each(found,function(link) {
			var k = 0;
			while(k < placeholders.length && placeholders[k].start < link.at) {
				k++;
			}
			var section = k ? placeholders[k - 1].number : 0,
				list = links[section] = links[section] || [];
			if(list.indexOf(link.to) === -1) {
				list.push(link.to);
			}
		});
		return {placeholders: placeholders, links: links, labels: labels};
	});
};
