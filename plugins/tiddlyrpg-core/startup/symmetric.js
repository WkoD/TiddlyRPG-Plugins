/*\
title: $:/plugins/tiddlyrpg-core/startup/symmetric.js
type: application/javascript
module-type: startup
created: 20261016184211000
modified: 20261022184902362

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
	language = require("$:/plugins/tiddlyrpg-core/modules/language.js"),
	notice = require("$:/plugins/tiddlyrpg-core/modules/notice.js");


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
			notice.show(wiki,language.format(language.t(wiki,"Editor/Symmetric/Notice"),{titles: changed.join(", ")}));
		}
		return newTiddler;
	});
};
