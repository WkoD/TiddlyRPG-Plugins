/*
 * The inventory of CLAUDE.md against the files: every filter operator of tiddlyrpg-core is named
 * in the header of its module and in CLAUDE.md (those of editor.js only in its header, as
 * CLAUDE.md says), and CLAUDE.md names every file of the folders of the plugin. A new operator,
 * stylesheet or template that is not written down fails here; a name CLAUDE.md keeps after its
 * file or operator is gone is not found. Needs no TiddlyWiki boot.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	fs = require("fs"),
	path = require("path");

var root = path.join(__dirname, ".."),
	core = path.join(root, "plugins", "tiddlyrpg-core"),
	doc = fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8"),
	// modules whose operators CLAUDE.md leaves to their header
	HEADER_ONLY = ["editor.js"],
	// one file per theme: test/checks.test.js compares the themes
	FOLDERS = ["filters", "modules", "widgets", "styles", "startup", "ui", "viewtemplates", "templates", "editor", "config"];

function named(text, name) {
	return new RegExp("(^|[^\\w-])" + name.replace(/[.$]/g, "\\$&") + "($|[^\\w-])").test(text);
}

function operators() {
	var out = [];
	fs.readdirSync(path.join(core, "filters")).filter(function(file) { return /\.js$/.test(file); }).forEach(function(file) {
		var text = fs.readFileSync(path.join(core, "filters", file), "utf8"),
			header = text.slice(text.indexOf("/*\\"), text.indexOf("\\*/")),
			re = /^exports\.([a-z0-9]+)\s*=/gm,
			m;
		while((m = re.exec(text))) {
			out.push({file: file, name: m[1], header: header});
		}
	});
	return out;
}

test("every filter operator is named in the header of its module", function() {
	assert.deepEqual(operators().filter(function(op) { return !named(op.header, op.name); }).map(function(op) {
		return op.file + ": " + op.name;
	}), []);
});

test("every filter operator is named in CLAUDE.md (editor.js: in its header)", function() {
	assert.deepEqual(operators().filter(function(op) {
		return HEADER_ONLY.indexOf(op.file) === -1 && !named(doc, op.name);
	}).map(function(op) { return op.file + ": " + op.name; }), []);
});

test("CLAUDE.md names every file of the plugin", function() {
	var missing = [];
	FOLDERS.forEach(function(folder) {
		fs.readdirSync(path.join(core, folder)).filter(function(file) { return !/\.meta$/.test(file); }).forEach(function(file) {
			var base = file.replace(/\.(js|tid|css|json|multids)$/, "");
			if(!named(doc, base) && !named(doc, file)) {
				missing.push(folder + "/" + file);
			}
		});
	});
	assert.deepEqual(missing, []);
});

test("the check finds what is missing", function() {
	assert.ok(named("`trpgfieldlines`, `x`", "trpgfieldlines"));
	assert.ok(!named("`trpgfieldlines`", "trpgfieldline"), "a longer name is no mention");
	assert.ok(!named("`title-hub`", "title"), "nor part of a hyphenated one");
});
