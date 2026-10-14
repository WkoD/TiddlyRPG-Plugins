/*
 * Event timeline (widgets/timeline.js) as rendered in Node: cards, bars, beams, order, details,
 * date labels, sections (only spans are bars), arrows, the band of the tiddler itself. What
 * depends on measured sizes - the placement of the vertical labels, the widening of a selected
 * card, the lines to its points - only shows in a browser.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var tw, wiki, timeline;

test.before(function() {
	return h.boot().then(function($tw) {
		tw = $tw;
		wiki = $tw.wiki;
		h.setLanguage(wiki, "de-DE");
		timeline = h.render(wiki, "text/html", "<$trpg-timeline filter=\"[tag[Event]]\"/>");
	});
});

// Vertical position of the card of an event
function cardTop(title) {
	var cards = timeline.split('<div class="trpg-tl-card').slice(1);
	for(var i = 0; i < cards.length; i++) {
		if(cards[i].indexOf(">" + title + "<") !== -1) {
			return parseFloat(/top:\s*([-\d.]+)px/.exec(cards[i])[1]);
		}
	}
	return NaN;
}

test("timeline: one card per event", function() {
	assert.equal((timeline.match(/class="trpg-tl-card/g) || []).length, 4);
});

test("timeline: campaign solid bar, other event dashed point", function() {
	assert.ok(timeline.indexOf("trpg-tl-bar trpg-tl-campaign") !== -1 && timeline.indexOf("trpg-tl-point trpg-tl-other") !== -1);
});

test("timeline: details for the selected card (points in time)", function() {
	assert.ok(timeline.indexOf("trpg-tl-details") !== -1);
	assert.match(timeline, /class="trpg-tl-point-date"[^>]*>1\. Flamerule 1351</);
});

test.describe("seven overlapping spans", function() {
	var beams;

	test.before(function() {
		var many = [];
		for(var n = 1; n <= 7; n++) {
			many.push("[[Beam " + n + "]]");
			h.add(wiki, {title: "Beam " + n, tags: "Event", date: "1351-0" + n + "-01/1351-12-01"});
		}
		beams = h.render(wiki, "text/html", "<$trpg-timeline filter=\"" + many.join(" ") + "\"/>");
	});

	test.after(function() {
		for(var n = 1; n <= 7; n++) {
			wiki.deleteTiddler("Beam " + n);
		}
	});

	test("timeline: more than five spans merge into a beam", function() {
		assert.ok(beams.indexOf("trpg-tl-beam") !== -1);
		assert.equal((beams.match(/class="trpg-tl-thread"/g) || []).length, 7);
	});

	test("timeline: at most five lanes wide", function() {
		var xs = {};
		(beams.match(/class="trpg-tl-stroke" d="M([\d.]+) /g) || []).forEach(function(m) { xs[m] = true; });
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
	assert.ok(timeline.indexOf("1. Flamerule 1351") !== -1, String(timeline.match(/trpg-tl-date">[^<]*/g)));
});

