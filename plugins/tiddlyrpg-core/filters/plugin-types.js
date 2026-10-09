/*\
title: $:/plugins/tiddlyrpg-core/filters/plugin-types.js
type: application/javascript
module-type: filteroperator
created: 20261009175258363
modified: 20261009175258363

Plugin types ruleset and setting (modules/plugin-types.js):

[trpgplugins[ruleset]]           the installed plugins of the type that are not disabled, by title
[trpgplugin[ruleset]]            the active plugin of the type (nothing for none)

\*/

"use strict";

var pluginTypes = require("$:/plugins/tiddlyrpg-core/modules/plugin-types.js");

exports.trpgplugins = function(source,operator,options) {
	return pluginTypes.installed(options.wiki,operator.operand);
};

exports.trpgplugin = function(source,operator,options) {
	var active = pluginTypes.active(options.wiki,operator.operand);
	return active ? [active] : [];
};
