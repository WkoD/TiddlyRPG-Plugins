/*
 * The plugin types ruleset and setting (modules/plugin-types.js, startup/plugin-types.js,
 * filters/plugin-types.js): the active plugin is unpacked, a second one of the type is not; a
 * change of the config swaps the shadow tiddlers and reports them as changed; "none"; the
 * default without config (none is created); a config naming a missing, disabled or foreign
 * plugin; the tabs under ControlPanel -> Plugins.
 *
 * The test edition has two rulesets (fixture-ruleset-5e-mini, fixture-ruleset-probe) and two
 * settings (fixture-setting-harptos with the calendar, fixture-setting-krynn); each brings the
 * shadow tiddler $:/tiddlyrpg/fixture/<type> with its name as text. The switcher reacts to
 * change events, which TiddlyWiki dispatches asynchronously: the tests wait for them (settle).
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki, pluginTypes;

var RULESET = "$:/config/tiddlyrpg/ruleset",
	SETTING = "$:/config/tiddlyrpg/setting",
	MINI = "$:/plugins/fixture-ruleset-5e-mini",
	PROBE = "$:/plugins/fixture-ruleset-probe",
	HARPTOS = "$:/plugins/fixture-setting-harptos",
	KRYNN = "$:/plugins/fixture-setting-krynn",
	DISABLED = "$:/config/Plugins/Disabled/";

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		pluginTypes = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/plugin-types.js");
		h.setLanguage(wiki, "de-DE");
		return settle();
	});
});

// After all pending change events (dispatched with nextTick, timers come after)
function settle() {
	return new Promise(function(resolve) {
		setTimeout(resolve, 0);
	});
}

// The plugin the marker shadow of a type comes from, or null
function unpacked(type) {
	var title = "$:/tiddlyrpg/fixture/" + type;
	return wiki.isShadowTiddler(title) ? wiki.getShadowSource(title) : null;
}

function f(text) {
	return h.filter(wiki, text).join(" ");
}

// Sets a tiddler, runs fn once the switch is done, and restores the state before
function withTiddler(title, text, fn) {
	var before = wiki.getTiddler(title);
	wiki.addTiddler(new $tw.Tiddler({title: title, text: text}));
	var restore = function() {
		if(before) {
			wiki.addTiddler(before);
		} else {
			wiki.deleteTiddler(title);
		}
		return settle();
	};
	return settle().then(fn).then(restore, function(error) {
		return restore().then(function() {
			throw error;
		});
	});
}

// The titles of the next change event after fn
function nextChanges(fn) {
	return new Promise(function(resolve) {
		var listener = function(changes) {
			wiki.removeEventListener("change", listener);
			resolve(Object.keys(changes));
		};
		wiki.addEventListener("change", listener);
		fn();
	});
}

function pick(state) {
	return {configured: state.configured, active: state.active, problem: state.problem};
}

test.describe("default without config", function() {
	test("the first plugin of each type by title is active, the second is not unpacked", function() {
		assert.equal(unpacked("ruleset"), MINI);
		assert.equal(unpacked("setting"), HARPTOS);
		assert.equal(f("[trpgplugin[ruleset]]"), MINI);
		assert.equal(f("[trpgplugin[setting]]"), HARPTOS);
	});

	test("no config is created as long as nobody switches", function() {
		assert.equal(wiki.tiddlerExists(RULESET), false);
		assert.equal(wiki.tiddlerExists(SETTING), false);
	});

	test("the installed plugins of a type, by title", function() {
		assert.equal(f("[trpgplugins[ruleset]]"), MINI + " " + PROBE);
		assert.equal(f("[trpgplugins[setting]]"), HARPTOS + " " + KRYNN);
	});

	test("the active setting brings the calendar", function() {
		assert.equal(f("[[1351-07-05]dateformat[]]"), "5. Flamerule 1351");
	});
});

test.describe("switching", function() {
	test("the config chooses the plugin", function() {
		return withTiddler(RULESET, PROBE, function() {
			assert.equal(unpacked("ruleset"), PROBE);
			assert.equal(f("[trpgplugin[ruleset]]"), PROBE);
		}).then(function() {
			assert.equal(unpacked("ruleset"), MINI);
		});
	});

	test("none unpacks no plugin of the type", function() {
		return withTiddler(SETTING, "none", function() {
			assert.equal(unpacked("setting"), null);
			assert.equal(f("[trpgplugin[setting]]"), "");
			assert.equal(wiki.getTiddler("$:/config/tiddlyrpg/calendar"), undefined);
			assert.equal(f("[[1351-07-05]dateformat[]]"), "1351-07-05");
		}).then(function() {
			assert.equal(unpacked("setting"), HARPTOS);
			assert.equal(f("[[1351-07-05]dateformat[]]"), "5. Flamerule 1351");
		});
	});

	test("a switch reports the shadow tiddlers that come and go as changed", function() {
		// The config comes in one event, the shadow tiddlers of the switch in the next
		var seen = [];
		var listener = function(changes) {
			seen = seen.concat(Object.keys(changes));
		};
		wiki.addEventListener("change", listener);
		wiki.addTiddler(new $tw.Tiddler({title: SETTING, text: KRYNN}));
		return settle().then(function() {
			assert.ok(seen.indexOf(SETTING) !== -1);
			assert.ok(seen.indexOf("$:/tiddlyrpg/fixture/setting") !== -1);
			assert.ok(seen.indexOf("$:/config/tiddlyrpg/calendar") !== -1, "the calendar of the outgoing setting");
			assert.ok(seen.indexOf("$:/tiddlyrpg/calendar/Harptos") !== -1);
			seen = [];
			wiki.deleteTiddler(SETTING);
			return settle();
		}).then(function() {
			assert.ok(seen.indexOf("$:/config/tiddlyrpg/calendar") !== -1, "the calendar of the incoming setting");
			assert.equal(unpacked("setting"), HARPTOS);
		}).finally(function() {
			wiki.removeEventListener("change", listener);
		});
	});

	test("the calendar hub follows the setting", function() {
		assert.match(h.body(wiki, "Information"), /Kalender/);
		return withTiddler(SETTING, "none", function() {
			assert.doesNotMatch(h.body(wiki, "Information"), /Kalender/);
		});
	});
});

test.describe("a config naming no usable plugin", function() {
	test("a missing plugin: the default applies, the state reports it", function() {
		return withTiddler(RULESET, "$:/plugins/missing", function() {
			assert.equal(unpacked("ruleset"), MINI);
			assert.deepEqual(pick(pluginTypes.state(wiki, "ruleset")), {configured: "$:/plugins/missing", active: MINI, problem: "missing"});
		});
	});

	test("a plugin of the other type: the default applies, the state reports it", function() {
		return withTiddler(RULESET, KRYNN, function() {
			assert.equal(unpacked("ruleset"), MINI);
			assert.equal(pluginTypes.state(wiki, "ruleset").problem, "type");
		});
	});

	test("a disabled plugin counts as not installed", function() {
		return withTiddler(DISABLED + MINI, "yes", function() {
			assert.equal(unpacked("ruleset"), PROBE);
			assert.equal(f("[trpgplugins[ruleset]]"), PROBE);
			return withTiddler(RULESET, MINI, function() {
				assert.equal(unpacked("ruleset"), PROBE);
				assert.equal(pluginTypes.state(wiki, "ruleset").problem, "disabled");
			});
		}).then(function() {
			assert.equal(unpacked("ruleset"), MINI);
		});
	});

	test("no problem without config or with none", function() {
		assert.equal(pluginTypes.state(wiki, "ruleset").problem, null);
		return withTiddler(RULESET, "none", function() {
			assert.deepEqual(pick(pluginTypes.state(wiki, "ruleset")), {configured: "none", active: null, problem: null});
		});
	});
});

test.describe("ControlPanel -> Plugins", function() {
	var PLUGINS = "$:/core/ui/ControlPanel/Plugins",
		STATE = "$:/state/tab--86143343";

	test("tabs for rulesets and campaign settings with their counts", function() {
		var html = h.render(wiki, "text/html", "{{" + PLUGINS + "}}");
		assert.match(html, />Regelwerke \(2\)</);
		assert.match(html, />Kampagnenwelten \(2\)</);
	});

	test("the tab of the rulesets lists them with name and description", function() {
		return withTiddler(STATE, "$:/plugins/tiddlyrpg-core/ui/controlpanel-rulesets", function() {
			var html = h.render(wiki, "text/html", "{{" + PLUGINS + "}}");
			assert.ok(html.indexOf("fixture-ruleset-5e-mini") !== -1);
			assert.ok(html.indexOf("fixture-ruleset-probe") !== -1);
			assert.ok(html.indexOf("a small ruleset in the style of D&amp;D 5e") !== -1);
		});
	});

	test("the tab of the settings lists them", function() {
		return withTiddler(STATE, "$:/plugins/tiddlyrpg-core/ui/controlpanel-settings", function() {
			var html = h.render(wiki, "text/html", "{{" + PLUGINS + "}}");
			assert.ok(html.indexOf("fixture-setting-harptos") !== -1);
			assert.ok(html.indexOf("fixture-setting-krynn") !== -1);
		});
	});
});
