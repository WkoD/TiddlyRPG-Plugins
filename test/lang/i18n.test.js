/*
 * Translation mechanics: display names (trpgtitle, tag pill), the tag hook that stores translated
 * tag names under the internal name, the search for translated hub names, translated edge labels
 * and the refresh of date output after a language change or a change of the calendar texts.
 * Plain expected output in one language belongs to the file of its topic.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("../helpers");

var $tw, wiki;

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = tw.wiki;
	});
});

function f(text, variables) {
	return h.filter(wiki, text, variables).join();
}

// The ego graph of a tiddler and its edges as "from -> to: label", sorted
function egoGraph(node) {
	return h.graph(wiki, "<$graph.view $tiddler=\"$:/plugins/tiddlyrpg-core/graph/ego\"/>", {currentNode: node});
}

function edgeLabels(graph) {
	return graph.edges.map(function(edge) {
		return edge.from + " -> " + edge.to + (edge.props.label ? ": " + edge.props.label : "");
	}).sort();
}

// Tags of a tiddler after the save hook, joined with "|" (the array comes from TiddlyWiki's own
// context, so a deep comparison with a plain array fails on the prototype)
function saveTags(tags) {
	return $tw.hooks.invokeHook("th-saving-tiddler", new $tw.Tiddler({title: "New", tags: tags})).fields.tags.join("|");
}

test.describe("de-DE", function() {
	test.before(function() {
		h.setLanguage(wiki, "de-DE");
	});

	test("trpgtitle hub", function() {
		assert.equal(f("[[Location]trpgtitle[]]"), "Ort");
	});

	test("trpgtitle without existing parent", function() {
		assert.equal(f("[[Foo/Campaign]trpgtitle[]]"), "Foo/Campaign");
	});

	test("trpgtitle TBC/Campaign", function() {
		assert.equal(f("[[TBC/Campaign]trpgtitle[]]"), "TBC/Kampagne");
	});

	test("tag pill translated", function() {
		assert.ok(h.view(wiki, "Insel Avalon").indexOf(">Ort</span>") !== -1);
	});

	test("tag hook: Ort -> Location", function() {
		assert.equal(saveTags(["Ort", "Haus Kemri"]), "Location|Haus Kemri");
	});

	test("edge labels translated (Edge/<type>)", function() {
		assert.deepEqual(edgeLabels(egoGraph("Guildmaster")), [
			"Guild -> Town: kontrolliert",
			"Guildmaster -> Guild: führt",
			"Guildmaster -> Town: in"
		]);
	});

	test.describe("search", function() {
		var search;

		test.before(function() {
			search = wiki.getTiddler("$:/core/ui/DefaultSearchResultList").fields["first-search-filter"];
		});

		test("search: translated hub name finds the hub", function() {
			assert.ok(h.filter(wiki, search, {userInput: "Ort"}).indexOf("Location") !== -1);
		});

		test("search: Kampagne finds the campaign hub", function() {
			assert.ok(h.filter(wiki, search, {userInput: "Kampagne"}).indexOf("Campaign") !== -1);
		});
	});
});

test.describe("en-GB", function() {
	test.before(function() {
		h.setLanguage(wiki, "en-GB");
	});

	test("de tag still mapped while en is active", function() {
		assert.equal(saveTags(["Ort"]), "Location");
	});
});

test.describe("refresh", function() {
	var widget, container;

	test.before(function() {
		h.setLanguage(wiki, "de-DE");
		var text = "\\import [subfilter{$:/core/config/GlobalImportFilter}]\n<<dateformat date:\"1351-01-31\">>",
			parser = wiki.parseText("text/vnd.tiddlywiki", text);
		widget = wiki.makeWidget(parser, {document: $tw.fakeDocument});
		container = $tw.fakeDocument.createElement("div");
		widget.render(container, null);
	});

	test("dateformat refreshes on a language change", function() {
		var before = container.textContent;
		h.setLanguage(wiki, "en-GB");
		widget.refresh({"$:/language": {modified: true}});
		var after = container.textContent;
		assert.ok(before.indexOf("Mittwinter") !== -1 && after.indexOf("Midwinter") !== -1, [before, after].join(" / "));
	});

	test("edge labels refresh on a language change", function() {
		h.setLanguage(wiki, "de-DE");
		try {
			var graph = egoGraph("Guildmaster");
			assert.ok(edgeLabels(graph).indexOf("Guildmaster -> Guild: führt") !== -1);
		} finally {
			h.setLanguage(wiki, "en-GB");
		}
		graph = graph.refresh({"$:/language": {modified: true}});
		assert.ok(edgeLabels(graph).indexOf("Guildmaster -> Guild: leads") !== -1, edgeLabels(graph).join(" / "));
	});

	test("dateformat refreshes on a change of the calendar texts", function() {
		// Rename a festival in the language keys
		var title = "$:/tiddlyrpg/language/en-GB/Calendar/Harptos/Festival/Midwinter",
			changes = {};
		changes[title] = {modified: true};
		h.add(wiki, {title: title, text: "Deep Midwinter"});
		try {
			widget.refresh(changes);
			assert.ok(container.textContent.indexOf("Deep Midwinter") !== -1, container.textContent);
		} finally {
			wiki.deleteTiddler(title);
		}
	});
});
