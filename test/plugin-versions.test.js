/*
 * Versions (modules/plugin-types.js): the version of tiddlyrpg-core equals package.json; the field
 * tiddlyrpg-core-version of data plugins (">=x.y.z") met or not, another form reported. A plugin
 * tiddler added in a test is removed again.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	path = require("path"),
	h = require("./helpers");

var $tw, wiki, pluginTypes;

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		pluginTypes = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/plugin-types.js");
	});
});

// The problems as plain data (the module runs in the context of TiddlyWiki, its arrays have
// another prototype)
function problems() {
	return JSON.parse(JSON.stringify(pluginTypes.versionProblems(wiki)));
}

// Runs fn with a plugin tiddler that needs the given core version
function withPlugin(required, fn) {
	var title = "$:/plugins/test-needs";
	wiki.addTiddler(new $tw.Tiddler({title: title, type: "application/json", "plugin-type": "plugin",
		text: "{\"tiddlers\":{}}", "tiddlyrpg-core-version": required}));
	try {
		return fn(title);
	} finally {
		wiki.deleteTiddler(title);
	}
}

test("the version of tiddlyrpg-core equals package.json", function() {
	var pkg = require(path.join(__dirname, "..", "package.json"));
	assert.equal(pluginTypes.coreVersion(wiki), pkg.version);
});

test("the fixture plugins need a version the core meets", function() {
	assert.deepEqual(problems(), []);
});

test("a plugin that needs a newer core is reported", function() {
	withPlugin(">=9.0.0", function(title) {
		assert.deepEqual(problems(), [{title: title, required: ">=9.0.0", problem: "version"}]);
	});
});

test("the version of the core itself and an older one are met", function() {
	withPlugin(">=" + pluginTypes.coreVersion(wiki), function() {
		assert.deepEqual(problems(), []);
	});
	withPlugin(">= 1.4.1", function() {
		assert.deepEqual(problems(), []);
	});
});

test("a version without >= is reported as a wrong form, not as met", function() {
	withPlugin("2.0.0", function(title) {
		assert.deepEqual(problems(), [{title: title, required: "2.0.0", problem: "format"}]);
	});
	withPlugin("^2.0.0", function(title) {
		assert.equal(problems()[0].problem, "format");
	});
});
