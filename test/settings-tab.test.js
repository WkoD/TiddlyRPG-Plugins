/*
 * The tab "TiddlyRPG" under ControlPanel -> Settings (ui/controlpanel-tiddlyrpg and its tabs): the
 * choice of ruleset and campaign setting with the active plugin marked, the hints on the config;
 * the tab "rules language" with its two settings, the table of the domains (languages, "—" for a
 * domain without kinds, selects only per domain, examples), shown only with domains or an own
 * calendar; the published copy with disabled inputs; the version hints.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki;

var TAB = "$:/plugins/tiddlyrpg-core/ui/controlpanel-tiddlyrpg",
	STATE = "$:/state/tiddlyrpg/settings-tab",
	RULES_TAB = "$:/plugins/tiddlyrpg-core/ui/settings-rules";

function settle() {
	return new Promise(function(resolve) {
		setTimeout(resolve, 0);
	});
}

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		h.setLanguage(wiki, "de-DE");
	});
});

function tab(state) {
	if(state) {
		h.add(wiki, {title: STATE, text: state});
	} else {
		wiki.deleteTiddler(STATE);
	}
	return h.render(wiki, "text/html", "{{" + TAB + "}}");
}

// Sets tiddlers ({title: text}), waits for the switch, runs fn, restores
function withTiddlers(values, fn) {
	var before = {};
	Object.keys(values).forEach(function(title) {
		before[title] = wiki.getTiddler(title);
		h.add(wiki, {title: title, text: values[title]});
	});
	var restore = function() {
		Object.keys(values).forEach(function(title) {
			if(before[title]) {
				wiki.addTiddler(before[title]);
			} else {
				wiki.deleteTiddler(title);
			}
		});
		return settle();
	};
	return settle().then(fn).then(restore, function(error) {
		return restore().then(function() { throw error; });
	});
}

test("the tab TiddlyRPG under ControlPanel -> Settings", function() {
	var html = h.render(wiki, "text/html", "{{$:/core/ui/ControlPanel/Settings}}");
	assert.match(html, />TiddlyRPG</);
});

test.describe("ruleset and campaign setting", function() {
	test("both types with their plugins and none, the active one chosen", function() {
		var html = tab();
		assert.match(html, />Regelwerk und Kampagnenwelt</);
		assert.match(html, /tc-chosen[^]*?fixture-ruleset-5e-mini/);
		assert.match(html, /fixture-ruleset-probe/);
		assert.match(html, /fixture-setting-harptos/);
		assert.equal((html.match(/>keins</g) || []).length, 2);
	});

	test("two of a type installed and none chosen: a hint", function() {
		assert.match(tab(), /Mehrere sind installiert und keins ist gewählt – aktiv ist das erste nach Titel, \$:\/plugins\/fixture-ruleset-5e-mini\./);
	});

	test("the chosen plugin is marked; none is marked chosen for none", function() {
		return withTiddlers({"$:/config/tiddlyrpg/ruleset": "$:/plugins/fixture-ruleset-probe", "$:/config/tiddlyrpg/setting": "none"}, function() {
			var html = tab();
			assert.match(html, /tc-chooser-item tc-chosen"><button[^>]*>[^]*?fixture-ruleset-probe/);
			assert.match(html, /tc-chooser-item tc-chosen"><button[^>]*><strong>keins<\/strong>/);
			assert.doesNotMatch(html, /Mehrere sind installiert/);
		});
	});

	test("a config naming a plugin that is not installed: a hint", function() {
		return withTiddlers({"$:/config/tiddlyrpg/setting": "$:/plugins/missing"}, function() {
			assert.match(tab(), /Festgelegt ist \$:\/plugins\/missing, das ist nicht installiert – aktiv ist \$:\/plugins\/fixture-setting-harptos\./);
		});
	});
});

test.describe("rules language", function() {
	test("the two settings with their modes and the languages with keys", function() {
		var html = tab(RULES_TAB);
		assert.match(html, /Geschrieben in[^]*Angezeigt in/);
		assert.equal((html.match(/type="radio"/g) || []).length, 6, "three modes per setting");
		assert.equal((html.match(/pro Bereich \(in der Tabelle\)/g) || []).length, 2);
		assert.match(html, /<option value="de-DE">/);
		assert.match(html, /<option value="en-GB">/);
		assert.doesNotMatch(html, /<option value="fr-FR">/);
	});

	test("the table of the domains: names, languages, examples, — without kinds", function() {
		var html = tab(RULES_TAB).replace(/>\s+</g, "><");
		assert.match(html, /<td>Länge<\/td><td>Deutsch[^<]*<\/td><td>Deutsch[^<]*<\/td><td>228 cm → 228 cm<\/td>/);
		assert.match(html, /<td>Würfel<\/td><td>—<\/td>/);
		assert.match(html, /<td>Kalender<\/td><td>—<\/td><td>[^<]*<\/td><td>1351-01-31 → Mittwinter 1351<\/td>/);
		assert.match(html, /<td>Begriffe<\/td><td>—<\/td><td>[^<]*<\/td><td>ac → RK<\/td>/);
	});

	test("the examples follow the setting", function() {
		return withTiddlers({"$:/config/tiddlyrpg/rules/display/mode": "all", "$:/config/tiddlyrpg/rules/display/language": "en-GB"}, function() {
			var html = tab(RULES_TAB);
			assert.match(html, /228 cm → 7 ft 7 in/);
			assert.match(html, /1d8 cold → 1d8 cold damage/);
		});
	});

	test("selects in the table only in the mode per domain", function() {
		assert.doesNotMatch(tab(RULES_TAB), /\$:\/config\/tiddlyrpg\/rules\/display\/domain/);
		return withTiddlers({"$:/config/tiddlyrpg/rules/display/mode": "domain"}, function() {
			var html = tab(RULES_TAB);
			assert.equal((html.replace(/>\s+</g, "><").match(/<td><select/g) || []).length, 8, "one per domain (8, the currency of the setting included) in the column shown in");
		});
	});

	test("not shown without domains and without calendar", function() {
		assert.match(tab(), />Regelsprache</);
		return withTiddlers({"$:/config/tiddlyrpg/ruleset": "none", "$:/config/tiddlyrpg/setting": "none"}, function() {
			assert.doesNotMatch(tab(), />Regelsprache</);
		});
	});

	test("an own calendar without setting is enough", function() {
		return withTiddlers({"$:/config/tiddlyrpg/ruleset": "none", "$:/config/tiddlyrpg/setting": "none", "$:/config/tiddlyrpg/calendar": "Own"}, function() {
			assert.match(tab(), />Regelsprache</);
		});
	});
});

test.describe("published copy and versions", function() {
	test("in the published copy the inputs are disabled", function() {
		h.add(wiki, {title: "$:/status/IsReadOnly", text: "yes"});
		try {
			assert.match(tab(), /<button[^>]*disabled/);
			assert.match(tab(RULES_TAB), /<input[^>]*type="radio"[^>]*disabled|<input[^>]*disabled[^>]*type="radio"/);
			assert.match(tab(RULES_TAB), /<select[^>]*disabled/);
		} finally {
			wiki.deleteTiddler("$:/status/IsReadOnly");
		}
	});

	test("a plugin that needs a newer core: a hint on top", function() {
		h.add(wiki, {title: "$:/plugins/test-needs", type: "application/json", "plugin-type": "plugin", text: "{\"tiddlers\":{}}", "tiddlyrpg-core-version": ">=9.0.0"});
		try {
			assert.match(tab(), /\$:\/plugins\/test-needs braucht tiddlyrpg-core &gt;=9\.0\.0, dieses Wiki hat \d+\.\d+\.\d+/);
		} finally {
			wiki.deleteTiddler("$:/plugins/test-needs");
		}
	});
});
