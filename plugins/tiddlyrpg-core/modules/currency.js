/*\
title: $:/plugins/tiddlyrpg-core/modules/currency.js
type: application/javascript
module-type: library
created: 20261010063203140
modified: 20261022164852090

Currency engine (backlog of prices with a unit). Knows no particular coins: the active currency
is the JSON data tiddler named in $:/config/tiddlyrpg/currency, brought by the campaign setting
(e.g. $:/tiddlyrpg/currency/ForgottenRealms) or by the wiki itself, like the calendar. Without it,
active() returns null: prices are plain numbers, as written.

Data model:
  {
    "id": "ForgottenRealms",
    "base": "gp",          // optional: the leading coin of the table, else the smallest
    "reference": "gp",     // optional: the coin that matches the price unit of the ruleset
                           // (currency-reference of $:/tiddlyrpg/rules/system), else base
    "currencies": [ {"id": "cp", "value": 1}, {"id": "sp", "value": 10}, ... ]
  }
value is the worth in the smallest coin (a whole number > 0); the order is the order of the
table.

Language keys Currency/<id>/Name, .../Unit/<coin> (the short label, "gp" / "GM"),
.../Coin/<coin> (the name, "gold piece" / "Goldmünze"), .../Unit/<coin>/Parse (more words,
comma separated) and .../Description. Names and labels are terms of the rules domain of type
currency (the setting registers it, usually "Currency") and follow its display language
(modules/language.js); without a domain tiddler they follow the mode like any domain.

A price is "25" or a sequence of "<number> <unit>" ("3 gp 5 sp"); the number may have "." or ","
as decimal mark; a unit is the id, a label or a name of any language, case-insensitive (the
id is what to write). format() shows it as written with the labels of the display language;
nothing is normalised (150 cp stays 150 cp).

A range is two prices joined by a dash or a word of Currency/Range/Parse of any language
("50-100 gp", "50 - 100 gp", "50 to 100 gp", "50 bis 100 gp", "5 sp - 2 gp"); a coin written only
after the upper bound counts for the lower one too. format() joins the bounds with
Currency/Range of the display language. check() reports a bound that cannot be read and a lower
bound above the upper one; the converter and fromRules() work bound by bound.

fromRules(wiki,value) writes a price of the ruleset - a number (or two, a range) in its coin of
reference (currency-reference of $:/tiddlyrpg/rules/system: "gp") - in the coins of the active
currency: the coin of the currency that matches it (reference), else the largest coin a power of
ten below it that gives a whole number ("0.2" -> "2 sp", never electrum), else the smallest coin;
without currency the number.

\*/

"use strict";

var language = require("$:/plugins/tiddlyrpg-core/modules/language.js");

var CONFIG = "$:/config/tiddlyrpg/currency",
	PREFIX = "$:/tiddlyrpg/language/",
	SYSTEM = "$:/tiddlyrpg/rules/system";

function escape(text) {
	return text.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
}

// Validates and normalises the raw JSON; null for unusable data
function build(data) {
	if(!data || !$tw.utils.isArray(data.currencies) || !data.currencies.length) {
		return null;
	}
	var cur = {id: (data.id || "").toString() || "Currency", coins: [], byId: Object.create(null)};
	for(var i = 0; i < data.currencies.length; i++) {
		var raw = data.currencies[i] || {},
			coin = {id: (raw.id || "").toString(), value: parseInt(raw.value,10)};
		if(!coin.id || !(coin.value > 0) || cur.byId[coin.id]) {
			return null;
		}
		cur.coins.push(coin);
		cur.byId[coin.id] = coin;
	}
	var smallest = cur.coins.slice().sort(function(a,b) { return a.value - b.value; })[0];
	cur.base = data.base && cur.byId[data.base] ? data.base : smallest.id;
	cur.reference = data.reference ? data.reference.toString() : cur.base;
	cur.referenceValid = !!cur.byId[cur.reference];
	return cur;
}

