/*
 * Event head and dated sections of a body: the head (span of the date field, locations before
 * the first <<date>>), the placeholder <<date>> (counting, explicit number, caption, rule, hint
 * without a position, not counted in code), locations per section (DM notes skipped, player
 * lock), the hint on dates that cannot be read, the subtitle without the modifier, the event
 * table, and the jump marks of the sections with the wrapper trpg-jump.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki, dates;

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		dates = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/dates.js");
		h.setLanguage(wiki, "de-DE");
		h.add(wiki, {title: "Schild", tags: "Event Frigg", date: "1351-07-05, 1351-07-09, 1351-07-22/1351-07-24",
			text: "<<date label:\"Banbanzas Bitte\">>\n\nIn [[Baile]].\n\n<<date>>\n\nAuf [[Insel Avalon]] und [[Hideout]].\n\n```\n<<date>>\n```\n\n<<date label:\"Das Ritual\">>\n\nNach [[Baile]].\n\n@@.tc-tiddler-frame\n[[Nowhere]]\n@@\n"});
		h.add(wiki, {title: "Vinland", tags: "Event", date: "1351-08-15, 1351-11-12/..",
			text: "Zuerst [[Nowhere]].\n\n<<date 2>>\n\nDann [[Insel Avalon]]."});
	});
});

// The body of an event as HTML, as the story shows it
function body(title) {
	return h.render(wiki, "text/html", "<$transclude $tiddler=\"" + title + "\" $mode=\"block\"/>", {currentTiddler: title});
}

function headings(html) {
	return (html.match(/<div class="trpg-date-heading"[^>]*>.*?<\/div>/g) || []).map(function(s) { return s.replace(/<[^>]+>/g, ""); });
}

test("sections from the parse tree: counting, captions, code not counted", function() {
	var info = dates.sections(wiki, "Schild");
	assert.equal(info.placeholders.map(function(p) { return p.number; }).join(), "1,2,3");
	assert.equal(info.labels[1] + "|" + info.labels[3], "Banbanzas Bitte|Das Ritual");
	assert.ok(info.placeholders[0].first && !info.placeholders[1].first);
});

test("explicit number, the following ones count on", function() {
	var info = dates.sections(wiki, "Vinland");
	assert.equal(info.placeholders.map(function(p) { return p.number + (p.explicit ? "!" : ""); }).join(), "2!");
});

test("headings of the sections with era and caption", function() {
	assert.equal(headings(body("Schild")).join(" | "), "5. Flamerule 1351 DR – Banbanzas Bitte | 9. Flamerule 1351 DR | 22. – 24. Flamerule 1351 DR – Das Ritual");
});

test("rule before every section but one at the very start", function() {
	assert.equal((body("Schild").match(/trpg-date-rule/g) || []).length, 2);
	assert.equal((body("Vinland").match(/trpg-date-rule/g) || []).length, 1);
});

test("no paragraph around a section heading", function() {
	// The outer <p> comes from rendering the transclusion inline in the test
	var html = body("Schild").replace(/^<p>/, "");
	assert.doesNotMatch(html, /<p>(<hr class="trpg-date-rule">)?<div class="trpg-date-heading"/);
});

test.describe("a caption is inline wikitext", function() {
	var feet;

	test.before(function() {
		feet = h.filter(wiki, "[[30 ft]trpgunit[]]").join();
		h.add(wiki, {title: "Brücke", tags: "Event", date: "1351-07-05, 1351-07-09, 1351-07-11, 1351-07-12",
			text: "<<date label:\"Kampf auf <<unit '30 ft'>>\">>\n\nZuerst.\n\n<<date label:\"Treffen in [[Alt Ort]]\">>\n\nDann.\n\n<<date 3 label:\"Preis $5$ bei [[Alt Ort]]\">>\n\nLetzt.\n\n<$date section=\"4\" label=\"Rückkehr nach [[Alt Ort]]\">\n\nZuletzt.\n\n</$date>\n"});
		h.add(wiki, {title: "Alt Ort", tags: "Location"});
	});

	test.after(function() {
		wiki.deleteTiddler("Brücke");
		wiki.deleteTiddler("Alt Ort");
		wiki.deleteTiddler("Neuer Ort");
	});

	test("a macro in the caption shows its result in the display language", function() {
		assert.notEqual(feet, "30 ft");
		assert.equal(headings(body("Brücke"))[0], "5. Flamerule 1351 DR – Kampf auf " + feet);
	});

	test("a link in the caption is a link, $5$ stays as written", function() {
		var html = body("Brücke");
		assert.match(html, /class="trpg-date-label"> – Treffen in <a[^>]*>Alt Ort<\/a><\/span>/);
		assert.equal(headings(html)[2], "11. Flamerule 1351 DR – Preis $5$ bei Alt Ort");
	});

	test("a link in the caption is not promoted: no backlink, no location of the section", function() {
		assert.equal(h.filter(wiki, "[[Alt Ort]backlinks[]]").indexOf("Brücke"), -1);
		assert.equal(h.filter(wiki, "[[Brücke]sectionlinks[2]]").join(), "");
	});

	test("event table: the caption with its macro", function() {
		var table = h.render(wiki, "text/html", "<$let trpg-events=\"[[Brücke]]\">{{||$:/plugins/tiddlyrpg-core/viewtemplates/event-list/list}}</$let>");
		assert.ok(table.indexOf("Brücke</a> – Kampf auf " + feet) !== -1, table);
	});

	test("relink: a renamed title in a caption, alone or after the number, and in <$date label>", function() {
		wiki.renameTiddler("Alt Ort", "Neuer Ort");
		var text = wiki.getTiddler("Brücke").fields.text;
		assert.match(text, /<<date label:"Treffen in \[\[Neuer Ort\]\]">>/);
		assert.match(text, /<<date 3 label:"Preis \$5\$ bei \[\[Neuer Ort\]\]">>/);
		assert.match(text, /<\$date section="4" label="Rückkehr nach \[\[Neuer Ort\]\]">/);
		assert.doesNotMatch(text, /Alt Ort/);
	});
});

test("locations per section; DM notes skipped", function() {
	assert.equal(h.filter(wiki, "[[Schild]sectionlinks[1]]").join(), "Baile");
	assert.equal(h.filter(wiki, "[[Schild]sectionlinks[3]]").join(), "Baile");
	assert.equal(h.filter(wiki, "[[Vinland]sectionlinks[0]]").join(), "Nowhere");
	assert.equal(h.filter(wiki, "[[Vinland]sectionlinks[2]]").join(), "Insel Avalon");
});

test("locked locations are left out of the pills", function() {
	var html = h.inView(wiki, "public", function() { return body("Schild"); });
	assert.ok(html.indexOf('data-tag-title="Insel Avalon"') !== -1 && html.indexOf('data-tag-title="Hideout"') === -1);
});

test("... but shown to their player and the DM", function() {
	assert.ok(h.inView(wiki, "player:Anna", function() { return body("Schild"); }).indexOf('data-tag-title="Hideout"') !== -1);
	assert.ok(body("Schild").indexOf('data-tag-title="Hideout"') !== -1);
});

test("head: span of the field and the locations before the first placeholder", function() {
	var view = h.view(wiki, "Vinland");
	assert.match(view, /<div class="trpg-dateline">15\. Eleasis 1351 DR – \?\?\?\?<\/div>/);
	assert.match(view, /trpg-event-head.*data-tag-title="Nowhere".*<\/div>\s*<hr class="trpg-event-rule">/s);
});

test("head without the former labels", function() {
	var view = h.view(wiki, "Schild");
	assert.ok(view.indexOf("Jahr:") === -1 && view.indexOf("Ort:") === -1);
	assert.match(view, /<div class="trpg-dateline">5\. – 24\. Flamerule 1351 DR<\/div>/);
});

test("hint without a position, explicit number works anywhere", function() {
	h.add(wiki, {title: "Snippet", text: "<<date>>"});
	h.add(wiki, {title: "Snippet3", text: "<<date 3>>"});
	try {
		var hint = h.render(wiki, "text/plain", "<$transclude $tiddler=\"Snippet\" $mode=\"block\"/>", {currentTiddler: "Schild"}),
			explicit = h.render(wiki, "text/plain", "<$transclude $tiddler=\"Snippet3\" $mode=\"block\"/>", {currentTiddler: "Schild"});
		assert.ok(hint.indexOf("Abschnitt unbekannt") !== -1, hint);
		assert.ok(explicit.indexOf("22. – 24. Flamerule 1351 DR") !== -1, explicit);
	} finally {
		wiki.deleteTiddler("Snippet");
		wiki.deleteTiddler("Snippet3");
	}
});

test("a section missing in the date field", function() {
	h.add(wiki, {title: "Kurz", tags: "Event", date: "1351", text: "<<date 2>>"});
	try {
		assert.ok(body("Kurz").indexOf("Abschnitt 2 fehlt") !== -1);
	} finally {
		wiki.deleteTiddler("Kurz");
	}
});

test("edit preview: the draft finds its placeholders", function() {
	h.add(wiki, {title: "Draft of 'Schild'", "draft.of": "Schild", "draft.title": "Schild", tags: "Event Frigg",
		date: "1351-07-05, 1351-07-09, 1351-07-22/1351-07-24", text: wiki.getTiddler("Schild").fields.text});
	try {
		assert.equal(headings(body("Draft of 'Schild'")).length, 3);
	} finally {
		wiki.deleteTiddler("Draft of 'Schild'");
	}
});

test("hint on a date that cannot be read, not in the read-only copy", function() {
	h.add(wiki, {title: "Falsch", tags: "Person", date: "1351-07-41", text: ""});
	try {
		assert.ok(h.view(wiki, "Falsch").indexOf("Datum prüfen") !== -1);
		h.add(wiki, {title: "$:/status/IsReadOnly", text: "yes"});
		assert.ok(h.view(wiki, "Falsch").indexOf("Datum prüfen") === -1);
	} finally {
		wiki.deleteTiddler("Falsch");
		wiki.deleteTiddler("$:/status/IsReadOnly");
	}
});

test("subtitle without the modifier", function() {
	h.add(wiki, {title: "Mit Autor", modifier: "Christopher", modified: "20261001000000000", text: "x"});
	try {
		var view = h.view(wiki, "Mit Autor");
		assert.ok(view.indexOf("Christopher") === -1, view);
		assert.match(view, /class="tc-subtitle[^"]*">[^<]*2026/);
	} finally {
		wiki.deleteTiddler("Mit Autor");
	}
});

test("refresh after a language change", function() {
	var parser = wiki.parseText("text/vnd.tiddlywiki", "\\import [subfilter{$:/core/config/GlobalImportFilter}]\n<$transclude $tiddler=\"Schild\" $mode=\"block\"/>"),
		widget = wiki.makeWidget(parser, {document: $tw.fakeDocument, variables: {currentTiddler: "Schild"}}),
		container = $tw.fakeDocument.createElement("div");
	widget.render(container, null);
	try {
		h.setLanguage(wiki, "en-GB");
		widget.refresh({"$:/language": {modified: true}});
		assert.ok(container.textContent.indexOf("22 – 24 Flamerule 1351 DR") !== -1, container.textContent);
	} finally {
		h.setLanguage(wiki, "de-DE");
	}
});

test("event table: a span is a start and an end row in one title cell, with caption and flags", function() {
	var table = h.render(wiki, "text/html", "<$let trpg-events=\"[[Schild]] [[Vinland]]\">{{||$:/plugins/tiddlyrpg-core/viewtemplates/event-list/list}}</$let>");
	assert.doesNotMatch(table, /bis /);
	assert.match(table, /<td rowspan="2"><u><a[^>]*>Schild<\/a><\/u> – Das Ritual <em>\(Ende\)<\/em><\/td>/);
	assert.match(table, /Schild<\/a><\/u> – Banbanzas Bitte <em>\(Start\)<\/em>/);
	assert.equal((table.match(/>Schild</g) || []).length, 3);
	// Points and an open span of one event read as one cell over both rows
	assert.match(table, /<td rowspan="2"><a[^>]*>Vinland<\/a> <em>\(Start\)<\/em><\/td>/);
	// Newest first
	assert.ok(table.indexOf("Vinland") < table.indexOf("Schild"));
});

test("date line below the tags: span of an event, years of the other types", function() {
	var event = h.view(wiki, "Schild");
	assert.ok(event.indexOf("tc-tags-wrapper") < event.indexOf("trpg-dateline"));
	assert.doesNotMatch(event, /trpg-dateline[^>]*>[^<]*<\/div><h2/);
	assert.match(h.view(wiki, "Grum"), /<div class="trpg-dateline">\?\?\?\? – 1350 DR<\/div>/);
});

test("<<date>> without any date in the field: ???? with the era", function() {
	h.add(wiki, {title: "Eiszeit", tags: "Event", text: "<<date>>\n\nKalt."});
	try {
		assert.equal(headings(body("Eiszeit")).join(), "???? DR");
	} finally {
		wiki.deleteTiddler("Eiszeit");
	}
});

test("no date line for an event locked for the player", function() {
	h.add(wiki, {title: "Geheim", tags: "Event Ragna Secret", date: "1351"});
	h.add(wiki, {title: "Ragna", tags: "Player", player: "Jan"});
	try {
		assert.doesNotMatch(h.inView(wiki, "player:Anna", function() { return h.view(wiki, "Geheim"); }), /trpg-dateline/);
		assert.match(h.inView(wiki, "player:Jan", function() { return h.view(wiki, "Geheim"); }), /trpg-dateline/);
	} finally {
		["Geheim", "Ragna"].forEach(function(title) { wiki.deleteTiddler(title); });
	}
});

test("date line of an event without date: ???? with the era", function() {
	h.add(wiki, {title: "Ohne Datum", tags: "Event", text: "<<date>>"});
	try {
		assert.match(h.view(wiki, "Ohne Datum"), /<div class="trpg-dateline">\?\?\?\? DR<\/div>/);
		assert.doesNotMatch(h.view(wiki, "Frigg"), /trpg-dateline/);
	} finally {
		wiki.deleteTiddler("Ohne Datum");
	}
});

test("event table: consecutive rows of one event share a title cell", function() {
	h.add(wiki, {title: "Orden", tags: "Event", date: "700, 849"});
	h.add(wiki, {title: "Dazwischen", tags: "Event", date: "800"});
	try {
		var alone = h.render(wiki, "text/html", "<$let trpg-events=\"[[Orden]]\">{{||$:/plugins/tiddlyrpg-core/viewtemplates/event-list/list}}</$let>");
		assert.match(alone, /<td rowspan="2"><a[^>]*>Orden<\/a><\/td>/);
		assert.equal((alone.match(/>Orden</g) || []).length, 1);
		var split = h.render(wiki, "text/html", "<$let trpg-events=\"[[Orden]] [[Dazwischen]]\">{{||$:/plugins/tiddlyrpg-core/viewtemplates/event-list/list}}</$let>");
		assert.match(split, /Orden<\/a> <em>\(Ende\)<\/em>/);
		assert.match(split, /Orden<\/a> <em>\(Start\)<\/em>/);
	} finally {
		wiki.deleteTiddler("Orden");
		wiki.deleteTiddler("Dazwischen");
	}
});

test("event table: a span alone reads across both years without a flag", function() {
	h.add(wiki, {title: "Spanne", tags: "Event", date: "700/849"});
	try {
		var table = h.render(wiki, "text/html", "<$let trpg-events=\"[[Spanne]]\">{{||$:/plugins/tiddlyrpg-core/viewtemplates/event-list/list}}</$let>");
		assert.match(table, /<td rowspan="2"><a[^>]*>Spanne<\/a><\/td>/);
		assert.ok(table.indexOf(">849<") < table.indexOf(">700<"));
	} finally {
		wiki.deleteTiddler("Spanne");
	}
});

test("event table: an event that goes on ends in continued", function() {
	h.add(wiki, {title: "Weiter", tags: "Event", date: "1351-07-01, 1351-07-11, .."});
	try {
		var table = h.render(wiki, "text/html", "<$let trpg-events=\"[[Weiter]]\">{{||$:/plugins/tiddlyrpg-core/viewtemplates/event-list/list}}</$let>");
		assert.match(table, /<td rowspan="2"><a[^>]*>Weiter<\/a> <em>\(Start\)<\/em><\/td>/);
	} finally {
		wiki.deleteTiddler("Weiter");
	}
});

test("jump marks: every section heading and the missing-section hint, not at the very start", function() {
	// Schild begins with section 1: the plain navigation shows it, a jump would hide the title
	assert.equal(body("Schild").match(/data-trpg-anchor="[^"]+"/g).join(), 'data-trpg-anchor="date-2",data-trpg-anchor="date-3"');
	assert.match(body("Vinland"), /<div class="trpg-date-heading" data-trpg-anchor="date-2">/);
	h.add(wiki, {title: "Kurz", tags: "Event", date: "1351", text: "Vorher.\n\n<<date 2>>"});
	try {
		assert.match(body("Kurz"), /<div class="trpg-date-invalid" data-trpg-anchor="date-2">Abschnitt 2 fehlt/);
	} finally {
		wiki.deleteTiddler("Kurz");
	}
});

test("event table: the title jumps to the earliest section of its cell", function() {
	var rows = h.filter(wiki, "[[Schild]] [[Vinland]] [[Sage]] +[eventrows[]]");
	function cell(title) {
		return rows.filter(function(row) { return row.indexOf("[[" + title + "]]") !== -1; }).map(function(row) {
			return /.*<td rowspan="\d+">(.*?)<\/td><\/tr>$/.exec(row)[1];
		}).join(" | ");
	}
	// One cell per caption, the span of section 3 over two rows
	assert.equal(cell("Schild"), [
		"<$trpg-jump anchor=\"date-3\">__[[Schild]]__</$trpg-jump> – Das Ritual //(Ende)//",
		"<$trpg-jump anchor=\"date-2\">__[[Schild]]__</$trpg-jump> //(Fortsetzung)//",
		"<$trpg-jump anchor=\"date-1\">__[[Schild]]__</$trpg-jump> – Banbanzas Bitte //(Start)//"
	].join(" | "));
	// Two sections without caption in one cell: the earliest one, also oldest first
	assert.equal(cell("Vinland"), "<$trpg-jump anchor=\"date-1\">[[Vinland]]</$trpg-jump> //(Start)//");
	assert.match(h.filter(wiki, "[[Vinland]] +[!eventrows[]]").join(""), /anchor="date-1">\[\[Vinland\]\]/);
	// Undated: the event as a whole
	assert.equal(cell("Sage"), "[[Sage]]");
});

test("trpg-jump: draws nothing of its own and passes the navigation on", function() {
	assert.equal(h.render(wiki, "text/html", "<$trpg-jump anchor=\"date-2\">[[Baile]]</$trpg-jump>"), h.render(wiki, "text/html", "[[Baile]]"));
	var parser = wiki.parseText("text/vnd.tiddlywiki", "<$trpg-jump anchor=\"date-2\">[[Baile]]</$trpg-jump>"),
		root = wiki.makeWidget(parser, {document: $tw.fakeDocument}),
		seen = [];
	root.render($tw.fakeDocument.createElement("div"), null);
	root.addEventListener("tm-navigate", function(event) {
		seen.push(event.navigateTo);
		return false;
	});
	var link = (function find(widget) {
		if(widget.parseTreeNode && widget.parseTreeNode.type === "link") {
			return widget;
		}
		for(var i = 0; i < widget.children.length; i++) {
			var found = find(widget.children[i]);
			if(found) {
				return found;
			}
		}
		return null;
	})(root);
	link.dispatchEvent({type: "tm-navigate", navigateTo: "Baile"});
	assert.equal(seen.join(), "Baile");
});
