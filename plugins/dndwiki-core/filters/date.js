/*\
title: $:/plugins/dndwiki-core/filters/date.js
type: application/javascript
module-type: filteroperator
created: 20261001095424000
modified: 20261006064449000

Date filter operators on top of modules/dates.js and the calendar engine (modules/calendar.js).
They are filter operators rather than JS macros so that a filtered attribute recomputes them on
every refresh: a change of $:/language or of the calendar data shows immediately. The
procedures dateformat, dateadd, datediff and date in functions.tid wrap them for wikitext.

[<date>dateformat[]]          short form of a date field: one section as it is, several as the
                              span from the first start to the last end
[<date>dateformat[2]]         short form of section 2
  suffix flags, comma separated: era (append the era), year (years only), long (long form of
  a single point as wikitext, for the calculator of the Calendar hub)
[<date>dateadd<days>]         date plus/minus days, "" if invalid or no calendar
[<from>datediff<to>]          days from <from> to <to>, "" if invalid or no calendar
[<date>dateended[]]           the input if the field ends (last section a range with an end)
[<date>datecheck[]]           the input if it cannot be read or a date does not exist in the
                              calendar
[<title>sectionlinks[n]]      link targets in section n of the body (0 = before the first
                              <<date>>), see dates.sections()
[<title>sectionspots[n]]      the <<spotlink>> calls in section n, as JSON {"place", "spot",
                              "text"} (modules/spots.js)
[<title>datesection<date>]    number of the section of the date field of <title> that <date>
                              falls into (the start of its first section if it has several),
                              see dates.sectionAt(); nothing without a match. For a jump to
                              that section: <$dnd-jump anchor="date-<n>"> (widgets/jump.js)
[calendar[id|title|era|table]]  data of the active calendar ("" without calendar)

Without an active calendar dates are shown as entered.

\*/

"use strict";

var calendar = require("$:/plugins/dndwiki-core/modules/calendar.js"),
	dates = require("$:/plugins/dndwiki-core/modules/dates.js");

function pad2(n) {
	return n > 9 ? n.toString() : "0" + n.toString();
}

// A full date "YYYY-MM-DD[-time]" for the calculator, or null
function fullDate(text) {
	var point = dates.parsePoint((text || "").trim());
	return point && point.month && point.day ? point : null;
}

exports.dateformat = function(source,operator,options) {
	var wiki = options.wiki,
		cal = calendar.active(wiki),
		flags = (operator.suffix || "").split(","),
		opts = {era: flags.indexOf("era") !== -1, year: flags.indexOf("year") !== -1},
		long = flags.indexOf("long") !== -1,
		n = parseInt(operator.operand,10),
		results = [];
	source(function(tiddler,title) {
		if(long) {
			var point = dates.parsePoint((title || "").trim());
			results.push(point ? dates.formatLong(wiki,cal,point) : "");
			return;
		}
		var parsed = dates.parse(title);
		if(n > 0) {
			var section = parsed.sections[n - 1];
			results.push(section ? dates.formatSection(wiki,cal,section,opts) : "");
		} else {
			results.push(dates.formatField(wiki,cal,parsed,opts));
		}
	});
	return results;
};

exports.dateadd = function(source,operator,options) {
	var cal = calendar.active(options.wiki),
		results = [];
	source(function(tiddler,title) {
		var date = fullDate(title);
		// Invalid date or no calendar -> empty (the calculator then shows nothing instead of "0")
		if(!cal || !date) {
			results.push("");
			return;
		}
		// Via the running day number: festivals and leap days count correctly in both directions
		var result = calendar.dateFromNumber(cal,calendar.dayNumber(cal,date.year,date.month,date.day) + (parseInt(operator.operand,10) || 0)),
			text = result.year.toString() + "-" + pad2(result.month) + "-" + pad2(result.day);
		// Keep a time or similar unchanged
		if(date.time) {
			text += "-" + date.time;
		}
		results.push(text);
	});
	return results;
};

exports.datediff = function(source,operator,options) {
	var cal = calendar.active(options.wiki),
		to = fullDate(operator.operand),
		results = [];
	source(function(tiddler,title) {
		var from = fullDate(title);
		if(!cal || !from || !to) {
			results.push("");
			return;
		}
		results.push((calendar.dayNumber(cal,to.year,to.month,to.day) - calendar.dayNumber(cal,from.year,from.month,from.day)).toString());
	});
	return results;
};

exports.dateended = function(source,operator,options) {
	var results = [];
	source(function(tiddler,title) {
		if(dates.parse(title).ended) {
			results.push(title);
		}
	});
	return results;
};

exports.datecheck = function(source,operator,options) {
	var cal = calendar.active(options.wiki),
		results = [];
	source(function(tiddler,title) {
		if(dates.check(cal,dates.parse(title)).length) {
			results.push(title);
		}
	});
	return results;
};

exports.sectionlinks = function(source,operator,options) {
	var n = parseInt(operator.operand,10) || 0,
		results = [];
	source(function(tiddler,title) {
		var links = dates.sections(options.wiki,title).links[n];
		$tw.utils.each(links,function(link) {
			if(results.indexOf(link) === -1) {
				results.push(link);
			}
		});
	});
	return results;
};

exports.sectionspots = function(source,operator,options) {
	var n = parseInt(operator.operand,10) || 0,
		results = [];
	source(function(tiddler,title) {
		$tw.utils.each(dates.sections(options.wiki,title).spotlinks[n],function(link) {
			var json = JSON.stringify(link);
			if(results.indexOf(json) === -1) {
				results.push(json);
			}
		});
	});
	return results;
};

exports.calendar = function(source,operator,options) {
	var cal = calendar.active(options.wiki);
	if(!cal) {
		return [""];
	}
	switch(operator.operand) {
		case "id": return [cal.id];
		case "title": return [calendar.title(options.wiki,cal)];
		case "era": return [calendar.era(options.wiki,cal)];
		case "table": return [calendar.table(options.wiki,cal)];
	}
	return [""];
};

exports.datesection = function(source,operator,options) {
	var given = dates.parse(operator.operand).sections[0],
		point = given && (typeof given.start === "object" ? given.start : (typeof given.end === "object" ? given.end : null)),
		results = [];
	if(!point) {
		return results;
	}
	source(function(tiddler,title) {
		var n = tiddler ? dates.sectionAt(options.wiki,dates.parse(tiddler.fields.date),point) : 0;
		if(n) {
			results.push(n.toString());
		}
	});
	return results;
};
