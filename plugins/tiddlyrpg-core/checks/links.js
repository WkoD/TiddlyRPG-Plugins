/*\
title: $:/plugins/tiddlyrpg-core/checks/links.js
type: application/javascript
module-type: trpg-check
created: 20261015194805000
modified: 20261026071425205

Checks of the links in a body (the links of the model of modules/sections.js; modules/checks.js
runs them).

  links/missing   hint: a link to a tiddler that does not exist - create it, unlink it or leave
                  it on purpose. Linked from several tiddlers, the hint says from how many (a
                  target many link is likely worth a tiddler). The name of a spot: the hint names
                  its location and <<spotlink>>. Only links in sections the view sees, none to
                  system tiddlers; the count and the spot only as far as the view sees them, a
                  draft counted as the tiddler it is the draft of
  links/locked    hint: a link to a locked tiddler in text that a view sees which does not see the
                  tiddler (the public view, else the views of players) - there the link shows its
                  title, as text or as its target ([[House|Secret Place]]). Not a link in a note
                  of the DM; told only to a view that sees the tiddler

\*/

"use strict";

var sections = require("$:/plugins/tiddlyrpg-core/modules/sections.js"),
	spots = require("$:/plugins/tiddlyrpg-core/modules/spots.js"),
	visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js");

// Whether <title> links <target> in a section the view sees
function linksVisibly(wiki,title,target,view) {
	return visibility.visible(wiki,title,view) && sections.read(wiki,title).links.some(function(link) {
		return link.to === target && sections.visible(wiki,title,link.section,view);
	});
}

// A location the view sees with a spot of that name the view sees, or ""
function spotPlace(wiki,target,view) {
	var places = (spots.index(wiki).names[target] || []).filter(function(place) {
		return visibility.visible(wiki,place,view) && spots.visibleSpots(wiki,place,view).some(function(spot) {
			return spot.plain === target;
		});
	});
	return places[0] || "";
}

exports.rules = [
	{
		id: "links/missing",
		run: function(wiki,title,view) {
			var seen = Object.create(null),
				messages = [];
			$tw.utils.each(sections.read(wiki,title).links,function(link) {
				var target = link.to;
				if(!target || seen[target] || wiki.isSystemTiddler(target) || wiki.tiddlerExists(target) || wiki.isShadowTiddler(target) ||
					!sections.visible(wiki,title,link.section,view)) {
					return;
				}
				seen[target] = true;
				var place = spotPlace(wiki,target,view);
				if(place) {
					messages.push({level: "hint", key: "Check/Links/MissingSpot", params: {target: target, place: place}});
					return;
				}
				// A draft counts as the tiddler it is the draft of: next to it once, not twice
				var linkers = [];
				$tw.utils.each(wiki.getTiddlerBacklinks(target),function(linker) {
					var tiddler = wiki.getTiddler(linker),
						as = (tiddler && tiddler.fields["draft.of"]) || linker;
					if(linkers.indexOf(as) === -1 && linksVisibly(wiki,linker,target,view)) {
						linkers.push(as);
					}
				});
				var count = linkers.length;
				messages.push(count > 1 ?
					{level: "hint", key: "Check/Links/MissingOften", params: {target: target, count: count}, fix: {kind: "create", title: target, type: ""}} :
					{level: "hint", key: "Check/Links/Missing", params: {target: target}, fix: {kind: "create", title: target, type: ""}});
			});
			return messages;
		}
	},
	{
		id: "links/locked",
		run: function(wiki,title,view) {
			var seen = Object.create(null),
				messages = [],
				views = [{mode: "public"}].concat(visibility.players(wiki).map(function(player) {
					return {mode: "player", player: player};
				}));
			$tw.utils.each(sections.read(wiki,title).links,function(link) {
				var target = link.to;
				if(!target || seen[target] || link.frame || !visibility.locked(wiki,target) || !visibility.visible(wiki,target,view) ||
					!sections.visible(wiki,title,link.section,view)) {
					return;
				}
				// The views that see the link but not its target: the public view alone if it is
				// one of them (every player sees what it sees), else the players
				var told = views.filter(function(other) {
					return visibility.visible(wiki,title,other) && sections.visible(wiki,title,link.section,other) &&
						!visibility.visible(wiki,target,other);
				});
				if(!told.length) {
					return;
				}
				seen[target] = true;
				messages.push(told[0].mode === "public" ?
					{level: "hint", key: "Check/Links/LockedPublic", params: {target: target}} :
					{level: "hint", key: "Check/Links/Locked", params: {target: target, players: told.map(function(other) { return other.player; }).join(", ")}});
			});
			return messages;
		}
	}
];
