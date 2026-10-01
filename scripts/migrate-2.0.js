#!/usr/bin/env node
/*
 * Migrates a DnDWiki campaign wiki from dndwiki-core 1.x to 2.0 (English internal names).
 *
 *   node scripts/migrate-2.0.js <wiki folder>           dry run: report only (default)
 *   node scripts/migrate-2.0.js <wiki folder> --write   apply (uses git mv / git rm)
 *
 * What it does (only under tiddlers/, images/, data/ of the wiki):
 *   - field names in tiddler headers (bild -> image, datum -> date, ort -> location, ...)
 *   - tags (Ort -> Location, Gegenstand -> Item, Karte -> Map, ...)
 *   - renamed tiddlers, file and title: Erfahrungspunkte -> PlayerLevel, <x>/Karte -> <x>/Map,
 *     $:/graph/Kosmogramm|Weltkarte|Gegenstände -> Cosmogram|WorldMap|Items
 *   - deletes Datum (the current in-world date is no longer used)
 *   - PlayerLevel: a body of digits only gets " EXP" appended (display stays the same)
 *   - graph views ($:/graph/*): tag and field names inside the filter fields (no link alias)
 *   - $:/config/flibbles/graph/sidebar: points to the renamed graph view
 *   - macro calls in bodies (<<datumlang ...>>, <$macrocall $name="datumlang" .../>, ...):
 *     macro and parameter names
 *   - link targets and transclusions of renamed tiddlers: [[Ort]] -> [[Ort|Location]],
 *     [[text|Ort]] -> [[text|Location]], {{Ort}} -> {{Location}}; link texts stay untouched
 *   - asset folders in lower case (two-step git mv, case-insensitive file systems), images/Design
 *     removed, images/battlemap/.keep added; fixed asset paths in bodies
 *   - $:/state/Spieler -> $:/state/dndwiki/player in bodies
 *
 * Not done here (campaign specific, by hand): sorting battle maps out of images/map, the field
 * "map" (reported), $:/language and "languages" in tiddlywiki.info, documentation.
 * Timestamps (created/modified) are left alone: a mechanical migration.
 */
var fs = require("fs"),
	path = require("path"),
	childProcess = require("child_process");

var FIELDS = {
	bild: "image", datum: "date", ort: "location", mitglied: "member", familie: "family",
	besitzer: "owner", unter: "under", bund: "bond", ehemals: "former", allianz: "alliance",
	erschaffer: "creator", anfuehrer: "leader", feindschaft: "enmity", komponente: "component",
	leiter: "officer", preis: "price", spieler: "player", calc_von: "calc_from", calc_bis: "calc_to"
};

var TAGS = {
	"Ort": "Location", "Gott": "Deity", "Spieler": "Player", "Artefakt": "Artifact",
	"Gegenstand": "Item", "Buch": "Book", "Karte": "Map", "Ereignis": "Event",
	"Abenteuer": "Campaign", "Kalender": "Calendar", "TBC/Abenteuer": "TBC/Campaign"
};

var GRAPH_VIEWS = {
	"$:/graph/Kosmogramm": "$:/graph/Cosmogram",
	"$:/graph/Weltkarte": "$:/graph/WorldMap",
	"$:/graph/Gegenstände": "$:/graph/Items"
};

var MACROS = {
	datumlang: {name: "datelong", params: {datum: "date"}},
	datumrechner: {name: "datecalc", params: {datum: "date", tage: "days"}},
	datumdiff: {name: "datediff", params: {von: "from", bis: "to"}},
	bild: {name: "image", params: {}},
	totlink: {name: "deadlink", params: {}}
};

var IMAGE_FOLDERS = {
	"Person": "person", "Ort": "location", "Organisation": "organisation", "Ereignis": "event",
	"Gegenstand": "item", "Karte": "map", "Spieler": "player"
};

var args = process.argv.slice(2),
	write = args.indexOf("--write") !== -1,
	wikiDir = args.filter(function(a) { return a.indexOf("--") !== 0; })[0];

