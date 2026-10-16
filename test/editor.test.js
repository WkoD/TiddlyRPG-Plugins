/*
 * The buttons of the editor toolbar on the text (modules/editor.js): every kind of section set the
 * same way - the short form before the unit at the cursor, the block form around a selection -,
 * changed or removed where one stands, the field date kept in step with the dated sections, a
 * spot made a location of its own, <<spotlink>> with a selection as its text. A "|" in the texts
 * below is the cursor, two of them the selection.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var wiki, editor, $tw;

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		h.setLanguage(wiki, "de-DE");
		editor = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/editor.js");
		h.add(wiki, {title: "Bran", tags: "Person", player: "Ben", text: "A former character."});
	});
});

// The input of a text with "|" marks; fields and tags of the draft
function input(marked, tags, fields) {
	var start = marked.indexOf("|"),
		end = marked.lastIndexOf("|");
	return {
		text: marked.replace(/\|/g, ""),
		selStart: start,
		selEnd: start === end ? start : end - 1,
		tags: tags || ["Event"],
		fields: fields || {}
	};
}

function apply(marked, action, tags, fields) {
	return editor.apply(wiki, input(marked, tags, fields), action);
}

function probe(marked, kind, tags, fields) {
	return editor.probe(wiki, input(marked, tags, fields), kind);
}

// Objects of the wiki as plain ones (another realm: deepEqual compares prototypes)
function plain(value) {
	return JSON.parse(JSON.stringify(value));
}

test.describe("dates", function() {
	test("a new date goes before the paragraph, its date into the field at its place", function() {
		var r = apply("<<date>>\n\nFirst.\n\nSec|ond.\n", {kind: "date", op: "insert", date: "1351-07-05"}, ["Event"], {date: "1351-07-01"});
		assert.equal(r.text, "<<date>>\n\nFirst.\n\n<<date>>\n\nSecond.\n");
		assert.equal(r.fields.date, "1351-07-01, 1351-07-05");
	});
	test("a date before the others takes the first section; the cursor moves with the text", function() {
		var r = apply("Intro|.\n\n<<date>>\n\nFirst.\n", {kind: "date", op: "insert", date: "1351-06-01"}, ["Event"], {date: "1351-07-01"});
		assert.equal(r.text, "<<date>>\n\nIntro.\n\n<<date>>\n\nFirst.\n");
		assert.equal(r.fields.date, "1351-06-01, 1351-07-01");
		assert.equal(r.selStart, "<<date>>\n\nIntro".length);
	});
	test("with a selection: <$date> around the paragraphs it touches, a caption named", function() {
		var r = apply("<<date>>\n\nFi|rst.\n\nSec|ond.\n\nThird.\n", {kind: "date", op: "insert", date: "1351-07-03", label: "Rast"}, ["Event"], {date: "1351-07-01"});
		assert.equal(r.text, "<<date>>\n\n<$date label=\"Rast\">\n\nFirst.\n\nSecond.\n\n</$date>\n\nThird.\n");
		assert.equal(r.fields.date, "1351-07-01, 1351-07-03");
	});
	test("explicit numbers behind a new date count on", function() {
		var r = apply("<<date>>\n\nA|.\n\n<<date 2 label:\"B\">>\n\nB.\n", {kind: "date", op: "insert", date: "1351-07-02"}, ["Event"], {date: "1351-07-01, 1351-07-05"});
		assert.equal(r.text, "<<date>>\n\n<<date>>\n\nA.\n\n<<date 3 label:\"B\">>\n\nB.\n");
		assert.equal(r.fields.date, "1351-07-01, 1351-07-02, 1351-07-05");
	});
	test("at a date: probe names it, change sets date and caption, remove takes its section along", function() {
		var p = probe("<<date>>\n\nFirst.\n\n<<date>>\n\nSe|cond.\n", "date", ["Event"], {date: "1351-07-01, 1351-07-05"});
		assert.equal(p.form, "short");
		assert.equal(p.number, 2);
		assert.equal(p.date, "1351-07-05");
		var c = apply("<<date>>\n\nFirst.\n\n<<date>>\n\nSe|cond.\n", {kind: "date", op: "change", date: "1351-07-06", label: "Neu"}, ["Event"], {date: "1351-07-01, 1351-07-05"});
		assert.equal(c.text, "<<date>>\n\nFirst.\n\n<<date label:\"Neu\">>\n\nSecond.\n");
		assert.equal(c.fields.date, "1351-07-01, 1351-07-06");
		var r = apply("<<date>>\n\nFirst.\n\n<<date>>\n\nSe|cond.\n", {kind: "date", op: "remove"}, ["Event"], {date: "1351-07-01, 1351-07-05"});
		assert.equal(r.text, "<<date>>\n\nFirst.\n\nSecond.\n");
		assert.equal(r.fields.date, "1351-07-01");
	});
	test("a new date tells the dates around it; without a date or inside a <$date> nothing changes", function() {
		var p = probe("<<date>>\n\nA.\n\nB|.\n\n<<date>>\n\nC.\n", "date", ["Event"], {date: "1351-07-01, 1351-07-09"});
		assert.equal(p.form, "");
		assert.equal(p.number, 2);
		assert.equal(p.prev, "1351-07-01");
		assert.equal(p.next, "1351-07-09");
		assert.equal(apply("<<date>>\n\nA|.\n", {kind: "date", op: "insert", date: ""}).error, "Editor/Error/NoDate");
		assert.equal(apply("<$date>\n\nA|.\n\n</$date>\n", {kind: "date", op: "insert", date: "1351-07-01"}).error, "Editor/Error/InDate");
	});
	test("the units of a level: a list, a table, a heading, an HTML element and a code block each count as one", function() {
		var cases = [
			["* a\n* b|\n", "<<date>>\n\n* a\n* b\n"],
			["|x|y|\n|z|w|\n", null],
			["!! Head|ing\n", "<<date>>\n\n!! Heading\n"],
			["<div>\n\nIn|ner\n\n</div>\n", "<<date>>\n\n<div>\n\nInner\n\n</div>\n"],
			["```\nco|de\n```\n", "<<date>>\n\n```\ncode\n```\n"]
		];
		cases.forEach(function(c) {
			var text = c[0].indexOf("|x|") === 0 ? "|x|y|\n|z|w|\n" : c[0],
				r = c[1] === null ? editor.apply(wiki, {text: text, selStart: 2, selEnd: 2, tags: ["Event"], fields: {}}, {kind: "date", op: "insert", date: "1351-07-01"}) :
					apply(text, {kind: "date", op: "insert", date: "1351-07-01"});
			assert.equal(r.text, c[1] === null ? "<<date>>\n\n|x|y|\n|z|w|\n" : c[1], JSON.stringify(c[0]));
		});
	});
});

test.describe("locks", function() {
	test("at the start of a section: before its marker; at the very start: on its own", function() {
		assert.equal(apply("<<date>>\n\nFi|rst.\n", {kind: "secret", op: "insert", names: "Frigg"}).text,
			"<<secret \"Frigg\">><<date>>\n\nFirst.\n");
		assert.equal(apply("Int|ro.\n\n<<date>>\n\nFirst.\n", {kind: "secret", op: "insert", dm: "yes"}).text,
			"<<secret>>\n\nIntro.\n\n<<date>>\n\nFirst.\n");
	});
	test("in the middle of a section: the block form around the paragraph (a short form would not count)", function() {
		assert.equal(apply("<<date>>\n\nFirst.\n\nSec|ond.\n", {kind: "secret", op: "insert", names: "Frigg Bran"}).text,
			"<<date>>\n\nFirst.\n\n<$secret for=\"Frigg Bran\">\n\nSecond.\n\n</$secret>\n");
	});
	test("a selection within a paragraph: inline around it; across paragraphs: around them", function() {
		assert.equal(apply("<<date>>\n\nFirst |words| here.\n", {kind: "secret", op: "insert", names: "Frigg"}).text,
			"<<date>>\n\nFirst <$secret for=\"Frigg\">words</$secret> here.\n");
		assert.equal(apply("<<date>>\n\nA|.\n\nB|.\n", {kind: "secret", op: "insert", names: "Frigg"}).text,
			"<<date>>\n\n<$secret for=\"Frigg\">\n\nA.\n\nB.\n\n</$secret>\n");
	});
	test("at a lock: probe names it, change and remove", function() {
		var p = probe("<<secret \"Frigg\">><<date>>\n\nFi|rst.\n", "secret");
		assert.equal(p.form, "short");
		assert.deepEqual(plain(p.params.names), ["Frigg"]);
		assert.equal(apply("<<secret \"Frigg\">><<date>>\n\nFi|rst.\n", {kind: "secret", op: "change", dm: "yes"}).text, "<<secret>><<date>>\n\nFirst.\n");
		assert.equal(apply("<<secret \"Frigg\">><<date>>\n\nFi|rst.\n", {kind: "secret", op: "remove"}).text, "<<date>>\n\nFirst.\n");
		assert.equal(apply("<<date>>\n\n<$secret for=\"Frigg\">\n\nIn|side.\n\n</$secret>\n", {kind: "secret", op: "remove"}).text, "<<date>>\n\nInside.\n");
	});
});

test.describe("quest markers", function() {
	test("at the start of the paragraph or list item; a selection in a paragraph inline", function() {
		assert.equal(apply("<<date>>\n\nSome te|xt.\n", {kind: "quest", op: "insert", name: "Turm"}).text, "<<date>>\n\n<<quest \"Turm\">>Some text.\n");
		assert.equal(apply("<<date>>\n\n* one\n* tw|o\n", {kind: "quest", op: "insert", name: "Turm"}).text, "<<date>>\n\n* one\n* <<quest \"Turm\">>two\n");
		assert.equal(apply("<<date>>\n\nSome |text|.\n", {kind: "quest", op: "insert", name: "Turm"}).text, "<<date>>\n\nSome <$quest name=\"Turm\">text</$quest>.\n");
	});
	test("the status steps open -> complete -> failed -> open, the marker stays; also the block and the form with =", function() {
		var t = "<<date>>\n\n<<quest \"Turm\">>Some |text.\n",
			steps = [];
		for(var i = 0; i < 3; i++) {
			var r = apply(t, {kind: "quest", op: "cycle"});
			steps.push(r.text);
			t = r.text.substring(0, r.selStart) + "|" + r.text.substring(r.selStart);
		}
		assert.deepEqual(steps, [
			"<<date>>\n\n<<quest \"Turm\" status:\"complete\">>Some text.\n",
			"<<date>>\n\n<<quest \"Turm\" status:\"failed\">>Some text.\n",
			"<<date>>\n\n<<quest \"Turm\">>Some text.\n"
		]);
		assert.equal(apply("<<date>>\n\n<<quest name=\"Turm\" status=\"open\">>Some |text.\n", {kind: "quest", op: "cycle"}).text,
			"<<date>>\n\n<<quest \"Turm\" status:\"complete\">>Some text.\n");
		assert.equal(apply("<<date>>\n\n<$quest name=\"Turm\" status=\"complete\">\n\nSome |text.\n\n</$quest>\n", {kind: "quest", op: "cycle"}).text,
			"<<date>>\n\n<$quest name=\"Turm\" status=\"failed\">\n\nSome text.\n\n</$quest>\n");
		assert.equal(apply("<<date>>\n\nNo mar|ker.\n", {kind: "quest", op: "cycle"}).error, "Editor/Error/NoQuest");
	});
	test("at a marker: another name, a further quest linked, remove", function() {
		var t = "<<date>>\n\n<<quest \"Turm\">>Some |text.\n";
		assert.equal(probe(t, "quest").params.name, "Turm");
		assert.equal(apply(t, {kind: "quest", op: "change", name: "Burg"}).text, "<<date>>\n\n<<quest \"Burg\">>Some text.\n");
		assert.equal(apply(t, {kind: "quest", op: "add", name: "Burg"}).text, "<<date>>\n\n<<quest \"Turm\">><<quest \"Burg\">>Some text.\n");
		assert.equal(apply(t, {kind: "quest", op: "remove"}).text, "<<date>>\n\nSome text.\n");
	});
});

test.describe("spots and links to spots", function() {
	test("a spot always as short form before the paragraph; around a selection the block form; remove", function() {
		assert.equal(apply("Town.\n\nWhere |they drink.\n\nMore.\n", {kind: "spot", op: "insert", name: "Tavern 2"}, ["Location"]).text,
			"Town.\n\n<<spot \"Tavern 2\">>\n\nWhere they drink.\n\nMore.\n");
		assert.equal(apply("Town.\n\n|Where they drink.|\n\nMore.\n", {kind: "spot", op: "insert", name: "Bar"}, ["Location"]).text,
			"Town.\n\n<$spot name=\"Bar\">\n\nWhere they drink.\n\n</$spot>\n\nMore.\n");
		assert.equal(apply("Town.\n\n<<spot \"Bar\">>\n\nWhere |they drink.\n", {kind: "spot", op: "remove"}, ["Location"]).text,
			"Town.\n\nWhere they drink.\n");
	});
	test("<<spotlink>> at the cursor, a selection as its text", function() {
		assert.equal(apply("Went to |.", {kind: "spotlink", place: "Town", spot: "Tavern"}).text, "Went to <<spotlink \"Town\" \"Tavern\">>.");
		assert.equal(apply("Went to |the inn|.", {kind: "spotlink", place: "Town", spot: "Tavern"}).text, "Went to <<spotlink \"Town\" \"[[the inn|Tavern]]\">>.");
	});
});

test.describe("a spot becomes a location of its own", function() {
	test("the text up to the next marker and the images go to the new tiddler, the marker stays", function() {
		var r = apply("Town.\n\n<<spot \"Old |Mill\" image:\"mill.jpg\" map:\"mill map.jpg\">>\n\nGrinds corn.\n\nMore corn.\n\n<<spot \"Gate\">>\n\nA gate.\n",
			{kind: "sublocation"}, ["Location"]);
		assert.equal(r.text, "Town.\n\n<<spot \"Old Mill\">>\n\n<<spot \"Gate\">>\n\nA gate.\n");
		assert.deepEqual(plain(r.create), {title: "Old Mill", tags: ["Location"], text: "Grinds corn.\n\nMore corn.", image: "mill.jpg", map: "mill map.jpg"});
		assert.equal(r.navigate, "Old Mill");
	});
	test("a block keeps its place as an empty block", function() {
		var r = apply("Town.\n\n<$spot name=\"Mill\">\n\nGr|inds.\n\n</$spot>\n\nAfter.\n", {kind: "sublocation"}, ["Location"]);
		assert.equal(r.text, "Town.\n\n<$spot name=\"Mill\"/>\n\nAfter.\n");
		assert.equal(r.create.text, "Grinds.");
	});
	test("the lock goes along: of the spot, narrowed by nested locks, and of a secret location", function() {
		assert.deepEqual(plain(apply("Town.\n\n<<secret \"Frigg\">><<spot \"Hidden |Den\">>\n\nDen.\n", {kind: "sublocation"}, ["Location"]).create.tags),
			["Location", "Secret", "Frigg"]);
		assert.deepEqual(plain(apply("Town.\n\n<$secret for=\"Frigg Bran\">\n\n<<secret \"Bran\">><<spot \"De|n\">>\n\nDen.\n\n</$secret>\n", {kind: "sublocation"}, ["Location"]).create.tags),
			["Location", "Secret", "Bran"]);
		assert.deepEqual(plain(apply("Town.\n\n<<spot \"De|n\">>\n\nDen.\n", {kind: "sublocation"}, ["Location", "Secret"]).create.tags),
			["Location", "Secret"]);
	});
	test("not for a spot with a tiddler, nor where the title exists in another case", function() {
		assert.equal(probe("Town.\n\n<<spot \"Tav|ern\">>\n\nX.\n", "sublocation", ["Location"]).spot.problem, "Editor/Sublocation/Joined");
		assert.equal(apply("Town.\n\n<<spot \"tav|ern\">>\n\nX.\n", {kind: "sublocation"}, ["Location"]).error, "Editor/Sublocation/Taken");
		assert.equal(apply("Town.\n\nNo sp|ot.\n", {kind: "sublocation"}, ["Location"]).error, "Editor/Sublocation/NoSpot");
	});
});

test.describe("after the walk through (2026-10-16)", function() {
	test("a lock inside a paragraph is found, also with a selection in it", function() {
		var t = "<<date>>\n\nFirst <$secret for=\"Frigg\">some |hidden| words</$secret> here.\n";
		assert.equal(probe(t, "secret").form, "block");
		assert.equal(apply(t, {kind: "secret", op: "remove"}).text, "<<date>>\n\nFirst some hidden words here.\n");
	});
	test("a quest is marked once at the same place; each marker at the cursor can go on its own", function() {
		var t = "<<date>>\n\n<<quest \"A\">><<quest \"B\">>Some |text.\n";
		var p = probe(t, "quest");
		assert.deepEqual(plain(p.markers.map(function(m) { return m.name; })), ["A", "B"]);
		assert.equal(p.names, "A B");
		assert.equal(apply(t, {kind: "quest", op: "add", name: "B"}).error, "Editor/Error/QuestTwice");
		assert.equal(apply(t, {kind: "quest", op: "change", name: "B"}).error, "Editor/Error/QuestTwice");
		var b = p.markers[1].start;
		assert.equal(apply(t, {kind: "quest", op: "remove", start: String(b)}).text, "<<date>>\n\n<<quest \"A\">>Some text.\n");
		assert.equal(apply("<<date>>\n\n<$quest name=\"A\">\n\nIn |a block.\n\n</$quest>\n", {kind: "quest", op: "insert", name: "A"}).error, "Editor/Error/QuestTwice");
	});
	test("a new sub-location: created with the field location, the selection moves into it with its lock", function() {
		var r = editor.apply(wiki, $tw.utils.extend(input("Town.\n\n<<secret \"Frigg\">><<spot \"Hof\">>\n\nA |yard with a well.|\n", ["Location"]), {title: "Town"}), {kind: "newsublocation", name: "Brunnen"});
		assert.equal(r.text, "Town.\n\n<<secret \"Frigg\">><<spot \"Hof\">>\n\nA \n");
		assert.deepEqual(plain(r.create), {title: "Brunnen", tags: ["Location", "Secret", "Frigg"], location: "Town", text: "yard with a well."});
		assert.equal(r.navigate, "Brunnen");
		var plainNew = editor.apply(wiki, $tw.utils.extend(input("Town.|\n", ["Location"]), {title: "Old Town"}), {kind: "newsublocation", name: "Gasse"});
		assert.deepEqual(plain(plainNew.create), {title: "Gasse", tags: ["Location"], location: "[[Old Town]]", text: ""});
		assert.equal(editor.apply(wiki, input("Town.|\n", ["Location"]), {kind: "newsublocation", name: "town"}).error, "Editor/Sublocation/Taken");
	});
	test("a new sub-location from whole paragraphs leaves no gap behind", function() {
		var r = editor.apply(wiki, $tw.utils.extend(input("Town.\n\n|The tower stands here.|\n\nRest.\n", ["Location"]), {title: "Town"}), {kind: "newsublocation", name: "Turm"});
		assert.equal(r.text, "Town.\n\nRest.\n");
		assert.equal(r.create.text, "The tower stands here.");
		var last = editor.apply(wiki, $tw.utils.extend(input("Town.\n\n|The tower.|\n", ["Location"]), {title: "Town"}), {kind: "newsublocation", name: "Turm"});
		assert.equal(last.text, "Town.\n\n");
	});
});

test.describe("behind the last paragraph (2026-10-16)", function() {
	test("a new date goes to the cursor, for the paragraph the DM writes next; the cursor behind it", function() {
		var r = apply("<<date>>\n\nA.\n\n|", {kind: "date", op: "insert", date: "1351-07-05"}, ["Event"], {date: "1351-07-01"});
		assert.equal(r.text, "<<date>>\n\nA.\n\n<<date>>\n\n");
		assert.equal(r.fields.date, "1351-07-01, 1351-07-05");
		assert.equal(r.selStart, r.text.length);
		assert.equal(r.selEnd, r.text.length);
	});
	test("one line break is enough to leave the paragraph; at its end the cursor still stands in it", function() {
		assert.equal(apply("<<date>>\n\nA.\n|", {kind: "date", op: "insert", date: "d2"}, ["Event"], {date: "d1"}).text, "<<date>>\n\nA.\n\n<<date>>\n\n");
		assert.equal(apply("<<date>>\n\nA.|", {kind: "date", op: "insert", date: "d2"}, ["Event"], {date: "d1"}).text, "<<date>>\n\n<<date>>\n\nA.");
	});
	test("the probe behind the last paragraph offers a new date, not the one of the section before", function() {
		var p = probe("<<date>>\n\nA.\n\n|", "date", ["Event"], {date: "d1"});
		assert.equal(p.form, "");
		assert.equal(p.number, 2);
		assert.equal(p.prev, "d1");
	});
	test("in the gap between two paragraphs the marker stays before the next one", function() {
		assert.equal(apply("<<date>>\n\nA.\n\n|\n\nB.\n", {kind: "date", op: "insert", date: "d2"}, ["Event"], {date: "d1"}).text, "<<date>>\n\nA.\n\n\n\n<<date>>\n\nB.\n");
	});
	test("inside a block: behind its last paragraph, before its end", function() {
		var r = apply("<$secret for=\"Bran\">\n\nA.\n\n|\n\n</$secret>\n", {kind: "date", op: "insert", date: "d1"}, ["Event"], {});
		assert.equal(r.text, "<$secret for=\"Bran\">\n\nA.\n\n<<date>>\n\n\n\n</$secret>\n");
	});
	test("a spot and a quest go to the cursor as well; a lock is an empty block with the cursor inside", function() {
		assert.equal(apply("Ort.\n\n|", {kind: "spot", op: "insert", name: "Markt"}, ["Location"]).text, "Ort.\n\n<<spot \"Markt\">>\n\n");
		var q = apply("A.\n\n|", {kind: "quest", op: "insert", name: "Q"});
		assert.equal(q.text, "A.\n\n<<quest \"Q\">>");
		assert.equal(q.selStart, q.text.length);
		var s = apply("<<date>>\n\nA.\n\n|", {kind: "secret", op: "insert", names: "Bran"}, ["Event"], {date: "d1"});
		assert.equal(s.text, "<<date>>\n\nA.\n\n<$secret for=\"Bran\">\n\n\n\n</$secret>");
		assert.equal(s.selStart, "<<date>>\n\nA.\n\n<$secret for=\"Bran\">\n\n".length);
	});
});

test.describe("values with both quotes", function() {
	test("a macro parameter in [[...]], read back as written", function() {
		var r = apply("A|.", {kind: "date", op: "insert", date: "d1", label: "Ragna's \"Fest\""}, ["Event"], {});
		assert.equal(r.text, "<<date label:[[Ragna's \"Fest\"]]>>\n\nA.");
		assert.equal(probe("A|.", "date", ["Event"], {date: "d1"}).form, "");
		assert.equal(probe(r.text.replace("A.", "A|."), "date", ["Event"], {date: "d1"}).params.label, "Ragna's \"Fest\"");
	});
	test("an attribute in \"\"\"...\"\"\" unless the value ends in \"; else nothing changes and the DM is told", function() {
		assert.equal(apply("|A.|", {kind: "date", op: "insert", date: "d1", label: "It's \"x\" too"}, ["Event"], {}).text, "<$date label=\"\"\"It's \"x\" too\"\"\">\n\nA.\n\n</$date>");
		assert.deepEqual(plain(apply("|A.|", {kind: "date", op: "insert", date: "d1", label: "Ragna's \"Fest\""}, ["Event"], {})), {error: "Editor/Error/Quotes"});
	});
});

test.describe("fixes of hints on the text", function() {
	test("status and caption by position are named", function() {
		assert.equal(editor.questStatusNamed(wiki, "<<date>>\n\n<<quest \"Turm\" \"complete\">>X.\n", ["Event"], 10), "<<date>>\n\n<<quest \"Turm\" status:\"complete\">>X.\n");
		assert.equal(editor.dateLabelNamed(wiki, "<<date \"Rast\">>\n\nX.\n", ["Event"], 0), "<<date label:\"Rast\">>\n\nX.\n");
	});
	test("the text of a spot goes, the marker stays", function() {
		assert.equal(editor.spotEmptied(wiki, "T.\n\n<<spot \"Mill\">>\n\nGrinds.\n\n<<spot \"Gate\">>\n", ["Location"], 4), "T.\n\n<<spot \"Mill\">>\n\n<<spot \"Gate\">>\n");
	});
});
