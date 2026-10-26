/*
 * Formulas of the rules (modules/formula.js): the value of <<term>> and the text of <<dice>> that
 * holds more than dice, against fixture-ruleset-5e-mini - each piece in the rules language, an
 * operator with its spaces, "*" and "x" as "×", the decimal comma, a term with its variant and its
 * link to the glossary, a name of a section or table heading with its jump mark, one dotted span;
 * an unknown word or a bracket not closed as a problem below the title; dice alone as before.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki, rules;

var FIXTURES = [
	{title: "Herausforderung", tags: "Information Glossary", term: "cr", text: "How strong a creature is."},
	{title: "Barbar", tags: "Information Class", text: "|!Level |!Rage Damage |\n|1st |+2 |\n\n<<effect \"Rage\">> In battle you rage."},
	{title: "Seelenbeutel", tags: "Item", text: "<<effect \"Seelenfang\">> A check against <<term dc value:\"10 + cr\">> of the creature."}
];

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		rules = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/rules.js");
		FIXTURES.forEach(function(fields) { h.add(wiki, fields); });
	});
});

function term(id, variant, value) {
	return rules.term(wiki, id, variant, value);
}

function dice(text) {
	return rules.diceText(wiki, text);
}

function html(text) {
	return h.render(wiki, "text/html", text);
}

test.describe("de-DE", function() {
	test.before(function() {
		h.setLanguage(wiki, "de-DE");
	});

	test("a value that is a formula: every piece in the rules language", function() {
		assert.equal(term("dc", "", "10 + cr").text, "SG 10 + HG");
		assert.equal(term("dc", "", "8+str:mod+pb").text, "SG 8 + STR-Modifikator + ÜB");
		assert.equal(dice("1d8 * cr").text, "1W8 × HG");
		assert.equal(dice("1/4 str:score").text, "1/4 Stärkewert");
	});

	test("a number with the decimal mark of the wiki language; a comma is no list and no thousands separator", function() {
		assert.equal(dice("1,5 * pb").text, "1,5 × ÜB");
		assert.equal(dice("1.5 * pb").text, "1,5 × ÜB");
		var list = dice("8, pb");
		assert.equal(list.problem, "Rules/Check/Formula", "a comma between values is no list");
		assert.equal(dice("1,320 * pb").text, "1,320 × ÜB", "no thousands separator: a decimal comma");
	});
});

test.describe("en-GB", function() {
	test.before(function() {
		h.setLanguage(wiki, "en-GB");
	});

	test("operators: one space on each side between two values, none after a sign, none inside brackets", function() {
		assert.equal(dice("(1/4 str:score+pb)/2").text, "(1/4 STR score + PB) / 2");
		assert.equal(dice("-1 + pb").text, "-1 + PB");
		assert.equal(dice("1d8 x cr").text, "1d8 × CR");
		assert.equal(dice("2 × pb ÷ 2").text, "2 × PB ÷ 2");
		assert.equal(term("dc", "", "8 + (pb)").text, "DC 8 + (PB)");
	});

	test("dice alone, with numbers, + and -: as before, no formula", function() {
		assert.equal(dice("1d4+1").text, "1d4+1");
		assert.equal(dice("2d6 + 3").text, "2d6 + 3");
		assert.deepEqual(Array.from(dice("1d4+1").parts, function(p) { return Object.assign({}, p); }), [{text: "1d4+1"}]);
		assert.equal(term("dc", "", "15").text, "DC 15");
		assert.equal(term("spell-slot", "level", "3").text, "spell slot of 3rd level");
	});

	test("parts: a term links to its entry of the glossary, a name to its target with the jump mark", function() {
		assert.deepEqual(Array.from(term("dc", "", "10 + cr").parts, function(p) { return Object.assign({}, p); }), [
			{text: "DC 10 + "}, {text: "CR", to: "Herausforderung", anchor: ""}
		]);
		assert.deepEqual(Array.from(dice("1d4 + 'Rage Damage|Barbar'").parts, function(p) { return Object.assign({}, p); }), [
			{text: "1d4 + "}, {text: "Rage Damage", to: "Barbar", anchor: "column-rage-damage"}
		]);
		assert.deepEqual(Array.from(dice("pb + 'Rage|Barbar'").parts, function(p) { return Object.assign({}, p); }), [
			{text: "PB + "}, {text: "Rage", to: "Barbar", anchor: "effect-rage"}
		]);
	});

	test("rendered: one dotted span, the links inside, the jump around a link with a mark", function() {
		var out = html("<<term dc value:\"10 + 'Rage Damage|Barbar'\">>");
		assert.match(out, /^<p><span class="trpg-rule">DC 10 \+ <a [^>]*href="#Barbar"[^>]*>Rage Damage<\/a><\/span><\/p>$/, out);
		assert.equal((out.match(/class="trpg-rule"/g) || []).length, 1, "one span");
		var linked = html("<<dice \"1d8 * cr\">>");
		assert.match(linked, /<span class="trpg-rule">1d8 × <a [^>]*href="#Herausforderung"[^>]*>CR<\/a><\/span>/);
	});

	test("what is not understood: shown as written, a problem below the title", function() {
		var unknown = dice("10 + Rage Damage");
		assert.equal(unknown.problem, "Rules/Check/Formula");
		assert.equal(unknown.values.text, "Rage");
		assert.equal(unknown.text, "10 + Rage Damage");
		assert.equal(dice("(10 + pb").problem, "Rules/Check/FormulaSyntax");
		assert.equal(dice("10 + pb)").problem, "Rules/Check/FormulaSyntax");
		assert.equal(term("dc", "", "10 + str:nope").problem, "Rules/Check/Variant");
		assert.equal(term("dc", "", "10 + 'Nothing'").problem, "Rules/Check/Name");
		assert.equal(dice("1d4 + 'Rage Damage").problem, "Rules/Check/Formula", "a quote not closed");
	});

	test("<<damage>>: the calculation of a part may be a formula; damage words stay damage words", function() {
		var damage = function(text) { return rules.damage(wiki, text); };
		var plain = damage("1d8 cold");
		assert.deepEqual(Array.from(plain.parts, function(p) { return Object.assign({}, p); }), [{text: plain.text}], "no formula: as before");
		var rage = damage("1d6 + 'Rage Damage|Barbar' cold");
		assert.equal(rage.problem, null);
		assert.equal(rage.text, "1d6 + Rage Damage " + damage("cold").text);
		assert.deepEqual(Array.from(rage.parts, function(p) { return Object.assign({}, p); })[1], {text: "Rage Damage", to: "Barbar", anchor: "column-rage-damage"});
		assert.equal(damage("1d4 + pb fire").text, "1d4 + PB " + damage("fire").text);
		assert.equal(damage("(1d6 + pb) * 2 fire").text, "(1d6 + PB) × 2 " + damage("fire").text);
		var two = damage("1d6 + pb cold plus 1d4 fire");
		assert.ok(h.inOrder(two.text, ["1d6 + PB", damage("cold").text, "1d4", damage("fire").text]), two.text);
		assert.equal(damage("1d6 + Rage Damage cold").problem, "Rules/Check/Damage", "a word that is no term and no damage word");
		assert.equal(damage("1d6 + 'Nothing' cold").problem, "Rules/Check/Name");
		assert.equal(damage("2d6 + 3 fire").text, damage("2d6+3 fire").text.replace("2d6+3", "2d6 + 3"), "a plain calculation as before");
		var out = html("<<damage \"1d6 + 'Rage Damage|Barbar' cold\">>");
		assert.match(out, /<span class="trpg-rule">1d6 \+ <a [^>]*href="#Barbar"[^>]*>Rage Damage<\/a> [^<]+<\/span>/, out);
	});

	test("checks: the messages of the rule macros/rules, none for a formula that reads", function() {
		h.add(wiki, {title: "Probe Formel", tags: "Item", text: "<<term dc value:\"10 + rage\">> and <<dice \"1d4 + (pb\">> and <<term dc value:\"10 + cr\">>"});
		try {
			assert.deepEqual(h.checkKeys(wiki, "Probe Formel", "macros"), ["Rules/Check/Formula", "Rules/Check/FormulaSyntax"]);
			assert.deepEqual(h.checkKeys(wiki, "Seelenbeutel", "macros"), []);
		} finally {
			wiki.deleteTiddler("Probe Formel");
		}
	});

	test("the rules language: a change shows the formula anew", function() {
		var text = "<$transclude $tiddler=\"Seelenbeutel\" mode=\"block\"/>";
		assert.match(html(text), /DC 10 \+ /);
		h.setLanguage(wiki, "de-DE");
		try {
			assert.match(html(text), /SG 10 \+ /);
		} finally {
			h.setLanguage(wiki, "en-GB");
		}
	});
});
