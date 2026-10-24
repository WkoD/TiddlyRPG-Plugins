/*
 * The categories of the base types (modules/categories.js, filters/categories.js) and their
 * message (checks/categories.js): the item categories and Folk under Information, a category of
 * the campaign (also under the tag before 2.2.0), the hub Information with its categories and the
 * hub of a category, the pills of the form, "+" on a category hub, and the relation folk (a
 * person, player character or creature names its folk). The hub Item: items.test.js.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var wiki, $tw;

var FIXTURES = [
	{title: "Nichny", tags: "Information Folk", text: "Cat folk."},
	{title: "Yuan-Ti", tags: "Information Folk", text: "Snake folk."},
	{title: "Ki-Ra", tags: "Person", folk: "Nichny", text: "A Nichny."},
	{title: "Halbblut", tags: "Person", folk: "Nichny [[Yuan-Ti]]", text: "Of both."},
	{title: "Pantherkrieger", tags: "Creature", folk: "Nichny", text: "Values of a warrior."}
];

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		h.setLanguage(wiki, "de-DE");
		FIXTURES.forEach(function(fields) { h.add(wiki, fields); });
	});
});

function f(text) {
	return Array.from(h.filter(wiki, text));
}

function keys(title) {
	return h.checkKeys(wiki, title, "categories");
}

function withTiddlers(list, fn) {
	list.forEach(function(fields) { h.add(wiki, fields); });
	try {
		return fn();
	} finally {
		list.forEach(function(fields) { wiki.deleteTiddler(fields.title); });
	}
}

// True if the strings occur in the text in this order (each searched after the one before)
function inOrder(text, strings) {
	var from = 0;
	return strings.every(function(s) {
		var p = text.indexOf(s, from);
		from = p + s.length;
		return p !== -1;
	});
}

// Renders a template for currentTiddler, finds the button whose class matches and whose text is
// <label> (any text without), runs its actions; the messages tm-new-tiddler it sent
function press(template, current, cls, label) {
	var parser = wiki.parseText("text/vnd.tiddlywiki", "\\import [subfilter{$:/core/config/GlobalImportFilter}]\n{{||" + template + "}}"),
		root = wiki.makeWidget(parser, {document: $tw.fakeDocument, variables: {currentTiddler: current}}),
		caught = [],
		found = null;
	root.render($tw.fakeDocument.createElement("div"), null);
	root.addEventListener("tm-new-tiddler", function(event) { caught.push(event.paramObject); return false; });
	(function walk(w) {
		if(w.parseTreeNode && w.parseTreeNode.type === "button" && cls.test(w.getAttribute("class", "")) &&
			(!label || (w.domNodes[0] && w.domNodes[0].textContent === label))) {
			found = w;
		}
		(w.children || []).forEach(walk);
	})(root);
	assert.ok(found, label || String(cls));
	found.invokeActions(found, {});
	return caught;
}

test.describe("categories", function() {
	test("the item categories and Folk; their base types; a category is a type", function() {
		var categories = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/categories.js"),
			types = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/types.js");
		assert.deepEqual(f("[trpgcategories[]]"), ["Book", "Consumable", "Equipment", "Folk"]);
		assert.deepEqual(f("[trpgcategories[Information]]"), ["Folk"]);
		assert.deepEqual(f("[trpgcategories[Material]]"), ["Book", "Consumable", "Equipment"]);
		assert.deepEqual(f("[[Book]] [[Folk]] [[Item]] +[trpgcategorybases[]]"), ["Artifact", "Item", "Material", "Information"]);
		assert.ok(categories.isCategory(wiki, "Folk") && !categories.isCategory(wiki, "Information"));
		assert.ok(types.isType(wiki, "Folk"));
		assert.deepEqual(Array.from(types.of(wiki, "Nichny")), ["Information", "Folk"]);
	});

	test("a category of the campaign: without tiddlyrpg-bases one of the items; under the tag before 2.2.0 too", function() {
		withTiddlers([{title: "Rune", tags: "$:/tags/tiddlyrpg/Category"}, {title: "Glyphe", tags: "$:/tags/tiddlyrpg/ItemKind"},
			{title: "Mythos", tags: "$:/tags/tiddlyrpg/Category", "tiddlyrpg-bases": "Information"}], function() {
			assert.deepEqual(f("[[Rune]] [[Glyphe]] +[trpgcategorybases[]]"), ["Artifact", "Item", "Material"]);
			assert.deepEqual(f("[trpgcategories[Information]]"), ["Folk", "Mythos"]);
			assert.ok(f("[trpgtypelist[]]").indexOf("Glyphe") !== -1);
		});
	});
});

test.describe("categories/base", function() {
	test("a category without a base type of it; the text names them", function() {
		withTiddlers([{title: "Loose Book", tags: "Book"}, {title: "Loose Folk", tags: "Folk"}, {title: "Wrong Folk", tags: "Folk Item"}], function() {
			var book = h.checks(wiki, "Loose Book", "categories"),
				folk = h.checks(wiki, "Loose Folk", "categories");
			assert.deepEqual(book.map(function(m) { return m.key; }), ["Check/Categories/NoBase"]);
			assert.equal(book[0].text, "Tags prüfen: Buch braucht dazu einen Grundtyp: Artefakt, Gegenstand, Material");
			assert.equal(book[0].fix, undefined, "several base types: a decision");
			assert.equal(folk[0].text, "Tags prüfen: Volk braucht dazu einen Grundtyp: Information");
			assert.deepEqual(JSON.parse(JSON.stringify(folk[0].fix)), {kind: "tag", tag: "Information"});
			assert.deepEqual(keys("Wrong Folk"), ["Check/Categories/NoBase"], "a base type of another category does not count");
		});
	});

	test("no message: with a base type (also under a translated tag), the hubs, a category of the campaign with its base", function() {
		withTiddlers([{title: "Volksdraft", tags: "Volk Information"}, {title: "Rune", tags: "$:/tags/tiddlyrpg/ItemKind"},
			{title: "Hagalaz", tags: "Item Rune"}], function() {
			["Nichny", "Volksdraft", "Hagalaz", "Book", "Folk", "Information", "Item"].forEach(function(title) {
				assert.deepEqual(keys(title), [], title);
			});
		});
	});

	test("a category of the campaign under the tag before 2.2.0 counts", function() {
		withTiddlers([{title: "Rune", tags: "$:/tags/tiddlyrpg/ItemKind"}, {title: "Loose Rune", tags: "Rune"}], function() {
			assert.deepEqual(keys("Loose Rune"), ["Check/Categories/NoBase"]);
		});
	});

	test("message below the title, not in the published copy", function() {
		withTiddlers([{title: "Loose Folk", tags: "Folk"}], function() {
			assert.ok(h.view(wiki, "Loose Folk").indexOf("Tags prüfen: Volk braucht dazu einen Grundtyp: Information") !== -1);
			h.add(wiki, {title: "$:/status/IsReadOnly", text: "yes"});
			try {
				assert.ok(h.view(wiki, "Loose Folk").indexOf("Tags prüfen") === -1);
			} finally {
				wiki.deleteTiddler("$:/status/IsReadOnly");
			}
		});
	});
});

test.describe("hubs", function() {
	test("Information: the entries without a category first, then one heading per category", function() {
		var hub = h.body(wiki, "Information");
		assert.ok(inOrder(hub, ["Spielerstufe", "Völker", "Nichny", "Yuan-Ti"]), hub);
		assert.equal(hub.indexOf("Nichny"), hub.lastIndexOf("Nichny"), "once");
	});

	test("the hub of a category lists only its own entries, without heading", function() {
		var hub = h.body(wiki, "Folk");
		assert.ok(inOrder(hub, ["Nichny", "Yuan-Ti"]), hub);
		assert.ok(["Spielerstufe", "Völker", "Kalender"].every(function(s) { return hub.indexOf(s) === -1; }), hub);
		assert.match(h.view(wiki, "Folk"), /<h2 class="tc-title">Volk<span class="trpg-hub-count">2<\/span><\/h2>/);
	});

	test("a heading only with an entry the view sees", function() {
		withTiddlers([{title: "Nichny", tags: "Information Folk Frigg Secret"}, {title: "Yuan-Ti", tags: "Information Folk Frigg Secret"}], function() {
			var pub = h.inView(wiki, "public", function() { return h.body(wiki, "Information"); }),
				frigg = h.inView(wiki, "player:Anna", function() { return h.body(wiki, "Information"); });
			assert.equal(pub.indexOf("Völker"), -1, pub);
			assert.equal(pub.indexOf("Nichny"), -1, pub);
			assert.ok(inOrder(frigg, ["Völker", "Nichny"]), frigg);
		});
		FIXTURES.slice(0, 2).forEach(function(fields) { h.add(wiki, fields); });
	});

	["Information", "Folk"].forEach(function(title) {
		test("no pragma text in " + title, function() {
			assert.doesNotMatch(h.body(wiki, title), /(^|\n)\s*(define|procedure|function|whitespace|import) /);
		});
	});
});

test.describe("editor", function() {
	test("Information offers the pill Volk, an item its own categories, a person none", function() {
		var row = function(tags) {
			h.add(wiki, {title: "Draft of 'Ding'", "draft.of": "Ding", tags: tags, text: ""});
			var text = h.render(wiki, "text/plain", "{{||$:/plugins/tiddlyrpg-core/editor/form}}", {currentTiddler: "Draft of 'Ding'"});
			wiki.deleteTiddler("Draft of 'Ding'");
			var at = text.indexOf("Kategorie");
			return at === -1 ? "" : ["Volk", "Buch"].filter(function(s) { return text.indexOf(s, at) !== -1; }).join(" ");
		};
		assert.deepEqual(["Information", "Item", "Person"].map(row), ["Volk", "Buch", ""]);
	});

	test("the pill sets and takes out the tag; Information stays", function() {
		var draft = "Draft of 'Ding'";
		h.add(wiki, {title: draft, "draft.of": "Ding", tags: "Information", text: ""});
		try {
			press("$:/plugins/tiddlyrpg-core/editor/form", draft, /trpg-choice/, "Volk");
			assert.deepEqual(Array.from(wiki.getTiddler(draft).fields.tags), ["Information", "Folk"]);
			press("$:/plugins/tiddlyrpg-core/editor/form", draft, /trpg-choice/, "Volk");
			assert.deepEqual(Array.from(wiki.getTiddler(draft).fields.tags), ["Information"]);
		} finally {
			wiki.deleteTiddler(draft);
		}
	});

	test("+ on Folk: a new tiddler with Folk and Information at once, no list of base types", function() {
		var plus = (h.view(wiki, "Folk").match(/<button[^>]*trpg-hub-plus[^>]*>/) || [""])[0];
		assert.match(plus, /title="Neu: Volk"/);
		assert.doesNotMatch(plus, /aria-expanded/);
		var caught = press("$:/plugins/tiddlyrpg-core/ui/hub-new", "Folk", /trpg-hub-plus/);
		assert.equal(caught.length, 1);
		assert.equal(caught[0].tags, "Folk Information");
		assert.equal(press("$:/plugins/tiddlyrpg-core/ui/hub-new", "Location", /trpg-hub-plus/)[0].tags, "Location");
	});
});

test.describe("relation folk", function() {
	test("what it names, its way back, several folks", function() {
		var form = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/form.js");
		assert.deepEqual(f("[[Ki-Ra]relationtargets[folk]]"), ["Nichny"]);
		assert.deepEqual(f("[[Halbblut]relationtargets[folk]]"), ["Nichny", "Yuan-Ti"]);
		assert.deepEqual(f("[[Nichny]relationsources[folk]]").sort(), ["Halbblut", "Ki-Ra", "Pantherkrieger"]);
		assert.deepEqual(f("[[folk]relationcandidates[]] +[sort[]]"), ["Nichny", "Yuan-Ti"]);
		assert.ok(!form.single(wiki, "Ki-Ra", "folk"), "a person may belong to two folks");
		assert.deepEqual(f("[[folk]relationlabel[]]"), ["gehört zu"]);
		assert.deepEqual(f("[[folk]relationaxis[]]"), ["$:/config/tiddlyrpg/graph/axes/family"]);
		assert.deepEqual(f("[[Nichny]] [[Ki-Ra]] :map[relationkind[]]"), ["folk", "person"]);
		["Person", "Player", "Creature"].forEach(function(type) {
			assert.ok(f("[[$:/config/tiddlyrpg/form/" + type + "]get[more]enlist-input[]]").indexOf("folk") !== -1, type);
		});
	});

	test("the relation list: Volk forward, Angehörige back; the relations block on a folk", function() {
		var list = function(self) {
			return h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/viewtemplates/relations/list\" mode=\"block\"/>", {self: self, currentTiddler: self});
		};
		assert.match(list("Ki-Ra"), /Volk<span class="trpg-relations-count">/);
		assert.match(list("Nichny"), /Angehörige<span class="trpg-relations-count">/);
		assert.match(h.view(wiki, "Nichny"), /Angehörige/);
	});

	test("the ego graph: the edge and the colour of Folk", function() {
		var graph = h.graph(wiki, "<$graph.view $tiddler=\"$:/plugins/tiddlyrpg-core/graph/ego\"/>", {currentNode: "Ki-Ra"});
		assert.equal(graph.nodes.Nichny.color, wiki.getTiddler("Folk").fields.color);
		assert.ok(graph.edges.some(function(edge) { return edge.from === "Ki-Ra" && edge.to === "Nichny" && edge.props.label === "gehört zu"; }));
	});
});
