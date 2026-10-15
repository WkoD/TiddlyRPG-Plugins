/*\
title: $:/plugins/tiddlyrpg-core/checks/locations.js
type: application/javascript
module-type: trpg-check
created: 20261015191942000
modified: 20261015201837000

Checks of where a tiddler is (the rules of filters/location.js; modules/checks.js runs them).

  locations/structure   error: a location that is a spot of several locations, a spot and has a
                        field location, has several locations, names something that is no
                        location, lies in a cycle, or whose parent is hidden from someone who
                        sees it (view of the DM only); a person with several locations; an
                        artifact in several places, with several owners, or with owner and
                        location
  locations/led         hint: location names a location leader already holds (whoever controls
                        a location is present there)
  locations/tag         error: a location as tag (locations are never tags)

\*/

"use strict";

var spots = require("$:/plugins/tiddlyrpg-core/modules/spots.js"),
	visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js"),
	location = require("$:/plugins/tiddlyrpg-core/filters/location.js");

function isLocation(wiki,title) {
	var tiddler = wiki.getTiddler(title);
	return !!tiddler && tiddler.hasTag("Location");
}

function list(tiddler,field) {
	return tiddler ? $tw.utils.parseStringArray(tiddler.fields[field] || "") || [] : [];
}

// Whether someone who sees <child> may not see <parent> (modules/visibility.js)
function hiddenParent(wiki,child,parent) {
	var above = visibility.audience(wiki,parent),
		own = visibility.audience(wiki,child);
	if(above === null) {
		return false;
	}
	return own === null || own.some(function(player) { return above.indexOf(player) === -1; });
}

function error(key) {
	return {level: "error", key: key};
}

exports.rules = [
	{
		id: "locations/structure",
		run: function(wiki,title,view) {
			var t = wiki.getTiddler(title);
			if(!t) {
				return [];
			}
			var messages = [],
				places = list(t,"location");
			if(t.hasTag("Location")) {
				var owners = (spots.index(wiki).owners[title] || []).filter(function(owner) {
					return isLocation(wiki,owner);
				});
				if(owners.length > 1) {
					messages.push(error("Location/Check/SpotTwice"));
				}
				if(owners.length && places.length) {
					messages.push(error("Location/Check/SpotAndLocation"));
				}
				if(places.length > 1) {
					messages.push(error("Location/Check/LocationTwice"));
				}
				if(places.length && !owners.length && !isLocation(wiki,places[0])) {
					messages.push(error("Location/Check/NotALocation"));
				}
				if(location.path(wiki,title).cycle) {
					messages.push(error("Location/Check/Cycle"));
				}
				var parent = location.parentOf(wiki,title).parent;
				// Only for the DM: it tells that there is a parent someone does not see
				if(parent && view.mode === "dm" && hiddenParent(wiki,title,parent)) {
					messages.push(error("Location/Check/LockedParent"));
				}
			} else if(t.hasTag("Person") || t.hasTag("Player")) {
				if(places.length > 1) {
					messages.push(error("Location/Check/PersonTwice"));
				}
			} else if(t.hasTag("Artifact")) {
				var owned = list(t,"owner");
				if(places.length > 1) {
					messages.push(error("Location/Check/ArtifactTwice"));
				}
				if(owned.length > 1) {
					messages.push(error("Location/Check/ArtifactOwners"));
				}
				if(owned.length && places.length) {
					messages.push(error("Location/Check/OwnerAndLocation"));
				}
			}
			return messages;
		}
	},
	{
		id: "locations/led",
		run: function(wiki,title) {
			var t = wiki.getTiddler(title),
				leads = list(t,"leader");
			return list(t,"location").some(function(place) {
				return leads.indexOf(place) !== -1 && isLocation(wiki,place);
			}) ? [{level: "hint", key: "Location/Check/LedAndLocation"}] : [];
		}
	},
	{
		id: "locations/tag",
		run: function(wiki,title,view) {
			var tiddler = wiki.getTiddler(title);
			return (tiddler ? tiddler.fields.tags || [] : []).filter(function(tag) {
				return isLocation(wiki,tag) && visibility.visible(wiki,tag,view);
			}).map(function(tag) {
				return {level: "error", key: "Check/Locations/Tag", params: {tag: tag}};
			});
		}
	}
];
