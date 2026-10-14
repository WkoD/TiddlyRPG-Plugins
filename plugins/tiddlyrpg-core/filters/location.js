/*\
title: $:/plugins/tiddlyrpg-core/filters/location.js
type: application/javascript
module-type: filteroperator
created: 20261006064449000
modified: 20261014201354000

The location rules - the one place of them. A location lies in another one in two ways:

  "liegt in"  the field location of the location (its first entry), e.g. Baile in the Kingdom
  "Teil von"  a spot of the other location joined to it (modules/spots.js), e.g. a tavern in
              Baile; who is there counts at the other location

A location has one parent: the location that has it as a spot, otherwise its field location.
Only tiddlers tagged Location count as parents. For persons, players and deities the field
location is where they are most likely found (one entry); organisations may have several. For
items (filters/item.js) it is where they lie or are found: an artifact is unique and has one
owner or one location; items and materials may have several of each.

[<title>locationparent[]]       the parent of a location
[<title>locationpath[]]         the parents of a location from the root down (without itself);
                                stops at the first repetition of a cycle
[<title>sublocations[]]         the locations directly in <title>; suffix "all": all below;
                                operand "spot" or "location": only that way
[<title>occupants[]]            persons, players, organisations, deities and items whose
                                location is <title> or (below, only through spots) a part of it;
                                who leads a location (field leader) is there too
[<title>locationgroups[]]       where <title> is, for the path below the title: the places of its
                                field location and the locations it leads (field leader), grouped
                                by their parents; each group as JSON {"path": parents, "places":
                                places}, both title lists. A location: one group of its parents.
                                Places and parents the active view does not see are left out.
[<title>locationcheck[]]        language keys of the problems of <title> (Location/Check/...)

\*/

"use strict";

var spots = require("$:/plugins/tiddlyrpg-core/modules/spots.js"),
	visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js");

var OCCUPANTS = ["Person","Player","Organisation","Deity","Artifact","Item","Material"];

function isLocation(wiki,title) {
	var tiddler = wiki.getTiddler(title);
	return !!tiddler && tiddler.hasTag("Location");
}

function entries(wiki,title) {
	var tiddler = wiki.getTiddler(title);
	return tiddler ? $tw.utils.parseStringArray(tiddler.fields.location || "") || [] : [];
}

// {parent, kind} of a location: "spot" or "location"; parent "" if none. A spot the active view
// does not see makes no parent (modules/spots.js).
var parentOf = exports.parentOf = function(wiki,title) {
	var owners = (spots.index(wiki).owners[title] || []).filter(function(owner) {
		return isLocation(wiki,owner) && spots.ownsVisibly(wiki,owner,title);
	});
	if(owners.length) {
		return {parent: owners[0], kind: "spot"};
	}
	var first = entries(wiki,title)[0];
	if(first && isLocation(wiki,first)) {
		return {parent: first, kind: "location"};
	}
	return {parent: "", kind: ""};
};

// Parents from the root down; {path, cycle}
var path = exports.path = function(wiki,title) {
	var chain = [],
		seen = Object.create(null),
		current = title,
		cycle = false;
	seen[title] = true;
	while(true) {
		var parent = parentOf(wiki,current).parent;
		if(!parent) {
			break;
		}
		if(seen[parent]) {
			cycle = true;
			break;
		}
		seen[parent] = true;
		chain.unshift(parent);
		current = parent;
	}
	return {path: chain, cycle: cycle};
};

// Direct children of a location: [{title, kind}]
function children(wiki,title) {
	var result = [];
	$tw.utils.each(spots.visibleSpots(wiki,title),function(spot) {
		var target = spots.targetOf(wiki,spot);
		if(target && target !== title && isLocation(wiki,target) && parentOf(wiki,target).parent === title) {
			result.push({title: target, kind: "spot"});
		}
	});
	$tw.utils.each(wiki.findListingsOfTiddler(title,"location"),function(child) {
		if(child !== title && isLocation(wiki,child) && parentOf(wiki,child).parent === title && !result.some(function(r) { return r.title === child; })) {
			result.push({title: child, kind: "location"});
		}
	});
	return result;
}

var below = exports.below = function(wiki,title,all,kind) {
	var result = [],
		seen = Object.create(null);
	seen[title] = true;
	var visit = function(current) {
		$tw.utils.each(children(wiki,current),function(child) {
			if(seen[child.title] || (kind && child.kind !== kind)) {
				return;
			}
			seen[child.title] = true;
			result.push(child.title);
			if(all) {
				visit(child.title);
			}
		});
	};
	visit(title);
	return result;
};

exports.locationparent = function(source,operator,options) {
	var results = [];
	source(function(tiddler,title) {
		var parent = parentOf(options.wiki,title).parent;
		if(parent) {
			results.push(parent);
		}
	});
	return results;
};

exports.locationpath = function(source,operator,options) {
	var results = [];
	source(function(tiddler,title) {
		$tw.utils.each(path(options.wiki,title).path,function(parent) {
			results.push(parent);
		});
	});
	return results;
};

