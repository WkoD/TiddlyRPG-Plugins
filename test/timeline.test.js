/*
 * Event timeline (widgets/timeline.js) as rendered in Node: cards, bars, beams, order, details,
 * date labels, sections (only spans are bars), arrows, the band of the tiddler itself. What depends on measured sizes - the placement of the vertical labels, the
 * widening of a selected card, the lines to its points - only shows in a browser.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var wiki, timeline;

test.before(function() {
	return h.boot().then(function($tw) {
		wiki = $tw.wiki;
		h.setLanguage(wiki, "de-DE");
		timeline = h.render(wiki, "text/html", "<$dnd-timeline filter=\"[tag[Event]]\"/>");
	});
});

// Vertical position of the card of an event
function cardTop(title) {
	var cards = timeline.split('<div class="dnd-tl-card').slice(1);
	for(var i = 0; i < cards.length; i++) {
		if(cards[i].indexOf(">" + title + "<") !== -1) {
			return parseFloat(/top:\s*([-\d.]+)px/.exec(cards[i])[1]);
		}
	}
	return NaN;
}

test("timeline: one card per event", function() {
	assert.equal((timeline.match(/class="dnd-tl-card/g) || []).length, 4);
});

test("timeline: campaign solid bar, other event dashed point", function() {
	assert.ok(timeline.indexOf("dnd-tl-bar dnd-tl-campaign") !== -1 && timeline.indexOf("dnd-tl-point dnd-tl-other") !== -1);
});

test("timeline: details for the selected card (points in time)", function() {
	assert.ok(timeline.indexOf("dnd-tl-details") !== -1);
	assert.match(timeline, /class="dnd-tl-point-date"[^>]*>1\. Flamerule 1351</);
});

test.describe("seven overlapping spans", function() {
	var beams;

	test.before(function() {
		var many = [];
		for(var n = 1; n <= 7; n++) {
			many.push("[[Beam " + n + "]]");
			h.add(wiki, {title: "Beam " + n, tags: "Event", date: "1351-0" + n + "-01/1351-12-01"});
		}
		beams = h.render(wiki, "text/html", "<$dnd-timeline filter=\"" + many.join(" ") + "\"/>");
	});

	test.after(function() {
		for(var n = 1; n <= 7; n++) {
			wiki.deleteTiddler("Beam " + n);
		}
	});

	test("timeline: more than five spans merge into a beam", function() {
		assert.ok(beams.indexOf("dnd-tl-beam") !== -1);
		assert.equal((beams.match(/class="dnd-tl-thread"/g) || []).length, 7);
	});

	test("timeline: at most five lanes wide", function() {
		var xs = {};
		(beams.match(/class="dnd-tl-stroke" d="M([\d.]+) /g) || []).forEach(function(m) { xs[m] = true; });
		assert.ok(Object.keys(xs).length <= 5, Object.keys(xs).join("\n"));
	});
});

test("timeline: newest at the top", function() {
	assert.ok(cardTop("Hafenfest") < cardTop("Der dunkle Turm"), [cardTop("Hafenfest"), cardTop("Der dunkle Turm")].join());
});

test("timeline: undated at the very bottom as ????", function() {
	assert.ok(cardTop("Sage") > cardTop("Der dunkle Turm"), String(cardTop("Sage")));
	assert.ok(timeline.indexOf(">????<") !== -1);
});

test("timeline: Harptos label", function() {
	assert.ok(timeline.indexOf("1. Flamerule 1351") !== -1, String(timeline.match(/dnd-tl-date">[^<]*/g)));
});

// Renders a timeline of the given events; the result is HTML
function draw(filter, self) {
	return h.render(wiki, "text/html", "<$dnd-timeline filter=\"" + filter + "\"" + (self ? " self=\"" + self + "\"" : "") + "/>");
}

