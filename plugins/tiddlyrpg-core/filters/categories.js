/*\
title: $:/plugins/tiddlyrpg-core/filters/categories.js
type: application/javascript
module-type: filteroperator
created: 20261024152302984
modified: 20261024152302984

The categories of the base types (modules/categories.js):

[trpgcategories[]]             every category, sorted by title
[trpgcategories<base>]         the categories of the base type <base>
[<t>trpgcategorybases[]]       the base types of each input category; nothing for a title that is
                               no category

\*/

"use strict";

var categories = require("$:/plugins/tiddlyrpg-core/modules/categories.js");

exports.trpgcategories = function(source,operator,options) {
	return operator.operand ? categories.of(options.wiki,operator.operand) : categories.list(options.wiki).slice();
};

exports.trpgcategorybases = function(source,operator,options) {
	var results = [];
	source(function(tiddler,title) {
		$tw.utils.each(categories.basesOf(options.wiki,title),function(base) {
			if(results.indexOf(base) === -1) {
				results.push(base);
			}
		});
	});
	return results;
};
