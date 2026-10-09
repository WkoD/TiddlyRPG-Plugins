/*\
title: $:/plugins/tiddlyrpg-core/filters/sections.js
type: application/javascript
module-type: filteroperator
created: 20261007170000000
modified: 20261008170702467

Filter operators on the sections of a body (modules/sections.js):

[<titles>hassections[]]         the input titles whose body has a section, a lock or a problem
                                of them - their body is rendered by trpg-body
[<title>sectioncheck[]]         the problems of the sections of <title>, as translated texts
[<titles>trpgsearch<text>]       the input titles the active view sees that hold every word of
                                <text> in their title, tags or text - the text without the
                                sections the view does not see
[<title>sectionbacklinks[]]     the backlinks of <title> the view sees: tiddlers it sees with a
                                link to <title> in a section it sees
[<title>visiblelinks[]]         the links of <title> the view sees: like links[], without those
                                that stand only in sections it does not see (the edge type
                                links of the graph)

\*/

"use strict";

var sections = require("$:/plugins/tiddlyrpg-core/modules/sections.js"),
	visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js");

exports.hassections = function(source,operator,options) {
	var results = [];
	source(function(tiddler,title) {
		if(tiddler && /<<|<\$/.test(tiddler.fields.text || "")) {
			var model = sections.read(options.wiki,title);
			if(model.records.length || model.errors.length) {
				results.push(title);
			}
		}
	});
	return results;
};

exports.sectioncheck = function(source,operator,options) {
	var results = [];
	source(function(tiddler,title) {
		$tw.utils.each(sections.check(options.wiki,title),function(text) {
			results.push(text);
		});
	});
	return results;
};

exports.sectionbacklinks = function(source,operator,options) {
	var wiki = options.wiki,
		view = visibility.current(wiki),
		results = [];
	source(function(tiddler,title) {
		$tw.utils.each(wiki.getTiddlerBacklinks(title),function(from) {
			if(results.indexOf(from) !== -1 || !visibility.visible(wiki,from,view)) {
				return;
			}
			var links = sections.read(wiki,from).links.filter(function(link) { return link.to === title; });
			if(!links.length || links.some(function(link) { return sections.visible(wiki,from,link.section,view); })) {
				results.push(from);
			}
		});
	});
	return results;
};

exports.visiblelinks = function(source,operator,options) {
	var wiki = options.wiki,
		view = visibility.current(wiki),
		results = [];
	source(function(tiddler,title) {
		$tw.utils.each(sections.read(wiki,title).links,function(link) {
			if(results.indexOf(link.to) === -1 && sections.visible(wiki,title,link.section,view)) {
				results.push(link.to);
			}
		});
	});
	return results;
};

exports.trpgsearch = function(source,operator,options) {
	var wiki = options.wiki,
		view = visibility.current(wiki),
		words = (operator.operand || "").toLowerCase().split(/\s+/).filter(function(word) { return !!word; }),
		results = [];
	if(!words.length) {
		return results;
	}
	source(function(tiddler,title) {
		if(!tiddler || !visibility.visible(wiki,title,view)) {
			return;
		}
		var text = tiddler.fields.text || "",
			ranges = sections.hiddenRanges(wiki,title,view).sort(function(a,b) { return a[0] - b[0]; }),
			merged = [];
		// Nested ranges merged, then cut from the end, so the earlier positions stay valid
		$tw.utils.each(ranges,function(range) {
			var last = merged[merged.length - 1];
			if(last && range[0] <= last[1]) {
				last[1] = Math.max(last[1],range[1]);
			} else {
				merged.push([range[0],range[1]]);
			}
		});
		for(var i = merged.length - 1; i >= 0; i--) {
			text = text.substring(0,merged[i][0]) + " " + text.substring(merged[i][1]);
		}
		var haystack = (title + "\n" + (tiddler.fields.tags || []).join(" ") + "\n" + text).toLowerCase();
		if(words.every(function(word) { return haystack.indexOf(word) !== -1; })) {
			results.push(title);
		}
	});
	return results;
};
