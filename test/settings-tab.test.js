/*
 * The tab "TiddlyRPG" under ControlPanel -> Settings (ui/controlpanel-tiddlyrpg and its tabs): the
 * choice of ruleset and campaign setting with the active plugin marked, the hints on the config
 * and on an own calendar or currency; the tab "ruleset options" with the rules language of the
 * ruleset (two settings, the table of its domains: languages, "—" for a domain without kinds,
 * the system of unit domains, selects only per domain, examples), shown with a ruleset; the tab
 * "campaign setting options" with the rules language of the setting (shown in only) and the
 * order of dates, shown with a setting or an own calendar; the published copy with disabled
 * inputs; the version hints.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki;

var TAB = "$:/plugins/tiddlyrpg-core/ui/controlpanel-tiddlyrpg",
	STATE = "$:/state/tiddlyrpg/settings-tab",
	RULES_TAB = "$:/plugins/tiddlyrpg-core/ui/settings-ruleset-options",
	SETTING_TAB = "$:/plugins/tiddlyrpg-core/ui/settings-setting-options",
	RULESET_RULES = "$:/config/tiddlyrpg/rules/ruleset/",
	SETTING_RULES = "$:/config/tiddlyrpg/rules/setting/";

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

// Sets tiddlers ({title: text}), waits for the switch, runs fn, restores. Only a real tiddler is
// put back - a shadow (the calendar config of a setting) comes back with its plugin.
function withTiddlers(values, fn) {
	var before = {};
	Object.keys(values).forEach(function(title) {
		before[title] = wiki.tiddlerExists(title) ? wiki.getTiddler(title) : null;
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

	test("the click target is the whole row: the button is an option of the chooser", function() {
		assert.match(tab(), /<div class="tc-chooser-item tc-chosen"><button aria-selected="true" class="tc-btn-invisible" role="option">/);
		assert.match(h.render(wiki, "text/plain", "{{$:/plugins/tiddlyrpg-core/styles/rules}}"), /\.trpg-chooser \.tc-chooser-item > button \{\s*display: block;\s*width: 100%;/);
	});

	test("an own calendar or currency: a note that the setting does not change it", function() {
		assert.doesNotMatch(tab(), /eigenen Kalender|eigenes Geldsystem/, "the config of the setting is a shadow");
		return withTiddlers({"$:/config/tiddlyrpg/calendar": "Own Calendar", "$:/config/tiddlyrpg/currency": "Own Coins"}, function() {
			var html = tab();
			assert.match(html, /Das Wiki hat einen eigenen Kalender \(Own Calendar\)\. Ein Wechsel der Kampagnenwelt ändert ihn nicht\./);
			assert.match(html, /Das Wiki hat ein eigenes Geldsystem \(Own Coins\)\. Ein Wechsel der Kampagnenwelt ändert es nicht\./);
		});
	});

	test("an own calendar wins over the one of the setting, also after a switch", function() {
		return withTiddlers({"$:/config/tiddlyrpg/calendar": "Own Calendar"}, function() {
			assert.equal(wiki.getTiddlerText("$:/config/tiddlyrpg/calendar"), "Own Calendar");
			h.add(wiki, {title: "$:/config/tiddlyrpg/setting", text: "$:/plugins/fixture-setting-krynn"});
			return settle().then(function() {
				assert.equal(wiki.getTiddlerText("$:/config/tiddlyrpg/calendar"), "Own Calendar");
			}).finally(function() {
				wiki.deleteTiddler("$:/config/tiddlyrpg/setting");
				return settle();
			});
		});
	});
});

test.describe("ruleset options", function() {
	test("the language shown with its modes and the languages with keys; nothing about writing", function() {
		var html = tab(RULES_TAB);
		assert.match(html, />Regelwerk Einstellungen</);
		assert.match(html, />Sprache<\/h2>[^]*<strong>Angezeigt in<\/strong>/);
		assert.doesNotMatch(html, /Geschrieben in/);
		assert.equal((html.match(/type="radio"/g) || []).length, 3, "three modes");
		assert.equal((html.match(/pro Bereich \(in der Tabelle\)/g) || []).length, 1);
		assert.match(html, /<option value="de-DE">/);
		assert.match(html, /<option value="en-GB">/);
		assert.doesNotMatch(html, /<option value="fr-FR">/);
	});

	test("a link to the hub Ruleset above the language", function() {
		assert.match(tab(RULES_TAB), /Alle Begriffe: <a[^>]*href="#Ruleset"[^>]*>Regelwerk<\/a>[^]*>Sprache<\/h2>/);
	});

	test("the table of the domains of the ruleset only: names, languages, examples", function() {
		var html = tab(RULES_TAB).replace(/>\s+</g, "><");
		assert.match(html, /<tr><th>Bereich<\/th><th>Angezeigt in<\/th><th>Beispiel<\/th><\/tr>/);
		assert.match(html, /<td>Länge<\/td><td>Deutsch[^<]*<span class="trpg-rules-system"> \(metrisch\)<\/span><\/td><td>228 cm → 228 cm<\/td>/);
		assert.match(html, /<td>Würfel<\/td><td>Deutsch[^<]*<\/td><td>4d6 → 4W6<\/td>/);
		assert.match(html, /<td>Begriffe<\/td><td>[^<]*<\/td><td>ac → RK<\/td>/);
		assert.doesNotMatch(html, /<td>Kalender<\/td>|<td>Währung<\/td>/);
	});

	test("the examples follow the setting of the ruleset", function() {
		var values = {};
		values[RULESET_RULES + "mode"] = "all";
		values[RULESET_RULES + "language"] = "en-GB";
		return withTiddlers(values, function() {
			var html = tab(RULES_TAB);
			assert.match(html, /228 cm → 7 ft 7 in/);
			assert.match(html, /1d8 cold → 1d8 cold damage/);
			assert.match(tab(SETTING_TAB), /1351-01-31 → Mittwinter 1351/, "the setting keeps its own");
		});
	});

	test("unit domains name their system: weight imperial, length metric per domain", function() {
		var values = {};
		values[RULESET_RULES + "mode"] = "domain";
		values[RULESET_RULES + "domain/Weight"] = "en-GB";
		return withTiddlers(values, function() {
			var html = tab(RULES_TAB).replace(/>\s+</g, "><");
			assert.match(html, /<td>Gewicht<\/td><td><select[^]*?<\/select><span class="trpg-rules-system"> \(imperial\)<\/span><\/td>/);
			assert.match(html, /<td>Länge<\/td><td><select[^]*?<\/select><span class="trpg-rules-system"> \(metrisch\)<\/span><\/td>/);
			assert.doesNotMatch(html, /<td>Würfel<\/td>[^]*?trpg-rules-system[^]*?<td>Länge/, "no system for other domains");
			assert.equal(h.render(wiki, "text/plain", "<<unit \"10 kg\">> <<unit \"30 ft\">>"), "20 lb 9 m");
		});
	});

	test("selects in the table only in the mode per domain", function() {
		assert.doesNotMatch(tab(RULES_TAB).replace(/>\s+</g, "><"), /<td><select/);
		var values = {};
		values[RULESET_RULES + "mode"] = "domain";
		return withTiddlers(values, function() {
			var html = tab(RULES_TAB);
			assert.equal((html.replace(/>\s+</g, "><").match(/<td><select/g) || []).length, 14, "one per domain of the ruleset in the column shown in");
		});
	});

	test("shown only with a ruleset", function() {
		assert.match(tab(), />Regelwerk Einstellungen</);
		return withTiddlers({"$:/config/tiddlyrpg/ruleset": "none"}, function() {
			assert.doesNotMatch(tab(), />Regelwerk Einstellungen</);
			assert.match(tab(), />Kampagnenwelt Einstellungen</);
		});
	});
});

test.describe("campaign setting options", function() {
	test("the language of the setting, its domains", function() {
		var html = tab(SETTING_TAB).replace(/>\s+</g, "><");
		assert.match(html, />Kampagnenwelt Einstellungen</);
		assert.equal((html.match(/pro Bereich \(in der Tabelle\)/g) || []).length, 1);
		assert.match(html, /<td>Kalender<\/td><td>Deutsch[^<]*<\/td><td>1351-01-31 → Mittwinter 1351<\/td>/);
		assert.match(html, /<td>Währung<\/td>/);
		assert.doesNotMatch(html, /<td>Länge<\/td>/);
	});

	test("a link to the hub CampaignSetting above the language, only with a setting", function() {
		assert.match(tab(SETTING_TAB), /Alle Namen: <a[^>]*href="#CampaignSetting"[^>]*>Kampagnenwelt<\/a>[^]*>Sprache<\/h2>/);
		return withTiddlers({"$:/config/tiddlyrpg/setting": "none", "$:/config/tiddlyrpg/calendar": "Own"}, function() {
			var html = tab(SETTING_TAB);
			assert.match(html, />Sprache<\/h2>/);
			assert.doesNotMatch(html, /href="#CampaignSetting"/);
		});
	});

	test("its own settings: the names of the calendar in English, the ruleset untouched", function() {
		var values = {};
		values[SETTING_RULES + "mode"] = "all";
		values[SETTING_RULES + "language"] = "en-GB";
		return withTiddlers(values, function() {
			assert.match(tab(SETTING_TAB), /1351-01-31 → Midwinter 1351/);
			assert.match(tab(RULES_TAB), /1d8 cold → 1W8 Kälteschaden/);
		});
	});

	test("the order of day and month with an example in the calendar of the wiki", function() {
		var html = tab(SETTING_TAB);
		assert.match(html, />Datum</);
		assert.match(html, /Beispiel: 5\. Hammer 1351 DR · 5\. – 24\. Hammer 1351 DR/);
		return withTiddlers({"$:/config/tiddlyrpg/date/order": "md"}, function() {
			assert.match(tab(SETTING_TAB), /Beispiel: Hammer 5, 1351 DR · Hammer 5 – 24, 1351 DR · Hammer 5 – Ches 24, 1351 DR/);
		});
	});

	test("shown with a setting or an own calendar, not without both", function() {
		return withTiddlers({"$:/config/tiddlyrpg/setting": "none"}, function() {
			assert.doesNotMatch(tab(), />Kampagnenwelt Einstellungen</);
		}).then(function() {
			return withTiddlers({"$:/config/tiddlyrpg/ruleset": "none", "$:/config/tiddlyrpg/setting": "none", "$:/config/tiddlyrpg/calendar": "Own"}, function() {
				var html = tab();
				assert.match(html, />Kampagnenwelt Einstellungen</);
				assert.doesNotMatch(html, />Regelwerk Einstellungen</);
			});
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
			assert.match(tab(SETTING_TAB), /<input[^>]*type="radio"[^>]*disabled|<input[^>]*disabled[^>]*type="radio"/);
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
