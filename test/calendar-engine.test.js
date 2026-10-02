/*
 * Calendar engine (modules/calendar.js): Harptos against the former hard-wired arithmetic, and a
 * leap rule with start != 0 against a year-by-year count, negative years included.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki, calendar;

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = tw.wiki;
		calendar = $tw.modules.execute("$:/plugins/dndwiki-core/modules/calendar.js");
	});
});

// Former hard-wired Harptos arithmetic (dndwiki-core 1.4.1, macros/library.js) as reference
var reference = (function() {
	function daysInMonth(year, month) {
		var months = [31, 30, 30, 31, 30, 30, 31, 30, 31, 30, 31, 30],
			days = months[month - 1];
		if((year % 4 == 0) && (month - 1 == 6)) {
			days += 1;
		}
		return days;
	}
	function dayNumber(year, month, day) {
		var number = year * 365 + Math.ceil(year / 4);
		for(var m = 1; m < month; ++m) {
			number += daysInMonth(year, m);
		}
		return number + day;
	}
	return {daysInMonth: daysInMonth, dayNumber: dayNumber};
})();

test.describe("Harptos", function() {
	test("Harptos is the active calendar", function() {
		var cal = calendar.active(wiki);
		assert.equal(cal && cal.id, "Harptos");
	});

	test("engine matches the former Harptos arithmetic, years -41..41", function() {
		var cal = calendar.active(wiki),
			mismatches = [];
		for(var year = -41; year <= 41; year++) {
			for(var month = 1; month <= 12; month++) {
				var length = reference.daysInMonth(year, month);
				if(calendar.monthLength(cal, year, month) !== length) {
					mismatches.push(["length", year, month]);
				}
				for(var day = 1; day <= length; day++) {
					var number = calendar.dayNumber(cal, year, month, day),
						back = calendar.dateFromNumber(cal, number);
					if(number !== reference.dayNumber(year, month, day)) {
						mismatches.push(["number", year, month, day]);
					}
					if(back.year !== year || back.month !== month || back.day !== day) {
						mismatches.push(["inverse", year, month, day, back]);
					}
				}
			}
		}
		assert.deepEqual(mismatches.slice(0, 5), []);
	});
});

test.describe("own calendar with leap start 2", function() {
	var title = "$:/test/calendar/Odd",
		odd;

	test.before(function() {
		h.add(wiki, {title: title, type: "application/json", text: JSON.stringify({
			id: "Odd",
			leap: {every: 4, start: 2},
			months: [
				{id: "A", days: 10, festivals: [{id: "Feast"}]},
				{id: "B", days: 12},
				{id: "C", days: 9, festivals: [{id: "Leapday", leap: true}]}
			]
		})});
		h.add(wiki, {title: "$:/config/dndwiki/calendar", text: title});
		odd = calendar.active(wiki);
	});

	test.after(function() {
		wiki.deleteTiddler("$:/config/dndwiki/calendar");
		wiki.deleteTiddler(title);
	});

	test("leap years with start 2 are ..., -2, 2, 6, ...", function() {
		var leapYears = [];
		for(var y = -30; y <= 30; y++) {
			if(calendar.isLeap(odd, y)) {
				leapYears.push(y);
			}
		}
		assert.equal(leapYears.join(","), "-30,-26,-22,-18,-14,-10,-6,-2,2,6,10,14,18,22,26,30");
	});

	test("day numbers with start 2 match a year-by-year count", function() {
		var mismatches = [];
		for(var y = -30; y <= 30; y++) {
			// days from day 0 of year 0 to day 0 of year y, counted year by year
			var expected = 0;
			if(y > 0) {
				for(var k = 0; k < y; k++) {
					expected += 32 + (calendar.isLeap(odd, k) ? 1 : 0);
				}
			} else {
				for(var k2 = y; k2 < 0; k2++) {
					expected -= 32 + (calendar.isLeap(odd, k2) ? 1 : 0);
				}
			}
			if(calendar.dayNumber(odd, y, 1, 0) !== expected) {
				mismatches.push([y, calendar.dayNumber(odd, y, 1, 0), expected]);
			}
			var lastDay = calendar.monthLength(odd, y, 3),
				n = calendar.dayNumber(odd, y, 3, lastDay),
				b = calendar.dateFromNumber(odd, n);
			if(b.year !== y || b.month !== 3 || b.day !== lastDay) {
				mismatches.push(["inverse", y, b]);
			}
		}
		assert.deepEqual(mismatches.slice(0, 5), []);
	});

	test("leap festival only in leap years", function() {
		assert.equal(h.filter(wiki, "[[2-03-10]dateadd[1]]").join(), "3-01-01");
		assert.equal(calendar.monthLength(odd, 3, 3), 9);
	});

	test("difference across a leap year is one day longer", function() {
		assert.equal(h.filter(wiki, "[[2-01-01]datediff[3-01-01]]").join(), "33");
		assert.equal(h.filter(wiki, "[[3-01-01]datediff[4-01-01]]").join(), "32");
		assert.equal(h.filter(wiki, "[[6-01-01]datediff[7-01-01]]").join(), "33");
	});

	test("table of an own calendar without language keys shows the ids", function() {
		assert.ok(h.filter(wiki, "[calendar[table]]").join().indexOf("|A|") !== -1);
		assert.equal(h.filter(wiki, "[calendar[title]]").join(), "Odd");
	});
});
