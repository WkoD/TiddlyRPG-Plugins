/*
 * Patterns in the tests that pass whatever the plugin does: an order compared as
 * `a.indexOf(x) < a.indexOf(y)` holds when x is missing (-1) - h.inOrder() fails then. Needs no
 * TiddlyWiki boot.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	fs = require("fs"),
	path = require("path");

var ORDER = /\.indexOf\([^()]*\)\s*<\s*[\w.]+\.indexOf\(/;

function files(dir, out) {
	fs.readdirSync(dir, {withFileTypes: true}).forEach(function(entry) {
		var file = path.join(dir, entry.name);
		if(entry.isDirectory()) {
			if(entry.name !== "fixtures") {
				files(file, out);
			}
		} else if(/\.js$/.test(entry.name) && file !== __filename) {
			out.push(file);
		}
	});
	return out;
}

test("no order compared with indexOf: h.inOrder", function() {
	var found = [];
	files(__dirname, []).forEach(function(file) {
		fs.readFileSync(file, "utf8").split(/\r?\n/).forEach(function(line, i) {
			if(ORDER.test(line)) {
				found.push(path.relative(__dirname, file) + ":" + (i + 1) + ": " + line.trim());
			}
		});
	});
	assert.deepEqual(found, []);
});

test("the pattern finds the comparison, not a guarded one or lastIndexOf", function() {
	assert.ok(ORDER.test("assert.ok(html.indexOf(\"a\") < html.indexOf(\"b\"));"));
	assert.ok(!ORDER.test("assert.ok(h.inOrder(html, [\"a\", \"b\"]), html);"));
	assert.ok(!ORDER.test("html.lastIndexOf(\"a\") < html.indexOf(\"b\")"));
});
