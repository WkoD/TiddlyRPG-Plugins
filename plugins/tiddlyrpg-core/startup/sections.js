/*\
title: $:/plugins/tiddlyrpg-core/startup/sections.js
type: application/javascript
module-type: startup
created: 20261023183447205
modified: 20261023183447205

The kinds of sections of the ruleset (modules/sections.js rulesKinds: D&D <<effect "Name">>,
<<action "Bite">>): their procedures, one per kind in the temp tiddler PROCEDURES, tagged
$:/tags/Global, each drawing the name of its section (trpg.sectionname, functions.tid) - its text
and its frame come from the parse tree (trpg-nest, the block), as for a quest marker -, and their
block forms (sections.registerBlocks). At the start, after the plugins of the ruleset are
unpacked (startup/plugin-types.js), and anew when the ruleset or a domain changes; a temp
tiddler, so it is neither saved nor sent to the server - every side writes its own.

\*/

"use strict";

exports.name = "tiddlyrpg-sections";
exports.platforms = ["browser","node"];
exports.after = ["tiddlyrpg-plugin-types"];
exports.before = ["rootwidget","story"];
exports.synchronous = true;

var sections = require("$:/plugins/tiddlyrpg-core/modules/sections.js");

var PROCEDURES = exports.PROCEDURES = "$:/temp/tiddlyrpg-core/sections/procedures";

var text = exports.text = function(wiki) {
	return Object.keys(sections.rulesKinds(wiki)).sort().map(function(id) {
		return "\\procedure " + id + "(name)\n<$transclude $variable=\"trpg.sectionname\" name=<<name>>/>\n\\end";
	}).join("\n\n");
};

function update(wiki) {
	sections.registerBlocks(wiki);
	var wanted = text(wiki);
	if(wanted !== wiki.getTiddlerText(PROCEDURES,"")) {
		if(wanted) {
			wiki.addTiddler(new $tw.Tiddler({title: PROCEDURES, tags: "$:/tags/Global", type: "text/vnd.tiddlywiki", text: wanted}));
		} else {
			wiki.deleteTiddler(PROCEDURES);
		}
	}
}

exports.startup = function() {
	var wiki = $tw.wiki;
	update(wiki);
	wiki.addEventListener("change",function(changes) {
		if(Object.keys(changes).some(function(title) {
			return title !== PROCEDURES && (title.indexOf("$:/tiddlyrpg/rules/domain/") === 0 || title.indexOf("$:/config/tiddlyrpg/") === 0 ||
				title.indexOf("$:/plugins/") === 0 || title.indexOf("$:/config/Plugins/Disabled/") === 0);
		})) {
			update(wiki);
		}
	});
};
