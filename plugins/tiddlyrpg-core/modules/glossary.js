/*\
title: $:/plugins/tiddlyrpg-core/modules/glossary.js
type: application/javascript
module-type: library
created: 20261025124110539
modified: 20261103173828774

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
  ref(wiki,name,entry,view)  what <<rule "Name" entry:"Entry">> and a name in a formula
                        ('Rage Damage|Barbarian', modules/formula.js) point to, in this order:
                        1. a NAMED entry titled <name>; 2. a named section of a kind of the
                        ruleset in a NAMED entry ("Rage", <<feature "Rage">> of Barbarian); 3. a
                        heading of the first row of a table in one ("Rage Damage"). The first
                        step with a hit counts; two hits of a step are a problem. <entry> keeps
                        the search to that entry. Returns {title, anchor} (anchor "" without a
                        jump mark: modules/sections.js anchor() of the kind, columnAnchor()),
                        {problem, values} (Rules/Check/Name, NameTwice, NameEntry), or {hidden:
                        true} when only what the view does not see has the name - nothing may
                        tell it then, no link, no message.
  search(wiki,needle,view)  the names of sections and table headings the view sees that contain
                        <needle>, with their entry: [{name, entry}] (the button Rules of the editor)

A package entry is never locked; a tiddler of the title wins over an entry. A section counts for
a view that sees it, a column for one that sees the section it stands in.

\*/

"use strict";

var visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js");

var NAMED = exports.NAMED = ["Trait","Class","Feat","Glossary"];

function content() {
	return require("$:/plugins/tiddlyrpg-core/modules/content.js");
}

