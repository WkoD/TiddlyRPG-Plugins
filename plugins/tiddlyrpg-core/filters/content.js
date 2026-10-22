/*\
title: $:/plugins/tiddlyrpg-core/filters/content.js
type: application/javascript
module-type: filteroperator
created: 20261022165648795
modified: 20261022165648795

The offers of the content packages (modules/content.js) for the templates:

[trpgcontentready[]]               "yes" if a package of the active ruleset is loaded (the
                                   condition trpg.content of every part of the packages)
[<title>trpgcontentfor[]]          the ids of the offers titled like each input
[trpgcontentids[]]                 the ids of every offer, in the order of the packages
[<id>trpgcontentoffer[title]]      a property of each offer: title, type, package (its name),
                                   language

\*/

"use strict";

var content = require("$:/plugins/tiddlyrpg-core/modules/content.js");

function each(source,fn) {
	var results = [];
	source(function(tiddler,title) {
		Array.prototype.push.apply(results,fn(title));
	});
	return results;
}

exports.trpgcontentready = function(source,operator,options) {
	return content.packages(options.wiki).some(function(p) { return (p.entries || []).length; }) ? ["yes"] : [];
};

exports.trpgcontentfor = function(source,operator,options) {
	return each(source,function(title) {
		return content.find(options.wiki,title).map(function(o) { return o.id; });
	});
};

exports.trpgcontentids = function(source,operator,options) {
	return content.offers(options.wiki).map(function(o) { return o.id; });
};

exports.trpgcontentoffer = function(source,operator,options) {
	var what = operator.operand || "title";
	return each(source,function(id) {
		var o = content.offer(options.wiki,id);
		if(!o) {
			return [];
		}
		switch(what) {
			case "type": return [o.type];
			case "package": return [o.package.name];
			case "language": return [o.package.language];
			default: return [o.title];
		}
	});
};