// The active currency or null; cached per data tiddler
var active = exports.active = function(wiki) {
	var title = (wiki.getTiddlerText(CONFIG,"") || "").trim();
	if(!title) {
		return null;
	}
	return wiki.getCacheForTiddler(title,"tiddlyrpg-currency",function() {
		return build(wiki.getTiddlerData(title,null));
	});
};

// The name of the rules domain of the coins: the registered domain of type currency
function domainName(wiki) {
	var domains = language.domains(wiki),
		names = Object.keys(domains).filter(function(name) { return domains[name].type === "currency"; });
	return names[0] || "Currency";
}

function term(wiki,cur,key) {
	return language.lookupRules(wiki,domainName(wiki),"Currency/" + cur.id + "/" + key);
}

exports.title = function(wiki,cur) {
	return term(wiki,cur,"Name") || cur.id;
};

var unitLabel = exports.unitLabel = function(wiki,cur,coin) {
	return term(wiki,cur,"Unit/" + coin) || coin;
};

var coinName = exports.coinName = function(wiki,cur,coin) {
	return term(wiki,cur,"Coin/" + coin) || coin;
};

// {word (lower case): coin id} of every language, with a pattern, longest words first
function words(wiki,cur) {
	return wiki.getGlobalCache("tiddlyrpg-currency-words",function() {
		var map = Object.create(null),
			codes = language.languages(wiki);
		cur.coins.forEach(function(coin) {
			var list = [coin.id];
			codes.forEach(function(code) {
				["Unit/" + coin.id,"Coin/" + coin.id,"Unit/" + coin.id + "/Parse"].forEach(function(key) {
					(wiki.getTiddlerText(PREFIX + code + "/Currency/" + cur.id + "/" + key) || "").split(",").forEach(function(word) {
						word = word.trim();
						if(word) {
							list.push(word);
						}
					});
				});
			});
			list.forEach(function(word) {
				map[word.toLowerCase()] = map[word.toLowerCase()] || coin.id;
			});
		});
		var all = Object.keys(map).sort(function(a,b) { return b.length - a.length; });
		return {map: map, pattern: all.map(escape).join("|")};
	});
}

// The words that join the bounds of a range, of every language, longest first
function rangeWords(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-currency-range",function() {
		var list = [];
		language.languages(wiki).forEach(function(code) {
			(wiki.getTiddlerText(PREFIX + code + "/Currency/Range/Parse") || "").split(",").forEach(function(word) {
				word = word.trim().toLowerCase();
				if(word && list.indexOf(word) === -1) {
					list.push(word);
				}
			});
		});
		return list.sort(function(a,b) { return b.length - a.length; });
	});
}

// The two bounds of a range as written, or null: a dash, or a word of the range between spaces
function bounds(wiki,text) {
	var words = rangeWords(wiki).map(function(word) { return "\\s" + escape(word) + "\\s"; }),
		re = new RegExp("^(.*?\\d.*?)\\s*(?:[\u2013\u2014-]|" + (words.length ? words.join("|") : "(?!)") + ")\\s*(\\d.*)$","i"),
		m = re.exec(text);
	return m ? [m[1].trim(),m[2].trim()] : null;
}

/*
The parts of a price: {plain: true} for a plain number, {amounts: [{number, coin, start, end}]}
for "<number> <unit>" sequences, {invalid: true} for anything else; an unknown unit gives
{amounts: [...], unknown: "<word>"}. A range: {range: [low, high]} - each bound parsed so, a
plain lower bound with the coin of the upper one if that has one coin (inherited: true) -, with
the amounts of both and the bounds as written (texts).
*/
var parse = exports.parse = function(wiki,cur,text) {
	text = (text || "").toString().trim();
	var two = bounds(wiki,text);
	if(two) {
		var low = parseOne(wiki,cur,two[0]),
			high = parseOne(wiki,cur,two[1]),
			inherited = false;
		if(low.plain && !high.plain && high.amounts.length === 1 && !high.invalid && !high.unknown) {
			low = {amounts: [{number: two[0], coin: high.amounts[0].coin}]};
			inherited = true;
		}
		return {range: [low,high], texts: two, inherited: inherited, amounts: low.amounts.concat(high.amounts),
			plain: !!(low.plain && high.plain), invalid: !!(low.invalid || high.invalid), unknown: low.unknown || high.unknown};
	}
	return parseOne(wiki,cur,text);
};

