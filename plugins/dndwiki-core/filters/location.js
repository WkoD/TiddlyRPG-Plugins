/*\
title: $:/plugins/dndwiki-core/filters/location.js
type: application/javascript
module-type: filteroperator
created: 20261006064449000
modified: 20261006154328000

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
                                location is <title> or (below, only through spots) a part of it
[<title>locationcheck[]]        language keys of the problems of <title> (Location/Check/...)

\*/

"use strict";

var spots = require("$:/plugins/dndwiki-core/modules/spots.js");

var OCCUPANTS = ["Person","Player","Organisation","Deity","Artifact","Item","Material"];

function isLocation(wiki,title) {
	var tiddler = wiki.getTiddler(title);
	return !!tiddler && tiddler.hasTag("Location");
}

function entries(wiki,title) {
	var tiddler = wiki.getTiddler(title);
	return tiddler ? $tw.utils.parseStringArray(tiddler.fields.location || "") || [] : [];
}

// {parent, kind} of a location: "spot" or "location"; parent "" if none
var parentOf = exports.parentOf = function(wiki,title) {
	var owners = (spots.index(wiki).owners[title] || []).filter(function(owner) {
		return isLocation(wiki,owner);
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
	$tw.utils.each(spots.read(wiki,title).spots,function(spot) {
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
			$tw.utils.each(wiki.findListingsOfTiddler(place,"location"),function(candidate) {
				var t = wiki.getTiddler(candidate);
				if(t && !t.isDraft() && OCCUPANTS.some(function(type) { return t.hasTag(type); }) && results.indexOf(candidate) === -1) {
					results.push(candidate);
				}
			});
		});
	});
	return results;
};

// Player tags of a tiddler (the player lock, dnd.visible in functions.tid)
function playerTags(wiki,title) {
	var tiddler = wiki.getTiddler(title);
	return tiddler ? (tiddler.fields.tags || []).filter(function(tag) {
		var t = wiki.getTiddler(tag);
		return !!t && t.hasTag("Player");
	}) : [];
}

exports.locationcheck = function(source,operator,options) {
	var wiki = options.wiki,
		results = [];
	source(function(tiddler,title) {
		var t = wiki.getTiddler(title);
		if(!t) {
			return;
		}
		var keys = [],
			list = entries(wiki,title);
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
			if(parent) {
				var mine = playerTags(wiki,title);
				if(playerTags(wiki,parent).some(function(tag) { return mine.indexOf(tag) === -1; })) {
					keys.push("Location/Check/LockedParent");
				}
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
