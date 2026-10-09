/*
 * Domains of type damage (modules/rules.js, <<damage>>) against fixture-ruleset-5e-mini: the
 * grammar - a calculation (dice, numbers, +/-, an average with the dice in brackets, also without
 * spaces), then the type; "+", "plus", "and"/"und" after a type start the next part; fillers
 * ("damage", "DMG", "Schaden") and extras dropped; the words of every language; the pattern and
 * the join of the display language; what is not understood. Qualifiers: ruleset-generic.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki, rules;

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		rules = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/rules.js");
	});
});

function dmg(value) {
	return h.filter(wiki, "[<v>trpgdamage[]]", {v: value}).join();
}

test.describe("de-DE", function() {
	test.before(function() {
		h.setLanguage(wiki, "de-DE");
	});

	test("one part: the phrase of the type after the dice", function() {
		assert.equal(dmg("1d8 slashing"), "1W8 Hiebschaden");
		assert.equal(dmg("2d8 Giftschaden"), "2W8 Giftschaden");
		assert.equal(dmg("1d8 cold DMG"), "1W8 Kälteschaden");
		assert.equal(dmg("1d6 Acid Schaden"), "1W6 Säureschaden");
	});

	test("a calculation before the type", function() {
		assert.equal(dmg("1d8 + 1d4 + 1 fire DMG"), "1W8 + 1W4 + 1 Feuerschaden");
		assert.equal(dmg("1d4+1d6+1d8+1d10+1d12 Acid Schaden"), "1W4+1W6+1W8+1W10+1W12 Säureschaden");
		assert.equal(dmg("7 (1d8 + 3) piercing"), "7 (1W8 + 3) Stichschaden");
	});

	test("several parts: + after a type, plus, und, and", function() {
		assert.equal(dmg("1d8 pierce + 1d4 fire"), "1W8 Stichschaden plus 1W4 Feuerschaden");
		assert.equal(dmg("1d8 bludgeon und 1d8 cold DMG"), "1W8 Wuchtschaden plus 1W8 Kälteschaden");
		assert.equal(dmg("1d8 bludgeoning damage plus 1d6 fire damage"), "1W8 Wuchtschaden plus 1W6 Feuerschaden");
	});

	test("extras before the type are dropped", function() {
		assert.equal(dmg("1d4 extra fire damage"), "1W4 Feuerschaden");
	});
});

test.describe("en-GB", function() {
	test.before(function() {
		h.setLanguage(wiki, "en-GB");
	});

	test("German words are read, English shown", function() {
		assert.equal(dmg("1W8 Stichschaden"), "1d8 piercing damage");
		assert.equal(dmg("2W6 Kälte"), "2d6 cold damage");
	});

	test("the join of the display language", function() {
		assert.equal(dmg("1d8 Wucht und 1d8 Kälte"), "1d8 bludgeoning damage plus 1d8 cold damage");
	});
});

test.describe("what is not understood", function() {
	test.before(function() {
		h.setLanguage(wiki, "de-DE");
	});

	test("an unknown word: the dice translated, the rest unchanged, a problem", function() {
		var r = rules.damage(wiki, "1d4 + Rage Damage");
		assert.equal(r.text, "1W4 + Rage Damage");
		assert.equal(r.problem, "Rules/Check/Damage");
		assert.equal(r.values.text, "Rage");
	});

	test("no type at all", function() {
		var r = rules.damage(wiki, "1d6");
		assert.equal(r.text, "1W6");
		assert.equal(r.problem, "Rules/Check/DamageType");
	});
});
