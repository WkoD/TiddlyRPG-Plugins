/*
 * Language packs of all plugins (also npm run test-lang).
 *
 * For every plugin with a language/ folder, each language is compared with en-GB of the same
 * plugin: no keys missing in the language, no keys en-GB does not know, no titles outside
 * $:/tiddlyrpg/language/<code>/. Keys from en-GB/names.multids are proper names (month names, era)
 * that may fall back to en-GB on purpose; their absence is not reported.
 *
 * Keys are read from .multids files (title prefix + "key: value" lines) and from .tid files
 * (title field). Plugins and languages are found by folder, new ones are checked automatically.
 * Needs no TiddlyWiki boot.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	fs = require("fs"),
	path = require("path");

var pluginsDir = path.join(__dirname, "..", "..", "plugins"),
	BASE = "en-GB";

function readKeys(dir, code) {
	var prefix = "$:/tiddlyrpg/language/" + code + "/",
		keys = {},
		optional = {},
		outside = [];
	fs.readdirSync(dir).forEach(function(file) {
		var text = fs.readFileSync(path.join(dir, file), "utf8").replace(/\r\n/g, "\n"),
			header = text.split("\n\n")[0],
			titleMatch = /^title: (.*)$/m.exec(header);
		if(!titleMatch) {
			return;
		}
		var title = titleMatch[1].trim(),
			add = function(fullTitle) {
				if(fullTitle.indexOf(prefix) !== 0) {
					outside.push(file + ": " + fullTitle);
					return;
				}
				var key = fullTitle.substr(prefix.length);
				keys[key] = true;
				if(file === "names.multids") {
					optional[key] = true;
				}
			};
		if(/\.multids$/.test(file)) {
			text.split("\n\n").slice(1).join("\n\n").split("\n").forEach(function(line) {
				var pos = line.indexOf(":");
				if(line.trim() && line.charAt(0) !== "#" && pos > 0) {
					add(title + line.substr(0, pos).trim());
				}
			});
		} else if(/\.tid$/.test(file)) {
			add(title);
		}
	});
	return {keys: keys, optional: optional, outside: outside};
}

fs.readdirSync(pluginsDir).forEach(function(plugin) {
	var langDir = path.join(pluginsDir, plugin, "language");
	if(!fs.existsSync(langDir)) {
		return;
	}
	var codes = fs.readdirSync(langDir).filter(function(code) {
		return fs.statSync(path.join(langDir, code)).isDirectory();
	});
	test.describe(plugin, function() {
		if(codes.indexOf(BASE) === -1) {
			test("has an " + BASE + " folder", function() {
				assert.fail("no " + BASE + " folder in " + langDir);
			});
			return;
		}
		var base = readKeys(path.join(langDir, BASE), BASE);
		test(BASE + ": titles inside $:/tiddlyrpg/language/" + BASE + "/", function() {
			assert.deepEqual(base.outside, []);
		});
		codes.forEach(function(code) {
			if(code === BASE) {
				return;
			}
			var other = readKeys(path.join(langDir, code), code);
			test(code + ": no missing keys", function() {
				assert.deepEqual(Object.keys(base.keys).filter(function(key) { return !other.keys[key] && !base.optional[key]; }).sort(), []);
			});
			test(code + ": no keys unknown to " + BASE, function() {
				assert.deepEqual(Object.keys(other.keys).filter(function(key) { return !base.keys[key]; }).sort(), []);
			});
			test(code + ": titles inside $:/tiddlyrpg/language/" + code + "/", function() {
				assert.deepEqual(other.outside, []);
			});
		});
	});
});
