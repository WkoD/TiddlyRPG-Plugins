/*\
title: $:/plugins/tiddlyrpg-core/modules/relink-titles.js
type: application/javascript
module-type: relinkfieldtype
created: 20261025124110539
modified: 20261025124110539

A field type of tw5-relink for a field of the rules of the format titles (modules/rules.js):
"Fighter 5, Rogue 8" - titles parted by commas, each with a value after it. A ruleset names it in
the relink config of its field ($:/config/flibbles/relink/fields/class-levels: trpgtitles). Renaming
"Fighter" writes the new title in its place and keeps the value.

\*/

"use strict";

exports.name = "trpgtitles";

// The parts of a value: [{title, rest}], rest the value after the title with its space
function parts(value) {
	return (value || "").split(",").map(function(part) {
		var trimmed = part.trim(),
			m = /^(.+?)(\s+[+\-\u2212]?\d+(?:[.,]\d+)?)$/.exec(trimmed);
		return m ? {title: m[1], rest: m[2]} : {title: trimmed, rest: ""};
	}).filter(function(p) { return !!p.title; });
}

exports.report = function(value,callback,options) {
	parts(value).forEach(function(p) {
		callback(p.title);
	});
};

exports.relink = function(value,fromTitle,toTitle,options) {
	var list = parts(value),
		changed = false;
	list.forEach(function(p) {
		if(p.title === fromTitle) {
			p.title = toTitle;
			changed = true;
		}
	});
	if(!changed) {
		return undefined;
	}
	if(toTitle.indexOf(",") !== -1) {
		return {impossible: true};
	}
	return {output: list.map(function(p) { return p.title + p.rest; }).join(", ")};
};
