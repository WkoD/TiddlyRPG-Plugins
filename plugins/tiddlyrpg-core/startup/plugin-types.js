/*\
title: $:/plugins/tiddlyrpg-core/startup/plugin-types.js
type: application/javascript
module-type: startup
created: 20261009175258363
modified: 20261009175258363

Switches the plugins of the types `ruleset` and `setting` (modules/plugin-types.js): only the
active plugin of each type is unpacked, like the core does with themes and languages
($:/core/modules/pluginswitcher.js, started in $:/core/modules/startup/startup.js).

A subclass of $tw.PluginSwitcher with a switchPlugins() of its own: the original falls back to
fixed default plugins when the config names no tiddler, so "none" would unpack the first plugin,
and its defaults are read only once. Here the active plugin comes from plugin-types.state() on
every switch. It switches again when the config changes, when a plugin of the type is added,
changed or deleted, and when one is disabled or enabled. Like the core after a plugin change
($:/core/modules/startup/plugins.js) it queues change events for the shadow tiddlers that come and
go, so that what shows them (the calendar, the hubs) refreshes.

Runs on every platform before "story", so the static build and the tests see the active plugins.

\*/

"use strict";

exports.name = "tiddlyrpg-plugin-types";
exports.after = ["startup"];
exports.before = ["story"];
exports.synchronous = true;

var pluginTypes = require("$:/plugins/tiddlyrpg-core/modules/plugin-types.js"),
	// Required directly: startup modules load before "load-modules" sets $tw.PluginSwitcher
	PluginSwitcher = require("$:/core/modules/pluginswitcher.js").PluginSwitcher;

function TypeSwitcher(type) {
	this.current = [];
	PluginSwitcher.call(this,{
		wiki: $tw.wiki,
		pluginType: type,
		controllerTitle: pluginTypes.config(type)
	});
	// The core switcher listens to the config only
	var self = this;
	this.wiki.addEventListener("change",function(changes) {
		if(!$tw.utils.hop(changes,self.controllerTitle) && self.concerns(changes)) {
			self.switchPlugins();
		}
	});
}

TypeSwitcher.prototype = Object.create(PluginSwitcher.prototype);
TypeSwitcher.prototype.constructor = TypeSwitcher;

// Whether a change touches a plugin of the type or the switch that disables one
TypeSwitcher.prototype.concerns = function(changes) {
	var self = this;
	return Object.keys(changes).some(function(title) {
		if(title.indexOf("$:/config/Plugins/Disabled/") === 0) {
			return true;
		}
		var tiddler = self.wiki.getTiddler(title);
		return (tiddler && tiddler.fields["plugin-type"] === self.pluginType) || self.current.indexOf(title) !== -1;
	});
};

TypeSwitcher.prototype.switchPlugins = function() {
	var wiki = this.wiki,
		active = pluginTypes.active(wiki,this.pluginType),
		plugins = active ? [active] : [],
		previous = this.current,
		changed = Object.create(null);
	// The shadow tiddlers of the outgoing plugins
	$tw.utils.each(previous,function(title) {
		var info = wiki.getPluginInfo(title);
		$tw.utils.each(info && info.tiddlers,function(fields,shadow) {
			changed[shadow] = true;
		});
	});
	// Same as the core switcher from here; dependents of another type (the core) are not
	// registered by registerPluginTiddlers
	$tw.wiki.readPluginInfo(plugins);
	$tw.wiki.unregisterPluginTiddlers(this.pluginType);
	$tw.wiki.registerPluginTiddlers(this.pluginType,plugins);
	$tw.wiki.unpackPluginTiddlers();
	// The shadow tiddlers of the incoming plugins
	$tw.utils.each(plugins,function(title) {
		var info = wiki.getPluginInfo(title);
		$tw.utils.each(info && info.tiddlers,function(fields,shadow) {
			changed[shadow] = false;
		});
	});
	this.current = plugins;
	// Not on the first switch at startup: nothing is rendered yet
	if(previous.length || this.started) {
		$tw.utils.each(Object.keys(changed),function(title) {
			wiki.enqueueTiddlerEvent(title,changed[title],true);
		});
	}
	this.started = true;
};

exports.startup = function() {
	$tw.tiddlyrpgPluginSwitchers = pluginTypes.TYPES.map(function(type) {
		return new TypeSwitcher(type);
	});
};
