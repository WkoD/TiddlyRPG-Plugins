/*\
title: $:/plugins/tiddlyrpg-core/filters/macros-check.js
type: application/javascript
module-type: filteroperator
created: 20261010065649000
modified: 20261010065649000

[<title>macrocheck[]]    the hints on unknown macros in the body of each input tiddler (texts in
                         the wiki language, modules/macros-check.js)

\*/

"use strict";

var macros = require("$:/plugins/tiddlyrpg-core/modules/macros-check.js");

exports.macrocheck = function(source,operator,options) {
	var results = [];
	source(function(tiddler,title) {
		$tw.utils.pushTop(results,macros.check(options.wiki,title));
	});
	return results;
};
