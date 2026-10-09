/*\
title: $:/plugins/tiddlyrpg-core/modules/language.js
type: application/javascript
module-type: library
created: 20261001095424000
modified: 20261001095424000

Language lookup for the display texts of tiddlyrpg-core. Keys live as tiddlers
$:/tiddlyrpg/language/<code>/<key>; the active code follows $:/language. Missing keys fall back
to en-GB, then to null (callers decide what to show). Single source of the fallback rule: the
wikitext functions trpg.t/trpg.title/trpg.plural wrap the filter operators that call this module.

\*/

"use strict";

var PREFIX = "$:/tiddlyrpg/language/",
	BASE = "en-GB";

// Active language code, e.g. "de-DE" for $:/language = $:/languages/de-DE
var lang = exports.lang = function(wiki) {
	var code = (wiki.getTiddlerText("$:/language","") || "").replace(/^\$:\/languages\//,"");
	return code || BASE;
};

// Translation of a key, or null if neither the active language nor en-GB has it
var lookup = exports.lookup = function(wiki,key) {
	var codes = [lang(wiki)];
	if(codes[0] !== BASE) {
		codes.push(BASE);
	}
	for(var i = 0; i < codes.length; i++) {
		var text = wiki.getTiddlerText(PREFIX + codes[i] + "/" + key);
		if(text) {
			return text;
		}
	}
	return null;
};

// Translation of a key, falling back to the key itself
exports.t = function(wiki,key) {
	var text = lookup(wiki,key);
	return text === null ? key : text;
};

// Display name of a tiddler title: Title/<title> if present; otherwise, for a sub-tiddler
// "<parent>/<leaf>" whose parent exists, the parent plus the translated leaf
// ("Insel Avalon/Map" -> "Insel Avalon/Karte"); otherwise the title unchanged
exports.title = function(wiki,title) {
	var text = lookup(wiki,"Title/" + title);
	if(text !== null) {
		return text;
	}
	var pos = title.lastIndexOf("/");
	if(pos > 0 && pos < title.length - 1) {
		var parent = title.substr(0,pos),
			leaf = lookup(wiki,"Title/" + title.substr(pos + 1));
		if(leaf !== null && (wiki.tiddlerExists(parent) || wiki.isShadowTiddler(parent))) {
			return parent + "/" + leaf;
		}
	}
	return title;
};

// Replaces $name$ placeholders in a translated pattern
exports.format = function(pattern,values) {
	return pattern.replace(/\$([a-zA-Z]+)\$/g,function(match,name) {
		return values[name] !== undefined ? values[name] : match;
	});
};
