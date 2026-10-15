/*\
title: $:/plugins/tiddlyrpg-core/checks/relations.js
type: application/javascript
module-type: trpg-check
created: 20261015194724000
modified: 20261015194724000

Checks of the relation fields (the types of modules/relations.js; modules/checks.js runs them).
The field types come from their configs ($:/config/flibbles/graph/edges/fields/*), so a new type
is checked without a change here - except tags and list, the fields of TiddlyWiki itself that
tw5-graph draws as well: they are no relations.

  relations/missing     error: a relation field names a tiddler that does not exist; for
                        location with the spot of that name, if there is one (a tiddler with
                        the name of the spot joins it)
  relations/included    hint: an entry that another field to the same target includes
                        (tiddlyrpg-implies: member or officer next to leader, ancestor next to
                        parent) - it is neither drawn nor listed
  relations/former      error: member and former, or owner and former, name the same target -
                        a member or a former member, an owner or a former one
  relations/symmetric   hint: a symmetric type (tiddlyrpg-symmetric: spouse, sibling, family,
                        alliance, bond, enmity) that the other side has and this one not
  relations/siblings    hint: a child of the same parent without sibling between the two - true
                        siblings, half siblings or deliberately without
  relations/family      hint: family next to another family relation of the same pair (parent,
                        ancestor, spouse, sibling in either direction)
  relations/ancestor    hint: an ancestor the line of parents already reaches over a generation
                        of its own - the line or the ancestor may go
  relations/leaders     hint: an organisation led by several living tiddlers - a council is
                        fine (switch it off with trpg-noinfo), else one too many
  relations/deadleader  hint: a dead tiddler (date ends) that still leads (field leader) - who
                        followed?

A message that names another tiddler is left out for a view that does not see it.

\*/

"use strict";

var relations = require("$:/plugins/tiddlyrpg-core/modules/relations.js"),
	visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js"),
	spots = require("$:/plugins/tiddlyrpg-core/modules/spots.js"),
	dates = require("$:/plugins/tiddlyrpg-core/modules/dates.js");

var FAMILY = ["parent","ancestor","spouse","sibling"],
	CORE_FIELDS = ["tags","list"];

function list(wiki,title,field) {
	var tiddler = wiki.getTiddler(title);
	return tiddler ? $tw.utils.parseStringArray(tiddler.fields[field] || "") || [] : [];
}

function exists(wiki,title) {
	return wiki.tiddlerExists(title) || wiki.isShadowTiddler(title);
}

// The relation types that are fields
function fieldTypes(wiki) {
	var all = relations.types(wiki);
	return Object.keys(all).sort().filter(function(name) {
		return all[name].kind === "field" && CORE_FIELDS.indexOf(name) === -1;
	}).map(function(name) {
		return all[name];
	});
}

function dead(wiki,title) {
	var tiddler = wiki.getTiddler(title);
	return !!tiddler && !tiddler.hasTag("Event") && dates.parse(tiddler.fields.date || "").ended;
}

function others(wiki,title) {
	var tiddler = wiki.getTiddler(title);
	return !!tiddler && !tiddler.isDraft();
}

