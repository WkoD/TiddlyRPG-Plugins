/*
 * Domains of type unit (modules/rules.js, <<unit>>) against fixture-ruleset-5e-mini (Length -
 * sizes and distances in one domain - and Weight): parsing (labels, written variants, 5etools
 * forms), pairs per unit, kinds with their unit and display, the display without kind, compound
 * values, the input language for numbers without unit, the decimal mark of the wiki language, a
 * value already in the display system, what is not understood.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki;

var RULES = "$:/config/tiddlyrpg/rules/";

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
		assert.equal(u("3 ft", "size"), "90 cm", "the same with the kind size");
		assert.equal(u("6 ft", "height"), "1,8 m");
		assert.equal(u("4000 ft"), "1,2 km");
	});

	test("the kind range: m with one decimal, no cm", function() {
		assert.equal(u("3 ft", "range"), "0,9 m");
		assert.equal(u("25 ft", "range"), "7,5 m");
	});

	test("the kind travel: always km", function() {
		assert.equal(u("3 mi", "travel"), "4,8 km");
	});

	test("German words are read", function() {
		assert.equal(u("30 Fuß"), "9 m");
		assert.equal(u("300 Pfund"), "150 kg");
	});

	test("as written in the display system, with the decimal mark of the wiki language", function() {
		assert.equal(u("1,52 m", "height"), "1,52 m");
		assert.equal(u("1.52 m", "height"), "1,52 m");
		assert.equal(u("228 cm"), "228 cm");
	});
});

test.describe("numbers without unit: kind and input language", function() {
	test.before(function() {
		h.setLanguage(wiki, "de-DE");
	});

	test("the kind chooses the domain, the input language the unit", function() {
		assert.equal(u("228", "height"), "228 cm");
		assert.equal(u("60", "range"), "60 m");
		withRules({"input/mode": "all", "input/language": "en-GB"}, function() {
			assert.equal(u("60", "range"), "18 m");
			assert.equal(u("30", "travel"), "48 km");
			assert.equal(u("3", "weight"), "1,5 kg");
		});
	});

	test("one input language for all lengths: a height and a range both in metric", function() {
		withRules({"input/mode": "domain", "input/domain/Length": "de-DE",
			"display/mode": "all", "display/language": "en-GB"}, function() {
			assert.equal(u("228", "height"), "7 ft 7 in");
			assert.equal(u("60", "range"), "200 ft");
			assert.equal(u("60 ft", "range"), "60 ft", "an explicit unit for the other one");
		});
	});

	test("an explicit unit wins over the input language", function() {
		withRules({"input/mode": "all", "input/language": "en-GB"}, function() {
			assert.equal(u("228 cm", "height"), "228 cm");
		});
	});

	test("the decimal mark of the input language is read", function() {
		assert.equal(u("1,52", "height"), "1,52 cm");
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

	test("a number without unit and kind, an unknown kind", function() {
		assert.equal(rules.unit(wiki, "228").problem, "Rules/Check/NoUnit");
		assert.equal(rules.unit(wiki, "228", "girth").problem, "Rules/Check/Kind");
		assert.equal(rules.unit(wiki, "228", "girth").text, "228");
	});
});
