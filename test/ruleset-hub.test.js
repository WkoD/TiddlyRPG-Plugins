/*
 * The hub "Ruleset" (Ruleset.tid, modules/rules.js table()): in the list of Information only with
 * an active ruleset; the name of the system; one table per domain of the ruleset with id and a
 * column per language, the display language marked; variants and phrases; units with pairs and
 * kinds; the domains of the campaign setting in a section of their own, calendar and currency
 * pointing to their hubs.
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

function hub() {
	return h.render(wiki, "text/html", "{{Ruleset}}").replace(/>\s+</g, "><");
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

test("a label domain: id, a column per language, variants", function() {
	var table = tableAfter(hub(), "Attribute");
	assert.match(table, /<th>Id<\/th><th class="trpg-rules-shown">Deutsch \(Deutschland\)<\/th><th>English \(British\)<\/th>/);
	assert.match(table, /<td><code>wis<\/code><\/td>/);
	assert.match(table, /<td class="trpg-rules-shown">WEI<br><small>name: Weisheit<\/small><br><small>save: WEI-Rettungswurf<\/small><\/td><td>WIS/);
});

test("the column of the display language follows the setting", function() {
	h.add(wiki, {title: "$:/config/tiddlyrpg/rules/ruleset/mode", text: "all"});
	h.add(wiki, {title: "$:/config/tiddlyrpg/rules/ruleset/language", text: "en-GB"});
	try {
		assert.match(tableAfter(hub(), "Attribute"), /<th>Deutsch \(Deutschland\)<\/th><th class="trpg-rules-shown">English \(British\)<\/th>/);
	} finally {
		wiki.deleteTiddler("$:/config/tiddlyrpg/rules/ruleset/mode");
		wiki.deleteTiddler("$:/config/tiddlyrpg/rules/ruleset/language");
	}
});

test("damage: name and phrase per language", function() {
	assert.match(tableAfter(hub(), "Schaden"), /<td class="trpg-rules-shown">Kälte<br><small>Kälteschaden<\/small><\/td><td>cold<br><small>cold damage<\/small><\/td>/);
});

test("units: labels, pairs and kinds", function() {
	var html = hub();
	assert.match(tableAfter(html, "Länge"), /<td><code>ft<\/code><\/td><td class="trpg-rules-shown">ft<\/td><td>ft<\/td>/);
	assert.match(html, /Umrechnung: 1 in = 2,5 cm, 1 ft = 0,3 m, 1 mi = 1,6 km/);
	assert.match(html, /Arten: range, travel/);
});

test("tokens: the token per language", function() {
	assert.match(tableAfter(hub(), "Würfel"), /<td><code>die<\/code><\/td><td class="trpg-rules-shown"><code>W<\/code><\/td><td><code>d<\/code><\/td>/);
});

test("the domains of the campaign setting in a section of their own, pointing to their hubs", function() {
	var html = hub(),
		section = html.slice(html.indexOf("Aus der Kampagnenwelt"));
	assert.ok(html.indexOf("Aus der Kampagnenwelt") > html.indexOf(">Gewicht</h3>"));
	assert.match(section, /Namen und ihre Sprache: siehe <a[^>]*href="#Calendar"[^>]*>Kalender<\/a>/);
	assert.match(section, /href="#Currency"[^>]*>Währung<\/a>/);
});
