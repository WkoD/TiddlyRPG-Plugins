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

	test("calendar hub: calculator written out", function() {
		h.add(wiki, {title: "$:/temp/tiddlyrpg/calendar", calc_date: "1351-07-30", calc_day: "1"});
		try {
			assert.ok(h.body(wiki, "Calendar").indexOf("Mittsommer (07/08)") !== -1);
		} finally {
			wiki.deleteTiddler("$:/temp/tiddlyrpg/calendar");
		}
	});

	test("index: six types in German order plus quests", function() {
		var index = h.body(wiki, "Index"),
			order = ["Gegenstände", "Götter", "Informationen", "Organisationen", "Orte", "Personen", "Quests"].map(function(s) { return index.indexOf(s); });
		assert.ok(order.every(function(p, i) { return p !== -1 && (i === 0 || p > order[i - 1]); }), index);
		assert.ok(index.indexOf("Offene Punkte") === -1, index);
	});

	// Pragmas must not leak as text (a lost backslash turns \define into visible text)
	["Index", "Information", "Player", "Calendar", "Item", "Event", "Quest", "Campaign", "Location"].forEach(function(title) {
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

	["Location", "Insel Avalon", "Index", "Player", "Calendar", "Grum", "Der dunkle Turm", "Item", "Event", "Quest"].forEach(function(title) {
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
		assert.ok(index.indexOf("Deities") !== -1 && index.indexOf("Quests") !== -1 && index.indexOf("Open Items") === -1, index);
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

	test("the type hub strikes the dead through, the relation list stripes their pill", function() {
		assert.match(h.view(wiki, "Person"), /class="[^"]*trpg-dead-link[^"]*" href="#Grum">Grum</);
		assert.match(h.view(wiki, "Insel Avalon"), /<span class="tc-tag-label trpg-pill trpg-pill-dead"[^>]*>Grum<\/span>/);
	});

	function pill(title, cls, after) {
		return h.render(wiki, "text/html", "<$transclude $variable=\"trpg.pill\" title=<<t>> class=<<c>> after=<<a>>/>", {t: title, c: cls || "", a: after || ""}).replace(/^<p>|<\/p>$/g, "");
	}

	test("trpg.pill: a link around a pill in the colour of the type, the name translated", function() {
		assert.equal(pill("Grum"), "<span class=\"trpg-pill-item\"><a class=\"tc-tiddlylink tc-tiddlylink-resolves trpg-pill-link\" href=\"#Grum\"><span class=\"tc-tag-label trpg-pill trpg-pill-dead\" title=\"\" style=\"--trpg-pill:#00a600;\">Grum</span></a></span>");
		assert.match(pill("Link Alive"), /<span class="tc-tag-label trpg-pill" title="" style="--trpg-pill:#00a600;">Link Alive<\/span>/);
		assert.match(pill("Location"), />Ort<\/span>/, "the name translated");
	});

	test("trpg.pill: a missing title in the colour of untyped tags, a spot dashed with a tooltip, a text behind (a rumour silver: quests.test.js)", function() {
		assert.ok(pill("Link Missing").indexOf("--trpg-rumour") === -1, "silver only for a rumour");
		assert.match(pill("Insel Avalon", "trpg-pill-spot"), /class="tc-tag-label trpg-pill trpg-pill-spot" title="Spot" style="--trpg-pill:#ff2b2b;"/);
		assert.match(pill("Insel Avalon", "", "(1351)"), /<\/a><span class="trpg-via">\(1351\)<\/span><\/span>$/);
	});

	test("the pill of a dead tag striped, grey and its colour; a living one not", function() {
		var pill = function(title) { return (h.render(wiki, "text/html", "<<tag-pill [[" + title + "]]>>").match(/style="([^"]*)"/) || ["", ""])[1]; };
		assert.match(pill("Grum"), /background-image:repeating-linear-gradient\(45deg, color-mix\(in srgb, #333333 18%, #ffffff\) 0 24px, color-mix\(in srgb, #00a600 18%, #ffffff\) 24px 48px\)/);
		assert.match(pill("Grum"), /box-shadow:inset 0 0 0 1px #00a600/);
		assert.doesNotMatch(pill("Link Alive"), /repeating-linear-gradient/);
	});

	test("the frame of a dead tiddler striped in the stylesheet of the types, a living one tinted", function() {
		var css = wiki.renderTiddler("text/plain", "$:/plugins/tiddlyrpg-core/styles/border");
		assert.match(css, /\.tc-tiddler-frame\.trpg-dead\.tc-tagged-Person \{\s*background: repeating-linear-gradient\(45deg, color-mix\(in srgb, var\(--tpc-foreground, #333\) 9%, var\(--tpc-tiddler-background, #fff\)\) 0 96px, color-mix\(in srgb, #00a600 9%/);
		assert.match(css, /\.tc-tiddler-frame\.tc-tagged-Person:not\(\.trpg-dead\) \{\s*background-color: color-mix\(in srgb, #00a600 9%/);
	});
});

// Colour of a tiddler through the TiddlerColourFilter cascade
function colour(title) {
	return wiki.filterTiddlers("[[" + title + "]] :cascade[all[shadows+tiddlers]tag[$:/tags/TiddlerColourFilter]!is[draft]get[text]]").join();
}
