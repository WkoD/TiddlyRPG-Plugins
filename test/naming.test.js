/*
 * Names after the rename to TiddlyRPG: no file and no file name below plugins/, scripts/ and
 * editions/ uses an old prefix any more - `dndwiki` (plugins, namespaces, fields), `dnd-` (classes,
 * widgets, data attributes), `dnd.` (functions) or `dnd` before a name (filter operators,
 * vis-network properties). The new prefixes are `tiddlyrpg-`, `trpg-` and `trpg.`.
 *
 * In any case (`DnDWiki-core` too), and only where `dnd` starts a name: `tiddlyrpg-dnd` and
 * `TiddlyRPG-DnD` (the repo with the D&D plugins) and `dnd5e2014` (a ruleset) are no old
 * prefixes. Needs no TiddlyWiki boot.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	fs = require("fs"),
	path = require("path");

var root = path.join(__dirname, ".."),
	OLD = /(?<![\w-])(?:dnd(?=[A-Za-z.-])|tiddlydnd)/i;

function walk(dir, out) {
	fs.readdirSync(dir, {withFileTypes: true}).forEach(function(entry) {
		var file = path.join(dir, entry.name);
		out.push(file);
		if(entry.isDirectory()) {
			walk(file, out);
		}
	});
	return out;
}

var files = ["plugins", "scripts", "editions"].reduce(function(out, dir) {
	return walk(path.join(root, dir), out);
}, []);

test("no file name below plugins/, scripts/ and editions/ uses an old prefix", function() {
	var found = files.filter(function(file) {
		return OLD.test(path.basename(file));
	}).map(function(file) {
		return path.relative(root, file);
	});
	assert.deepEqual(found, []);
});

test("no file of the plugins, scripts and editions uses an old prefix", function() {
	var found = [];
	files.forEach(function(file) {
		if(fs.statSync(file).isDirectory() || /\.(png|jpe?g|gif|webp|ico|woff2?)$/i.test(file)) {
			return;
		}
		fs.readFileSync(file, "utf8").split(/\r?\n/).forEach(function(line, index) {
			if(OLD.test(line)) {
				found.push(path.relative(root, file) + ":" + (index + 1) + ": " + line.trim());
			}
		});
	});
	assert.deepEqual(found, []);
});

test("the pattern finds the old prefixes and passes the new names", function() {
	["dndwiki-core", "$:/config/dndwiki/calendar", "dnd-timeline", "<<dnd.t Event/Year>>",
		"[dndtitle[]]", "dndMapFit", "tiddlydnd-plugins", "DnDWiki-core", "$:/config/DnDWiki/old"].forEach(function(text) {
		assert.ok(OLD.test(text), text);
	});
	["tiddlyrpg-core", "trpg-timeline", "trpg.visible", "tiddlyrpg-dnd", "TiddlyRPG-DnD",
		"tiddlyrpg-ruleset-dnd5e2014", "D&D"].forEach(function(text) {
		assert.ok(!OLD.test(text), text);
	});
});
