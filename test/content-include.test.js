/*
 * Included entries of content packages (modules/content-include.js, startup/content-include.js):
 * a wiki folder of its own with a package in node_modules and tiddlers that name entries, booted as
 * a wiki is - the startup module includes what they name, transitively, as the shadows of the
 * plugin $:/plugins/tiddlyrpg/content-packages. Where they count like tiddlers (candidates, hubs,
 * search, glossary), the italics of their links, tag pills and graph nodes, an own version.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	fs = require("fs"),
	os = require("os"),
	path = require("path"),
	h = require("./helpers");

var $tw, wiki, content, include, dir;

var RULESET = "$:/plugins/fixture-ruleset-5e-mini",
	PLUGIN = "$:/plugins/tiddlyrpg/content-packages",
	INCLUDED = ["Darkvision", "Evocation", "Fireball", "Keen Senses", "Light (Spell)", "Longsword", "Prone", "Wizard", "Wolf"];

function write(file, data) {
	fs.mkdirSync(path.dirname(file), {recursive: true});
	fs.writeFileSync(file, typeof data === "string" ? data : JSON.stringify(data));
}

// A tiddler of the wiki folder as a .tid file
function tid(fields) {
	var text = fields.text || "",
		head = Object.keys(fields).filter(function(name) { return name !== "text"; }).map(function(name) {
			return name + ": " + fields[name];
		}).join("\n");
	write(path.join(dir, "tiddlers", fields.title.replace(/[^A-Za-z0-9 ()-]/g, "_") + ".tid"), head + "\n\n" + text);
}

test.before(function() {
	dir = fs.mkdtempSync(path.join(os.tmpdir(), "trpg-include-"));
	fs.copyFileSync(path.join(__dirname, "..", "editions", "test", "tiddlywiki.info"), path.join(dir, "tiddlywiki.info"));
	var base = path.join(dir, "node_modules", "srd-mini");
	write(path.join(base, "package.json"), {name: "srd-mini", version: "1.0.0", tiddlyrpg: {content: ["content/manifest.json"]}});
	write(path.join(base, "content", "manifest.json"), {name: "SRD mini", ruleset: RULESET, language: "en-GB",
		"tiddlyrpg-core-version": ">=2.0.0", source: "SRD 5.1", tag: "SRD mini English", files: ["entries.json"]});
	write(path.join(base, "content", "entries.json"), {entries: [
		{id: "longsword", title: "Longsword", type: "Item", tags: ["Equipment"], fields: {damage: "1d8 slashing"}, text: "A sword."},
		{id: "rope", title: "Rope", type: "Item", fields: {}, text: "Nobody names it."},
		{id: "fireball", title: "Fireball", type: "Spell", fields: {classes: ["Wizard"]}, text: "Leaves them <<term prone>>."},
		{id: "light", title: "Light", type: "Spell", fields: {}, text: "Bright."},
		{id: "wizard", title: "Wizard", type: "Class", tags: ["Information"], fields: {}, text: "A mage."},
		{id: "evocation", title: "Evocation", type: "Class", tags: ["Information"], fields: {classes: ["Wizard"]}, text: "A school."},
		{id: "keen", title: "Keen Senses", type: "Trait", tags: ["Information"], fields: {}, text: "Keen."},
		{id: "glossary:prone", title: "Prone", type: "Glossary", tags: ["Information"], fields: {term: "prone"}, text: "Down."},
		{id: "glossary:darkvision", title: "Darkvision", type: "Glossary", tags: ["Information"], fields: {term: "darkvision"}, text: "Sees."},
		{id: "wolf", title: "Wolf", type: "Creature", fields: {}, text: "A wolf."}
	]});
	[
		{title: "Klinge", tags: "Item", base: "Longsword", text: "A blade."},
		{title: "Zauberstab", tags: "Item", spells: "Fireball [[Light (Spell)]]", text: "A wand."},
		{title: "Magierin", tags: "Person", classes: "Evocation", text: "A mage."},
		{title: "Bericht", text: "A [[Wolf]] and <<rule \"Keen Senses\">>."},
		{title: "Light", tags: "Location", text: "A place of that name."},
		{title: "Höhlenbär", tags: "Creature", senses: "darkvision 60 ft", text: "A bear."}
	].forEach(tid);
	return h.boot(dir).then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		content = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/content.js");
		include = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/content-include.js");
	});
});

test.after(function() {
	fs.rmSync(dir, {recursive: true, force: true});
});

function f(text) {
	return Array.from(h.filter(wiki, text));
}

// Adds <fields> as a tiddler for <fn>, then removes it again
function withTiddler(fields, fn) {
	h.add(wiki, fields);
	try {
		return fn();
	} finally {
		wiki.deleteTiddler(fields.title);
	}
}

test("at the start: what the tiddlers name, transitively; nothing else of the package", function() {
	assert.deepEqual(Array.from(content.included(wiki)).sort(), INCLUDED);
	assert.equal(wiki.getShadowSource("Longsword"), PLUGIN);
	assert.ok(!wiki.isShadowTiddler("Rope"), "named by nothing");
	assert.equal(wiki.getTiddler(PLUGIN).fields["plugin-type"], "plugin");
	assert.equal(wiki.getTiddler(PLUGIN).fields.name, "Content packages");
});

test("an included entry: the fields to take, without created and modified", function() {
	var fields = wiki.getTiddler("Longsword").fields;
	assert.deepEqual(Array.from(fields.tags), ["Item", "Equipment", "SRD mini English"]);
	assert.equal(fields.source, "SRD 5.1");
	assert.equal(fields.text, "A sword.");
	assert.equal(fields.created, undefined);
	assert.equal(fields.modified, undefined);
});

test("another tiddler of the title: the entry under \"Title (Type)\"", function() {
	assert.ok(wiki.isShadowTiddler("Light (Spell)"));
	assert.deepEqual(Array.from(wiki.getTiddler("Light").fields.tags), ["Location"]);
});

test("the start leaves the wiki as it found it: no index, the ruleset with its switcher, nothing written", function() {
	assert.ok(!wiki.tiddlerExists(content.INDEX));
	assert.equal($tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/plugin-types.js").active(wiki, "ruleset"), RULESET);
	assert.equal(wiki.getShadowSource("$:/tiddlyrpg/rules/domain/Ability"), RULESET, "unpacked by its switcher, not left unregistered");
	assert.equal(wiki.getShadowSource("$:/tiddlyrpg/fixture/ruleset"), RULESET);
	assert.deepEqual(fs.readdirSync(path.join(dir, "tiddlers")).filter(function(file) { return /content-packages/.test(file); }), []);
});

test("the same entries when the library runs again after the boot", function() {
	assert.deepEqual(Object.keys(include.collect(wiki, dir)).sort(), INCLUDED);
	assert.ok(!wiki.tiddlerExists(content.INDEX));
});

test("found like tiddlers: candidates of a relation, the hubs, the search, the glossary", function() {
	assert.ok(f("[[base]relationcandidates[]]").indexOf("Longsword") !== -1);
	assert.ok(f("[[Item]trpghubentries[]]").indexOf("Longsword") !== -1, "the hub Item by its own filter");
	assert.ok(f("[[Spell]trpghubentries[]]").indexOf("Fireball") !== -1, "a hub by its tag");
	assert.deepEqual(f("[all[tiddlers+included]!is[system]search:title[Longsw]]"), ["Longsword"]);
	assert.deepEqual(f("[all[included]prefix[Wiz]]"), ["Wizard"]);
	assert.deepEqual(f("[[prone]trpgglossary[]]"), ["Prone"]);
	assert.deepEqual(f("[[Klinge]] [[Longsword]] +[trpgincluded[]]"), ["Longsword"]);
});

test("a relation to an included entry is no missing tiddler; nothing of the package is checked", function() {
	assert.equal(h.checkKeys(wiki, "Zauberstab", "relations").indexOf("Check/Relations/Missing"), -1);
	assert.equal(h.checkKeys(wiki, "Klinge", "relations").indexOf("Check/Relations/Missing"), -1);
});

test("links in italics through the stylesheet of the plugin, tag pills through their class", function() {
	var css = wiki.getTiddlerText(include.STYLES);
	assert.ok(wiki.getTiddler(include.STYLES).hasTag("$:/tags/Stylesheet"));
	assert.ok(css.indexOf("a.tc-tiddlylink-shadow:not(.tc-tiddlylink-resolves)[href=\"#Longsword\"]") !== -1, css);
	assert.ok(css.indexOf("[href=\"#Light%20%28Spell%29\"]") !== -1, "as the link widget writes the href");
	assert.equal(css.indexOf("Rope"), -1);
	var link = h.render(wiki, "text/html", "[[Longsword]]");
	assert.match(link, /class="tc-tiddlylink tc-tiddlylink-shadow"/, link);
	assert.match(h.render(wiki, "text/html", "<<tag Longsword>>"), /class="tc-tag-label tc-btn-invisible trpg-included"/);
	assert.doesNotMatch(h.render(wiki, "text/html", "<<tag Klinge>>"), /trpg-included/);
	assert.match(include.styles(["Say \"hi\""]), /\[href="#Say%20%22hi%22"\]/);
});

test("an own version wins: no longer included, no italics; deleted, the entry is back", function() {
	withTiddler({title: "Fireball", tags: "Spell", text: "Our fireball."}, function() {
		assert.equal(content.included(wiki).indexOf("Fireball"), -1);
		assert.deepEqual(f("[[Fireball]trpgincluded[]]"), []);
		assert.doesNotMatch(h.render(wiki, "text/html", "<<tag Fireball>>"), /trpg-included/);
		assert.match(h.render(wiki, "text/html", "[[Fireball]]"), /tc-tiddlylink-resolves/);
	});
	assert.ok(content.included(wiki).indexOf("Fireball") !== -1);
});

test("the graphs: an included node carries trpgIncluded, its label in italics", function() {
	var graph = h.graph(wiki, "<$graph.view $tiddler=\"$:/plugins/tiddlyrpg-core/graph/ego\"/>", {currentNode: "Klinge"});
	assert.equal(graph.nodes.Longsword.trpgIncluded, "yes");
	assert.notEqual(graph.nodes.Klinge.trpgIncluded, "yes");
	var italic = $tw.modules.execute("$:/plugins/tiddlyrpg-core/graph/included.js"),
		changes = {nodes: {
			a: {label: "Longsword", trpgIncluded: "yes"},
			b: {label: "Klinge"},
			c: {label: "Hut", trpgIncluded: "yes", trpgPin: "tiddler"},
			d: {label: "Dead", trpgIncluded: "yes", trpgDead: "yes"}
		}};
	italic.process({}, changes);
	assert.equal(changes.nodes.a.label, "<i>Longsword</i>");
	assert.equal(changes.nodes.a.font.multi, "html");
	assert.equal(changes.nodes.b.label, "Klinge");
	assert.equal(changes.nodes.c.label, "Hut", "a pin draws its own label");
	assert.equal(changes.nodes.d.label, "Dead", "a dead node is drawn by graph/pill.js");
});

test("the hub Content: an included entry is \"included\", not an offer", function() {
	var server = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/content-server.js");
	withTiddler({title: content.INDEX, type: "application/json", text: JSON.stringify({ruleset: RULESET, packages: server.index(dir, RULESET)})}, function() {
		var entries = content.entries(wiki),
			by = function(title) { return entries.filter(function(e) { return e.title === title; })[0]; };
		assert.equal(by("Longsword").included, true);
		assert.equal(by("Longsword").taken, true);
		assert.equal(by("Rope").included, false);
		assert.deepEqual(f("[[longsword]trpgcontentoffer[included]]"), ["yes"]);
		assert.deepEqual(f("[[rope]trpgcontentoffer[included]]"), []);
		assert.equal(content.offers(wiki).filter(function(o) { return o.title === "Longsword"; }).length, 0);
	});
});
