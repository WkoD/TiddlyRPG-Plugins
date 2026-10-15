/*\
title: $:/plugins/tiddlyrpg-core/checks/secrets.js
type: application/javascript
module-type: trpg-check
created: 20261015191942000
modified: 20261015191942000

Checks of how a tiddler locks (modules/visibility.js; modules/checks.js runs them).

  secrets/view          error: a tiddler that asks the view itself ($:/state/tiddlyrpg/view,
                        trpg.visible) - lock with the tag Secret, <<secret>> or <$secret> instead
  secrets/transclusion  error: a transclusion of a tiddler tagged Secret - it shows to every
                        view that sees the transcluding tiddler; only for a target the view sees,
                        outside sections it does not see

\*/

"use strict";

var visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js"),
	sections = require("$:/plugins/tiddlyrpg-core/modules/sections.js");

exports.rules = [
	{
		id: "secrets/view",
		run: function(wiki,title) {
			var tiddler = wiki.getTiddler(title),
				text = tiddler ? tiddler.fields.text || "" : "";
			return /\$:\/state\/tiddlyrpg\/view|trpg\.visible|trpgvisible/.test(text) ? [{level: "error", key: "Check/Secrets/View"}] : [];
		}
	},
	{
		id: "secrets/transclusion",
		run: function(wiki,title,view) {
			var parsed = wiki.parseTiddler(title),
				hidden = sections.hiddenRanges(wiki,title,view),
				found = [];
			var walk = function(nodes) {
				$tw.utils.each(nodes,function(node) {
					var attrs = node.attributes || {},
						target = node.type === "transclude" && (attrs["$tiddler"] || attrs.tiddler),
						inHidden = node.start !== undefined && hidden.some(function(range) {
							return node.start >= range[0] && node.start < range[1];
						});
					if(target && target.type === "string" && !inHidden && found.indexOf(target.value) === -1 &&
						visibility.locked(wiki,target.value) && visibility.visible(wiki,target.value,view)) {
						found.push(target.value);
					}
					walk(node.children);
				});
			};
			walk(parsed ? parsed.tree : []);
			return found.map(function(target) {
				return {level: "error", key: "Check/Secrets/Transclusion", params: {target: target}};
			});
		}
	}
];