if(!wikiDir || !fs.existsSync(path.join(wikiDir, "tiddlers"))) {
	console.log("Usage: node scripts/migrate-2.0.js <wiki folder> [--write]");
	process.exit(2);
}
wikiDir = path.resolve(wikiDir);

var counts = {},
	notes = [];

function count(key, n) {
	counts[key] = (counts[key] || 0) + (n === undefined ? 1 : n);
}

function git(gitArgs) {
	if(write) {
		childProcess.execFileSync("git", gitArgs, {cwd: wikiDir, stdio: "pipe"});
	}
}

// --- tiddler file format ------------------------------------------------------------------

function parseFile(file) {
	var raw = fs.readFileSync(file, "utf8"),
		eol = raw.indexOf("\r\n") !== -1 ? "\r\n" : "\n",
		text = raw.replace(/\r\n/g, "\n"),
		isMeta = /\.meta$/.test(file),
		split = isMeta ? text.length : text.indexOf("\n\n"),
		headerText = split === -1 ? text : text.substr(0, split),
		body = split === -1 || isMeta ? null : text.substr(split + 2),
		fields = [];
	headerText.split("\n").forEach(function(line) {
		var pos = line.indexOf(":");
		if(line === "") {
			return;
		}
		if(pos === -1) {
			fields.push({name: null, raw: line});
		} else {
			fields.push({name: line.substr(0, pos), value: line.substr(pos + 1).replace(/^ /, "")});
		}
	});
	return {file: file, eol: eol, fields: fields, body: body, trailing: /\n$/.test(text) && isMeta};
}

function serialise(t) {
	var header = t.fields.map(function(f) {
		return f.name === null ? f.raw : f.name + ": " + f.value;
	}).join("\n");
	var text = t.body === null ? header + (t.trailing ? "\n" : "") : header + "\n\n" + t.body;
	return text.replace(/\n/g, t.eol);
}

function getField(t, name) {
	for(var i = 0; i < t.fields.length; i++) {
		if(t.fields[i].name === name) {
			return t.fields[i];
		}
	}
	return null;
}

// TiddlyWiki string list: [[with spaces]] or plain words
function parseList(value) {
	var result = [], re = /\[\[(.*?)\]\]|(\S+)/g, m;
	while((m = re.exec(value || "")) !== null) {
		result.push(m[1] !== undefined ? m[1] : m[2]);
	}
	return result;
}

function stringifyList(list) {
	return list.map(function(item) {
		return /\s/.test(item) || item.indexOf("[[") !== -1 ? "[[" + item + "]]" : item;
	}).join(" ");
}

// --- collect tiddlers -----------------------------------------------------------------------

var tiddlersDir = path.join(wikiDir, "tiddlers"),
	files = [];

(function walk(dir) {
	fs.readdirSync(dir).forEach(function(name) {
		var full = path.join(dir, name);
		if(fs.statSync(full).isDirectory()) {
			walk(full);
		} else if(/\.(tid|meta)$/.test(name)) {
			files.push(full);
		}
	});
})(tiddlersDir);

var tiddlers = files.map(parseFile);

// Title renames: hubs (for link targets) plus renamed wiki tiddlers
var TITLES = {};
Object.keys(TAGS).forEach(function(k) { TITLES[k] = TAGS[k]; });
TITLES["Erfahrungspunkte"] = "PlayerLevel";
Object.keys(GRAPH_VIEWS).forEach(function(k) { TITLES[k] = GRAPH_VIEWS[k]; });
tiddlers.forEach(function(t) {
	var title = getField(t, "title"),
		tags = parseList(getField(t, "tags") && getField(t, "tags").value);
	if(title && /\/Karte$/.test(title.value) && tags.indexOf("Karte") !== -1) {
		TITLES[title.value] = title.value.replace(/\/Karte$/, "/Map");
	}
});

// --- body rewrites --------------------------------------------------------------------------

function rewriteMacroParams(params, map, key) {
	return params.replace(/(\s)([a-zA-Z_]+)(\s*[=:])/g, function(match, space, name, sep) {
		if(map[name]) {
			count(key + " params");
			return space + map[name] + sep;
		}
		return match;
	});
}

