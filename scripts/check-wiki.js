#!/usr/bin/env node
/*
 * Checks the dates of a TiddlyRPG wiki against the date format of tiddlyrpg-core 2.0
 * (plugins/tiddlyrpg-core/modules/dates.js). Reports only, changes nothing.
 *
 *   node scripts/check-wiki.js <wiki folder>      (npm run check-wiki -- <wiki folder>)
 *
 * Boots the wiki with the plugins of this repo, so the calendar of the wiki applies and bodies
 * are read from their parse tree, like the format layer does. Plugins of other packages (a
 * setting with the calendar, a ruleset) come from the `plugins` folders of the packages in
 * <wiki folder>/node_modules; the ones of this repo win.
 *
 *   error    field date: old format, cannot be read, a day the calendar does not have, start
 *            after end, sections out of order; <<date n>> beyond the sections of the field;
 *            datelong calls or <<dateformat "...">> left in an event body (dates belong in the
 *            field); filters on the old dead marker (search:date[.]); $:/config/tiddlyrpg/ruleset
 *            or .../setting naming a plugin that is missing, disabled or of another type (another
 *            one is active); a plugin whose tiddlyrpg-core-version the core does not meet or that
 *            is not written ">=x.y.z"; a currency whose reference is none of its coins
 *   warning  empty side or section in the field; two placeholders for the same section; a
 *            "---" right before <<date>> (the placeholder draws its own rule); the hints on
 *            sections (modules/sections.js: a short form inside another block, a section in one
 *            of its kind, <<secret>> in the middle of a section, a lock naming no player
 *            character, a kind in the wrong tiddler); a tiddler that asks the view itself
 *            ($:/state/tiddlyrpg/view, trpg.visible - lock with the tag Secret, <<secret>> or
 *            <$secret> instead); a transclusion of a tiddler tagged Secret (it shows to every
 *            view that sees the transcluding tiddler); a macro nothing defines (it shows
 *            nothing, modules/macros-check.js); a rules macro or shortcut with a text the
 *            ruleset does not understand (modules/rules.js)
 *   hint     an event without <<date>> (every event starts with one); sections that have no
 *            heading; text before the first placeholder; an event without date; several
 *            sections or ".." as start of a non-event
 *
 * Exit code 1 if there is an error.
 */
var path = require("path"),
	fs = require("fs");

var wikiDir = process.argv[2];
if(!wikiDir || !fs.existsSync(path.join(wikiDir, "tiddlywiki.info"))) {
	console.error("Usage: node scripts/check-wiki.js <wiki folder>");
	process.exit(2);
}

// The plugins folders of the packages of the wiki (node_modules/<package>/plugins)
var wikiModules = path.join(path.resolve(wikiDir), "node_modules"),
	wikiPlugins = fs.existsSync(wikiModules) ? fs.readdirSync(wikiModules).map(function(name) {
		return path.join(wikiModules, name, "plugins");
	}) : [];

require("./plugin-path")(wikiPlugins);