// Renders a timeline of the given events; the result is HTML
function draw(filter, self) {
	return h.render(wiki, "text/html", "<$trpg-timeline filter=\"" + filter + "\"" + (self ? " self=\"" + self + "\"" : "") + "/>");
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
		assert.equal((points.match(/class="trpg-tl-mid"/g) || []).length, 2);
		assert.equal((points.match(/class="trpg-tl-track"/g) || []).length, 1);
	});

	test("ongoing: arrow at the end of the axis", function() {
		assert.match(draw("[[Ongoing]]"), /class="trpg-tl-arrow"/);
		assert.doesNotMatch(draw("[[Span]]"), /class="trpg-tl-arrow"/);
	});

	test("card: the span with the tag dots above the title", function() {
		var html = draw("[[Mixed]]");
		assert.ok(html.indexOf("trpg-tl-date") < html.indexOf("trpg-tl-title"));
		assert.match(html, /class="trpg-tl-date">1351 – 1356</);
	});

	test("selected card: below the title the tags, then one line per section with its caption", function() {
		var html = draw("[[Mixed]]"),
			details = html.slice(html.indexOf("trpg-tl-details"));
		assert.ok(html.indexOf("trpg-tl-title") < html.indexOf("trpg-tl-details"));
		assert.ok(details.indexOf("trpg-tl-tags") < details.indexOf("trpg-tl-point-date"));
		assert.match(details, /trpg-tl-point-date"[^>]*>1351 – 1352<span class="trpg-tl-caption">Krieg</);
		assert.match(details, /trpg-tl-point-date"[^>]*>1356<span class="trpg-tl-caption">Nachspiel</);
	});

	test("selected card: every section line links to its section of the event", function() {
		var details = draw("[[Mixed]]");
		details = details.slice(details.indexOf("trpg-tl-details"));
		assert.match(details, /class="trpg-tl-point-date"[^>]*data-anchor="date-1"[^>]*data-title="Mixed"[^>]*>1351 – 1352</);
		assert.match(details, /class="trpg-tl-point-date"[^>]*data-anchor="date-2"[^>]*>1356</);
	});

	test("captions are wikitext, shown as text on the card and in the tooltip; $5$ as written", function() {
		var feet = h.filter(wiki, "[[30 ft]trpgunit[]]").join();
		assert.notEqual(feet, "30 ft");
		h.add(wiki, {title: "Captions", tags: "Event", date: "1351-07-01, 1351-07-11, 1351-07-21",
			text: "<<date \"Sturz aus <<unit '30 ft'>>\">>\n\n<<date \"Nach [[Baile]]\">>\n\n<<date \"Lohn $5$\">>"});
		try {
			var html = draw("[[Captions]]"),
				details = html.slice(html.indexOf("trpg-tl-details"));
			assert.ok(details.indexOf('<span class="trpg-tl-caption">Sturz aus ' + feet + "</span>") !== -1, details);
			assert.match(details, /<span class="trpg-tl-caption">Nach Baile<\/span>/);
			assert.match(details, /<span class="trpg-tl-caption">Lohn \$5\$<\/span>/);
			assert.ok(html.indexOf("<title>1. Flamerule 1351 – Sturz aus " + feet + "</title>") !== -1, html.match(/<title>[^<]*<\/title>/g).join());
			assert.match(html, /<title>11\. Flamerule 1351 – Nach Baile<\/title>/);
		} finally {
			wiki.deleteTiddler("Captions");
		}
	});

	test("redrawn when the rules language, the ruleset, the setting or the currency changes", function() {
		var root = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", "<$trpg-timeline filter=\"[[Points]]\"/>"));
		root.render(tw.fakeDocument.createElement("div"), null);
		assert.equal(root.refresh({"Unrelated": {modified: true}}), false);
		["$:/config/tiddlyrpg/rules/ruleset/mode", "$:/config/tiddlyrpg/rules/setting/mode", "$:/config/tiddlyrpg/ruleset", "$:/config/tiddlyrpg/setting", "$:/config/tiddlyrpg/currency"].forEach(function(title) {
			var changed = {};
			changed[title] = {modified: true};
			assert.equal(root.refresh(changed), true, title);
		});
	});
});

