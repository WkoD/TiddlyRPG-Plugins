/*
 * Quests (modules/quests.js, filters/quests.js, the kind quest of modules/sections.js): the
 * markers in an event - short form for its paragraph or list item, stacked at its start or
 * mid-text, the block for several paragraphs or inside one - and that they split no dated
 * section; the hints; status, order, quest or rumour, the links between
 * quests; the hub Quest with its switches and cards, the page of a quest and of a rumour; what
 * the views see; renaming through Relink.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki, sections, dates;

var EVENT = {title: "Questfahrt", tags: "Event Frigg", date: "1351-01-01, 1351-02-01, 1351-03-01",
	text: "<<date>>\n\nVorher.\n\n<<quest \"Turm\">><<quest \"Spur\">><<quest \"Echo\">>Am Turm in [[Baile]] hallte es.\n\nDazwischen.\n\n" +
		"<<date label:\"Zwei\">>\n\n* <<quest \"Liste\">>Ein Punkt\n* Ein anderer\n\n<$quest name=\"Block\" status=\"failed\">\n\nBlock eins.\n\nBlock zwei.\n\n</$quest>\n\n" +
		"<<date>>\n\n<<quest \"Turm\" status:\"complete\">>Der Turm fiel.\n\nSchluss."};

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		sections = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/sections.js");
		dates = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/dates.js");
		h.setLanguage(wiki, "de-DE");
		h.add(wiki, EVENT);
		h.add(wiki, {title: "Turm", tags: "Quest Frigg", text: "Den Turm finden."});
	});
});

function f(text, variables) {
	return Array.from(h.filter(wiki, text, variables));
}

function body(title) {
	return h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/templates/body-sections\" $mode=\"block\"/>", {currentTiddler: title});
}

function plain(text) {
	return h.render(wiki, "text/plain", text);
}

function withTiddlers(list, fn) {
	list.forEach(function(fields) { h.add(wiki, fields); });
	try {
		return fn();
	} finally {
		list.forEach(function(fields) { wiki.deleteTiddler(fields.title); });
	}
}

function hint(title, pattern) {
	return f("[[" + title + "]sectioncheck[]]").some(function(t) { return pattern.test(t); });
}

test.describe("markers in the text", function() {
	test("stacked, list item, block: parents and kinds; the dated sections stay", function() {
		var model = sections.read(wiki, "Questfahrt");
		var shown = Array.from(model.records, function(r) {
			var up = r.parent === -1 ? null : model.records[r.parent];
			return r.kind + (r.params.name ? ":" + r.params.name : "") + (up ? "<" + up.kind + (up.params.name ? ":" + up.params.name : "") : "");
		});
		assert.deepEqual(shown, ["date", "quest:Turm<date", "quest:Spur<quest:Turm", "quest:Echo<quest:Spur", "date", "quest:Liste<date", "quest:Block<date", "date", "quest:Turm<date"]);
		assert.deepEqual(Array.from(dates.sections(wiki, "Questfahrt").placeholders, function(p) { return p.number; }), [1, 2, 3]);
		assert.deepEqual(f("[[Questfahrt]sectioncheck[]]"), []);
	});

	test("the event: a frame per marker, stacked ones around the same paragraph, a list item framed inside, labels with quest or rumour", function() {
		var html = body("Questfahrt");
		assert.match(html, /<div class="trpg-section trpg-section-quest trpg-quest-real"><div class="trpg-section trpg-section-quest trpg-quest-rumour"><div class="trpg-section trpg-section-quest trpg-quest-rumour"><p><span class="trpg-quest-label trpg-quest-real">/);
		assert.match(html, /<span class="trpg-quest-kind">Gerücht<\/span><a[^>]*>Echo<\/a><\/span>Am Turm in <a[^>]*>Baile<\/a> hallte es\.<\/p><\/div><\/div><\/div>/);
		assert.match(html, /<li><div class="trpg-section trpg-section-quest trpg-quest-rumour"><span class="trpg-quest-label trpg-quest-rumour"><span class="trpg-quest-kind">Gerücht<\/span><a[^>]*>Liste<\/a><\/span>Ein Punkt<\/div><\/li><li>Ein anderer<\/li>/);
		assert.match(html, /<span class="trpg-quest-kind">Quest<\/span><a[^>]*>Turm<\/a><span class="trpg-quest-status">abgeschlossen<\/span>/);
		assert.match(html, /Dazwischen\./);
		assert.ok(html.indexOf("trpg-section-quest") < html.indexOf("Dazwischen") && html.lastIndexOf("Dazwischen") < html.indexOf("Zwei"), html);
	});

	test("trpg-body $quest: only what one marker holds", function() {
		var key = function(name) { return f("[[" + name + "]questlast[]questmark:key[]]")[0]; };
		assert.equal(plain("<$trpg-body $tiddler=\"Questfahrt\" $mode=\"block\" $quest=\"" + key("Echo") + "\"/>").trim(), "QuestTurmGerüchtSpurGerüchtEchoAm Turm in Baile hallte es.");
		assert.equal(plain("<$trpg-body $tiddler=\"Questfahrt\" $mode=\"block\" $quest=\"" + key("Liste") + "\"/>").trim(), "GerüchtListeEin Punkt");
		assert.equal(plain("<$trpg-body $tiddler=\"Questfahrt\" $mode=\"block\" $quest=\"" + key("Block") + "\"/>").trim(), "GerüchtBlockfehlgeschlagenBlock eins.Block zwei.");
		assert.match(plain("<$trpg-body $tiddler=\"Questfahrt\" $mode=\"block\" $quest=\"" + key("Spur") + "\"/>"), /Am Turm in Baile.*hallte es\./);
	});

	test("mid-text: no hint, the rest of the paragraph tinted, an inner one linked", function() {
		withTiddlers([
			{title: "Q Mitte", tags: "Event", date: "1351", text: "<<date>>\n\nText <<quest \"Qm1\">> mitten."},
			{title: "Q Innen", tags: "Event", date: "1351", text: "<<date>>\n\n<<quest \"Qm2\">>Text <<quest \"Qm3\">> mitten."},
			{title: "Q Punkt", tags: "Event", date: "1351", text: "<<date>>\n\n* Text <<quest \"Qm4\">> mitten."},
			{title: "Q Eingebettet", tags: "Event", date: "1351", text: "<<date>>\n\nText <$quest name=\"Qm5\">mitten</$quest> weiter."}
		], function() {
			["Q Mitte", "Q Innen", "Q Punkt", "Q Eingebettet"].forEach(function(title) {
				assert.deepEqual(f("[[" + title + "]sectioncheck[]]"), [], title);
			});
			assert.match(body("Q Mitte"), /<p>Text <span class="trpg-section trpg-section-quest trpg-quest-rumour"><span class="trpg-quest-label[^]*<\/span> mitten\.<\/span><\/p>/);
			assert.match(body("Q Punkt"), /<li>Text <span class="trpg-section trpg-section-quest trpg-quest-rumour">/);
			assert.match(body("Q Eingebettet"), /Text <span class="trpg-section trpg-section-quest trpg-quest-rumour"><span class="trpg-quest-label[^]*<\/span>mitten<\/span> weiter\./);
			assert.deepEqual(f("[[Qm2]questlinks[]]"), ["Qm3"]);
			assert.deepEqual(f("[[Qm3]questlinks[]]"), ["Qm2"]);
		});
	});

	test("hints: nothing marked, status, by position, no quest, no date, wrong type", function() {
		withTiddlers([
			{title: "Q Leer", tags: "Event", date: "1351", text: "<<date>>\n\n<<quest \"X\">>"},
			{title: "Q Status", tags: "Event", date: "1351", text: "<<date>>\n\n<<quest \"X\" status:\"done\">>Text."},
			{title: "Q Position", tags: "Event", date: "1351", text: "<<date>>\n\n<<quest \"X\" \"complete\">>Text."},
			{title: "Q Kein", tags: "Event", date: "1351", text: "<<date>>\n\n<<quest \"Baile\">>Text."},
			{title: "Q Vorn", tags: "Event", date: "1351", text: "<<quest \"X\">>Vor dem Datum.\n\n<<date>>\n\nText."},
			{title: "Q Ort", tags: "Location", text: "<<quest \"X\">>Kein Ereignis."},
			{title: "Q Gleich", tags: "Event", date: "1351", text: "<<date>>\n\n<<quest \"X\">><<quest \"X\">>Doppelt."}
		], function() {
			assert.ok(hint("Q Leer", /markiert nichts/));
			assert.ok(hint("Q Status", /„done“ ist kein Status/));
			assert.ok(hint("Q Position", /der Status steht benannt: status:"complete"/));
			assert.ok(hint("Q Kein", /„Baile“ ist ein Tiddler, aber kein Quest/));
			assert.ok(hint("Q Vorn", /steht in keinem Datumsabschnitt/));
			assert.ok(hint("Q Ort", /zählt nur in einem Tiddler mit Tag Ereignis/));
			assert.ok(hint("Q Gleich", /ineinander verschachtelt/));
		});
	});
});

test.describe("index", function() {
	test("names newest first, quest or rumour, status of the newest marker", function() {
		assert.deepEqual(f("[questnames[]]"), ["Turm", "Block", "Liste", "Echo", "Spur"]);
		assert.deepEqual(f("[questnames[]questreal[]]"), ["Turm"]);
		assert.deepEqual(f("[[Turm]queststatus[]] [[Block]queststatus[]] [[Spur]queststatus[]]"), ["complete", "failed", "open"]);
		assert.deepEqual(f("[[Turm]questmarks[]] :map[questmark:number[]]"), ["3", "1"]);
		assert.deepEqual(f("[[Turm]questmarks[]] :map[questmark:anchor[]]"), ["date-3", ""]);
	});

	test("a newer marker without status opens a quest again", function() {
		withTiddlers([{title: "Später", tags: "Event", date: "1352", text: "<<date>>\n\n<<quest \"Turm\">>Wieder offen."}], function() {
			assert.deepEqual(f("[[Turm]queststatus[]]"), ["open"]);
		});
	});

	test("links: a marker directly in another, both ways, only neighbours", function() {
		assert.deepEqual(f("[[Turm]questlinks[]]"), ["Spur"]);
		assert.deepEqual(f("[[Spur]questlinks[]]"), ["Echo", "Turm"]);
		assert.deepEqual(f("[[Echo]questlinks[]]"), ["Spur"]);
	});

	test("who takes part: the tags of the quest, of a rumour the characters of its events", function() {
		withTiddlers([{title: "Ragna", tags: "Player", player: "Jan"}, {title: "Nur Ragna", tags: "Event Ragna", date: "1351", text: "<<date>>\n\n<<quest \"Echo\">>Noch einmal."}], function() {
			assert.deepEqual(f("[[Turm]questplayers[]]"), ["Frigg"]);
			assert.deepEqual(f("[[Echo]questplayers[]]"), ["Frigg", "Ragna"]);
		});
	});
});

test.describe("hub and pages", function() {
	function hub() {
		return plain("{{Quest}}");
	}

	test("switches only for a status that exists, open on: complete and failed hidden", function() {
		var text = hub();
		assert.match(text, /Zeigen:offen3abgeschlossen1fehlgeschlagen1/);
		assert.match(text, /Quests0Nichts mit diesem Stand\.Gerüchte3/);
		assert.ok(text.indexOf("Block") === -1, text);
		withTiddlers([{title: "Weg mit Block", tags: "Event", date: "1352", text: "<<date>>\n\n<<quest \"Block\">>Neu offen."}], function() {
			assert.match(hub(), /Zeigen:offen4abgeschlossen1Quests/);
		});
	});

	test("cards: date, name, start of the newest marker, event, markers; done ones grey with status", function() {
		withTiddlers([{title: "$:/state/tiddlyrpg-core/quest-filter/complete", text: "yes"}], function() {
			var html = h.render(wiki, "text/html", "{{Quest}}");
			assert.match(html, /<div class="trpg-quest-card trpg-quest-real trpg-quest-done">/);
			assert.match(html, /1\. Ches 1351/);
			assert.match(html, /Der Turm fiel\./);
			assert.match(html, /<span class="trpg-quest-pill">abgeschlossen<\/span>/);
			assert.match(hub(), /1\. Hammer 1351FriggEchoQuestTurmGerüchtSpurGerüchtEchoAm Turm in Baile hallte es\.Questfahrt1 Marker/);
			assert.match(html, /<span class="trpg-quest-card-dots"><span class="tc-tag-list-item" data-tag-title="Frigg">/);
		});
	});

	test("the page of a quest: planning, links, history newest first", function() {
		var text = plain("<$transclude $tiddler=\"$:/core/ui/ViewTemplate/body\"/>".replace("/>", " $mode=\"block\"/>")).trim();
		var page = h.render(wiki, "text/plain", "<$transclude $tiddler=\"$:/core/ui/ViewTemplate/body\" $mode=\"block\"/>", {currentTiddler: "Turm", storyTiddler: "Turm"});
		assert.ok(text !== undefined);
		assert.match(page, /Den Turm finden\.Verbunden mit:SpurVerlauf1\. Ches 1351Questfahrtabgeschlossen.*Der Turm fiel\.1\. Hammer 1351Questfahrt.*Am Turm in Baile/);
	});

	test("the page of a rumour: hint, create and rename in the editable wiki only", function() {
		var page = function() { return h.render(wiki, "text/plain", "<$transclude $tiddler=\"$:/core/ui/ViewTemplate/body\" $mode=\"block\"/>", {currentTiddler: "Spur", storyTiddler: "Spur"}); };
		assert.match(page(), /Ein Gerücht: noch ohne eigenen Tiddler.*Quest anlegen.*Verbunden mit:Echo, Turm/);
		withTiddlers([{title: "$:/status/IsReadOnly", text: "yes"}], function() {
			assert.ok(page().indexOf("Quest anlegen") === -1);
		});
		withTiddlers([{title: "$:/state/tiddlyrpg-core/quest-rename/Spur", text: "Turm"}], function() {
			assert.match(page(), /Umbenennen.*Gibt es schon/);
		});
	});

	test("the hub Campaign includes it", function() {
		assert.match(h.body(wiki, "Campaign"), /Quests und Gerüchte[\s\S]*Zeigen:offen/);
	});
});

test.describe("views", function() {
	var LOCKED = {title: "Geheime Fahrt", tags: "Event", date: "1352, 1353",
		text: "<<date>>\n\n<<quest \"Spur\" status:\"complete\">>Offen zu Ende.\n\n<<secret \"Frigg\">><<date>>\n\n<<quest \"Spur\">><<quest \"Schatten\">>Nur für Frigg."};

	test("a marker in a locked section: not counted for status, names, links, history", function() {
		withTiddlers([LOCKED], function() {
			assert.deepEqual(f("[[Spur]queststatus[]]"), ["open"]);
			h.inView(wiki, "public", function() {
				assert.deepEqual(f("[[Spur]queststatus[]]"), ["complete"]);
				assert.ok(f("[questnames[]]").indexOf("Schatten") === -1);
				assert.ok(f("[[Spur]questlinks[]]").indexOf("Schatten") === -1);
				assert.deepEqual(f("[[Schatten]questmarks[]]"), []);
			});
			h.inView(wiki, "player:Anna", function() {
				assert.ok(f("[questnames[]]").indexOf("Schatten") !== -1);
				assert.deepEqual(f("[[Spur]queststatus[]]"), ["open"]);
			});
		});
	});

	test("a quest tagged Secret hides its markers: in the event, the hub and the links", function() {
		withTiddlers([{title: "Verdeckt", tags: "Quest Secret", text: "Geheimplan."},
			{title: "Verdeckte Fahrt", tags: "Event", date: "1352", text: "<<date>>\n\nOffen.\n\n<<quest \"Verdeckt\">><<quest \"Spur\">>Verdeckter Absatz."}], function() {
			assert.match(body("Verdeckte Fahrt"), /Verdeckter Absatz/);
			h.inView(wiki, "public", function() {
				assert.ok(body("Verdeckte Fahrt").indexOf("Verdeckter Absatz") === -1);
				assert.ok(f("[questnames[]]").indexOf("Verdeckt") === -1);
				assert.ok(f("[[Spur]questlinks[]]").indexOf("Verdeckt") === -1);
				assert.ok(plain("{{Quest}}").indexOf("Verdeckt") === -1);
			});
		});
	});
});

test.describe("relations: open quests around what they mention, switches by kind", function() {
	var EGO = "<$graph.view $tiddler=\"$:/plugins/tiddlyrpg-core/graph/ego\"/>",
		STATE = "$:/state/tiddlyrpg-core/relations-filter/Baile";

	function ego(node) {
		return h.graph(wiki, EGO, {currentNode: node});
	}

	function edges(graph) {
		return Object.keys(graph.edges).map(function(id) { return graph.edges[id].from + " -> " + graph.edges[id].to; }).sort();
	}

	test("what a quest mentions; the open ones about a tiddler, a complete one not", function() {
		assert.deepEqual(f("[[Spur]questmentions[]]"), ["Baile"]);
		assert.deepEqual(f("[[Baile]questsabout[]]"), ["Echo", "Spur"]);
		assert.deepEqual(f("[[Baile]] [[Echo]] [[Turm]] [[Questfahrt]] :map[relationkind[]]"), ["location", "quest", "quest", "other"]);
	});

	test("the ego graph: a node per open quest, edges to what it mentions and to the quests linked", function() {
		var graph = ego("Baile");
		assert.ok(graph.nodes.Spur && graph.nodes.Echo && !graph.nodes.Turm, Object.keys(graph.nodes).join());
		assert.equal(graph.nodes.Spur.color, "#9aa1aa");
		var all = edges(graph);
		assert.ok(all.indexOf("Spur -> Baile") !== -1 && all.indexOf("Echo -> Baile") !== -1 && all.indexOf("Echo -> Spur") !== -1, all.join());
	});

	test("switches: one per kind there, all on; off leaves out the nodes and entries of it, never the centre", function() {
		var view = h.view(wiki, "Baile");
		assert.match(view, /<button[^>]*class="trpg-kind-switch trpg-kind-quest trpg-kind-split"[^>]*>Quests und Gerüchte<\/button>/);
		assert.match(h.render(wiki, "text/plain", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/viewtemplates/relations/list\"/>", {currentTiddler: "Baile", self: "Baile"}), /Quests\s*Echo\s*Spur/);
		withTiddlers([{title: STATE, list: "quest location"}], function() {
			var graph = ego("Baile");
			assert.ok(graph.nodes.Baile && !graph.nodes.Spur && !graph.nodes.Echo, Object.keys(graph.nodes).join());
			assert.match(h.view(wiki, "Baile"), /class="trpg-kind-switch trpg-kind-quest trpg-kind-split trpg-off"[^>]*>Quests/);
			assert.doesNotMatch(h.render(wiki, "text/plain", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/viewtemplates/relations/list\"/>", {currentTiddler: "Baile", self: "Baile"}), /Quests/);
		});
	});

	test("views: a marker in a locked section mentions nothing for a view that does not see it", function() {
		withTiddlers([{title: "Verdeckte Spur", tags: "Event", date: "1352", text: "<<date>>\n\nOffen.\n\n<<secret \"Frigg\">><<date>>\n\n<<quest \"Verdeckter Faden\">>Bei [[Baile]]."}], function() {
			assert.ok(f("[[Baile]questsabout[]]").indexOf("Verdeckter Faden") !== -1);
			assert.ok(ego("Baile").nodes["Verdeckter Faden"]);
			h.inView(wiki, "public", function() {
				assert.ok(f("[[Baile]questsabout[]]").indexOf("Verdeckter Faden") === -1);
				assert.ok(!ego("Baile").nodes["Verdeckter Faden"]);
				assert.ok(h.view(wiki, "Baile").indexOf("Verdeckter Faden") === -1);
			});
		});
	});
});

test.describe("renaming", function() {
	test("Relink rewrites short and block forms, nested markers too", function() {
		withTiddlers([{title: "Umzug", tags: "Event", date: "1352",
			text: "<<date>>\n\n<<quest \"Alt\">>Kurz.\n\n<$quest name=\"Alt\">\n\nBlock\n\n</$quest>\n\n<<quest \"Turm\">><<quest \"Alt\" status:\"complete\">>Beide."}], function() {
			wiki.relinkTiddler("Alt", "Neu");
			var text = wiki.getTiddler("Umzug").fields.text;
			assert.equal(text.indexOf("Alt"), -1, text);
			assert.match(text, /<<quest "Neu">>Kurz\./);
			assert.match(text, /<\$quest name="Neu">\n\nBlock/);
			assert.match(text, /<<quest "Neu" status:"complete">>/);
		});
	});
});