// {id: title} of the tiddlers tagged Glossary (with the included entries of the packages) and
// the entries of the packages not taken (global cache)
function index(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-glossary",function() {
		var out = Object.create(null);
		$tw.utils.each(wiki.filterTiddlers("[all[tiddlers+included]tag[Glossary]!is[draft]has[term]]"),function(title) {
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

function sections() {
	return require("$:/plugins/tiddlyrpg-core/modules/sections.js");
}

// The headings of the first row of each table of a text: [{name, start}] - "|!Level |!Rage Damage |"
var headings = exports.headings = function(text) {
	var out = [],
		re = /(^|\n)(\|[^\n]*\|)[hcfk]?(?=\n|$)/g,
		m;
	text = text || "";
	while((m = re.exec(text))) {
		var start = m.index + m[1].length,
			before = text.lastIndexOf("\n",start - 2) + 1;
		// only the first row of a table: the line before is no row
		if(start === 0 || text.charAt(before) !== "|") {
			$tw.utils.each(m[2].slice(1,-1).split("|"),function(cell) {
				if(/^!/.test(cell)) {
					out.push({name: cell.slice(1).trim(), start: start});
				}
			});
		}
		re.lastIndex = start + m[2].length;
	}
	return out;
};

/*
The names of the NAMED entries (global cache): {sections: {name: [hit]}, columns: {name: [hit]}},
names in lower case; a hit {name, title, anchor, record} - name as written, record the id of the
section it stands in
(-1: none; null: a package entry, never locked). From the tiddlers of the wiki with the included
entries of the packages, and the entries not taken (their index carries names,
modules/content-server.js).
*/
function names(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-rule-names",function() {
		var out = {sections: Object.create(null), columns: Object.create(null)},
			kinds = sections().rulesKinds(wiki);
		var add = function(group,name,hit) {
			var key = name.toLowerCase();
			hit.name = name;
			(group[key] = group[key] || []).push(hit);
		};
		$tw.utils.each(wiki.filterTiddlers("[all[tiddlers+included]!is[draft]!is[system]]"),function(title) {
			var tiddler = wiki.getTiddler(title);
			if(!NAMED.some(function(tag) { return tiddler.hasTag(tag); })) {
				return;
			}
			var model = sections().read(wiki,title),
				text = tiddler.fields.text || "";
			$tw.utils.each(model.records,function(record) {
				var kind = kinds[record.kind];
				if(kind && record.counts && record.params.plain) {
					add(out.sections,record.params.plain,{title: title, anchor: kind.anchor(record), record: record.id});
				}
			});
			$tw.utils.each(headings(text),function(heading) {
				var inner = -1;
				$tw.utils.each(model.records,function(record) {
					if(record.from <= heading.start && heading.start < record.to && (inner === -1 || record.from >= model.records[inner].from)) {
						inner = record.id;
					}
				});
				add(out.columns,heading.name,{title: title, anchor: sections().columnAnchor(heading.name), record: inner});
			});
		});
		$tw.utils.each(content().offers(wiki),function(o) {
			if(NAMED.indexOf(o.type) === -1) {
				return;
			}
			$tw.utils.each(o.entry.names || [],function(n) {
				var anchor = n.kind === "column" ? sections().columnAnchor(n.name) : n.kind + "-" + sections().slug(n.name);
				if(n.kind === "column" || kinds[n.kind]) {
					add(n.kind === "column" ? out.columns : out.sections,n.name,{title: o.title, anchor: anchor, record: null});
				}
			});
		});
		return out;
	});
}

// Whether the view sees a hit: its tiddler and the section it stands in
function seen(wiki,hit,view) {
	if(hit.record === null) {
		return true;
	}
	return visibility.visible(wiki,hit.title,view) && (hit.record === -1 || sections().visible(wiki,hit.title,hit.record,view));
}

// The NAMED entry titled <title>: "tiddler", "hidden" (a tiddler the view does not see), "offer"
// (a package entry not taken), or null
function entryKind(wiki,title,view) {
	var tiddler = wiki.getTiddler(title);
	if(tiddler) {
		return !NAMED.some(function(tag) { return tiddler.hasTag(tag); }) ? null :
			(visibility.visible(wiki,title,view) ? "tiddler" : "hidden");
	}
	return content().find(wiki,title).some(function(o) { return NAMED.indexOf(o.type) !== -1; }) ? "offer" : null;
}

exports.ref = function(wiki,name,entry,view) {
	name = (name || "").trim();
	entry = (entry || "").trim();
	var problem = function(key,values) {
			return {problem: key, values: $tw.utils.extend({name: name, entry: entry},values || {})};
		},
		index = names(wiki),
		hidden = false;
	if(!name) {
		return problem("Rules/Check/Name");
	}
	if(entry) {
		var kind = entryKind(wiki,entry,view);
		if(kind === "hidden") {
			return {hidden: true};
		}
		if(!kind) {
			return problem("Rules/Check/NameEntry");
		}
		if(name.toLowerCase() === entry.toLowerCase()) {
			return {title: entry, anchor: ""};
		}
	} else {
		var own = entryKind(wiki,name,view);
		if(own === "tiddler" || own === "offer") {
			return {title: name, anchor: ""};
		}
		hidden = own === "hidden";
	}
	var key = name.toLowerCase(),
		steps = [index.sections[key] || [],index.columns[key] || []];
	for(var s = 0; s < steps.length; s++) {
		var hits = steps[s].filter(function(hit) { return !entry || hit.title === entry; }),
			visible = hits.filter(function(hit) { return seen(wiki,hit,view); }),
			titles = [];
		$tw.utils.each(visible,function(hit) {
			if(titles.indexOf(hit.title) === -1) {
				titles.push(hit.title);
			}
		});
		if(titles.length > 1) {
			return problem("Rules/Check/NameTwice",{titles: titles.join(", ")});
		}
		if(visible.length) {
			return {title: visible[0].title, anchor: visible[0].anchor};
		}
		hidden = hidden || hits.length > 0;
	}
	return hidden ? {hidden: true} : problem("Rules/Check/Name");
};

// The names of sections and table headings the view sees whose name contains <needle> (any case),
// with their entry, by name: [{name, entry}] - the button Rules of the editor
exports.search = function(wiki,needle,view) {
	needle = (needle || "").trim().toLowerCase();
	var index = names(wiki),
		out = [],
		seenKeys = Object.create(null);
	if(!needle) {
		return out;
	}
	[index.sections,index.columns].forEach(function(group) {
		$tw.utils.each(Object.keys(group),function(key) {
			if(key.indexOf(needle) === -1) {
				return;
			}
			$tw.utils.each(group[key],function(hit) {
				if(seen(wiki,hit,view) && !seenKeys[key + "|" + hit.title]) {
					seenKeys[key + "|" + hit.title] = true;
					out.push({name: hit.name, entry: hit.title});
				}
			});
		});
	});
	return out.sort(function(a,b) {
		return a.name.localeCompare(b.name) || a.entry.localeCompare(b.entry);
	});
};
