/*\
title: $:/plugins/tiddlyrpg-core/modules/currency.js
type: application/javascript
module-type: library
created: 20261010063203140
modified: 20261016233000000

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

/*
The parts of a price: {plain: true} for a plain number, {amounts: [{number, coin, start, end}]}
for "<number> <unit>" sequences, {invalid: true} for anything else; an unknown unit gives
{amounts: [...], unknown: "<word>"}.
*/
var parse = exports.parse = function(wiki,cur,text) {
	text = (text || "").toString().trim();
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
};

// A price as written, with the unit labels of the display language; unchanged without currency
// or if it cannot be read
exports.format = function(wiki,cur,text) {
	text = (text || "").toString().trim();
	if(!cur) {
		return text;
	}
	var parsed = parse(wiki,cur,text);
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

// The worth of a price in the smallest coin, or null
var worth = exports.worth = function(wiki,cur,text) {
	var parsed = parse(wiki,cur,text);
	if(!cur || parsed.invalid || parsed.unknown || parsed.plain) {
		return null;
	}
	return parsed.amounts.reduce(function(sum,a) {
		return sum + parseFloat(a.number.replace(",",".")) * cur.byId[a.coin].value;
	},0);
};

// A price in another coin, as a number (at most two decimals), or null
exports.convert = function(wiki,cur,text,coin) {
	var w = worth(wiki,cur,text);
	if(w === null || !cur.byId[coin]) {
		return null;
	}
	return Math.round(w / cur.byId[coin].value * 100) / 100;
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
	if(parsed.plain) {
		return cur ? "Item/Check/PriceNoCurrency" : null;
	}
	if(cur && parsed.unknown && !parsed.invalid) {
		return "Item/Check/PriceUnit";
	}
	return parsed.invalid || parsed.unknown || !cur ? "Item/Check/PriceCurrency" : null;
};

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