function parseOne(wiki,cur,text) {
	if(/^\d+(?:[.,]\d+)?$/.test(text)) {
		return {plain: true, amounts: []};
	}
	var known = cur ? words(wiki,cur) : {map: {}, pattern: ""},
		re = /(\d+(?:[.,]\d+)?)\s*([^\s\d]+)/g,
		amounts = [],
		match,
		rest = text;
	while((match = re.exec(text))) {
		var word = match[2].replace(/[.,;]+$/,""),
			coin = known.map[word.toLowerCase()];
		if(!coin) {
			return {amounts: amounts, unknown: word};
		}
		amounts.push({number: match[1], coin: coin, start: match.index + match[0].indexOf(match[2]), end: match.index + match[0].indexOf(match[2]) + word.length});
		rest = rest.replace(match[0],"");
	}
	if(!amounts.length || rest.replace(/[\s,;+]|and|und/g,"").length) {
		return {invalid: true, amounts: []};
	}
	return {amounts: amounts};
}

// A price as written, with the unit labels of the display language; unchanged without currency
// or if it cannot be read
var format = exports.format = function(wiki,cur,text) {
	text = (text || "").toString().trim();
	var parsed = parse(wiki,cur,text);
	if(parsed.range && !parsed.invalid && !parsed.unknown && (cur || parsed.plain)) {
		// "50–100 GM": a lower bound with the coin of the upper one, or two numbers, without spaces
		var joint = language.t(wiki,"Currency/Range");
		return (parsed.inherited ? parsed.texts[0] : format(wiki,cur,parsed.texts[0])) +
			(parsed.inherited || parsed.plain ? joint : " " + joint + " ") + format(wiki,cur,parsed.texts[1]);
	}
	if(!cur) {
		return text;
	}
	if(parsed.plain || parsed.invalid || parsed.unknown) {
		return text;
	}
	var out = "",
		pos = 0;
	parsed.amounts.forEach(function(a) {
		out += text.slice(pos,a.start) + unitLabel(wiki,cur,a.coin);
		pos = a.end;
	});
	return out + text.slice(pos);
};

function total(cur,parsed) {
	return parsed.amounts.reduce(function(sum,a) {
		return sum + parseFloat(a.number.replace(",",".")) * cur.byId[a.coin].value;
	},0);
}

// The worth of a price in the smallest coin, or null; a range: [low, high]
var worth = exports.worth = function(wiki,cur,text) {
	var parsed = parse(wiki,cur,text);
	if(!cur || parsed.invalid || parsed.unknown || parsed.plain) {
		return null;
	}
	return parsed.range ? [total(cur,parsed.range[0]),total(cur,parsed.range[1])] : total(cur,parsed);
};

// A price in another coin, as a number (at most two decimals), or null; a range: [low, high]
exports.convert = function(wiki,cur,text,coin) {
	var w = worth(wiki,cur,text);
	if(w === null || !cur.byId[coin]) {
		return null;
	}
	var one = function(value) {
		return Math.round(value / cur.byId[coin].value * 100) / 100;
	};
	return $tw.utils.isArray(w) ? w.map(one) : one(w);
};

