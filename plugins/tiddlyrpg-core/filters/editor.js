/*\
title: $:/plugins/tiddlyrpg-core/filters/editor.js
type: application/javascript
module-type: filteroperator
created: 20261016090000000
modified: 20261016233000000

Filters of the editor: the buttons of the toolbar (editor/toolbar), the form (editor/form), the
picker (editor/procedures) and the kinds of the search.

[<t>trpgwikitext[]]            the input titles that are wikitext (no type, or text/vnd.tiddlywiki)
[<t>trpginternal[]]            each input title under its internal name ("Ort" -> "Location",
                               modules/language.js internalTitle)
[<t>trpgtypes[]]               the type tags of each input tiddler (modules/types.js), also typed
                               under a translated name - a draft not saved yet
[<t>trpgpickmatch<text>]       the input titles whose name or translated name contains <text>
                               (any case); all of them for an empty text (the picker)
[<t>trpgsimilar<name>]         the input titles that look like <name> written another way, <name>
                               itself left out (modules/checks.js similar)
[trpgtermids[]]                the ids of the terms of the rules (domains of type label)
[trpgtermsearch<text>]         those whose id or term contains <text> (any case)
[<text>trpgunitsuggest[]]      a number with the units that fit what follows it ("60 f" -> "60 ft")
[<field>relationcandidates[]]  what the field may name (field tiddlyrpg-targets of its config,
                               modules/relations.js); without it every typed tiddler
[<t>kindselected<state>]       the input titles whose kind (relationkind, events as a kind of their
                               own) is in the field list of <state>; all of them for an empty list
[<draft>trpgformfields[]]      the fields of the form for a draft (modules/form.js)
[<draft>trpgformsingle<field>] the draft if <field> holds one entry for its type
[<field>trpgfieldeditor[]]     the editor of the field in the form and in the field list of the
                               core (cascade $:/config/FieldEditorFilters/tiddlyrpg)
[<draft>trpgdatemarkers[]]     the number of dated sections in the text of the draft
[trpgformknown[]]              the fields the form knows (modules/form.js known)
[<draft>trpgformoffered[]]     the fields the form offers to add for a draft (modules/form.js offered)
[trpgtypelist[]]               the type tags (modules/types.js)
[<name>trpgtaken[]]            the tiddler named like each input name in any case, a name for a
                               new tiddler that cannot be taken (modules/editor.js taken)

\*/

"use strict";

var language = require("$:/plugins/tiddlyrpg-core/modules/language.js"),
	types = require("$:/plugins/tiddlyrpg-core/modules/types.js"),
	checks = require("$:/plugins/tiddlyrpg-core/modules/checks.js"),
	rules = require("$:/plugins/tiddlyrpg-core/modules/rules.js"),
	relations = require("$:/plugins/tiddlyrpg-core/modules/relations.js"),
	sections = require("$:/plugins/tiddlyrpg-core/modules/sections.js"),
	form = require("$:/plugins/tiddlyrpg-core/modules/form.js"),
	editor = require("$:/plugins/tiddlyrpg-core/modules/editor.js");

function each(source,fn) {
	var results = [];
	source(function(tiddler,title) {
		fn(title,results,tiddler);
	});
	return results;
}

exports.trpgwikitext = function(source,operator,options) {
	return each(source,function(title,results,tiddler) {
		var type = tiddler && tiddler.fields.type;
		if(tiddler && (!type || type === "text/vnd.tiddlywiki")) {
			results.push(title);
		}
	});
};

exports.trpginternal = function(source,operator,options) {
	return each(source,function(title,results) {
		results.push(language.internalTitle(options.wiki,title));
	});
};

exports.trpgtypes = function(source,operator,options) {
	return each(source,function(title,results) {
		$tw.utils.each(form.types(options.wiki,title),function(name) {
			if(results.indexOf(name) === -1) {
				results.push(name);
			}
		});
	});
};

exports.trpgpickmatch = function(source,operator,options) {
	var needle = (operator.operand || "").trim().toLowerCase(),
		wiki = options.wiki;
	return each(source,function(title,results) {
		if(!needle || language.title(wiki,title).toLowerCase().indexOf(needle) !== -1 || title.toLowerCase().indexOf(needle) !== -1) {
			results.push(title);
		}
	});
};

exports.trpgsimilar = function(source,operator,options) {
	var name = (operator.operand || "").trim();
	return each(source,function(title,results) {
		if(name && title !== name && checks.similar(title,name)) {
			results.push(title);
		}
	});
};

// The label entries of the rules: [{id, text}] (text in the rules language)
function terms(wiki) {
	var domains = language.domains(wiki),
		out = [];
	Object.keys(domains).sort().forEach(function(name) {
		if(domains[name].type === "label") {
			$tw.utils.each(domains[name].entries,function(entry) {
				out.push({id: entry.id, text: rules.term(wiki,entry.id).text});
			});
		}
	});
	return out;
}

