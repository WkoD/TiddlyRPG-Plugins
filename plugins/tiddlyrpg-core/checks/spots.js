/*\
title: $:/plugins/tiddlyrpg-core/checks/spots.js
type: application/javascript
module-type: trpg-check
created: 20261015191942000
modified: 20261015191942000

Checks of spots and of the references to them (modules/spots.js; modules/checks.js runs them).

  spots/spotlink      error: a <<spotlink>> whose location does not exist (like a link to a
                      missing tiddler) or whose spot the location does not have; only calls in a
                      section the view sees (the message repeats their text)

\*/

"use strict";

var spots = require("$:/plugins/tiddlyrpg-core/modules/spots.js"),
	sections = require("$:/plugins/tiddlyrpg-core/modules/sections.js");

function exists(wiki,title) {
	return !!title && (wiki.tiddlerExists(title) || wiki.isShadowTiddler(title));
}

exports.rules = [
	{
		id: "spots/spotlink",
		run: function(wiki,title,view) {
			var messages = [];
			$tw.utils.each(spots.read(wiki,title).links,function(link) {
				if(!sections.visible(wiki,title,link.id,view)) {
					return;
				}
				if(!exists(wiki,link.place)) {
					messages.push({level: "error", key: "Spot/PlaceMissing", params: {place: link.place}});
					return;
				}
				var joined = wiki.tiddlerExists(spots.targetOf(wiki,{plain: link.spot, target: ""})),
					found = joined || spots.read(wiki,link.place).spots.some(function(spot) {
						return spot.plain === link.spot;
					});
				if(!found) {
					messages.push({level: "error", key: "Spot/Missing", params: {spot: link.spot, place: link.place}});
				}
			});
			return messages;
		}
	}
];
