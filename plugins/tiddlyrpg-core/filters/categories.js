/*\
title: $:/plugins/tiddlyrpg-core/filters/categories.js
type: application/javascript
module-type: filteroperator
created: 20261024152302984
modified: 20261025124110539

The categories of the base types (modules/categories.js):

[trpgcategories[]]             every category, sorted by title
[trpgcategories<base>]         the categories of the base type <base>
[<t>trpgcategorybases[]]       the base types of each input category; nothing for a title that is
                               no category
[<id>trpgglossary[]]           the entry of the glossary that explains the term <id> and the view
                               sees (modules/glossary.js term)
[<name>trpgnamed[]]            the tiddler or package entry of a category with a text of its own
                               titled <name>, the target of the name of a section (glossary named)

\*/

"use strict";

var categories = require("$:/plugins/tiddlyrpg-core/modules/categories.js"),
	glossary = require("$:/plugins/tiddlyrpg-core/modules/glossary.js"),
	visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js");

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

exports.trpgglossary = function(source,operator,options) {
	var view = visibility.current(options.wiki),
		results = [];
	source(function(tiddler,title) {
		var target = glossary.term(options.wiki,title,view);
		if(target) {
			results.push(target);
		}
	});
	return results;
};

exports.trpgnamed = function(source,operator,options) {
	var view = visibility.current(options.wiki),
		results = [];
	source(function(tiddler,title) {
		var target = glossary.named(options.wiki,title,view);
		if(target) {
			results.push(target);
		}
	});
	return results;
};
