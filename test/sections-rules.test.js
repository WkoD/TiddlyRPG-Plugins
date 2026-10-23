/*
 * Kinds of sections of the ruleset (modules/sections.js rulesKinds, the domain Section of the
 * fixture 5e-mini: effect, curse locked by the field cursed, action): the model of both forms,
 * the name in bold before the text, the procedures of startup/sections.js and their place among
 * the known macros, the lock by a field in the views, the checks of a section and of the domain,
 * the row of the hub.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki, sections, checks;

var AXE = "Raksha-Axt",
	TOTEM = "Totem",
	CURSED = "Berserkeraxt";

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		sections = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/sections.js");
		checks = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/checks.js");
		h.setLanguage(wiki, "de-DE");
		h.add(wiki, {title: "Theren", tags: "Player", player: "Tom", text: "."});
		h.add(wiki, {title: AXE, tags: "Item", text: "Eine alte Axt.\n\n<<effect \"Säureexplosion\">> Stirbt ein Gegner, explodiert er.\n\n<<effect \"Hass des Raksha!\">> Der sechste Schlag trifft härter.\n\nSie gehört zur [[Rüstung des Tiamat]]."});
		h.add(wiki, {title: TOTEM, tags: "Item", text: "Ein Totem.\n\n<$effect name=\"Geist des Hirsches\">\n\nDer Träger springt weit.\n\nUnd landet sicher.\n\n</$effect>\n\nEnde."});
		h.add(wiki, {title: CURSED, tags: "Item Theren", cursed: "yes", "secret-fields": "cursed", text: "Eine Axt +1.\n\n<<curse \"Fluch\">> Wer sie trägt, will sie nicht mehr hergeben.\n\nNoch ein Satz."});
	});
});

function body(title) {
	return h.render(wiki, "text/html", "<$trpg-body $tiddler=\"" + title + "\" $mode=\"block\"/>", {currentTiddler: title});
}

test("the kinds of the ruleset: the entries of its domain of type section", function() {
	assert.deepEqual(Object.keys(sections.rulesKinds(wiki)).sort(), ["action", "curse", "effect"]);
	sections.read(wiki, AXE);
	assert.equal(sections.kind("curse").lock, "cursed");
	assert.equal(sections.kindLabel(wiki, "curse"), "Fluch");
	assert.equal(sections.kindLabel(wiki, "date"), "Datumsabschnitte", "a kind of the core keeps its key");
});

test("the model: a short form holds its paragraph, the block what it encloses", function() {
	var records = sections.read(wiki, AXE).records;
	assert.deepEqual(Array.from(records.map(function(r) { return r.kind + " " + r.params.name; })), ["effect Säureexplosion", "effect Hass des Raksha!"]);
	var text = wiki.getTiddlerText(AXE);
	assert.equal(text.substring(records[0].from, records[0].to), "<<effect \"Säureexplosion\">> Stirbt ein Gegner, explodiert er.", "only its paragraph: prose may follow");
	var block = sections.read(wiki, TOTEM).records;
	assert.equal(block.length, 1);
	assert.equal(block[0].form, "block");
	assert.equal(block[0].params.name, "Geist des Hirsches");
});

test("rendered: the name in bold before the text, a full stop unless it has a mark of its own", function() {
	var html = body(AXE);
	assert.match(html, /<div class="trpg-section trpg-section-effect"><p><span class="trpg-section-name">Säureexplosion\.<\/span> Stirbt ein Gegner/);
	assert.match(html, /<span class="trpg-section-name">Hass des Raksha!<\/span> Der sechste/);
	assert.match(html, /<p>Sie gehört zur/, "the prose after the effects stays prose");
	var totem = body(TOTEM);
	assert.match(totem, /<div class="trpg-section trpg-section-effect"><p><span class="trpg-section-name">Geist des Hirsches\.<\/span> Der Träger springt weit\.<\/p><p>Und landet sicher\.<\/p><\/div>/,
		"the block: the name runs into its first paragraph");
});

test("the procedures: one per kind, global, so no unknown macro", function() {
	var procedures = wiki.getTiddler("$:/temp/tiddlyrpg-core/sections/procedures");
	assert.ok(procedures && procedures.hasTag("$:/tags/Global"));
	assert.match(procedures.fields.text, /^\\procedure action\(name\)$/m);
	assert.deepEqual(h.checks(wiki, AXE, "macros"), []);
});

test("a curse is locked with the field cursed: the DM and the players of the tagged characters see it", function() {
	h.inView(wiki, "public", function() {
		var html = body(CURSED);
		assert.doesNotMatch(html, /hergeben|trpg-section-curse/, "no curse, no frame");
		assert.match(html, /Eine Axt \+1\.[^]*Noch ein Satz\./);
	});
	h.inView(wiki, "player:Tom", function() {
		assert.match(body(CURSED), /hergeben/, "Theren is tagged");
	});
	h.inView(wiki, "player:Ann", function() {
		assert.doesNotMatch(body(CURSED), /hergeben/);
	});
	var dm = body(CURSED);
	assert.match(dm, /trpg-section-lock trpg-section-locked[^]*trpg-secret-marker[^]*Theren[^]*hergeben/, "the DM sees the marker of the lock");
	h.add(wiki, Object.assign({}, wiki.getTiddler(CURSED).fields, {"secret-fields": undefined}));
	try {
		h.inView(wiki, "public", function() {
			var html = body(CURSED);
			assert.match(html, /<span class="trpg-section-name">Fluch\.<\/span> Wer sie trägt/, "the lock lifted: everyone sees it");
			assert.doesNotMatch(html, /trpg-secret-marker/);
		});
	} finally {
		h.add(wiki, Object.assign({}, wiki.getTiddler(CURSED).fields, {"secret-fields": "cursed"}));
	}
});

test("checks: a section without name; a curse whose field is empty - everyone sees it", function() {
	h.add(wiki, {title: "Namenlos", tags: "Item", text: "<<action>> Beißt zu.\n\n<<curse \"Fluch\">> Pech."});
	try {
		var found = h.checks(wiki, "Namenlos", "sections").map(function(m) { return m.level + " " + m.key; });
		assert.deepEqual(found, ["error Section/Check/SectionName", "hint Section/Check/LockField"]);
		assert.match(h.checks(wiki, "Namenlos", "sections")[1].text, /<<curse "Fluch">> ist an das Feld Verflucht gebunden, das leer ist/);
		assert.deepEqual(h.checks(wiki, CURSED, "sections"), []);
	} finally {
		wiki.deleteTiddler("Namenlos");
	}
});

test("the domain: an id of a kind of the core, a lock by a field the rules do not know", function() {
	h.add(wiki, {title: "$:/tiddlyrpg/rules/domain/Section", tags: "$:/tags/tiddlyrpg/RulesDomain", type: "application/json",
		text: JSON.stringify({domain: "Section", type: "section", keys: "Rules/Section/", entries: [{id: "date"}, {id: "hex", lock: "nope"}]})});
	try {
		var keys = Array.from(sections.domainProblems(wiki).map(function(p) { return p.key + " " + p.params.id; }));
		assert.deepEqual(keys, ["Check/Plugins/SectionCore date", "Check/Plugins/SectionLock hex"]);
		assert.equal(sections.rulesKinds(wiki).date, undefined, "the core keeps its kind");
	} finally {
		wiki.deleteTiddler("$:/tiddlyrpg/rules/domain/Section");
	}
	assert.equal(sections.domainProblems(wiki).length, 0);
});

test("the hub Ruleset: each kind with its call, its label and its lock", function() {
	var rules = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/rules.js"),
		table = rules.table(wiki, "Section");
	assert.match(table, /<code>curse<\/code><\/td><td><code>&lt;&lt;curse &quot;…&quot;&gt;&gt;<\/code> Fluch <small>\(gesperrt mit dem Feld cursed\)<\/small>/);
});
