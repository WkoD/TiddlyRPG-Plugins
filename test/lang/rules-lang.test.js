/*
 * The rules language (modules/language.js, filters/rules.js) with the calendar of the fixture
 * setting as domain: the language shown in its three modes; values kept when the mode changes;
 * the fallback to en-GB; names follow the domain
 * while the texts of the calendar stay in the wiki language; an own calendar without domain
 * tiddler; the groups ruleset and setting, each with settings of its own; the languages with
 * keys. The wiki language is de-DE. The calendar belongs to the group setting, so its settings
 * are $:/config/tiddlyrpg/rules/setting/...
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("../helpers");

var $tw, wiki, language;

var RULES = "$:/config/tiddlyrpg/rules/setting/";

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		language = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/language.js");
		h.setLanguage(wiki, "de-DE");
	});
});

function f(text) {
	return h.filter(wiki, text).join(" ");
}

// Sets config tiddlers ($:/config/tiddlyrpg/rules/<key>: text), runs fn, deletes them again
function withRules(values, fn) {
	Object.keys(values).forEach(function(key) {
		wiki.addTiddler(new $tw.Tiddler({title: RULES + key, text: values[key]}));
	});
	try {
		return fn();
	} finally {
		Object.keys(values).forEach(function(key) {
			wiki.deleteTiddler(RULES + key);
		});
	}
}

test.describe("modes", function() {
	test("wiki (default): the wiki language", function() {
		assert.equal(f("[trpgruleslang[Calendar]]"), "de-DE");
		withRules({"mode": "wiki", "language": "en-GB"}, function() {
			assert.equal(f("[trpgruleslang[Calendar]]"), "de-DE");
		});
	});

	test("all: one language for every domain", function() {
		withRules({"mode": "all", "language": "en-GB"}, function() {
			assert.equal(f("[trpgruleslang[Calendar]]"), "en-GB");
			assert.equal(f("[trpgruleslang[Gravity]]"), "en-GB", "also an unregistered domain");
		});
	});

	test("all without language: the wiki language", function() {
		withRules({"mode": "all"}, function() {
			assert.equal(f("[trpgruleslang[Calendar]]"), "de-DE");
		});
	});

	test("domain: per domain, empty for the wiki language", function() {
		withRules({"mode": "domain", "domain/Calendar": "en-GB"}, function() {
			assert.equal(f("[trpgruleslang[Calendar]]"), "en-GB");
		});
		withRules({"mode": "domain", "domain/Calendar": ""}, function() {
			assert.equal(f("[trpgruleslang[Calendar]]"), "de-DE");
		});
	});

	test("domain: an unregistered domain gets the wiki language", function() {
		withRules({"mode": "domain", "domain/Gravity": "en-GB"}, function() {
			assert.equal(f("[trpgruleslang[Gravity]]"), "de-DE");
		});
	});

	test("values of the other modes stay when the mode changes", function() {
		withRules({"mode": "all", "language": "en-GB", "domain/Calendar": "de-DE"}, function() {
			assert.equal(f("[trpgruleslang[Calendar]]"), "en-GB");
			wiki.addTiddler(new $tw.Tiddler({title: RULES + "mode", text: "domain"}));
			assert.equal(f("[trpgruleslang[Calendar]]"), "de-DE");
			assert.equal(wiki.getTiddlerText(RULES + "language"), "en-GB");
			wiki.addTiddler(new $tw.Tiddler({title: RULES + "mode", text: "all"}));
			assert.equal(f("[trpgruleslang[Calendar]]"), "en-GB");
		});
	});
});

test.describe("the calendar as domain", function() {
	test("the domain is registered by the active setting", function() {
		var domain = language.domains(wiki).Calendar;
		assert.equal(domain && domain.type, "calendar");
		assert.equal(domain && domain.keys, "Calendar/");
	});

	test("names follow the display language of the domain", function() {
		assert.equal(f("[[1351-01-31]dateformat[]]"), "Mittwinter 1351");
		withRules({"mode": "all", "language": "en-GB"}, function() {
			assert.equal(f("[[1351-01-31]dateformat[]]"), "Midwinter 1351");
			assert.equal(f("[calendar[title]]"), "Calendar of Harptos");
		});
		assert.equal(f("[calendar[title]]"), "Kalender von Harptos");
	});

	test("the texts of the calendar stay in the wiki language", function() {
		withRules({"mode": "all", "language": "en-GB"}, function() {
			var body = h.body(wiki, "Calendar");
			assert.match(body, /Rechner/);
			assert.match(body, /Calendar of Harptos/);
			assert.match(body, /Deepwinter/);
		});
	});

	test("a missing key falls back to en-GB", function() {
		// Month names exist only in en-GB (names.multids)
		withRules({"mode": "all", "language": "fr-FR"}, function() {
			assert.equal(f("[[1351-07-05]dateformat[]]"), "5. Flamerule 1351");
			assert.equal(f("[[1351-01-31]dateformat[]]"), "Midwinter 1351");
		});
	});

	test("the display renders anew when the setting changes", function() {
		var container = $tw.fakeDocument.createElement("div"),
			widget = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", "<$text text={{{ [[1351-01-31]dateformat[]] }}}/>", {parseAsInline: true}), {document: $tw.fakeDocument});
		widget.render(container, null);
		assert.equal(container.textContent, "Mittwinter 1351");
		var changes = {};
		changes[RULES + "mode"] = {modified: true};
		changes[RULES + "language"] = {modified: true};
		withRules({"mode": "all", "language": "en-GB"}, function() {
			widget.refresh(changes);
			assert.equal(container.textContent, "Midwinter 1351");
		});
	});
});

test.describe("an own calendar without setting", function() {
	var SETTING = "$:/config/tiddlyrpg/setting";

	function settle() {
		return new Promise(function(resolve) {
			setTimeout(resolve, 0);
		});
	}

	test.before(function() {
		wiki.addTiddler(new $tw.Tiddler({title: SETTING, text: "none"}));
		h.add(wiki, {title: "Own Calendar", type: "application/json", text: JSON.stringify({id: "Own", months: [{id: "One", days: 30, festivals: [{id: "Feast"}]}, {id: "Two", days: 30}]})});
		h.add(wiki, {title: "$:/config/tiddlyrpg/calendar", text: "Own Calendar"});
		h.add(wiki, {title: "$:/tiddlyrpg/language/de-DE/Calendar/Own/Festival/Feast", text: "Fest"});
		h.add(wiki, {title: "$:/tiddlyrpg/language/en-GB/Calendar/Own/Festival/Feast", text: "Feast"});
		return settle();
	});

	test.after(function() {
		["Own Calendar", "$:/config/tiddlyrpg/calendar", "$:/tiddlyrpg/language/de-DE/Calendar/Own/Festival/Feast",
			"$:/tiddlyrpg/language/en-GB/Calendar/Own/Festival/Feast", SETTING].forEach(function(title) {
			wiki.deleteTiddler(title);
		});
		return settle();
	});

	test("no domain is registered, the names follow the wiki language", function() {
		assert.equal(language.domains(wiki).Calendar, undefined);
		assert.equal(f("[[0001-01-31]dateformat[]]"), "Fest 1");
	});

	test("the mode all applies to it", function() {
		withRules({"mode": "all", "language": "en-GB"}, function() {
			assert.equal(f("[[0001-01-31]dateformat[]]"), "Feast 1");
		});
	});

	test("in the mode domain it keeps the wiki language", function() {
		withRules({"mode": "domain", "domain/Calendar": "en-GB"}, function() {
			assert.equal(f("[[0001-01-31]dateformat[]]"), "Fest 1");
		});
	});
});

test.describe("ruleset and setting set apart", function() {
	var CONFIG = "$:/config/tiddlyrpg/rules/";

	function withConfig(values, fn) {
		Object.keys(values).forEach(function(key) {
			wiki.addTiddler(new $tw.Tiddler({title: CONFIG + key, text: values[key]}));
		});
		try {
			return fn();
		} finally {
			Object.keys(values).forEach(function(key) {
				wiki.deleteTiddler(CONFIG + key);
			});
		}
	}

	test("the group of a domain: the type of its plugin", function() {
		assert.equal(f("[[Ability]trpgrulesgroup[]]"), "ruleset");
		assert.equal(f("[[Length]trpgrulesgroup[]]"), "ruleset");
		assert.equal(f("[[Calendar]trpgrulesgroup[]]"), "setting");
		assert.equal(f("[[Currency]trpgrulesgroup[]]"), "setting");
		assert.equal(f("[[Gravity]trpgrulesgroup[]]"), "setting", "a domain without domain tiddler");
		assert.equal(f("[trpgrulesdomains[setting]]"), "Calendar Currency");
		assert.match(f("[trpgrulesdomains[ruleset]]"), /^Ability Challenge Damage Dice ItemCategory Length Rarity Sense Size Skill Terms Time Volume Weight$/);
	});

	test("a domain tiddler of the wiki: calendar and currency to the setting, the rest to the ruleset", function() {
		h.add(wiki, {title: "Own Domain Gravity", tags: "$:/tags/tiddlyrpg/RulesDomain", type: "application/json", text: JSON.stringify({domain: "Gravity", type: "unit", units: {}})});
		try {
			assert.equal(f("[[Gravity]trpgrulesgroup[]]"), "ruleset");
		} finally {
			wiki.deleteTiddler("Own Domain Gravity");
		}
	});

	test("the setting of one group leaves the other alone", function() {
		withConfig({"ruleset/mode": "all", "ruleset/language": "en-GB"}, function() {
			assert.equal(f("[trpgruleslang[Damage]]"), "en-GB");
			assert.equal(f("[trpgruleslang[Calendar]]"), "de-DE");
			assert.equal(f("[[1351-01-31]dateformat[]]"), "Mittwinter 1351");
		});
		withConfig({"setting/mode": "all", "setting/language": "en-GB"}, function() {
			assert.equal(f("[trpgruleslang[Damage]]"), "de-DE");
			assert.equal(f("[trpgruleslang[Calendar]]"), "en-GB");
		});
	});
});

test.describe("languages with keys", function() {
	test("all languages of the language packs", function() {
		assert.equal(f("[trpgruleslangs[]]"), "de-DE en-GB");
	});

	test("the languages of a domain come from its key prefix", function() {
		assert.equal(f("[trpgruleslangs[Calendar]]"), "de-DE en-GB");
		h.add(wiki, {title: "$:/tiddlyrpg/language/fr-FR/Title/Location", text: "Lieu"});
		try {
			assert.equal(f("[trpgruleslangs[]]"), "de-DE en-GB fr-FR");
			assert.equal(f("[trpgruleslangs[Calendar]]"), "de-DE en-GB");
		} finally {
			wiki.deleteTiddler("$:/tiddlyrpg/language/fr-FR/Title/Location");
		}
	});
});
