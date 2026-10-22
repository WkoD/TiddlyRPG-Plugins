/*
 * The form in the editor (modules/form.js, editor/form, editor/fields): its fields per type, the
 * fields that hold one entry, what a field may name; symmetric relations on both ends on saving
 * (modules/symmetric.js, startup/symmetric.js); the messages of a draft with their fixes
 * (modules/checks.js forDraft, modules/fixes.js); the new hint of a section without marker.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var wiki, $tw, form, symmetric, fixes, checks;

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		h.setLanguage(wiki, "de-DE");
		form = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/form.js");
		symmetric = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/symmetric.js");
		fixes = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/fixes.js");
		checks = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/checks.js");
		h.add(wiki, {title: "Ann", tags: "Person", text: "A."});
		h.add(wiki, {title: "Bea", tags: "Person", text: "B."});
		h.add(wiki, {title: "Cid", tags: "Person", bond: "Ann", text: "C."});
	});
});

function f(text, variables) {
	return Array.from(h.filter(wiki, text, variables));
}

test.describe("fields of the form", function() {
	test("the fields the type expects first by kind, then every known field the draft has", function() {
		h.add(wiki, {title: "Draft of 'Ann'", "draft.of": "Ann", tags: "Person", bond: "Bea", text: "A."});
		assert.deepEqual(Array.from(form.fields(wiki, "Draft of 'Ann'")), ["image", "bond"]);
		wiki.deleteTiddler("Draft of 'Ann'");
	});
	test("a type written under its translated name counts; added fields count; no type, no expected fields", function() {
		h.add(wiki, {title: "Draft of 'Neu'", "draft.of": "Neu", tags: "Ort", text: ""});
		assert.deepEqual(Array.from(form.fields(wiki, "Draft of 'Neu'")), ["image", "map"]);
		h.add(wiki, {title: "$:/state/tiddlyrpg-core/form-extra/Draft of 'Neu'", list: "enmity"});
		assert.ok(form.fields(wiki, "Draft of 'Neu'").indexOf("enmity") !== -1);
		wiki.deleteTiddler("$:/state/tiddlyrpg-core/form-extra/Draft of 'Neu'");
		h.add(wiki, {title: "Draft of 'Neu'", "draft.of": "Neu", text: "", location: "Baile"});
		assert.deepEqual(Array.from(form.fields(wiki, "Draft of 'Neu'")), ["location"]);
		wiki.deleteTiddler("Draft of 'Neu'");
	});
	test("more fields: those of the type, not every field; a player is no member by default, a material has a place", function() {
		h.add(wiki, {title: "Draft of 'Fest'", "draft.of": "Fest", tags: "Event", text: ""});
		assert.deepEqual(Array.from(form.offered(wiki, "Draft of 'Fest'")), ["image"]);
		h.add(wiki, {title: "Draft of 'Held'", "draft.of": "Held", tags: "Player", text: ""});
		assert.equal(form.fields(wiki, "Draft of 'Held'").indexOf("member"), -1);
		assert.ok(form.offered(wiki, "Draft of 'Held'").indexOf("member") !== -1);
		h.add(wiki, {title: "Draft of 'Erz'", "draft.of": "Erz", tags: "Material", text: ""});
		assert.ok(form.offered(wiki, "Draft of 'Erz'").indexOf("location") !== -1);
		["Fest", "Held", "Erz"].forEach(function(t) { wiki.deleteTiddler("Draft of '" + t + "'"); });
	});
	test("each base type of an item offers the categories; other types do not", function() {
		var row = function(tags) {
			h.add(wiki, {title: "Draft of 'Ding'", "draft.of": "Ding", tags: tags, text: ""});
			var text = h.render(wiki, "text/plain", "{{||$:/plugins/tiddlyrpg-core/editor/form}}", {currentTiddler: "Draft of 'Ding'"});
			wiki.deleteTiddler("Draft of 'Ding'");
			return /Kategorie.*Ausrüstung.*Buch/.test(text) || /Kategorie.*Buch.*Ausrüstung/.test(text);
		};
		assert.deepEqual(["Artifact", "Item", "Material", "Gegenstand", "[[Item]] Book", "Person", "Event"].map(row),
			[true, true, true, true, true, false, false]);
	});
	test("one category at most: another replaces it, a second click takes it out; the base type stays", function() {
		var draft = "Draft of 'Ding'";
		h.add(wiki, {title: draft, "draft.of": "Ding", tags: "Item", text: ""});
		var click = function(label) {
			var parser = wiki.parseText("text/vnd.tiddlywiki", "\\import [subfilter{$:/core/config/GlobalImportFilter}]\n{{||$:/plugins/tiddlyrpg-core/editor/form}}"),
				root = wiki.makeWidget(parser, {document: $tw.fakeDocument, variables: {currentTiddler: draft}}),
				found = null;
			root.render($tw.fakeDocument.createElement("div"), null);
			(function walk(w) {
				if(w.parseTreeNode && w.parseTreeNode.type === "button" && /trpg-choice/.test(w.getAttribute("class", "")) && w.domNodes[0] && w.domNodes[0].textContent === label) {
					found = w;
				}
				(w.children || []).forEach(walk);
			})(root);
			assert.ok(found, label);
			found.invokeActions(found, {});
			return Array.from(wiki.getTiddler(draft).fields.tags);
		};
		assert.deepEqual(click("Buch"), ["Item", "Book"]);
		assert.deepEqual(click("Ausrüstung"), ["Item", "Equipment"]);
		assert.deepEqual(click("Ausrüstung"), ["Item"]);
		wiki.deleteTiddler(draft);
	});
	test("a type shows the fields whose absence a check reports (the property missing of a message), every other field of it is offered", function() {
		// The configs are shadow tiddlers of the plugin
		var types = f("[all[shadows+tiddlers]prefix[$:/config/tiddlyrpg/form/]removeprefix[$:/config/tiddlyrpg/form/]]");
		assert.ok(types.indexOf("Location") !== -1 && types.indexOf("Event") !== -1, types.join(" "));
		types.forEach(function(type) {
			var title = "Bare " + type,
				expected = [];
			h.add(wiki, {title: title, tags: type, text: "x"});
			h.checks(wiki, title).forEach(function(message) {
				if(message.missing && expected.indexOf(message.missing) === -1) {
					expected.push(message.missing);
				}
			});
			assert.deepEqual(Array.from(form.fields(wiki, title)).sort(), expected.sort(), type);
			form.fields(wiki, title).forEach(function(field) {
				assert.equal(form.offered(wiki, title).indexOf(field), -1, type + " " + field);
			});
			wiki.deleteTiddler(title);
		});
	});
	test("the states of a draft go with it", function() {
		h.add(wiki, {title: "Draft of 'Weg'", "draft.of": "Weg", tags: "Person", text: ""});
		h.add(wiki, {title: "$:/state/tiddlyrpg-core/form-extra/Draft of 'Weg'", list: "enmity"});
		h.add(wiki, {title: "$:/temp/tiddlyrpg-core/editor/input/Draft of 'Weg'", date: "1351-01-01"});
		return new Promise(function(resolve) { setTimeout(resolve, 20); }).then(function() {
			wiki.deleteTiddler("Draft of 'Weg'");
			return new Promise(function(resolve) { setTimeout(resolve, 20); });
		}).then(function() {
			assert.equal(wiki.tiddlerExists("$:/state/tiddlyrpg-core/form-extra/Draft of 'Weg'"), false);
			assert.equal(wiki.tiddlerExists("$:/temp/tiddlyrpg-core/editor/input/Draft of 'Weg'"), false);
		});
	});
	test("a tiddler the toolbar created goes again when its draft is cancelled, unless changed since; saving keeps it", function() {
		var wait = function() { return new Promise(function(resolve) { setTimeout(resolve, 20); }); },
			draft = "Draft of 'Burg'",
			make = function(title) {
				var tiddler = new $tw.Tiddler(wiki.getCreationFields(), {title: title, tags: ["Location"], location: "Burg", text: "T."}, wiki.getModificationFields());
				wiki.addTiddler(tiddler);
				form.noteCreated(wiki, draft, tiddler);
			};
		h.add(wiki, {title: draft, "draft.of": "Burg", tags: "Location", text: "Burg."});
		h.add(wiki, {title: "$:/StoryList", list: "[[Draft of 'Burg']] Turm Keller Stall"});
		make("Turm");
		make("Keller");
		make("Stall");
		h.add(wiki, {title: "Draft of 'Stall'", "draft.of": "Stall", tags: "Location", text: "T."});
		return wait().then(function() {
			// Keller changed since: it stays
			wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler("Keller"), {text: "Changed."}, {modified: new Date(Date.now() + 1000)}));
			wiki.deleteTiddler(draft);
			return wait();
		}).then(function() {
			assert.equal(wiki.tiddlerExists("Turm"), false, "unchanged: gone");
			assert.equal(wiki.tiddlerExists("Keller"), true, "changed since: kept");
			assert.equal(wiki.tiddlerExists("Stall"), true, "open in the editor: kept");
			assert.deepEqual(Array.from(wiki.getTiddler("$:/StoryList").fields.list), ["Draft of 'Burg'", "Keller", "Stall"]);
			assert.equal(wiki.tiddlerExists("$:/temp/tiddlyrpg-core/editor/created/" + draft), false);
			assert.match(wiki.getTiddlerText("$:/temp/tiddlyrpg-core/editor/notice"), /wieder entfernt: Turm[\s\S]*bleibt.*Keller, Stall/);
			// Saved: the created tiddler stays
			h.add(wiki, {title: draft, "draft.of": "Burg", tags: "Location", text: "Burg."});
			make("Tor");
			return wait();
		}).then(function() {
			$tw.hooks.invokeHook("th-saving-tiddler", new $tw.Tiddler({title: "Burg", tags: ["Location"], text: "Burg."}), wiki.getTiddler(draft));
			wiki.deleteTiddler(draft);
			return wait();
		}).then(function() {
			assert.equal(wiki.tiddlerExists("Tor"), true);
			["Keller", "Stall", "Tor", "Draft of 'Stall'", "$:/StoryList"].forEach(function(title) { wiki.deleteTiddler(title); });
		});
	});
	test("a change of type takes out the fields the new type does not have and names them; the first type changes nothing", function() {
		var draft = "Draft of 'Kelch'",
			extra = "$:/state/tiddlyrpg-core/form-extra/" + draft,
			notice = "$:/temp/tiddlyrpg-core/editor/notice",
			wait = function() { return new Promise(function(resolve) { setTimeout(resolve, 20); }); };
		h.add(wiki, {title: draft, "draft.of": "Kelch", text: "", price: "5 gp", location: "Baile"});
		return wait().then(function() {
			h.add(wiki, {title: draft, "draft.of": "Kelch", tags: "Item", text: "", price: "5 gp", location: "Baile"});
			h.add(wiki, {title: extra, list: "price creator"});
			return wait();
		}).then(function() {
			assert.equal(wiki.getTiddler(draft).fields.price, "5 gp");
			wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler(draft), {tags: []}));
			return wait();
		}).then(function() {
			assert.equal(wiki.getTiddler(draft).fields.price, "5 gp");
			wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler(draft), {tags: ["Ereignis"]}));
			return wait();
		}).then(function() {
			var fields = wiki.getTiddler(draft).fields;
			assert.equal(fields.price, undefined);
			assert.equal(fields.location, undefined);
			assert.deepEqual(Array.from(wiki.getTiddler(extra).fields.list), []);
			assert.equal(wiki.getTiddlerText(notice), "Typ gewechselt, entfernt: Preis, Ort");
			// What both types have stays: a person who becomes a player character keeps the place
			h.add(wiki, {title: draft, "draft.of": "Kelch", tags: "Person", text: "", location: "Baile", member: "Gilde", price: "1"});
			return wait();
		}).then(function() {
			wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler(draft), {tags: ["Player"]}));
			return wait();
		}).then(function() {
			var fields = wiki.getTiddler(draft).fields;
			assert.equal(fields.location, "Baile");
			assert.equal(fields.member, "Gilde");
			assert.equal(fields.price, undefined);
			wiki.deleteTiddler(draft);
			wiki.deleteTiddler(notice);
			return wait();
		});
	});
	test("units that fit what follows the number; the picker: every candidate for an empty input", function() {
		assert.deepEqual(f("[[60 f]trpgunitsuggest[]]"), ["60 ft", "60 ft³"], "every unit whose label starts so, a volume too");
		assert.ok(f("[[60]trpgunitsuggest[]]").length > 3);
		assert.deepEqual(f("[[ft]trpgunitsuggest[]]"), []);
	});
	test("the terms of the button Rules: entries that stand alone, a trait with its way from the main entry", function() {
		var ids = f("[trpgtermsearch[medium]]");
		assert.ok(ids.indexOf("medium") !== -1, "the size");
		assert.ok(ids.indexOf("armor medium") !== -1, "the trait with its main entry");
		assert.ok(f("[trpgtermsearch[crystal]]").indexOf("crystal") === -1, "a trait alone is no term");
		assert.ok(f("[trpgtermsearch[crystal]]").indexOf("focus arcane crystal") !== -1);
		assert.ok(f("[trpgtermsearch[arrow]]").indexOf("weapon ammunition arrow") !== -1, "every way: through a main entry that is a trait too");
		assert.ok(f("[trpgtermsearch[arrow]]").indexOf("ammunition arrow") !== -1);
		assert.deepEqual(f("[[armor medium]trpgtermcall[]] [[wis]trpgtermcall[]]"), ["<<term \"armor medium\">>", "<<term wis>>"]);
		assert.deepEqual(f("[[Baile]] [[Town]] +[trpgpickmatch[]]"), ["Baile", "Town"]);
		assert.deepEqual(f("[[Baile]] [[Town]] +[trpgpickmatch[tow]]"), ["Town"]);
	});
	test("no form for a system tiddler", function() {
		h.add(wiki, {title: "Draft of '$:/x'", "draft.of": "$:/x", tags: "Person", text: ""});
		assert.deepEqual(Array.from(form.fields(wiki, "Draft of '$:/x'")), []);
		wiki.deleteTiddler("Draft of '$:/x'");
	});
	test("a field that holds one entry is the same rule as the errors of locations/structure", function() {
		var all = f("[trpgtypelist[]]");
		["location", "owner"].forEach(function(field) {
			all.forEach(function(type) {
				var title = "Single " + type;
				h.add(wiki, {title: title, tags: type, text: "x"});
				h.add(wiki, {title: title, tags: type, text: "x", location: field === "location" ? "Baile Town" : undefined, owner: field === "owner" ? "Ann Bea" : undefined});
				var twice = h.checks(wiki, title, "locations").some(function(m) { return /Twice|Owners/.test(m.key); });
				assert.equal(form.single(wiki, title, field), twice, type + " " + field);
				wiki.deleteTiddler(title);
			});
		});
	});
	test("what a field may name comes from tiddlyrpg-targets of its config", function() {
		assert.ok(f("[[member]relationcandidates[]]").indexOf("Guild") !== -1);
		assert.equal(f("[[member]relationcandidates[]]").indexOf("Ann"), -1);
		assert.ok(f("[[leader]relationcandidates[]]").indexOf("Baile") !== -1);
		assert.ok(f("[[bond]relationcandidates[]]").indexOf("Frigg") !== -1);
	});
	test("no draft is a candidate: another tiddler open in the editor would be a target that goes", function() {
		h.add(wiki, {title: "Draft of 'Neue Person'", "draft.of": "Neue Person", "draft.title": "Neue Person", tags: "Person"});
		assert.equal(f("[[spouse]relationcandidates[]]").indexOf("Draft of 'Neue Person'"), -1);
		assert.equal(f("[[nosuchfield]relationcandidates[]]").indexOf("Draft of 'Neue Person'"), -1);
		assert.ok(f("[[spouse]relationcandidates[]]").indexOf("Ann") !== -1);
		wiki.deleteTiddler("Draft of 'Neue Person'");
	});
	test("the fields of the form are hidden in the field list of the core, and no system tiddler carries one", function() {
		var hidden = Array.from(form.known(wiki));
		hidden.forEach(function(field) {
			assert.equal(wiki.getTiddlerText("$:/config/EditTemplateFields/Visibility/" + field), "hide", field);
		});
		var carriers = f("[all[shadows]is[system]]").filter(function(title) {
			var fields = wiki.getTiddler(title).fields;
			return hidden.some(function(field) { return fields[field] !== undefined; });
		});
		assert.deepEqual(carriers, []);
	});
	test("the editor of a relation field: the entries as pills, the picker, the type colour", function() {
		h.add(wiki, {title: "Draft of 'Ann'", "draft.of": "Ann", tags: "Person", member: "Guild", text: "A."});
		var html = h.render(wiki, "text/html", "{{||$:/plugins/tiddlyrpg-core/editor/fields/relation}}", {currentTiddler: "Draft of 'Ann'", currentField: "member"});
		assert.match(html, /class="trpg-pick-pill" style="--trpg-kind:#ff8000;">Guild<button class="tc-btn-invisible trpg-pill-x"/);
		assert.match(html, /class="trpg-picker-input/);
		wiki.deleteTiddler("Draft of 'Ann'");
	});
	test("the form: no type -> the types to choose; the date of an event with the count of its dated sections", function() {
		h.add(wiki, {title: "Draft of 'Neu'", "draft.of": "Neu", text: ""});
		assert.match(h.render(wiki, "text/plain", "{{||$:/plugins/tiddlyrpg-core/editor/form}}", {currentTiddler: "Draft of 'Neu'"}), /Typ.*Ort/);
		h.add(wiki, {title: "Draft of 'Neu'", "draft.of": "Neu", tags: "Event", date: "1351-07-01, 1351-07-02", text: "<<date>>\n\nA."});
		assert.match(h.render(wiki, "text/plain", "{{||$:/plugins/tiddlyrpg-core/editor/form}}", {currentTiddler: "Draft of 'Neu'"}), /2 Abschnitte im Feld, 1 Datumsabschnitte im Text/);
		wiki.deleteTiddler("Draft of 'Neu'");
	});
});

test.describe("symmetric relations on both ends", function() {
	function list(title, field) {
		return $tw.utils.parseStringArray((wiki.getTiddler(title).fields[field]) || "") || [];
	}
	test("added and taken out on saving; others and missing ends untouched", function() {
		var before = wiki.getTiddler("Ann").fields;
		var changed = symmetric.sync(wiki, "Ann", before, $tw.utils.extend({}, before, {bond: "Bea Nobody", member: "Guild"}));
		assert.deepEqual(Array.from(changed), ["Bea"]);
		assert.deepEqual(Array.from(list("Bea", "bond")), ["Ann"]);
		assert.equal(wiki.getTiddler("Guild").fields.member, undefined);
		symmetric.sync(wiki, "Ann", {bond: "Bea"}, {});
		assert.equal(wiki.getTiddler("Bea").fields.bond, undefined);
	});
	test("no double entries; an open draft of the other end gets it too", function() {
		h.add(wiki, {title: "Draft of 'Bea'", "draft.of": "Bea", tags: "Person", text: "B."});
		symmetric.sync(wiki, "Cid", null, {bond: "Bea Ann"});
		assert.deepEqual(Array.from(list("Ann", "bond")), ["Cid"]);
		assert.deepEqual(Array.from(list("Draft of 'Bea'", "bond")), ["Cid"]);
		symmetric.sync(wiki, "Cid", null, {bond: "Bea Ann"});
		assert.deepEqual(Array.from(list("Ann", "bond")), ["Cid"]);
		wiki.deleteTiddler("Draft of 'Bea'");
		symmetric.sync(wiki, "Cid", {bond: "Bea Ann"}, {});
	});
	test("the hook on saving, compared with the tiddler the draft was of; off with the switch", function() {
		var draft = new $tw.Tiddler({title: "Draft of 'Ann'", "draft.of": "Ann", tags: "Person", enmity: "Bea"}),
			saved = new $tw.Tiddler({title: "Ann", tags: "Person", enmity: "Bea"});
		$tw.hooks.invokeHook("th-saving-tiddler", saved, draft);
		assert.deepEqual(Array.from(list("Bea", "enmity")), ["Ann"]);
		symmetric.sync(wiki, "Ann", {enmity: "Bea"}, {});
		h.add(wiki, {title: "$:/config/tiddlyrpg/editor/symmetric", text: "no"});
		$tw.hooks.invokeHook("th-saving-tiddler", saved, draft);
		assert.equal(wiki.getTiddler("Bea").fields.enmity, undefined);
		wiki.deleteTiddler("$:/config/tiddlyrpg/editor/symmetric");
	});
	test("a rename renames the other ends, also where the relation stays or goes", function() {
		h.add(wiki, {title: "Dora", tags: "Person", bond: "Eli", enmity: "Fay", text: "D."});
		h.add(wiki, {title: "Eli", tags: "Person", bond: "Dora", text: "E."});
		h.add(wiki, {title: "Fay", tags: "Person", enmity: "Dora", text: "F."});
		var draft = new $tw.Tiddler({title: "Draft of 'Dora'", "draft.of": "Dora", tags: "Person", bond: "Eli"}),
			saved = new $tw.Tiddler({title: "Dorothea", tags: "Person", bond: "Eli"});
		$tw.hooks.invokeHook("th-saving-tiddler", saved, draft);
		assert.deepEqual(Array.from(list("Eli", "bond")), ["Dorothea"]);
		assert.equal(wiki.getTiddler("Fay").fields.enmity, undefined, "the enmity taken out goes under the old title");
		["Dora", "Eli", "Fay"].forEach(function(t) { wiki.deleteTiddler(t); });
	});
});

test.describe("messages of a draft and their fixes", function() {
	test("rules on the draft, those about others on the title it is the draft of; a fix done leaves its message out", function() {
		// Cid has bond Ann, Ann not bond Cid: the hint is at Ann
		h.add(wiki, {title: "Draft of 'Ann'", "draft.of": "Ann", tags: "Person", location: "Nowhere-land", text: "A."});
		var ids = checks.forDraft(wiki, "Draft of 'Ann'").map(function(m) { return m.id; });
		assert.ok(ids.indexOf("relations/symmetric") !== -1, "from the saved title");
		assert.ok(ids.indexOf("relations/missing") !== -1, "from the draft");
		var sym = checks.forDraft(wiki, "Draft of 'Ann'").filter(function(m) { return m.id === "relations/symmetric"; })[0];
		assert.deepEqual(plain(sym.fix), {kind: "add", field: "bond", value: "Cid"});
		assert.ok(fixes.apply(wiki, "Draft of 'Ann'", sym.fix));
		assert.equal(wiki.getTiddler("Draft of 'Ann'").fields.bond, "Cid");
		assert.equal(checks.forDraft(wiki, "Draft of 'Ann'").filter(function(m) { return m.id === "relations/symmetric"; }).length, 0);
		var missing = checks.forDraft(wiki, "Draft of 'Ann'").filter(function(m) { return m.id === "relations/missing"; })[0];
		assert.deepEqual(plain(missing.fix), {kind: "create", title: "Nowhere-land", type: "Location"});
		wiki.deleteTiddler("Draft of 'Ann'");
	});
	test("remove, a location from a tag, status and caption named, the text of a spot", function() {
		h.add(wiki, {title: "Draft of 'X'", "draft.of": "X", tags: "Person Baile", family: "Ann", parent: "Ann", text: "x"});
		assert.ok(fixes.apply(wiki, "Draft of 'X'", {kind: "remove", field: "family", value: "Ann"}));
		assert.equal(wiki.getTiddler("Draft of 'X'").fields.family, undefined);
		assert.ok(fixes.apply(wiki, "Draft of 'X'", {kind: "tagToLocation", tag: "Baile"}));
		assert.deepEqual(Array.from(wiki.getTiddler("Draft of 'X'").fields.tags), ["Person"]);
		assert.equal(wiki.getTiddler("Draft of 'X'").fields.location, "Baile");
		h.add(wiki, {title: "Draft of 'X'", "draft.of": "X", tags: "Event", date: "1351-07-01", text: "<<date \"Rast\">>\n\n<<quest \"T\" \"failed\">>Y."});
		var keys = checks.forDraft(wiki, "Draft of 'X'").filter(function(m) { return m.fix; }).map(function(m) { return m.fix.kind; });
		assert.deepEqual(plain(keys.sort()), ["dateLabel", "questStatus"]);
		checks.forDraft(wiki, "Draft of 'X'").filter(function(m) { return m.fix && m.fix.kind === "dateLabel"; }).forEach(function(m) { fixes.apply(wiki, "Draft of 'X'", m.fix); });
		checks.forDraft(wiki, "Draft of 'X'").filter(function(m) { return m.fix && m.fix.kind === "questStatus"; }).forEach(function(m) { fixes.apply(wiki, "Draft of 'X'", m.fix); });
		assert.equal(wiki.getTiddler("Draft of 'X'").fields.text, "<<date label:\"Rast\">>\n\n<<quest \"T\" status:\"failed\">>Y.");
		wiki.deleteTiddler("Draft of 'X'");
	});
	test("a spot whose location holds its text: the fix takes the text out", function() {
		h.add(wiki, {title: "Mill", tags: "Location", text: "Grinds corn."});
		h.add(wiki, {title: "Draft of 'Vale'", "draft.of": "Vale", tags: "Location", text: "Vale.\n\n<<spot \"Mill\">>\n\nGrinds corn.\n"});
		var m = checks.forDraft(wiki, "Draft of 'Vale'").filter(function(m) { return m.id === "spots/joinedtext"; })[0];
		assert.equal(m.fix.kind, "spotEmpty");
		fixes.apply(wiki, "Draft of 'Vale'", m.fix);
		assert.equal(wiki.getTiddler("Draft of 'Vale'").fields.text, "Vale.\n\n<<spot \"Mill\">>\n");
		h.add(wiki, {title: "Mill", tags: "Location", text: "Another text."});
		h.add(wiki, {title: "Draft of 'Vale'", "draft.of": "Vale", tags: "Location", text: "Vale.\n\n<<spot \"Mill\">>\n\nGrinds corn.\n"});
		assert.equal(checks.forDraft(wiki, "Draft of 'Vale'").filter(function(m) { return m.id === "spots/joinedtext"; })[0].fix, undefined);
		wiki.deleteTiddler("Draft of 'Vale'");
		wiki.deleteTiddler("Mill");
	});
	test("a section of the field date without its <<date>> in the text: the hint dates/event names it", function() {
		h.add(wiki, {title: "Lost Date", tags: "Event", date: "1351-07-01, 1351-07-05, 1351-07-09", text: "<<date>>\n\nA.\n\n<<date>>\n\nB."});
		assert.ok(h.checkKeys(wiki, "Lost Date", "dates").indexOf("Check/Dates/NoHeading") !== -1);
		wiki.deleteTiddler("Lost Date");
	});
});

function plain(value) {
	return JSON.parse(JSON.stringify(value));
}

test.describe("fields of the rules in the form", function() {
	var draft = "Draft of 'Ring'";

	function withDraft(fields, fn) {
		h.add(wiki, Object.assign({title: draft, "draft.of": "Ring", text: ""}, fields));
		try {
			return fn();
		} finally {
			wiki.deleteTiddler(draft);
		}
	}

	test("shown when written, after the general fields and before the relations; labels of the ruleset", function() {
		withDraft({tags: "Item", price: "5 gp", rarity: "rare", owner: "Ann"}, function() {
			var shown = Array.from(form.fields(wiki, draft));
			assert.ok(shown.indexOf("price") < shown.indexOf("rarity") && shown.indexOf("rarity") < shown.indexOf("owner"), shown.join());
			assert.equal(form.label(wiki, draft, "rarity"), "Seltenheit");
			assert.equal(form.label(wiki, draft, "owner"), "Besitzer");
			assert.match(h.render(wiki, "text/plain", "{{||$:/plugins/tiddlyrpg-core/editor/form}}", {currentTiddler: draft}), /Seltenheit/);
		});
	});

	test("offered: the fields of the schema whose condition holds", function() {
		withDraft({tags: "Item"}, function() {
			var offered = Array.from(form.offered(wiki, draft));
			assert.ok(offered.indexOf("category") !== -1 && offered.indexOf("weight") !== -1, offered.join());
			assert.equal(offered.indexOf("damage"), -1, "damage only with weapon");
			assert.equal(offered.indexOf("hp"), -1, "no field of another type");
		});
		withDraft({tags: "Item", category: "weapon"}, function() {
			assert.ok(form.offered(wiki, draft).indexOf("damage") !== -1);
			assert.equal(form.offered(wiki, draft).indexOf("ac"), -1);
		});
		withDraft({tags: "Creature"}, function() {
			assert.ok(form.offered(wiki, draft).indexOf("expertise") !== -1, "a field only for the editor is offered");
		});
	});

	test("the input by format: a checkbox, a select, pills, text", function() {
		assert.deepEqual(f("attunement rarity category weight skills +[trpgfieldinput[]]"), ["boolean", "select", "pills", "text", "text"]);
		withDraft({tags: "Item"}, function() {
			var editor = function(field) {
				return h.render(wiki, "text/html", "{{||$:/plugins/tiddlyrpg-core/editor/fields/rules}}", {currentTiddler: draft, currentField: field});
			};
			assert.match(editor("attunement"), /type="checkbox"/);
			assert.match(editor("rarity"), /<select[^>]*><option value=""><\/option><option value="common">gewöhnlich<\/option><option value="rare">selten<\/option><\/select>/);
			assert.match(editor("weight"), /<input[^>]*trpg-field-input/);
		});
	});

	test("pills: the entries that stand alone, the traits of those chosen; toggling keeps what it cannot read", function() {
		withDraft({tags: "Item"}, function() {
			assert.deepEqual(f("[[" + draft + "]trpgfieldchoices[category]]"), ["weapon", "armor", "ammunition", "focus", "potion"]);
		});
		withDraft({tags: "Item", category: "weapon, Glimmer"}, function() {
			var choices = f("[[" + draft + "]trpgfieldchoices[category]]");
			assert.ok(choices.indexOf("martial") !== -1 && choices.indexOf("light") !== -1, choices.join());
			assert.equal(choices.indexOf("medium"), -1, "a trait of armor");
			assert.deepEqual(f("[[" + draft + "]trpgfieldchosen[category]]"), ["weapon"]);
			assert.deepEqual(f("[[" + draft + "]trpgfieldtoggle[category],[martial]]"), ["weapon, Glimmer, martial"]);
			assert.deepEqual(f("[[" + draft + "]trpgfieldtoggle[category],[weapon]]"), ["Glimmer"]);
			assert.deepEqual(f("[[martial]trpgfieldchoice[category]]"), ["Kriegswaffe"]);
		});
	});

	test("the reading: the value as shown, the derived value of an empty field, the problem", function() {
		withDraft({tags: "Creature", cr: "5", weight: "3 lb", str: "40"}, function() {
			assert.deepEqual(f("[[" + draft + "]trpgfieldreading[proficiency]]"), ["Abgeleitet: +3"]);
			assert.deepEqual(f("[[" + draft + "]trpgfieldreading[cr]]"), ["Ausgabe: 5"]);
			assert.deepEqual(f("[[" + draft + "]trpgfieldreading[str]]"), []);
			assert.deepEqual(f("[[" + draft + "]trpgfieldreading:problem[str]]"), ["Feld STR prüfen: 40 liegt außerhalb von 1 bis 30"]);
		});
	});

	test("a change of type takes out the fields of the rules the new type does not have", function() {
		var notice = "$:/temp/tiddlyrpg-core/editor/notice",
			wait = function() { return new Promise(function(resolve) { setTimeout(resolve, 20); }); };
		h.add(wiki, {title: draft, "draft.of": "Ring", tags: "Item", text: "", rarity: "rare", ac: "12"});
		return wait().then(function() {
			wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler(draft), {tags: ["Creature"]}));
			return wait();
		}).then(function() {
			var fields = wiki.getTiddler(draft).fields;
			assert.equal(fields.rarity, undefined);
			assert.equal(fields.ac, "12", "the creature has AC too");
			assert.equal(wiki.getTiddlerText(notice), "Typ gewechselt, entfernt: Seltenheit");
			wiki.deleteTiddler(draft);
			wiki.deleteTiddler(notice);
			return wait();
		});
	});
});

test.describe("values from the base (a relation with tiddlyrpg-copy)", function() {
	test("setting the base copies the empty values once, never the price; a lock comes with its value", function() {
		h.add(wiki, {title: "Warhammer", tags: "Item Equipment", category: "weapon, martial, melee, versatile", damage: "1d8 bludgeoning", weight: "2 lb", price: "15 gp", rarity: "rare", "secret-fields": "rarity", text: "."});
		h.add(wiki, {title: "Draft of 'Frostbringer'", "draft.of": "Frostbringer", tags: "Artifact", base: "Warhammer", damage: "1d8 bludgeoning plus 1d8 cold", text: ""});
		try {
			var done = form.copyFrom(wiki, "Draft of 'Frostbringer'", "base"),
				fields = wiki.getTiddler("Draft of 'Frostbringer'").fields;
			assert.equal(done.source, "Warhammer");
			assert.equal(done.fields.sort().join(), "category,rarity,weight");
			assert.equal(fields.damage, "1d8 bludgeoning plus 1d8 cold", "nothing written over");
			assert.equal(fields.price, undefined, "never the price");
			assert.equal(fields["secret-fields"], "rarity", "the lock comes with the value");
			assert.equal(form.copyFrom(wiki, "Draft of 'Frostbringer'", "base").fields.length, 0, "once: then there is nothing left");
			assert.equal(form.copyFrom(wiki, "Draft of 'Frostbringer'", "spells").fields.length, 0, "a relation that does not copy");
			var html = h.render(wiki, "text/html", "{{||$:/plugins/tiddlyrpg-core/editor/fields/relation}}", {currentTiddler: "Draft of 'Frostbringer'", currentField: "base"});
			assert.match(html, />Werte übernehmen</);
			assert.doesNotMatch(h.render(wiki, "text/html", "{{||$:/plugins/tiddlyrpg-core/editor/fields/relation}}", {currentTiddler: "Draft of 'Frostbringer'", currentField: "spells"}), /Werte übernehmen/);
		} finally {
			wiki.deleteTiddler("Warhammer");
			wiki.deleteTiddler("Draft of 'Frostbringer'");
		}
	});
});
