/*\
title: $:/plugins/tiddlyrpg-core/modules/calendar.js
type: application/javascript
module-type: library
created: 20261001095424000
modified: 20261001095424000

Calendar engine. Knows no particular calendar: the active one is the JSON data tiddler named in
$:/config/tiddlyrpg/calendar (e.g. $:/tiddlyrpg/calendar/Harptos from tiddlyrpg-setting-forgottenrealms).
Without it, active() returns null and callers show dates as entered.

Data model:
  {
    "id": "Harptos",
    "leap": { "every": 4, "start": 0 },        // optional; leap year if (year - start) mod every == 0
    "months": [
      { "id": "Hammer", "days": 30, "festivals": [ { "id": "Midwinter" } ] },
      { "id": "Flamerule", "days": 30, "festivals": [ { "id": "Midsummer" }, { "id": "Shieldmeet", "leap": true } ] },
      ...
    ]
  }

Festival days lie between two months; in a date they count as day days+1, days+2, ... of the
preceding month (Midwinter = 1351-01-31). Leap festivals exist only in leap years and must come
after the regular festivals of their month.

Display names come from the language keys Calendar/<id>/Month/<month>, .../Epithet/<month>,
.../Festival/<festival>, .../Era and .../Name; without a key the id is shown.

\*/

"use strict";

var language = require("$:/plugins/tiddlyrpg-core/modules/language.js");

var CONFIG = "$:/config/tiddlyrpg/calendar";

// Mathematical floor division, also for negative numbers
function floorDiv(a,b) {
	return Math.floor(a / b);
}

function pad2(n) {
	return n > 9 ? n.toString() : "0" + n.toString();
}

// Validates and normalises the raw JSON; returns null for unusable data
function build(data) {
	if(!data || !$tw.utils.isArray(data.months) || data.months.length === 0) {
		return null;
	}
	var cal = {
		id: (data.id || "").toString() || "Calendar",
		every: 0,
		start: 0,
		months: [],
		yearBase: 0,
		leapExtra: 0
	};
	if(data.leap && parseInt(data.leap.every,10) > 0) {
		cal.every = parseInt(data.leap.every,10);
		cal.start = parseInt(data.leap.start,10) || 0;
	}
	for(var m = 0; m < data.months.length; m++) {
		var raw = data.months[m] || {},
			month = {
				id: (raw.id || "").toString() || pad2(m + 1),
				days: parseInt(raw.days,10),
				festivals: []
			};
		if(!(month.days > 0)) {
			return null;
		}
		cal.yearBase += month.days;
		$tw.utils.each(raw.festivals || [],function(festival) {
			var f = {
				id: (festival && festival.id || "").toString(),
				leap: !!(festival && festival.leap) && cal.every > 0
			};
			month.festivals.push(f);
			if(f.leap) {
				cal.leapExtra++;
			} else {
				cal.yearBase++;
			}
		});
		cal.months.push(month);
	}
	return cal;
}

// Active calendar or null; cached per data tiddler, rebuilt when that tiddler changes
var active = exports.active = function(wiki) {
	var title = (wiki.getTiddlerText(CONFIG,"") || "").trim();
	if(!title) {
		return null;
	}
	return wiki.getCacheForTiddler(title,"tiddlyrpg-calendar",function() {
		return build(wiki.getTiddlerData(title,null));
	});
};

var isLeap = exports.isLeap = function(cal,year) {
	return cal.every > 0 && ((year - cal.start) % cal.every + cal.every) % cal.every === 0;
};

// Leap years in [0, year) for year > 0, negated count in [year, 0) for year < 0
function leapsBefore(cal,year) {
	if(cal.every <= 0) {
		return 0;
	}
	return floorDiv(year - 1 - cal.start,cal.every) - floorDiv(-1 - cal.start,cal.every);
}

// Days of month m (1-based) in the given year, festival days included
var monthLength = exports.monthLength = function(cal,year,m) {
	var month = cal.months[m - 1],
		leap = isLeap(cal,year),
		length = month.days;
	$tw.utils.each(month.festivals,function(f) {
		if(!f.leap || leap) {
			length++;
		}
	});
	return length;
};

// Running day number since year 0 (day 0 of month 1 of year 0 = 0)
var dayNumber = exports.dayNumber = function(cal,year,month,day) {
	var number = year * cal.yearBase + leapsBefore(cal,year) * cal.leapExtra;
	for(var m = 1; m < month && m <= cal.months.length; m++) {
		number += monthLength(cal,year,m);
	}
	return number + day;
};

// Inverse of dayNumber: {year, month, day}
var dateFromNumber = exports.dateFromNumber = function(cal,number) {
	var average = cal.yearBase + (cal.every > 0 ? cal.leapExtra / cal.every : 0),
		year = Math.floor(number / average);
	while(dayNumber(cal,year,1,1) > number) {
		year--;
	}
	while(dayNumber(cal,year + 1,1,1) <= number) {
		year++;
	}
	var day = number - dayNumber(cal,year,1,0),
		month = 1;
	while(month < cal.months.length && day > monthLength(cal,year,month)) {
		day -= monthLength(cal,year,month);
		month++;
	}
	return {year: year, month: month, day: day};
};

function name(wiki,cal,kind,id) {
	var text = language.lookup(wiki,"Calendar/" + cal.id + "/" + kind + "/" + id);
	return text === null ? id : text;
}

exports.era = function(wiki,cal) {
	return language.lookup(wiki,"Calendar/" + cal.id + "/Era") || "";
};

exports.title = function(wiki,cal) {
	return language.lookup(wiki,"Calendar/" + cal.id + "/Name") || cal.id;
};

// Label of month/day as [monthLabel, dayText]: "Hammer (01)" plus the day, or for a festival
// day only ["Midwinter (01/02)"]. Unknown month or festival: "????".
var monthDay = exports.monthDay = function(wiki,cal,monthText,dayText) {
	var m = parseInt(monthText,10),
		day = parseInt(dayText,10),
		month = cal.months[m - 1];
	if(!month) {
		return ["????"];
	}
	if(day > month.days) {
		var festival = month.festivals[day - month.days - 1];
		if(!festival) {
			return ["????"];
		}
		var next = m === cal.months.length ? 1 : m + 1;
		return [name(wiki,cal,"Festival",festival.id) + " (" + pad2(m) + "/" + pad2(next) + ")"];
	}
	var result = [name(wiki,cal,"Month",month.id) + " (" + pad2(m) + ")"];
	if(dayText) {
		result.push(dayText);
	}
	return result;
};

// Wikitext table of months, epithets and festivals for the Calendar hub
exports.table = function(wiki,cal) {
	var lines = [];
	for(var m = 0; m < cal.months.length; m++) {
		var month = cal.months[m],
			epithet = language.lookup(wiki,"Calendar/" + cal.id + "/Epithet/" + month.id) || "";
		lines.push("| " + (m + 1) + " |" + name(wiki,cal,"Month",month.id) + "|" + epithet + "|");
		$tw.utils.each(month.festivals,function(f) {
			var label = name(wiki,cal,"Festival",f.id);
			if(f.leap) {
				label += " " + language.format(language.t(wiki,"Calendar/EveryNYears"),{n: cal.every});
			}
			lines.push("||" + label + "||");
		});
	}
	return lines.join("\n");
};
