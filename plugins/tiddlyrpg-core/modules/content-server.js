/*\
title: $:/plugins/tiddlyrpg-core/modules/content-server.js
type: application/javascript
module-type: library
created: 20261022165310491
modified: 20261026132300929

Content packages on the server (the route server/content-route.js; Node only): entries of a
ruleset - items, spells, creatures - as data a DM takes into the wiki one by one. They are no
tiddlers and no plugin: they stay in the package until taken.

A package is an npm package in <wiki>/node_modules (scoped ones too) whose package.json has
  "tiddlyrpg": {"content": ["<path of a manifest.json>", ...]}
A manifest:
  {
    "name": "SRD 5.1",                       the source as the wiki names it
    "ruleset": "$:/plugins/wkod/dnd5e2014",  the ruleset plugin it belongs to
    "language": "en-GB",                     the language of its texts and titles
    "tag": "SRD 5.1 English",                optional: a tag every taken entry gets, so the
                                             tiddlers that came from it show it
    "tiddlyrpg-core-version": ">=2.1.0",
    "source": "...",                         what goes into the field source of a taken entry
    "files": ["items.json", ...]             beside the manifest
  }
A file: {"entries": [{"id", "title", "type", "tags": [...], "fields": {...}, "text"}, ...]}; id
unique in the package (two packages of a ruleset - a language each - may share ids: the name of
the package tells them apart), type a type tag of the core (Item, Spell, Creature ...).

A package whose core version does not fit, or that cannot be read, is left out with a line on
the console. Read files are cached by their path and time of change.

  packages(wikiPath)              every package: [{name, ruleset, language, source, tag,
                                  manifest, entries}]
  index(wikiPath,ruleset)         those of the ruleset without the texts of the entries; an entry
                                  of a category with a text of its own (Class, Trait ...) carries
                                  the names in its text instead: names [{kind, name}] - its named
                                  sections and table headings (kind "column"), for <<rule>>
  entry(wikiPath,ruleset,id,name) {package, entry} of an id in the package of that name (without
                                  one: the first that has it), or null - only looked up, never a
                                  path

\*/

"use strict";

var fs = require("fs"),
	path = require("path");

var cache = Object.create(null);

function readJson(file) {
	var stat = fs.statSync(file),
		hit = cache[file];
	if(hit && hit.mtime === stat.mtimeMs) {
		return hit.data;
	}
	var data = JSON.parse(fs.readFileSync(file,"utf8"));
	cache[file] = {mtime: stat.mtimeMs, data: data};
	return data;
}

// The folders of the packages in node_modules, scoped ones too
function packageDirs(wikiPath) {
	var root = path.join(wikiPath,"node_modules"),
		out = [];
	if(!fs.existsSync(root)) {
		return out;
	}
	fs.readdirSync(root).forEach(function(name) {
		var dir = path.join(root,name);
		if(name.charAt(0) === "@") {
			try {
				fs.readdirSync(dir).forEach(function(sub) {
					out.push(path.join(dir,sub));
				});
			} catch(e) {}
		} else if(name.charAt(0) !== ".") {
			out.push(dir);
		}
	});
	return out;
}

function fits(manifest) {
	var core = ($tw.wiki.getTiddler("$:/plugins/tiddlyrpg-core") || {fields: {}}).fields.version,
		match = /^>=\s*(\d+\.\d+\.\d+\S*)$/.exec((manifest["tiddlyrpg-core-version"] || "").trim());
	return !!(core && match && $tw.utils.checkVersions(core,match[1]));
}

var packages = exports.packages = function(wikiPath) {
	var out = [];
	packageDirs(wikiPath).forEach(function(dir) {
		var pkgFile = path.join(dir,"package.json"),
			pkg;
		try {
			pkg = fs.existsSync(pkgFile) ? readJson(pkgFile) : null;
		} catch(e) {
			pkg = null;
		}
		var list = pkg && pkg.tiddlyrpg && $tw.utils.isArray(pkg.tiddlyrpg.content) ? pkg.tiddlyrpg.content : [];
		list.forEach(function(relative) {
			var file = path.resolve(dir,relative);
			try {
				var manifest = readJson(file),
					entries = [];
				if(!fits(manifest)) {
					$tw.utils.log("tiddlyrpg content: " + file + " needs tiddlyrpg-core " + manifest["tiddlyrpg-core-version"]);
					return;
				}
				(manifest.files || []).forEach(function(name) {
					var data = readJson(path.resolve(path.dirname(file),name));
					entries = entries.concat($tw.utils.isArray(data.entries) ? data.entries : []);
				});
				out.push({name: manifest.name || pkg.name, ruleset: manifest.ruleset || "", language: manifest.language || "en-GB",
					source: manifest.source || "", tag: manifest.tag || "", manifest: file, entries: entries});
			} catch(e) {
				$tw.utils.log("tiddlyrpg content: " + file + " cannot be read: " + e.message);
			}
		});
	});
	return out;
};

// The names in the text of an entry with a text of its own (modules/glossary.js NAMED, ref()): the
// named sections at the start of a paragraph (<<feature "Rage">>: {kind: "feature", name}) and the
// headings of the first row of its tables ({kind: "column", name: "Rage Damage"})
function names(text) {
	var glossary = require("$:/plugins/tiddlyrpg-core/modules/glossary.js"),
		out = [],
		re = /(?:^|\n)<<([a-z][a-z0-9-]*) "([^"]+)">>/g,
		m;
	while((m = re.exec(text || ""))) {
		out.push({kind: m[1], name: m[2]});
	}
	glossary.headings(text).forEach(function(h) {
		out.push({kind: "column", name: h.name});
	});
	return out;
}

exports.index = function(wikiPath,ruleset) {
	var named = require("$:/plugins/tiddlyrpg-core/modules/glossary.js").NAMED;
	return packages(wikiPath).filter(function(p) {
		return p.ruleset === ruleset;
	}).map(function(p) {
		return {name: p.name, language: p.language, source: p.source, tag: p.tag, entries: p.entries.map(function(e) {
			var out = {id: e.id, title: e.title, type: e.type, tags: e.tags || [], fields: e.fields || {}};
			if(named.indexOf(e.type) !== -1) {
				out.names = names(e.text);
			}
			return out;
		})};
	});
};

exports.entry = function(wikiPath,ruleset,id,name) {
	var found = null;
	packages(wikiPath).some(function(p) {
		if(p.ruleset !== ruleset || (name && p.name !== name)) {
			return false;
		}
		var entry = p.entries.filter(function(e) { return e.id === id; })[0];
		if(entry) {
			found = {package: {name: p.name, language: p.language, source: p.source, tag: p.tag}, entry: entry};
		}
		return !!found;
	});
	return found;
};
