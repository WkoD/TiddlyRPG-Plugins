/*\
title: $:/plugins/tiddlyrpg-core/startup/content-include.js
type: application/javascript
module-type: startup
created: 20261103173828774
modified: 20261103173828774

Includes the entries of the content packages the wiki names (modules/content-include.js) as the
plugin $:/plugins/tiddlyrpg/content-packages - on Node, before the syncer of the core starts
("startup"): the plugin counts as saved and is never written into tiddlers/; before the commands
run, so the server (--listen), the build (--build) and check-wiki.js have it alike. The page the
server sends and the built page carry it like any plugin.

The ruleset and the setting are unpacked only after "startup" (startup/plugin-types.js); for the
round they are unpacked here and unregistered again, so the switchers start as before. Nothing
happens without packages in <wiki>/node_modules or with the plugin switched off
($:/config/Plugins/Disabled/$:/plugins/tiddlyrpg/content-packages).

What comes in during a session on the server (a new relation to an entry) stays an offer of the
index of the browser until the next start.

\*/

"use strict";

exports.name = "tiddlyrpg-content-include";
exports.platforms = ["node"];
exports.after = ["load-modules"];
exports.before = ["startup"];
exports.synchronous = true;

exports.startup = function() {
	var wiki = $tw.wiki,
		content = require("$:/plugins/tiddlyrpg-core/modules/content.js"),
		include = require("$:/plugins/tiddlyrpg-core/modules/content-include.js"),
		pluginTypes = require("$:/plugins/tiddlyrpg-core/modules/plugin-types.js"),
		wikiPath = $tw.boot.wikiPath,
		disabled = (wiki.getTiddlerText("$:/config/Plugins/Disabled/" + content.PLUGIN) || "").trim() === "yes";
	if(!wikiPath || disabled) {
		return;
	}
	var plugins = pluginTypes.TYPES.map(function(type) {
			return pluginTypes.active(wiki,type);
		}).filter(Boolean);
	if(!plugins.length) {
		return;
	}
	wiki.readPluginInfo(plugins);
	pluginTypes.TYPES.forEach(function(type) {
		wiki.registerPluginTiddlers(type,plugins);
	});
	wiki.unpackPluginTiddlers();
	var tiddlers = include.collect(wiki,wikiPath),
		count = Object.keys(tiddlers).length;
	pluginTypes.TYPES.forEach(function(type) {
		wiki.unregisterPluginTiddlers(type);
	});
	wiki.unpackPluginTiddlers();
	if(count) {
		$tw.utils.log("Content: " + count + " entries of content packages included");
	}
};
