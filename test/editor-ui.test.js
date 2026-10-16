/*
 * The editor in the wiki: which toolbar buttons show for which draft (editor/toolbar), the text
 * operations in the edit-text widget (editor/operation.js), the picker and what the view sees of
 * it (editor/procedures), the kinds in the search ($:/core/ui/DefaultSearchResultList), "New" in
 * the sidebar and on the hubs (ui/new-*, viewtemplates/hub-new), "Create quest" with the player
 * characters chosen and the names while renaming a rumour (templates/quest-body).
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var wiki, $tw;

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		h.setLanguage(wiki, "de-DE");
		h.add(wiki, {title: "Bran", tags: "Person", player: "Ben", text: "A former character."});
		h.add(wiki, {title: "Zug", tags: "Event Frigg", date: "1351-07-01", text: "<<date>>\n\n<<quest \"Spur im Wald\">>A trace."});
		h.add(wiki, {title: "Draft of 'Zug'", "draft.of": "Zug", tags: "Ereignis", text: "x"});
		h.add(wiki, {title: "Draft of 'Ort'", "draft.of": "Ort", tags: "Location", text: "x"});
		h.add(wiki, {title: "Draft of 'Md'", "draft.of": "Md", tags: "Event", type: "text/x-markdown", text: "x"});
	});
});

function f(text, variables) {
	return Array.from(h.filter(wiki, text, variables));
}

test.describe("toolbar", function() {
	function shown(button, draft) {
		var condition = wiki.getTiddler("$:/plugins/tiddlyrpg-core/editor/toolbar/" + button).fields.condition;
		return f(condition, {targetTiddler: draft}).length > 0;
	}
	test("dates and quest markers in events (also tagged under the translated name), spots and sub-locations in locations", function() {
		assert.deepEqual(["date", "quest", "quest-status", "group", "spot", "sublocation"].map(function(b) { return shown(b, "Draft of 'Zug'"); }),
			[true, true, true, true, false, false]);
		assert.deepEqual(["date", "quest", "group", "spot", "sublocation"].map(function(b) { return shown(b, "Draft of 'Ort'"); }),
			[false, false, false, true, true]);
	});
	test("lock, link to a spot and rules in any wikitext, not in markdown", function() {
		["secret", "spotlink", "term"].forEach(function(b) {
			assert.ok(shown(b, "Draft of 'Ort'"), b);
			assert.ok(!shown(b, "Draft of 'Md'"), b);
		});
		assert.ok(!shown("date", "Draft of 'Md'"));
	});
	test("the snippet Dated Section is gone", function() {
		assert.deepEqual(f("[all[shadows+tiddlers]tag[$:/tags/TextEditor/Snippet]prefix[$:/plugins/tiddlyrpg-core/]]"), []);
	});
});

test.describe("the text operations", function() {
	var ops;
	test.before(function() {
		ops = {};
		$tw.modules.forEachModuleOfType("texteditoroperation", function(title, module) {
			$tw.utils.extend(ops, module);
		});
	});
	// The edit-text widget as the operations see it
	function widget(draft) {
		var events = [];
		return {wiki: wiki, editTitle: draft, events: events, dispatchEvent: function(e) { events.push(e); }};
	}
	test("probe: what stands at the cursor and the values for the dropdown", function() {
		h.add(wiki, {title: "Draft of 'Zug'", "draft.of": "Zug", tags: "Ereignis", date: "1351-07-01", text: "<<date label:\"Ankunft\">>\n\nA."});
		var w = widget("Draft of 'Zug'"),
			op = {text: "<<date label:\"Ankunft\">>\n\nA.", selStart: 28, selEnd: 28};
		ops["trpg-probe"].call(w, {paramObject: {kind: "date"}}, op);
		var probe = JSON.parse(wiki.getTiddlerText("$:/temp/tiddlyrpg-core/editor/probe/Draft of 'Zug'"));
		assert.equal(probe.form, "short");
		var input = wiki.getTiddler("$:/temp/tiddlyrpg-core/editor/input/Draft of 'Zug'").fields;
		assert.equal(input.date, "1351-07-01");
		assert.equal(input.label, "Ankunft");
		assert.equal(op.replacement, undefined, "the probe changes no text");
	});
	test("probe without anything at the cursor: the dropdowns offer to insert (JSON null would read as \"null\")", function() {
		h.add(wiki, {title: "Draft of 'Zug'", "draft.of": "Zug", tags: "Event", date: "1351-07-01", text: "<<date>>\n\nA plain paragraph."});
		ops["trpg-probe"].call(widget("Draft of 'Zug'"), {paramObject: {kind: "quest"}}, {text: "<<date>>\n\nA plain paragraph.", selStart: 14, selEnd: 14});
		assert.match(h.render(wiki, "text/plain", "{{||$:/plugins/tiddlyrpg-core/editor/toolbar/quest-dropdown}}", {targetTiddler: "Draft of 'Zug'"}), /Neuer Quest-Marker/);
		ops["trpg-probe"].call(widget("Draft of 'Zug'"), {paramObject: {kind: "date"}}, {text: "<<date>>\n\nA plain paragraph.", selStart: 14, selEnd: 14});
		assert.match(h.render(wiki, "text/plain", "{{||$:/plugins/tiddlyrpg-core/editor/toolbar/date-dropdown}}", {targetTiddler: "Draft of 'Zug'"}), /Datumsabschnitt 1/);
		ops["trpg-probe"].call(widget("Draft of 'Zug'"), {paramObject: {kind: "secret"}}, {text: "<<date>>\n\nA.\n\nB.", selStart: 13, selEnd: 13});
		assert.match(h.render(wiki, "text/plain", "{{||$:/plugins/tiddlyrpg-core/editor/toolbar/secret-dropdown}}", {targetTiddler: "Draft of 'Zug'"}), /Neue Sperre/);
	});
	test("edit: the smallest replacement, the field date of the draft, the probe cleared", function() {
		h.add(wiki, {title: "Draft of 'Zug'", "draft.of": "Zug", tags: "Event", date: "1351-07-01", text: "<<date>>\n\nA.\n\nB."});
		var w = widget("Draft of 'Zug'"),
			op = {text: "<<date>>\n\nA.\n\nB.", selStart: 14, selEnd: 14};
		ops["trpg-edit"].call(w, {paramObject: {kind: "date", op: "insert", date: "1351-07-03"}}, op);
		assert.deepEqual([op.cutStart, op.cutEnd, op.replacement], [14, 14, "<<date>>\n\n"]);
		assert.equal(wiki.getTiddler("Draft of 'Zug'").fields.date, "1351-07-01, 1351-07-03");
		assert.equal(wiki.getTiddler("$:/temp/tiddlyrpg-core/editor/probe/Draft of 'Zug'"), undefined);
	});
	test("edit: a spot made a location is created and opened; why nothing changed is a notice", function() {
		var w = widget("Draft of 'Ort'"),
			op = {text: "Town.\n\n<<spot \"Neue Mühle\">>\n\nGrinds.", selStart: 12, selEnd: 12};
		ops["trpg-edit"].call(w, {paramObject: {kind: "sublocation"}}, op);
		assert.equal(wiki.getTiddler("Neue Mühle").fields.text, "Grinds.");
		assert.deepEqual(w.events.map(function(e) { return e.type + " " + e.navigateTo; }), ["tm-navigate Neue Mühle"]);
		wiki.deleteTiddler("Neue Mühle");
		var op2 = {text: "Town.", selStart: 2, selEnd: 2};
		ops["trpg-edit"].call(w, {paramObject: {kind: "sublocation"}}, op2);
		assert.equal(op2.replacement, undefined);
		assert.equal(wiki.getTiddlerText("$:/temp/tiddlyrpg-core/editor/notice"), "Kein Spot am Cursor");
	});
});

test.describe("the picker and what the view sees", function() {
	function hits(candidates, typed) {
		return h.render(wiki, "text/plain", "<$let trpg-candidates=\"" + candidates + "\" userInput=\"" + typed + "\"><$list filter={{$:/plugins/tiddlyrpg-core/editor/picker!!first-search-filter}}><<currentTiddler>>|</$list></$let>");
	}
	test("hits by the translated name as well; a locked title only for a view that sees it; an empty input: every candidate", function() {
		assert.equal(hits("[all[tiddlers]tag[Location]]", "Hide"), "Hideout|");
		assert.equal(hits("[[Baile]] [[Town]] [[Hideout]]", ""), "Baile|Hideout|Town|");
		assert.equal(h.inView(wiki, "public", function() { return hits("[[Baile]] [[Town]] [[Hideout]]", ""); }), "Baile|Town|");
		assert.equal(h.inView(wiki, "public", function() { return hits("[all[tiddlers]tag[Location]]", "Hide"); }), "");
		assert.equal(h.inView(wiki, "player:Anna", function() { return hits("[all[tiddlers]tag[Location]]", "Hide"); }), "Hideout|");
	});
	test("the pill: the colour of the type, a location with its path", function() {
		var html = h.render(wiki, "text/html", "<$transclude $variable=\"trpg.pickpill\" title=\"Town\"/>");
		assert.match(html, /--trpg-kind:#ff2b2b/);
		assert.equal(h.render(wiki, "text/plain", "<$transclude $variable=\"trpg.pickpill\" title=\"Town\"/>"), "Continent › Kingdom › Town");
	});
	test("names written almost alike; the player characters active and former", function() {
		assert.deepEqual(f("[questnames[]trpgsimilar[Spur im Wlad]]"), ["Spur im Wald"]);
		h.add(wiki, {title: "$:/temp/x", names: "Bran"});
		var pills = h.render(wiki, "text/html", "<$transclude $variable=\"trpg.charpills\" tiddler=\"$:/temp/x\" field=\"names\"/>");
		assert.match(pills, /trpg-off"[^>]*>Frigg<\/button>.*trpg-char-former.*aria-pressed="true"[^>]*>Bran/);
		wiki.deleteTiddler("$:/temp/x");
		assert.equal(h.inView(wiki, "public", function() { return f("[all[tiddlers]tag[Player]!is[draft]] :filter[trpg.visible[]]").length; }), 1);
	});
});

test.describe("the kinds in the search", function() {
	test("none chosen: everything; chosen ones only, events a kind of their own", function() {
		var all = "[[Frigg]] [[Baile]] [[Zug]] [[Guild]]";
		assert.deepEqual(f(all + " +[kindselected[$:/state/tiddlyrpg-core/search-kinds]]"), ["Frigg", "Baile", "Zug", "Guild"]);
		h.add(wiki, {title: "$:/state/tiddlyrpg-core/search-kinds", list: "event location"});
		assert.deepEqual(f(all + " +[kindselected[$:/state/tiddlyrpg-core/search-kinds]]"), ["Baile", "Zug"]);
		var html = h.render(wiki, "text/html", "<$let userInput=\"Bai\" configTiddler=\"$:/core/ui/DefaultSearchResultList\">{{$:/core/ui/DefaultSearchResultList}}</$let>");
		assert.match(html, /trpg-kind-switch trpg-kind-person[^"]* trpg-off"/);
		assert.match(html, /trpg-kind-switch trpg-kind-event"/);
		wiki.deleteTiddler("$:/state/tiddlyrpg-core/search-kinds");
	});
});

test.describe("new tiddlers", function() {
	test("+ on the hubs of the types, only in the editable wiki; items and categories offer the base types, events ask for the date", function() {
		// A plain "+" on Location, a "+" with a dropdown (popup) on Item, a category and Event
		var plus = function(hub) { return (h.view(wiki, hub).match(/<button[^>]*trpg-hub-plus[^>]*>/) || [""])[0]; };
		assert.match(plus("Location"), /title="Neu: Ort"/);
		assert.doesNotMatch(plus("Location"), /aria-expanded/);
		["Item", "Book", "Event"].forEach(function(hub) {
			assert.match(plus(hub), /aria-expanded="false"/, hub);
		});
		assert.doesNotMatch(h.view(wiki, "Baile"), /trpg-hub-new/);
		assert.match(h.render(wiki, "text/plain", "{{$:/plugins/tiddlyrpg-core/ui/new-event}}", {"trpg-input": "$:/temp/e"}), /Datum.*Anlegen/);
		h.add(wiki, {title: "$:/status/IsReadOnly", text: "yes"});
		assert.doesNotMatch(h.view(wiki, "Location"), /trpg-hub-new/);
		wiki.deleteTiddler("$:/status/IsReadOnly");
		assert.equal(wiki.getTiddler("$:/plugins/tiddlyrpg-core/ui/new-typed"), undefined, "no New in the sidebar");
	});
	test("Create quest opens a draft with the player characters of its events", function() {
		var caught = [];
		var parser = wiki.parseText("text/vnd.tiddlywiki", "\\import [subfilter{$:/core/config/GlobalImportFilter}]\n{{||$:/plugins/tiddlyrpg-core/templates/quest-body}}"),
			root = wiki.makeWidget(parser, {document: $tw.fakeDocument, variables: {currentTiddler: "Spur im Wald"}});
		root.render($tw.fakeDocument.createElement("div"), null);
		root.addEventListener("tm-new-tiddler", function(event) { caught.push(event.paramObject); return false; });
		var button = null;
		(function walk(w) {
			if(w.parseTreeNode && w.parseTreeNode.type === "button" && /trpg-quest-create/.test(w.getAttribute("class", ""))) {
				button = w;
			}
			(w.children || []).forEach(walk);
		})(root);
		assert.ok(button, "the button");
		button.invokeActions(button, {});
		assert.equal(caught.length, 1);
		assert.equal(caught[0].title, "Spur im Wald");
		assert.equal(caught[0].tags, "Quest Frigg");
		assert.equal(wiki.tiddlerExists("Spur im Wald"), false, "nothing exists before saving");
	});
	test("renaming a rumour: the names that contain the text, and those written almost alike", function() {
		h.add(wiki, {title: "Zug 2", tags: "Event", date: "1351-07-02", text: "<<date>>\n\n<<quest \"Turm im Moor\">>A tower."});
		h.add(wiki, {title: "$:/state/tiddlyrpg-core/quest-rename/Spur im Wald", text: "Turm"});
		var text = h.render(wiki, "text/plain", "{{||$:/plugins/tiddlyrpg-core/templates/quest-body}}", {currentTiddler: "Spur im Wald"});
		assert.match(text, /Turm im Moor/);
		h.add(wiki, {title: "$:/state/tiddlyrpg-core/quest-rename/Spur im Wald", text: "Turm im Mor"});
		assert.match(h.render(wiki, "text/html", "{{||$:/plugins/tiddlyrpg-core/templates/quest-body}}", {currentTiddler: "Spur im Wald"}), /trpg-warn" title="Fast gleich geschrieben">Turm im Moor/);
		wiki.deleteTiddler("$:/state/tiddlyrpg-core/quest-rename/Spur im Wald");
	});
	test("renaming a rumour onto a tiddler that is no quest: refused", function() {
		h.add(wiki, {title: "$:/state/tiddlyrpg-core/quest-rename/Spur im Wald", text: "Baile"});
		var text = h.render(wiki, "text/plain", "{{||$:/plugins/tiddlyrpg-core/templates/quest-body}}", {currentTiddler: "Spur im Wald"});
		assert.match(text, /kein Quest – nicht zusammenführbar/);
		assert.doesNotMatch(text, /Umbenennen/);
		wiki.deleteTiddler("$:/state/tiddlyrpg-core/quest-rename/Spur im Wald");
	});
	test("a name a tiddler has in another case: a red line with that tiddler instead of the button, at the rumour and at a new sub-location", function() {
		assert.deepEqual(f("[[baile]trpgtaken[]] [[BAILE]trpgtaken[]] [[Nirgendwo]trpgtaken[]] [[ ]trpgtaken[]]"), ["Baile"]);
		h.add(wiki, {title: "Draft of 'Gast'", "draft.of": "Gast", text: ""});
		assert.deepEqual(f("[[draft of 'gast']trpgtaken[]]"), [], "a draft is no tiddler yet");
		wiki.deleteTiddler("Draft of 'Gast'");
		var body = function() { return h.render(wiki, "text/plain", "{{||$:/plugins/tiddlyrpg-core/templates/quest-body}}", {currentTiddler: "Spur im Wald"}); };
		// Renaming onto another case of a tiddler
		h.add(wiki, {title: "$:/state/tiddlyrpg-core/quest-rename/Spur im Wald", text: "baile"});
		assert.match(body(), /Ein Tiddler dieses Namens existiert bereits: Baile/);
		assert.doesNotMatch(body(), /Umbenennen/);
		wiki.deleteTiddler("$:/state/tiddlyrpg-core/quest-rename/Spur im Wald");
		// Creating the quest of a rumour another case of which is a tiddler
		assert.match(body(), /Quest anlegen/);
		h.add(wiki, {title: "spur im wald", text: "x"});
		assert.match(body(), /Ein Tiddler dieses Namens existiert bereits: spur im wald/);
		assert.doesNotMatch(body(), /Quest anlegen/);
		wiki.deleteTiddler("spur im wald");
		// A new sub-location: the line and no button while the name is taken
		var dropdown = function() { return h.render(wiki, "text/html", "{{$:/plugins/tiddlyrpg-core/editor/toolbar/sublocation-dropdown}}", {targetTiddler: "Draft of 'Ort'"}); },
			input = "$:/temp/tiddlyrpg-core/editor/input/Draft of 'Ort'";
		h.add(wiki, {title: input, name: "baile"});
		assert.match(dropdown(), /trpg-editor-bad">Ein Tiddler dieses Namens existiert bereits: Baile/);
		assert.match(dropdown(), /<button[^>]*class="trpg-do"[^>]*disabled/);
		h.add(wiki, {title: input, name: "Neuer Hof"});
		assert.doesNotMatch(dropdown(), /existiert bereits/);
		assert.doesNotMatch(dropdown(), /<button[^>]*class="trpg-do"[^>]*disabled/);
		wiki.deleteTiddler(input);
	});
});
