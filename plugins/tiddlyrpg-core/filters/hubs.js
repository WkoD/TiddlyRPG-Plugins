/*\
title: $:/plugins/tiddlyrpg-core/filters/hubs.js
type: application/javascript
module-type: filteroperator
created: 20261024161412996
modified: 20261103173828774

The entries of the type hubs and their order (the page of a hub, functions trpg.hub.page and
trpg.hub.list, and the list of the hub Index with the numbers):

[<hub>trpghubentries[]]     what each input hub lists, before the lock and without drafts: the
                            filter in its field tiddlyrpg-entries (Item, Information, Quest);
                            for a category (modules/categories.js) the tiddlers tagged with it
                            and one of its base types; else the tiddlers tagged with the hub
[<titles>trpgsortname[]]    the input titles sorted by their display name (trpgtitle) in the
                            collation of the wiki language - an umlaut sorts with its letter
[<hubs>trpgsortname[plural]] sorted by the plural of their name (Plural/<title>), else as above
[<hub>trpghubsubs[]]        the hubs below each input hub (modules/categories.js subsOf: Artifact,
                            Material and the categories of the items below Item, the categories
                            of another hub), the base types first, each part by the plural of
                            its name; before the lock
[<titles>trpginitial[]]     the first letter of the display name of each input title,
                            capital, without accent (Ä -> A); "#" for a digit or a sign

\*/

"use strict";

var language = require("$:/plugins/tiddlyrpg-core/modules/language.js"),
	categories = require("$:/plugins/tiddlyrpg-core/modules/categories.js"),
	content = require("$:/plugins/tiddlyrpg-core/modules/content.js");

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
			$tw.utils.each(wiki.filterTiddlers(own,options.widget,content.withIncluded(wiki)),add);
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

// The titles sorted by their display name, or by the plural of their name
function sortNames(wiki,titles,plural) {
	var compare = collator(wiki).compare,
		entries = titles.map(function(title) {
			var name = plural ? language.lookup(wiki,"Plural/" + title) : null;
			return {title: title, name: name === null ? language.title(wiki,title) : name};
		});
	entries.sort(function(a,b) {
		return compare(a.name,b.name) || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0);
	});
	return entries.map(function(entry) {
		return entry.title;
	});
}

exports.trpgsortname = function(source,operator,options) {
	var titles = [];
	source(function(tiddler,title) {
		titles.push(title);
	});
	return sortNames(options.wiki,titles,operator.operand === "plural");
};

exports.trpghubsubs = function(source,operator,options) {
	var wiki = options.wiki,
		results = [];
	source(function(tiddler,hub) {
		var subs = categories.subsOf(wiki,hub),
			bases = subs.filter(function(sub) { return !categories.isCategory(wiki,sub); });
		$tw.utils.pushTop(results,sortNames(wiki,bases,true).concat(sortNames(wiki,subs.filter(function(sub) { return bases.indexOf(sub) === -1; }),true)));
	});
	return results;
};

exports.trpginitial = function(source,operator,options) {
	var results = [];
	source(function(tiddler,title) {
		var first = language.title(options.wiki,title).trim().normalize("NFD").replace(/[̀-ͯ]/g,"").charAt(0).toUpperCase();
		results.push(/\p{L}/u.test(first) ? first : "#");
	});
	return results;
};