exports.sublocations = function(source,operator,options) {
	var all = operator.suffix === "all",
		kind = operator.operand === "spot" || operator.operand === "location" ? operator.operand : "",
		results = [];
	source(function(tiddler,title) {
		$tw.utils.each(below(options.wiki,title,all,kind),function(child) {
			if(results.indexOf(child) === -1) {
				results.push(child);
			}
		});
	});
	return results;
};

exports.occupants = function(source,operator,options) {
	var wiki = options.wiki,
		results = [];
	source(function(tiddler,title) {
		var places = [title].concat(below(wiki,title,true,"spot"));
		$tw.utils.each(places,function(place) {
			var candidates = wiki.findListingsOfTiddler(place,"location").concat(wiki.findListingsOfTiddler(place,"leader"));
			$tw.utils.each(candidates,function(candidate) {
				var t = wiki.getTiddler(candidate);
				if(t && !t.isDraft() && OCCUPANTS.some(function(type) { return t.hasTag(type); }) && results.indexOf(candidate) === -1) {
					results.push(candidate);
				}
			});
		});
	});
	return results;
};

// Whether someone who sees <child> may not see <parent> (modules/visibility.js)
function hiddenParent(wiki,child,parent) {
	var above = visibility.audience(wiki,parent),
		own = visibility.audience(wiki,child);
	if(above === null) {
		return false;
	}
	return own === null || own.some(function(player) { return above.indexOf(player) === -1; });
}

exports.locationgroups = function(source,operator,options) {
	var wiki = options.wiki,
		results = [];
	var seen = function(title) {
		return visibility.visible(wiki,title);
	};
	source(function(tiddler,title) {
		tiddler = wiki.getTiddler(title);
		if(!tiddler) {
			return;
		}
		var groups = [],
			byKey = Object.create(null),
			places = [];
		if(tiddler.hasTag("Location")) {
			var parents = path(wiki,title).path.filter(seen);
			if(parents.length) {
				groups.push({path: parents, places: []});
			}
		} else {
			$tw.utils.parseStringArray(tiddler.fields.location || "").concat(
				$tw.utils.parseStringArray(tiddler.fields.leader || "").filter(function(t) { return isLocation(wiki,t); })
			).forEach(function(place) {
				if(place && places.indexOf(place) === -1 && seen(place)) {
					places.push(place);
				}
			});
			$tw.utils.each(places,function(place) {
				var parents = path(wiki,place).path.filter(seen),
					key = parents.join("\u0000");
				if(!byKey[key]) {
					byKey[key] = {path: parents, places: []};
					groups.push(byKey[key]);
				}
				byKey[key].places.push(place);
			});
		}
		$tw.utils.each(groups,function(group) {
			results.push(JSON.stringify({path: $tw.utils.stringifyList(group.path), places: $tw.utils.stringifyList(group.places)}));
		});
	});
	return results;
};

exports.locationcheck = function(source,operator,options) {
	var wiki = options.wiki,
		results = [];
	source(function(tiddler,title) {
		var t = wiki.getTiddler(title);
		if(!t) {
			return;
		}
		var keys = [],
			list = entries(wiki,title),
			leads = $tw.utils.parseStringArray(t.fields.leader || "") || [];
		if(list.some(function(entry) { return leads.indexOf(entry) !== -1 && isLocation(wiki,entry); })) {
			keys.push("Location/Check/LedAndLocation");
		}
		if(t.hasTag("Location")) {
			var owners = (spots.index(wiki).owners[title] || []).filter(function(owner) {
				return isLocation(wiki,owner);
			});
			if(owners.length > 1) {
				keys.push("Location/Check/SpotTwice");
			}
			if(owners.length && list.length) {
				keys.push("Location/Check/SpotAndLocation");
			}
			if(list.length > 1) {
				keys.push("Location/Check/LocationTwice");
			}
			if(list.length && !owners.length && !isLocation(wiki,list[0])) {
				keys.push("Location/Check/NotALocation");
			}
			if(path(wiki,title).cycle) {
				keys.push("Location/Check/Cycle");
			}
			var parent = parentOf(wiki,title).parent;
			if(parent && hiddenParent(wiki,title,parent)) {
				keys.push("Location/Check/LockedParent");
			}
		} else if(t.hasTag("Person") || t.hasTag("Player")) {
			if(list.length > 1) {
				keys.push("Location/Check/PersonTwice");
			}
		} else if(t.hasTag("Artifact")) {
			var owners = $tw.utils.parseStringArray(t.fields.owner || "") || [];
			if(list.length > 1) {
				keys.push("Location/Check/ArtifactTwice");
			}
			if(owners.length > 1) {
				keys.push("Location/Check/ArtifactOwners");
			}
			if(owners.length && list.length) {
				keys.push("Location/Check/OwnerAndLocation");
			}
		}
		$tw.utils.each(keys,function(key) {
			results.push(key);
		});
	});
	return results;
};
