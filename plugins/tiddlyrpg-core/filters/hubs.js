/*\
title: $:/plugins/tiddlyrpg-core/filters/hubs.js
type: application/javascript
module-type: filteroperator
created: 20261024161412996
modified: 20261024161412996

The entries of the type hubs and their order (the lists of the hubs, functions trpg.hub.list, the
number in the title of a hub, templates/title-hub, and the list of the hub Index):

[<hub>trpghubentries[]]     what each input hub lists, before the lock and without drafts: the
                            filter in its field tiddlyrpg-entries (Item, Information, Quest);
                            for a category (modules/categories.js) the tiddlers tagged with it
                            and one of its base types; else the tiddlers tagged with the hub
[<titles>trpgsortname[]]    the input titles sorted by their display name (trpgtitle) in the
                            collation of the wiki language - an umlaut sorts with its letter
[<hubs>trpgsortname[plural]] sorted by the plural of their name (Plural/<title>), else as above
[<titles>trpginitial[]]     the first letter of the display name of each input title,
                            capital, without accent (Ä -> A); "#" for a digit or a sign

\*/

"use strict";

var language = require("$:/plugins/tiddlyrpg-core/modules/language.js"),
	categories = require("$:/plugins/tiddlyrpg-core/modules/categories.js");

exports.trpghubentries = function(source,operator,options) {
	var wiki = options.wiki,
		results = [],
		add = function(title) {
			if(results.indexOf(title) === -1 && !(wiki.getTiddler(title) || {fields: {}}).fields["draft.of"]) {
				results.push(title);
			}
		};
	source(function(tiddler,hub) {
		var own = tiddler && tiddler.fields["tiddlyrpg-entries"],
			bases = categories.basesOf(wiki,hub);
		if(own) {
			$tw.utils.each(wiki.filterTiddlers(own,options.widget),add);
		} else if(bases.length) {
			$tw.utils.each(wiki.filterTiddlers("[all[shadows+tiddlers]tag[" + hub + "]]"),function(title) {
				var entry = wiki.getTiddler(title);
				if(entry && bases.some(function(base) { return entry.hasTag(base); })) {
					add(title);
				}
			});
		} else {
			$tw.utils.each(wiki.getTiddlersWithTag(hub),add);
		}
	});
	return results;
};

// Collator of the wiki language, cached per code
var collators = Object.create(null);

function collator(wiki) {
	var code = language.lang(wiki) || "en-GB";
	if(!collators[code]) {
		try {
			collators[code] = new Intl.Collator(code,{sensitivity: "base", numeric: true});
		} catch(e) {
			collators[code] = new Intl.Collator(undefined,{sensitivity: "base", numeric: true});
		}
	}
	return collators[code];
}

exports.trpgsortname = function(source,operator,options) {
	var plural = operator.operand === "plural",
		entries = [];
	source(function(tiddler,title) {
		var name = plural ? language.lookup(options.wiki,"Plural/" + title) : null;
		entries.push({title: title, name: name === null ? language.title(options.wiki,title) : name});
	});
	var compare = collator(options.wiki).compare;
	entries.sort(function(a,b) {
		return compare(a.name,b.name) || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0);
	});
	return entries.map(function(entry) {
		return entry.title;
	});
};

exports.trpginitial = function(source,operator,options) {
	var results = [];
	source(function(tiddler,title) {
		var first = language.title(options.wiki,title).trim().normalize("NFD").replace(/[̀-ͯ]/g,"").charAt(0).toUpperCase();
		results.push(/\p{L}/u.test(first) ? first : "#");
	});
	return results;
};
