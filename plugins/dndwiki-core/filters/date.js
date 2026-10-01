/*\
title: $:/plugins/dndwiki-core/filters/date.js
type: application/javascript
module-type: filteroperator
created: 20261001095424000
modified: 20261001095424000

Date filter operators on top of the calendar engine (modules/calendar.js). They are filter
operators rather than JS macros so that a filtered attribute recomputes them on every refresh:
a change of $:/language or of the calendar data shows immediately. The procedures datelong,
datecalc and datediff in functions.tid wrap them for use in wikitext.

[<date>datelong<yearonly>]   long form as wikitext ("1351 DR" plus day/month line)
[<date>datecalc<days>]       date plus/minus days, "" if invalid or no calendar
[<from>datediff<to>]         days from <from> to <to>, "" if invalid or no calendar
[calendar[id|title|era|table]]  data of the active calendar ("" without calendar)

Without an active calendar dates are shown as entered.

\*/

"use strict";

var calendar = require("$:/plugins/dndwiki-core/modules/calendar.js"),
	language = require("$:/plugins/dndwiki-core/modules/language.js"),
	library = require("$:/plugins/dndwiki-core/macros/library");

function pad2(n) {
	return n > 9 ? n.toString() : "0" + n.toString();
}

function eraSuffix(wiki,cal) {
	var era = cal ? calendar.era(wiki,cal) : "";
	return era ? " " + era : "";
}

// Port of the former datum-lang macro: periods separated by ".", parts by "-"
function longForm(wiki,cal,text,yearonly) {
	var dates = (text || "").split("."),
		dateStart = dates[0].split("-"),
		dateEnd = dates[dates.length - 1].split("-"),
		ret = "//" + (dateStart[0] || "????");
	if(dates.length > 1) {
		if(!dateEnd[0]) {
			ret += " - ????";
		} else if(dateStart[0] != dateEnd[0]) {
			ret += " - " + dateEnd[0];
		}
	}
	if(!cal) {
		// No calendar: everything after the year as entered
		if(yearonly) {
			return ret + "//";
		}
		var raw = dates.map(function(date) {
			return date || "????";
		});
		return "//" + raw.join(" - ") + "//";
	}
	ret += eraSuffix(wiki,cal) + "//<br>";
	if(!yearonly && dateStart.length > 1) {
		var dayMonth = language.t(wiki,"Date/DayMonth"),
			time = language.t(wiki,"Date/Time"),
			resultStart = calendar.monthDay(wiki,cal,dateStart[1],dateStart[2]);
		ret += "//";
		ret += resultStart[1] ? language.format(dayMonth,{day: resultStart[1], month: resultStart[0]}) : resultStart[0];
		if(dateStart[3]) {
			ret += " " + language.format(time,{time: dateStart[3]});
		}
		if(dates.length > 1) {
			var retEnd = "",
				resultEnd = calendar.monthDay(wiki,cal,dateEnd[1],dateEnd[2]);
			if(resultEnd[1] && (resultEnd[0] !== resultStart[0] || resultEnd[1] !== resultStart[1])) {
				retEnd = language.format(dayMonth,{day: resultEnd[1], month: resultEnd[0]});
			} else if(resultEnd[0] !== resultStart[0]) {
				retEnd = resultEnd[0];
			}
			if(dateEnd[3] && (retEnd || dateEnd[3] !== dateStart[3])) {
				retEnd += (retEnd ? " " : "") + language.format(time,{time: dateEnd[3]});
			}
			if(retEnd) {
				ret += " - " + retEnd;
			}
		}
		ret += "//";
	}
	return ret;
}

exports.datelong = function(source,operator,options) {
	var cal = calendar.active(options.wiki),
		yearonly = !!operator.operand && operator.operand !== "no" && operator.operand !== "false",
		results = [];
	source(function(tiddler,title) {
		results.push(longForm(options.wiki,cal,title,yearonly));
	});
	return results;
};

exports.datecalc = function(source,operator,options) {
	var cal = calendar.active(options.wiki),
		results = [];
	source(function(tiddler,title) {
		var date = library.parseDate(title);
		// Invalid date or no calendar -> empty (the calculator then shows nothing instead of "0")
		if(!cal || !date) {
			results.push("");
			return;
		}
		// Via the running day number: festivals and leap days count correctly in both directions
		var result = calendar.dateFromNumber(cal,calendar.dayNumber(cal,date.year,date.month,date.day) + (parseInt(operator.operand,10) || 0)),
			text = result.year.toString() + "-" + pad2(result.month) + "-" + pad2(result.day);
		// Keep a time or similar unchanged
		if(date.rest) {
			text += "-" + date.rest;
		}
		results.push(text);
	});
	return results;
};

exports.datediff = function(source,operator,options) {
	var cal = calendar.active(options.wiki),
		to = library.parseDate(operator.operand),
		results = [];
	source(function(tiddler,title) {
		var from = library.parseDate(title);
		if(!cal || !from || !to) {
			results.push("");
			return;
		}
		results.push((calendar.dayNumber(cal,to.year,to.month,to.day) - calendar.dayNumber(cal,from.year,from.month,from.day)).toString());
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
