/*
 * Spots of a location (modules/spots.js, filters/spots.js): reading them from the body, plain
 * names with links, the joined tiddler, the intro in the body, the spots in the map tab with
 * their headings and jump marks, battle map tabs, spots in notes of the DM. <<spotlink>>: the
 * second parameter, link and pill in a dated section, missing spot or location, the events that
 * reference a place.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var wiki;

test.before(function() {
	return h.boot().then(function($tw) {
		wiki = $tw.wiki;
		h.setLanguage(wiki, "de-DE");
		h.add(wiki, {title: "Well Night", tags: "Event", date: "1351-08-02", text: "<<date>>\n\nIn the <<spotlink \"Town\" \"[[old well|Old Well]]\">>, then <<spotlink \"Town\" \"Lost Spot\">> and <<spotlink \"Atlantis\" \"Harbour\">>."});
	});
});

function f(text, variables) {
	return Array.from(h.filter(wiki, text, variables));
}

function mapTab(title) {
	return h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/viewtemplates/location/map\" mode=\"block\"/>", {currentTiddler: title});
}

test.describe("reading", function() {
	test("plain names in document order", function() {
		assert.deepEqual(f("[[Town]spots[]]"), ["Tavern", "Old Well", "Tempel von Chauntea", "Guild"]);
	});

	test("names as written", function() {
		assert.ok(f("[[Town]spots:raw[]]").indexOf("Tempel von [[Chauntea]]") !== -1);
	});

	test("joined tiddlers: a tiddler with the plain name", function() {
		assert.deepEqual(f("[[Town]spottargets[]]"), ["Tavern", "Guild"]);
	});

	test("second parameter joins another tiddler", function() {
		assert.deepEqual(f("[[Kantine]spottarget[Grum]]"), ["Grum"]);
	});

	test("text of a spot (tooltip on the map): without its heading", function() {
		var text = h.render(wiki, "text/plain", "<$trpg-body $tiddler=\"Town\" $mode=\"block\" $only=\"spot\" $name=\"Old Well\" $marker=\"no\"/>");
		assert.equal(text.trim(), "Deep and dark.");
	});

	test("plain name and anchor of a name with a link", function() {
		var n = {n: "Tempel von [[Chauntea]]"};
		assert.deepEqual(f("[<n>spotplain[]]", n), ["Tempel von Chauntea"]);
		assert.deepEqual(f("[<n>spotanchor[]]", n), ["spot-tempel-von-chauntea"]);
	});

	test("anchor with umlauts", function() {
		assert.deepEqual(f("[[Zum Trunkenen Eulenbären]spotanchor[]]"), ["spot-zum-trunkenen-eulenbaren"]);
	});

	test("reference: link with text, link alone, plain name", function() {
		assert.deepEqual(f("[<s>spotref:text[]] [<s>spotref:spot[]]", {s: "[[old well|Old Well]]"}), ["old well", "Old Well"]);
		assert.deepEqual(f("[<s>spotref:spot[]]", {s: "[[Old Well]]"}), ["Old Well"]);
		assert.deepEqual(f("[[Old Well]spotref:text[]]"), ["Old Well"]);
	});

	test("owner of a joined spot", function() {
		assert.deepEqual(f("[[Tavern]spotowner[]]"), ["Town"]);
	});

	test("a spot in a note of the DM is not read", function() {
		h.add(wiki, {title: "Noted", tags: "Location", text: "Intro.\n\n@@.tc-tiddler-frame\n<<spot \"Hidden\">>\n@@"});
		try {
			assert.deepEqual(f("[[Noted]spots[]]"), []);
		} finally {
			wiki.deleteTiddler("Noted");
		}
	});
});

test.describe("body and map tab", function() {
	test("the body of a location shows the text without its spots", function() {
		var body = h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/templates/body-sections\" mode=\"block\"/>", {currentTiddler: "Town"});
		assert.ok(body.indexOf("A town.") !== -1 && body.indexOf("Deep and dark") === -1 && body.indexOf("trpg-spot") === -1, body);
	});

	test("body filter picks the sections template for bodies with sections only", function() {
		var cascade = " :cascade[all[shadows+tiddlers]tag[$:/tags/ViewTemplateBodyFilter]!is[draft]get[text]]";
		assert.deepEqual(f("[[Town]]" + cascade), ["$:/plugins/tiddlyrpg-core/templates/body-sections"]);
		assert.notDeepEqual(f("[[Baile]]" + cascade), ["$:/plugins/tiddlyrpg-core/templates/body-sections"]);
	});

	test("map tab: heading of a joined spot links to the tiddler", function() {
		assert.match(mapTab("Town"), /<h3 class="trpg-spot" data-trpg-anchor="spot-tavern"><a class="tc-tiddlylink tc-tiddlylink-resolves" href="#Tavern">Tavern<\/a><\/h3>/);
	});

	test("map tab: a link in the name stays a link", function() {
		assert.match(mapTab("Town"), /data-trpg-anchor="spot-tempel-von-chauntea">Tempel von <a [^>]*href="#Chauntea">Chauntea<\/a><\/h3>/);
	});

	test("map tab: the texts follow their headings", function() {
		var html = mapTab("Town");
		assert.ok(html.indexOf("spot-old-well") < html.indexOf("Deep and dark.") && html.indexOf("Deep and dark.") < html.indexOf("spot-tempel-von-chauntea"), html);
	});

	test("location without map image: the graph with its buttons, the spots", function() {
		h.add(wiki, {title: "Village", tags: "Location", text: "Small.\n\n<<spot \"Inn\">>\n\nBeds."});
		try {
			var html = mapTab("Village");
			assert.ok(html.indexOf("spot-inn") !== -1 && html.indexOf("trpg-map-buttons") !== -1 && html.indexOf('class="trpg-map"') !== -1, html);
		} finally {
			wiki.deleteTiddler("Village");
		}
	});
});

test.describe("spotlink", function() {
	var body;

	test.before(function() {
		body = h.render(wiki, "text/html", "<$transclude $tiddler=\"Well Night\" mode=\"block\"/>", {currentTiddler: "Well Night", storyTiddler: "Well Night"});
	});

	test("link text before |, link to the location", function() {
		assert.match(body, /<a class="tc-tiddlylink tc-tiddlylink-resolves" href="#Town">old well<\/a>/);
	});

	test("pill: spot (location)", function() {
		assert.ok(body.indexOf("Old Well (Town)") !== -1, body);
	});

	test("missing spot: link to the location and a hint", function() {
		assert.ok(body.indexOf("Spot „Lost Spot“ in Town nicht gefunden") !== -1, body);
	});

	test("missing location: missing link and a hint", function() {
		assert.match(body, /tc-tiddlylink-missing" href="#Atlantis">Harbour<\/a>/);
		assert.ok(body.indexOf("Ort „Atlantis“ gibt es nicht") !== -1);
	});

	test("no hints in the published copy", function() {
		h.add(wiki, {title: "$:/status/IsReadOnly", text: "yes"});
		try {
			var html = h.render(wiki, "text/html", "<$transclude $tiddler=\"Well Night\" mode=\"block\"/>", {currentTiddler: "Well Night"});
			assert.ok(html.indexOf("nicht gefunden") === -1 && html.indexOf("gibt es nicht") === -1);
		} finally {
			wiki.deleteTiddler("$:/status/IsReadOnly");
		}
	});

	test("a spot joined to a tiddler opens the tiddler", function() {
		var html = h.render(wiki, "text/html", "<<spotlink \"Town\" \"Tavern\">>");
		assert.match(html, /href="#Tavern">Tavern<\/a>/);
	});

	test("a spotlink in a note of the DM is not counted", function() {
		h.add(wiki, {title: "Note Event", tags: "Event", date: "1351", text: "<<date>>\n\n@@.tc-tiddler-frame\n<<spotlink \"Neighbour\" \"X\">>\n@@"});
		try {
			assert.deepEqual(f("[[Neighbour]spotlinked[]]"), []);
		} finally {
			wiki.deleteTiddler("Note Event");
		}
	});

	test("events that reference a place", function() {
		assert.deepEqual(f("[[Town]spotlinked[]]"), ["Well Night"]);
	});

	test("in the event list of the location and above, not elsewhere", function() {
		["Town", "Kingdom", "Continent"].forEach(function(title) {
			assert.ok(h.view(wiki, title).indexOf("Well Night") !== -1, title);
		});
		assert.ok(h.view(wiki, "Neighbour").indexOf("Well Night") === -1);
	});
});