test.describe("sections", function() {
	test.before(function() {
		h.add(wiki, {title: "Points", tags: "Event", date: "1351-07-01, 1351-07-11"});
		h.add(wiki, {title: "Span", tags: "Event", date: "1351-07-01/1351-07-11"});
		h.add(wiki, {title: "Ongoing", tags: "Event", date: "1351-07-01/.."});
		h.add(wiki, {title: "Mixed", tags: "Event Baile", date: "1351/1352, 1356", text: "<<date \"Krieg\">>\n\n<<date \"Nachspiel\">>"});
	});

	test.after(function() {
		["Points", "Span", "Ongoing", "Mixed"].forEach(function(title) { wiki.deleteTiddler(title); });
	});

	test("only explicit spans are bars: points in time stay transparent", function() {
		var points = draw("[[Points]]"),
			span = draw("[[Span]]");
		assert.doesNotMatch(points, /stop-opacity="1"/);
		assert.match(span, /stop-opacity="1"/);
	});

	test("points of an event in a lane are dots, the track shows while highlighted", function() {
		var points = draw("[[Points]]");
		assert.equal((points.match(/class="dnd-tl-mid"/g) || []).length, 2);
		assert.equal((points.match(/class="dnd-tl-track"/g) || []).length, 1);
	});

	test("ongoing: arrow at the end of the axis", function() {
		assert.match(draw("[[Ongoing]]"), /class="dnd-tl-arrow"/);
		assert.doesNotMatch(draw("[[Span]]"), /class="dnd-tl-arrow"/);
	});

	test("card: the span with the tag dots above the title", function() {
		var html = draw("[[Mixed]]");
		assert.ok(html.indexOf("dnd-tl-date") < html.indexOf("dnd-tl-title"));
		assert.match(html, /class="dnd-tl-date">1351 – 1356</);
	});

	test("selected card: below the title the tags, then one line per section with its caption", function() {
		var html = draw("[[Mixed]]"),
			details = html.slice(html.indexOf("dnd-tl-details"));
		assert.ok(html.indexOf("dnd-tl-title") < html.indexOf("dnd-tl-details"));
		assert.ok(details.indexOf("dnd-tl-tags") < details.indexOf("dnd-tl-point-date"));
		assert.match(details, /dnd-tl-point-date"[^>]*>1351 – 1352<span class="dnd-tl-caption">Krieg</);
		assert.match(details, /dnd-tl-point-date"[^>]*>1356<span class="dnd-tl-caption">Nachspiel</);
	});
});

test.describe("band of the tiddler itself", function() {
	test.before(function() {
		h.add(wiki, {title: "Old Actia", tags: "Player", date: "1200/1351-04-14"});
		h.add(wiki, {title: "Alive", tags: "Person", date: "1322"});
		h.add(wiki, {title: "Undated Place", tags: "Location"});
	});

	test.after(function() {
		["Old Actia", "Alive", "Undated Place"].forEach(function(title) { wiki.deleteTiddler(title); });
	});

	test("band with the own dates, which set anchors", function() {
		var html = draw("[[Hafenfest]]", "Old Actia");
		assert.equal((html.match(/class="dnd-tl-band"/g) || []).length, 1);
		assert.match(html, /class="dnd-tl-band-label"[^>]*>1200</);
		assert.match(html, /class="dnd-tl-year dnd-tl-major"[^>]*>1200</);
	});

	test("a single point of a non-event: start with an open end", function() {
		assert.match(draw("[[Hafenfest]]", "Alive"), /class="dnd-tl-band-label"[^>]*>offen</);
	});

	test("without a date: band over the whole axis, dates unknown", function() {
		var html = draw("[[Hafenfest]]", "Undated Place");
		assert.match(html, /class="dnd-tl-band dnd-tl-band-unknown"/);
		assert.match(html, />Zeitraum unbekannt</);
	});

	test("no band in the Event hub (no self)", function() {
		assert.doesNotMatch(draw("[[Hafenfest]]"), /class="dnd-tl-band[" ]/);
	});
});

test.describe("goes on after its last section", function() {
	test.before(function() {
		h.add(wiki, {title: "Weiter", tags: "Event", date: "1351-07-01, 1351-07-11, .."});
	});

	test.after(function() {
		wiki.deleteTiddler("Weiter");
	});

	test("dashed continuation with an arrow, the points stay points", function() {
		var html = draw("[[Weiter]]");
		assert.match(html, /class="dnd-tl-continue"/);
		assert.match(html, /class="dnd-tl-arrow"/);
		assert.equal((html.match(/class="dnd-tl-mid"/g) || []).length, 2);
		assert.match(html, /dnd-tl-point-date">offen</);
	});
});
