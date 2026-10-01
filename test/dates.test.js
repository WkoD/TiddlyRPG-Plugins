/*
 * Date output and arithmetic (filters/date.js): datelong, datecalc, datediff in de-DE and en-GB
 * with the Harptos calendar, and the raw output without a calendar.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var wiki;

test.before(function() {
	return h.boot().then(function($tw) {
		wiki = $tw.wiki;
	});
});

function f(text) {
	return h.filter(wiki, text).join();
}

test.describe("de-DE", function() {
	test.before(function() {
		h.setLanguage(wiki, "de-DE");
	});

	test("datelong: festival in German", function() {
		assert.equal(f("[[1351-01-31]datelong[]]"), "//1351 DR//<br>//Mittwinter (01/02)//");
	});

	test("datelong: day, month, time", function() {
		assert.equal(f("[[1351-07-01-10:00]datelong[]]"), "//1351 DR//<br>//01. Flamerule (07) 10:00 Uhr//");
	});

	test("datelong: range", function() {
		assert.equal(f("[[1351-07-01.1351-11-20]datelong[]]"), "//1351 DR//<br>//01. Flamerule (07) - 20. Uktar (11)//");
	});

	test("datelong: year only", function() {
		assert.equal(f("[[1200.1351-04-14]datelong[true]]"), "//1200 - 1351 DR//<br>");
	});

	test("datecalc across Midsummer", function() {
		assert.equal(f("[[1351-07-30]datecalc[2]]"), "1351-08-01");
	});

	test("datecalc to Shieldmeet", function() {
		assert.equal(f("[[1352-07-30]datecalc[2]]"), "1352-07-32");
	});

	test("datecalc keeps the time", function() {
		assert.equal(f("[[1351-12-30-10:00]datecalc[1]]"), "1352-01-01-10:00");
	});

	test("datediff", function() {
		assert.equal(f("[[1351-01-01]datediff[1352-01-01]]"), "365");
		assert.equal(f("[[1352-01-01]datediff[1353-01-01]]"), "366");
	});
});

test.describe("en-GB", function() {
	test.before(function() {
		h.setLanguage(wiki, "en-GB");
	});

	test("en datelong festival", function() {
		assert.equal(f("[[1351-01-31]datelong[]]"), "//1351 DR//<br>//Midwinter (01/02)//");
	});

	test("en datelong time", function() {
		assert.equal(f("[[1351-07-01-10:00]datelong[]]"), "//1351 DR//<br>//01 Flamerule (07) 10:00//");
	});
});

test.describe("without calendar", function() {
	test.before(function() {
		h.setLanguage(wiki, "de-DE");
		h.add(wiki, {title: "$:/config/dndwiki/calendar", text: ""});
	});

	test.after(function() {
		wiki.deleteTiddler("$:/config/dndwiki/calendar");
	});

	test("raw date", function() {
		assert.equal(f("[[1351-01-31]datelong[]]"), "//1351-01-31//");
	});

	test("raw range", function() {
		assert.equal(f("[[1200.1351-04-14]datelong[]]"), "//1200 - 1351-04-14//");
	});

	test("raw year only", function() {
		assert.equal(f("[[1200.1351-04-14]datelong[yes]]"), "//1200 - 1351//");
	});

	test("no calculation without calendar", function() {
		assert.equal(f("[[1351-01-01]datecalc[1]]"), "");
		assert.equal(f("[[1351-01-01]datediff[1351-01-02]]"), "");
	});
});