// Fixed asset paths (bodies and field values such as link: [ext[...|data/Buch/x.pdf]])
function rewriteAssetPaths(text) {
	var result = text;
	// "/" or "\\" as separator (hand-written <img src="images\Ereignis\x.png"/> occurs); the
	// result always uses "/", which also works on the case-sensitive GitHub Pages server.
	// Paths that already carry a new folder name are normalised as well (second run).
	Object.keys(IMAGE_FOLDERS).forEach(function(old) {
		result = result.replace(new RegExp("images[\\\\/]" + old + "[\\\\/]", "g"), function() {
			count("asset paths");
			return "images/" + IMAGE_FOLDERS[old] + "/";
		});
	});
	result = result.replace(/images\\(person|location|organisation|event|item|map|battlemap|player|maptool)[\\/]/g, function(match, folder) {
		count("asset paths (separator)");
		return "images/" + folder + "/";
	});
	return result.replace(/data[\\/](Buch|book)[\\/]/g, function(match, folder) {
		if(folder === "book" && match === "data/book/") {
			return match;
		}
		count("asset paths");
		return "data/book/";
	});
}

function rewriteBody(body, title) {
	var result = body;
	// <$macrocall $name="old" ...>
	result = result.replace(/<\$macrocall(\s[^>]*?)\$name=(["'])([a-z]+)\2([^>]*)>/g, function(match, before, q, name, after) {
		var macro = MACROS[name];
		if(!macro) {
			return match;
		}
		count("macro calls " + name + " -> " + macro.name);
		return "<$macrocall" + rewriteMacroParams(before, macro.params, name) + "$name=" + q + macro.name + q + rewriteMacroParams(after, macro.params, name) + ">";
	});
	// <<old ...>>
	result = result.replace(/<<([a-z]+)(\s[^>]*?)?>>/g, function(match, name, params) {
		var macro = MACROS[name];
		if(!macro) {
			return match;
		}
		count("macro calls " + name + " -> " + macro.name);
		return "<<" + macro.name + (params ? rewriteMacroParams(params, macro.params, name) : "") + ">>";
	});
	// Links: change the target only, keep the text
	result = result.replace(/\[\[([^\]|]+?)\]\]/g, function(match, target) {
		if(TITLES[target]) {
			count("links (alias added)");
			return "[[" + target + "|" + TITLES[target] + "]]";
		}
		return match;
	});
	result = result.replace(/\[\[([^\]|]*?)\|([^\]]+?)\]\]/g, function(match, text, target) {
		if(TITLES[target]) {
			count("links (target)");
			return "[[" + text + "|" + TITLES[target] + "]]";
		}
		return match;
	});
	// Transclusions {{target}}, {{target||template}}, {{target!!field}}
	result = result.replace(/\{\{([^{}|!]+?)((?:\|\||!!|##)[^{}]*)?\}\}/g, function(match, target, rest) {
		if(TITLES[target]) {
			count("transclusions");
			return "{{" + TITLES[target] + (rest || "") + "}}";
		}
		return match;
	});
	result = rewriteAssetPaths(result);
	result = result.replace(/\$:\/state\/Spieler\b/g, function() {
		count("player state references");
		return "$:/state/dndwiki/player";
	});
	if(/<<(datumlang|bild|totlink|datumrechner|datumdiff)\b|\$name=.(datumlang|bild|totlink|datumrechner|datumdiff)\b/.test(result)) {
		notes.push("old macro name left in " + title);
	}
	return result;
}

// Tag and field names inside a filter (graph views); no link alias here
function rewriteFilter(filter) {
	var result = filter;
	result = result.replace(/tag\[([^\]]+)\]/g, function(match, tag) {
		return TAGS[tag] ? (count("graph filters"), "tag[" + TAGS[tag] + "]") : match;
	});
	result = result.replace(/multitag\[([^\]]+)\]/g, function(match, list) {
		var changed = list.split(",").map(function(tag) {
			return TAGS[tag] ? (count("graph filters"), TAGS[tag]) : tag;
		}).join(",");
		return "multitag[" + changed + "]";
	});
	result = result.replace(/\[\[([^\]]+)\]\]/g, function(match, title) {
		return TAGS[title] ? (count("graph filters"), "[[" + TAGS[title] + "]]") : match;
	});
	result = result.replace(/\b(get|has|has:field|listed)\[([a-z_]+)\]/g, function(match, op, field) {
		return FIELDS[field] ? (count("graph filters"), op + "[" + FIELDS[field] + "]") : match;
	});
	result = result.replace(/search:([a-z_]+)\[/g, function(match, field) {
		return FIELDS[field] ? (count("graph filters"), "search:" + FIELDS[field] + "[") : match;
	});
	return result;
}