// A price of the ruleset (a number in its coin of reference, or [low, high]) in the coins of the
// active currency, as text to write into price (see the header)
var fromRules = exports.fromRules = function(wiki,value) {
	var cur = active(wiki),
		plain = function(n) { return String(Math.round(n * 100) / 100); };
	if($tw.utils.isArray(value)) {
		return fromRules(wiki,value[0]) + " - " + fromRules(wiki,value[1]);
	}
	if(!cur || !cur.referenceValid) {
		return plain(value);
	}
	var reference = cur.byId[cur.reference].value,
		amount = value * reference,
		whole = function(n) { return Math.abs(n - Math.round(n)) < 1e-9; },
		// The coin of reference and the smaller ones a power of ten below it (sp, cp below gp - not
		// electrum, nobody writes 5 sp as 1 ep), largest first
		tens = function(coin) {
			for(var ratio = reference / coin.value; ratio >= 10 && whole(ratio); ratio /= 10) {}
			return Math.abs(ratio - 1) < 1e-9;
		},
		coins = cur.coins.filter(function(coin) { return coin.value <= reference && tens(coin); }).sort(function(a,b) { return b.value - a.value; }),
		smallest = cur.coins.slice().sort(function(a,b) { return a.value - b.value; })[0];
	for(var i = 0; i < coins.length; i++) {
		if(whole(amount / coins[i].value)) {
			return Math.round(amount / coins[i].value) + " " + coins[i].id;
		}
	}
	return plain(amount / smallest.value) + " " + smallest.id;
};

/*
The problem of a price as language key, or null:
  - Item/Check/PriceNoCurrency: a currency is active and the price has no unit
  - Item/Check/PriceUnit: a unit the currency does not have
  - Item/Check/PriceCurrency: a unit without currency, or a text that cannot be read
Without currency a plain number is right.
*/
exports.check = function(wiki,cur,text) {
	text = (text || "").toString().trim();
	if(!text) {
		return null;
	}
	var parsed = parse(wiki,cur,text);
	if(parsed.range) {
		// Each bound by itself (a lower one with the coin of the upper one as written so), then
		// the order
		var problem = (parsed.inherited ? null : checkOne(cur,parsed.range[0])) || checkOne(cur,parsed.range[1]);
		if(problem) {
			return problem;
		}
		var w = cur ? worth(wiki,cur,text) : parsed.texts.map(function(t) { return parseFloat(t.replace(",",".")); });
		return w && w[0] > w[1] ? "Item/Check/PriceRange" : null;
	}
	return checkOne(cur,parsed);
};

function checkOne(cur,parsed) {
	if(parsed.plain) {
		return cur ? "Item/Check/PriceNoCurrency" : null;
	}
	if(cur && parsed.unknown && !parsed.invalid) {
		return "Item/Check/PriceUnit";
	}
	return parsed.invalid || parsed.unknown || !cur ? "Item/Check/PriceCurrency" : null;
}

// The coin of the ruleset its prices are written in (currency-reference), or ""
exports.rulesReference = function(wiki) {
	var tiddler = wiki.getTiddler(SYSTEM);
	return tiddler && tiddler.fields["currency-reference"] ? tiddler.fields["currency-reference"].trim() : "";
};

// Wikitext table for the hub: name | unit | worth in the leading coin, with a header row in the
// wiki language
exports.table = function(wiki,cur) {
	var base = cur.byId[cur.base],
		lines = ["|!" + language.t(wiki,"Currency/Coin") + " |!" + language.t(wiki,"Currency/Unit") + " |!" + language.t(wiki,"Currency/Worth") + " |"];
	cur.coins.forEach(function(coin) {
		var inBase = Math.round(coin.value / base.value * 10000) / 10000;
		lines.push("|" + coinName(wiki,cur,coin.id) + " |" + unitLabel(wiki,cur,coin.id) + " |" +
			require("$:/plugins/tiddlyrpg-core/modules/rules.js").formatNumber(wiki,inBase,4) + " " + unitLabel(wiki,cur,cur.base) + " |");
	});
	return lines.join("\n");
};
