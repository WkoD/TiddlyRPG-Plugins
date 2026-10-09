/*\
title: $:/plugins/tiddlyrpg-core/filters/rules.js
type: application/javascript
module-type: filteroperator
created: 20261009181232255
modified: 20261009183000000

The rules language (modules/language.js) and the rules engine (modules/rules.js):

[trpgruleslang[Calendar]]          the language code the domain is shown in (suffix display, the
[trpgruleslang:input[Calendar]]    default) or written in (suffix input)
[trpgruleslangs[]]                 the language codes that have keys, sorted
[trpgruleslangs[Calendar]]         those with keys of the domain (its keys prefix; all without it)
[<value>trpgunit<kind>]            each input as <<unit>> shows it: "228 cm" -> "7 ft 7 in"
[<value>trpgdice[]]                each input with the dice tokens of the display language
[<value>trpgdamage[]]              each input as damage expression: "1d8 cold" -> "1W8 Kälteschaden"
[<id>trpgterm<arg>]                each input id as term, with a variant or value
[<title>trpgrulecheck[]]           the problems of the rules macros in the body of each input
                                   tiddler (texts in the wiki language)

\*/

"use strict";

var language = require("$:/plugins/tiddlyrpg-core/modules/language.js"),
	rules = require("$:/plugins/tiddlyrpg-core/modules/rules.js");

exports.trpgruleslang = function(source,operator,options) {
	return [language.rulesLang(options.wiki,operator.operand,operator.suffix || "display")];
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
		return rules.term(options.wiki,id,operator.operand).text;
	});
};

exports.trpgrulecheck = function(source,operator,options) {
	var results = [];
	source(function(tiddler,title) {
		$tw.utils.pushTop(results,rules.check(options.wiki,title));
	});
	return results;
};
