/*
 * Domains of type label (modules/rules.js, <<term>>) against fixture-ruleset-5e-mini (Ability,
 * Terms): the label in the display language of its domain, a variant, the id in any case, an
 * unknown id or variant; ids unique among the entries that stand alone; a main entry with its
 * traits in one <<term>> ("armor medium"), a trait alone is no term, "medium" alone the size;
 * "GM" is the game master in the domain Terms (in a currency it would be a gold piece - parsing
 * stays within a domain).
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki, rules, language;

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		rules = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/rules.js");
		language = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/language.js");
	});
});

function t(id, variant) {
	return h.filter(wiki, "[<id>trpgterm<variant>]", {id: id, variant: variant || ""}).join();
}

test.describe("de-DE", function() {
	test.before(function() {
		h.setLanguage(wiki, "de-DE");
	});

	test("labels", function() {
		assert.equal(t("wis"), "WEI");
		assert.equal(t("ac"), "RK");
		assert.equal(t("gm"), "SL");
		assert.equal(t("xp"), "EP");
	});

	test("variants", function() {
		assert.equal(t("wis", "save"), "WEI-Rettungswurf");
		assert.equal(t("str", "name"), "Stärke");
	});

	test("the id in any case", function() {
		assert.equal(t("WIS"), "WEI");
	});
});

test.describe("en-GB", function() {
	test.before(function() {
		h.setLanguage(wiki, "en-GB");
	});

	test("labels and variants", function() {
		assert.equal(t("wis", "save"), "WIS save");
		assert.equal(t("gm"), "GM");
	});
});

test.describe("a main entry with its traits", function() {
	test("de-DE: an absorbing variant takes the place of the main label, the rest follows", function() {
		h.setLanguage(wiki, "de-DE");
		assert.equal(t("armor medium"), "mittelschwere Rüstung");
		assert.equal(t("medium armor"), "mittelschwere Rüstung", "the order does not matter");
		assert.equal(t("weapon martial melee versatile"), "Kriegswaffe (Nahkampf, vielseitig)");
		assert.equal(t("focus arcane crystal"), "arkaner Fokus: Kristall", "a deeper trait after its parent");
		assert.equal(t("weapon ammunition arrow"), "Waffe (Munition: Pfeil)");
	});

	test("a trait alone is no term; medium alone is the size", function() {
		h.setLanguage(wiki, "de-DE");
		assert.equal(t("medium"), "mittelgroß");
		assert.equal(rules.term(wiki, "crystal").problem, "Rules/Check/Term");
		assert.equal(rules.term(wiki, "armor crystal").problem, "Rules/Check/Term", "crystal belongs to arcane");
		assert.equal(rules.term(wiki, "ammunition").problem, null, "a main entry that is also a trait stands alone");
	});

	test("en-GB", function() {
		h.setLanguage(wiki, "en-GB");
		assert.equal(t("armor medium"), "medium armor");
		assert.equal(t("medium"), "medium");
	});
});

test.describe("what is not understood", function() {
	test("an unknown id and an unknown variant: unchanged, with a problem", function() {
		var r = rules.term(wiki, "xyz");
		assert.equal(r.text, "xyz");
		assert.equal(r.problem, "Rules/Check/Term");
		r = rules.term(wiki, "wis", "check");
		assert.equal(r.text, "wis check");
		assert.equal(r.problem, "Rules/Check/Variant");
	});
});

test("the ids are unique among the entries that stand alone (a trait may repeat one)", function() {
	var domains = language.domains(wiki),
		seen = {},
		twice = [];
	Object.keys(domains).forEach(function(name) {
		if(domains[name].type === "label") {
			(domains[name].entries || []).filter(function(entry) { return !entry.for || entry.main; }).forEach(function(entry) {
				if(seen[entry.id]) {
					twice.push(entry.id);
				}
				seen[entry.id] = true;
			});
		}
	});
	assert.deepEqual(twice, []);
});