// --- per tiddler ----------------------------------------------------------------------------

var renames = [],
	deletes = [];

tiddlers.forEach(function(t) {
	var before = serialise(t),
		titleField = getField(t, "title"),
		title = titleField ? titleField.value : path.basename(t.file);

	if(title === "Datum") {
		deletes.push(t.file);
		count("deleted tiddlers");
		return;
	}

	// field names
	var names = {};
	t.fields.forEach(function(f) { if(f.name) { names[f.name] = true; } });
	t.fields.forEach(function(f) {
		if(f.name && FIELDS[f.name]) {
			if(names[FIELDS[f.name]]) {
				notes.push("field " + f.name + " not renamed in " + title + ": " + FIELDS[f.name] + " exists");
				return;
			}
			count("field " + f.name + " -> " + FIELDS[f.name]);
			f.name = FIELDS[f.name];
		}
		if(f.name && f.name !== "title") {
			f.value = rewriteAssetPaths(f.value);
		}
		if(f.name === "map") {
			notes.push("field map in " + title + " (battle map, migrate by hand): " + f.value);
		}
	});

	// TiddlyWiki writes the header fields sorted by name; renamed fields would otherwise sit at
	// their old place and the first save in the browser would reorder them
	var sorted = t.fields.every(function(f) { return f.name !== null; }) && t.fields.slice().sort(function(a, b) {
		return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
	});
	if(sorted && sorted.some(function(f, i) { return f !== t.fields[i]; })) {
		t.fields = sorted;
		count("headers re-sorted");
	}

	// tags
	var tagsField = getField(t, "tags");
	if(tagsField) {
		var tags = parseList(tagsField.value),
			changed = false;
		tags = tags.map(function(tag) {
			if(TAGS[tag]) {
				count("tag " + tag + " -> " + TAGS[tag]);
				changed = true;
				return TAGS[tag];
			}
			return tag;
		});
		if(changed) {
			tagsField.value = stringifyList(tags);
		}
	}

	// graph views: filter fields
	if(GRAPH_VIEWS[title] || /^\$:\/graph\//.test(title)) {
		["filter", "edges.fields", "edges.functions"].forEach(function(name) {
			var f = getField(t, name);
			if(!f) {
				return;
			}
			if(name === "edges.fields" && /^[a-z_ ]+$/.test(f.value)) {
				f.value = f.value.split(" ").map(function(field) {
					return FIELDS[field] ? (count("graph filters"), FIELDS[field]) : field;
				}).join(" ");
			} else {
				f.value = rewriteFilter(f.value);
			}
		});
	}

	// sidebar graph view
	if(title === "$:/config/flibbles/graph/sidebar" && t.body !== null) {
		var view = t.body.trim();
		if(GRAPH_VIEWS[view]) {
			t.body = t.body.replace(view, GRAPH_VIEWS[view]);
			count("graph sidebar");
		}
	}

	// player level
	if(title === "Erfahrungspunkte" && t.body !== null && /^\s*\d+\s*$/.test(t.body)) {
		t.body = t.body.trim() + " EXP" + (/\n$/.test(t.body) ? "\n" : "");
		count("player level: EXP appended");
	}

	// body
	if(t.body !== null && !/\.meta$/.test(t.file)) {
		var typeField = getField(t, "type");
		if(!typeField || typeField.value === "text/vnd.tiddlywiki") {
			t.body = rewriteBody(t.body, title);
		}
	}

	// rename
	if(TITLES[title] && !TAGS[title]) {
		var newTitle = TITLES[title],
			newFile = renamedFile(t.file, title, newTitle);
		titleField.value = newTitle;
		renames.push({from: t.file, to: newFile});
		count("renamed tiddlers");
		// a .json/.png tiddler with .meta sidecar: move the data file too
		if(/\.meta$/.test(t.file)) {
			var data = t.file.replace(/\.meta$/, "");
			if(fs.existsSync(data)) {
				renames.push({from: data, to: newFile.replace(/\.meta$/, "")});
			}
		}
	}

	var after = serialise(t);
	if(after !== before) {
		count("changed files");
		if(write) {
			fs.writeFileSync(t.file, after, "utf8");
		}
	}
});

