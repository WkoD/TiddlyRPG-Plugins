/*
 * Views and the lock (modules/visibility.js, filters/visibility.js): the rule of trpg.visible in
 * every view, the default view, the views that can be chosen, campaign events through player
 * characters, the page control, the page class, the marker of a locked tiddler, the Player hub,
 * and every place that lists titles: hubs, search, tag pills, sidebar, relation list, graphs,
 * open items.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var wiki;

test.before(function() {
	return h.boot().then(function($tw) {
		wiki = $tw.wiki;
		h.setLanguage(wiki, "de-DE");
		// Anna plays Frigg (fixture), Jan plays Ragna; Ylva was played by Anna before
		h.add(wiki, {title: "Ragna", tags: "Player", player: "Jan", text: "Another player character."});
		h.add(wiki, {title: "Ylva", tags: "Person", player: "Anna", text: "Played by Anna before."});
		h.add(wiki, {title: "Ylvas Brief", tags: "Information Ylva Secret", text: "For Ylva."});
		h.add(wiki, {title: "Geheimbund", tags: "Organisation Secret", location: "Town", text: "DM only."});
		h.add(wiki, {title: "Bote", tags: "Person", location: "Town", bond: "Geheimbund", text: "A messenger. TBC\n\n@@.tc-tiddler-frame\nopen\n@@"});
		h.add(wiki, {title: "Geheimbund Notiz", tags: "Event Geheimbund", text: "Mentions the order."});
	});
});

// Array.from: filter results come from the realm of the wiki, deepEqual compares prototypes
function f(text, variables) {
	return Array.from(h.filter(wiki, text, variables));
}

function inView(view, fn) {
	return h.inView(wiki, view, fn);
}

test.describe("the rule", function() {
	var ALL = "[[Hideout]] [[Friggs Traum]] [[Ylvas Brief]] [[Geheimbund]] [[Der dunkle Turm]] [[Baile]]";

	test("public: nothing tagged Secret", function() {
		assert.deepEqual(inView("public", function() { return f(ALL + " +[trpgvisible[]]"); }), ["Der dunkle Turm", "Baile"]);
	});

	test("a player: what is locked for one of their characters, active or former", function() {
		assert.deepEqual(inView("player:Anna", function() { return f(ALL + " +[trpgvisible[]]"); }),
			["Hideout", "Friggs Traum", "Ylvas Brief", "Der dunkle Turm", "Baile"]);
		assert.deepEqual(inView("player:Jan", function() { return f(ALL + " +[trpgvisible[]]"); }), ["Der dunkle Turm", "Baile"]);
	});

	test("the DM: everything", function() {
		assert.equal(inView("dm", function() { return f(ALL + " +[trpgvisible[]]"); }).length, 6);
	});

	test("a player character tagged without Secret locks nothing", function() {
		assert.deepEqual(inView("public", function() { return f("[[Der dunkle Turm]trpgvisible[]]"); }), ["Der dunkle Turm"]);
		// trpg.visible (functions.tid) is the same rule
		assert.equal(inView("public", function() { return h.render(wiki, "text/plain", "<$text text={{{ [[Hideout]] [[Baile]] +[trpg.visible[]] +[join[,]] }}}/>"); }), "Baile");
	});

	test("an active character without the field player counts as its own player", function() {
		h.add(wiki, {title: "Solo", tags: "Player"});
		h.add(wiki, {title: "Solos Geheimnis", tags: "Event Solo Secret"});
		try {
			assert.deepEqual(inView("player:Solo", function() { return f("[[Solos Geheimnis]trpgvisible[]]"); }), ["Solos Geheimnis"]);
		} finally {
			wiki.deleteTiddler("Solo");
			wiki.deleteTiddler("Solos Geheimnis");
		}
	});
});

test.describe("default view", function() {
	test.afterEach(function() {
		["$:/status/IsReadOnly", "$:/config/tiddlyrpg/view/dm-published"].forEach(function(title) { wiki.deleteTiddler(title); });
		h.setView(wiki, null);
	});

	test("editable wiki: the DM", function() {
		assert.deepEqual(f("[trpgview[]]"), ["dm"]);
	});

	test("read-only copy: public", function() {
		h.add(wiki, {title: "$:/status/IsReadOnly", text: "yes"});
		assert.deepEqual(f("[trpgview[]]"), ["public"]);
		assert.deepEqual(f("[[Hideout]trpgvisible[]]"), []);
	});

	test("read-only copy: dm only if published", function() {
		h.add(wiki, {title: "$:/status/IsReadOnly", text: "yes"});
		h.setView(wiki, "dm");
		assert.deepEqual(f("[trpgview[]]"), ["public"]);
		assert.ok(f("[trpgview:choices[]]").indexOf("dm") === -1);
		h.add(wiki, {title: "$:/config/tiddlyrpg/view/dm-published", text: "yes"});
		assert.deepEqual(f("[trpgview[]]"), ["dm"]);
		assert.ok(f("[trpgview:choices[]]").indexOf("dm") !== -1);
	});

	test("an unknown value counts as public", function() {
		h.setView(wiki, "whatever");
		assert.deepEqual(f("[trpgview:mode[]]"), ["public"]);
	});
});

test.describe("players and characters", function() {
	test("choices: public, the players of active characters, dm", function() {
		assert.deepEqual(f("[trpgview:choices[]]"), ["public", "player:Anna", "player:Jan", "dm"]);
	});

	test("characters, active and former; their player", function() {
		assert.deepEqual(f("[[Frigg]] [[Ylva]] [[Grum]] +[trpgcharacter[]]"), ["Frigg", "Ylva"]);
		assert.deepEqual(f("[[Ylva]trpgplayer[]]"), ["Anna"]);
		assert.deepEqual(f("[[Anna]trpgplayedby[]]"), ["Frigg"]);
	});

	test("campaign event: a player character tagged, a former one too", function() {
		var rows = f("[[Der dunkle Turm]] [[Hafenfest]] +[eventrows[]]").join("");
		assert.match(rows, /__\[\[Der dunkle Turm\]\]__/);
		assert.doesNotMatch(rows, /__\[\[Hafenfest\]\]__/);
		h.add(wiki, {title: "Alter Ritt", tags: "Event Ylva", date: "1340"});
		try {
			assert.match(f("[[Alter Ritt]] +[eventrows[]]").join(""), /__\[\[Alter Ritt\]\]__/);
		} finally {
			wiki.deleteTiddler("Alter Ritt");
		}
	});
});

test.describe("page control and page class", function() {
	function control() {
		return h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/ui/view-switcher\" $mode=\"block\"/>");
	}

	test("the button names the active view", function() {
		assert.match(control(), /class="trpg-view-current">DM</);
		assert.match(inView("player:Anna", control), /class="trpg-view-current">Anna \(Frigg\)</);
		assert.match(inView("public", control), /class="trpg-view-current">Öffentlich</);
	});

	test("page class per mode", function() {
		var page = "[all[shadows+tiddlers]tag[$:/tags/ClassFilters/PageTemplate]!is[draft]] :map:flat[subfilter{!!text}]";
		assert.ok(f(page).indexOf("trpg-view-dm") !== -1);
		assert.ok(inView("player:Jan", function() { return f(page); }).indexOf("trpg-view-player") !== -1);
		assert.ok(inView("public", function() { return f(page); }).indexOf("trpg-view-public") !== -1);
	});
});

test.describe("a locked tiddler", function() {
	test("marker for who sees it: the DM and its players", function() {
		assert.match(h.view(wiki, "Friggs Traum"), /class="trpg-secret-marker">.*Geheim: Frigg</s);
		assert.match(inView("player:Anna", function() { return h.view(wiki, "Friggs Traum"); }), /Geheim: Frigg/);
		assert.match(h.view(wiki, "Geheimbund"), /Geheim: nur DM/);
	});

	test("opened in a view that does not see it: no body, tags, marker, relations, date line", function() {
		var html = inView("public", function() { return h.view(wiki, "Geheimbund"); });
		assert.doesNotMatch(html, /DM only\.|tc-tag-list-item|trpg-secret-marker|tc-tab-set|trpg-dateline/);
		assert.match(h.view(wiki, "Geheimbund"), /DM only\./);
	});
});

test.describe("Player hub", function() {
	test("cards of the active characters, the former ones below", function() {
		var html = h.render(wiki, "text/html", "{{Player}}");
		assert.match(html, /trpg-player-card"[^>]*>.*Frigg.*Anna/s);
		assert.ok(html.indexOf("Spielerfiguren") < html.indexOf("Frühere Figuren"));
		assert.ok(html.indexOf("Ylva") > html.indexOf("Frühere Figuren"));
	});

	test("no heading for former characters without one", function() {
		wiki.deleteTiddler("Ylva");
		try {
			assert.ok(h.render(wiki, "text/html", "{{Player}}").indexOf("Frühere Figuren") === -1);
		} finally {
			h.add(wiki, {title: "Ylva", tags: "Person", player: "Anna", text: "Played by Anna before."});
		}
	});

	test("the field player shows on a former character too", function() {
		assert.match(h.view(wiki, "Ylva"), /<b>Spieler:<\/b> Anna/);
	});
});

test.describe("places that list titles", function() {
	test("type hubs", function() {
		assert.ok(inView("public", function() { return h.body(wiki, "Location"); }).indexOf("Hideout") === -1);
		assert.ok(inView("public", function() { return h.body(wiki, "Organisation"); }).indexOf("Geheimbund") === -1);
		assert.ok(h.body(wiki, "Organisation").indexOf("Geheimbund") !== -1);
		assert.ok(inView("public", function() { return h.body(wiki, "Information"); }).indexOf("Ylvas Brief") === -1);
	});

	test("hub Secret: what the view sees, with its players", function() {
		var dm = h.body(wiki, "Secret");
		assert.ok(dm.indexOf("Geheimbund") !== -1 && dm.indexOf("Hideout (Frigg)") !== -1, dm);
		assert.equal(inView("public", function() { return h.body(wiki, "Secret"); }).trim(), "");
	});

	test("search: titles and full text", function() {
		["first-search-filter", "second-search-filter"].forEach(function(field) {
			var search = "<$let userInput=\"Geheimbund\"><$list filter={{$:/core/ui/DefaultSearchResultList!!" + field + "}}><<currentTiddler>>|</$list></$let>";
			assert.equal(inView("public", function() { return h.render(wiki, "text/plain", search); }).split("|").indexOf("Geheimbund"), -1);
			assert.ok(h.render(wiki, "text/plain", search).split("|").indexOf("Geheimbund") !== -1);
		});
	});

	test("tag pills: none for a locked tag, its dropdown only what the view sees", function() {
		var html = inView("public", function() { return h.view(wiki, "Geheimbund Notiz"); });
		assert.ok(html.indexOf('data-tag-title="Geheimbund"') === -1 && html.indexOf('data-tag-title="Event"') !== -1);
		var list = "<$macrocall $name=\"list-tagged-draggable\" tag=\"Frigg\" subFilter=\"trpg.visible[]\"/>";
		var shown = inView("public", function() { return h.render(wiki, "text/plain", list); });
		assert.ok(shown.indexOf("Der dunkle Turm") !== -1 && shown.indexOf("Friggs Traum") === -1, shown);
		assert.ok(h.render(wiki, "text/plain", list).indexOf("Friggs Traum") !== -1);
	});

	test("tag area through the cascade, with the pill template of the plugin", function() {
		assert.deepEqual(f("[[Hafenfest]] :cascade[all[shadows+tiddlers]tag[$:/tags/ViewTemplateTagsFilter]!is[draft]get[text]]"), ["$:/plugins/tiddlyrpg-core/templates/tags"]);
	});

	test("sidebar: the core tabs for the DM, Open and Recent for everyone else", function() {
		var segment = "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/ui/sidebar\" $mode=\"block\"/>";
		assert.equal(wiki.getTiddlerText("$:/config/SideBarSegments/Visibility/$:/core/ui/SideBarSegments/tabs"), "hide");
		assert.match(h.render(wiki, "text/html", segment), /Mehr|More/);
		var pub = inView("public", function() { return h.render(wiki, "text/html", segment); });
		assert.doesNotMatch(pub, />(Mehr|More)</);
		var recent = inView("public", function() { return h.render(wiki, "text/plain", "{{$:/plugins/tiddlyrpg-core/ui/sidebar-recent}}"); });
		assert.ok(recent.indexOf("Baile") !== -1 && recent.indexOf("Hideout") === -1, recent);
	});

	test("relation list: no locked relation", function() {
		assert.ok(inView("public", function() { return h.view(wiki, "Bote"); }).indexOf(">Geheimbund<") === -1);
		assert.ok(h.view(wiki, "Bote").indexOf(">Geheimbund<") !== -1);
		assert.ok(inView("public", function() { return h.view(wiki, "Town"); }).indexOf(">Geheimbund<") === -1);
	});

	test("secret presence: a location of an organisation that is Secret or a locked spot", function() {
		var added = [
			{title: "Unterschlupf", tags: "Location Secret", location: "Town", text: "Hidden house."},
			{title: "Bund", tags: "Organisation", location: "Baile Unterschlupf", text: "A league."},
			{title: "Feste", tags: "Location", text: "Fort.\n\n<<spot \"Keller\">>\n\nOpen.\n\n<<secret>><<spot \"Versteck\">>\n\nHidden."},
			{title: "Versteck", tags: "Location", text: "A room."},
			{title: "Zirkel", tags: "Organisation", location: "Versteck", text: "A circle."}
		];
		added.forEach(function(fields) { h.add(wiki, fields); });
		var path = function(title) { return h.render(wiki, "text/plain", "<<trpg.locationpath>>", {currentTiddler: title}).replace(/\s+/g, ""); };
		try {
			// A Secret location: missing in the path of the organisation and at the location above
			assert.equal(inView("public", function() { return path("Bund"); }), "Baile");
			assert.ok(inView("public", function() { return h.view(wiki, "Town"); }).indexOf(">Bund<") === -1);
			assert.equal(path("Bund"), "BaileContinent›Kingdom›Town›Unterschlupf");
			assert.ok(h.view(wiki, "Town").indexOf(">Bund<") !== -1);
			// A locked spot: the place stays, where it lies does not
			assert.equal(inView("public", function() { return path("Zirkel"); }), "Versteck");
			assert.deepEqual(inView("public", function() { return f("[[Feste]occupants[]] [[Feste]sublocations[]]"); }), []);
			assert.equal(path("Zirkel"), "Feste›Versteck");
			assert.deepEqual(f("[[Feste]occupants[]] [[Feste]sublocations[]]"), ["Zirkel", "Versteck"]);
		} finally {
			added.forEach(function(fields) { wiki.deleteTiddler(fields.title); });
		}
	});

	test("open items: no locked tiddler", function() {
		h.add(wiki, {title: "Geheimer Faden", tags: "Event Secret", text: "TBC\n\n@@.tc-tiddler-frame\nopen\n@@"});
		try {
			var open = inView("public", function() { return h.body(wiki, "TBC"); });
			assert.ok(open.indexOf("Bote") !== -1 && open.indexOf("Geheimer Faden") === -1, open);
		} finally {
			wiki.deleteTiddler("Geheimer Faden");
		}
	});

	test("graphs: no locked node", function() {
		h.add(wiki, {title: "$:/graph/Views", type: "application/json", text: "{}",
			template: "$:/plugins/tiddlyrpg-core/graph/templates/trpg-graph", filter: "[[Bote]] [[Geheimbund]] [[Town]]"});
		try {
			var view = "<$graph.view $tiddler=\"$:/graph/Views\"/>";
			assert.deepEqual(Object.keys(inView("public", function() { return h.graph(wiki, view); }).nodes).sort(), ["Bote", "Town"]);
			assert.ok(h.graph(wiki, view).nodes.Geheimbund);
			var ego = "<$graph.view $tiddler=\"$:/plugins/tiddlyrpg-core/graph/ego\"/>";
			assert.ok(!inView("public", function() { return h.graph(wiki, ego, {currentNode: "Bote"}); }).nodes.Geheimbund);
			assert.ok(h.graph(wiki, ego, {currentNode: "Bote"}).nodes.Geheimbund);
		} finally {
			wiki.deleteTiddler("$:/graph/Views");
		}
	});
});

// Every secret below carries the word Qx7 (and its dates the year 1399): in its title, its text,
// the name of a spot or the caption of a section. The sweep renders whatever a reader can reach
// - every tiddler and hub through the view template with each tab, its graphs, the search, the
// sidebar, ControlPanel -> License - and in the public view none of it may hold the word. A new feature is covered once
// its output is part of the view template; a new kind of secret needs a fixture here.
test.describe("sweep", function() {
	var WORD = "Qx7",
		YEAR = "1399",
		fixtures = [
			{title: "Qx7 Akte", tags: "Person Secret", location: "Town", bond: "Baile", text: "Qx7 file. TBC\n\n@@.tc-tiddler-frame\nopen\n@@"},
			{title: "Qx7 Ort", tags: "Location Secret", location: "Town", text: "Qx7 house."},
			{title: "Qx7 Fest", tags: "Event Secret", date: "1399-02-01", text: "At [[Baile]]."},
			{title: "Sweep Bund", tags: "Organisation", location: "Baile [[Qx7 Ort]]", bond: "[[Qx7 Akte]]", text: "A league."},
			{title: "Sweep Burg", tags: "Location", location: "Baile", text: "A castle.\n\n<<spot \"Hof\">>\n\nOpen.\n\n<<secret>><<spot \"Qx7 Kammer\" image:\"Qx7bild.jpg, Qx7zwei.jpg\" map:\"Qx7plan.jpg\">>\n\nQx7 room."},
			// The caption of the locked section holds a rules macro: heading, timeline (card and
			// tooltip) and event table render it, none of them in the public view
			{title: "Sweep Treffen", tags: "Event Frigg [[Qx7 Akte]]", date: "1351-08-01, 1399-01-01",
				text: "<<date>>\n\nAt [[Baile]]. <$secret>Qx7 inline</$secret> Done.\n\n<<secret>><<date label:\"Qx7 Nacht <<term Qx7cap>>\">>\n\nAt [[Qx7 Ort]] with [[Qx7 Akte]], <<spotlink \"Sweep Burg\" \"Qx7 Kammer\">>."},
			// A locked item with a price (and the hint on it)
			{title: "Qx7 Klinge", tags: "Item Secret", price: "1399 Qx7"},
			// The source of the images of a locked tiddler (field source), its images and maps as tabs
			{title: "Qx7 Karte", tags: "Location Secret", location: "Baile", source: "Qx7src",
				image: "Qx7a.jpg, Qx7b.jpg", map: "Qx7m1.jpg, Qx7m2.jpg"},
			// Rules macros in a locked section: their text and the hint on what is not understood
			{title: "Sweep Regeln", tags: "Location", location: "Baile",
				text: "Open, <<unit \"30 ft\">>.\n\n<<secret>><<spot \"Qx7 Ecke\">>\n\n<<term Qx7rule>> and <<damage \"1d6 Qx7dmg\">>.\n\n<<image \"Qx7pic.png, Qx7pic2.png\">>"},
			// Quests: a quest tagged Secret with a marker in an open section (the marker is hidden
			// with it), a rumour whose only marker stands in a locked section, and the end of an
			// open rumour in that locked section - hub, cards, history and the event leave them out
			{title: "Qx7 Plan", tags: "Quest Secret", text: "Qx7 planning."},
			{title: "Sweep Questzug", tags: "Event Frigg", date: "1351-09-01, 1399-03-01",
				text: "<<date>>\n\n<<quest \"Sweep Gerücht\">>Open rumour.\n\n<<quest \"Qx7 Plan\">>Qx7 marker text.\n\n<<secret>><<date>>\n\n<<quest \"Sweep Gerücht\" status:\"complete\">><<quest \"Qx7 Faden\">>Qx7 hidden thread."},
			{title: "$:/graph/Sweep", type: "application/json", text: "{}",
				template: "$:/plugins/tiddlyrpg-core/graph/templates/trpg-graph", filter: "[!is[system]]", "edges.functions": "links"}
		],
		TABS = [
			{"$:/state/tiddlyrpg-core/relations-tab": "$:/plugins/tiddlyrpg-core/viewtemplates/relations/list", "$:/state/tiddlyrpg-core/events-tab": "$:/plugins/tiddlyrpg-core/viewtemplates/event-list/list"},
			{"$:/state/tiddlyrpg-core/relations-tab": "$:/plugins/tiddlyrpg-core/viewtemplates/relations/graph", "$:/state/tiddlyrpg-core/events-tab": "$:/plugins/tiddlyrpg-core/viewtemplates/event-list/timeline"}
		],
		DEFAULTS = TABS[0];

	test.before(function() {
		fixtures.forEach(function(fields) { h.add(wiki, fields); });
	});

	test.after(function() {
		fixtures.forEach(function(fields) { wiki.deleteTiddler(fields.title); });
		Object.keys(DEFAULTS).forEach(function(title) { h.add(wiki, {title: title, text: DEFAULTS[title]}); });
	});

	// What a reader sees of the HTML: text, tooltips, links - not the classes and data attributes
	// the core puts every tag in (the published HTML holds everything anyway)
	function seen(html) {
		return html.replace(/\s(class|style|data-[\w-]+)="[^"]*"/g, "");
	}

	function setTabs(tabs) {
		Object.keys(tabs).forEach(function(title) { h.add(wiki, {title: title, text: tabs[title]}); });
	}

	// Everything a reader of <view> can reach, as [{where, text}]
	function sweep(view) {
		return inView(view, function() {
			var out = [],
				titles = f("[all[shadows+tiddlers]!is[system]!is[draft]] :filter[trpgvisible[]]");
			TABS.forEach(function(tabs) {
				setTabs(tabs);
				titles.forEach(function(title) {
					var vars = {currentTiddler: title, storyTiddler: title};
					out.push({where: title, text: seen(h.view(wiki, title))});
					// The graphs in the view (relations, map) with labels and tooltips
					out.push({where: title + " (graphs)", text: JSON.stringify(h.graph(wiki, "<$transclude $tiddler=\"$:/core/ui/ViewTemplate\" mode=\"block\"/>", vars))});
				});
			});
			setTabs(DEFAULTS);
			f("[all[shadows+tiddlers]prefix[$:/graph/]]").forEach(function(title) {
				out.push({where: title, text: JSON.stringify(h.graph(wiki, "<$graph.view $tiddler=\"" + title + "\"/>"))});
			});
			["first-search-filter", "second-search-filter"].forEach(function(field) {
				out.push({where: "search " + field, text: h.render(wiki, "text/plain", "<$let userInput=\"" + WORD + "\"><$list filter={{$:/core/ui/DefaultSearchResultList!!" + field + "}}><<currentTiddler>>|</$list></$let>")});
			});
			out.push({where: "sidebar", text: seen(h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/ui/sidebar\" $mode=\"block\"/>"))});
			out.push({where: "sidebar recent", text: h.render(wiki, "text/plain", "{{$:/plugins/tiddlyrpg-core/ui/sidebar-recent}}")});
			out.push({where: "ControlPanel License", text: seen(h.render(wiki, "text/html", "{{$:/plugins/tiddlyrpg-core/ui/controlpanel-license}}"))});
			return out;
		});
	}

	test("public: no word of a secret anywhere", function() {
		var leaks = sweep("public").filter(function(item) {
			return item.text.indexOf(WORD) !== -1 || item.text.indexOf(YEAR) !== -1;
		}).map(function(item) {
			var at = item.text.indexOf(WORD) !== -1 ? item.text.indexOf(WORD) : item.text.indexOf(YEAR);
			return item.where + ": …" + item.text.substring(Math.max(0, at - 80), at + 40) + "…";
		});
		assert.deepEqual(leaks, []);
	});

	test("the DM: every secret shows, so the sweep reaches them", function() {
		var all = sweep("dm").map(function(item) { return item.text; }).join("\n");
		["Qx7 Akte", "Qx7 Ort", "Qx7 Fest", "Qx7 Kammer", "Qx7 Nacht", "Qx7 inline", "Qx7 room", "Qx7rule", "Qx7dmg", "Qx7cap", "1399 Qx7", "Qx7src",
			"Qx7zwei", "Qx7plan", "Qx7b", "Qx7m2", "Qx7pic2", "Qx7 Plan", "Qx7 planning", "Qx7 marker text", "Qx7 Faden", "Qx7 hidden thread", YEAR].forEach(function(word) {
			assert.ok(all.indexOf(word) !== -1, word);
		});
	});
});
