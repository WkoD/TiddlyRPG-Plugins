/*\
title: $:/plugins/tiddlyrpg-core/modules/language.js
type: application/javascript
module-type: library
created: 20261001095424000
modified: 20261009181232255

Language lookup for the display texts of tiddlyrpg-core. Keys live as tiddlers
$:/tiddlyrpg/language/<code>/<key>; the active code follows $:/language. Missing keys fall back
to en-GB, then to null (callers decide what to show). Single source of the fallback rule: the
wikitext functions trpg.t/trpg.title/trpg.plural wrap the filter operators that call this module.

Rules language: the terms of a rules domain (calendar names, later units, dice, damage, terms,
coins) may follow another language than the wiki. Domains are data tiddlers tagged
$:/tags/tiddlyrpg/RulesDomain, brought by the active ruleset or setting, with the fields
`domain` (its name), `type` (calendar, unit, label, tokens, damage, currency - the core knows
types, no domain names), optionally `keys` (the prefix of its language keys) and `kinds: yes`.
Two settings per wiki, each set by the DM in $:/config/tiddlyrpg/rules/<set>/...:
  display   the language a domain is shown in
  input     the language a domain is written in (the unit of numbers without unit)
each with a mode (.../<set>/mode): "wiki" (default, also without tiddler) - the wiki language;
"all" - .../<set>/language for every domain; "domain" - .../<set>/domain/<domain> per domain,
empty for the wiki language. Values of the other modes stay when the mode changes. A domain
without domain tiddler (an own calendar without setting) follows the mode like any other; in
the mode "domain" it gets the wiki language, as there is nothing to set for it.

\*/

"use strict";

var PREFIX = "$:/tiddlyrpg/language/",
	BASE = "en-GB",
	RULES = "$:/config/tiddlyrpg/rules/",
	DOMAIN_TAG = "$:/tags/tiddlyrpg/RulesDomain";

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

// The registered rules domains: {name: {title, domain, type, keys, kinds}}, from the domain
// tiddlers (shadows of the active ruleset and setting, or real tiddlers)
var domains = exports.domains = function(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-rules-domains",function() {
		var result = Object.create(null);
		$tw.utils.each(wiki.filterTiddlers("[all[shadows+tiddlers]tag[" + DOMAIN_TAG + "]sort[]]"),function(title) {
			var fields = wiki.getTiddler(title).fields,
				name = (fields.domain || "").trim();
			if(name && !result[name]) {
				result[name] = {
					title: title,
					domain: name,
					type: (fields.type || "").trim(),
					keys: fields.keys || "",
					kinds: fields.kinds === "yes"
				};
			}
		});
		return result;
	});
};

function config(wiki,title) {
	return (wiki.getTiddlerText(RULES + title) || "").trim();
}

// The language code a domain follows in a set ("display" or "input"), see the header
var rulesLang = exports.rulesLang = function(wiki,domain,set) {
	var mode = config(wiki,set + "/mode") || "wiki";
	if(mode === "all") {
		return config(wiki,set + "/language") || lang(wiki);
	}
	if(mode === "domain" && domains(wiki)[domain]) {
		return config(wiki,set + "/domain/" + domain) || lang(wiki);
	}
	return lang(wiki);
};

// Translation of a key of a domain in its display language, then en-GB, or null
exports.lookupRules = function(wiki,domain,key) {
	var codes = [rulesLang(wiki,domain,"display")];
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

// The language codes that have keys: all, or those with a key starting with the prefix
exports.languages = function(wiki,prefix) {
	var all = wiki.getGlobalCache("tiddlyrpg-language-keys",function() {
		var keys = Object.create(null),
			add = function(tiddler,title) {
				if(title.indexOf(PREFIX) === 0) {
					var rest = title.substr(PREFIX.length),
						pos = rest.indexOf("/");
					if(pos > 0) {
						(keys[rest.substr(0,pos)] = keys[rest.substr(0,pos)] || []).push(rest.substr(pos + 1));
					}
				}
			};
		wiki.each(add);
		wiki.eachShadow(add);
		return keys;
	});
	return Object.keys(all).filter(function(code) {
		return !prefix || all[code].some(function(key) { return key.indexOf(prefix) === 0; });
	}).sort();
};

// Replaces $name$ placeholders in a translated pattern
exports.format = function(pattern,values) {
	return pattern.replace(/\$([a-zA-Z]+)\$/g,function(match,name) {
		return values[name] !== undefined ? values[name] : match;
	});
};
