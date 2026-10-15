/*\
title: $:/plugins/tiddlyrpg-core/checks/plugins.js
type: application/javascript
module-type: trpg-check
created: 20261015191942000
modified: 20261015191942000

Checks of the plugins of the wiki (modules/plugin-types.js, modules/currency.js;
modules/checks.js runs them). The titles are system tiddlers: in the wiki the same problems show
under ControlPanel -> Settings -> TiddlyRPG and in the hub Currency, here they serve
scripts/check-wiki.js.

  plugins/choice    error: $:/config/tiddlyrpg/ruleset or .../setting names a plugin that is
                    missing, disabled or of another type (another one is active)
  plugins/version   error: a plugin whose tiddlyrpg-core-version the core does not meet, or that
                    is not written ">=x.y.z"
  plugins/currency  error: a currency whose reference (the coin of the prices of the ruleset) is
                    none of its coins

\*/

"use strict";

var pluginTypes = require("$:/plugins/tiddlyrpg-core/modules/plugin-types.js"),
	currency = require("$:/plugins/tiddlyrpg-core/modules/currency.js");

exports.rules = [
	{
		id: "plugins/choice",
		scope: "wiki",
		run: function(wiki) {
			var messages = [];
			$tw.utils.each(pluginTypes.TYPES,function(type) {
				var state = pluginTypes.state(wiki,type);
				if(state.problem) {
					messages.push({title: pluginTypes.config(type), level: "error", key: "Check/Plugins/" + state.problem,
						params: {configured: state.configured, active: state.active || "-"}});
				}
			});
			return messages;
		}
	},
	{
		id: "plugins/version",
		scope: "wiki",
		run: function(wiki) {
			return pluginTypes.versionProblems(wiki).map(function(problem) {
				return {title: problem.title, level: "error", key: problem.problem === "format" ? "Settings/Check/VersionFormat" : "Settings/Check/Version",
					params: {title: problem.title, required: problem.required, core: pluginTypes.coreVersion(wiki)}};
			});
		}
	},
	{
		id: "plugins/currency",
		scope: "wiki",
		run: function(wiki) {
			var cur = currency.active(wiki);
			if(!cur || cur.referenceValid) {
				return [];
			}
			return [{title: wiki.getTiddlerText("$:/config/tiddlyrpg/currency").trim(), level: "error", key: "Check/Plugins/Reference",
				params: {reference: cur.reference, coins: cur.coins.map(function(c) { return c.id; }).join(", ")}}];
		}
	}
];
