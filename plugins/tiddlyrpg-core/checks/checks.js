/*\
title: $:/plugins/tiddlyrpg-core/checks/checks.js
type: application/javascript
module-type: trpg-check
created: 20261015193638000
modified: 20261015193638000

A check of the switches themselves (modules/checks.js runs it).

  checks/switches   hint: trpg-noerror or trpg-noinfo names an id that is no rule - a typo
                    switches nothing off

\*/

"use strict";

var checks = require("$:/plugins/tiddlyrpg-core/modules/checks.js");

var FIELDS = {error: "trpg-noerror", hint: "trpg-noinfo"};

exports.rules = [
	{
		id: "checks/switches",
		run: function(wiki,title) {
			var known = checks.rules().map(function(rule) { return rule.id; }),
				messages = [];
			$tw.utils.each(FIELDS,function(field,level) {
				$tw.utils.each(checks.switchedOff(wiki,title,level) || [],function(id) {
					if(known.indexOf(id) === -1) {
						messages.push({level: "hint", key: "Check/Checks/Unknown", params: {field: field, id: id}});
					}
				});
			});
			return messages;
		}
	}
];
