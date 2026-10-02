/*
 * Event head and dated sections of a body: the head (span of the date field, locations before
 * the first <<date>>), the placeholder <<date>> (counting, explicit number, caption, rule, hint
 * without a position, not counted in code), locations per section (DM notes skipped, player
 * lock), the hint on dates that cannot be read, and the subtitle without the modifier.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki, dates;

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		dates = $tw.modules.execute("$:/plugins/dndwiki-core/modules/dates.js");
		h.setLanguage(wiki, "de-DE");
		h.add(wiki, {title: "Schild", tags: "Campaign Event", date: "1351-07-05, 1351-07-09, 1351-07-22/1351-07-24",
			text: "<<date \"Banbanzas Bitte\">>\n\nIn [[Baile]].\n\n<<date>>\n\nAuf [[Insel Avalon]] und [[Secret]].\n\n```\n<<date>>\n```\n\n<<date \"Das Ritual\">>\n\nNach [[Baile]].\n\n@@.tc-tiddler-frame\n[[Nowhere]]\n@@\n"});
		h.add(wiki, {title: "Vinland", tags: "Event", date: "1351-08-15, 1351-11-12/..",
			text: "Zuerst [[Nowhere]].\n\n<<date 2>>\n\nDann [[Insel Avalon]]."});
	});
});

// The body of an event as HTML, as the story shows it
function body(title) {
	return h.render(wiki, "text/html", "<$transclude $tiddler=\"" + title + "\" $mode=\"block\"/>", {currentTiddler: title});
}

function headings(html) {
	return (html.match(/<div class="dnd-date-heading">.*?<\/div>/g) || []).map(function(s) { return s.replace(/<[^>]+>/g, ""); });
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
	assert.equal((body("Schild").match(/dnd-date-rule/g) || []).length, 2);
	assert.equal((body("Vinland").match(/dnd-date-rule/g) || []).length, 1);
});

test("no paragraph around a section heading", function() {
	// The outer <p> comes from rendering the transclusion inline in the test
	var html = body("Schild").replace(/^<p>/, "");
	assert.doesNotMatch(html, /<p>(<hr class="dnd-date-rule">)?<div class="dnd-date-heading">/);
});

test("locations per section; DM notes skipped", function() {
	assert.equal(h.filter(wiki, "[[Schild]sectionlinks[1]]").join(), "Baile");
	assert.equal(h.filter(wiki, "[[Schild]sectionlinks[3]]").join(), "Baile");
	assert.equal(h.filter(wiki, "[[Vinland]sectionlinks[0]]").join(), "Nowhere");
	assert.equal(h.filter(wiki, "[[Vinland]sectionlinks[2]]").join(), "Insel Avalon");
});

test("locations locked for the player are left out", function() {
	var html = body("Schild");
	assert.ok(html.indexOf('data-tag-title="Insel Avalon"') !== -1 && html.indexOf('data-tag-title="Secret"') === -1);
});

test("head: span of the field and the locations before the first placeholder", function() {
	var view = h.view(wiki, "Vinland");
	assert.match(view, /<div class="dnd-dateline">15\. Eleasis 1351 DR – offen<\/div>/);
	assert.match(view, /dnd-event-head.*data-tag-title="Nowhere".*<\/div>\s*<hr class="dnd-event-rule">/s);
});

test("head without the former labels", function() {
	var view = h.view(wiki, "Schild");
	assert.ok(view.indexOf("Jahr:") === -1 && view.indexOf("Ort:") === -1);
	assert.match(view, /<div class="dnd-dateline">5\. – 24\. Flamerule 1351 DR<\/div>/);
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
	h.add(wiki, {title: "Draft of 'Schild'", "draft.of": "Schild", "draft.title": "Schild", tags: "Campaign Event",
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

test("event table: a span is one row, with caption and flags", function() {
	var table = h.render(wiki, "text/html", "<$let dnd-events=\"[[Schild]] [[Vinland]]\">{{||$:/plugins/dndwiki-core/viewtemplates/event-list/list}}</$let>");
	assert.match(table, /Schild<\/a><\/u> – Das Ritual <em>bis 24\. Flamerule 1351<\/em> <em>\(Ende\)<\/em>/);
	assert.match(table, /Vinland<\/a> <em>bis offen<\/em> <em>\(Fortsetzung\)<\/em>/);
	assert.equal((table.match(/>Schild</g) || []).length, 3);
	// Newest first
	assert.ok(table.indexOf("Vinland") < table.indexOf("Schild"));
});

test("date line below the tags: span of an event, years of the other types", function() {
	var event = h.view(wiki, "Schild");
	assert.ok(event.indexOf("tc-tags-wrapper") < event.indexOf("dnd-dateline"));
	assert.doesNotMatch(event, /dnd-dateline[^>]*>[^<]*<\/div><h2/);
	assert.match(h.view(wiki, "Grum"), /<div class="dnd-dateline">\?\?\?\? – 1350 DR<\/div>/);
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
	h.add(wiki, {title: "$:/state/dndwiki/player", text: "Frigg"});
	h.add(wiki, {title: "Geheim", tags: "Event Ragna", date: "1351"});
	h.add(wiki, {title: "Ragna", tags: "Player"});
	try {
		assert.doesNotMatch(h.view(wiki, "Geheim"), /dnd-dateline/);
	} finally {
		["$:/state/dndwiki/player", "Geheim", "Ragna"].forEach(function(title) { wiki.deleteTiddler(title); });
	}
});

test("date line of an event without date: ???? with the era", function() {
	h.add(wiki, {title: "Ohne Datum", tags: "Event", text: "<<date>>"});
	try {
		assert.match(h.view(wiki, "Ohne Datum"), /<div class="dnd-dateline">\?\?\?\? DR<\/div>/);
		assert.doesNotMatch(h.view(wiki, "Frigg"), /dnd-dateline/);
	} finally {
		wiki.deleteTiddler("Ohne Datum");
	}
});

test("event table: consecutive rows of one event share a title cell", function() {
	h.add(wiki, {title: "Orden", tags: "Event", date: "700, 849"});
	h.add(wiki, {title: "Dazwischen", tags: "Event", date: "800"});
	try {
		var alone = h.render(wiki, "text/html", "<$let dnd-events=\"[[Orden]]\">{{||$:/plugins/dndwiki-core/viewtemplates/event-list/list}}</$let>");
		assert.match(alone, /<td rowspan="2"><a[^>]*>Orden<\/a><\/td>/);
		assert.equal((alone.match(/>Orden</g) || []).length, 1);
		var split = h.render(wiki, "text/html", "<$let dnd-events=\"[[Orden]] [[Dazwischen]]\">{{||$:/plugins/dndwiki-core/viewtemplates/event-list/list}}</$let>");
		assert.match(split, /Orden<\/a> <em>\(Ende\)<\/em>/);
		assert.match(split, /Orden<\/a> <em>\(Start\)<\/em>/);
	} finally {
		wiki.deleteTiddler("Orden");
		wiki.deleteTiddler("Dazwischen");
	}
});
