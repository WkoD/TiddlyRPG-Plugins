/*\
title: $:/plugins/tiddlyrpg-core/filters/plugin-types.js
type: application/javascript
module-type: filteroperator
created: 20261009175258363
modified: 20261009190000000

Plugin types ruleset and setting (modules/plugin-types.js):

[trpgplugins[ruleset]]           the installed plugins of the type that are not disabled, by title
[trpgplugin[ruleset]]            the active plugin of the type (nothing for none)
[trpgplugin:configured[ruleset]] the text of the config (nothing without config)
[trpgplugin:problem[ruleset]]    the problem of the config: missing, disabled or type (nothing
                                 without problem)
[trpgversionhints[]]             the plugins whose tiddlyrpg-core-version the core does not meet,
                                 as texts in the wiki language

\*/

"use strict";

var pluginTypes = require("$:/plugins/tiddlyrpg-core/modules/plugin-types.js"),
	language = require("$:/plugins/tiddlyrpg-core/modules/language.js");

exports.trpgplugins = function(source,operator,options) {
	return pluginTypes.installed(options.wiki,operator.operand);
};

exports.trpgplugin = function(source,operator,options) {
	var state = pluginTypes.state(options.wiki,operator.operand),
		value = operator.suffix === "configured" ? state.configured :
			operator.suffix === "problem" ? state.problem : state.active;
	return value ? [value] : [];
};

exports.trpgversionhints = function(source,operator,options) {
	var wiki = options.wiki,
		core = pluginTypes.coreVersion(wiki);
	return pluginTypes.versionProblems(wiki).map(function(problem) {
		return language.format(language.t(wiki,"Settings/Check/" + (problem.problem === "format" ? "VersionFormat" : "Version")),
			{title: problem.title, required: problem.required, core: core});
	});
};
