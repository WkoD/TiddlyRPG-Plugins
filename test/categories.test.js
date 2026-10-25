/*
 * The categories of the base types (modules/categories.js, filters/categories.js) and their
 * message (checks/categories.js): the item categories and Folk under Information, a category of
 * the campaign (also under the tag before 2.2.0), the hub Information with its categories and the
 * hub of a category, the pills of the form, "+" on a category hub, the relation folk (a
 * person, player character or creature names its folk) and the trees (tiddlyrpg-tree): classes
 * and folk - what an entry belongs to, the check relations/parent, the way back by kind, the
 * label per type, the lines of the player card, the parents of a package entry. The hub Item:
 * items.test.js.
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
		assert.deepEqual(f("[trpgcategories[]]"), ["Book", "Class", "Consumable", "Equipment", "Feat", "Folk", "Glossary", "Language", "Trait"]);
		assert.deepEqual(f("[trpgcategories[Information]]"), ["Class", "Feat", "Folk", "Glossary", "Language", "Trait"]);
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
			assert.deepEqual(f("[trpgcategories[Information]]"), ["Class", "Feat", "Folk", "Glossary", "Language", "Mythos", "Trait"]);
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
	// The bar of the hubs below a hub as "name number|..." and the list of a hub as text
	function bar(hub) {
		return (body(hub).match(/<span class="trpg-hub-sub-name">[^<]*<\/span><span class="trpg-hub-sub-n">\d+<\/span>/g) || []).map(function(sub) {
			return sub.replace(/<\/span><span class="trpg-hub-sub-n">/, " ").replace(/<[^>]+>/g, "");
		}).join("|");
	}

	function body(hub) {
		return h.render(wiki, "text/html", "<$transclude $tiddler=\"" + hub + "\" mode=\"block\"/>", {currentTiddler: hub});
	}

	test("Information: every entry from A to Z, above it its categories with their numbers", function() {
		var hub = h.body(wiki, "Information");
		assert.ok(inOrder(hub, ["Kalender", "Nichny", "Yuan-Ti"]), hub);
		assert.equal(hub.indexOf("Nichny"), hub.lastIndexOf("Nichny"), "once");
		assert.equal(bar("Information"), "Völker 2");
	});

	test("the hub of a category lists only its own entries, without the bar", function() {
		var hub = h.body(wiki, "Folk");
		assert.ok(inOrder(hub, ["Nichny", "Yuan-Ti"]), hub);
		assert.ok(["Völker", "Kalender"].every(function(s) { return hub.indexOf(s) === -1; }), hub);
		assert.equal(bar("Folk"), "");
		assert.match(h.view(wiki, "Folk"), /<h2 class="tc-title">Volk<span class="trpg-hub-count">2<\/span><\/h2>/);
	});

	test("the bar: a category only with an entry the view sees, the number of what it sees", function() {
		var add = function(list) { list.forEach(function(fields) { h.add(wiki, fields); }); };
		add([{title: "Nichny", tags: "Information Folk Frigg Secret"}, {title: "Yuan-Ti", tags: "Information Folk Frigg Secret"}]);
		try {
			var pub = h.inView(wiki, "public", function() { return {bar: bar("Information"), list: h.body(wiki, "Information")}; }),
				frigg = h.inView(wiki, "player:Anna", function() { return bar("Information"); });
			assert.equal(pub.bar, "");
			assert.equal(pub.list.indexOf("Nichny"), -1, pub.list);
			assert.equal(frigg, "Völker 2");
		} finally {
			add(FIXTURES.slice(0, 2));
		}
	});

	test("a locked category: not in the bar of a view that does not see it, its open entry in the list", function() {
		withTiddlers([{title: "Geheimbund", tags: "Index $:/tags/tiddlyrpg/Category Secret", "tiddlyrpg-bases": "Information", text: "{{ || Information }}"},
			{title: "Notiz", tags: "Information Geheimbund", text: "A note."}], function() {
			assert.equal(bar("Information"), "Geheimbund 1|Völker 2");
			h.inView(wiki, "public", function() {
				assert.equal(bar("Information"), "Völker 2");
				var hub = body("Information");
				assert.equal(hub.indexOf("Geheimbund"), -1, hub);
				assert.ok(hub.indexOf(">Notiz<") !== -1, hub);
			});
		});
	});

	test("a category of another base type: in the bar of its hub, its hub ({{ || Person }}) lists its own", function() {
		withTiddlers([{title: "Adel", tags: "Index $:/tags/tiddlyrpg/Category", "tiddlyrpg-bases": "Person", text: "{{ || Person }}"},
			{title: "Graf", tags: "Person Adel", text: "A count."}], function() {
			assert.equal(bar("Person"), "Adel 1");
			var adel = h.body(wiki, "Adel");
			assert.ok(adel.indexOf("Graf") !== -1, adel);
			assert.equal(adel.indexOf("Ki-Ra"), -1, adel);
			assert.equal(bar("Adel"), "");
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
		assert.deepEqual(f("[[Nichny]] [[Ki-Ra]] :map[relationkind[]]"), ["information", "person"], "every category of Information is one kind of the switches");
		assert.deepEqual(f("[[Nichny]] [[Ki-Ra]] :map[relationgroup[]]"), ["Folk", "Person"], "the relation list keeps the category");
		["Person", "Player", "Creature"].forEach(function(type) {
			assert.ok(f("[[$:/config/tiddlyrpg/form/" + type + "]get[more]enlist-input[]]").indexOf("folk") !== -1, type);
		});
	});

	test("the relation list: Volk forward, back by kind (a tree); the relations block on a folk", function() {
		var list = function(self) {
			return h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/viewtemplates/relations/list\" mode=\"block\"/>", {self: self, currentTiddler: self});
		};
		var nichny = list("Nichny");
		assert.match(list("Ki-Ra"), /Volk<span class="trpg-relations-count">/);
		assert.match(nichny, /Personen<span class="trpg-relations-count"> · 2<\/span>/);
		assert.match(nichny, /Kreaturen<span class="trpg-relations-count"> · 1<\/span>/);
		assert.ok(inOrder(nichny, ["Personen<span", ">Halbblut<", ">Ki-Ra<", "Kreaturen<span", ">Pantherkrieger<"]), nichny);
		assert.equal(nichny.indexOf("Angehörige"), -1, "every source has a kind of its own");
		assert.match(h.view(wiki, "Nichny"), /Personen/);
	});

	test("the ego graph: the edge and the colour of Folk", function() {
		var graph = h.graph(wiki, "<$graph.view $tiddler=\"$:/plugins/tiddlyrpg-core/graph/ego\"/>", {currentNode: "Ki-Ra"});
		assert.equal(graph.nodes.Nichny.color, wiki.getTiddler("Folk").fields.color);
		assert.ok(graph.edges.some(function(edge) { return edge.from === "Ki-Ra" && edge.to === "Nichny" && edge.props.label === "gehört zu"; }));
	});
});

test.describe("a folk at a location", function() {
	var added = [
		{title: "Bergvolk", tags: "Information Folk", location: "Baile Town", text: "Lives in the hills."},
		{title: "Schattenvolk", tags: "Information Folk Secret", location: "Baile", text: "Hidden."}
	];

	test.before(function() {
		added.forEach(function(fields) { h.add(wiki, fields); });
	});

	test.after(function() {
		added.forEach(function(fields) { wiki.deleteTiddler(fields.title); });
	});

	function list(self) {
		return h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/viewtemplates/relations/list\" mode=\"block\"/>", {self: self, currentTiddler: self});
	}

	test("the form offers location, several places alike; the folk is there", function() {
		var form = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/form.js");
		assert.ok(f("[[$:/config/tiddlyrpg/form/Folk]get[more]enlist-input[]]").indexOf("location") !== -1);
		assert.ok(!form.single(wiki, "Bergvolk", "location"), "a folk may live in several places");
		assert.ok(f("[[Baile]occupants[]]").indexOf("Bergvolk") !== -1);
		assert.ok(f("[[Town]occupants[]]").indexOf("Bergvolk") !== -1);
	});

	test("the place lists it under Völker, not among those present; a secret folk only for the DM", function() {
		var dm = list("Baile"),
			pub = h.inView(wiki, "public", function() { return list("Baile"); });
		assert.match(dm, /Völker<span class="trpg-relations-count"> · 2<\/span>/);
		assert.ok(inOrder(dm, ["Völker<span", ">Bergvolk<", ">Schattenvolk<"]), dm);
		assert.equal((dm.match(/>Bergvolk</g) || []).length, 1, "in one group only");
		assert.match(pub, /Völker<span class="trpg-relations-count"> · 1<\/span>/);
		assert.equal(pub.indexOf("Schattenvolk"), -1, pub);
	});

	test("the folk names its places; the ego graph draws the edge", function() {
		assert.match(list("Bergvolk"), />Baile</);
		var graph = h.graph(wiki, "<$graph.view $tiddler=\"$:/plugins/tiddlyrpg-core/graph/ego\"/>", {currentNode: "Bergvolk"});
		assert.ok(graph.edges.some(function(edge) { return edge.from === "Bergvolk" && edge.to === "Baile"; }), JSON.stringify(graph.edges));
	});
});

test.describe("trees: classes and folk", function() {
	var added = [
		{title: "Sorcerer", tags: "Information Class", text: "Casts by birth."},
		{title: "Fighter", tags: "Information Class", text: "Fights."},
		{title: "Paladin", tags: "Information Class", text: "Swears."},
		{title: "Draconic Bloodline", tags: "Information Class", classes: "Sorcerer", text: "Dragon blood."},
		{title: "Dragon Ancestor: Red", tags: "Information Class", classes: "[[Draconic Bloodline]]", text: "Fire."},
		{title: "Fighting Style: Defense", tags: "Information Class", classes: "Fighter Paladin", text: "+1 AC."},
		{title: "Geheimpfad", tags: "Information Class Secret", classes: "Fighter", text: "Hidden path."},
		{title: "Pfadwahl", tags: "Information Class", classes: "Geheimpfad", text: "A choice of it."},
		{title: "Funke", tags: "Player", player: "Lea", classes: "Sorcerer [[Draconic Bloodline]] [[Dragon Ancestor: Red]]", text: "Sorceress."},
		{title: "Doppel", tags: "Player", player: "Tom", classes: "Fighter [[Fighting Style: Defense]] Sorcerer", text: "Two classes."},
		{title: "Halbe", tags: "Person", classes: "[[Draconic Bloodline]]", text: "Without her class."},
		{title: "Stilist", tags: "Person", classes: "[[Fighting Style: Defense]]", text: "Without a class."},
		{title: "Kämpe", tags: "Player", player: "Ole", classes: "Fighter Geheimpfad Pfadwahl", text: "Hides his path."},
		{title: "Lehrling", tags: "Person", classes: "Pfadwahl", text: "Only the choice."},
		{title: "Feuerball", tags: "Spell", classes: "Sorcerer [[Draconic Bloodline]]", text: "Boom."},
		{title: "Drachenring", tags: "Item", classes: "Sorcerer", text: "Attuned by sorcerers."},
		{title: "Waldvolk", tags: "Information Folk", text: "Forest folk."},
		{title: "Hochwald", tags: "Information Folk", folk: "Waldvolk", text: "Of the high forest."},
		{title: "Nadel", tags: "Person", folk: "Hochwald", text: "Without her folk."}
	];

	test.before(function() {
		added.forEach(function(fields) { h.add(wiki, fields); });
	});

	test.after(function() {
		added.forEach(function(fields) { wiki.deleteTiddler(fields.title); });
	});

	function list(self) {
		return h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/viewtemplates/relations/list\" mode=\"block\"/>", {self: self, currentTiddler: self});
	}

	function parent(title) {
		return h.checks(wiki, title, "relations").filter(function(message) { return message.id === "relations/parent"; });
	}

	test("the relation classes: what it names, candidates, form, axis, kind; classes and folk are trees", function() {
		var form = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/form.js");
		assert.deepEqual(f("[[Funke]relationtargets[classes]]"), ["Sorcerer", "Draconic Bloodline", "Dragon Ancestor: Red"]);
		assert.ok(f("[[classes]relationcandidates[]]").indexOf("Fighting Style: Defense") !== -1);
		assert.ok(!form.single(wiki, "Doppel", "classes"), "several classes");
		assert.deepEqual(f("[[classes]relationlabel[]]"), ["gehört zu"]);
		assert.deepEqual(f("[[classes]relationaxis[]]"), ["$:/config/tiddlyrpg/graph/axes/family"]);
		assert.deepEqual(f("[[Sorcerer]] :map[relationkind[]]"), ["information"]);
		assert.deepEqual(f("[[Player]] [[Information]] +[relationgroups[]]"), ["Player", "Class", "Feat", "Folk", "Glossary", "Language", "Trait", "Information"]);
		assert.deepEqual(f("[[classes]] [[folk]] [[spells]] [[location]] +[relationtree[]]"), ["classes", "folk"]);
		["Person", "Player", "Creature", "Spell", "Item", "Artifact", "Class"].forEach(function(type) {
			assert.ok(f("[[$:/config/tiddlyrpg/form/" + type + "]get[more]enlist-input[]]").indexOf("classes") !== -1, type);
		});
		assert.ok(f("[[$:/config/tiddlyrpg/form/Class]get[more]enlist-input[]]").indexOf("spells") !== -1);
	});

	test("the lines of a tree: one per entry without parent, its branch after it; a locked entry takes its branch along", function() {
		var lines = function(title) {
			return f("[[" + title + "]relationlines[classes]]").map(function(line) { return Array.from($tw.utils.parseStringArray(line)); });
		};
		assert.deepEqual(lines("Funke"), [["Sorcerer", "Draconic Bloodline", "Dragon Ancestor: Red"]]);
		assert.deepEqual(lines("Doppel"), [["Fighter", "Fighting Style: Defense"], ["Sorcerer"]]);
		assert.deepEqual(lines("Kämpe"), [["Fighter", "Geheimpfad", "Pfadwahl"]]);
		assert.deepEqual(h.inView(wiki, "public", function() { return lines("Kämpe"); }), [["Fighter"]]);
		assert.deepEqual(lines("Halbe"), [["Draconic Bloodline"]], "an entry whose parent is missing stands alone");
	});

	test("the check: a holder names a parent of each entry; a fix for one parent; not for a spell or an item", function() {
		assert.deepEqual(parent("Funke"), []);
		assert.deepEqual(parent("Doppel"), []);
		var halbe = parent("Halbe");
		assert.equal(halbe.length, 1);
		assert.equal(halbe[0].level, "error");
		assert.deepEqual(Object.assign({}, halbe[0].fix), {kind: "add", field: "classes", value: "Sorcerer"});
		assert.match(halbe[0].text, /Draconic Bloodline gehört zu Sorcerer/);
		var stilist = parent("Stilist");
		assert.equal(stilist.length, 1);
		assert.equal(stilist[0].fix, undefined, "two parents: no fix");
		assert.match(stilist[0].text, /Fighter, Paladin/);
		assert.deepEqual(parent("Nadel").map(function(m) { return m.params.parents; }), ["Waldvolk"]);
		assert.deepEqual(parent("Feuerball"), []);
		assert.deepEqual(parent("Drachenring"), []);
		assert.deepEqual(parent("Draconic Bloodline"), [], "an entry of the tree is no holder");
	});

	test("the check names no parent the view does not see", function() {
		assert.equal(parent("Lehrling").length, 1);
		assert.deepEqual(h.inView(wiki, "public", function() { return parent("Lehrling"); }), []);
	});

	test("the way back of a class by kind, the forward group labelled for the type", function() {
		var sorcerer = list("Sorcerer");
		assert.ok(inOrder(sorcerer, ["Spieler<span", ">Doppel<", ">Funke<", "Gegenstände<span", ">Drachenring<", "Klassen<span", ">Draconic Bloodline<", "Zauber<span", ">Feuerball<"]), sorcerer);
		assert.match(sorcerer, /Gegenstände<span class="trpg-relations-count"> · 1<\/span>/);
		assert.match(list("Draconic Bloodline"), /Gehört zu<span class="trpg-relations-count"> · 1<\/span>/);
		assert.match(list("Drachenring"), /Einstimmung durch<span class="trpg-relations-count"> · 1<\/span>/);
		assert.match(list("Feuerball"), /Klassen<span class="trpg-relations-count"> · 2<\/span>/);
		assert.match(list("Funke"), /Klassen<span class="trpg-relations-count"> · 3<\/span>/);
		var fighter = h.inView(wiki, "public", function() { return list("Fighter"); });
		assert.equal(fighter.indexOf("Geheimpfad"), -1, fighter);
		assert.deepEqual(f("[[classes]relationfield[Drachenring]] [[classes]relationfield[Funke]] [[folk]relationfield[Funke]]"), ["Einstimmung durch", "Klassen", "Volk"]);
	});

	test("the player card: a line per tree; of the classes only the class (tiddlyrpg-card: top)", function() {
		var hub = h.render(wiki, "text/html", "{{Player}}");
		assert.match(hub, /trpg-player-line">Sorcerer</);
		assert.doesNotMatch(hub, /Draconic Bloodline/);
		assert.match(hub, /trpg-player-line">Fighter<\/span><span class="trpg-player-line">Sorcerer</);
		assert.deepEqual(f("[[Funke]trpgcardlines[]]"), ["Sorcerer"], "no XP: no level");
		h.add(wiki, {title: "Wanderer", tags: "Player", player: "Uli", folk: "Waldvolk Hochwald", text: "Of the forest."});
		try {
			assert.match(h.render(wiki, "text/html", "{{Player}}"), /trpg-player-line">Hochwald</, "the subfolk alone");
		} finally {
			wiki.deleteTiddler("Wanderer");
		}
		var pub = h.inView(wiki, "public", function() { return h.render(wiki, "text/html", "{{Player}}"); });
		assert.match(pub, /trpg-player-line">Fighter</);
		assert.equal(pub.indexOf("Geheimpfad"), -1);
	});

	test("the ego graph: the colour of Class; the edge labelled for the type it starts at", function() {
		var graph = h.graph(wiki, "<$graph.view $tiddler=\"$:/plugins/tiddlyrpg-core/graph/ego\"/>", {currentNode: "Sorcerer"});
		var label = function(from) {
			return graph.edges.filter(function(edge) { return edge.from === from && edge.to === "Sorcerer"; }).map(function(edge) { return edge.props.label; })[0];
		};
		assert.equal(graph.nodes.Funke.color, wiki.getTiddler("Player").fields.color);
		assert.equal(graph.nodes["Draconic Bloodline"].color, wiki.getTiddler("Class").fields.color);
		assert.equal(label("Funke"), "gehört zu");
		assert.equal(label("Draconic Bloodline"), "gehört zu");
		assert.equal(label("Drachenring"), "Einstimmung durch");
		assert.equal(label("Feuerball"), "Zauber von");
		assert.deepEqual(f("[[classes]relationlabel[Drachenring]] [[classes]relationlabel[]]"), ["Einstimmung durch", "gehört zu"]);
	});

	test("an entry of a content package: its parents for the check, offered along when taken", function() {
		var content = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/content.js"),
			INDEX = "$:/temp/tiddlyrpg-core/content/index";
		h.add(wiki, {title: INDEX, type: "application/json", text: JSON.stringify({ruleset: "$:/plugins/fixture-ruleset-5e-mini", packages: [{name: "SRD mini", language: "en-GB", entries: [
			{id: "class:wizard", title: "Wizard", type: "Class", tags: ["Information"], fields: {}},
			{id: "class:evocation", title: "School of Evocation", type: "Class", tags: ["Information"], fields: {classes: "Wizard"}}
		]}]})});
		h.add(wiki, {title: "Magus", tags: "Person", classes: "[[School of Evocation]]"});
		try {
			assert.deepEqual(h.checkKeys(wiki, "Magus", "relations"), ["Check/Relations/Parent"]);
			assert.deepEqual(Object.assign({}, parent("Magus")[0].fix), {kind: "add", field: "classes", value: "Wizard"});
			assert.deepEqual(Array.from(content.wanting(wiki, {classes: "Wizard"}), function(w) { return w.id; }), ["class:wizard"]);
		} finally {
			[INDEX, "Magus"].forEach(function(t) { wiki.deleteTiddler(t); });
		}
	});
});

test.describe("traits, feats, languages and the glossary", function() {
	var added = [
		{title: "Steinvolk", tags: "Information Folk", languages: "[[Zwergisch (Language)]]", text: "Of stone."},
		{title: "Steingespür", tags: "Information Trait", folk: "Steinvolk", text: "Knows stone."},
		{title: "Zwergisch (Language)", tags: "Information Language", text: "Of the dwarves."},
		{title: "Ringer", tags: "Information Feat", text: "Holds on."},
		{title: "Brocken", tags: "Person", folk: "Steinvolk", feats: "Ringer", languages: "[[Zwergisch (Language)]]", text: "A dwarf."},
		{title: "Verängstigt", tags: "Information Glossary", term: "frightened", text: "Afraid."},
		{title: "Furcht", tags: "Item", text: "It makes <<term frightened>> and <<term charmed>>.\n\n<<effect \"Steingespür\">> Stone sense.\n\n<<effect \"Ohne Eintrag\">> Nothing."},
		{title: "Geheimwort", tags: "Information Glossary Secret", term: "charmed", text: "Locked."}
	];

	test.before(function() {
		added.forEach(function(fields) { h.add(wiki, fields); });
	});

	test.after(function() {
		added.forEach(function(fields) { wiki.deleteTiddler(fields.title); });
	});

	function list(self) {
		return h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/viewtemplates/relations/list\" mode=\"block\"/>", {self: self, currentTiddler: self});
	}

	function html(title) {
		return h.render(wiki, "text/html", "{{" + title + "}}");
	}

	test("the relations feats and languages; a trait belongs to its folks", function() {
		assert.deepEqual(f("[[Brocken]relationtargets[feats]]"), ["Ringer"]);
		assert.deepEqual(f("[[Brocken]relationtargets[languages]]"), ["Zwergisch (Language)"]);
		assert.deepEqual(f("[[Steinvolk]relationtargets[languages]]"), ["Zwergisch (Language)"]);
		assert.deepEqual(f("[[feats]] [[languages]] :map[relationaxis[]]"), ["$:/config/tiddlyrpg/graph/axes/things", "$:/config/tiddlyrpg/graph/axes/things"]);
		["Person", "Player", "Creature"].forEach(function(type) {
			var more = f("[[$:/config/tiddlyrpg/form/" + type + "]get[more]enlist-input[]]");
			assert.ok(more.indexOf("feats") !== -1 && more.indexOf("languages") !== -1, type);
		});
		assert.ok(f("[[$:/config/tiddlyrpg/form/Folk]get[more]enlist-input[]]").indexOf("languages") !== -1);
		assert.deepEqual(f("[[$:/config/tiddlyrpg/form/Trait]get[more]enlist-input[]]"), ["folk"]);
		assert.deepEqual(f("[[Steingespür]] [[Ringer]] [[Zwergisch (Language)]] :map[relationkind[]]"), ["information", "information", "information"]);
		var folk = list("Steinvolk");
		assert.ok(inOrder(folk, ["Personen<span", ">Brocken<", "Merkmale<span", ">Steingespür<"]), folk);
		assert.match(list("Steingespür"), /Gehört zu<span class="trpg-relations-count"> · 1<\/span>/);
		assert.match(list("Zwergisch (Language)"), /Sprecher<span/);
		assert.deepEqual(h.checkKeys(wiki, "Brocken", "relations"), []);
	});

	test("<<term>> links to the entry of the glossary that explains it; not to one the view does not see", function() {
		var body = html("Furcht");
		assert.match(body, /<a[^>]*href="#Ver%C3%A4ngstigt"[^>]*><span class="trpg-rule">[^<]+<\/span><\/a>/);
		assert.match(body, /href="#Geheimwort"/, "the DM: the locked entry is linked");
		var pub = h.inView(wiki, "public", function() { return html("Furcht"); });
		assert.equal(pub.indexOf("Geheimwort"), -1, pub);
		assert.match(pub, /<span class="trpg-rule">[^<]+<\/span>/);
		assert.deepEqual(f("[[frightened]trpgglossary[]] [[unknown]trpgglossary[]]"), ["Verängstigt"]);
	});

	test("the name of a section links to a trait, class, feat or entry of the glossary of that title", function() {
		var body = html("Furcht");
		assert.match(body, /<a[^>]*>Steingespür<\/a>/);
		assert.doesNotMatch(body, /<a[^>]*>Ohne Eintrag<\/a>/);
		assert.deepEqual(f("[[Steingespür]trpgnamed[]] [[Brocken]trpgnamed[]] [[Ohne Eintrag]trpgnamed[]]"), ["Steingespür"]);
	});

	test("a value of the rules links the label of an entry the glossary explains", function() {
		h.add(wiki, {title: "Dunkelsicht erklärt", tags: "Information Glossary", term: "darkvision", text: "Sees in the dark."});
		h.add(wiki, {title: "Höhlenwolf", tags: "Creature", senses: "darkvision 60 ft", text: "A wolf."});
		try {
			var block = h.render(wiki, "text/html", "{{Höhlenwolf||$:/plugins/tiddlyrpg-core/viewtemplates/fields}}");
			assert.match(block, /<a[^>]*href="#Dunkelsicht%20erkl%C3%A4rt"[^>]*>Dunkelsicht<\/a>/, block);
			assert.match(h.render(wiki, "text/plain", "{{Höhlenwolf||$:/plugins/tiddlyrpg-core/viewtemplates/fields}}"), /Dunkelsicht 18 m/);
		} finally {
			["Dunkelsicht erklärt", "Höhlenwolf"].forEach(function(t) { wiki.deleteTiddler(t); });
		}
	});

	test("an entry of the glossary from a content package: the link without the entry taken", function() {
		var INDEX = "$:/temp/tiddlyrpg-core/content/index";
		h.add(wiki, {title: INDEX, type: "application/json", text: JSON.stringify({ruleset: "$:/plugins/fixture-ruleset-5e-mini", packages: [{name: "SRD mini", language: "en-GB", entries: [
			{id: "glossary:prone", title: "Prone", type: "Glossary", tags: ["Information"], fields: {term: "prone"}, text: "Down."},
			{id: "trait:keen", title: "Keen Senses", type: "Trait", tags: ["Information"], fields: {}}
		]}]})});
		try {
			assert.deepEqual(f("[[prone]trpgglossary[]] [[Keen Senses]trpgnamed[]]"), ["Prone", "Keen Senses"]);
		} finally {
			wiki.deleteTiddler(INDEX);
		}
	});
});

test.describe("the levels of the classes (format titles)", function() {
	var added = [
		{title: "Kämpfer", tags: "Information Class", text: "Fights."},
		{title: "Schurke", tags: "Information Class", text: "Sneaks."},
		{title: "Meister", tags: "Information Class", classes: "Kämpfer", text: "A subclass."},
		{title: "Verborgen", tags: "Information Class Secret", text: "Locked class."},
		{title: "Zwilling", tags: "Player", player: "Ina", classes: "Kämpfer Meister Schurke", "class-levels": "Kämpfer 5, Schurke 8", text: "Two classes."},
		{title: "Erfahren", tags: "Player", player: "Jo", classes: "Kämpfer Schurke", xp: "6500", "class-levels": "Kämpfer 2, Schurke 2", text: "Behind."},
		{title: "Zuviel", tags: "Player", player: "Kai", classes: "Kämpfer", xp: "300", "class-levels": "Kämpfer 4", text: "Too much."},
		{title: "Einzeln", tags: "Player", player: "Lu", classes: "Kämpfer Meister", xp: "14000", text: "One class."},
		{title: "Fremd", tags: "Player", player: "Mo", classes: "Kämpfer", "class-levels": "Kämpfer 3, Schurke 2", text: "Names a class it has not."},
		{title: "Heimlich", tags: "Player", player: "No", classes: "Kämpfer Verborgen", "class-levels": "Kämpfer 3, Verborgen 2", text: "A locked class."}
	];

	test.before(function() {
		added.forEach(function(fields) { h.add(wiki, fields); });
	});

	test.after(function() {
		added.forEach(function(fields) { wiki.deleteTiddler(fields.title); });
	});

	function levels(title) {
		return h.checks(wiki, title, "fields").filter(function(m) { return m.id === "fields/levels"; }).map(function(m) { return m.key; });
	}

	test("the format titles: each title with its number; an unknown title is a problem", function() {
		var rules = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/rules.js"),
			spec = {format: "titles", titles: "[tag[Class]]", value: {format: "number"}};
		var r = rules.value(wiki, spec, "kämpfer 5, Schurke 8");
		assert.equal(r.text, "Kämpfer 5, Schurke 8");
		assert.deepEqual(Array.from(r.items, function(i) { return i.title + "=" + i.number; }), ["Kämpfer=5", "Schurke=8"]);
		assert.equal(rules.value(wiki, spec, "Magier 3").problem, "Rules/Check/Title");
		assert.equal(rules.value(wiki, spec, "Kämpfer x").problem, "Rules/Check/Number");
	});

	test("the level of a character: by the XP, else the sum of the levels of its classes", function() {
		var fields = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/fields.js");
		assert.equal(fields.read(wiki, wiki.getTiddler("Zwilling").fields, "character-level").text, "13");
		assert.equal(fields.read(wiki, wiki.getTiddler("Erfahren").fields, "character-level").text, "5", "the XP win");
		assert.equal(fields.read(wiki, wiki.getTiddler("Einzeln").fields, "character-level").text, "5");
	});

	test("the check: classes it does not have, a class without a number, more or less than the level", function() {
		assert.deepEqual(levels("Zwilling"), []);
		assert.deepEqual(levels("Erfahren"), ["Check/Fields/LevelsLow"]);
		assert.deepEqual(levels("Zuviel"), ["Check/Fields/LevelsHigh"]);
		assert.deepEqual(levels("Fremd"), ["Check/Fields/LevelsNotTree"]);
		h.add(wiki, {title: "Halb", tags: "Player", player: "Pi", classes: "Kämpfer Schurke", "class-levels": "Kämpfer 3", text: "One number."});
		try {
			assert.deepEqual(levels("Halb"), ["Check/Fields/LevelsMissing"]);
		} finally {
			wiki.deleteTiddler("Halb");
		}
		assert.match(h.checks(wiki, "Zuviel", "fields")[0].text, /zusammen 4, mehr als Stufe 2/);
	});

	test("the check tells nothing of a locked XP: compared with the level a view sees", function() {
		h.add(wiki, {title: "Verdeckt", tags: "Player", player: "Jo", classes: "Kämpfer Schurke", xp: "6500", "class-levels": "Kämpfer 2, Schurke 2", "secret-fields": "xp", text: "Behind."});
		try {
			assert.deepEqual(levels("Verdeckt"), ["Check/Fields/LevelsLow"], "the DM");
			assert.deepEqual(h.inView(wiki, "public", function() { return levels("Verdeckt"); }), []);
		} finally {
			wiki.deleteTiddler("Verdeckt");
		}
	});

	test("the card: the level before each class in place of the line of the level; none when a class is locked", function() {
		var lines = function(title, view) {
			return h.inView(wiki, view || "dm", function() { return f("[[" + title + "]trpgcardlines[]]"); });
		};
		assert.deepEqual(lines("Zwilling"), ["Stufe 5 Kämpfer", "Stufe 8 Schurke"]);
		assert.deepEqual(lines("Einzeln"), ["Stufe 5 Kämpfer"]);
		assert.deepEqual(lines("Heimlich"), ["Stufe 3 Kämpfer", "Stufe 2 Verborgen"]);
		assert.deepEqual(lines("Heimlich", "public"), ["Kämpfer"], "the difference to the level would tell the locked class");
		h.add(wiki, {title: "Waldvolk", tags: "Information Folk", text: "Forest folk."});
		h.add(wiki, {title: "Hochwald", tags: "Information Folk", folk: "Waldvolk", text: "Of the high forest."});
		h.add(wiki, {title: "Volkstreu", tags: "Player", player: "Vi", xp: "900", folk: "Waldvolk Hochwald", classes: "Kämpfer", text: "One class, a folk."});
		h.add(wiki, {title: "Klassenlos", tags: "Player", player: "Wu", xp: "900", folk: "Waldvolk", text: "No class."});
		try {
			assert.deepEqual(lines("Volkstreu"), ["Stufe 3 Kämpfer", "Hochwald"]);
			assert.deepEqual(lines("Klassenlos"), ["Stufe 3", "Waldvolk"]);
		} finally {
			["Volkstreu", "Klassenlos", "Waldvolk", "Hochwald"].forEach(function(t) { wiki.deleteTiddler(t); });
		}
	});

	test("the block of values: a row per class after its level and what belongs to it; the folk too", function() {
		var block = function(title, view) {
			return h.inView(wiki, view || "dm", function() {
				return h.render(wiki, "text/plain", "{{" + title + "||$:/plugins/tiddlyrpg-core/viewtemplates/fields}}");
			});
		};
		assert.match(block("Zwilling"), /Klassen Stufe 5 Kämpfer · MeisterStufe 8 Schurke/);
		assert.doesNotMatch(block("Zwilling"), /Klassenstufen/, "the levels stand in the tree");
		assert.match(block("Heimlich"), /Klassen Stufe 3 KämpferStufe 2 Verborgen/);
		assert.match(block("Heimlich", "public"), /Klassen Kämpfer/);
		assert.doesNotMatch(block("Heimlich", "public"), /Verborgen/);
		assert.deepEqual(f("[[Zwilling]trpgtreerows[classes]]").map(function(r) { return JSON.parse(r); }),
			[{entries: "Kämpfer Meister", level: "Stufe 5"}, {entries: "Schurke", level: "Stufe 8"}]);
	});

	test("the form: a number per class, written into the field in the order of the tree", function() {
		assert.deepEqual(f("[[Zwilling]trpglevelentries[class-levels]]"), ["Kämpfer", "Schurke"]);
		assert.deepEqual(f("[[Zwilling]trpglevel[class-levels],[Schurke]]"), ["8"]);
		assert.deepEqual(f("[[Zwilling]trpglevelset[class-levels],[Kämpfer],[6]]"), ["Kämpfer 6, Schurke 8"]);
		assert.deepEqual(f("[[Zwilling]trpglevelset[class-levels],[Schurke],[]]"), ["Kämpfer 5"]);
		assert.deepEqual(f("[[Einzeln]trpglevelset[class-levels],[Kämpfer],[6]]"), ["Kämpfer 6"]);
	});

	test("relink: renaming a class renames it in the levels", function() {
		var type = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/relink-titles.js"),
			reported = [];
		type.report("Kämpfer 5, Schurke 8", function(t) { reported.push(t); });
		assert.deepEqual(reported, ["Kämpfer", "Schurke"]);
		assert.equal(type.relink("Kämpfer 5, Schurke 8", "Schurke", "Dieb").output, "Kämpfer 5, Dieb 8");
		assert.equal(type.relink("Kämpfer 5", "Schurke", "Dieb"), undefined);
	});
});
