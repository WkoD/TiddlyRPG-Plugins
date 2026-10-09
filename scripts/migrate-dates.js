#!/usr/bin/env node
/*
 * Migrates the dates of a TiddlyRPG campaign wiki to the date format of tiddlyrpg-core 2.0
 * (sections separated by ",", spans with "/", "." unknown, ".." forever; see
 * plugins/tiddlyrpg-core/modules/dates.js).
 *
 *   node scripts/migrate-dates.js <wiki folder>           dry run: report only (default)
 *   node scripts/migrate-dates.js <wiki folder> --write   apply (files only, nothing staged)
 *
 * Purely mechanical - which points of an event are really spans, intros before the first date
 * and captions are decided by hand afterwards; scripts/check-wiki.js then checks the result.
 *
 * Field date (only under tiddlers/):
 *   events      a.b.c -> a, b, c     a. -> a/..     a.b. -> a, b, ..    .a -> ./a
 *               (a.b.: the event goes on after b, b itself stays a point)
 *   all others  a.b -> a/b           .a -> ./a      a. -> a/.          . -> ./.
 *   (for persons, organisations, items ... the dot always meant start.end)
 * Bodies:
 *   <b>Jahr:</b> <$macrocall $name="datelong" date="X"/> and <<datelong ...>> (with or without a
 *   bold label before it) become <<date>> if X is the next section of the date field, <<date k>>
 *   if it is section k out of order, and <<dateformat "X">> (new syntax) if X is not a section of
 *   the field - nothing is lost, check-wiki.js lists those. A "---" line right before a call
 *   that became <<date>> goes (the placeholder draws its own rule). In editor snippets a
 *   datelong call becomes <<date>>.
 *   Every event starts with <<date>>: an event body without a placeholder gets one at the start
 *   (after leading pragmas); an event whose first placeholder has text before it is only
 *   reported (an intro - decided by hand).
 * Graph views and other filters: -[search:date[.]] -> -[trpg.dead[]].
 *
 * Timestamps (created/modified) are left alone: a mechanical migration. Already migrated values
 * are recognised and skipped, so the script can run again.
 */
var fs = require("fs"),
	path = require("path");

var args = process.argv.slice(2),
	write = args.indexOf("--write") !== -1,
	wikiDir = args.filter(function(a) { return a.indexOf("--") !== 0; })[0];

if(!wikiDir || !fs.existsSync(path.join(wikiDir, "tiddlers"))) {
	console.error("Usage: node scripts/migrate-dates.js <wiki folder> [--write]");
	process.exit(2);
}

/* ---------- Conversion of a date value ---------- */

// The format before 2.0: a "." and neither "/" nor "," (points never contain a dot)
function isOld(text) {
	return /\./.test(text) && !/[\/,]/.test(text);
}

/*
Converts an old value. event: the dots separate points in time (open start/end at the edges);
otherwise the value is start.end. Returns the new value (unchanged if not old).
*/
function convert(value, event) {
	var text = value.trim();
	if(!isOld(text)) {
		return value;
	}
	var parts = text.split("."),
		openStart = parts.length > 1 && parts[0] === "",
		openEnd = parts.length > 1 && parts[parts.length - 1] === "";
	if(!event) {
		if(parts.length !== 2) {
			return null;
		}
		return (parts[0] || ".") + "/" + (parts[1] || ".");
	}
	var points = parts.filter(function(p) { return p !== ""; });
	if(points.length === 0) {
		return null;
	}
	if(openStart) {
		points[0] = "./" + points[0];
	}
	if(openEnd && points.length === 1) {
		points[0] += "/..";
	} else if(openEnd) {
		points.push("..");
	}
	return points.join(", ");
}

/* ---------- Files ---------- */

