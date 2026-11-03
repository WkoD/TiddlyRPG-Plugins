/*\
title: $:/plugins/tiddlyrpg-core/modules/content.js
type: application/javascript
module-type: library
created: 20261022165648795
modified: 20261103173828774

Content packages in the browser: the entries of the packages of the active ruleset (loaded by
startup/content.js from the route server/content-route.js into the temp tiddler INDEX) as offers
to take into the wiki. Nothing of them is a tiddler until it is taken; without a package (none for
the ruleset, the published copy, no server) there is no offer and nothing shows.

Titles: what stands in the wiki wins - a tiddler of the title (a shadow too: the hub Book of the
core) of the type of the entry means the entry is taken; of another type, the entry is offered as
"<title> (<type>)", the type in the language of its package (Title/<type> of the core: "Balor
(Creature)" beside the person Balor); if that is taken too, there is no offer. A title that names
a tiddler the view does not see counts the same - nothing tells it.

An entry the wiki names is included as a shadow tiddler of the plugin PLUGIN
(modules/content-include.js): it counts as taken, entries() marks it included.

  INDEX                      the temp tiddler of the index ({ruleset, packages})
  PLUGIN                     the plugin of the included entries
  included(wiki)             the titles of the included entries without an own version (a
                             tiddler of the title) - in the published copy too, without index
  isIncluded(wiki,title)     whether <title> is one of them
  withIncluded(wiki)         the tiddlers of the wiki and the included entries, as the source of
                             a filter (wiki.makeTiddlerIterator())
  packages(wiki)             the packages of the index
  entries(wiki)              every entry: [{id, title, type, package, entry, taken, included}] -
                             title the one it is taken under, or the one it was taken under
                             (taken); included: taken as an included entry without own version
  offers(wiki)               every entry not taken: [{id, title, type, package, entry}]
  entryOf(wiki,id)           one of entries(), or null
  offer(wiki,id)             one offer, or null
  find(wiki,title)           the offers titled so
  forRelation(wiki,field,title)  the offer titled so that the relation <field> may name (its
                             type a tag of tiddlyrpg-targets), or null - a target not taken yet
  titleOf(wiki,pkg,entry)    the title it is taken under, or null if taken
  toFields(wiki,pkg,entry,title)  the fields of the tiddler to take: tags (its type, its tags and
                             the tag of its package),
                             its fields (a price of the ruleset in the coins of the setting,
                             currency.fromRules(); never a field of TiddlyWiki, RESERVED), source,
                             text
  wanting(wiki,fields)       the titles a taken entry names in base, spells and the trees
                             (tiddlyrpg-tree: classes, folk - what it belongs to) that do not
                             exist, with an offer of the same title: [{title, id}]
  entryUrl(wiki,key)         the address of the entry of a key of entries(): its package and id
  url(path,params)           the address of the route (server/content-route.js) of <path> with
                             the query <params>: on the host the sync adaptor talks to (TiddlyWeb:
                             $:/config/tiddlyweb/host, which a wiki under a path-prefix sets),
                             else relative to the page

\*/

"use strict";

var types = require("$:/plugins/tiddlyrpg-core/modules/types.js"),
	currency = require("$:/plugins/tiddlyrpg-core/modules/currency.js");

var INDEX = exports.INDEX = "$:/temp/tiddlyrpg-core/content/index",
	PLUGIN = exports.PLUGIN = "$:/plugins/tiddlyrpg/content-packages",
	LANGUAGE = "$:/tiddlyrpg/language/";

var included = exports.included = function(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-content-included",function() {
		var info = wiki.getPluginInfo(PLUGIN) || wiki.getTiddlerData(PLUGIN,{});
		return Object.keys((info && info.tiddlers) || {}).filter(function(title) {
			return title.indexOf("$:/") !== 0 && !wiki.tiddlerExists(title) && wiki.getShadowSource(title) === PLUGIN;
		});
	});
};

exports.isIncluded = function(wiki,title) {
	return included(wiki).indexOf(title) !== -1;
};

exports.withIncluded = function(wiki) {
	return wiki.makeTiddlerIterator(wiki.allTitles().concat(included(wiki)));
};

var packages = exports.packages = function(wiki) {
	return wiki.getCacheForTiddler(INDEX,"tiddlyrpg-content",function() {
		var data = wiki.getTiddlerData(INDEX,null);
		return data && $tw.utils.isArray(data.packages) ? data.packages : [];
	});
};

function exists(wiki,title) {
	return wiki.tiddlerExists(title) || wiki.isShadowTiddler(title);
}

// The name of a type in a language, else in en-GB, else the type
function typeName(wiki,type,code) {
	return wiki.getTiddlerText(LANGUAGE + code + "/Title/" + type) || wiki.getTiddlerText(LANGUAGE + "en-GB/Title/" + type) || type;
}

