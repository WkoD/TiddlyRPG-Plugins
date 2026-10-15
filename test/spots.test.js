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

// The maps of a location with its spots below them (viewtemplates/location)
function mapBlock(title) {
	return h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/viewtemplates/location\" mode=\"block\"/>", {currentTiddler: title, storyTiddler: title});
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

	test("spots: heading of a joined spot links to the tiddler", function() {
		assert.match(mapBlock("Town"), /<h3 class="trpg-spot" data-trpg-anchor="spot-tavern"><a class="tc-tiddlylink tc-tiddlylink-resolves" href="#Tavern">Tavern<\/a><\/h3>/);
	});

	test("tiddler: joins a spot to a tiddler of another name; relink renames it in both forms", function() {
		h.add(wiki, {title: "Stammhaus", tags: "Location", text: "A house."});
		h.add(wiki, {title: "Gut", tags: "Location", text: "An estate.\n\n<<spot \"Anwesen\" tiddler:\"Stammhaus\">>\n\nOld.\n\n<$spot name=\"Hof\" tiddler=\"Stammhaus\">\n\nYard.\n\n</$spot>\n"});
		try {
			assert.deepEqual(f("[[Gut]spottargets[]]"), ["Stammhaus"]);
			assert.match(mapBlock("Gut"), /data-trpg-anchor="spot-anwesen"><a [^>]*href="#Stammhaus">Anwesen<\/a>/);
			wiki.renameTiddler("Stammhaus", "Neues Haus");
			var text = wiki.getTiddler("Gut").fields.text;
			assert.ok(text.indexOf("<<spot \"Anwesen\" tiddler:\"Neues Haus\">>") !== -1 && text.indexOf("tiddler=\"Neues Haus\"") !== -1, text);
		} finally {
			["Stammhaus", "Neues Haus", "Gut"].forEach(function(title) { wiki.deleteTiddler(title); });
		}
	});

	test("spots: a link in the name stays a link", function() {
		assert.match(mapBlock("Town"), /data-trpg-anchor="spot-tempel-von-chauntea">Tempel von <a [^>]*href="#Chauntea">Chauntea<\/a><\/h3>/);
	});

	test("spots: the texts follow their headings", function() {
		var html = mapBlock("Town");
		assert.ok(html.indexOf("spot-old-well") < html.indexOf("Deep and dark.") && html.indexOf("Deep and dark.") < html.indexOf("spot-tempel-von-chauntea"), html);
	});

	test("location without map image: the graph with its buttons, the spots", function() {
		h.add(wiki, {title: "Village", tags: "Location", text: "Small.\n\n<<spot \"Inn\">>\n\nBeds."});
		try {
			var html = mapBlock("Village");
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

	test("named: location: and spot:, relink renames the location", function() {
		h.add(wiki, {title: "Hafenort", tags: "Location", text: "Port.\n\n<<spot \"Kai\">>\n\nThe quay."});
		h.add(wiki, {title: "Anlegen", tags: "Event", date: "1351", text: "<<date>>\n\nAt <<spotlink location:\"Hafenort\" spot:\"Kai\">>."});
		try {
			assert.deepEqual(f("[[Hafenort]spotlinked[]]"), ["Anlegen"]);
			assert.ok(h.view(wiki, "Anlegen").indexOf("Kai (Hafenort)") !== -1);
			wiki.renameTiddler("Hafenort", "Neuhafen");
			assert.ok(wiki.getTiddler("Anlegen").fields.text.indexOf("<<spotlink location:\"Neuhafen\" spot:\"Kai\">>") !== -1, wiki.getTiddler("Anlegen").fields.text);
		} finally {
			["Hafenort", "Neuhafen", "Anlegen"].forEach(function(title) { wiki.deleteTiddler(title); });
		}
	});

	test("link text before |, link to the location", function() {
		assert.match(body, /<a class="tc-tiddlylink tc-tiddlylink-resolves" href="#Town">old well<\/a>/);
	});

	test("pill: spot (location)", function() {
		assert.ok(body.indexOf("Old Well (Town)") !== -1, body);
	});

	test("missing spot: link to the location and an error below the title", function() {
		assert.ok(body.indexOf("nicht gefunden") === -1, "not in the text");
		assert.ok(h.view(wiki, "Well Night").indexOf("Spot „Lost Spot“ in Town nicht gefunden") !== -1);
		assert.ok(h.checkKeys(wiki, "Well Night", "spots").indexOf("Spot/Missing") !== -1);
	});

	test("missing location: missing link and an error below the title", function() {
		assert.match(body, /tc-tiddlylink-missing" href="#Atlantis">Harbour<\/a>/);
		assert.ok(h.view(wiki, "Well Night").indexOf("Ort „Atlantis“ gibt es nicht") !== -1);
	});

	test("no messages in the published copy", function() {
		h.add(wiki, {title: "$:/status/IsReadOnly", text: "yes"});
		try {
			var html = h.view(wiki, "Well Night");
			assert.ok(html.indexOf("nicht gefunden") === -1 && html.indexOf("gibt es nicht") === -1);
		} finally {
			wiki.deleteTiddler("$:/status/IsReadOnly");
		}
	});

	test("a spotlink in a section the view does not see gives no message there", function() {
		h.add(wiki, {title: "Geheimweg", tags: "Event", date: "1351, 1352", text: "<<date>>\n\nOpen.\n\n<<secret>><<date>>\n\nAt <<spotlink \"Town\" \"Hidden Door\">>."});
		try {
			assert.deepEqual(h.checkKeys(wiki, "Geheimweg", "spots"), ["Spot/Missing"]);
			h.inView(wiki, "public", function() {
				assert.deepEqual(h.checkKeys(wiki, "Geheimweg", "spots"), []);
			});
		} finally {
			wiki.deleteTiddler("Geheimweg");
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