exports.trpgtermids = function(source,operator,options) {
	return terms(options.wiki).map(function(entry) { return entry.id; });
};

exports.trpgtermsearch = function(source,operator,options) {
	var needle = (operator.operand || "").toLowerCase().trim();
	if(!needle) {
		return [];
	}
	return terms(options.wiki).filter(function(entry) {
		return entry.id.toLowerCase().indexOf(needle) !== -1 || (entry.text || "").toLowerCase().indexOf(needle) !== -1;
	}).map(function(entry) { return entry.id; });
};

// "60 f" -> "60 ft", "60 feet"...: the number with each unit of the rules whose label (in the rules
// language) or id starts with what follows it; nothing without a number in front
exports.trpgunitsuggest = function(source,operator,options) {
	var wiki = options.wiki,
		domains = language.domains(wiki);
	return each(source,function(text,results) {
		var m = /^\s*(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?)\s*(.*)$/.exec(text || "");
		if(!m) {
			return;
		}
		var prefix = m[2].trim().toLowerCase();
		Object.keys(domains).sort().forEach(function(name) {
			var domain = domains[name];
			if(domain.type !== "unit") {
				return;
			}
			Object.keys(domain.units || {}).forEach(function(id) {
				var label = language.lookupRules(wiki,domain.domain,"Rules/Unit/" + id) || id,
					hit = m[1] + " " + label;
				if((!prefix || label.toLowerCase().indexOf(prefix) === 0 || id.toLowerCase().indexOf(prefix) === 0) && results.indexOf(hit) === -1) {
					results.push(hit);
				}
			});
		});
	});
};

exports.relationcandidates = function(source,operator,options) {
	var wiki = options.wiki,
		all = relations.types(wiki);
	return each(source,function(field,results) {
		var type = all[field],
			filter = type && type.candidates ? type.candidates : "[all[tiddlers]!is[system]!is[draft]] :filter[trpgtypes[]]";
		$tw.utils.each(wiki.filterTiddlers(filter),function(title) {
			if(results.indexOf(title) === -1) {
				results.push(title);
			}
		});
	});
};

exports.kindselected = function(source,operator,options) {
	var wiki = options.wiki,
		state = wiki.getTiddler(operator.operand || ""),
		chosen = state ? $tw.utils.parseStringArray(state.fields.list || "") || [] : [];
	return each(source,function(title,results) {
		if(!chosen.length || chosen.indexOf(relations.kindOf(wiki,title,true)) !== -1) {
			results.push(title);
		}
	});
};

exports.trpgformsingle = function(source,operator,options) {
	return each(source,function(title,results) {
		if(form.single(options.wiki,title,operator.operand || "")) {
			results.push(title);
		}
	});
};

// The editor of a field of the form (editor/fields/*); nothing for a field the form does not
// know or that takes the plain input of the core
exports.trpgfieldeditor = function(source,operator,options) {
	var wiki = options.wiki,
		all = relations.types(wiki),
		base = "$:/plugins/tiddlyrpg-core/editor/fields/";
	return each(source,function(field,results) {
		if(field === "date" || field === "price") {
			results.push(base + field);
		} else if(field === "image" || field === "map") {
			results.push(base + "images");
		} else if(all[field] && all[field].kind === "field" && field !== "tags" && field !== "list") {
			results.push(base + "relation");
		}
	});
};

exports.trpgdatemarkers = function(source,operator,options) {
	var wiki = options.wiki;
	return each(source,function(title,results,tiddler) {
		var tags = (tiddler ? tiddler.fields.tags || [] : []).map(function(tag) { return language.internalTitle(wiki,tag); }),
			model = sections.readText(wiki,tiddler ? tiddler.fields.text || "" : "",tags);
		results.push(String(model.records.filter(function(record) {
			return record.kind === "date" && record.counts;
		}).length));
	});
};

exports.trpgformknown = function(source,operator,options) {
	return form.known(options.wiki).slice();
};

exports.trpgformoffered = function(source,operator,options) {
	return each(source,function(title,results) {
		$tw.utils.each(form.offered(options.wiki,title),function(field) {
			if(results.indexOf(field) === -1) {
				results.push(field);
			}
		});
	});
};

exports.trpgtypelist = function(source,operator,options) {
	return types.list(options.wiki).slice();
};

exports.trpgformfields = function(source,operator,options) {
	return each(source,function(title,results) {
		$tw.utils.each(form.fields(options.wiki,title),function(field) {
			if(results.indexOf(field) === -1) {
				results.push(field);
			}
		});
	});
};

exports.trpgtaken = function(source,operator,options) {
	return each(source,function(title,results) {
		var found = title.trim() ? editor.taken(options.wiki,title.trim()) : null;
		if(found) {
			results.push(found);
		}
	});
};
