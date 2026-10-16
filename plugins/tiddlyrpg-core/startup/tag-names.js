/*\
title: $:/plugins/tiddlyrpg-core/startup/tag-names.js
type: application/javascript
module-type: startup
created: 20261001095424000
modified: 20261016090000000

Hook th-saving-tiddler: a tag typed under its translated name ("Ort") is stored under the internal
name ("Location"). Works across all loaded language packs, not only the active one
(modules/language.js internalTitle). A tag that already exists as a tiddler is left alone.

\*/

"use strict";

exports.name = "tiddlyrpg-tag-names";
exports.after = ["startup"];
exports.synchronous = true;

var language = require("$:/plugins/tiddlyrpg-core/modules/language.js");

exports.startup = function() {
	$tw.hooks.addHook("th-saving-tiddler",function(newTiddler) {
		var tags = newTiddler && newTiddler.fields.tags;
		if(!tags || tags.length === 0) {
			return newTiddler;
		}
		var wiki = $tw.wiki,
			changed = false,
			result = [];
		$tw.utils.each(tags,function(tag) {
			var name = language.internalTitle(wiki,tag);
			if(name !== tag) {
				changed = true;
			}
			if(result.indexOf(name) === -1) {
				result.push(name);
			}
		});
		return changed ? new $tw.Tiddler(newTiddler,{tags: result}) : newTiddler;
	});
};
