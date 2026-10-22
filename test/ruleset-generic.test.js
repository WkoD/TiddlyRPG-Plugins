/*
 * Another rules system without code changes in tiddlyrpg-core: fixture-ruleset-probe, in the style
 * of Pathfinder 2E, as the active ruleset - label domains with a value ("frightened 2"), a tokens
 * domain Bulk ("L"), damage with qualifiers ("persistent", "splash") and the dice, all only as
 * data. The hub "Ruleset" and the tab "TiddlyRPG" join this file with their phases.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki, language;

var RULESET = "$:/config/tiddlyrpg/ruleset";

function settle() {
	return new Promise(function(resolve) {
		setTimeout(resolve, 0);
	});
}

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		language = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/language.js");
		h.add(wiki, {title: RULESET, text: "$:/plugins/fixture-ruleset-probe"});
		return settle();
	});
});

test.after(function() {
	wiki.deleteTiddler(RULESET);
	return settle();
});

function f(text, variables) {
	return h.filter(wiki, text, variables).join();
}

test("the probe is the active ruleset, its domains are registered", function() {
	assert.equal(f("[trpgplugin[ruleset]]"), "$:/plugins/fixture-ruleset-probe");
	var domains = language.domains(wiki);
	assert.deepEqual(Object.keys(domains).filter(function(name) { return name !== "Calendar" && name !== "Currency"; }).sort(),
		["Bulk", "Conditions", "Damage", "Dice", "Saves", "Traits"]);
	assert.equal(domains.Length, undefined, "no units");
});

test.describe("de-DE", function() {
	test.before(function() {
		h.setLanguage(wiki, "de-DE");
	});

	test("a condition with a value", function() {
		assert.equal(f("[[frightened]trpgterm[],[2]]"), "verängstigt 2");
		assert.equal(h.render(wiki, "text/plain", "<<term frightened value:2>>").trim(), "verängstigt 2");
		assert.equal(f("[[frightened]trpgterm[]]"), "verängstigt");
	});

	test("traits and saves", function() {
		assert.equal(f("[[magical]trpgterm[]]"), "magisch");
		assert.equal(f("[[fortitude]trpgterm[]]"), "Zähigkeit");
	});

	test("the tab rules language lists its domains with their examples", function() {
		h.add(wiki, {title: "$:/state/tiddlyrpg/settings-tab", text: "$:/plugins/tiddlyrpg-core/ui/settings-ruleset-options"});
		try {
			var html = h.render(wiki, "text/html", "{{$:/plugins/tiddlyrpg-core/ui/controlpanel-tiddlyrpg}}").replace(/>\s+</g, "><");
			assert.match(html, /<td>Zustände<\/td><td>[^<]*<\/td><td>frightened 2 → verängstigt 2<\/td>/);
			assert.match(html, /<td>Traglast<\/td>/);
			assert.match(html, /2d6 fire plus 1d4 persistent bleed → 2W6 Feuerschaden plus 1W4 anhaltender Blutungsschaden/);
			assert.doesNotMatch(html, /<td>Länge<\/td>/);
		} finally {
			wiki.deleteTiddler("$:/state/tiddlyrpg/settings-tab");
		}
	});

	test("the hub Ruleset lists its domains and the qualifier", function() {
		var html = h.render(wiki, "text/html", "{{Ruleset}}").replace(/>\s+</g, "><");
		assert.match(html, /<h2[^>]*>Fixture probe<\/h2>/);
		assert.match(html, /<h3[^>]*>Zustände<\/h3>/);
		assert.match(html, /verängstigt \$value\$/);
		assert.match(html, /<td><code>persistent<\/code><\/td><td>anhaltender <small>\(Zusatz\)<\/small><\/td>/);
		assert.match(html, /<td><code>fortitude<\/code><\/td>/);
		assert.doesNotMatch(html, />Länge</);
	});

	test("damage with a qualifier, several parts", function() {
		assert.equal(f("[<v>trpgdamage[]]", {v: "2d6 fire plus 1d4 persistent bleed"}),
			"2W6 Feuerschaden plus 1W4 anhaltender Blutungsschaden");
	});
});

test.describe("en-GB", function() {
	test.before(function() {
		h.setLanguage(wiki, "en-GB");
	});

	test("damage with qualifiers, read from German", function() {
		assert.equal(f("[<v>trpgdamage[]]", {v: "2W6 Feuer plus 1W4 anhaltender Blutung"}),
			"2d6 fire damage plus 1d4 persistent bleed damage");
	});

	test("a bulk token next to dice tokens", function() {
		assert.equal(f("[<v>trpgdice[]]", {v: "L, 1W6"}), "L, 1d6");
	});

	test("units are no part of this system: a hint, the text unchanged", function() {
		var rules = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/rules.js"),
			r = rules.unit(wiki, "30 ft");
		assert.equal(r.text, "30 ft");
		assert.equal(r.problem, "Rules/Check/NoRules");
	});
});

test.describe("fields of the probe", function() {
	var fields;

	test.before(function() {
		fields = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/fields.js");
		h.setLanguage(wiki, "de-DE");
	});

	test("its own fields per type, a group of its own", function() {
		assert.equal(fields.forTypes(wiki, ["Creature"]).fields.join(), "level,traits,proficiency,ac,fortitude,reflex");
		assert.equal(fields.forTypes(wiki, ["Creature"]).groups[0].id, "defenses");
		assert.equal(fields.label(wiki, "fortitude"), "Zäh");
		assert.equal(fields.spec(wiki, "str"), null, "no field of the other ruleset");
	});

	test("proficiency by level, a formula of its own", function() {
		assert.equal(fields.read(wiki, {level: "5"}, "proficiency").text, "+7");
		assert.equal(fields.read(wiki, {level: "5", proficiency: "+9"}, "proficiency").text, "+9");
	});

	test("values in its domains: traits, a save, bulk", function() {
		assert.equal(fields.read(wiki, {traits: "magical, concentrate"}, "traits").text, "magisch, Konzentration");
		assert.equal(fields.read(wiki, {save: "reflex"}, "save").text, "Reflex");
		assert.equal(fields.read(wiki, {bulk: "L"}, "bulk").problem, null);
	});

	test("the header line of a spell", function() {
		var schema = fields.forTypes(wiki, ["Spell"]);
		assert.equal(fields.summary(wiki, {rank: "3"}, schema).text, "Zauber 3");
		h.setLanguage(wiki, "en-GB");
		assert.equal(fields.summary(wiki, {rank: "3"}, schema).text, "Spell 3");
	});
});
