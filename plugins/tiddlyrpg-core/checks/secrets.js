/*\
title: $:/plugins/tiddlyrpg-core/checks/secrets.js
type: application/javascript
module-type: trpg-check
created: 20261015191942000
modified: 20261015200756000

Checks of how a tiddler locks (modules/visibility.js; modules/checks.js runs them).

  secrets/view          error: a tiddler that asks the view itself ($:/state/tiddlyrpg/view or the
                        operator trpgview) - lock with the tag Secret, <<secret>> or <$secret>
                        instead. trpg.visible is fine: it is how a list leaves out what the view
                        does not see
  secrets/transclusion  error: a transclusion of a tiddler tagged Secret where someone sees it who
                        may not see the secret - it shows to every view that sees the place it
                        stands in. Fine inside a tiddler or a section locked for the same players
                        or fewer (modules/visibility.js audience). Only for a target the view sees,
                        outside sections it does not see

\*/

"use strict";

var visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js"),
	sections = require("$:/plugins/tiddlyrpg-core/modules/sections.js");

// Who besides the DM may see a lock: null for everyone, else the real players (as
// visibility.audience). Narrower is a subset; [] is the DM only.
function narrower(a,b) {
	if(b === null) {
		return a;
	}
	if(a === null) {
		return b;
	}
	return a.filter(function(player) { return b.indexOf(player) !== -1; });
}

// The players of a list of names of player characters
function players(wiki,names) {
	var result = [];
	$tw.utils.each(names,function(name) {
		var player = visibility.playerOf(wiki,name);
		if(player && result.indexOf(player) === -1) {
			result.push(player);
		}
	});
	return result.sort();
}

// The locked sections of a body: [{from, to, audience}] - a section locked by every lock of
// itself and its parents
function lockRanges(wiki,title) {
	var model = sections.read(wiki,title),
		result = [];
	$tw.utils.each(model.records,function(record) {
		if(record.from === undefined) {
			return;
		}
		var audience = null;
		for(var up = record.id; up !== -1 && up !== undefined; up = model.records[up].parent) {
			$tw.utils.each(model.records[up].locks,function(list) {
				audience = narrower(audience,players(wiki,list));
			});
		}
		if(audience !== null) {
			result.push({from: record.from, to: record.to, audience: audience});
		}
	});
	return result;
}

// Who may see the place at <pos> in the body of <title>: the tiddler and every locked section
// around it
function placeAudience(wiki,title,locks,pos) {
	var audience = visibility.audience(wiki,title);
	$tw.utils.each(locks,function(lock) {
		if(pos !== undefined && pos >= lock.from && pos < lock.to) {
			audience = narrower(audience,lock.audience);
		}
	});
	return audience;
}

// Whether everyone who may see the place may see the target too
function covered(place,target) {
	if(target === null) {
		return true;
	}
	if(place === null) {
		return false;
	}
	return place.every(function(player) { return target.indexOf(player) !== -1; });
}

exports.rules = [
	{
		id: "secrets/view",
		run: function(wiki,title) {
			var tiddler = wiki.getTiddler(title),
				text = tiddler ? tiddler.fields.text || "" : "";
			return /\$:\/state\/tiddlyrpg\/view|trpgview[\[:]/.test(text) ? [{level: "error", key: "Check/Secrets/View"}] : [];
		}
	},
	{
		id: "secrets/transclusion",
		run: function(wiki,title,view) {
			var parsed = wiki.parseTiddler(title),
				hidden = sections.hiddenRanges(wiki,title,view),
				locks = lockRanges(wiki,title),
				found = [];
			// A node of {{...}} has no position of its own: it takes the one of the nearest node above
			var walk = function(nodes,above) {
				$tw.utils.each(nodes,function(node) {
					var attrs = node.attributes || {},
						pos = node.start !== undefined ? node.start : above,
						target = node.type === "transclude" && (attrs["$tiddler"] || attrs.tiddler),
						inHidden = pos !== undefined && hidden.some(function(range) {
							return pos >= range[0] && pos < range[1];
						});
					if(target && target.type === "string" && !inHidden && found.indexOf(target.value) === -1 &&
						visibility.locked(wiki,target.value) && visibility.visible(wiki,target.value,view) &&
						!covered(placeAudience(wiki,title,locks,pos),visibility.audience(wiki,target.value))) {
						found.push(target.value);
					}
					walk(node.children,pos);
				});
			};
			walk(parsed ? parsed.tree : []);
			return found.map(function(target) {
				return {level: "error", key: "Check/Secrets/Transclusion", params: {target: target}};
			});
		}
	}
];
