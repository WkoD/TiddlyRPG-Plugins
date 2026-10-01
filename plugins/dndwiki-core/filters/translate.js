/*\
title: $:/plugins/dndwiki-core/filters/translate.js
type: application/javascript
module-type: filteroperator
created: 20261001095424000
modified: 20261001095424000

Filter operators for the language system (see modules/language.js):

[<key>dndtranslate[]]          translation of each input key (falls back to the key)
[<title>dndtitle[]]            display name of each input title
[<titles>dndtitlesearch<text>] input titles whose display name contains the text (ignores case)

\*/

"use strict";

var language = require("$:/plugins/dndwiki-core/modules/language.js");

exports.dndtranslate = function(source,operator,options) {
	var results = [];
	source(function(tiddler,title) {
		results.push(language.t(options.wiki,title));
	});
	return results;
};

exports.dndtitle = function(source,operator,options) {
	var results = [];
	source(function(tiddler,title) {
		results.push(language.title(options.wiki,title));
	});
	return results;
};

exports.dndtitlesearch = function(source,operator,options) {
	var needle = (operator.operand || "").toLowerCase(),
		results = [];
	if(!needle) {
		return results;
	}
	source(function(tiddler,title) {
		if(language.title(options.wiki,title).toLowerCase().indexOf(needle) !== -1) {
			results.push(title);
		}
	});
	return results;
};
