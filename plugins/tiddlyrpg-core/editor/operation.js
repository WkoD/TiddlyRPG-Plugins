/*\
title: $:/plugins/tiddlyrpg-core/editor/operation.js
type: application/javascript
module-type: texteditoroperation
created: 20261016184211000
modified: 20261022184902362

The text operations of the buttons of the editor toolbar (editor/toolbar/*), sent as
tm-edit-text-operation. They run in the edit-text widget, so they reach the text, the selection
and the draft (this.editTitle); the rules are modules/editor.js.

  trpg-probe   kind: what stands at the cursor for that kind, as JSON in
               $:/temp/tiddlyrpg-core/editor/probe/<draft> - the button sends tm-trpg-probe as
               its dropdown opens (startup/editor-messages.js calls this with the text and the
               selection, as a text operation would focus the text and close the dropdown), so the
               dropdown offers to change or remove what is there; its
               values go to the fields of $:/temp/tiddlyrpg-core/editor/input/<draft>, which the
               dropdown edits
  trpg-edit    kind, op and the values of the dropdown (modules/editor.js apply): changes the
               text as the smallest replacement (undo keeps working), the fields of the draft,
               creates a tiddler and opens it (noted for the draft: cancelling the draft takes it
               back while unchanged, modules/form.js); why nothing changed is a notification

The tags of the draft count under their internal names (a tag typed as "Ereignis" is Event).

\*/

"use strict";

var editor = require("$:/plugins/tiddlyrpg-core/modules/editor.js"),
	form = require("$:/plugins/tiddlyrpg-core/modules/form.js"),
	language = require("$:/plugins/tiddlyrpg-core/modules/language.js"),
	notice = require("$:/plugins/tiddlyrpg-core/modules/notice.js");

var PROBE = "$:/temp/tiddlyrpg-core/editor/probe/",
	INPUT = "$:/temp/tiddlyrpg-core/editor/input/";

function inputOf(widget,operation) {
	var wiki = widget.wiki,
		draft = wiki.getTiddler(widget.editTitle),
		fields = draft ? draft.fields : {};
	return {
		text: operation.text,
		selStart: operation.selStart,
		selEnd: operation.selEnd,
		tags: (fields.tags || []).map(function(tag) { return language.internalTitle(wiki,tag); }),
		fields: fields,
		title: fields["draft.of"] || widget.editTitle
	};
}

function notify(wiki,key) {
	notice.show(wiki,language.t(wiki,key));
}

exports["trpg-probe"] = function(event,operation) {
	var params = event.paramObject || {},
		result = editor.probe(this.wiki,inputOf(this,operation),params.kind),
		found = result.params || {},
		names = found.names || [];
	this.wiki.addTiddler(new $tw.Tiddler({title: PROBE + this.editTitle, type: "application/json", text: JSON.stringify(result)}));
	// The values of the dropdown: those at the cursor, else empty
	this.wiki.addTiddler(new $tw.Tiddler({
		title: INPUT + this.editTitle,
		date: result.date || "",
		label: found.label || "",
		name: found.name || "",
		status: found.status || "",
		names: $tw.utils.stringifyList(names),
		dm: result.form && params.kind === "secret" && !names.length ? "yes" : ""
	}));
};

exports["trpg-edit"] = function(event,operation) {
	var wiki = this.wiki,
		params = event.paramObject || {},
		result = editor.apply(wiki,inputOf(this,operation),params);
	wiki.deleteTiddler(PROBE + this.editTitle);
	if(result.error) {
		notify(wiki,result.error);
		return;
	}
	// The smallest replacement: what differs between the common start and end
	var before = operation.text,
		after = result.text,
		start = 0,
		end = 0;
	while(start < before.length && start < after.length && before[start] === after[start]) {
		start++;
	}
	while(end < before.length - start && end < after.length - start && before[before.length - 1 - end] === after[after.length - 1 - end]) {
		end++;
	}
	operation.cutStart = start;
	operation.cutEnd = before.length - end;
	operation.replacement = after.substring(start,after.length - end);
	operation.newSelStart = result.selStart;
	operation.newSelEnd = result.selEnd;
	if(result.fields) {
		wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler(this.editTitle),result.fields));
	}
	if(result.create) {
		var created = new $tw.Tiddler(wiki.getCreationFields(),result.create,wiki.getModificationFields());
		wiki.addTiddler(created);
		// Cancelling the draft takes it back while it is unchanged (startup/editor-states.js)
		form.noteCreated(wiki,this.editTitle,created);
	}
	if(result.navigate) {
		this.dispatchEvent({type: "tm-navigate", navigateTo: result.navigate, navigateFromTitle: this.editTitle});
	}
};
