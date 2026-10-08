/*\
title: $:/plugins/dndwiki-core/modules/relations.js
type: application/javascript
module-type: library
created: 20261008062202000
modified: 20261008072856000

Relations: the rules of the relation types - the one place of them. Used by the relation
filters (filters/relations.js), and through them by the override of $edges.typed and the
relation list.

A relation type is an edge type of tw5-graph: a field (config
$:/config/flibbles/graph/edges/fields/<name>) or a function (.../functions/<name>, field filter).
An arrow points from the dependent to what it depends on: the member to its organisation, the
child to its parent, the work to its creator, the potion to its ingredient, the part to the
whole. The field lives on the dependent.

Our fields on the config of a type:

  dndwiki-exclude     a filter of targets this type does not draw (leader leaves out locations,
                      the function rules draws them)
  dndwiki-symmetric   yes: the relation goes both ways (alliance, family, ...); kept on both ends
  dndwiki-implies     types this one includes (leader: officer member); where A -> B has both,
                      the included one is neither drawn nor listed
  dndwiki-via         function types only: the field whose listings are the candidates for the
                      way back (rules: leader)

Axes: $:/config/dndwiki/graph/axes lists them in order (field list); each axis
$:/config/dndwiki/graph/axes/<axis> is an edge style (JSON, like an edge type config) and lists
its types in order. The axis gives the colour of its edges and the order of the relation list.

Every type draws its own edge; several types between the same two tiddlers stay several edges.

Texts: Edge/<type> (edge label, read from the dependent: "member of"), Field/<type> (group of
the relation list, forward), FieldInverse/<type> (the way back: "Members").

\*/

"use strict";

var language = require("$:/plugins/dndwiki-core/modules/language.js");

var FIELDS = "$:/config/flibbles/graph/edges/fields/",
	FUNCTIONS = "$:/config/flibbles/graph/edges/functions/",
	AXES = "$:/config/dndwiki/graph/axes";

function list(text) {
	return $tw.utils.parseStringArray(text || "") || [];
}

/*
All relation types (global cache): {<name>: {name, kind ("field"|"function"), config, exclude,
filter, symmetric, implies, impliedBy, via, axis, order}}; order is the place in the axes (axis
by axis, type by type), types without an axis come last.
*/
var types = exports.types = function(wiki) {
	return wiki.getGlobalCache("dndwiki-relation-types",function() {
		var result = Object.create(null),
			order = 0;
		var add = function(prefix,kind) {
			$tw.utils.each(wiki.filterTiddlers("[all[shadows+tiddlers]prefix[" + prefix + "]]"),function(title) {
				var name = title.substr(prefix.length),
					fields = (wiki.getTiddler(title) || {fields: {}}).fields;
				if(!name || name.indexOf("/") !== -1 || result[name]) {
					return;
				}
				result[name] = {
					name: name,
					kind: kind,
					config: title,
					exclude: fields["dndwiki-exclude"] || "",
					filter: fields.filter || "",
					symmetric: fields["dndwiki-symmetric"] === "yes",
					implies: list(fields["dndwiki-implies"]),
					impliedBy: [],
					via: fields["dndwiki-via"] || "",
					axis: "",
					order: Infinity
				};
			});
		};
		add(FIELDS,"field");
		add(FUNCTIONS,"function");
		$tw.utils.each(result,function(type) {
			$tw.utils.each(type.implies,function(implied) {
				if(result[implied]) {
					result[implied].impliedBy.push(type.name);
				}
			});
		});
		$tw.utils.each(list((wiki.getTiddler(AXES) || {fields: {}}).fields.list),function(axis) {
			var tiddler = wiki.getTiddler(AXES + "/" + axis);
			$tw.utils.each(list(tiddler && tiddler.fields.list),function(name) {
				if(result[name] && !result[name].axis) {
					result[name].axis = axis;
					result[name].order = order++;
				}
			});
		});
		return result;
	});
};

// The names of all types in order: by axis, then the rest sorted
exports.ordered = function(wiki) {
	var all = types(wiki);
	return Object.keys(all).sort(function(a,b) {
		return all[a].order - all[b].order || (a < b ? -1 : (a > b ? 1 : 0));
	});
};

// The config title of the axis of a type, or ""
exports.axisOf = function(wiki,name) {
	var type = types(wiki)[name];
	return type && type.axis ? AXES + "/" + type.axis : "";
};

// A widget with currentTiddler set, for the filters of a type
function widgetFor(wiki,title) {
	return $tw.rootWidget.makeFakeWidgetWithVariables({currentTiddler: title});
}

/*
The targets <from> has through <name>, the excluded ones left out (cached per change of the
wiki). Function types run their filter with <from> as input and currentTiddler.
*/
var targets = exports.targets = function(wiki,name,from) {
	var type = types(wiki)[name];
	if(!type) {
		return [];
	}
	var cache = wiki.getGlobalCache("dndwiki-relation-targets",function() {
		return Object.create(null);
	});
	var key = name + "\n" + from;
	if(!cache[key]) {
		var widget = widgetFor(wiki,from),
			result;
		if(type.kind === "field") {
			var tiddler = wiki.getTiddler(from);
			result = tiddler ? list(tiddler.fields[name]) : [];
		} else {
			result = type.filter ? wiki.filterTiddlers(type.filter,widget,wiki.makeTiddlerIterator([from])) : [];
		}
		result = result.filter(function(title) {
			return !!title;
		});
		if(type.exclude && result.length) {
			var excluded = wiki.filterTiddlers(type.exclude,widget,wiki.makeTiddlerIterator(result));
			result = result.filter(function(title) {
				return excluded.indexOf(title) === -1;
			});
		}
		cache[key] = result;
	}
	return cache[key];
};

/*
Whether A -> B through <name> is included in another type A -> B has among <selected> (names;
empty: all). The configs name every included type (leader: officer member), no chains.
*/
var included = function(wiki,name,from,to,selected) {
	var type = types(wiki)[name];
	return !!type && type.impliedBy.some(function(other) {
		return (!selected.length || selected.indexOf(other) !== -1) && targets(wiki,other,from).indexOf(to) !== -1;
	});
};

// The targets <from> has through <name> that the type shows: without the included ones
exports.shown = function(wiki,name,from,selected) {
	return targets(wiki,name,from).filter(function(to) {
		return !included(wiki,name,from,to,selected);
	});
};

/*
The tiddlers that have <to> as a shown target of <name> (the way back). Field types: the
listings of the field; function types: the listings of their field dndwiki-via, else none.
*/
exports.sources = function(wiki,name,to,selected) {
	var type = types(wiki)[name];
	if(!type) {
		return [];
	}
	var field = type.kind === "field" ? name : type.via;
	if(!field) {
		return [];
	}
	return wiki.findListingsOfTiddler(to,field).filter(function(from) {
		return targets(wiki,name,from).indexOf(to) !== -1 && !included(wiki,name,from,to,selected);
	});
};

// The edge label of a type (Edge/<type>), or "" if the language has none
exports.label = function(wiki,name) {
	return language.lookup(wiki,"Edge/" + name) || "";
};
