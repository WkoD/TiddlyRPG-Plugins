/*
 * Domains of type unit (modules/rules.js, <<unit>>) against fixture-ruleset-5e-mini (Length -
 * sizes and distances in one domain - and Weight): parsing (labels, written variants, 5etools
 * forms), pairs per unit, kinds with their display, the display without kind, compound values,
 * the decimal mark of the wiki language, a value already in the display system, what is not
 * understood - a number without unit among it, also with a kind; pairs of a kind with "pair"
 * (20/60 ft), fractions, measures (10 x 10 x 1 ft), ft³ as a volume (Volume), 0 in the unit of
 * its pair, a domain without conversion (Time) with plural labels.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki;

var RULES = "$:/config/tiddlyrpg/rules/ruleset/";

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
	});
});

function u(value, kind) {
	return h.filter(wiki, "[<v>trpgunit<k>]", {v: value, k: kind || ""}).join();
}

function withRules(values, fn) {
	Object.keys(values).forEach(function(key) {
		h.add(wiki, {title: RULES + key, text: values[key]});
	});
	try {
		return fn();
	} finally {
		Object.keys(values).forEach(function(key) {
			wiki.deleteTiddler(RULES + key);
		});
	}
}

test.describe("shown in en-GB", function() {
	test.before(function() {
		h.setLanguage(wiki, "en-GB");
	});

	test("a size in feet and inches", function() {
		assert.equal(u("228 cm"), "7 ft 7 in");
		assert.equal(u("150 cm"), "5 ft");
		assert.equal(u("152 cm"), "5 ft 1 in", "60.8 in, rounded to whole inches");
		assert.equal(u("10 cm"), "4 in");
	});

	test("metric distances and weights", function() {
		assert.equal(u("30 m"), "100 ft");
		assert.equal(u("1,6 km"), "1 mi");
		assert.equal(u("2 kg"), "4 lb");
	});

	test("without kind: feet and inches below 10 ft, whole feet below one mile, then miles", function() {
		assert.equal(u("1,70 m"), "5 ft 8 in");
		assert.equal(u("1000 m"), "3333 ft");
		assert.equal(u("2 km"), "1.3 mi");
	});

	test("the kind range: whole feet, no inches", function() {
		assert.equal(u("2 m", "range"), "7 ft");
		assert.equal(u("2 m"), "6 ft 8 in", "without kind");
	});

	test("a value that is not 0 never shows as 0: 9 m as distance is 30 ft", function() {
		assert.equal(u("9 m", "distance"), "30 ft");
	});

	test("the kind size: feet and inches below 10 ft, then feet, never miles", function() {
		assert.equal(u("2 m", "size"), "6 ft 8 in");
		assert.equal(u("2 km", "size"), "6600 ft", "by the pair km -> mi");
	});

	test("in the display system already: as written, label in the display language", function() {
		assert.equal(u("30 feet"), "30 ft");
		assert.equal(u("7 ft 7 in"), "7 ft 7 in");
		assert.equal(u("2.5 lb"), "2.5 lb");
	});

	test("5etools forms and text around the values", function() {
		assert.equal(u("3 lb."), "3 lb");
		assert.equal(u("150 feet"), "150 ft");
		assert.equal(u("30 ft., fly 50 ft."), "30 ft, fly 50 ft");
	});
});

test.describe("shown in de-DE", function() {
	test.before(function() {
		h.setLanguage(wiki, "de-DE");
	});

	test("pairs per unit: ft -> m 0.3, mi -> km 1.6, lb -> kg 0.5, in -> cm 2.5", function() {
		assert.equal(u("30 ft"), "9 m");
		assert.equal(u("5 ft"), "1,5 m");
		assert.equal(u("1 mi"), "1,6 km");
		assert.equal(u("3 lb"), "1,5 kg");
		assert.equal(u("10 in"), "25 cm");
	});

	test("the pairs are not chained: 5280 ft is not 1 mi", function() {
		assert.equal(u("5280 ft"), "1,6 km");
		assert.equal(u("1 mi"), "1,6 km");
	});

	test("without kind: below 1 m in cm, below 1 km in m with two decimals, then km", function() {
		assert.equal(u("7 ft 7 in"), "2,28 m");
		assert.equal(u("3 ft"), "90 cm");
		assert.equal(u("6 ft"), "1,8 m");
		assert.equal(u("4000 ft"), "1,2 km");
	});

	test("the kind range: m with one decimal, no cm", function() {
		assert.equal(u("3 ft", "range"), "0,9 m");
		assert.equal(u("25 ft", "range"), "7,5 m");
	});

	test("the kind distance: always km", function() {
		assert.equal(u("3 mi", "distance"), "4,8 km");
	});

	test("a value that is not 0 never shows as 0: then the display of the domain", function() {
		assert.equal(u("30 ft", "distance"), "9 m");
		assert.equal(u("3 in", "distance"), "8 cm");
	});

	test("no floating point remainder: 5 ft 10 in is 175 cm, as range 1,8 m", function() {
		assert.equal(u("5 ft 10 in", "range"), "1,8 m");
		assert.equal(u("5 ft 10 in"), "1,75 m");
	});

	test("the kind size: cm below 1 m, then m with two decimals, never km", function() {
		assert.equal(u("3 ft", "size"), "90 cm");
		assert.equal(u("7 ft 7 in", "size"), "2,28 m");
		assert.equal(u("4000 ft", "size"), "1200 m");
	});

	test("German words are read", function() {
		assert.equal(u("30 Fuß"), "9 m");
		assert.equal(u("300 Pfund"), "150 kg");
	});

	test("as written in the display system, with the decimal mark of the wiki language", function() {
		assert.equal(u("1,52 m"), "1,52 m");
		assert.equal(u("1.52 m"), "1,52 m");
		assert.equal(u("228 cm"), "228 cm");
	});

	test("shown in English per domain: a range in feet, a weight in pounds", function() {
		withRules({"mode": "all", "language": "en-GB"}, function() {
			assert.equal(u("18 m", "range"), "60 ft");
			assert.equal(u("60 ft", "range"), "60 ft");
			assert.equal(u("1,5 kg"), "3 lb");
		});
	});
});

test.describe("pairs, fractions, measures, ³, 0, domains without conversion", function() {
	var rules;

	test.before(function() {
		h.setLanguage(wiki, "de-DE");
		rules = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/rules.js");
	});

	test("a kind with pair reads a/b as two values, each converted", function() {
		assert.equal(u("20/60 ft", "range"), "6/18 m");
		assert.equal(u("15/30ft", "range"), "4,5/9 m");
		assert.equal(u("20/60 ft.", "range"), "6/18 m", "5etools form");
		assert.equal(rules.unit(wiki, "20/60 ft", "range").problem, null);
	});

	test("a/b without such a kind: a fraction for 2, 3, 4, 8, 16 below, else a pair with a hint", function() {
		assert.equal(u("1/4 lb"), "0,1 kg");
		assert.equal(u("½ lb"), "0,3 kg");
		assert.equal(u("1½ lb"), "0,8 kg");
		var r = rules.unit(wiki, "20/60 ft");
		assert.equal(r.text, "6/18 m");
		assert.equal(r.problem, "Rules/Check/Pair");
		assert.equal(r.values.kinds, "range");
	});

	test("measures convert every number, in the step of the largest", function() {
		assert.equal(u("10x10x1ft"), "3 × 3 × 0,3 m");
		assert.equal(u("10 × 5 × 2 ft"), "3 × 1,5 × 0,6 m");
	});

	test("ft³ is a volume, never a length", function() {
		assert.equal(u("64ft³"), "1,7 m³");
		assert.equal(u("64 cubic feet"), "1,7 m³");
	});

	test("0 shows in the unit its pair converts to", function() {
		assert.equal(u("0 ft"), "0 m");
		assert.equal(u("0 ft., fly 30 ft."), "0 m, fly 9 m");
	});

	test("a domain whose system no language names is only labelled, with its plural", function() {
		assert.equal(u("10 minutes"), "10 Minuten");
		assert.equal(u("1 round"), "1 Runde");
		assert.equal(u("3 Runden"), "3 Runden");
		withRules({"mode": "all", "language": "en-GB"}, function() {
			assert.equal(u("1 Stunde"), "1 hour");
			assert.equal(u("8 Stunden"), "8 hours");
		});
	});
});

test.describe("what is not understood", function() {
	var rules;

	test.before(function() {
		h.setLanguage(wiki, "de-DE");
		rules = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/rules.js");
	});

	test("an unknown unit: unchanged, with a problem", function() {
		var r = rules.unit(wiki, "3 cubits");
		assert.equal(r.text, "3 cubits");
		assert.equal(r.problem, "Rules/Check/Unit");
	});

	test("a number without unit, also with a kind; an unknown kind", function() {
		assert.equal(rules.unit(wiki, "228").problem, "Rules/Check/NoUnit");
		assert.equal(rules.unit(wiki, "60", "range").problem, "Rules/Check/NoUnit", "the kind gives no unit");
		assert.equal(rules.unit(wiki, "60", "range").text, "60");
		assert.equal(rules.unit(wiki, "228 cm", "height").problem, "Rules/Check/Kind", "height is no kind any more");
		assert.equal(rules.unit(wiki, "228", "girth").problem, "Rules/Check/Kind");
		assert.equal(rules.unit(wiki, "228", "girth").text, "228");
	});
});
