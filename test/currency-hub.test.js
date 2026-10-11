/*
 * The hub "Currency" (Currency.tid): in the list of Information only with a currency; the
 * description, the converter, the table of the coins in the wiki language with the labels of the
 * display language; the coin that matches the prices of the ruleset, and the hint when the
 * currency does not have it.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki;

function settle() {
	return new Promise(function(resolve) {
		setTimeout(resolve, 0);
	});
}

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		h.setLanguage(wiki, "de-DE");
	});
});

function hub() {
	return h.render(wiki, "text/html", "{{Currency}}").replace(/>\s+</g, "><").replace(/ (align|class)="[^"]*"/g, "");
}

test("in the list of Information, with its translated name", function() {
	assert.match(h.body(wiki, "Information"), /Währung/);
});

test("not listed and empty without currency", function() {
	h.add(wiki, {title: "$:/config/tiddlyrpg/setting", text: "none"});
	return settle().then(function() {
		assert.doesNotMatch(h.body(wiki, "Information"), /Währung/);
		assert.equal(h.render(wiki, "text/plain", "{{Currency}}").trim(), "");
	}).finally(function() {
		wiki.deleteTiddler("$:/config/tiddlyrpg/setting");
		return settle();
	});
});

test("description and table: name, short label, worth in the leading coin", function() {
	var html = hub();
	assert.match(html, /Die Münzen der Schwertküste/);
	assert.match(html, /<td>Goldmünze<\/td><td>GM<\/td><td>1 GM<\/td>/);
	assert.match(html, /<td>Kupfermünze<\/td><td>KM<\/td><td>0,01 GM<\/td>/);
	assert.match(html, /<td>Platinmünze<\/td><td>PM<\/td><td>10 GM<\/td>/);
	assert.match(html, /<th>Münze<\/th><th>Kürzel<\/th><th>Wert<\/th>/);
});

test("the converter: one row per coin", function() {
	h.add(wiki, {title: "$:/temp/tiddlyrpg/currency", amount: "3 gp 5 sp"});
	try {
		var html = hub();
		assert.match(html, /<th>Silbermünze<\/th><td>35<\/td>/);
		assert.match(html, /<th>Goldmünze<\/th><td>3,5<\/td>/);
	} finally {
		wiki.deleteTiddler("$:/temp/tiddlyrpg/currency");
	}
});

test("the coin that matches the prices of the ruleset", function() {
	assert.match(hub(), /Preise des Regelwerks in GM sind hier Preise in GM\./);
});

test("a reference that is no coin of the currency: a hint", function() {
	var title = "$:/tiddlyrpg/currency/Faerun",
		before = wiki.getTiddler(title),
		data = JSON.parse(before.fields.text);
	data.reference = "stl";
	h.add(wiki, {title: title, type: "application/json", text: JSON.stringify(data)});
	try {
		assert.match(hub(), /Das Geldsystem nennt stl als Münze, die den Preisen des Regelwerks entspricht, hat aber keine solche Münze\./);
	} finally {
		wiki.deleteTiddler(title);
	}
});

test("the converter keeps its input while typing: the field is not rendered anew", function() {
	var result = h.typeInto(wiki, "Currency", {title: "$:/temp/tiddlyrpg/currency", amount: "3 gp"});
	assert.ok(result.kept, "the same input field after a change of the amount");
	assert.match(result.text, /30/, "the result follows");
});
