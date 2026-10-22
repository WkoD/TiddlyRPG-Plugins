/*\
title: $:/plugins/tiddlyrpg-core/startup/content.js
type: application/javascript
module-type: startup
created: 20261022165648795
modified: 20261022165648795

Content packages in the browser (modules/content.js): loads the index of the packages of the active
ruleset from the server (server/content-route.js) into the temp tiddler of the index - at the
start and whenever the choice of the ruleset changes. Without a server of the wiki (the published
copy, a single file) or without the right to write, the index stays empty and nothing of the
packages shows.

  tm-trpg-content-take   param: the id of an entry; draft (optional): the draft it was taken
                         from. Fetches the entry and adds it to the wiki as a tiddler under its
                         title (modules/content.js); from a draft, cancelling the draft takes it
                         back while it is unchanged (modules/form.js noteCreated). A notification
                         names it and what it names in base and spells that the wiki lacks, each
                         with a button to take it too - nothing comes by itself.

\*/

"use strict";

exports.name = "tiddlyrpg-content";
exports.platforms = ["browser"];
exports.after = ["startup"];
exports.synchronous = true;

var content = require("$:/plugins/tiddlyrpg-core/modules/content.js"),
	pluginTypes = require("$:/plugins/tiddlyrpg-core/modules/plugin-types.js"),
	form = require("$:/plugins/tiddlyrpg-core/modules/form.js"),
	language = require("$:/plugins/tiddlyrpg-core/modules/language.js");

var NOTICE = "$:/temp/tiddlyrpg-core/editor/notice",
	RULESET = "$:/config/tiddlyrpg/ruleset";

// Whether the wiki has a server to ask: the sync adaptor of TiddlyWeb, not read-only
function served(wiki) {
	return !!($tw.syncadaptor && $tw.syncadaptor.name === "tiddlyweb") && (wiki.getTiddlerText("$:/status/IsReadOnly") || "").trim() !== "yes";
}

function setIndex(wiki,ruleset,packages) {
	wiki.addTiddler(new $tw.Tiddler({title: content.INDEX, type: "application/json", text: JSON.stringify({ruleset: ruleset, packages: packages})}));
}

function load(wiki) {
	var ruleset = pluginTypes.active(wiki,"ruleset") || "";
	if(!ruleset || !served(wiki)) {
		setIndex(wiki,ruleset,[]);
		return;
	}
	$tw.utils.httpRequest({
		url: "tiddlyrpg/content/index.json?ruleset=" + encodeURIComponent(ruleset),
		type: "GET",
		callback: function(error,data) {
			var packages = [];
			if(!error) {
				try {
					packages = JSON.parse(data).packages || [];
				} catch(e) {}
			}
			setIndex(wiki,ruleset,packages);
		}
	});
}

function notify(wiki,text) {
	wiki.addTiddler(new $tw.Tiddler({title: NOTICE, text: text}));
	$tw.notifier.display(NOTICE);
}

function take(wiki,id,draft) {
	var offer = content.offer(wiki,id);
	if(!offer) {
		return;
	}
	var ruleset = pluginTypes.active(wiki,"ruleset") || "";
	$tw.utils.httpRequest({
		url: "tiddlyrpg/content/entry.json?ruleset=" + encodeURIComponent(ruleset) + "&id=" + encodeURIComponent(id),
		type: "GET",
		callback: function(error,data) {
			var found = null;
			try {
				found = error ? null : JSON.parse(data);
			} catch(e) {}
			// The offer again: the title may have been taken meanwhile
			var title = found && content.titleOf(wiki,found.package,found.entry);
			if(!title) {
				notify(wiki,language.t(wiki,"Content/TakeFailed"));
				return;
			}
			var fields = content.toFields(wiki,found.package,found.entry,title),
				tiddler = new $tw.Tiddler(wiki.getCreationFields(),fields,wiki.getModificationFields());
			wiki.addTiddler(tiddler);
			if(draft && wiki.tiddlerExists(draft)) {
				form.noteCreated(wiki,draft,tiddler);
			}
			var lines = [language.format(language.t(wiki,"Content/Taken"),{title: "[[" + title + "]]"})];
			content.wanting(wiki,fields).forEach(function(w) {
				lines.push(language.format(language.t(wiki,"Content/Wanting"),{title: w.title}) +
					" <$button class=\"trpg-do trpg-small\" message=\"tm-trpg-content-take\" param=\"" + w.id.replace(/"/g,"") + "\">" +
					language.t(wiki,"Content/Take") + "</$button>");
			});
			notify(wiki,lines.join("\n\n"));
		}
	});
}

exports.startup = function() {
	var wiki = $tw.wiki;
	load(wiki);
	wiki.addEventListener("change",function(changes) {
		if(changes[RULESET]) {
			load(wiki);
		}
	});
	$tw.rootWidget.addEventListener("tm-trpg-content-take",function(event) {
		take(wiki,event.param,(event.paramObject || {}).draft);
		return false;
	});
};