test.describe("band of the tiddler itself", function() {
	test.before(function() {
		h.add(wiki, {title: "Old Actia", tags: "Player", date: "1200/1351-04-14"});
		h.add(wiki, {title: "Alive", tags: "Person", date: "1322"});
		h.add(wiki, {title: "Undated Place", tags: "Location"});
		h.add(wiki, {title: "Vanished", tags: "Person", date: "1300/."});
		h.add(wiki, {title: "Hidden Life", tags: "Event", date: "1290/1300, 1340/1345",
			text: "<<date>>\n\nKnown.\n\n<<secret>><<date>>\n\nSecret."});
		h.add(wiki, {title: "Unknown Birth", tags: "Person", date: "./1351-08-04"});
		h.add(wiki, {title: "Somewhere", tags: "Person", date: "./.."});
		h.add(wiki, {title: "Early Word", tags: "Event", date: "1340-01-01"});
		h.add(wiki, {title: "Late Deed", tags: "Event", date: "1351-06-01"});
		h.add(wiki, {title: "Secret Start", tags: "Event", date: "1330-01-01, 1351-06-01",
			text: "<<secret>><<date>>\n\nSecret.\n\n<<date>>\n\nKnown."});
	});

	test.after(function() {
		["Old Actia", "Alive", "Undated Place", "Vanished", "Hidden Life", "Unknown Birth", "Somewhere", "Early Word", "Late Deed", "Secret Start"].forEach(function(title) { wiki.deleteTiddler(title); });
	});

	// Lower edge of the band (newest at the top: the oldest end) and the lowest point on the axis
	function bandBottom(html) {
		var rect = /<rect [^>]*class="trpg-tl-band-area"[^>]*>/.exec(html)[0];
		return parseFloat(/ y="([-\d.]+)"/.exec(rect)[1]) + parseFloat(/height="([-\d.]+)"/.exec(rect)[1]);
	}
	function lowestPoint(html) {
		return Math.max.apply(null, (html.match(/<circle [^>]*class="trpg-tl-point[^>]*>/g) || []).map(function(c) {
			return parseFloat(/cy="([-\d.]+)"/.exec(c)[1]);
		}));
	}

	test("unknown start: the band fades in from the first mention", function() {
		var html = draw("[[Early Word]] [[Late Deed]]", "Unknown Birth"),
			stops = bandStops(html);
		assert.ok(Math.abs(bandBottom(html) - lowestPoint(html)) < 1, bandBottom(html) + " / " + lowestPoint(html));
		assert.deepEqual(stops[0], [0, "0"]);
	});

	test("unknown start, alive: from the first mention, solid at the last, fades out at the top", function() {
		var html = draw("[[Early Word]] [[Late Deed]]", "Somewhere"),
			stops = bandStops(html);
		assert.doesNotMatch(html, /trpg-tl-band-unknown/);
		assert.ok(Math.abs(bandBottom(html) - lowestPoint(html)) < 1, bandBottom(html) + " / " + lowestPoint(html));
		assert.deepEqual(stops.map(function(s) { return s[1]; }), ["0", "1", "1", "0"]);
	});

	test("first mention: a section the view does not see does not count, the DM's does", function() {
		var visible = h.inView(wiki, "public", function() { return bandBottom(draw("[[Secret Start]] [[Late Deed]]", "Unknown Birth")); }),
			dm = h.inView(wiki, "dm", function() { return bandBottom(draw("[[Secret Start]] [[Late Deed]]", "Unknown Birth")); });
		assert.ok(dm > visible + 20, dm + " / " + visible);
	});

	// Texts of the band labels
	function bandLabels(html) {
		return (html.match(/class="trpg-tl-band-label"[^>]*>[^<]*</g) || []).map(function(m) {
			return /> *([^<]*)<$/.exec(m)[1];
		});
	}

	test("band with the own dates, which set anchors", function() {
		var html = draw("[[Hafenfest]]", "Old Actia");
		assert.equal((html.match(/class="trpg-tl-band"/g) || []).length, 1);
		assert.match(html, /class="trpg-tl-year trpg-tl-major"[^>]*>1200</);
	});

	test("band labels: the years only, not the whole date", function() {
		assert.deepEqual(bandLabels(draw("[[Hafenfest]]", "Old Actia")).sort(), ["1200", "1351"]);
	});

	test("band labels fit: the band is at least as wide as its years", function() {
		var html = draw("[[Hafenfest]]", "Old Actia"),
			area = /class="trpg-tl-band-area"[^>]*width="([\d.]+)"/.exec(html);
		assert.ok(parseFloat(area[1]) >= 4 * 6.2 + 2 * 6, area[0]);
	});

	// The stops of the band gradient, bottom to top: [offset, opacity]
	function bandStops(html) {
		var grad = /<linearGradient [^>]*id="trpg-tl-b-[^"]*"[^>]*>(.*?)<\/linearGradient>/.exec(html);
		return (grad[1].match(/<stop [^>]*>/g) || []).map(function(stop) {
			return [parseFloat(/offset="([^"]*)"/.exec(stop)[1]), /stop-opacity="([^"]*)"/.exec(stop)[1]];
		});
	}

	test("a single point of a non-event: start with an open end, no ???? above", function() {
		assert.deepEqual(bandLabels(draw("[[Hafenfest]]", "Alive")), ["1322"]);
	});

	test("open end (alive): solid up to the last event, fades out at the top of the axis", function() {
		var stops = bandStops(draw("[[Hafenfest]]", "Alive"));
		assert.deepEqual(stops[stops.length - 1], [1, "0"]);
		assert.equal(stops[stops.length - 2][1], "1");
		assert.ok(stops[stops.length - 2][0] < 1, JSON.stringify(stops));
	});

	test("unknown end: the band fades out upwards, no ????", function() {
		var html = draw("[[Hafenfest]]", "Vanished"),
			stops = bandStops(html);
		assert.deepEqual(bandLabels(html), ["1300"]);
		assert.equal(stops[stops.length - 1][1], "0");
	});

	test("without a date: fades in from the first mention to the last and out again, no label", function() {
		var html = draw("[[Early Word]] [[Late Deed]]", "Undated Place"),
			stops = bandStops(html);
		assert.deepEqual(bandLabels(html), []);
		assert.ok(Math.abs(bandBottom(html) - lowestPoint(html)) < 1, bandBottom(html) + " / " + lowestPoint(html));
		assert.deepEqual(stops.map(function(s) { return s[1]; }), ["0", "1", "1", "0"]);
		assert.ok(stops[1][0] > 0 && stops[2][0] < 1, JSON.stringify(stops));
	});

	test("band of an event: a section the view does not see is left out, the DM sees it", function() {
		var visible = h.inView(wiki, "public", function() { return bandLabels(draw("[[Hafenfest]]", "Hidden Life")); }),
			dm = h.inView(wiki, "dm", function() { return bandLabels(draw("[[Hafenfest]]", "Hidden Life")); });
		assert.deepEqual(visible.sort(), ["1290", "1300"]);
		assert.deepEqual(dm.sort(), ["1290", "1300", "1340", "1345"]);
	});

	test.describe("phases of a non-event: a death, then a return", function() {
		var added = [
			{title: "Wolf Back", tags: "Person", date: "./1351, 1355"},
			{title: "Wolf Lost", tags: "Person", date: "./., 1355"},
			{title: "Wolf Again", tags: "Person", date: "./1351, ./1380"},
			{title: "Wolf Return", tags: "Event", date: "1355-02-01"},
			{title: "Wolf End", tags: "Event", date: "1380-11-20"}
		],
			events = "[[Early Word]] [[Late Deed]] [[Wolf Return]] [[Wolf End]]";

		test.before(function() {
			added.forEach(function(fields) {
				h.add(wiki, fields);
			});
		});

		test.after(function() {
			added.forEach(function(fields) {
				wiki.deleteTiddler(fields.title);
			});
		});

		// The band areas, newest first: [{top, bottom}] (time runs upwards in the drawing)
		function areas(html) {
			return (html.match(/<rect [^>]*class="trpg-tl-band-area"[^>]*>/g) || []).map(function(rect) {
				var y = parseFloat(/ y="([-\d.]+)"/.exec(rect)[1]);
				return {top: y, bottom: y + parseFloat(/height="([-\d.]+)"/.exec(rect)[1])};
			}).sort(function(a, b) { return a.top - b.top; });
		}
		// The points of the events, newest first
		function points(html) {
			return (html.match(/<circle [^>]*class="trpg-tl-point[^>]*>/g) || []).map(function(c) {
				return parseFloat(/cy="([-\d.]+)"/.exec(c)[1]);
			}).sort(function(a, b) { return a - b; });
		}

		["Wolf Back", "Wolf Lost", "Wolf Again"].forEach(function(title) {
			test(title + ": one band per phase, apart", function() {
				var a = areas(draw(events, title));
				assert.equal(a.length, 2, JSON.stringify(a));
				assert.ok(a[0].bottom < a[1].top, JSON.stringify(a));
			});
		});

		test("an unknown end before the return fades out before it", function() {
			var html = draw(events, "Wolf Lost"),
				a = areas(html),
				p = points(html);
			assert.ok(a[1].top >= p[1], JSON.stringify(a) + " / " + JSON.stringify(p));
		});

		test("an unknown start of the return fades in from the first mention after the death", function() {
			var html = draw(events, "Wolf Again"),
				a = areas(html),
				p = points(html);
			assert.ok(Math.abs(a[0].bottom - p[1]) < 1, JSON.stringify(a) + " / " + JSON.stringify(p));
		});
	});

	test("no band in the Event hub (no self)", function() {
		assert.doesNotMatch(draw("[[Hafenfest]]"), /class="trpg-tl-band[" ]/);
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
		assert.match(html, /class="trpg-tl-continue"/);
		assert.match(html, /class="trpg-tl-arrow"/);
		assert.equal((html.match(/class="trpg-tl-mid"/g) || []).length, 2);
		assert.match(html, /trpg-tl-point-date">\?\?\?\?</);
		// The continuation is no section: no link
		assert.doesNotMatch(html, /data-anchor="[^"]*"[^>]*>\?\?\?\?</);
	});
});

