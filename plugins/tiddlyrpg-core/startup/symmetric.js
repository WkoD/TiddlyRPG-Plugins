/*\
title: $:/plugins/tiddlyrpg-core/startup/symmetric.js
type: application/javascript
module-type: startup
created: 20261016184211000
modified: 20261016184211000

Hook th-saving-tiddler: a symmetric relation saved in the editor goes to the other end as well,
an entry taken out leaves it there too (modules/symmetric.js). Compared with the tiddler as it
was before - for a renamed one the title the draft was of, whose other ends get the new title. A
notification names the tiddlers it changed. Cancelling the editor changes nothing, as the hook
runs on saving only.

\*/

"use strict";

exports.name = "tiddlyrpg-symmetric";
exports.after = ["startup"];
exports.synchronous = true;

var symmetric = require("$:/plugins/tiddlyrpg-core/modules/symmetric.js"),
	language = require("$:/plugins/tiddlyrpg-core/modules/language.js");

var NOTICE = "$:/temp/tiddlyrpg-core/editor/notice";

exports.startup = function() {
	$tw.hooks.addHook("th-saving-tiddler",function(newTiddler,draftTiddler) {
		var wiki = $tw.wiki;
		if(!newTiddler || !symmetric.enabled(wiki)) {
			return newTiddler;
		}
		var title = newTiddler.fields.title,
			was = draftTiddler && draftTiddler.fields["draft.of"] ? draftTiddler.fields["draft.of"] : title,
			before = wiki.getTiddler(was),
			changed = symmetric.sync(wiki,title,before ? before.fields : null,newTiddler.fields,was);
		if(changed.length) {
			wiki.addTiddler(new $tw.Tiddler({title: NOTICE, text: language.format(language.t(wiki,"Editor/Symmetric/Notice"),{titles: changed.join(", ")})}));
			if($tw.notifier) {
				$tw.notifier.display(NOTICE);
			}
		}
		return newTiddler;
	});
};
