/*\
title: $:/plugins/tiddlyrpg-core/checks/links.js
type: application/javascript
module-type: trpg-check
created: 20261015194724000
modified: 20261015194724000

Checks of the links in a body (the links of the model of modules/sections.js; modules/checks.js
runs them).

  links/missing   hint: a link to a tiddler that does not exist - create it, unlink it or leave
                  it on purpose; only links in sections the view sees, none to system tiddlers

\*/

"use strict";

var sections = require("$:/plugins/tiddlyrpg-core/modules/sections.js");

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
				messages.push({level: "hint", key: "Check/Links/Missing", params: {target: target}});
			});
			return messages;
		}
	}
];
