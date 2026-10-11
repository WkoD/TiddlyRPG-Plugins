/*
 * The hubs "Ruleset" (Ruleset.tid) and "CampaignSetting" (CampaignSetting.tid), both through
 * modules/rules.js table(): in the list of Information only with an active ruleset or campaign
 * setting, each on its own; the name of the system or setting; one table per domain of its group
 * with id and the column of the display language only; variants and phrases; units with pairs
 * and kinds; calendar and currency pointing to their hubs.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki;

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
		return settle();
	});
});

function hub(title) {
	return h.render(wiki, "text/html", "{{" + (title || "Ruleset") + "}}").replace(/>\s+</g, "><");
}

// The HTML of the table that follows a heading
function tableAfter(html, heading) {
	var at = html.indexOf(">" + heading + "</h3>");
	assert.ok(at !== -1, heading);
	return html.slice(at, html.indexOf("</table>", at) + 8);
}

test("in the list of Information with the active ruleset, its name on top", function() {
	assert.match(h.body(wiki, "Information"), /Regelwerk/);
	assert.match(hub(), /<h2[^>]*>Fixture 5e mini<\/h2>/);
});

test("not listed without ruleset, even with a campaign setting", function() {
	h.add(wiki, {title: "$:/config/tiddlyrpg/ruleset", text: "none"});
	return settle().then(function() {
		assert.doesNotMatch(h.body(wiki, "Information"), /Regelwerk/);
		assert.match(h.body(wiki, "Information"), /Kalender/);
		assert.match(hub(), /Kein Regelwerk ist aktiv/);
	}).finally(function() {
		wiki.deleteTiddler("$:/config/tiddlyrpg/ruleset");
		return settle();
	});
});

test("a label domain: id and the display language only, variants", function() {
	var table = tableAfter(hub(), "Attribute");
	assert.match(table, /<tr><th>Id<\/th><th>Deutsch \(Deutschland\)<\/th><\/tr>/);
	assert.match(table, /<td><code>wis<\/code><\/td><td>WEI<br><small>name: Weisheit<\/small><br><small>save: WEI-Rettungswurf<\/small><\/td><\/tr>/);
	assert.doesNotMatch(table, /English|WIS/);
});

test("the column follows the setting: English for all", function() {
	h.add(wiki, {title: "$:/config/tiddlyrpg/rules/ruleset/mode", text: "all"});
	h.add(wiki, {title: "$:/config/tiddlyrpg/rules/ruleset/language", text: "en-GB"});
	try {
		var table = tableAfter(hub(), "Attribute");
		assert.match(table, /<tr><th>Id<\/th><th>English \(British\)<\/th><\/tr>/);
		assert.match(table, /<td><code>wis<\/code><\/td><td>WIS<br>/);
		assert.doesNotMatch(table, /Deutsch|WEI/);
	} finally {
		wiki.deleteTiddler("$:/config/tiddlyrpg/rules/ruleset/mode");
		wiki.deleteTiddler("$:/config/tiddlyrpg/rules/ruleset/language");
	}
});

test("damage: name and phrase per language", function() {
	assert.match(tableAfter(hub(), "Schaden"), /<td>Kälte<br><small>Kälteschaden<\/small><\/td><\/tr>/);
});

test("units: labels, pairs and kinds", function() {
	var html = hub();
	assert.match(tableAfter(html, "Länge"), /<td><code>ft<\/code><\/td><td>ft<\/td><\/tr>/);
	assert.match(html, /Umrechnung: 1 in = 2,5 cm, 1 ft = 0,3 m, 1 mi = 1,6 km/);
	assert.match(html, /Arten: range, distance, size/);
});

test("tokens: the token per language", function() {
	assert.match(tableAfter(hub(), "Würfel"), /<td><code>die<\/code><\/td><td><code>W<\/code><\/td><\/tr>/);
});

test("no domain of the campaign setting in the hub Ruleset", function() {
	var html = hub();
	assert.doesNotMatch(html, />Kalender<\/h3>/);
	assert.doesNotMatch(html, /href="#Currency"/);
});

test.describe("the hub CampaignSetting", function() {
	test("in the list of Information with the setting, its name on top, calendar and currency pointing to their hubs", function() {
		assert.match(h.body(wiki, "Information"), /Kampagnenwelt/);
		var html = hub("CampaignSetting");
		assert.match(html, /<h2[^>]*>Fixture Harptos<\/h2>/);
		assert.match(html, /Die Namen der Kampagnenwelt/);
		assert.match(html, /<h3[^>]*>Kalender<\/h3>(<p>)+Namen und ihre Sprache: siehe <a[^>]*href="#Calendar"[^>]*>Kalender<\/a>/);
		assert.match(html, /href="#Currency"[^>]*>Währung<\/a>/);
		assert.doesNotMatch(html, />Länge<\/h3>/);
	});

	test("without setting: not listed, the hub Ruleset still is", function() {
		h.add(wiki, {title: "$:/config/tiddlyrpg/setting", text: "none"});
		return settle().then(function() {
			var information = h.body(wiki, "Information");
			assert.doesNotMatch(information, /Kampagnenwelt/);
			assert.match(information, /Regelwerk/);
			assert.match(hub("CampaignSetting"), /Keine Kampagnenwelt ist aktiv/);
			assert.match(hub(), /<h2[^>]*>Fixture 5e mini<\/h2>/);
		}).finally(function() {
			wiki.deleteTiddler("$:/config/tiddlyrpg/setting");
			return settle();
		});
	});

	test("without ruleset: still listed with its domains", function() {
		h.add(wiki, {title: "$:/config/tiddlyrpg/ruleset", text: "none"});
		return settle().then(function() {
			assert.match(h.body(wiki, "Information"), /Kampagnenwelt/);
			assert.match(hub("CampaignSetting"), /<h3[^>]*>Währung<\/h3>/);
		}).finally(function() {
			wiki.deleteTiddler("$:/config/tiddlyrpg/ruleset");
			return settle();
		});
	});
});