function renamedFile(file, oldTitle, newTitle) {
	var dir = path.dirname(file),
		base = path.basename(file),
		ext = base.replace(/^[^.]*?((\.[a-z]+)+)$/i, "$1");
	if(/_Karte(_\d+)?\.tid$/.test(base) && /\/Map$/.test(newTitle)) {
		return path.join(dir, base.replace(/_Karte(_\d+)?\.tid$/, "_Map.tid"));
	}
	if(GRAPH_VIEWS[oldTitle]) {
		return path.join(dir, "$__graph_" + newTitle.replace("$:/graph/", "") + ext);
	}
	return path.join(dir, newTitle.replace(/^\$:\//, "$__").replace(/[\/<>:"\\|?*]/g, "_") + ext);
}

renames.forEach(function(r) {
	// a second run over an already migrated wiki finds the file at its new path already
	if(path.resolve(r.from) !== path.resolve(r.to)) {
		git(["mv", r.from, r.to]);
	}
});
deletes.forEach(function(file) {
	git(["rm", "-q", file]);
});

// --- asset folders ----------------------------------------------------------------------------

// Exists with exactly this spelling (case-insensitive file systems report "images/Person" as
// existing when only "images/person" is there)
function existsExactly(relative) {
	var full = path.join(wikiDir, relative),
		parent = path.dirname(full);
	return fs.existsSync(parent) && fs.readdirSync(parent).indexOf(path.basename(full)) !== -1;
}

function moveFolder(from, to) {
	if(!existsExactly(from)) {
		return;
	}
	count("asset folders renamed");
	// two steps: case-only renames are invisible to case-insensitive file systems
	git(["mv", from, from + "_tmp_migrate"]);
	if(write) {
		var dest = path.join(wikiDir, to);
		if(fs.existsSync(dest)) {
			throw new Error("Target folder exists: " + to);
		}
	}
	git(["mv", from + "_tmp_migrate", to]);
}

Object.keys(IMAGE_FOLDERS).forEach(function(old) {
	moveFolder("images/" + old, "images/" + IMAGE_FOLDERS[old]);
});
moveFolder("data/Buch", "data/book");
if(existsExactly("images/Design")) {
	count("asset folders removed");
	git(["rm", "-r", "-q", "images/Design"]);
}
if(!fs.existsSync(path.join(wikiDir, "images/battlemap/.keep"))) {
	count("asset folders added");
	if(write) {
		fs.mkdirSync(path.join(wikiDir, "images/battlemap"), {recursive: true});
		fs.writeFileSync(path.join(wikiDir, "images/battlemap/.keep"), "");
		git(["add", "images/battlemap/.keep"]);
	}
}

// --- report ---------------------------------------------------------------------------------

console.log((write ? "Migrated " : "Dry run for ") + wikiDir);
Object.keys(counts).sort().forEach(function(key) {
	console.log("  " + key + ": " + counts[key]);
});
renames.forEach(function(r) {
	console.log("  rename " + path.relative(wikiDir, r.from) + " -> " + path.relative(wikiDir, r.to));
});
deletes.forEach(function(file) {
	console.log("  delete " + path.relative(wikiDir, file));
});
notes.forEach(function(note) {
	console.log("  NOTE " + note);
});
if(!write) {
	console.log("Nothing written. Run again with --write to apply.");
}
