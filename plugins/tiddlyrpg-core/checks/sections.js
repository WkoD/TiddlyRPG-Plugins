/*\
title: $:/plugins/tiddlyrpg-core/checks/sections.js
type: application/javascript
module-type: trpg-check
created: 20261015191942000
modified: 20261016233000000

Checks of the sections of a body (modules/sections.js check(); modules/checks.js runs them).

  sections/structure  error: a short form inside another block, sections of a kind nested,
                      <<secret>> in the middle of a section, a kind in the wrong tiddler, a
                      caption by position, a lock naming no player character, and the problems
                      of a kind itself (a quest marker: no name, no dated section, a name that is
                      no quest, an unknown status, a status by position)

\*/

"use strict";

var sections = require("$:/plugins/tiddlyrpg-core/modules/sections.js");

exports.rules = [
	{
		id: "sections/structure",
		run: function(wiki,title,view) {
			return sections.check(wiki,title,view).map(function(problem) {
				var message = {level: "error", key: problem.key, params: problem.params};
				if(problem.fix) {
					message.fix = problem.fix;
				}
				return message;
			});
		}
	}
];
