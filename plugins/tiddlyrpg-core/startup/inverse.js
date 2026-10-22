/*\
title: $:/plugins/tiddlyrpg-core/startup/inverse.js
type: application/javascript
module-type: startup
created: 20261022171029770
modified: 20261022184902362

Hook th-saving-tiddler: the ways back chosen in the form (modules/inverse.js, "give an item") go to
the other ends - each gets the title of the saved tiddler in its field -, and their fields go from
the saved tiddler. A notification names what changed. Cancelling changes nothing.

\*/

"use strict";

exports.name = "tiddlyrpg-inverse";
exports.after = ["startup"];
exports.synchronous = true;

var inverse = require("$:/plugins/tiddlyrpg-core/modules/inverse.js"),
	language = require("$:/plugins/tiddlyrpg-core/modules/language.js"),
	notice = require("$:/plugins/tiddlyrpg-core/modules/notice.js");


exports.startup = function() {
	$tw.hooks.addHook("th-saving-tiddler",function(newTiddler) {
		var wiki = $tw.wiki;
		if(!newTiddler || !Object.keys(newTiddler.fields).some(function(key) { return key.indexOf(inverse.FIELD) === 0; })) {
			return newTiddler;
		}
		var done = inverse.apply(wiki,newTiddler.fields),
			cleared = {};
		Object.keys(newTiddler.fields).forEach(function(key) {
			if(key.indexOf(inverse.FIELD) === 0) {
				cleared[key] = undefined;
			}
		});
		if(done.changed.length) {
			notice.show(wiki,language.format(language.t(wiki,"Editor/Inverse/Notice"),{titles: done.changed.join(", ")}));
		}
		return new $tw.Tiddler(newTiddler,cleared);
	});
};
