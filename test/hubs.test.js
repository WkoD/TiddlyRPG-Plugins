/*
 * Hub and index tiddlers (Location, Campaign, Index, Information, Player, Calendar, ...), the
 * type colour cascade and the wikitext hygiene of all hubs. The event head: sections.test.js.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var wiki;

// A pragma in the text of a page, with or without its backslash
var PRAGMA = /(^|\n)\s*\\?(define|procedure|function|widget|whitespace|import|parameters|rules) /;

test.before(function() {
	return h.boot().then(function($tw) {
		wiki = $tw.wiki;
	});
});

test.describe("de-DE", function() {
	test.before(function() {
		h.setLanguage(wiki, "de-DE");
	});

	test("hub heading translated, the number of its entries behind it", function() {
		assert.match(h.view(wiki, "Location"), /<h2 class="tc-title">Ort<span class="trpg-hub-count">\d+<\/span><\/h2>/);
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

	test("index: the types, quests and players in German order", function() {
		var index = h.body(wiki, "Index"),
			order = ["Gegenstände", "Götter", "Informationen", "Kreaturen", "Organisationen", "Orte", "Personen", "Quests", "Spieler", "Zauber"].map(function(s) { return index.indexOf(s); });
		assert.ok(order.every(function(p, i) { return p !== -1 && (i === 0 || p > order[i - 1]); }), index);
	});

	// Pragmas must not leak as text: a pragma after other text shows with its backslash, one whose
	// backslash got lost without it. Every hub, and the pages of the core beside them
	test("no pragma text in a hub", function() {
		var hubs = Array.from(h.filter(wiki, "[all[shadows+tiddlers]tag[Index]] Campaign Content Secret Calendar Currency Ruleset CampaignSetting"));
		assert.ok(hubs.length > 25, hubs.length);
		hubs.forEach(function(title) {
			assert.doesNotMatch(h.body(wiki, title), PRAGMA, title);
		});
	});

	test("the pragma check finds a pragma after text", function() {
		assert.match("A text.\n\n\\define leaked() x", PRAGMA);
		assert.match("A text.\n\nprocedure leaked() x", PRAGMA);
	});

	test("information lists Kalender", function() {
		var information = h.body(wiki, "Information");
		assert.ok(information.indexOf("Kalender") !== -1, information);
	});

	test("calendar hub: name, epithet, leap festival", function() {
		var calendarHub = h.body(wiki, "Calendar");
		assert.ok(calendarHub.indexOf("Kalender von Harptos") !== -1 &&
			calendarHub.indexOf("Tiefwinter") !== -1 && calendarHub.indexOf("Schildtreff (alle 4 Jahre)") !== -1, calendarHub);
	});

	test("campaign hub: quests and rumours", function() {
		var campaign = h.body(wiki, "Campaign");
		assert.ok(campaign.indexOf("Quests und Gerüchte") !== -1, campaign);
	});

	test("no raw <<trpg. in a hub or a tiddler of each kind", function() {
		var titles = Array.from(h.filter(wiki, "[all[shadows+tiddlers]tag[Index]] Campaign Calendar [[Insel Avalon]] Grum [[Der dunkle Turm]]"));
		assert.ok(titles.length > 25, titles.length);
		titles.forEach(function(title) {
			var html = h.view(wiki, title);
			assert.ok(html.indexOf("&lt;&lt;trpg.") === -1 && html.indexOf("<<trpg.") === -1, title);
		});
	});
});

test.describe("en-GB", function() {
	test.before(function() {
		h.setLanguage(wiki, "en-GB");
	});

	test("en index", function() {
		var index = h.body(wiki, "Index");
		assert.ok(index.indexOf("Deities") !== -1 && index.indexOf("Quests") !== -1, index);
	});

	test("en hub heading: the name and the number", function() {
		assert.match(h.view(wiki, "Location"), /<h2 class="tc-title">Location<span class="trpg-hub-count">\d+<\/span><\/h2>/);
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

	test("trpg.pill: a missing title in the colour of untyped tags, a spot dashed with a tooltip, a text behind (a rumour: quests.test.js)", function() {
		assert.ok(pill("Link Missing").indexOf("--trpg-rumour") === -1, "the gold of the rumours only for a rumour");
		assert.ok(pill("Link Missing").indexOf("trpg-pill-rumour") === -1);
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

	test("Spell and Creature: hubs with their colour; the colour as --trpg-type for the rules of a tiddler", function() {
		var css = wiki.renderTiddler("text/plain", "$:/plugins/tiddlyrpg-core/styles/border");
		assert.match(css, /\.tc-tagged-Spell \{\s*border: 2px solid #9b59d0;\s*--trpg-type: #9b59d0;\s*\}/);
		assert.match(css, /\.tc-tiddler-frame\.tc-tagged-Creature:not\(\.trpg-dead\) \{\s*background-color: color-mix\(in srgb, #2aa198 9%/);
		assert.match(css, /\.tc-tiddler-frame hr \{\s*border: none;\s*height: 2px;\s*background: linear-gradient\(to right, var\(--trpg-type, /);
		assert.match(h.view(wiki, "Spell"), /<h2 class="tc-title">Zauber<span class="trpg-hub-count">\d+<\/span><\/h2>/);
		assert.match(h.render(wiki, "text/html", "{{Index}}"), />Kreaturen</);
	});
});

test.describe("hubs in their colour: frame, list, number", function() {
	var added = [
		{title: "Ärger Hub", tags: "Person"},
		{title: "Azur Hub", tags: "Person"},
		{title: "Xaver Hub", tags: "Person Secret"},
		{title: "Dorf Info", tags: "Information"}
	];

	test.before(function() {
		h.setLanguage(wiki, "de-DE");
		added.forEach(function(fields) {
			h.add(wiki, fields);
		});
	});

	test.after(function() {
		added.forEach(function(fields) {
			wiki.deleteTiddler(fields.title);
		});
	});

	// The first result of a filter with the global definitions, as the page renders it
	function text(filter) {
		return h.render(wiki, "text/plain", "<$text text={{{ " + filter + " }}}/>");
	}

	// The number in the heading of a hub
	function count(title) {
		return Number((h.view(wiki, title).match(/<span class="trpg-hub-count">(\d+)<\/span>/) || [])[1]);
	}

	// True if the strings occur in the text in this order
	function inOrder(text, strings) {
		var from = 0;
		return strings.every(function(s) {
			var p = text.indexOf(s, from);
			from = p + s.length;
			return p !== -1;
		});
	}

	test("the stylesheet frames every hub and Campaign in its colour, not Index", function() {
		var css = wiki.renderTiddler("text/plain", "$:/plugins/tiddlyrpg-core/styles/hubs");
		assert.match(css, /\.tc-tiddler-frame\[data-tiddler-title=Person\] \{\s*--trpg-hub: #00a600;\s*\}/);
		assert.match(css, /\.tc-tiddler-frame\[data-tiddler-title=Folk\] \{\s*--trpg-hub: #7c7c7c;\s*\}/);
		assert.match(css, /\.tc-tiddler-frame\[data-tiddler-title=Campaign\] \{\s*--trpg-hub: #7c7c7c;\s*\}/);
		assert.match(css, /\.tc-tiddler-frame\.trpg-hub \{\s*--trpg-type: var\(--trpg-hub\);/);
		assert.doesNotMatch(css, /data-tiddler-title=Index\]/);
		assert.doesNotMatch(wiki.renderTiddler("text/plain", "$:/plugins/tiddlyrpg-core/styles/border"), /\.tc-tagged-Index \{/);
	});

	test("Campaign and Index grey like Information; Index is no hub, a hub keeps its colour", function() {
		var grey = wiki.getTiddler("Information").fields.color;
		assert.equal(wiki.getTiddler("Campaign").fields.color, grey);
		assert.equal(colour("Index"), grey);
		assert.equal(colour("Location"), "#ff2b2b");
		assert.equal(text("Index Location Campaign :filter[trpg.hub[]] +[join[,]]"), "Location");
		assert.equal(text("[function[trpg.pillstyle],[Location]]"), "");
	});

	test("class trpg-hub and the rule on a hub, the class without rule on Campaign, neither on Index", function() {
		var hub = h.view(wiki, "Location"),
			campaign = h.view(wiki, "Campaign"),
			index = h.view(wiki, "Index");
		assert.match(hub, /class="trpg-hub\s+tc-tiddler-frame/);
		assert.ok(hub.indexOf("<div class=\"trpg-hub-rule\">") !== -1, hub);
		assert.match(campaign, /class="trpg-hub\s+trpg-pinned\s+tc-tiddler-frame|class="trpg-pinned\s+trpg-hub\s+tc-tiddler-frame/);
		assert.equal(campaign.indexOf("trpg-hub-rule"), -1);
		assert.doesNotMatch(index, /class="[^"]*\btrpg-hub\s[^"]*tc-tiddler-frame/);
		assert.equal(index.indexOf("trpg-hub-rule"), -1);
	});

	test("the list sorted by the displayed name, an umlaut with its letter, a heading per letter", function() {
		var person = h.view(wiki, "Person");
		assert.ok(inOrder(person, ["trpg-hub-letter\">A<", "Ärger Hub", "Azur Hub", "trpg-hub-letter\">B<", "Barkeep"]), person);
		assert.equal(person.indexOf("trpg-hub-letter\">Ä<"), -1, person);
		assert.equal((person.match(/trpg-hub-letter">A</g) || []).length, 1, "each letter once");
		assert.equal((person.match(/>Azur Hub</g) || []).length, 1, "each entry once");
		assert.match(person, /class="[^"]*trpg-dead-link[^"]*" href="#Grum">Grum</);
	});

	test("Information sorted by the displayed name, not by the title", function() {
		var information = h.view(wiki, "Information");
		assert.ok(inOrder(information, [">Dorf Info<", ">Kalender<"]), information);
	});

	test("number and letters only of what the view sees", function() {
		var visible = "[tag[Person]] :filter[trpg.visible[]] +[count[]]",
			dm = count("Person"),
			pub = h.inView(wiki, "public", function() {
				return {count: count("Person"), filter: Number(text(visible)), body: h.view(wiki, "Person")};
			});
		assert.equal(dm, Number(text(visible)));
		assert.equal(pub.count, pub.filter);
		assert.ok(pub.count < dm, pub.count + " < " + dm);
		assert.ok(h.view(wiki, "Person").indexOf("trpg-hub-letter\">X<") !== -1);
		assert.equal(pub.body.indexOf("trpg-hub-letter\">X<"), -1, pub.body);
		assert.equal(pub.body.indexOf("Xaver"), -1, pub.body);
	});

	// The links of the list of a hub (trpg.hub.list), in order
	function listed(hub) {
		var html = h.render(wiki, "text/html", "<$transclude $tiddler=\"" + hub + "\" mode=\"block\"/>", {currentTiddler: hub}),
			at = html.indexOf("<div class=\"trpg-hub-list\">");
		return at === -1 ? [] : (html.slice(at).match(/href="#[^"]*"/g) || []).map(function(href) {
			return decodeURIComponent(href.slice(7, -1));
		});
	}

	// One template serves several hubs ({{ || Item }} in a category): each lists its own entries
	test("every type hub lists what it holds and nothing else, by name - a category, Artifact, Material only their own", function() {
		var hubs = Array.from(h.filter(wiki, "[all[shadows+tiddlers]tag[Index]has[color]] -Index -Event -Quest -Player")),
			filled = 0;
		assert.ok(hubs.length > 15, hubs.length);
		hubs.forEach(function(hub) {
			// With the global definitions, as the page renders (tiddlyrpg-entries uses functions)
			var expected = text("[[" + hub + "]trpghubentries[]] :filter[trpg.visible[]] +[trpgsortname[]join[|]]").split("|").filter(Boolean);
			filled += expected.length ? 1 : 0;
			assert.deepEqual(listed(hub), expected, hub);
		});
		assert.ok(filled >= 4, filled);
	});

	test("Index: each hub with the number in its heading; Quest the open quests, Player the active characters", function() {
		var index = h.view(wiki, "Index"),
			number = function(name) { return Number((index.match(new RegExp(">" + name + "</span><span class=\"trpg-hub-index-n\">(\\d+)<")) || [])[1]); };
		assert.equal(number("Personen"), count("Person"));
		assert.equal(number("Informationen"), count("Information"));
		assert.equal(number("Quests"), Number(text("[questnames[]] :filter[queststatus[]match[open]] +[count[]]")));
		assert.equal(number("Spieler"), Number(text("[tag[Player]] :filter[trpg.visible[]] +[count[]]")));
		assert.match(index, /<div class="trpg-hub-index-row" style="--trpg-hub:#00a600;"><a [^>]*href="#Person">/);
	});

	test("Campaign: the heading of the player characters once, then the list of the hubs, then the cards", function() {
		var campaign = h.view(wiki, "Campaign");
		assert.equal((campaign.match(/>Spielerfiguren</g) || []).length, 1, campaign);
		assert.ok(inOrder(campaign, [">Spielerfiguren<", "trpg-campaign-index", "trpg-hub-index", "trpg-players"]), campaign);
		assert.ok(h.view(wiki, "Player").indexOf(">Spielerfiguren<") !== -1, "the hub Player keeps it");
	});
});

// Colour of a tiddler through the TiddlerColourFilter cascade
function colour(title) {
	return wiki.filterTiddlers("[[" + title + "]] :cascade[all[shadows+tiddlers]tag[$:/tags/TiddlerColourFilter]!is[draft]get[text]]").join();
}
