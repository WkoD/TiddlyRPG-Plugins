/*
 * Hub and index tiddlers (Location, Campaign, Index, Information, Player, Calendar, ...), the
 * type colour cascade and the wikitext hygiene of all hubs. The event head: sections.test.js.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var wiki;

test.before(function() {
	return h.boot().then(function($tw) {
		wiki = $tw.wiki;
	});
});

test.describe("de-DE", function() {
	test.before(function() {
		h.setLanguage(wiki, "de-DE");
	});

	test("hub heading translated", function() {
		assert.match(h.view(wiki, "Location"), /<h2 class="tc-title">\s*Ort\s*<\/h2>/);
	});

	test("Campaign hub heading translated", function() {
		assert.match(h.view(wiki, "Campaign"), /<h2 class="tc-title">\s*Kampagne\s*<\/h2>/);
	});

	test("Campaign hub: events shown once (no event list of its own)", function() {
		assert.equal((h.view(wiki, "Campaign").match(/>Zeitstrahl</g) || []).length, 1);
	});

	test("type colour: Event wins over Campaign whatever the tag order", function() {
		assert.equal(colour("Der dunkle Turm"), "#48a4ff");
	});

	test("type colour: other types unchanged", function() {
		assert.equal(colour("Grum"), "#00a600");
	});

	test("calendar hub: calculator written out", function() {
		h.add(wiki, {title: "$:/temp/dndwiki/calendar", calc_date: "1351-07-30", calc_day: "1"});
		try {
			assert.ok(h.body(wiki, "Calendar").indexOf("Mittsommer (07/08)") !== -1);
		} finally {
			wiki.deleteTiddler("$:/temp/dndwiki/calendar");
		}
	});

	test("index: six types in German order plus open items", function() {
		var index = h.body(wiki, "Index"),
			order = ["Gegenstände", "Götter", "Informationen", "Organisationen", "Orte", "Personen", "Offene Punkte"].map(function(s) { return index.indexOf(s); });
		assert.ok(order.every(function(p, i) { return p !== -1 && (i === 0 || p > order[i - 1]); }), index);
	});

	// Pragmas must not leak as text (a lost backslash turns \define into visible text)
	["Index", "Information", "Player", "Calendar", "Item", "Event", "TBC", "Campaign", "Location"].forEach(function(title) {
		test("no pragma text in " + title, function() {
			assert.doesNotMatch(h.body(wiki, title), /(^|\n)\s*(define|procedure|function|whitespace|import) /);
		});
	});

	test("information lists Kalender and Spielerstufe", function() {
		var information = h.body(wiki, "Information");
		assert.ok(information.indexOf("Kalender") !== -1 && information.indexOf("Spielerstufe") !== -1, information);
	});

	test("player hub: level", function() {
		var player = h.body(wiki, "Player");
		assert.ok(player.indexOf("Spielerstufe") !== -1 && player.indexOf("100000 EXP") !== -1, player);
	});

	test("calendar hub: name, epithet, leap festival", function() {
		var calendarHub = h.body(wiki, "Calendar");
		assert.ok(calendarHub.indexOf("Kalender von Harptos") !== -1 &&
			calendarHub.indexOf("Tiefwinter") !== -1 && calendarHub.indexOf("Schildtreff (alle 4 Jahre)") !== -1, calendarHub);
	});

	test("campaign hub: open tasks, no current date", function() {
		var campaign = h.body(wiki, "Campaign");
		assert.ok(campaign.indexOf("Offene Aufgaben") !== -1 && campaign.indexOf("Aktuelles Datum") === -1);
	});

	["Location", "Insel Avalon", "Index", "Player", "Calendar", "Grum", "Der dunkle Turm", "TBC", "Item", "Event"].forEach(function(title) {
		test("no raw <<dnd. in " + title, function() {
			var html = h.view(wiki, title);
			assert.ok(html.indexOf("&lt;&lt;dnd.") === -1 && html.indexOf("<<dnd.") === -1);
		});
	});
});

test.describe("en-GB", function() {
	test.before(function() {
		h.setLanguage(wiki, "en-GB");
	});

	test("en index", function() {
		var index = h.body(wiki, "Index");
		assert.ok(index.indexOf("Deities") !== -1 && index.indexOf("Open Items") !== -1, index);
	});

	test("en hub heading uses the default template", function() {
		assert.match(h.view(wiki, "Location"), /<h2 class="tc-title">\s*Location\s*<\/h2>/);
	});
});

test.describe("without calendar", function() {
	test.before(function() {
		h.setLanguage(wiki, "de-DE");
		h.add(wiki, {title: "$:/config/dndwiki/calendar", text: ""});
	});

	test.after(function() {
		wiki.deleteTiddler("$:/config/dndwiki/calendar");
	});

	test("information without Kalender", function() {
		var information = h.body(wiki, "Information");
		assert.ok(information.indexOf("Kalender") === -1, information);
	});
});

// Colour of a tiddler through the TiddlerColourFilter cascade
function colour(title) {
	return wiki.filterTiddlers("[[" + title + "]] :cascade[all[shadows+tiddlers]tag[$:/tags/TiddlerColourFilter]!is[draft]get[text]]").join();
}
