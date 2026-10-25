/*\
title: $:/plugins/tiddlyrpg-core/modules/relations.js
type: application/javascript
module-type: library
created: 20261008062202000
modified: 20261025135015562

Relations: the rules of the relation types - the one place of them. Used by the relation
filters (filters/relations.js), and through them by the override of $edges.typed and the
relation list.

A relation type is an edge type of tw5-graph: a field (config
$:/config/flibbles/graph/edges/fields/<name>) or a function (.../functions/<name>, field filter).
An arrow points from the dependent to what it depends on: the member to its organisation, the
child to its parent, the work to its creator, the potion to its ingredient, the part to the
whole. The field lives on the dependent.

Our fields on the config of a type:

  tiddlyrpg-exclude     a filter of targets this type does not draw (leader leaves out locations,
                      the function rules draws them)
  tiddlyrpg-symmetric   yes: the relation goes both ways (alliance, family, ...); kept on both ends
  tiddlyrpg-implies     types this one includes (leader: officer member); where A -> B has both,
                      the included one is neither drawn nor listed
  tiddlyrpg-via         function types only: the field whose listings are the candidates for the
                      way back (rules: leader)
  tiddlyrpg-inverse     yes: the form of a tiddler it may name offers the way back (owner: "give an
                      item"), tiddlyrpg-sources the filter of what may carry the field
                      (modules/inverse.js)
  tiddlyrpg-copy        yes: setting it in the form copies the values of the rules of the target
                      into the draft once, where it has none (base: the base item; modules/form.js
                      copyFrom())
  tiddlyrpg-tree        a filter of the holders (classes, folk: persons, player characters,
                      creatures): the type is a tree of its targets as well. On a holder it says
                      what it has, on a target what that belongs to (a subclass its class, a
                      subfolk its folk; several parents alike); a holder that names an entry
                      names one of its parents too (checks/relations.js relations/parent). The
                      way back of the relation list is split by the kind of its sources.
  tiddlyrpg-card        top: the card of a player character shows only the entries of the tree
                      without parent (the classes, not their subclasses and choices); leaf: only
                      the last of each row (the subfolk, whose name says its folk)

Axes: $:/config/tiddlyrpg/graph/axes lists them in order (field list); each axis
$:/config/tiddlyrpg/graph/axes/<axis> is an edge style (JSON, like an edge type config) and lists
its types in order. The axis gives the colour of its edges and the order of the relation list.

Every type draws its own edge; several types between the same two tiddlers stay several edges.

Texts: Edge/<type> (edge label, read from the dependent: "member of"; Edge/<type>/<hub> for a
dependent of that hub), Field/<type> (group of
the relation list, forward), FieldInverse/<type> (the way back: "Members").

\*/

"use strict";

var language = require("$:/plugins/tiddlyrpg-core/modules/language.js"),
	quests = require("$:/plugins/tiddlyrpg-core/modules/quests.js");

var FIELDS = "$:/config/flibbles/graph/edges/fields/",
	FUNCTIONS = "$:/config/flibbles/graph/edges/functions/",
	AXES = "$:/config/tiddlyrpg/graph/axes";

function list(text) {
	return $tw.utils.parseStringArray(text || "") || [];
}