function parseTid(file) {
	var raw = fs.readFileSync(file, "utf8"),
		eol = raw.indexOf("\r\n") !== -1 ? "\r\n" : "\n",
		text = raw.replace(/\r\n/g, "\n"),
		split = text.indexOf("\n\n"),
		head = split === -1 ? text : text.slice(0, split),
		body = split === -1 ? "" : text.slice(split + 2),
		fields = {};
	head.split("\n").forEach(function(line) {
		var m = /^([^:\s]+):\s?(.*)$/.exec(line);
		if(m) {
			fields[m[1]] = m[2];
		}
	});
	return {file: file, eol: eol, head: head, body: body, hasBody: split !== -1, fields: fields};
}

function save(t) {
	var text = t.head + (t.hasBody ? "\n\n" + t.body : "");
	if(write) {
		fs.writeFileSync(t.file, text.replace(/\n/g, t.eol));
	}
}

function tagsOf(value) {
	var tags = [], re = /\[\[([^\]]+)\]\]|(\S+)/g, m;
	while((m = re.exec(value || ""))) {
		tags.push(m[1] || m[2]);
	}
	return tags;
}

var files = [];
(function walk(dir) {
	fs.readdirSync(dir, {withFileTypes: true}).forEach(function(entry) {
		var full = path.join(dir, entry.name);
		if(entry.isDirectory()) {
			walk(full);
		} else if(/\.(tid|meta)$/.test(entry.name)) {
			files.push(full);
		}
	});
})(path.join(wikiDir, "tiddlers"));

/* ---------- Body ---------- */

