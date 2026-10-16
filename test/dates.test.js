/*
 * The date field (modules/dates.js) and the date operators (filters/date.js): syntax of
 * sections, spans, "." and "..", the short form of dateformat in de-DE and en-GB with the
 * Harptos calendar, the long form for the calculator, dateadd/datediff, dateended (trpg.dead)
 * and datecheck, datesection (the section a date falls into), and the raw output without a
 * calendar.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki, dates;

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		dates = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/dates.js");
	});
});

function f(text) {
	return h.filter(wiki, text).join();
}

function shape(text) {
	var parsed = dates.parse(text);
	return parsed.sections.map(function(s) {
		var side = function(x) { return typeof x === "object" ? x.text : x; };
		return s.range ? side(s.start) + "/" + side(s.end) : side(s.start);
	}).join(", ") + (parsed.valid ? "" : " !") + (parsed.ended ? " ended" : "");
}

test.describe("syntax", function() {
	test("points and spans", function() {
		assert.equal(shape("1351/1371, 1381"), "1351/1371, 1381");
		assert.equal(shape("1351-07-05, 1351-07-22/1351-07-24"), "1351-07-05, 1351-07-22/1351-07-24 ended");
	});

	test("whitespace is ignored", function() {
		assert.equal(shape("1351,1352"), shape("1351, 1352"));
		assert.equal(shape(" 1351 / 1352 "), "1351/1352 ended");
	});

	test("unknown and forever", function() {
		assert.equal(shape("./1339"), "unknown/1339 ended");
		assert.equal(shape("1351/."), "1351/unknown ended");
		assert.equal(shape("1351-07-11/.."), "1351-07-11/forever");
		assert.equal(shape("../.."), "forever/forever");
		assert.equal(shape("./."), "unknown/unknown ended");
	});

	test("an empty side is ignored, with a warning", function() {
		assert.equal(shape("1351/"), "1351");
		assert.equal(shape("/1351"), "1351");
		assert.ok(dates.parse("1351/").warnings.length === 1);
	});

	test("a single point is not ended", function() {
		assert.equal(shape("1322"), "1322");
	});

	test("invalid parts", function() {
		assert.equal(shape("1351.1352"), " !");
		assert.equal(shape("/"), " !");
		assert.equal(shape("1351/1352/1353"), " !");
		assert.equal(shape("1351-00"), " !");
		assert.equal(dates.parse("1351, x").invalid.join(), "x");
	});

	test("calendar check", function() {
		var cal = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/calendar.js").active(wiki);
		assert.equal(dates.check(cal, dates.parse("1351-07-31, 1352-07-32")).join(), "");
		assert.equal(dates.check(cal, dates.parse("1351-07-41")).length, 1);
		assert.equal(dates.check(cal, dates.parse("1351-07-32")).length, 1, "Shieldmeet only in leap years");
		assert.equal(dates.check(cal, dates.parse("1351-13")).length, 1);
		assert.equal(dates.check(cal, dates.parse("1352/1351")).length, 1);
		assert.equal(dates.check(cal, dates.parse("1352, 1351")).length, 1);
	});
});

test.describe("de-DE", function() {
	test.before(function() {
		h.setLanguage(wiki, "de-DE");
	});

	test("dateformat: point", function() {
		assert.equal(f("[[1351-07-05]dateformat[]]"), "5. Flamerule 1351");
		assert.equal(f("[[1351-07]dateformat[]]"), "Flamerule 1351");
		assert.equal(f("[[1351]dateformat[]]"), "1351");
	});

	test("dateformat: festival", function() {
		assert.equal(f("[[1351-01-31]dateformat[]]"), "Mittwinter 1351");
	});

	test("dateformat: time", function() {
		assert.equal(f("[[1351-07-01-10:00]dateformat[]]"), "1. Flamerule 1351 10:00 Uhr");
	});

	test("dateformat: span in one month, in one year, over years", function() {
		assert.equal(f("[[1351-07-22/1351-07-24]dateformat[]]"), "22. – 24. Flamerule 1351");
		assert.equal(f("[[1351-07-05/1351-11-20]dateformat[]]"), "5. Flamerule – 20. Uktar 1351");
		assert.equal(f("[[1200/1351-04-14]dateformat[]]"), "1200 – 14. Tarsakh 1351");
	});

	test("dateformat: unknown and open sides", function() {
		assert.equal(f("[[./1339]dateformat[]]"), "???? – 1339");
		assert.equal(f("[[1351-07-11/..]dateformat[]]"), "11. Flamerule 1351 – ????");
		assert.equal(f("[[../..]dateformat[]]"), "seit jeher – ????");
	});

	test("dateformat: whole field = span of all sections", function() {
		assert.equal(f("[[1351-07-05, 1351-07-09, 1351-07-22/1351-07-24]dateformat[]]"), "5. – 24. Flamerule 1351");
		assert.equal(f("[[1351/1371, 1381]dateformat[]]"), "1351 – 1381");
	});

	test("dateformat: one section", function() {
		assert.equal(f("[[1351-07-05, 1351-07-22/1351-07-24]dateformat[2]]"), "22. – 24. Flamerule 1351");
		assert.equal(f("[[1351-07-05]dateformat[3]]"), "");
	});

	test("dateformat: era and years only", function() {
		assert.equal(f("[[1351-07-05]dateformat:era[]]"), "5. Flamerule 1351 DR");
		assert.equal(f("[[1351-07-22/1351-07-24]dateformat:era[]]"), "22. – 24. Flamerule 1351 DR");
		assert.equal(f("[[1200/1351-04-14]dateformat:year,era[]]"), "1200 – 1351 DR");
		assert.equal(f("[[1322]dateformat:year,era[]]"), "1322 DR");
		assert.equal(f("[[1351/..]dateformat:year,era[]]"), "1351 DR – ????");
	});

	test("dateformat: last - the current phase of a non-event after a death and a return", function() {
		assert.equal(f("[[./1351, 1355]dateformat:year,era,last[]]"), "1355 DR");
		assert.equal(f("[[./., 1355]dateformat:year,era,last[]]"), "1355 DR");
		assert.equal(f("[[./1351, ./1380]dateformat:year,era,last[]]"), "???? – 1380 DR");
		assert.equal(f("[[1200/1351-04-14]dateformat:year,era,last[]]"), "1200 – 1351 DR");
		assert.equal(f("[[./1351, ./1380]dateformat:year,era[]]"), "???? – 1380 DR");
		assert.equal(f("[[./1351, 1355]dateformat:year,era[]]"), "???? – 1355 DR");
	});

	test("dateformat: long form for the calculator", function() {
		assert.equal(f("[[1351-01-31]dateformat:long[]]"), "//1351 DR//<br>//Mittwinter (01/02)//");
		assert.equal(f("[[1351-07-01-10:00]dateformat:long[]]"), "//1351 DR//<br>//01. Flamerule (07) 10:00 Uhr//");
	});

	test("order month before day ($:/config/tiddlyrpg/date/order): a comma after the day", function() {
		h.add(wiki, {title: "$:/config/tiddlyrpg/date/order", text: "md"});
		try {
			assert.equal(f("[[1351-07-05]dateformat:era[]]"), "Flamerule 5, 1351 DR");
			assert.equal(f("[[1351-07-22/1351-07-24]dateformat[]]"), "Flamerule 22 – 24, 1351");
			assert.equal(f("[[1351-07-05/1351-11-20]dateformat[]]"), "Flamerule 5 – Uktar 20, 1351");
			assert.equal(f("[[1350-12-30/1351-01-02]dateformat[]]"), "Nightal 30, 1350 – Hammer 2, 1351");
			assert.equal(f("[[1351-01-31]dateformat[]]"), "Mittwinter 1351", "a festival has no day");
			assert.equal(f("[[1351-07]dateformat[]]"), "Flamerule 1351", "a month without day, no comma");
			assert.equal(f("[[1351-07-01-10:00]dateformat:long[]]"), "//1351 DR//<br>//Flamerule (07) 01 10:00 Uhr//");
		} finally {
			wiki.deleteTiddler("$:/config/tiddlyrpg/date/order");
		}
	});

	test("order day before month set explicitly: as without config", function() {
		h.add(wiki, {title: "$:/config/tiddlyrpg/date/order", text: "dm"});
		try {
			assert.equal(f("[[1351-07-22/1351-07-24]dateformat[]]"), "22. – 24. Flamerule 1351");
		} finally {
			wiki.deleteTiddler("$:/config/tiddlyrpg/date/order");
		}
	});

	test("dateadd across Midsummer", function() {
		assert.equal(f("[[1351-07-30]dateadd[2]]"), "1351-08-01");
	});

	test("dateadd to Shieldmeet", function() {
		assert.equal(f("[[1352-07-30]dateadd[2]]"), "1352-07-32");
	});

	test("dateadd keeps the time", function() {
		assert.equal(f("[[1351-12-30-10:00]dateadd[1]]"), "1352-01-01-10:00");
	});

	test("datediff", function() {
		assert.equal(f("[[1351-01-01]datediff[1352-01-01]]"), "365");
		assert.equal(f("[[1352-01-01]datediff[1353-01-01]]"), "366");
	});

	test("dateended", function() {
		assert.equal(f("[[1200/1351]] [[./1339]] [[./.]] [[1322]] [[1351/..]] [[1351, 1352/1353]] +[dateended[]]"), "1200/1351,./1339,./.,1351, 1352/1353");
	});

	test("datecheck", function() {
		assert.equal(f("[[1351-07-41]] [[1351.1352]] [[1351-07-31]] +[datecheck[]]"), "1351-07-41,1351.1352");
	});
});

test.describe("en-GB", function() {
	test.before(function() {
		h.setLanguage(wiki, "en-GB");
	});

	test("en dateformat", function() {
		assert.equal(f("[[1351-07-05]dateformat[]]"), "5 Flamerule 1351");
		assert.equal(f("[[1351-07-22/1351-07-24]dateformat[]]"), "22 – 24 Flamerule 1351");
		assert.equal(f("[[1351-01-31]dateformat[]]"), "Midwinter 1351");
		assert.equal(f("[[../..]dateformat[]]"), "time immemorial – ????");
	});

	test("en long form", function() {
		assert.equal(f("[[1351-07-01-10:00]dateformat:long[]]"), "//1351 DR//<br>//01 Flamerule (07) 10:00//");
	});
});

test.describe("without calendar", function() {
	test.before(function() {
		h.setLanguage(wiki, "de-DE");
		h.add(wiki, {title: "$:/config/tiddlyrpg/calendar", text: ""});
	});

	test.after(function() {
		wiki.deleteTiddler("$:/config/tiddlyrpg/calendar");
	});

	test("raw date", function() {
		assert.equal(f("[[1351-01-31]dateformat:era[]]"), "1351-01-31");
		assert.equal(f("[[1351-01-31]dateformat:long[]]"), "//1351-01-31//");
	});

	test("raw span", function() {
		assert.equal(f("[[1200/1351-04-14]dateformat[]]"), "1200 – 1351-04-14");
	});

	test("raw years only", function() {
		assert.equal(f("[[1200/1351-04-14]dateformat:year[]]"), "1200 – 1351");
	});

	test("no calculation without calendar", function() {
		assert.equal(f("[[1351-01-01]dateadd[1]]"), "");
		assert.equal(f("[[1351-01-01]datediff[1351-01-02]]"), "");
	});

	test("no calendar check of days without calendar", function() {
		assert.equal(f("[[1351-07-41]datecheck[]]"), "");
	});

	test("section of a date without calendar", function() {
		h.add(wiki, {title: "Abschnitte", date: "1351-07-01, 1351-07-11/1351-07-20"});
		try {
			assert.equal(f("[[Abschnitte]datesection[1351-07-15]]"), "2");
		} finally {
			wiki.deleteTiddler("Abschnitte");
		}
	});
});

test.describe("section of a date (datesection)", function() {
	test.before(function() {
		h.add(wiki, {title: "Abschnitte", date: "1351-07-01, 1351-07-11/1351-07-20, 1352, 1360/.."});
		h.add(wiki, {title: "Gleich", date: "1351-07-01/1351-07-05, 1351-07-03/1351-07-07"});
	});

	test.after(function() {
		wiki.deleteTiddler("Abschnitte");
		wiki.deleteTiddler("Gleich");
	});

	function at(date, title) {
		return f("[[" + (title || "Abschnitte") + "]datesection[" + date + "]]");
	}

	test("point in a point, day in a span, day in a year", function() {
		assert.equal(at("1351-07-01"), "1");
		assert.equal(at("1351-07-15"), "2");
		assert.equal(at("1352-03-04"), "3");
	});

	test("open end", function() {
		assert.equal(at("1400"), "4");
	});

	test("the narrowest section wins, on a tie the first", function() {
		assert.equal(at("1351"), "1");
		assert.equal(at("1351-07-04", "Gleich"), "1");
	});

	test("a given span counts from its start", function() {
		assert.equal(at("1351-07-12/1351-07-30"), "2");
	});

	test("nothing without a match, for an unreadable date or without a date field", function() {
		assert.equal(at("1355"), "");
		assert.equal(at("abc"), "");
		assert.equal(at(""), "");
		assert.equal(at("1351", "Missing"), "");
	});
});

test.describe("before and after as a section of its own", function() {
	test("goes on after the last section, which stays a point", function() {
		var parsed = dates.parse("1350-12-19, 1351-08-09, 1351-11-26, ..");
		assert.equal(parsed.sections.length, 3);
		assert.equal(parsed.after, dates.FOREVER);
		assert.ok(!parsed.sections[2].range && parsed.valid && !parsed.ended);
	});

	test("began before the first section", function() {
		var parsed = dates.parse(".., 1351");
		assert.equal(parsed.before, dates.FOREVER);
		assert.equal(parsed.sections.length, 1);
		assert.equal(dates.parse("., 1351").before, dates.UNKNOWN);
	});

	test("an unknown end after the sections has ended", function() {
		assert.ok(dates.parse("1300, .").ended);
	});

	test("only first or last; alone it cannot be read", function() {
		assert.ok(!dates.parse("1351, .., 1352").valid);
		assert.ok(!dates.parse("..").valid);
	});

	test("short form of the field", function() {
		h.setLanguage(wiki, "de-DE");
		assert.equal(f("[[1351-08-09, 1351-11-26, ..]dateformat[]]"), "9. Eleasis 1351 – ????");
		assert.equal(f("[[.., 1351]dateformat:year[]]"), "seit jeher – 1351");
		assert.equal(f("[[1351-08-09, 1351-11-26, ..]dateformat[2]]"), "26. Uktar 1351");
	});
});
