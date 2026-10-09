/*
 * Domains of type tokens (modules/rules.js, <<dice>>) against fixture-ruleset-5e-mini (Dice: the
 * die token "d" / "W"): the token only inside NdM, text in between kept, tokens of every language
 * read, the display language of the domain.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki;

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
	});
});

function d(value) {
	return h.filter(wiki, "[<v>trpgdice[]]", {v: value}).join();
}

test.describe("de-DE", function() {
	test.before(function() {
		h.setLanguage(wiki, "de-DE");
	});

	test("the die token of the display language", function() {
		assert.equal(d("4d6"), "4W6");
		assert.equal(d("1d20 + 5"), "1W20 + 5");
		assert.equal(d("d8"), "W8");
	});

	test("only the token inside NdM changes, the text around stays", function() {
		assert.equal(d("1d6 at level 6 (4d6), and 2d6 more"), "1W6 at level 6 (4W6), and 2W6 more");
		assert.equal(d("Wand and dagger"), "Wand and dagger");
	});

	test("the token of every language is read, also in upper case", function() {
		assert.equal(d("1W8"), "1W8");
		assert.equal(d("2D10"), "2W10");
	});
});

test.describe("en-GB and the rules language", function() {
	test.before(function() {
		h.setLanguage(wiki, "en-GB");
	});

	test("en-GB shows d", function() {
		assert.equal(d("1W8 + 2"), "1d8 + 2");
	});

	test("the display language of the domain, not of the wiki", function() {
		h.add(wiki, {title: "$:/config/tiddlyrpg/rules/display/mode", text: "domain"});
		h.add(wiki, {title: "$:/config/tiddlyrpg/rules/display/domain/Dice", text: "de-DE"});
		try {
			assert.equal(d("4d6"), "4W6");
		} finally {
			wiki.deleteTiddler("$:/config/tiddlyrpg/rules/display/mode");
			wiki.deleteTiddler("$:/config/tiddlyrpg/rules/display/domain/Dice");
		}
	});
});
