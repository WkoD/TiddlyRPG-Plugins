/*
 * Sections of a body (modules/sections.js, widgets/sections.js): short and block forms, their
 * numbering, nesting and the hints on them; locks in the text (<<secret>>, <$secret>) and what
 * they hide - the body, dated sections in timeline, table, span and pills, spots on the map,
 * search, backlinks.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki, sections, dates;

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		sections = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/sections.js");
		dates = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/dates.js");
		h.setLanguage(wiki, "de-DE");
		// Anna plays Frigg (fixture), Jan plays Ragna, Max plays Odo
		h.add(wiki, {title: "Ragna", tags: "Player", player: "Jan"});
		h.add(wiki, {title: "Odo", tags: "Player", player: "Max"});
		h.add(wiki, {title: "Mischung", tags: "Event", date: "1351-01-01, 1351-02-01, 1351-03-01",
			text: "<<date>>\n\nErster.\n\n<$date label=\"Block\">\n\nZweiter.\n\n</$date>\n\n<<date>>\n\nDritter."});
		h.add(wiki, {title: "Nacht", tags: "Event", date: "1351-07-01, 1351-07-05, 1351-07-09",
			text: "<<date>>\n\nOffen in [[Baile]].\n\n<<secret \"Frigg\">><<date label:\"Traum\">> Geheim in [[Nowhere]] mit Wortgeheimnis.\n\n<<date>>\n\nWieder offen. <$secret>Nur DM in [[Insel Avalon]].</$secret> Danach offen."});
		h.add(wiki, {title: "Hafen", tags: "Location", text: "Ein Hafen.\n\n<<spot \"Kai\">>\n\nAm Wasser.\n\n<<secret \"Frigg\" \"Ragna\">><<spot \"Versteck\">>\n\nVerborgen.\n\n<<spot \"Markt\">>\n\nLaut. <$secret for=\"Odo\">Odos Stand.</$secret>"});
	});
});

function f(text, variables) {
	return Array.from(h.filter(wiki, text, variables));
}

// The texts of the messages on the sections of a tiddler (checks/sections.js)
function sectionTexts(title) {
	return h.checks(wiki, title, "sections").map(function(message) { return message.text; });
}

// The numbers of the dated sections of a tiddler (Array.from: arrays of the realm of the wiki)
function numbers(title) {
	return Array.from(dates.sections(wiki, title).placeholders, function(p) { return p.number; });
}

function inView(view, fn) {
	return h.inView(wiki, view, fn);
}

function body(title) {
	return h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/templates/body-sections\" $mode=\"block\"/>", {currentTiddler: title});
}

function withTiddler(fields, fn) {
	h.add(wiki, fields);
	try {
		return fn();
	} finally {
		wiki.deleteTiddler(fields.title);
	}
}

test.describe("forms and numbers", function() {
	test("dates count on over both forms", function() {
		assert.deepEqual(numbers("Mischung"), [1, 2, 3]);
	});

	test("a block draws the same heading, with its caption and jump mark", function() {
		var html = body("Mischung");
		assert.match(html, /data-trpg-anchor="date-2">1\. Hammer 1351 DR|data-trpg-anchor="date-2">[^<]*1351 DR<span class="trpg-date-label"> – Block/);
		assert.ok(html.indexOf("Erster.") < html.indexOf("Zweiter.") && html.indexOf("Zweiter.") < html.indexOf("Dritter."), html);
		assert.equal((html.match(/class="trpg-section trpg-section-date/g) || []).length, 3);
	});

	test("a date in a date does not count", function() {
		withTiddler({title: "Doppelt", tags: "Event", date: "1351, 1352", text: "<$date>\n\nA <$date>B</$date>\n\n</$date>\n\n<<date>>\n\nC"}, function() {
			assert.deepEqual(numbers("Doppelt"), [1, 2]);
			assert.ok(sectionTexts("Doppelt").some(function(t) { return /Datumsabschnitte ineinander/.test(t); }));
		});
	});

	test("a date only in an event, a spot only in a location", function() {
		withTiddler({title: "Falsch", tags: "Location", text: "<<date>>\n\nText."}, function() {
			assert.deepEqual(numbers("Falsch"), []);
			assert.ok(sectionTexts("Falsch").some(function(t) { return /<<date>> zählt nur in einem Tiddler mit Tag Ereignis/.test(t); }));
		});
		withTiddler({title: "Falsch2", tags: "Event", text: "<<spot \"Hier\">>"}, function() {
			assert.deepEqual(f("[[Falsch2]spots[]]"), []);
			assert.ok(sectionTexts("Falsch2").some(function(t) { return /Tag Ort/.test(t); }));
		});
	});

	test("a caption only as label: - a text by position is no caption but a hint, not for a locked section", function() {
		withTiddler({title: "Alte Form", tags: "Event", date: "1351, 1352", text: "<<date \"Aufbruch\">>\n\nA.\n\n<<secret>><<date 2 \"Geheimnis\">>\n\nB."}, function() {
			assert.deepEqual(numbers("Alte Form"), [1, 2]);
			assert.ok(body("Alte Form").indexOf("Aufbruch") === -1);
			assert.ok(sectionTexts("Alte Form").some(function(t) { return /<<date "Aufbruch">> - der erste Parameter ist die Nummer eines Abschnitts, eine Überschrift steht in label:"Aufbruch"/.test(t); }));
			assert.ok(inView("public", function() { return sectionTexts("Alte Form"); }).every(function(t) { return t.indexOf("Geheimnis") === -1; }));
			assert.ok(sectionTexts("Alte Form").some(function(t) { return t.indexOf("Geheimnis") !== -1; }));
		});
	});

	test("a short form inside an HTML block does not count", function() {
		withTiddler({title: "Kasten", tags: "Event", date: "1351", text: "<div>\n\n<<date>>\n\nText\n\n</div>"}, function() {
			assert.deepEqual(numbers("Kasten"), []);
			assert.ok(sectionTexts("Kasten").some(function(t) { return /Kurzform <<date>>/.test(t); }));
		});
	});

	test("kinds of their own nest with dates both ways", function() {
		sections.register("probe", {types: null, params: function() { return {}; }});
		withTiddler({title: "Verschachtelt", tags: "Event", date: "1351, 1352, 1353",
			text: "<$probe>\n\n<$date>A</$date>\n\n<$date>B</$date>\n\n</$probe>\n\n<$date>\n\n<$probe>C</$probe>\n\n</$date>"}, function() {
			var model = sections.read(wiki, "Verschachtelt");
			assert.deepEqual(Array.from(model.records, function(r) { return r.kind + (r.parent === -1 ? "" : "<" + model.records[r.parent].kind); }),
				["probe", "date<probe", "date<probe", "date", "probe<date"]);
			assert.deepEqual(numbers("Verschachtelt"), [1, 2, 3]);
			assert.equal(model.errors.length, 0);
		});
	});
});

test.describe("rules macros in sections", function() {
	test("in short and block sections, behind <<secret>>: rendered, no marker", function() {
		withTiddler({title: "Regeltext", tags: "Event", date: "1351, 1352, 1353",
			text: "<<date>>\n\nWeit <<unit \"30 ft\">>.\n\n<$date>\n\n<<damage \"1d8 cold\">>\n\n</$date>\n\n<<secret>><<date>>\n\n<<term wis save>>"}, function() {
			assert.deepEqual(numbers("Regeltext"), [1, 2, 3]);
			var dm = body("Regeltext");
			assert.ok(dm.indexOf("Weit 9 m.") !== -1, dm);
			assert.ok(dm.indexOf("1W8 Kälteschaden") !== -1, dm);
			assert.ok(dm.indexOf("WEI-Rettungswurf") !== -1, dm);
			var pub = inView("public", function() { return body("Regeltext"); });
			assert.ok(pub.indexOf("Weit 9 m.") !== -1 && pub.indexOf("WEI-Rettungswurf") === -1, pub);
		});
	});

	test("in a spot of a location: in the text of the spot, the spot stays one", function() {
		withTiddler({title: "Regelort", tags: "Location", text: "Ort.\n\n<<spot \"Turm\">>\n\nHoch, <<unit \"60 ft\">>."}, function() {
			var spot = h.render(wiki, "text/plain", "<$trpg-body $tiddler=\"Regelort\" $mode=\"block\" $only=\"spot\" $name=\"Turm\" $marker=\"no\"/>");
			assert.match(spot, /Hoch, 18 m\./);
			assert.deepEqual(f("[[Regelort]spots[]]"), ["Turm"]);
		});
	});
});

test.describe("locks in the text", function() {
	test("<<secret>><<date>>: the whole section, only for its players and the DM", function() {
		var pub = inView("public", function() { return body("Nacht"); });
		assert.ok(pub.indexOf("Offen in") !== -1 && pub.indexOf("Geheim in") === -1 && pub.indexOf("Traum") === -1, pub);
		assert.ok(inView("player:Anna", function() { return body("Nacht"); }).indexOf("Geheim in") !== -1);
		var dm = body("Nacht");
		assert.match(dm, /<div class="trpg-section-lock trpg-section-locked"><div class="trpg-secret-marker">.*Geheim: Frigg<\/div><div class="trpg-section trpg-section-date">.*Geheim in/s);
		assert.doesNotMatch(pub, /trpg-section-lock/);
	});

	test("<$secret> in the text: only the block, the text around stays", function() {
		var pub = inView("player:Anna", function() { return body("Nacht"); });
		assert.ok(pub.indexOf("Wieder offen.") !== -1 && pub.indexOf("Danach offen.") !== -1 && pub.indexOf("Nur DM") === -1, pub);
		assert.match(body("Nacht"), /Geheim: nur DM.*Nur DM/s);
	});

	test("several characters: each of their players", function() {
		var map = function(view) { return inView(view, function() { return f("[[Hafen]spots[]]"); }); };
		assert.deepEqual(map("public"), ["Kai", "Markt"]);
		assert.deepEqual(map("player:Anna"), ["Kai", "Versteck", "Markt"]);
		assert.deepEqual(map("player:Jan"), ["Kai", "Versteck", "Markt"]);
		assert.deepEqual(map("player:Max"), ["Kai", "Markt"]);
	});

	test("a locked spot: not on the map, its text not below it", function() {
		var tab = "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/viewtemplates/location\" mode=\"block\"/>",
			pub = inView("public", function() { return h.render(wiki, "text/html", tab, {currentTiddler: "Hafen"}); });
		assert.ok(pub.indexOf("Am Wasser.") !== -1 && pub.indexOf("Verborgen.") === -1 && pub.indexOf("Odos Stand") === -1, pub);
		assert.ok(inView("player:Max", function() { return h.render(wiki, "text/html", tab, {currentTiddler: "Hafen"}); }).indexOf("Odos Stand") !== -1);
	});

	test("a spot joined to a secret tiddler is locked as well", function() {
		withTiddler({title: "Bunker", tags: "Location Secret"}, function() {
			withTiddler({title: "Insel", tags: "Location", text: "<<spot \"Bunker\">>\n\nTief."}, function() {
				assert.deepEqual(inView("public", function() { return f("[[Insel]spots[]]"); }), []);
				assert.deepEqual(f("[[Insel]spots[]]"), ["Bunker"]);
			});
		});
	});

	test("<<secret>> at the very start: the text before the first marker", function() {
		withTiddler({title: "Vorrede", tags: "Event", date: "1351", text: "<<secret>>\n\nGeheime Vorrede.\n\n<<date>>\n\nOffen."}, function() {
			var pub = inView("public", function() { return body("Vorrede"); });
			assert.ok(pub.indexOf("Geheime Vorrede") === -1 && pub.indexOf("Offen.") !== -1, pub);
		});
	});

	test("<<secret>> directly after the marker locks that section", function() {
		withTiddler({title: "Danach", tags: "Event", date: "1351, 1352", text: "<<date>>\n\nA.\n\n<<date>>\n<<secret>>\n\nB."}, function() {
			var pub = inView("public", function() { return body("Danach"); });
			assert.ok(pub.indexOf("A.") !== -1 && pub.indexOf("B.") === -1, pub);
		});
	});

	test("<<secret>> before a block", function() {
		withTiddler({title: "Vorblock", tags: "Location", text: "Ort.\n\n<<secret>>\n<$spot name=\"Gruft\">\n\nDunkel.\n\n</$spot>"}, function() {
			assert.deepEqual(inView("public", function() { return f("[[Vorblock]spots[]]"); }), []);
			assert.deepEqual(f("[[Vorblock]spots[]]"), ["Gruft"]);
		});
	});

	test("<<secret>> in the middle of a section: a hint, no effect", function() {
		withTiddler({title: "Mitte", tags: "Event", date: "1351", text: "<<date>>\n\nVorher. <<secret>> Nachher."}, function() {
			var pub = inView("public", function() { return body("Mitte"); });
			assert.ok(pub.indexOf("Vorher.") !== -1 && pub.indexOf("Nachher.") !== -1, pub);
			assert.ok(sectionTexts("Mitte").some(function(t) { return /mitten in einem Abschnitt/.test(t); }));
		});
	});

	test("a name that is no player character: a hint, the lock stays for the DM", function() {
		withTiddler({title: "Tippfehler", tags: "Event", date: "1351", text: "<<secret \"Frgg\">><<date>>\n\nVerborgen."}, function() {
			assert.ok(sectionTexts("Tippfehler").some(function(t) { return /„Frgg“/.test(t); }));
			assert.ok(inView("player:Anna", function() { return body("Tippfehler"); }).indexOf("Verborgen.") === -1);
			assert.ok(body("Tippfehler").indexOf("Verborgen.") !== -1);
		});
	});
});

test.describe("what a locked section does not give away", function() {
	test("timeline and table without the section", function() {
		var rows = inView("public", function() { return f("[[Nacht]] +[eventrows[]]").join(""); });
		assert.doesNotMatch(rows, /Traum/);
		assert.equal((rows.match(/<tr/g) || []).length, 2);
		assert.match(f("[[Nacht]] +[eventrows[]]").join(""), /Traum/);
		var tl = "<$trpg-timeline filter=\"[[Nacht]]\"/>";
		assert.doesNotMatch(inView("public", function() { return h.render(wiki, "text/html", tl); }), /Traum/);
		assert.match(h.render(wiki, "text/html", tl), /Traum/);
	});

	test("span of the event without the section", function() {
		withTiddler({title: "Spanne", tags: "Event", date: "1351-07-01, 1351-08-01", text: "<<date>>\n\nA.\n\n<<secret>><<date>>\n\nB."}, function() {
			assert.deepEqual(inView("public", function() { return f("[[Spanne]visibledate[]]"); }), ["1351-07-01"]);
			assert.deepEqual(f("[[Spanne]visibledate[]]"), ["1351-07-01, 1351-08-01"]);
		});
	});

	test("location pills of a section and the jump to a section", function() {
		assert.deepEqual(inView("public", function() { return f("[[Nacht]sectionlinks[2]]"); }), []);
		assert.deepEqual(f("[[Nacht]sectionlinks[2]]"), ["Nowhere"]);
		assert.deepEqual(inView("public", function() { return f("[[Nacht]sectionlinks[3]]"); }), []);
		assert.deepEqual(f("[[Nacht]sectionlinks[3]]"), ["Insel Avalon"]);
		assert.deepEqual(inView("public", function() { return f("[[Nacht]datesection[1351-07-05]]"); }), []);
		assert.deepEqual(f("[[Nacht]datesection[1351-07-05]]"), ["2"]);
	});

	test("search: a word only in a locked section", function() {
		assert.deepEqual(inView("public", function() { return f("[[Nacht]] +[trpgsearch[Wortgeheimnis]]"); }), []);
		assert.deepEqual(f("[[Nacht]] +[trpgsearch[Wortgeheimnis]]"), ["Nacht"]);
		assert.deepEqual(inView("public", function() { return f("[[Nacht]] +[trpgsearch[wieder offen]]"); }), ["Nacht"]);
	});

	test("links: none that stand only in a locked section", function() {
		assert.deepEqual(inView("public", function() { return f("[[Nacht]visiblelinks[]]"); }), ["Baile"]);
		assert.deepEqual(inView("player:Anna", function() { return f("[[Nacht]visiblelinks[]]"); }), ["Baile", "Nowhere"]);
		assert.deepEqual(f("[[Nacht]visiblelinks[]]").sort(), ["Baile", "Insel Avalon", "Nowhere"]);
	});

	test("graph: the edge type links draws no edge from a locked section", function() {
		h.add(wiki, {title: "$:/graph/LinksTest", type: "application/json", text: "{}",
			template: "$:/plugins/tiddlyrpg-core/graph/templates/trpg-graph", filter: "[[Nacht]] [[Baile]] [[Nowhere]]",
			"edges.fields": "", "edges.functions": "links"});
		try {
			var view = "<$graph.view $tiddler=\"$:/graph/LinksTest\"/>",
				targets = function(graph) { return graph.edges.filter(function(e) { return e.from === "Nacht"; }).map(function(e) { return e.to; }).sort(); };
			assert.deepEqual(inView("public", function() { return targets(h.graph(wiki, view)); }), ["Baile"]);
			assert.deepEqual(targets(h.graph(wiki, view)), ["Baile", "Nowhere"]);
		} finally {
			wiki.deleteTiddler("$:/graph/LinksTest");
		}
	});

	test("backlinks: a link only in a locked section", function() {
		assert.ok(inView("public", function() { return f("[[Nowhere]sectionbacklinks[]]"); }).indexOf("Nacht") === -1);
		assert.ok(f("[[Nowhere]sectionbacklinks[]]").indexOf("Nacht") !== -1);
		assert.ok(inView("public", function() { return f("[[Baile]sectionbacklinks[]]"); }).indexOf("Nacht") !== -1);
	});
});
