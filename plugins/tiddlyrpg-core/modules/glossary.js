/*\
title: $:/plugins/tiddlyrpg-core/modules/glossary.js
type: application/javascript
module-type: library
created: 20261025124110539
modified: 20261025124110539

What explains a term or a named section: the links of <<term>>, of the values of the rules and of
the name of a section (functions.tid, filters/categories.js, filters/fields.js) - the one place of
these rules.

  term(wiki,id,view)    the entry of the category Glossary that explains the term <id>: a
                        tiddler tagged Glossary whose field term holds the id, else an entry of a
                        content package of the type Glossary with that term; null when there is
                        none or the view does not see the tiddler
  named(wiki,name,view) a tiddler or package entry titled <name> of a category with a text of
                        its own (NAMED: Trait, Class, Feat, Glossary) - the target of the name of
                        a section ("Pack Tactics", "Spellcasting"); null otherwise

A package entry is never locked; a tiddler of the title wins over an entry.

\*/

"use strict";

var visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js");

var NAMED = exports.NAMED = ["Trait","Class","Feat","Glossary"];

function content() {
	return require("$:/plugins/tiddlyrpg-core/modules/content.js");
}

// {id: title} of the tiddlers tagged Glossary and the entries of the packages (global cache)
function index(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-glossary",function() {
		var out = Object.create(null);
		$tw.utils.each(wiki.filterTiddlers("[all[tiddlers]tag[Glossary]!is[draft]has[term]]"),function(title) {
			$tw.utils.each(($tw.utils.parseStringArray(wiki.getTiddler(title).fields.term) || []),function(id) {
				out[id.toLowerCase()] = out[id.toLowerCase()] || title;
			});
		});
		$tw.utils.each(content().offers(wiki),function(o) {
			var term = o.type === "Glossary" && o.entry.fields && o.entry.fields.term;
			if(term && !out[String(term).toLowerCase()]) {
				out[String(term).toLowerCase()] = o.title;
			}
		});
		return out;
	});
}

exports.term = function(wiki,id,view) {
	var title = id ? index(wiki)[String(id).trim().toLowerCase()] : null;
	return title && visibility.visible(wiki,title,view) ? title : null;
};

exports.named = function(wiki,name,view) {
	name = (name || "").trim();
	if(!name) {
		return null;
	}
	var tiddler = wiki.getTiddler(name);
	if(tiddler) {
		return NAMED.some(function(tag) { return tiddler.hasTag(tag); }) && visibility.visible(wiki,name,view) ? name : null;
	}
	return content().find(wiki,name).some(function(o) { return NAMED.indexOf(o.type) !== -1; }) ? name : null;
};
