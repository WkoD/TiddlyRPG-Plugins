/*\
title: $:/plugins/tiddlyrpg-core/checks/spots.js
type: application/javascript
module-type: trpg-check
created: 20261015191942000
modified: 20261015200756000

Checks of spots and of the references to them (modules/spots.js; modules/checks.js runs them).

  spots/spotlink      error: a <<spotlink>> whose location does not exist (like a link to a
                      missing tiddler) or whose spot the location does not have; only calls in a
                      section the view sees (the message repeats their text)
  spots/similar       hint: a spot without a tiddler whose name looks like a title written
                      another way (checks.similar(): case, spaces and punctuation aside, or one
                      letter or two swapped in longer names) - a typo makes a point of its own
                      instead of joining the tiddler

\*/

"use strict";

var spots = require("$:/plugins/tiddlyrpg-core/modules/spots.js"),
	sections = require("$:/plugins/tiddlyrpg-core/modules/sections.js"),
	visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js"),
	checks = require("$:/plugins/tiddlyrpg-core/modules/checks.js");

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
	},
	{
		id: "spots/similar",
		run: function(wiki,title,view) {
			var tiddler = wiki.getTiddler(title);
			if(!tiddler || !tiddler.hasTag("Location")) {
				return [];
			}
			var titles = plainTitles(wiki),
				messages = [];
			$tw.utils.each(spots.visibleSpots(wiki,title,view),function(spot) {
				if(spot.target || wiki.tiddlerExists(spots.targetOf(wiki,spot))) {
					return;
				}
				var name = checks.plain(spot.plain),
					similar = (titles.byLength[name.length - 1] || []).concat(titles.byLength[name.length] || [],titles.byLength[name.length + 1] || []).filter(function(entry) {
						return entry.title !== title && checks.similar(spot.plain,entry.title) && visibility.visible(wiki,entry.title,view);
					});
				if(similar.length) {
					messages.push({level: "hint", key: "Check/Spots/Similar", params: {spot: spot.plain, title: similar[0].title}});
				}
			});
			return messages;
		}
	}
];

// The titles that are no system tiddlers, by the length of their plain form (global cache)
function plainTitles(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-checks-plain-titles",function() {
		var byLength = Object.create(null);
		wiki.each(function(tiddler,title) {
			if(!wiki.isSystemTiddler(title) && !tiddler.isDraft()) {
				var plain = checks.plain(title);
				(byLength[plain.length] = byLength[plain.length] || []).push({title: title, plain: plain});
			}
		});
		return {byLength: byLength};
	});
}
