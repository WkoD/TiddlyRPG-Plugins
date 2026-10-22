/*\
title: $:/plugins/tiddlyrpg-core/modules/content.js
type: application/javascript
module-type: library
created: 20261022165648795
modified: 20261022165648795

Content packages in the browser: the entries of the packages of the active ruleset (loaded by
startup/content.js from the route server/content-route.js into the temp tiddler INDEX) as offers
to take into the wiki. Nothing of them is a tiddler until it is taken; without a package (none for
the ruleset, the published copy, no server) there is no offer and nothing shows.

Titles: what stands in the wiki wins - a tiddler of the title (a shadow too: the hub Book of the
core) of the type of the entry means the entry is taken; of another type, the entry is offered as
"<title> (<type>)", the type in the language of its package (Title/<type> of the core: "Balor
(Creature)" beside the person Balor); if that is taken too, there is no offer. A title that names
a tiddler the view does not see counts the same - nothing tells it.

  INDEX                      the temp tiddler of the index ({ruleset, packages})
  packages(wiki)             the packages of the index
  offers(wiki)               every entry not taken: [{id, title, type, package, entry}]
  offer(wiki,id)             one offer, or null
  find(wiki,title)           the offers titled so
  titleOf(wiki,pkg,entry)    the title it is taken under, or null if taken
  toFields(wiki,pkg,entry,title)  the fields of the tiddler to take: tags (its type and tags),
                             its fields (a price of the ruleset in the coins of the setting,
                             currency.fromRules()), source, text
  wanting(wiki,fields)       the titles a taken entry names in base and spells that do not exist,
                             with an offer of the same title: [{title, id}]

\*/

"use strict";

var types = require("$:/plugins/tiddlyrpg-core/modules/types.js"),
	currency = require("$:/plugins/tiddlyrpg-core/modules/currency.js");

var INDEX = exports.INDEX = "$:/temp/tiddlyrpg-core/content/index",
	LANGUAGE = "$:/tiddlyrpg/language/";

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

var offers = exports.offers = function(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-content-offers",function() {
		var out = [],
			seen = Object.create(null);
		packages(wiki).forEach(function(pkg) {
			(pkg.entries || []).forEach(function(entry) {
				var title = titleOf(wiki,pkg,entry);
				if(title && !seen[entry.id]) {
					seen[entry.id] = true;
					out.push({id: entry.id, title: title, type: entry.type, package: pkg, entry: entry});
				}
			});
		});
		return out;
	});
};

var offer = exports.offer = function(wiki,id) {
	return offers(wiki).filter(function(o) { return o.id === id; })[0] || null;
};

var find = exports.find = function(wiki,title) {
	return offers(wiki).filter(function(o) { return o.title === title; });
};

function text(value) {
	return $tw.utils.isArray(value) ? $tw.utils.stringifyList(value) : String(value);
}

exports.toFields = function(wiki,pkg,entry,title) {
	var out = {title: title, tags: [entry.type].concat(entry.tags || []), text: entry.text || ""};
	$tw.utils.each(entry.fields || {},function(value,name) {
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
	var out = [];
	["base","spells"].forEach(function(name) {
		($tw.utils.parseStringArray(fields[name] || "") || []).forEach(function(title) {
			var hit = !exists(wiki,title) && find(wiki,title)[0];
			if(hit && !out.some(function(w) { return w.id === hit.id; })) {
				out.push({title: title, id: hit.id});
			}
		});
	});
	return out;
};