// A datelong call, optionally after a bold label: macrocall widget or <<datelong ...>>
var CALL = /(?:<b>[^<\n]*<\/b>[ \t]*)?(?:<\$macrocall\s+\$name=(["'])datelong\1([^>]*?)\/>|<<datelong\s+([^>]*?)>>)/g;

function callDate(widgetAttrs, macroParams) {
	var m;
	if(widgetAttrs !== undefined) {
		m = /\bdate=(["'])(.*?)\1/.exec(widgetAttrs);
		return m ? m[2] : null;
	}
	m = /^(?:date\s*:\s*)?(?:"([^"]*)"|'([^']*)'|\[\[([^\]]*)\]\]|(\S+))/.exec(macroParams.trim());
	return m ? (m[1] || m[2] || m[3] || m[4] || "") : null;
}

/*
Rewrites the datelong calls of an event body against the sections of its (new) date field.
Returns {body, placeholders, unmatched, rulesRemoved}.
*/
function rewriteBody(body, sections, snippet) {
	var number = 0,
		result = {placeholders: [], unmatched: [], rulesRemoved: 0};
	result.body = body.replace(CALL, function(match, quote, attrs, params) {
		var value = callDate(attrs, params);
		if(value === null) {
			result.unmatched.push(match);
			return match;
		}
		if(snippet) {
			result.placeholders.push(1);
			return "<<date>>";
		}
		// A section is the date itself or a span starting with it
		var k = 0;
		sections.some(function(section, i) {
			if(section === value.trim() || section.split("/")[0] === value.trim()) {
				k = i + 1;
				return true;
			}
			return false;
		});
		if(k === 0) {
			// Not a section of the field: keep the date visible, in the new syntax
			var converted = convert(value, false) || value;
			result.unmatched.push(value);
			return "<<dateformat \"" + converted + "\">>";
		}
		var call = k === number + 1 ? "<<date>>" : "<<date " + k + ">>";
		number = k;
		result.placeholders.push(k);
		return call;
	});
	// The placeholder draws its own rule
	result.body = result.body.replace(/(^|\n)---[ \t]*\n(?:[ \t]*\n)*(?=<<date[ >])/g, function(match, start) {
		result.rulesRemoved++;
		return start;
	});
	return result;
}

/* ---------- Run ---------- */

var report = {
	inserted: [],
	dates: [], failed: [], events: [], intros: [], unmatched: [], snippets: [], filters: [], other: []
};

files.forEach(function(file) {
	var t = parseTid(file),
		changed = false,
		title = t.fields.title || path.basename(file),
		tags = tagsOf(t.fields.tags),
		event = tags.indexOf("Event") !== -1;
	// Field date (header only; .meta files have no body)
	if(t.fields.date !== undefined && isOld(t.fields.date)) {
		var old = t.fields.date,
			value = convert(old, event);
		if(value === null) {
			report.failed.push(title + ": " + old);
		} else {
			t.head = t.head.replace(/^date:.*$/m, "date: " + value);
			t.fields.date = value;
			report.dates.push((event ? "event  " : "other  ") + title + ": " + old + "  ->  " + value);
			changed = true;
		}
	}
	// Filters on the old dead marker (graph views, own lists)
	if(/search:date\[\.\]/.test(t.head + "\n" + t.body)) {
		t.head = t.head.replace(/-\[search:date\[\.\]\]/g, "-[trpg.dead[]]");
		t.body = t.body.replace(/-\[search:date\[\.\]\]/g, "-[trpg.dead[]]");
		report.filters.push(title);
		changed = true;
	}
	// Bodies with datelong calls
	CALL.lastIndex = 0;
	if(t.hasBody && CALL.test(t.body)) {
		CALL.lastIndex = 0;
		var snippet = tags.indexOf("$:/tags/TextEditor/Snippet") !== -1,
			sections = (t.fields.date || "").split(",").map(function(s) { return s.trim(); }).filter(Boolean),
			r = rewriteBody(t.body, event ? sections : [], snippet);
		if(snippet) {
			report.snippets.push(title);
		} else if(event) {
			var before = r.body.slice(0, r.body.search(/<<date[ >]/)).trim(),
				first = r.placeholders.length ? r.placeholders[0] : null;
			report.events.push(title + ": sections " + sections.length + ", placeholders " + (r.placeholders.join(",") || "-") +
				(r.rulesRemoved ? ", rules removed " + r.rulesRemoved : ""));
			if(first !== null && (first !== 1 || before)) {
				report.intros.push(title + ": first placeholder is section " + first + (before ? ", text before it" : ""));
			}
		} else {
			report.other.push(title + ": datelong calls -> <<dateformat>>");
		}
		r.unmatched.forEach(function(value) {
			report.unmatched.push(title + ": " + value);
		});
		t.body = r.body;
		changed = true;
	}
	// Every event starts with <<date>>
	if(event && !/<<date[\s>]/.test(t.body)) {
		var pragmas = /^(?:[ \t]*(?:\\[^\n]*)?\n)*/.exec(t.body)[0],
			rest = t.body.slice(pragmas.length).replace(/^\s+/, "");
		t.body = (/\S/.test(pragmas) ? pragmas.replace(/\s*$/, "\n\n") : "") + "<<date>>" + (rest ? "\n\n" + rest : "\n");
		t.hasBody = true;
		report.inserted.push(title);
		changed = true;
	}
	if(changed) {
		save(t);
	}
});

var printList = function(heading, list) {
	console.log("\n" + heading + " (" + list.length + ")");
	list.forEach(function(line) {
		console.log("  " + line);
	});
};
console.log((write ? "Migrated" : "Dry run (nothing written; --write applies)") + ": " + path.resolve(wikiDir));
printList("Field date converted", report.dates);
printList("Field date NOT converted (unexpected form, fix by hand)", report.failed);
printList("Event bodies rewritten", report.events);
printList("Events: <<date>> inserted at the start", report.inserted);
printList("Events whose first placeholder is not section 1 or has text before it (intro)", report.intros);
printList("Body dates that are not a section of the field (now <<dateformat \"...\">>)", report.unmatched);
printList("Editor snippets -> <<date>>", report.snippets);
printList("Other tiddlers with datelong calls", report.other);
printList("Filters -[search:date[.]] -> -[trpg.dead[]]", report.filters);
