/*\
title: $:/plugins/tiddlyrpg-core/filters/rules.js
type: application/javascript
module-type: filteroperator
created: 20261009181232255
modified: 20261009181232255

The rules language (modules/language.js):

[trpgruleslang[Calendar]]          the language code the domain is shown in (suffix display, the
[trpgruleslang:input[Calendar]]    default) or written in (suffix input)
[trpgruleslangs[]]                 the language codes that have keys, sorted
[trpgruleslangs[Calendar]]         those with keys of the domain (its field keys; all without it)

\*/

"use strict";

var language = require("$:/plugins/tiddlyrpg-core/modules/language.js");

exports.trpgruleslang = function(source,operator,options) {
	return [language.rulesLang(options.wiki,operator.operand,operator.suffix || "display")];
};

exports.trpgruleslangs = function(source,operator,options) {
	var domain = operator.operand && language.domains(options.wiki)[operator.operand];
	return language.languages(options.wiki,domain ? domain.keys : "");
};