exports.entryUrl = function(wiki,key) {
	var e = exports.entryOf(wiki,key),
		ruleset = wiki.getTiddlerData(INDEX,{}).ruleset || require("$:/plugins/tiddlyrpg-core/modules/plugin-types.js").active(wiki,"ruleset") || "";
	return e ? exports.url("entry.json",{ruleset: ruleset, package: e.package.name, id: e.entry.id}) : null;
};

exports.url = function(path,params) {
	var host = $tw.syncadaptor && typeof $tw.syncadaptor.host === "string" ? $tw.syncadaptor.host : "",
		query = Object.keys(params || {}).map(function(name) {
			return encodeURIComponent(name) + "=" + encodeURIComponent(params[name]);
		}).join("&");
	return host + "tiddlyrpg/content/" + path + (query ? "?" + query : "");
};

var titleOf = exports.titleOf = function(wiki,pkg,entry) {
	var title = entry.title;
	if(!exists(wiki,title)) {
		return title;
	}
	if(types.of(wiki,title).indexOf(entry.type) !== -1) {
		return null;
	}
	title = entry.title + " (" + typeName(wiki,entry.type,pkg.language) + ")";
	return exists(wiki,title) ? null : title;
};

// The title an entry was taken under: its own, or with its type (another tiddler had its own)
function takenTitle(wiki,pkg,entry) {
	var own = entry.title,
		typed = entry.title + " (" + typeName(wiki,entry.type,pkg.language) + ")";
	return exists(wiki,own) && types.of(wiki,own).indexOf(entry.type) !== -1 ? own : typed;
}

// The key of an entry (id of entries()): its id, or "<package name>/<id>" for an id that more than
// one package of the ruleset has (a package per language)
var entries = exports.entries = function(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-content-entries",function() {
		var out = [],
			seen = Object.create(null),
			count = Object.create(null);
		packages(wiki).forEach(function(pkg) {
			(pkg.entries || []).forEach(function(entry) {
				count[entry.id] = (count[entry.id] || 0) + 1;
			});
		});
		packages(wiki).forEach(function(pkg) {
			(pkg.entries || []).forEach(function(entry) {
				var key = count[entry.id] > 1 ? pkg.name + "/" + entry.id : entry.id;
				if(seen[key]) {
					return;
				}
				seen[key] = true;
				var title = titleOf(wiki,pkg,entry);
				var as = title || takenTitle(wiki,pkg,entry);
				out.push({id: key, title: as, type: entry.type, package: pkg, entry: entry, taken: !title, included: !title && exports.isIncluded(wiki,as)});
			});
		});
		return out;
	});
};

var offers = exports.offers = function(wiki) {
	return entries(wiki).filter(function(e) { return !e.taken; });
};

exports.entryOf = function(wiki,id) {
	return entries(wiki).filter(function(e) { return e.id === id; })[0] || null;
};

var offer = exports.offer = function(wiki,id) {
	return offers(wiki).filter(function(o) { return o.id === id; })[0] || null;
};

var find = exports.find = function(wiki,title) {
	return offers(wiki).filter(function(o) { return o.title === title; });
};

exports.forRelation = function(wiki,field,title) {
	var relations = require("$:/plugins/tiddlyrpg-core/modules/relations.js"),
		type = relations.types(wiki)[field],
		tags = type ? relations.tagsOf(type.candidates) : [];
	return find(wiki,title).filter(function(o) { return tags.indexOf(o.type) !== -1; })[0] || null;
};

function text(value) {
	return $tw.utils.isArray(value) ? $tw.utils.stringifyList(value) : String(value);
}

// Fields of TiddlyWiki an entry never sets: its title, tags and text come from the entry itself
var RESERVED = ["title","tags","text","type","created","modified","creator","modifier","draft.of","draft.title","revision","bag","plugin-type"];

exports.toFields = function(wiki,pkg,entry,title) {
	var out = {title: title, tags: [entry.type].concat(entry.tags || []), text: entry.text || ""};
	if(pkg.tag && out.tags.indexOf(pkg.tag) === -1) {
		out.tags.push(pkg.tag);
	}
	$tw.utils.each(entry.fields || {},function(value,name) {
		if(RESERVED.indexOf(name) !== -1) {
			return;
		}
		if(name === "price" && (typeof value === "number" || $tw.utils.isArray(value))) {
			out.price = currency.fromRules(wiki,value);
		} else if(value !== null && value !== undefined && value !== "") {
			out[name] = text(value);
		}
	});
	if(pkg.source) {
		out.source = pkg.source;
	}
	return out;
};

exports.wanting = function(wiki,fields) {
	var all = require("$:/plugins/tiddlyrpg-core/modules/relations.js").types(wiki),
		names = ["base","spells"].concat(Object.keys(all).filter(function(name) { return all[name].tree; }).sort()),
		out = [];
	names.forEach(function(name) {
		($tw.utils.parseStringArray(fields[name] || "") || []).forEach(function(title) {
			var hit = !exists(wiki,title) && find(wiki,title)[0];
			if(hit && !out.some(function(w) { return w.id === hit.id; })) {
				out.push({title: title, id: hit.id});
			}
		});
	});
	return out;
};
