/*\
title: $:/plugins/tiddlyrpg-core/filters/currency.js
type: application/javascript
module-type: filteroperator
created: 20261010063203140
modified: 20261026092040936

The currency (modules/currency.js):

[<price>priceformat[]]          each price as written, with the unit labels of the display
                                language and the marks of its numbers ("3 gp 5 sp" -> "3 GM 5 SM",
                                "1,500 gp" -> "1.500 GM"); unchanged without currency
[<price>priceconvert<coin>]     each price in the coin, as number with the marks of the wiki
                                language ("1.200.000", "3,5"; nothing if it cannot be read); a
                                range bound by bound ("5–10")
[<price>pricecheck[]]           the problem of each price as language key (Item/Check/...)
[currency[id]]                  of the active currency (nothing without): id, title, base,
[currency[coins]]               coins (the coin ids in order), table (wikitext), reference,
[currency[reference]]           referencevalid (yes/no), and rulesreference (the coin of the
                                ruleset its prices are written in)
[<coin>currencyunit[]]          the label of each coin; currencycoin[] its name

\*/

"use strict";

var currency = require("$:/plugins/tiddlyrpg-core/modules/currency.js"),
	rules = require("$:/plugins/tiddlyrpg-core/modules/rules.js"),
	language = require("$:/plugins/tiddlyrpg-core/modules/language.js");

function each(source,fn) {
	var results = [];
	source(function(tiddler,title) {
		var value = fn(title);
		if(value !== null && value !== undefined) {
			results.push(value);
		}
	});
	return results;
}

exports.priceformat = function(source,operator,options) {
	var cur = currency.active(options.wiki);
	return each(source,function(price) {
		return currency.format(options.wiki,cur,price);
	});
};

exports.priceconvert = function(source,operator,options) {
	var wiki = options.wiki,
		cur = currency.active(wiki),
		// at most two decimals, the thousands grouped like a price ("1.200.000", "1.000,5")
		number = function(v) {
			var text = rules.formatNumber(wiki,v,2),
				mark = language.t(wiki,"Number/Decimal") === "," ? "," : ".",
				parts = text.split(mark);
			return rules.formatInteger(wiki,parts[0]) + (parts.length > 1 ? mark + parts[1] : "");
		};
	return each(source,function(price) {
		var value = cur && currency.convert(wiki,cur,price,operator.operand);
		if(value === null || value === undefined || value === false) {
			return null;
		}
		// A range bound by bound
		return $tw.utils.isArray(value) ? value.map(number).join(language.t(wiki,"Currency/Range")) : number(value);
	});
};

exports.pricecheck = function(source,operator,options) {
	var cur = currency.active(options.wiki);
	return each(source,function(price) {
		return currency.check(options.wiki,cur,price);
	});
};

exports.currency = function(source,operator,options) {
	var wiki = options.wiki,
		cur = currency.active(wiki);
	if(operator.operand === "rulesreference") {
		var ref = currency.rulesReference(wiki);
		return ref ? [ref] : [];
	}
	if(!cur) {
		return [];
	}
	switch(operator.operand) {
		case "id": return [cur.id];
		case "title": return [currency.title(wiki,cur)];
		case "base": return [cur.base];
		case "coins": return cur.coins.map(function(coin) { return coin.id; });
		case "table": return [currency.table(wiki,cur)];
		case "reference": return [cur.reference];
		case "referencevalid": return [cur.referenceValid ? "yes" : "no"];
	}
	return [];
};

exports.currencyunit = function(source,operator,options) {
	var cur = currency.active(options.wiki);
	return cur ? each(source,function(coin) { return currency.unitLabel(options.wiki,cur,coin); }) : [];
};

exports.currencycoin = function(source,operator,options) {
	var cur = currency.active(options.wiki);
	return cur ? each(source,function(coin) { return currency.coinName(options.wiki,cur,coin); }) : [];
};