/*
All relation types (global cache): {<name>: {name, kind ("field"|"function"), config, exclude,
filter, symmetric, implies, impliedBy, via, axis, order}}; order is the place in the axes (axis
by axis, type by type), types without an axis come last.
*/
var types = exports.types = function(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-relation-types",function() {
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
					exclude: fields["tiddlyrpg-exclude"] || "",
					filter: fields.filter || "",
					symmetric: fields["tiddlyrpg-symmetric"] === "yes",
					implies: list(fields["tiddlyrpg-implies"]),
					impliedBy: [],
					via: fields["tiddlyrpg-via"] || "",
					candidates: fields["tiddlyrpg-targets"] || "",
					copy: fields["tiddlyrpg-copy"] === "yes",
					tree: fields["tiddlyrpg-tree"] || "",
					card: fields["tiddlyrpg-card"] || "",
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
// The tags a filter of candidates names ("[tag[Person]] [tag[Player]]"): the types a relation
// may name (tiddlyrpg-targets), what may carry it (tiddlyrpg-sources)
exports.tagsOf = function(filter) {
	var out = [],
		re = /tag\[([^\]]+)\]/g,
		m;
	while(filter && (m = re.exec(filter))) {
		out.push(m[1]);
	}
	return out;
};

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
	var cache = wiki.getGlobalCache("tiddlyrpg-relation-targets",function() {
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
listings of the field; function types: the listings of their field tiddlyrpg-via, else none.
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

// The kinds of the switches (relations block, map, search), by tag; the first that fits counts
var KINDS = [["Player","player"],["Person","person"],["Organisation","organisation"],["Deity","person"],
	["Location","location"],["Artifact","item"],["Item","item"],["Material","item"],["Quest","quest"],
	["Creature","creature"],["Spell","spell"],["Information","information"]];

/*
The kind of a title: player, person (deities too), organisation, location, item (artifacts and
materials too), quest (a quest or a rumour, a name with markers), creature, spell, information (its
categories too: folks, classes, traits, feats, languages, the glossary), with
<events> also event; else other.
*/
exports.kindOf = function(wiki,title,events) {
	var tiddler = wiki.getTiddler(title),
		kind = "other";
	if(tiddler) {
		$tw.utils.each(KINDS,function(entry) {
			if(kind === "other" && tiddler.hasTag(entry[0])) {
				kind = entry[1];
			}
		});
		if(kind === "other" && events && tiddler.hasTag("Event")) {
			kind = "event";
		}
	} else if(quests.index(wiki).names.indexOf(title) !== -1) {
		kind = "quest";
	}
	return kind;
};

// The label of the field <name> on <title> (relation list, block of values, form):
// Field/<name>/<type> for a type of <title> that has one ("Attunement by" on an item), else
// Field/<name>
exports.fieldLabel = function(wiki,name,title) {
	var found = null;
	$tw.utils.each(require("$:/plugins/tiddlyrpg-core/modules/types.js").of(wiki,title),function(type) {
		found = found || language.lookup(wiki,"Field/" + name + "/" + type);
	});
	return found || language.t(wiki,"Field/" + name);
};

// The edge label of a type (Edge/<type>), or "" if the language has none; with <from> the
// label for the type of the tiddler the edge starts at, if the language has one
// (Edge/classes/Item: "attunement by")
exports.label = function(wiki,name,from) {
	var found = null;
	if(from) {
		$tw.utils.each(require("$:/plugins/tiddlyrpg-core/modules/types.js").of(wiki,from),function(type) {
			found = found || language.lookup(wiki,"Edge/" + name + "/" + type);
		});
	}
	return found || language.lookup(wiki,"Edge/" + name) || "";
};

/*
Trees (tiddlyrpg-tree): the targets of a type are entries that belong to others of the same type
through the same field.

  parents(wiki,name,title)   what <title> belongs to: its field <name>, or for an entry of a
                             content package not taken the field of the entry
  holder(wiki,name,title)    whether <title> is a holder of the tree of <name> (its filter)
  lines(wiki,name,title,visible)  the entries <title> names in tree order: one line per entry
                             without a parent among them, each [top, ...descendants] depth
                             first in the order of the field; an entry <visible> refuses takes
                             its branch with it
*/
var parents = exports.parents = function(wiki,name,title) {
	var tiddler = wiki.getTiddler(title);
	if(tiddler) {
		return list(tiddler.fields[name]);
	}
	var content = require("$:/plugins/tiddlyrpg-core/modules/content.js"),
		hit = content.forRelation(wiki,name,title),
		value = hit && hit.entry.fields ? hit.entry.fields[name] : "";
	return $tw.utils.isArray(value) ? value.slice() : list(value);
};

exports.holder = function(wiki,name,title) {
	var type = types(wiki)[name];
	return !!type && !!type.tree && wiki.filterTiddlers(type.tree,widgetFor(wiki,title),wiki.makeTiddlerIterator([title])).indexOf(title) !== -1;
};

exports.lines = function(wiki,name,title,visible) {
	var named = targets(wiki,name,title),
		used = Object.create(null),
		out = [];
	var below = function(entry,line) {
		$tw.utils.each(named,function(other) {
			if(!used[other] && parents(wiki,name,other).indexOf(entry) !== -1) {
				used[other] = true;
				if(!visible || visible(other)) {
					line.push(other);
					below(other,line);
				}
			}
		});
	};
	$tw.utils.each(named,function(entry) {
		var top = !parents(wiki,name,entry).some(function(p) { return named.indexOf(p) !== -1 && p !== entry; });
		if(top && !used[entry]) {
			used[entry] = true;
			if(!visible || visible(entry)) {
				var line = [entry];
				below(entry,line);
				out.push(line);
			}
		}
	});
	return out;
};

/*
The groups of the way back of a tree in the relation list, in order: the hubs of the switches
(kindHubs, from trpg.kindhubs), Information split into its categories (a class, a trait ... each
under its plural) before Information itself. group() the group of a title, "" for none.
*/
var KIND_HUB = {player: "Player", person: "Person", organisation: "Organisation", location: "Location", item: "Item",
	creature: "Creature", spell: "Spell", quest: "Quest", information: "Information"};

exports.groups = function(wiki,kindHubs) {
	var categories = require("$:/plugins/tiddlyrpg-core/modules/categories.js").of(wiki,"Information").slice().sort(),
		out = [];
	$tw.utils.each(kindHubs,function(hub) {
		if(hub === "Information") {
			out = out.concat(categories);
		}
		out.push(hub);
	});
	return out;
};

exports.group = function(wiki,title) {
	var categories = require("$:/plugins/tiddlyrpg-core/modules/categories.js").of(wiki,"Information"),
		own = require("$:/plugins/tiddlyrpg-core/modules/types.js").of(wiki,title).filter(function(t) { return categories.indexOf(t) !== -1; })[0];
	return own || KIND_HUB[exports.kindOf(wiki,title)] || "";
};
