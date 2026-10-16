/*\
title: $:/plugins/tiddlyrpg-core/startup/editor-messages.js
type: application/javascript
module-type: startup
created: 20261016184211000
modified: 20261016184211000

Messages of the editor that the edit-text widget does not handle, so they reach the root widget:

  tm-trpg-fix    of the buttons of the messages in the form (editor/form): draft (the title of the
                 draft), fix (the fix as JSON, modules/checks.js). Runs modules/fixes.js on the
                 draft.
  tm-trpg-probe  of the toolbar buttons with a dropdown (editor/toolbar), kind: what stands at the
                 cursor (editor/operation.js trpg-probe). Not a text operation: the engine focuses
                 the text after every operation, and the focus closes the dropdown that has just
                 opened (cancelPopups of the editor). The text and the selection are read from the
                 edit-text widget the message comes through, without focusing it.

\*/

"use strict";

exports.name = "tiddlyrpg-editor-messages";
exports.platforms = ["browser"];
exports.after = ["rootwidget"];
exports.synchronous = true;

var fixes = require("$:/plugins/tiddlyrpg-core/modules/fixes.js");

exports.startup = function() {
	$tw.rootWidget.addEventListener("tm-trpg-fix",function(event) {
		var params = event.paramObject || {},
			fix = null;
		try {
			fix = JSON.parse(params.fix || "null");
		} catch(e) {
			return false;
		}
		fixes.apply($tw.wiki,params.draft,fix);
		return false;
	});
	$tw.rootWidget.addEventListener("tm-trpg-probe",function(event) {
		var widget = event.widget;
		while(widget && !(widget.engine && widget.editTitle)) {
			widget = widget.parentWidget;
		}
		if(widget) {
			var probe = $tw.modules.execute("$:/plugins/tiddlyrpg-core/editor/operation.js")["trpg-probe"];
			probe.call(widget,event,widget.engine.createTextOperation());
		}
		return false;
	});
};