var $tw = require("tiddlywiki").TiddlyWiki();
$tw.boot.argv = [path.resolve(wikiDir)];
$tw.boot.boot(function() {
	var wiki = $tw.wiki,
		dates = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/dates.js"),
		calendar = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/calendar.js"),
		cal = calendar.active(wiki),
		findings = {},
		errors = 0;
	var add = function(title, level, text) {
		(findings[title] = findings[title] || []).push(level + "  " + text);
		if(level === "error") {
			errors++;
		}
	};
	var sections = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/sections.js"),
		macros = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/macros-check.js"),
		rules = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/rules.js"),
		pluginTypes = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/plugin-types.js");
	// The plugin types ruleset and setting: a config naming a plugin that is not used
	var PROBLEMS = {
		missing: "is not installed",
		disabled: "is disabled",
		type: "is no plugin of this type"
	};
	$tw.utils.each(pluginTypes.TYPES, function(type) {
		var state = pluginTypes.state(wiki, type);
		if(state.problem) {
			add(pluginTypes.config(type), "error", state.configured + " " + PROBLEMS[state.problem] +
				" - active is " + (state.active || "none"));
		}
	});
	// The currency: the coin that matches the prices of the ruleset must be one of its coins
	var currency = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/currency.js"),
		cur = currency.active(wiki);
	if(cur && !cur.referenceValid) {
		add(wiki.getTiddlerText("$:/config/tiddlyrpg/currency").trim(), "error", "reference " + cur.reference +
			" is no coin of the currency (" + cur.coins.map(function(c) { return c.id; }).join(", ") + ")");
	}
	$tw.utils.each(pluginTypes.versionProblems(wiki), function(problem) {
		add(problem.title, "error", problem.problem === "format" ?
			"tiddlyrpg-core-version " + problem.required + " - use the form >=x.y.z" :
			"needs tiddlyrpg-core " + problem.required + ", the wiki has " + pluginTypes.coreVersion(wiki));
	});
	// Titles of the tiddlers tagged Secret that a parse tree transcludes
	var secretTransclusions = function(nodes, out) {
		$tw.utils.each(nodes, function(node) {
			var attrs = node.attributes || {},
				target = node.type === "transclude" && (attrs["$tiddler"] || attrs.tiddler);
			if(target && target.type === "string") {
				var t = wiki.getTiddler(target.value);
				if(t && t.hasTag("Secret") && out.indexOf(target.value) === -1) {
					out.push(target.value);
				}
			}
			if(node.children) {
				secretTransclusions(node.children, out);
			}
		});
		return out;
	};
	wiki.each(function(tiddler, title) {
		if(wiki.isSystemTiddler(title) && !/^\$:\/graph\//.test(title)) {
			return;
		}
		var fields = tiddler.fields,
			event = tiddler.hasTag("Event"),
			text = fields.text || "";
		if(fields.date !== undefined) {
			var parsed = dates.parse(fields.date);
			if(dates.isOld(fields.date)) {
				add(title, "error", "old format: " + fields.date);
			} else {
				$tw.utils.each(dates.check(cal, parsed), function(problem) {
					add(title, "error", problem);
				});
				$tw.utils.each(parsed.warnings, function(warning) {
					add(title, "warning", warning);
				});
			}
			if(!event && parsed.sections.length > 1) {
				add(title, "hint", "several sections for a non-event: " + fields.date);
			}
			if(!event && parsed.sections.length && parsed.sections[0].start === dates.FOREVER) {
				add(title, "hint", "\"..\" as start (since time immemorial)");
			}
		}
		if(/search:date\[\.\]/.test(JSON.stringify(fields))) {
			add(title, "error", "filter on the old dead marker search:date[.] - use trpg.dead[]");
		}
		if(/\$:\/state\/tiddlyrpg\/view|trpg\.visible|trpgvisible/.test(text)) {
			add(title, "warning", "asks the view itself - lock with the tag Secret, <<secret>> or <$secret>");
		}
		$tw.utils.each(sections.check(wiki, title).concat(macros.check(wiki, title), rules.check(wiki, title)), function(problem) {
			add(title, "warning", problem);
		});
		var parsed = wiki.parseTiddler(title);
		$tw.utils.each(parsed ? secretTransclusions(parsed.tree, []) : [], function(target) {
			add(title, "warning", "transcludes the secret tiddler " + target + " - every view that sees " + title + " sees it");
		});
		if(!event) {
			return;
		}
		if(fields.date === undefined || fields.date.trim() === "") {
			add(title, "hint", "event without date");
		}
		if(/<\$macrocall\s+\$name=["']datelong|<<datelong[\s>]/.test(text)) {
			add(title, "error", "datelong call left in the body");
		}
		var formats = text.match(/<<dateformat\s[^>]*>>/g);
		if(formats) {
			add(title, "error", "date in the body instead of the field: " + formats.join(" "));
		}
		var info = dates.sections(wiki, title),
			count = dates.parse(fields.date).sections.length,
			seen = {};
		$tw.utils.each(info.placeholders, function(p) {
			if(count > 0 && p.number > count) {
				add(title, "error", "<<date>> for section " + p.number + ", the field has " + count);
			}
			if(seen[p.number]) {
				add(title, "warning", "two placeholders for section " + p.number);
			}
			seen[p.number] = true;
			if(/(^|\n)---[ \t]*\n\s*$/.test(text.slice(0, p.start))) {
				add(title, "warning", "\"---\" right before the placeholder of section " + p.number);
			}
		});
		if(!info.placeholders.length) {
			add(title, "hint", "no <<date>> at the start");
		} else if(count > 0) {
			var missing = [];
			for(var n = 1; n <= count; n++) {
				if(!seen[n]) {
					missing.push(n);
				}
			}
			if(missing.length) {
				add(title, "hint", "sections without heading: " + missing.join(", "));
			}
			if(!info.placeholders[0].first) {
				add(title, "hint", "text before the first placeholder (head)");
			}
		}

	});
	var titles = Object.keys(findings).sort();
	console.log("Dates checked: " + path.resolve(wikiDir) + (cal ? " (calendar " + cal.id + ")" : " (no calendar)"));
	titles.forEach(function(title) {
		console.log("\n" + title);
		findings[title].forEach(function(line) {
			console.log("  " + line);
		});
	});
	var count = function(level) {
		return titles.reduce(function(n, title) {
			return n + findings[title].filter(function(line) { return line.indexOf(level) === 0; }).length;
		}, 0);
	};
	console.log("\n" + count("error") + " errors, " + count("warning") + " warnings, " + count("hint") + " hints in " + titles.length + " tiddlers");
	process.exit(errors ? 1 : 0);
});
