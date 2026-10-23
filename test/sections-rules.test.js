/*
 * Kinds of sections of the ruleset (modules/sections.js rulesKinds, the domain Section of the
 * fixture 5e-mini: effect, curse locked by the field cursed, trait, action with a heading,
 * legendary with a heading and an intro): a short form runs to the next marker, <<secret>> before
 * it locks it; the sections collected in the order of the domain with their headings and the intro
 * first; the name in bold before the text, the procedures of startup/sections.js and their place
 * among the known macros, the lock by a field in the views, the checks of a section, of an intro
 * and of the domain, the row of the hub.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki, sections;

var AXE = "Raksha-Axt",
	TOTEM = "Totem",
	CURSED = "Berserkeraxt",
	WOLF = "Grauwolf";

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		sections = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/sections.js");
		h.setLanguage(wiki, "de-DE");
		h.add(wiki, {title: "Theren", tags: "Player", player: "Tom", text: "."});
		h.add(wiki, {title: AXE, tags: "Item", text: "Eine alte Axt.\n\n<<effect \"Säureexplosion\">> Stirbt ein Gegner, explodiert er.\n\n* Säure\n* Schmerz\n\n<<effect \"Hass des Raksha!\">> Der sechste Schlag trifft härter.\n\nEr lädt sich bei jedem Treffer auf."});
		h.add(wiki, {title: TOTEM, tags: "Item", text: "Ein Totem.\n\n<$effect name=\"Geist des Hirsches\">\n\nDer Träger springt weit.\n\nUnd landet sicher.\n\n</$effect>\n\nEnde."});
		h.add(wiki, {title: CURSED, tags: "Item Theren", cursed: "yes", "secret-fields": "cursed", text: "Eine Axt +1.\n\n<<curse \"Fluch\">> Wer sie trägt, will sie nicht mehr hergeben.\n\nDer Zorn bleibt."});
		h.add(wiki, {title: WOLF, tags: "Creature", text: "Ein grauer Wolf.\n\n<<legendary \"Heulen\">> Der Wolf heult.\n\n<<action \"Klaue\">> Kratzt.\n\n<<legendary>> Der Wolf kann 3 legendäre Aktionen ausführen.\n\n<<trait \"Rudeltaktik\">> Vorteil im Rudel.\n\n<<action \"Biss\">> Beißt zu."});
	});
});

function body(title) {
	return h.render(wiki, "text/html", "<$trpg-body $tiddler=\"" + title + "\" $mode=\"block\"/>", {currentTiddler: title});
}

// The positions of the texts in <html>, in the order given; -1 for one that is missing
function positions(html, texts) {
	return texts.map(function(text) { return html.indexOf(text); });
}

function ascending(list) {
	return list.every(function(n, i) { return n !== -1 && (i === 0 || n > list[i - 1]); });
}

test("the kinds of the ruleset: the entries of its domain of type section", function() {
	assert.deepEqual(Object.keys(sections.rulesKinds(wiki)).sort(), ["action", "curse", "effect", "legendary", "trait"]);
	sections.read(wiki, AXE);
	assert.equal(sections.kind("curse").lock, "cursed");
	assert.equal(sections.kindLabel(wiki, "curse"), "Fluch");
	assert.equal(sections.heading(wiki, "action"), "Aktionen");
	assert.equal(sections.heading(wiki, "trait"), "", "no heading");
	assert.equal(sections.kindLabel(wiki, "date"), "Datumsabschnitte", "a kind of the core keeps its key");
});

test("the model: a short form runs to the next marker, a list belongs to it; the block what it encloses", function() {
	var records = sections.read(wiki, AXE).records,
		text = wiki.getTiddlerText(AXE);
	assert.deepEqual(Array.from(records.map(function(r) { return r.kind + " " + r.params.name; })), ["effect Säureexplosion", "effect Hass des Raksha!"]);
	assert.match(text.substring(records[0].from, records[0].to), /^<<effect "Säureexplosion">> Stirbt[^]*\* Schmerz$/);
	assert.match(text.substring(records[1].from, records[1].to), /Er lädt sich bei jedem Treffer auf\.$/, "the last one to the end");
	var block = sections.read(wiki, TOTEM).records;
	assert.equal(block.length, 1);
	assert.equal(block[0].form, "block");
	assert.equal(block[0].params.name, "Geist des Hirsches");
});

test("rendered: the name in bold before the text, a full stop unless it has a mark of its own", function() {
	var html = body(AXE);
	assert.match(html, /<div class="trpg-section trpg-section-effect trpg-section-rules"><p><span class="trpg-section-name">Säureexplosion\.<\/span> Stirbt ein Gegner, explodiert er\.<\/p><ul>/);
	assert.match(html, /<span class="trpg-section-name">Hass des Raksha!<\/span> Der sechste/);
	assert.doesNotMatch(html, /trpg-section-heading/, "effects have no heading");
	var totem = body(TOTEM);
	assert.match(totem, /<div class="trpg-section trpg-section-effect trpg-section-rules"><p><span class="trpg-section-name">Geist des Hirsches\.<\/span> Der Träger springt weit\.<\/p><p>Und landet sicher\.<\/p><\/div>/,
		"the block: the name runs into its first paragraph");
	assert.ok(totem.indexOf("Geist des Hirsches") < totem.indexOf("Ende."), "the block ends with its closing tag");
});

test("collected in the order of the domain, a heading before each kind that has one, the intro first", function() {
	var html = body(WOLF);
	assert.ok(ascending(positions(html, ["Ein grauer Wolf.", "Rudeltaktik.", ">Aktionen<", "Klaue.", "Biss.", ">Legendäre Aktionen<",
		"Der Wolf kann 3 legendäre", "Heulen."])), html);
	assert.match(html, /<div class="trpg-section-heading trpg-section-heading-action" style="--trpg-type:[^";]+;">Aktionen<\/div>/, "in the colour of the type");
	assert.doesNotMatch(html, /trpg-section-name">\./, "the intro has no name");
	assert.equal((html.match(/trpg-section-heading-action/g) || []).length, 1, "one heading for the kind");
});

test("<<secret>> before a section locks it; a heading only while one of its sections is seen", function() {
	h.add(wiki, {title: "Schatten", tags: "Creature Theren", text: "Ein Schatten.\n\n<<trait \"Dunkel\">> Kaum zu sehen.\n\n<<secret>><<action \"Würgen\">> Würgt.\n\n<<secret>>\n<<legendary>> Er kann eine legendäre Aktion ausführen.\n\n<<secret>><<legendary \"Verblassen\">> Verschwindet."});
	try {
		assert.deepEqual(h.checks(wiki, "Schatten", "sections"), []);
		h.inView(wiki, "public", function() {
			var html = body("Schatten");
			assert.match(html, /Kaum zu sehen/);
			assert.doesNotMatch(html, /Würgt|Aktionen|Verschwindet|legendäre Aktion/, "the locked sections and their headings");
		});
		var dm = body("Schatten");
		assert.ok(ascending(positions(dm, ["Dunkel.", ">Aktionen<", "trpg-secret-marker", "Würgen."])), dm);
		h.add(wiki, {title: "Schatten", tags: "Creature", text: "Ein Schatten.\n\n<<action \"Biss\">> Beißt.\n\n<<secret>><<action \"Würgen\">> Würgt."});
		h.inView(wiki, "public", function() {
			var html = body("Schatten");
			assert.match(html, />Aktionen<[^]*Beißt/, "one action seen: the heading stays");
			assert.doesNotMatch(html, /Würgt/);
		});
	} finally {
		wiki.deleteTiddler("Schatten");
	}
});

test("the procedures: one per kind, global, so no unknown macro", function() {
	var procedures = wiki.getTiddler("$:/temp/tiddlyrpg-core/sections/procedures");
	assert.ok(procedures && procedures.hasTag("$:/tags/Global"));
	assert.match(procedures.fields.text, /^\\procedure action\(name\)$/m);
	assert.deepEqual(h.checks(wiki, AXE, "macros"), []);
	assert.deepEqual(h.checks(wiki, WOLF, "macros"), []);
});

test("a curse is locked with the field cursed: the DM and the players of the tagged characters see it", function() {
	h.inView(wiki, "public", function() {
		var html = body(CURSED);
		assert.doesNotMatch(html, /hergeben|Zorn|trpg-section-curse/, "no curse - all that belongs to it -, no frame");
		assert.match(html, /Eine Axt \+1\./);
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
		assert.deepEqual(h.checks(wiki, WOLF, "sections"), []);
	} finally {
		wiki.deleteTiddler("Namenlos");
	}
});

test("checks of the intro: missing, twice, without the sections it introduces", function() {
	var keys = function(text) {
		h.add(wiki, {title: "Drache", tags: "Creature", text: text});
		try {
			return h.checks(wiki, "Drache", "sections").map(function(m) { return m.key; });
		} finally {
			wiki.deleteTiddler("Drache");
		}
	};
	assert.deepEqual(keys("<<legendary \"Biss\">> Beißt.\n\n<<legendary \"Flügel\">> Schlägt."), ["Section/Check/IntroMissing"], "told once");
	assert.deepEqual(keys("<<legendary>> Drei Aktionen.\n\n<<legendary>> Noch einmal.\n\n<<legendary \"Biss\">> Beißt."), ["Section/Check/IntroTwice"]);
	assert.deepEqual(keys("<<legendary>> Drei Aktionen."), ["Section/Check/IntroAlone"]);
	h.add(wiki, {title: "Drache", tags: "Creature", text: "<<legendary \"Biss\">> Beißt."});
	try {
		assert.match(h.checks(wiki, "Drache", "sections")[0].text, /<<legendary>> ist unvollständig, die Einleitung fehlt/);
	} finally {
		wiki.deleteTiddler("Drache");
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
