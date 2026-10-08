/*
 * Views and the lock (modules/visibility.js, filters/visibility.js): the rule of dnd.visible in
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
		assert.deepEqual(inView("public", function() { return f(ALL + " +[dndvisible[]]"); }), ["Der dunkle Turm", "Baile"]);
	});

	test("a player: what is locked for one of their characters, active or former", function() {
		assert.deepEqual(inView("player:Anna", function() { return f(ALL + " +[dndvisible[]]"); }),
			["Hideout", "Friggs Traum", "Ylvas Brief", "Der dunkle Turm", "Baile"]);
		assert.deepEqual(inView("player:Jan", function() { return f(ALL + " +[dndvisible[]]"); }), ["Der dunkle Turm", "Baile"]);
	});

	test("the DM: everything", function() {
		assert.equal(inView("dm", function() { return f(ALL + " +[dndvisible[]]"); }).length, 6);
	});

	test("a player character tagged without Secret locks nothing", function() {
		assert.deepEqual(inView("public", function() { return f("[[Der dunkle Turm]dndvisible[]]"); }), ["Der dunkle Turm"]);
		// dnd.visible (functions.tid) is the same rule
		assert.equal(inView("public", function() { return h.render(wiki, "text/plain", "<$text text={{{ [[Hideout]] [[Baile]] +[dnd.visible[]] +[join[,]] }}}/>"); }), "Baile");
	});

	test("an active character without the field player counts as its own player", function() {
		h.add(wiki, {title: "Solo", tags: "Player"});
		h.add(wiki, {title: "Solos Geheimnis", tags: "Event Solo Secret"});
		try {
			assert.deepEqual(inView("player:Solo", function() { return f("[[Solos Geheimnis]dndvisible[]]"); }), ["Solos Geheimnis"]);
		} finally {
			wiki.deleteTiddler("Solo");
			wiki.deleteTiddler("Solos Geheimnis");
		}
	});
});

test.describe("default view", function() {
	test.afterEach(function() {
		["$:/status/IsReadOnly", "$:/config/dndwiki/view/dm-published"].forEach(function(title) { wiki.deleteTiddler(title); });
		h.setView(wiki, null);
	});

	test("editable wiki: the DM", function() {
		assert.deepEqual(f("[dndview[]]"), ["dm"]);
	});

	test("read-only copy: public", function() {
		h.add(wiki, {title: "$:/status/IsReadOnly", text: "yes"});
		assert.deepEqual(f("[dndview[]]"), ["public"]);
		assert.deepEqual(f("[[Hideout]dndvisible[]]"), []);
	});

	test("read-only copy: dm only if published", function() {
		h.add(wiki, {title: "$:/status/IsReadOnly", text: "yes"});
		h.setView(wiki, "dm");
		assert.deepEqual(f("[dndview[]]"), ["public"]);
		assert.ok(f("[dndview:choices[]]").indexOf("dm") === -1);
		h.add(wiki, {title: "$:/config/dndwiki/view/dm-published", text: "yes"});
		assert.deepEqual(f("[dndview[]]"), ["dm"]);
		assert.ok(f("[dndview:choices[]]").indexOf("dm") !== -1);
	});

	test("an unknown value counts as public", function() {
		h.setView(wiki, "whatever");
		assert.deepEqual(f("[dndview:mode[]]"), ["public"]);
	});
});

test.describe("players and characters", function() {
	test("choices: public, the players of active characters, dm", function() {
		assert.deepEqual(f("[dndview:choices[]]"), ["public", "player:Anna", "player:Jan", "dm"]);
	});

	test("characters, active and former; their player", function() {
		assert.deepEqual(f("[[Frigg]] [[Ylva]] [[Grum]] +[dndcharacter[]]"), ["Frigg", "Ylva"]);
		assert.deepEqual(f("[[Ylva]dndplayer[]]"), ["Anna"]);
		assert.deepEqual(f("[[Anna]dndplayedby[]]"), ["Frigg"]);
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
		return h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/dndwiki-core/ui/view-switcher\" $mode=\"block\"/>");
	}

	test("the button names the active view", function() {
		assert.match(control(), /class="dnd-view-current">DM</);
		assert.match(inView("player:Anna", control), /class="dnd-view-current">Anna \(Frigg\)</);
		assert.match(inView("public", control), /class="dnd-view-current">Öffentlich</);
	});

	test("page class per mode", function() {
		var page = "[all[shadows+tiddlers]tag[$:/tags/ClassFilters/PageTemplate]!is[draft]] :map:flat[subfilter{!!text}]";
		assert.ok(f(page).indexOf("dnd-view-dm") !== -1);
		assert.ok(inView("player:Jan", function() { return f(page); }).indexOf("dnd-view-player") !== -1);
		assert.ok(inView("public", function() { return f(page); }).indexOf("dnd-view-public") !== -1);
	});
});

test.describe("a locked tiddler", function() {
	test("marker for who sees it: the DM and its players", function() {
		assert.match(h.view(wiki, "Friggs Traum"), /class="dnd-secret-marker">.*Geheim: Frigg</s);
		assert.match(inView("player:Anna", function() { return h.view(wiki, "Friggs Traum"); }), /Geheim: Frigg/);
		assert.match(h.view(wiki, "Geheimbund"), /Geheim: nur DM/);
	});

	test("opened in a view that does not see it: no body, tags, marker, relations, date line", function() {
		var html = inView("public", function() { return h.view(wiki, "Geheimbund"); });
		assert.doesNotMatch(html, /DM only\.|tc-tag-list-item|dnd-secret-marker|tc-tab-set|dnd-dateline/);
		assert.match(h.view(wiki, "Geheimbund"), /DM only\./);
	});
});

test.describe("Player hub", function() {
	test("cards of the active characters, the former ones below", function() {
		var html = h.render(wiki, "text/html", "{{Player}}");
		assert.match(html, /dnd-player-card"[^>]*>.*Frigg.*Anna/s);
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
		var list = "<$macrocall $name=\"list-tagged-draggable\" tag=\"Frigg\" subFilter=\"dnd.visible[]\"/>";
		var shown = inView("public", function() { return h.render(wiki, "text/plain", list); });
		assert.ok(shown.indexOf("Der dunkle Turm") !== -1 && shown.indexOf("Friggs Traum") === -1, shown);
		assert.ok(h.render(wiki, "text/plain", list).indexOf("Friggs Traum") !== -1);
	});

	test("tag area through the cascade, with the pill template of the plugin", function() {
		assert.deepEqual(f("[[Hafenfest]] :cascade[all[shadows+tiddlers]tag[$:/tags/ViewTemplateTagsFilter]!is[draft]get[text]]"), ["$:/plugins/dndwiki-core/templates/tags"]);
	});

	test("sidebar: the core tabs for the DM, Open and Recent for everyone else", function() {
		var segment = "<$transclude $tiddler=\"$:/plugins/dndwiki-core/ui/sidebar\" $mode=\"block\"/>";
		assert.equal(wiki.getTiddlerText("$:/config/SideBarSegments/Visibility/$:/core/ui/SideBarSegments/tabs"), "hide");
		assert.match(h.render(wiki, "text/html", segment), /Mehr|More/);
		var pub = inView("public", function() { return h.render(wiki, "text/html", segment); });
		assert.doesNotMatch(pub, />(Mehr|More)</);
		var recent = inView("public", function() { return h.render(wiki, "text/plain", "{{$:/plugins/dndwiki-core/ui/sidebar-recent}}"); });
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
		var path = function(title) { return h.render(wiki, "text/plain", "<<dnd.locationpath>>", {currentTiddler: title}).replace(/\s+/g, ""); };
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
			template: "$:/plugins/dndwiki-core/graph/templates/dnd-graph", filter: "[[Bote]] [[Geheimbund]] [[Town]]"});
		try {
			var view = "<$graph.view $tiddler=\"$:/graph/Views\"/>";
			assert.deepEqual(Object.keys(inView("public", function() { return h.graph(wiki, view); }).nodes).sort(), ["Bote", "Town"]);
			assert.ok(h.graph(wiki, view).nodes.Geheimbund);
			var ego = "<$graph.view $tiddler=\"$:/plugins/dndwiki-core/graph/ego\"/>";
			assert.ok(!inView("public", function() { return h.graph(wiki, ego, {currentNode: "Bote"}); }).nodes.Geheimbund);
			assert.ok(h.graph(wiki, ego, {currentNode: "Bote"}).nodes.Geheimbund);
		} finally {
			wiki.deleteTiddler("$:/graph/Views");
		}
	});
});
