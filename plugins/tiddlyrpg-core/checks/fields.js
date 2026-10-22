/*\
title: $:/plugins/tiddlyrpg-core/checks/fields.js
type: application/javascript
module-type: trpg-check
created: 20261022140929737
modified: 20261022140929737

Checks of the fields of the rules (modules/fields.js; modules/checks.js runs them).

  fields/schema   error: a definition with a name the core or a relation uses, a field defined
                  twice (the ruleset and the wiki, or two tiddlers), a schema that lists a field
                  without definition

\*/

"use strict";

var fields = require("$:/plugins/tiddlyrpg-core/modules/fields.js");

exports.rules = [
	{
		id: "fields/schema",
		scope: "wiki",
		run: function(wiki) {
			return fields.problems(wiki).map(function(problem) {
				return {title: problem.title, level: "error", key: problem.key, params: problem.params};
			});
		}
	}
];
