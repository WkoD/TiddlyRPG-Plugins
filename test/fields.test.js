/*
 * The values of fields by format (modules/rules.js value(), modules/labels.js) against
 * fixture-ruleset-5e-mini: number (sign, decimal mark, limits), boolean (words of every language),
 * dice (with the tokens of a domain, an average in brackets), unit (words in place of a number,
 * units of another domain), label (one entry, words of every language, only), labels (a list,
 * entries with a value, main entries with their traits, the tag, a trait without parent, a trait
 * that fits twice), text.
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
		h.setLanguage(wiki, "de-DE");
	});
});

function v(spec, text) {
	return rules.value(wiki, spec, text);
}

test.describe("number", function() {
	var spec = {format: "number", min: 1, max: 30};

	test("as written, with the sign and the decimal mark of the wiki language", function() {
		assert.equal(v(spec, "19").text, "19");
		assert.equal(v(spec, "+2").text, "+2");
		assert.equal(v({format: "number"}, "1.5").text, "1,5");
		assert.equal(v({format: "number"}, "-1").value, -1);
	});

	test("no number, outside the limits", function() {
		assert.equal(v(spec, "zwei").problem, "Rules/Check/Number");
		assert.equal(v(spec, "31").problem, "Rules/Check/NumberRange");
		assert.equal(v(spec, "0").problem, "Rules/Check/NumberRange");
	});
});

test.describe("boolean", function() {
	test("the words of every language, shown in the wiki language", function() {
		assert.equal(v({format: "boolean"}, "yes").text, "ja");
		assert.equal(v({format: "boolean"}, "nein").text, "nein");
		assert.equal(v({format: "boolean"}, "true").value, true);
		assert.equal(v({format: "boolean"}, "vielleicht").problem, "Rules/Check/Boolean");
	});
});

test.describe("dice", function() {
	test("dice and numbers joined by + and -, an average with the dice in brackets", function() {
		assert.equal(v({format: "dice"}, "1d6").text, "1W6");
		assert.equal(v({format: "dice"}, "1d4 + 1").problem, null);
		assert.equal(v({format: "dice"}, "2").problem, null);
		assert.equal(v({format: "dice"}, "7 (2d6)").problem, null);
		assert.equal(v({format: "dice", domain: "Dice"}, "1W8").problem, null, "German dice");
	});

	test("what is no dice expression", function() {
		assert.equal(v({format: "dice"}, "1d6 Feuer").problem, "Rules/Check/Dice");
		assert.equal(v({format: "dice"}, "viele").problem, "Rules/Check/Dice");
	});
});

test.describe("unit", function() {
	test("the kind of the field, a pair", function() {
		assert.equal(v({format: "unit", domain: "Length", kind: "range"}, "20/60 ft").text, "6/18 m");
	});

	test("words in place of a number, limited by only", function() {
		var spec = {format: "unit", domain: "Length", words: "Size", only: ["tiny"]};
		assert.equal(v(spec, "tiny").text, "winzig");
		assert.equal(v(spec, "30 ft").text, "9 m");
		assert.equal(v(spec, "medium").problem, "Rules/Check/Unit", "not among only, and no unit");
	});

	test("a unit of another domain", function() {
		var r = v({format: "unit", domain: "Length"}, "3 lb");
		assert.equal(r.problem, "Rules/Check/UnitDomain");
		assert.equal(r.values.domain, "Länge", "the name of the domain in the wiki language");
	});
});

test.describe("label", function() {
	test("one entry, by id or by a word of any language", function() {
		assert.equal(v({format: "label", domain: "Rarity"}, "rare").text, "selten");
		assert.equal(v({format: "label", domain: "Rarity"}, "selten").text, "selten");
		assert.equal(v({format: "label", domain: "Rarity"}, "legendary").problem, "Rules/Check/Label");
	});

	test("only", function() {
		assert.equal(v({format: "label", domain: "Rarity", only: ["common"]}, "rare").problem, "Rules/Check/Only");
	});
});

test.describe("labels", function() {
	test("a list of one or more domains; damage types count", function() {
		assert.equal(v({format: "labels", domain: "Damage"}, "fire, cold").text, "Feuer, Kälte");
		assert.equal(v({format: "labels", domain: ["Ability", "Terms"]}, "wis, ac").text, "WEI, RK");
	});

	test("entries with a value after them", function() {
		var spec = {format: "labels", domain: "Ability", value: {format: "number"}};
		assert.equal(v(spec, "wis +6, str +2").text, "WEI +6, STR +2");
		assert.equal(v(spec, "Strength +2").text, "STR +2", "a variant names the entry too");
		assert.equal(v(spec, "wis sechs").problem, "Rules/Check/Number");
		assert.equal(v({format: "labels", domain: "Ability"}, "wis +6").problem, "Rules/Check/Label", "no value without spec.value");
	});

	test("main entries with their traits: order free, the tag of the main entry", function() {
		var spec = {format: "labels", domain: "ItemCategory"},
			r = v(spec, "versatile, weapon, melee, martial");
		assert.equal(r.text, "Kriegswaffe, Nahkampf, vielseitig");
		assert.equal(r.tag, "Equipment");
		assert.equal(v(spec, "armor, light").text, "leichte Rüstung");
		assert.equal(v(spec, "weapon, light").text, "Waffe, leicht", "light without a variant for weapon");
		assert.equal(v(spec, "ammunition").tag, "Consumable");
		assert.equal(v(spec, "weapon, ammunition").tag, "Equipment", "ammunition is a trait of the weapon here");
	});

	test("a trait without parent; a trait that fits twice", function() {
		var spec = {format: "labels", domain: "ItemCategory"};
		assert.equal(v(spec, "crystal").problem, "Rules/Check/TraitParent");
		assert.equal(v(spec, "focus, crystal").problem, "Rules/Check/TraitParent", "crystal belongs to arcane");
		var r = v(spec, "weapon, armor, light");
		assert.equal(r.problem, "Rules/Check/TraitTwice");
		assert.equal(r.values.parents, "weapon, armor");
	});
});

test.describe("text", function() {
	test("as written, never checked", function() {
		var r = v({format: "text"}, "by a cleric");
		assert.equal(r.text, "by a cleric");
		assert.equal(r.problem, null);
	});
});
