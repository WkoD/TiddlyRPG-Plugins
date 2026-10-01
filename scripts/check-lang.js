#!/usr/bin/env node
/*
 * Checks the language packs of all plugins (npm run check-lang).
 *
 * For every plugin with a language/ folder, each language is compared with en-GB of the same
 * plugin: keys missing in a language and keys en-GB does not know are reported. Keys from
 * en-GB/names.multids are proper names (month names, era) that may fall back to en-GB on
 * purpose; their absence is not reported.
 *
 * Keys are read from .multids files (title prefix + "key: value" lines) and from .tid files
 * (title field), relative to $:/dndwiki/language/<code>/.
 */
var fs = require("fs"),
	path = require("path");

var root = path.join(__dirname, ".."),
	pluginsDir = path.join(root, "plugins"),
	BASE = "en-GB",
	problems = 0;

function readKeys(dir, code) {
	var prefix = "$:/dndwiki/language/" + code + "/",
		keys = {},
		optional = {};
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
					console.log("  " + code + "/" + file + ": title outside " + prefix + ": " + fullTitle);
					problems++;
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
	return {keys: keys, optional: optional};
}

fs.readdirSync(pluginsDir).forEach(function(plugin) {
	var langDir = path.join(pluginsDir, plugin, "language");
	if(!fs.existsSync(langDir)) {
		return;
	}
	var codes = fs.readdirSync(langDir).filter(function(code) {
		return fs.statSync(path.join(langDir, code)).isDirectory();
	});
	if(codes.indexOf(BASE) === -1) {
		console.log(plugin + ": no " + BASE + " folder");
		problems++;
		return;
	}
	var base = readKeys(path.join(langDir, BASE), BASE);
	codes.forEach(function(code) {
		if(code === BASE) {
			return;
		}
		var other = readKeys(path.join(langDir, code), code),
			missing = Object.keys(base.keys).filter(function(key) { return !other.keys[key] && !base.optional[key]; }),
			extra = Object.keys(other.keys).filter(function(key) { return !base.keys[key]; });
		missing.sort().forEach(function(key) {
			console.log(plugin + " " + code + ": missing " + key);
		});
		extra.sort().forEach(function(key) {
			console.log(plugin + " " + code + ": not in " + BASE + ": " + key);
		});
		problems += missing.length + extra.length;
		console.log(plugin + " " + code + ": " + Object.keys(other.keys).length + " keys, " + missing.length + " missing, " + extra.length + " extra");
	});
});

process.exit(problems ? 1 : 0);
