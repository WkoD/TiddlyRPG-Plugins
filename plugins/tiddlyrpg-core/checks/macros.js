/*\
title: $:/plugins/tiddlyrpg-core/checks/macros.js
type: application/javascript
module-type: trpg-check
created: 20261015193638000
modified: 20261015193638000

Checks of the macro calls of a body (modules/checks.js runs them).

  macros/unknown      error: a macro nothing defines - it shows nothing (modules/macros-check.js)
  macros/rules        error: a rules macro with a text the ruleset does not understand
                      (modules/rules.js check())

Calls in a section the view does not see are left out: the message would repeat their text.

\*/

"use strict";

var macros = require("$:/plugins/tiddlyrpg-core/modules/macros-check.js"),
	rules = require("$:/plugins/tiddlyrpg-core/modules/rules.js");

function errors(problems) {
	return problems.map(function(problem) {
		return {level: "error", key: problem.key, params: problem.params};
	});
}

exports.rules = [
	{
		id: "macros/unknown",
		run: function(wiki,title,view) {
			return errors(macros.check(wiki,title,view));
		}
	},
	{
		id: "macros/rules",
		run: function(wiki,title,view) {
			return errors(rules.check(wiki,title,view));
		}
	}
];
