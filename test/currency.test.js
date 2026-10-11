/*
 * The currency engine (modules/currency.js, filters/currency.js) against the fixture settings:
 * fixture-setting-harptos (coins in the style of Faerûn, gp) and fixture-setting-krynn (steel as
 * the leading coin, as in Dragonlance) - parse, format in the display language, convert, check,
 * base and reference; without currency (setting none); a currency without ruleset; <<unit>> with
 * coins; a reference that is no coin. The hub: currency-hub.test.js.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki, currency;

var SETTING = "$:/config/tiddlyrpg/setting",
	RULESET = "$:/config/tiddlyrpg/ruleset";

function settle() {
	return new Promise(function(resolve) {
		setTimeout(resolve, 0);
	});
}

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		currency = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/currency.js");
		h.setLanguage(wiki, "de-DE");
	});
});

function f(text, variables) {
	return h.filter(wiki, text, variables).join(" ");
}

function price(value) {
	return f("[<p>priceformat[]]", {p: value});
}

// Sets tiddlers, waits for the switch, runs fn, restores
function withTiddlers(values, fn) {
	var before = {};
	Object.keys(values).forEach(function(title) {
		before[title] = wiki.getTiddler(title);
		h.add(wiki, {title: title, text: values[title]});
	});
	var restore = function() {
		Object.keys(values).forEach(function(title) {
			if(before[title]) {
				wiki.addTiddler(before[title]);
			} else {
				wiki.deleteTiddler(title);
			}
		});
		return settle();
	};
	return settle().then(fn).then(restore, function(error) {
		return restore().then(function() { throw error; });
	});
}

test.describe("coins in the style of Faerûn", function() {
	test("the active currency, its base and reference", function() {
		assert.equal(f("[currency[id]]"), "Faerun");
		assert.equal(f("[currency[base]]"), "gp");
		assert.equal(f("[currency[reference]]"), "gp");
		assert.equal(f("[currency[coins]]"), "cp sp ep gp pp");
	});

	test("a price as written, with the labels of the display language", function() {
		assert.equal(price("3 gp 5 sp"), "3 GM 5 SM");
		assert.equal(price("50 gp"), "50 GM");
		assert.equal(price("150 cp"), "150 KM", "not normalised");
	});

	test("units of every language and the written names are read", function() {
		assert.equal(price("50 GM"), "50 GM");
		assert.equal(price("2 Gold"), "2 GM");
		assert.equal(price("1,5 gp"), "1,5 GM");
	});

	test("the display language of the domain Currency", function() {
		h.add(wiki, {title: "$:/config/tiddlyrpg/rules/setting/display/mode", text: "domain"});
		h.add(wiki, {title: "$:/config/tiddlyrpg/rules/setting/display/domain/Currency", text: "en-GB"});
		try {
			assert.equal(price("3 GM 5 SM"), "3 gp 5 sp");
		} finally {
			wiki.deleteTiddler("$:/config/tiddlyrpg/rules/setting/display/mode");
			wiki.deleteTiddler("$:/config/tiddlyrpg/rules/setting/display/domain/Currency");
		}
	});

	test("convert", function() {
		assert.equal(f("[<p>priceconvert[sp]]", {p: "3 gp 5 sp"}), "35");
		assert.equal(f("[<p>priceconvert[gp]]", {p: "3 gp 5 sp"}), "3,5");
		assert.equal(f("[<p>priceconvert[cp]]", {p: "1 pp"}), "1000");
		assert.equal(f("[<p>priceconvert[sp]]", {p: "1 ep"}), "5");
		assert.equal(f("[<p>priceconvert[sp]]", {p: "50 xp"}), "", "unreadable");
	});

	test("check: with a currency a price needs a coin of it", function() {
		assert.equal(f("[<p>pricecheck[]]", {p: "50"}), "Item/Check/PriceNoCurrency");
		assert.equal(f("[<p>pricecheck[]]", {p: "50 xp"}), "Item/Check/PriceCurrency");
		assert.equal(f("[<p>pricecheck[]]", {p: "fifty"}), "Item/Check/PriceCurrency");
		assert.equal(f("[<p>pricecheck[]]", {p: "50 gp"}), "");
		assert.equal(f("[<p>pricecheck[]]", {p: "3 gp 5 sp"}), "");
	});

	test("unreadable prices show unchanged", function() {
		assert.equal(price("50 xp"), "50 xp");
		assert.equal(price("50"), "50");
	});
});

test.describe("<<unit>> with coins", function() {
	test("coins when no length or weight is written", function() {
		assert.equal(f("[<v>trpgunit[]]", {v: "3 gp 5 sp"}), "3 GM 5 SM");
	});

	test("km is a length, not copper pieces", function() {
		assert.equal(f("[<v>trpgunit[]]", {v: "5 km"}), "5 km");
		h.setLanguage(wiki, "en-GB");
		try {
			assert.equal(f("[<v>trpgunit[]]", {v: "5 km"}), "3.1 mi");
		} finally {
			h.setLanguage(wiki, "de-DE");
		}
	});
});

test.describe("other settings", function() {
	test("without setting: no currency, a plain number is right, a coin is a hint", function() {
		return withTiddlers({[SETTING]: "none"}, function() {
			assert.equal(f("[currency[id]]"), "");
			assert.equal(price("3 gp 5 sp"), "3 gp 5 sp");
			assert.equal(f("[<p>pricecheck[]]", {p: "50"}), "");
			assert.equal(f("[<p>pricecheck[]]", {p: "50 gp"}), "Item/Check/PriceCurrency");
		});
	});

	test("a setting without ruleset still has its currency", function() {
		return withTiddlers({[RULESET]: "none"}, function() {
			assert.equal(price("3 gp 5 sp"), "3 GM 5 SM");
			assert.equal(f("[<v>trpgunit[]]", {v: "3 gp 5 sp"}), "3 GM 5 SM");
		});
	});

	test("another setting with other coins (steel as in Dragonlance) runs without code change", function() {
		return withTiddlers({[SETTING]: "$:/plugins/fixture-setting-krynn"}, function() {
			assert.equal(f("[currency[id]]"), "Krynn");
			assert.equal(f("[currency[reference]]"), "stl");
			assert.equal(price("2 stl 5 sp"), "2 St 5 SM");
			assert.equal(f("[<p>priceconvert[gp]]", {p: "2 stl 5 sp"}), "5");
			assert.equal(f("[<p>pricecheck[]]", {p: "50 ep"}), "Item/Check/PriceCurrency", "no electrum on Krynn");
		});
	});
});

test.describe("the data of a currency", function() {
	function withData(data, fn) {
		return withTiddlers({"$:/config/tiddlyrpg/currency": "Own Coins"}, function() {
			h.add(wiki, {title: "Own Coins", type: "application/json", text: JSON.stringify(data)});
			try {
				return fn(currency.active(wiki));
			} finally {
				wiki.deleteTiddler("Own Coins");
			}
		});
	}

	test("without base and reference: the smallest coin", function() {
		return withData({id: "Own", currencies: [{id: "b", value: 10}, {id: "a", value: 1}]}, function(cur) {
			assert.equal(cur.base, "a");
			assert.equal(cur.reference, "a");
			assert.equal(cur.referenceValid, true);
		});
	});

	test("a reference that is no coin of the currency", function() {
		return withData({id: "Own", base: "b", reference: "gp", currencies: [{id: "a", value: 1}, {id: "b", value: 10}]}, function(cur) {
			assert.equal(cur.reference, "gp");
			assert.equal(cur.referenceValid, false);
		});
	});

	test("unusable data: no currency", function() {
		return withData({id: "Own", currencies: [{id: "a", value: 0}]}, function(cur) {
			assert.equal(cur, null);
		});
	});
});
