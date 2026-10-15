/*\
title: $:/plugins/tiddlyrpg-core/filters/rules.js
type: application/javascript
module-type: filteroperator
created: 20261009181232255
modified: 20261015193623000

The rules language (modules/language.js) and the rules engine (modules/rules.js):

[trpgruleslang[Calendar]]          the language code the domain is shown in
[trpgruleslangs[]]                 the language codes that have keys, sorted
[trpgruleslangs[Calendar]]         those with keys of the domain (its keys prefix; all without it)
[<value>trpgunit<kind>]            each input as <<unit>> shows it: "228 cm" -> "7 ft 7 in"
[<value>trpgdice[]]                each input with the dice tokens of the display language
[<value>trpgdamage[]]              each input as damage expression: "1d8 cold" -> "1W8 Kälteschaden"
[<id>trpgterm<variant>,<value>]    each input id as term, with a variant ("save") and/or a value (2)
[trpgrulesdomains[]]               the names of the registered rules domains, sorted; with an
[trpgrulesdomains[ruleset]]        operand only those of that group (ruleset, setting)
[<name>trpgrulesgroup[]]           the group of each input domain: ruleset or setting
[<name>trpgrulesdomain[type]]      a property of each input domain: type, keys, example; kinds
                                   gives yes or no
[<name>trpgrulesexample[]]         the example of each input domain as "input → output"
[<name>trpgrulestable[]]           the table of each input domain for the hub Ruleset (HTML)
[<name>trpgruleslabel[]]           the display name of each input domain
[<name>trpgrulessystem[]]          the unit system each input unit domain is shown in, as a label
                                   of the wiki language ("metrisch"); nothing for other domains

\*/

"use strict";

var language = require("$:/plugins/tiddlyrpg-core/modules/language.js"),
	rules = require("$:/plugins/tiddlyrpg-core/modules/rules.js");

exports.trpgruleslang = function(source,operator,options) {
	return [language.rulesLang(options.wiki,operator.operand)];
};

exports.trpgruleslangs = function(source,operator,options) {
	var domain = operator.operand && language.domains(options.wiki)[operator.operand];
	return language.languages(options.wiki,domain ? domain.keys : "");
};

function each(source,fn) {
	var results = [];
	source(function(tiddler,title) {
		results.push(fn(title));
	});
	return results;
}

exports.trpgunit = function(source,operator,options) {
	return each(source,function(value) {
		return rules.unit(options.wiki,value,operator.operand).text;
	});
};

exports.trpgdice = function(source,operator,options) {
	return each(source,function(value) {
		return rules.dice(options.wiki,value).text;
	});
};

exports.trpgdamage = function(source,operator,options) {
	return each(source,function(value) {
		return rules.damage(options.wiki,value).text;
	});
};

exports.trpgterm = function(source,operator,options) {
	return each(source,function(id) {
		var operands = operator.operands || [operator.operand];
		return rules.term(options.wiki,id,operands[0],operands[1]).text;
	});
};

exports.trpgrulesdomains = function(source,operator,options) {
	var wiki = options.wiki;
	return Object.keys(language.domains(wiki)).filter(function(name) {
		return !operator.operand || language.domainGroup(wiki,name) === operator.operand;
	}).sort();
};

exports.trpgrulesgroup = function(source,operator,options) {
	return each(source,function(name) {
		return language.domainGroup(options.wiki,name);
	});
};

exports.trpgrulesdomain = function(source,operator,options) {
	var domains = language.domains(options.wiki),
		results = [];
	source(function(tiddler,name) {
		var domain = domains[name];
		if(domain) {
			if(operator.operand === "kinds") {
				results.push(domain.kinds && Object.keys(domain.kinds).length ? "yes" : "no");
			} else if(domain[operator.operand] !== undefined && typeof domain[operator.operand] !== "object") {
				results.push(domain[operator.operand].toString());
			}
		}
	});
	return results;
};

exports.trpgrulesexample = function(source,operator,options) {
	var results = [];
	source(function(tiddler,name) {
		var example = rules.example(options.wiki,name);
		if(example) {
			results.push(example.input + " → " + example.output);
		}
	});
	return results;
};

exports.trpgrulestable = function(source,operator,options) {
	return each(source,function(name) {
		return rules.table(options.wiki,name);
	});
};

exports.trpgruleslabel = function(source,operator,options) {
	return each(source,function(name) {
		return rules.domainLabel(options.wiki,name);
	});
};

exports.trpgrulessystem = function(source,operator,options) {
	var results = [];
	source(function(tiddler,name) {
		var label = rules.systemLabel(options.wiki,name);
		if(label) {
			results.push(label);
		}
	});
	return results;
};
