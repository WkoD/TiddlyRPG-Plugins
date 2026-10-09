/*\
title: $:/plugins/tiddlyrpg-core/startup/tag-names.js
type: application/javascript
module-type: startup
created: 20261001095424000
modified: 20261001095424000

Hook th-saving-tiddler: a tag typed under its translated name ("Ort") is stored under the internal
name ("Location"). Works across all loaded language packs, not only the active one. A tag that
already exists as a tiddler is left alone.

\*/

"use strict";

exports.name = "tiddlyrpg-tag-names";
exports.after = ["startup"];
exports.synchronous = true;

var PREFIX = "$:/tiddlyrpg/language/";

// Map translated title -> internal title, from all $:/tiddlyrpg/language/<code>/Title/<name>
function translatedNames(wiki) {
	var map = Object.create(null);
	wiki.each(add);
	wiki.eachShadow(add);
	function add(tiddler,title) {
		if(title.indexOf(PREFIX) !== 0) {
			return;
		}
		var rest = title.substr(PREFIX.length),
			pos = rest.indexOf("/Title/");
		if(pos === -1) {
			return;
		}
		var name = rest.substr(pos + "/Title/".length),
			text = tiddler.fields.text;
		if(text && text !== name && !map[text]) {
			map[text] = name;
		}
	}
	return map;
}

exports.startup = function() {
	$tw.hooks.addHook("th-saving-tiddler",function(newTiddler) {
		var tags = newTiddler && newTiddler.fields.tags;
		if(!tags || tags.length === 0) {
			return newTiddler;
		}
		var wiki = $tw.wiki,
			map = null,
			changed = false,
			result = [];
		$tw.utils.each(tags,function(tag) {
			if(!wiki.tiddlerExists(tag) && !wiki.isShadowTiddler(tag)) {
				map = map || translatedNames(wiki);
				if(map[tag] && (wiki.tiddlerExists(map[tag]) || wiki.isShadowTiddler(map[tag]))) {
					tag = map[tag];
					changed = true;
				}
			}
			if(result.indexOf(tag) === -1) {
				result.push(tag);
			}
		});
		return changed ? new $tw.Tiddler(newTiddler,{tags: result}) : newTiddler;
	});
};
