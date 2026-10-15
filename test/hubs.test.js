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

	test("type colour: an event with a player character keeps the event colour", function() {
		assert.equal(colour("Der dunkle Turm"), "#48a4ff");
	});

	test("type colour: other types unchanged", function() {
		assert.equal(colour("Grum"), "#00a600");
	});

	test("calendar hub: the calculator keeps its inputs while typing", function() {
		var result = h.typeInto(wiki, "Calendar", {title: "$:/temp/tiddlyrpg/calendar", calc_date: "1351-07-30", calc_day: "1"});
		assert.ok(result.kept, "the same input fields after a change");
		assert.ok(result.text.indexOf("Mittsommer (07/08)") !== -1, "the result follows");
	});

	test("calendar hub: calculator written out", function() {
		h.add(wiki, {title: "$:/temp/tiddlyrpg/calendar", calc_date: "1351-07-30", calc_day: "1"});
		try {
			assert.ok(h.body(wiki, "Calendar").indexOf("Mittsommer (07/08)") !== -1);
		} finally {
			wiki.deleteTiddler("$:/temp/tiddlyrpg/calendar");
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

	test("campaign hub: quests and rumours, no current date", function() {
		var campaign = h.body(wiki, "Campaign");
		assert.ok(campaign.indexOf("Quests und Gerüchte") !== -1 && campaign.indexOf("Offene Aufgaben") === -1 && campaign.indexOf("Aktuelles Datum") === -1, campaign);
	});

	["Location", "Insel Avalon", "Index", "Player", "Calendar", "Grum", "Der dunkle Turm", "TBC", "Item", "Event", "Quest"].forEach(function(title) {
		test("no raw <<trpg. in " + title, function() {
			var html = h.view(wiki, title);
			assert.ok(html.indexOf("&lt;&lt;trpg.") === -1 && html.indexOf("<<trpg.") === -1);
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
		h.add(wiki, {title: "$:/config/tiddlyrpg/calendar", text: ""});
	});

	test.after(function() {
		wiki.deleteTiddler("$:/config/tiddlyrpg/calendar");
	});

	test("information without Kalender", function() {
		var information = h.body(wiki, "Information");
		assert.ok(information.indexOf("Kalender") === -1, information);
	});
});

test.describe("trpg.link", function() {
	var added = [
		{title: "Link Alive", tags: "Person", date: "1300"},
		{title: "Link Event", tags: "Event", date: "1300/1301"},
		{title: "$:/link/system", date: "1300/1301"},
		{title: "Link ]] odd|title", tags: "Person", date: "1300/1301"}
	];

	test.before(function() {
		added.forEach(function(fields) {
			h.add(wiki, fields);
		});
	});

	test.after(function() {
		added.forEach(function(fields) {
			wiki.deleteTiddler(fields.title);
		});
	});

	function link(title) {
		return h.render(wiki, "text/html", "<$transclude $variable=\"trpg.link\" title=<<t>>/>", {t: title});
	}

	test("dead: struck through by the class", function() {
		var html = link("Grum");
		assert.match(html, /<a class="[^"]*trpg-dead-link[^"]*" href="#Grum">Grum<\/a>/);
		assert.ok(html.indexOf("<strike>") === -1 && html.indexOf("<s>") === -1, html);
	});

	test("alive, an event that ended, a system tiddler, a missing tiddler: no class", function() {
		["Link Alive", "Link Event", "$:/link/system", "Link Missing"].forEach(function(title) {
			assert.ok(link(title).indexOf("trpg-dead-link") === -1, title);
		});
	});

	test("a title with ]] and | stays one link", function() {
		var html = link("Link ]] odd|title");
		assert.equal((html.match(/<a /g) || []).length, 1, html);
		assert.ok(html.indexOf(">Link ]] odd|title</a>") !== -1 && html.indexOf("trpg-dead-link") !== -1, html);
	});

	test("type hub and relation list strike the dead through", function() {
		assert.match(h.view(wiki, "Person"), /class="[^"]*trpg-dead-link[^"]*" href="#Grum">Grum</);
		assert.match(h.view(wiki, "Insel Avalon"), /class="[^"]*trpg-dead-link[^"]*" href="#Grum">Grum</);
	});
});

// Colour of a tiddler through the TiddlerColourFilter cascade
function colour(title) {
	return wiki.filterTiddlers("[[" + title + "]] :cascade[all[shadows+tiddlers]tag[$:/tags/TiddlerColourFilter]!is[draft]get[text]]").join();
}