exports.rules = [
	{
		id: "relations/missing",
		run: function(wiki,title,view) {
			var messages = [];
			$tw.utils.each(fieldTypes(wiki),function(type) {
				$tw.utils.each(list(wiki,title,type.name),function(target) {
					if(exists(wiki,target)) {
						return;
					}
					// A spot of that name the view sees, at a location it sees
					var places = type.name === "location" ? (spots.index(wiki).names[target] || []).filter(function(place) {
						return visibility.visible(wiki,place,view) && spots.visibleSpots(wiki,place,view).some(function(spot) {
							return spot.plain === target;
						});
					}) : [];
					messages.push(places.length ?
						{level: "error", key: "Check/Relations/MissingSpot", params: {field: type.name, target: target, place: places[0]}} :
						{level: "error", key: "Check/Relations/Missing", params: {field: type.name, target: target}});
				});
			});
			return messages;
		}
	},
	{
		id: "relations/included",
		run: function(wiki,title,view) {
			var all = relations.types(wiki),
				messages = [];
			$tw.utils.each(fieldTypes(wiki),function(type) {
				$tw.utils.each(relations.targets(wiki,type.name,title),function(target) {
					$tw.utils.each(type.impliedBy,function(other) {
						if(all[other] && all[other].kind === "field" && relations.targets(wiki,other,title).indexOf(target) !== -1 &&
							visibility.visible(wiki,target,view)) {
							messages.push({level: "hint", key: "Check/Relations/Included", params: {field: type.name, other: other, target: target}});
						}
					});
				});
			});
			return messages;
		}
	},
	{
		id: "relations/former",
		run: function(wiki,title,view) {
			var former = list(wiki,title,"former"),
				messages = [];
			$tw.utils.each(["member","owner"],function(field) {
				$tw.utils.each(list(wiki,title,field),function(target) {
					if(former.indexOf(target) !== -1 && visibility.visible(wiki,target,view)) {
						messages.push({level: "error", key: "Check/Relations/Former", params: {field: field, target: target}});
					}
				});
			});
			return messages;
		}
	},
	{
		id: "relations/symmetric",
		run: function(wiki,title,view) {
			var messages = [];
			$tw.utils.each(fieldTypes(wiki),function(type) {
				if(!type.symmetric) {
					return;
				}
				var own = list(wiki,title,type.name);
				$tw.utils.each(wiki.findListingsOfTiddler(title,type.name),function(other) {
					if(other !== title && own.indexOf(other) === -1 && others(wiki,other) && visibility.visible(wiki,other,view)) {
						messages.push({level: "hint", key: "Check/Relations/Symmetric", params: {field: type.name, other: other}});
					}
				});
			});
			return messages;
		}
	},
	{
		id: "relations/siblings",
		run: function(wiki,title,view) {
			var own = list(wiki,title,"sibling"),
				seen = {},
				messages = [];
			$tw.utils.each(list(wiki,title,"parent"),function(parent) {
				$tw.utils.each(wiki.findListingsOfTiddler(parent,"parent"),function(child) {
					if(child === title || seen[child] || own.indexOf(child) !== -1 || list(wiki,child,"sibling").indexOf(title) !== -1 ||
						!others(wiki,child) || !visibility.visible(wiki,child,view) || !visibility.visible(wiki,parent,view)) {
						return;
					}
					seen[child] = true;
					messages.push({level: "hint", key: "Check/Relations/Siblings", params: {other: child, parent: parent}});
				});
			});
			return messages;
		}
	},
	{
		id: "relations/family",
		run: function(wiki,title,view) {
			return list(wiki,title,"family").filter(function(other) {
				return visibility.visible(wiki,other,view) && FAMILY.some(function(field) {
					return list(wiki,title,field).indexOf(other) !== -1 || list(wiki,other,field).indexOf(title) !== -1;
				});
			}).map(function(other) {
				return {level: "hint", key: "Check/Relations/Family", params: {other: other}};
			});
		}
	},
	{
		id: "relations/ancestor",
		run: function(wiki,title,view) {
			var ancestors = list(wiki,title,"ancestor");
			if(!ancestors.length) {
				return [];
			}
			// The line of parents from two generations up, each once
			var reached = Object.create(null),
				level = list(wiki,title,"parent"),
				seen = Object.create(null);
			seen[title] = true;
			for(var depth = 1; level.length; depth++) {
				var next = [];
				$tw.utils.each(level,function(parent) {
					if(seen[parent]) {
						return;
					}
					seen[parent] = true;
					if(depth > 1) {
						reached[parent] = true;
					}
					next = next.concat(list(wiki,parent,"parent"));
				});
				level = next;
			}
			return ancestors.filter(function(ancestor) {
				return reached[ancestor] && visibility.visible(wiki,ancestor,view);
			}).map(function(ancestor) {
				return {level: "hint", key: "Check/Relations/Ancestor", params: {other: ancestor}};
			});
		}
	},
	{
		id: "relations/leaders",
		run: function(wiki,title,view) {
			var tiddler = wiki.getTiddler(title);
			if(!tiddler || !tiddler.hasTag("Organisation")) {
				return [];
			}
			var leaders = wiki.findListingsOfTiddler(title,"leader").filter(function(leader) {
				return others(wiki,leader) && !dead(wiki,leader) && visibility.visible(wiki,leader,view);
			}).sort();
			return leaders.length > 1 ? [{level: "hint", key: "Check/Relations/Leaders", params: {leaders: leaders.join(", ")}}] : [];
		}
	},
	{
		id: "relations/deadleader",
		run: function(wiki,title) {
			var led = list(wiki,title,"leader");
			return led.length && dead(wiki,title) ? [{level: "hint", key: "Check/Relations/DeadLeader", params: {targets: led.join(", ")}}] : [];
		}
	}
];
