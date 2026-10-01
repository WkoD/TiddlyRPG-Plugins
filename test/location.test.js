/*
 * Location and person views: map tabs from the sub-tiddlers <location>/Map and /BattleMap, map
 * images, the event history under a location (player lock, with and without calendar) and the
 * person view (relations, dead class, activity line).
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
	var avalon;

	test.before(function() {
		h.setLanguage(wiki, "de-DE");
		avalon = h.view(wiki, "Insel Avalon");
	});

	test("map tabs: Karte and Kampfkarte", function() {
		assert.ok(avalon.indexOf(">Karte<") !== -1 && avalon.indexOf(">Kampfkarte<") !== -1);
	});

	test("map tab: text of the overview map as block wikitext", function() {
		assert.match(avalon, /<h4[^>]*>Kantine<\/h4>/);
	});

	test("battle map tab links to the file", function() {
		var battlemap = h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/dndwiki-core/viewtemplates/location/sub\" mode=\"block\"/>", {currentTiddler: "Insel Avalon", currentTab: "Insel Avalon/BattleMap"});
		assert.ok(battlemap.indexOf('href="images/battlemap/Insel%20Avalon.jpg"') !== -1, battlemap);
	});

	test("history header with era", function() {
		assert.ok(avalon.indexOf("Zeitpunkt (DR)") !== -1);
	});

	test("history flags", function() {
		assert.ok(avalon.indexOf("(Start)") !== -1 && avalon.indexOf("(Ende)") !== -1);
	});

	test("tabs: Karte before Kampfkarte", function() {
		assert.ok(avalon.indexOf(">Karte<") < avalon.indexOf(">Kampfkarte<"));
	});

	test("map block before history", function() {
		assert.ok(avalon.indexOf("Kantine") < avalon.indexOf(">Zeitstrahl<"));
	});

	test("events locked for the player are left out of the event list", function() {
		assert.ok(avalon.indexOf("Friggs Traum") === -1);
	});

	test("... but shown to that player", function() {
		h.add(wiki, {title: "$:/state/dndwiki/player", text: "Frigg"});
		try {
			assert.ok(h.view(wiki, "Insel Avalon").indexOf("Friggs Traum") !== -1);
		} finally {
			wiki.deleteTiddler("$:/state/dndwiki/player");
		}
	});

	test("location with map only: one tab", function() {
		var baile = h.view(wiki, "Baile");
		assert.ok(baile.indexOf(">Karte<") !== -1 && baile.indexOf("Kampfkarte") === -1);
	});

	test("map image from images/map", function() {
		assert.ok(h.view(wiki, "Baile").indexOf('src="images/map/Baile.png"') !== -1);
	});

	test("location without maps: no map block", function() {
		assert.ok(h.view(wiki, "Nowhere").indexOf(">Karte<") === -1);
	});

	test("relation list heading", function() {
		assert.ok(h.view(wiki, "Grum").indexOf("Ort") !== -1);
	});

	test("dead class", function() {
		var html = h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/core/ui/StoryTiddlerTemplate\" mode=\"block\"/>", {currentTiddler: "Grum", storyTiddler: "Grum"});
		assert.ok(html.indexOf("dnd-dead") !== -1);
	});

	test("activity line year", function() {
		assert.ok(h.view(wiki, "Grum").indexOf("???? - 1350 DR") !== -1);
	});
});

test.describe("en-GB", function() {
	test.before(function() {
		h.setLanguage(wiki, "en-GB");
	});

	test("en tabs", function() {
		var avalon = h.view(wiki, "Insel Avalon");
		assert.ok(avalon.indexOf(">Map<") !== -1 && avalon.indexOf(">Battle Map<") !== -1);
	});

	test("en history header", function() {
		assert.ok(h.view(wiki, "Insel Avalon").indexOf("Date (DR)") !== -1);
	});

	test("en battle map heading", function() {
		assert.match(h.view(wiki, "Insel Avalon/BattleMap"), /Battle Map/);
	});
});

test.describe("without calendar", function() {
	var avalon;

	test.before(function() {
		h.setLanguage(wiki, "de-DE");
		h.add(wiki, {title: "$:/config/dndwiki/calendar", text: ""});
		avalon = h.view(wiki, "Insel Avalon");
	});

	test.after(function() {
		wiki.deleteTiddler("$:/config/dndwiki/calendar");
	});

	test("history header without era", function() {
		assert.ok(avalon.indexOf("Zeitpunkt") !== -1 && avalon.indexOf("(DR)") === -1);
	});

	test("raw month and day in the history", function() {
		assert.ok(avalon.indexOf(">07<") !== -1 && avalon.indexOf(">01<") !== -1);
	});
});
