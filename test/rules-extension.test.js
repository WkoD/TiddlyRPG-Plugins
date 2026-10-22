/*
 * Extensions of rules domains (modules/language.js domains(), modules/labels.js): a domain tiddler of
 * the wiki with "extends": true adds entries to a label domain of the ruleset - read, shown with
 * keys of the wiki, in the group and rules language of the base; the problems of extensions and of
 * the data of label domains (rule plugins/domains): no base, a base of another type, an id the
 * base has, a "for" to nowhere, a cycle.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki, rules, language, checks;

var TAG = "$:/tags/tiddlyrpg/RulesDomain";

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		rules = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/rules.js");
		language = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/language.js");
		checks = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/checks.js");
		h.setLanguage(wiki, "de-DE");
	});
});

function extension(title, data, fn) {
	h.add(wiki, {title: title, tags: TAG, type: "application/json", text: JSON.stringify(data)});
	try {
		return fn();
	} finally {
		wiki.deleteTiddler(title);
	}
}

function domainMessages() {
	var all = checks.all(wiki, "dm", ["plugins"]),
		out = [];
	Object.keys(all).forEach(function(title) {
		all[title].forEach(function(message) {
			if(message.id === "plugins/domains") {
				out.push({title: title, key: message.key});
			}
		});
	});
	return out;
}

test("an extension adds entries, keys from the wiki, in the group of the base", function() {
	h.add(wiki, {title: "$:/tiddlyrpg/language/de-DE/Rules/Category/tattoo", text: "Tätowierung"});
	try {
		extension("$:/tiddlyrpg/rules/domain/ItemCategory/Vandalia", {domain: "ItemCategory", extends: true, entries: [{id: "tattoo", for: ["potion"]}]}, function() {
			var domain = language.domains(wiki).ItemCategory;
			assert.ok(domain.entries.some(function(e) { return e.id === "tattoo"; }));
			assert.equal(domain.extensions.join(), "$:/tiddlyrpg/rules/domain/ItemCategory/Vandalia");
			assert.equal(domain.title, "$:/tiddlyrpg/rules/domain/ItemCategory", "the base keeps its title");
			assert.equal(language.domainGroup(wiki, "ItemCategory"), "ruleset");
			assert.equal(rules.value(wiki, {format: "labels", domain: "ItemCategory"}, "potion, tattoo").text, "Trank (Tätowierung)");
			assert.equal(rules.value(wiki, {format: "labels", domain: "ItemCategory"}, "potion, Tätowierung").problem, null, "read by its label too");
			assert.deepEqual(domainMessages(), []);
		});
	} finally {
		wiki.deleteTiddler("$:/tiddlyrpg/language/de-DE/Rules/Category/tattoo");
	}
	assert.ok(!language.domains(wiki).ItemCategory.entries.some(function(e) { return e.id === "tattoo"; }), "gone with its tiddler");
});

test("problems: no base, a base of another type, an id the base has", function() {
	extension("Ext Nowhere", {domain: "Nowhere", extends: true, entries: [{id: "x"}]}, function() {
		assert.deepEqual(domainMessages(), [{title: "Ext Nowhere", key: "Check/Plugins/ExtensionBase"}]);
	});
	extension("Ext Length", {domain: "Length", extends: true, entries: [{id: "x"}]}, function() {
		assert.deepEqual(domainMessages(), [{title: "Ext Length", key: "Check/Plugins/ExtensionType"}]);
	});
	extension("Ext Twice", {domain: "Rarity", extends: true, entries: [{id: "rare"}]}, function() {
		assert.deepEqual(domainMessages(), [{title: "Ext Twice", key: "Check/Plugins/ExtensionId"}]);
	});
});

test("problems of the data: a for to nowhere, a cycle", function() {
	extension("Ext Bad", {domain: "ItemCategory", extends: true, entries: [{id: "rune", for: ["scroll"]}, {id: "a", for: ["b"]}, {id: "b", for: ["a"]}]}, function() {
		var keys = domainMessages().map(function(m) { return m.key; }).sort();
		assert.deepEqual(keys, ["Check/Plugins/TraitCycle", "Check/Plugins/TraitCycle", "Check/Plugins/TraitFor"]);
	});
});
