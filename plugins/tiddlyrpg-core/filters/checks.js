/*\
title: $:/plugins/tiddlyrpg-core/filters/checks.js
type: application/javascript
module-type: filteroperator
created: 20261015193638000
modified: 20261016184211000

[<title>trpgcheck[]]          the messages of each input tiddler for the active view
                              (modules/checks.js), errors first, each as JSON
                              {"id", "level", "text"} with the text in the wiki language
[<title>trpgcheck[error]]     only the errors (operand hint: only the hints)
[<draft>trpgdraftcheck[]]     the messages of a draft in the editor (checks.forDraft), as JSON
                              {"id", "level", "text", "fix"}; fix is the fix as JSON or ""

\*/

"use strict";

var checks = require("$:/plugins/tiddlyrpg-core/modules/checks.js");

exports.trpgdraftcheck = function(source,operator,options) {
	var wiki = options.wiki,
		results = [];
	source(function(tiddler,title) {
		$tw.utils.each(checks.forDraft(wiki,title),function(message) {
			results.push(JSON.stringify({id: message.id, level: message.level, text: checks.text(wiki,message), fix: message.fix ? JSON.stringify(message.fix) : ""}));
		});
	});
	return results;
};

exports.trpgcheck = function(source,operator,options) {
	var wiki = options.wiki,
		level = operator.operand || "",
		results = [];
	source(function(tiddler,title) {
		$tw.utils.each(checks.forTiddler(wiki,title),function(message) {
			if(!level || message.level === level) {
				results.push(JSON.stringify({id: message.id, level: message.level, text: checks.text(wiki,message)}));
			}
		});
	});
	return results;
};