test.describe("colour of the tag dots", function() {
	test.before(function() {
		h.add(wiki, {title: "Orden", tags: "Organisation", color: "#ff8000"});
		h.add(wiki, {title: "Held", tags: "Orden Player"});
		h.add(wiki, {title: "Eigenfarbe", tags: "Orden Player", color: "#123456"});
		h.add(wiki, {title: "Treffen", tags: "Event Held Eigenfarbe Orden", date: "1351-07-01"});
	});

	test.after(function() {
		["Orden", "Held", "Eigenfarbe", "Treffen"].forEach(function(title) { wiki.deleteTiddler(title); });
	});

	// Colour of every tag dot by its tooltip
	function dots(html) {
		var colours = {};
		(html.match(/<span class="trpg-tl-tagdot"[^>]*>/g) || []).forEach(function(span) {
			var title = /title="([^"]*)"/.exec(span),
				colour = /background-color:\s*([^;"]+)/.exec(span);
			if(title) {
				colours[title[1]] = colour ? colour[1].trim() : null;
			}
		});
		return colours;
	}

	test("like the tag pill: own colour, else the type hub, not the first coloured tag", function() {
		var colours = dots(draw("[[Treffen]]")),
			player = wiki.getTiddler("Player").fields.color;
		assert.equal(colours.Held, player);
		assert.equal(colours.Eigenfarbe, "#123456");
		assert.equal(colours.Orden, "#ff8000");
	});
});
