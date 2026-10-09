/*\
title: multitag.js
type: application/javascript
module-type: filteroperator

Filter operator for checking for the presence of a tag

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

/*
Export our filter function
*/
exports.multitag = function(source,operator,options) {
	// Input tiddlers with at least one of the tags (comma separated), grouped in tag order,
	// each group sorted by the list of its tag, each tiddler only once
	var results = [];
	var seen = Object.create(null);
	var tags = operator.operand.split(",");

	for (var i = 0; i < tags.length; ++i) {
		// Returns empty results if operator.operand is missing
		var tagged = Object.create(null);
		var group = [];
		options.wiki.getTiddlersWithTag(tags[i]).forEach(function(title) {
			tagged[title] = true;
		});
		source(function(tiddler,title) {
			if(tagged[title] && !seen[title]) {
				seen[title] = true;
				group.push(title);
			}
		});
		results = results.concat(options.wiki.sortByList(group,tags[i]));
	}
	return results;
};

})();