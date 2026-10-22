/*\
title: $:/plugins/tiddlyrpg-core/modules/fixes.js
type: application/javascript
module-type: library
created: 20261016184211000
modified: 20261022160104767

The fixes of the messages of the checks (field fix, modules/checks.js) on a draft in the editor:
the button of a message in the form (editor/form) sends tm-trpg-fix, startup/editor-messages.js
runs apply(). Only the draft changes - cancelling the editor takes the fix back. The text fixes
read the text with the same rules as the check (modules/editor.js). A fix "create" is no change of
the draft: the form sends tm-new-tiddler itself.

  apply(wiki,draft,fix)   true if the draft changed

\*/

"use strict";

var editor = require("$:/plugins/tiddlyrpg-core/modules/editor.js"),
	language = require("$:/plugins/tiddlyrpg-core/modules/language.js");

function list(value) {
	return $tw.utils.parseStringArray(value || "") || [];
}

exports.apply = function(wiki,draft,fix) {
	var tiddler = wiki.getTiddler(draft);
	if(!tiddler || !fix || !fix.kind) {
		return false;
	}
	var fields = tiddler.fields,
		tags = (fields.tags || []).map(function(tag) { return language.internalTitle(wiki,tag); }),
		text = fields.text || "",
		change = {},
		values;
	switch(fix.kind) {
		case "remove":
			values = list(fields[fix.field]).filter(function(v) { return v !== fix.value; });
			change[fix.field] = values.length ? $tw.utils.stringifyList(values) : undefined;
			break;
		case "add":
			values = list(fields[fix.field]);
			if(values.indexOf(fix.value) !== -1) {
				return false;
			}
			change[fix.field] = $tw.utils.stringifyList(values.concat([fix.value]));
			break;
		case "tag":
			if(tags.indexOf(fix.tag) !== -1) {
				return false;
			}
			change.tags = (fields.tags || []).concat([fix.tag]);
			break;
		case "tagToLocation":
			if(list(fields.location).length) {
				return false;
			}
			change.tags = (fields.tags || []).filter(function(tag) { return tag !== fix.tag; });
			change.location = $tw.utils.stringifyList([fix.tag]);
			break;
		case "questStatus":
			change.text = editor.questStatusNamed(wiki,text,tags,fix.start);
			break;
		case "dateLabel":
			change.text = editor.dateLabelNamed(wiki,text,tags,fix.start);
			break;
		case "spotEmpty":
			change.text = editor.spotEmptied(wiki,text,tags,fix.start);
			break;
		default:
			return false;
	}
	if(change.text === null) {
		return false;
	}
	wiki.addTiddler(new $tw.Tiddler(tiddler,change));
	return true;
};
