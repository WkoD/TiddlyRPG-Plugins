/*\
title: $:/plugins/tiddlyrpg-core/modules/plugin-types.js
type: application/javascript
module-type: library
created: 20261009175258363
modified: 20261009175258363

Plugin types `ruleset` (a rules system, e.g. D&D 5e) and `setting` (a campaign setting with
calendar and currency, e.g. the Forgotten Realms). Of each type one plugin is active, chosen in
$:/config/tiddlyrpg/<type>; startup/plugin-types.js switches them like the core switches themes.

The one rule of which plugin is active (state(), also used by the operators, the settings tab and
scripts/check-wiki.js):
  - config "none": none
  - config names an installed plugin of the type that is not disabled
    ($:/config/Plugins/Disabled/<title> = yes): that one
  - otherwise the first installed, not disabled plugin of the type by title, or none; a config
    that names something else is reported as a problem: "missing" (no such tiddler), "disabled",
    "type" (no plugin of this type)

Data plugins name the core version they need in the field tiddlyrpg-core-version of their
plugin.info, as ">=x.y.z" (only this form). versionProblems() lists the plugins whose need the
core does not meet, or whose field has another form. $tw.utils.checkVersions only reads x.y.z,
so the ">=" is cut off first.

\*/

"use strict";

var TYPES = ["ruleset","setting"],
	CONFIG = "$:/config/tiddlyrpg/",
	DISABLED = "$:/config/Plugins/Disabled/",
	CORE = "$:/plugins/tiddlyrpg-core",
	VERSION_FIELD = "tiddlyrpg-core-version",
	NONE = "none";

exports.TYPES = TYPES;
exports.NONE = NONE;

// Title of the config tiddler of a type
exports.config = function(type) {
	return CONFIG + type;
};

function disabled(wiki,title) {
	return (wiki.getTiddlerText(DISABLED + title) || "").trim() === "yes";
}

// The installed plugins of a type, sorted by title; with all, disabled ones too
exports.installed = function(wiki,type,all) {
	var results = [];
	wiki.each(function(tiddler,title) {
		if(tiddler.isPlugin() && tiddler.fields["plugin-type"] === type && !tiddler.fields["draft.of"] && (all || !disabled(wiki,title))) {
			results.push(title);
		}
	});
	return results.sort();
};

// {configured, active, problem, installed} of a type, see the header
exports.state = function(wiki,type) {
	var configured = (wiki.getTiddlerText(CONFIG + type) || "").trim(),
		installed = exports.installed(wiki,type),
		active = null,
		problem = null;
	if(configured === NONE) {
		active = null;
	} else if(configured && installed.indexOf(configured) !== -1) {
		active = configured;
	} else {
		if(configured) {
			var tiddler = wiki.getTiddler(configured);
			if(!tiddler) {
				problem = "missing";
			} else if(tiddler.isPlugin() && tiddler.fields["plugin-type"] === type) {
				problem = "disabled";
			} else {
				problem = "type";
			}
		}
		active = installed[0] || null;
	}
	return {configured: configured, active: active, problem: problem, installed: installed};
};

// The active plugin of a type, or null
exports.active = function(wiki,type) {
	return exports.state(wiki,type).active;
};

// The version of tiddlyrpg-core
exports.coreVersion = function(wiki) {
	var tiddler = wiki.getTiddler(CORE);
	return tiddler ? tiddler.fields.version : null;
};

// The plugins whose tiddlyrpg-core-version is not met: [{title, required, problem}], problem
// "version" (core too old) or "format" (not ">=x.y.z")
exports.versionProblems = function(wiki) {
	var core = exports.coreVersion(wiki),
		results = [];
	wiki.each(function(tiddler,title) {
		var required = tiddler.isPlugin() && tiddler.fields[VERSION_FIELD];
		if(!required) {
			return;
		}
		var match = /^>=\s*(\d+\.\d+\.\d+\S*)$/.exec(required.trim());
		if(!match) {
			results.push({title: title, required: required, problem: "format"});
		} else if(!$tw.utils.checkVersions(core,match[1])) {
			results.push({title: title, required: required, problem: "version"});
		}
	});
	return results.sort(function(a,b) {
		return a.title < b.title ? -1 : (a.title > b.title ? 1 : 0);
	});
};
