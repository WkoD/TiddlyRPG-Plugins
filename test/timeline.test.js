/*
 * Event timeline (widgets/timeline.js) as rendered in Node: cards, bars, beams, order, details,
 * date labels. What depends on measured sizes - the placement of the vertical labels, the
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
			h.add(wiki, {title: "Beam " + n, tags: "Event", date: "1351-0" + n + "-01.1351-12-01"});
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
