/*\
title: $:/plugins/tiddlyrpg-core/modules/language.js
type: application/javascript
module-type: library
created: 20261001095424000
modified: 20261016184211000

Language lookup for the display texts of tiddlyrpg-core. Keys live as tiddlers
$:/tiddlyrpg/language/<code>/<key>; the active code follows $:/language. Missing keys fall back
to en-GB, then to null (callers decide what to show). Single source of the fallback rule: the
wikitext functions trpg.t/trpg.title/trpg.plural wrap the filter operators that call this module.

Rules language: the terms of a rules domain (calendar names, later units, dice, damage, terms,
coins) may follow another language than the wiki. Domains are JSON data tiddlers
(type application/json) tagged $:/tags/tiddlyrpg/RulesDomain, brought by the active ruleset or
setting, with the properties `domain` (its name), `type` (calendar, unit, label, tokens, damage,
currency - the core knows types, no domain names), optionally `keys` (the prefix of its language
keys) and whatever its type needs (see modules/rules.js). The type lives in the JSON, not in
the field `type`, which is the content type of a tiddler.
Every domain belongs to a group, set apart from the other: "ruleset" (the domains of the
ruleset) or "setting" (those of the campaign setting; a domain without domain tiddler, an own
calendar or currency, belongs here too) - domainGroup(). Per group the DM sets the language its
domains are shown in, $:/config/tiddlyrpg/rules/<group>/...: a mode (.../mode) "wiki" (default,
also without tiddler) - the wiki language; "all" - .../language for every domain of the group;
"domain" - .../domain/<domain> per domain, empty for the wiki language. Values of the other modes
stay when the mode changes. A domain without domain tiddler follows the mode like any other; in
the mode "domain" it gets the wiki language, as there is nothing to set for it. What is written
is read in every language and carries its unit, so no setting decides how a text is read.

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

// Display name of a tiddler title: Title/<title> if present; otherwise, for a title
// "<parent>/<leaf>" whose parent exists, the parent plus the translated leaf
// ("Notes/Campaign" -> "Notes/Kampagne"); otherwise the title unchanged
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

// Translated title -> internal title, over all loaded language packs (keys Title/<name>), not
// only the active one; the first pack that names a text wins
var translatedNames = exports.translatedNames = function(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-translated-names",function() {
		var map = Object.create(null),
			add = function(tiddler,title) {
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
			};
		wiki.each(add);
		wiki.eachShadow(add);
		return map;
	});
};

/*
The internal name of a title written under its translated name ("Ort" -> "Location"): a title
that exists stays as it is. Used for tags on saving (startup/tag-names.js) and for the tags of a
draft not saved yet (the editor).
*/
exports.internalTitle = function(wiki,title) {
	if(wiki.tiddlerExists(title) || wiki.isShadowTiddler(title)) {
		return title;
	}
	var name = translatedNames(wiki)[title];
	return name && (wiki.tiddlerExists(name) || wiki.isShadowTiddler(name)) ? name : title;
};

// The registered rules domains: {name: data}, the parsed JSON of the domain tiddlers (shadows of
// the active ruleset and setting, or real tiddlers) plus `title`; unreadable ones are left out
var domains = exports.domains = function(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-rules-domains",function() {
		var result = Object.create(null);
		$tw.utils.each(wiki.filterTiddlers("[all[shadows+tiddlers]tag[" + DOMAIN_TAG + "]sort[]]"),function(title) {
			var data = wiki.getTiddlerData(title,null),
				name = data && typeof data.domain === "string" ? data.domain.trim() : "";
			if(name && !result[name]) {
				var source = wiki.tiddlerExists(title) ? "" : (wiki.getShadowSource(title) || ""),
					plugin = source && wiki.getTiddler(source);
				data.title = title;
				data.domain = name;
				data.type = (data.type || "").toString().trim();
				data.keys = data.keys || "";
				// The plugin it comes from and its type (ruleset, setting); empty for a real tiddler
				data.source = source;
				data.plugintype = plugin ? plugin.fields["plugin-type"] || "" : "";
				result[name] = data;
			}
		});
		return result;
	});
};

function config(wiki,title) {
	return (wiki.getTiddlerText(RULES + title) || "").trim();
}

// The group of a domain, "ruleset" or "setting": the type of the plugin it comes from; for a
// domain tiddler of the wiki itself calendar and currency belong to the setting, every other type
// to the ruleset; a domain without domain tiddler to the setting
var domainGroup = exports.domainGroup = function(wiki,name) {
	var domain = domains(wiki)[name];
	if(!domain) {
		return "setting";
	}
	if(domain.plugintype === "ruleset" || domain.plugintype === "setting") {
		return domain.plugintype;
	}
	return domain.type === "calendar" || domain.type === "currency" ? "setting" : "ruleset";
};

// The language code a domain is shown in, see the header
var rulesLang = exports.rulesLang = function(wiki,domain) {
	var base = domainGroup(wiki,domain),
		mode = config(wiki,base + "/mode") || "wiki";
	if(mode === "all") {
		return config(wiki,base + "/language") || lang(wiki);
	}
	if(mode === "domain" && domains(wiki)[domain]) {
		return config(wiki,base + "/domain/" + domain) || lang(wiki);
	}
	return lang(wiki);
};

// Translation of a key of a domain in its display language, then en-GB, or null
exports.lookupRules = function(wiki,domain,key) {
	var codes = [rulesLang(wiki,domain)];
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
