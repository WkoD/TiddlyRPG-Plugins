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
 *            nothing, modules/macros-check.js); a rules macro with a text the
 *            ruleset does not understand (modules/rules.js); the field link (shown no more, the
 *            source of the images goes into the field source); an image or map that is not in
 *            images/ (fields image and map, the parameters image and map of a spot, the files of
 *            <<image>>), <<image "...">> without folder in a tiddler without type; battlemap
 *            as a field or a parameter of a spot (shown no more, battle maps go into map)
 *   hint     an event without <<date>> (every event starts with one); sections that have no
 *            heading; text before the first placeholder; an event without date; a phase
 *            of a non-event without an end before a later one (dates.openPhases); ".." as
 *            start of a non-event; images or maps at a spot joined to a tiddler (they show in
 *            that tiddler); a quest tiddler without a marker; two quest or rumour names that
 *            differ only a little (case, spaces and punctuation aside, one letter or two swapped)
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
	// Images and maps (modules/images.js): a file that is not in the folder of the wiki, battle
	// maps left over, images of a spot that is joined to a tiddler (they show there, not here)
	var images = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/images.js"),
		spots = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/spots.js");
	var checkImages = function(tiddler, title) {
		var fields = tiddler.fields,
			folder = images.folderOf(tiddler);
		var missing = function(list, dir, what) {
			$tw.utils.each(images.files(list), function(file) {
				if(!fs.existsSync(path.join(wikiDir, "images", dir, file))) {
					add(title, "warning", what + ": images/" + dir + "/" + file + " does not exist");
				}
			});
		};
		if(folder) {
			missing(fields.image, folder, "image");
		}
		missing(fields.map, "map", "map");
		if(fields.battlemap !== undefined) {
			add(title, "warning", "the field battlemap is no longer shown - battle maps go into the field map");
		}
		if(/<<spot\s[^>]*battlemap\s*:|<\$spot\s[^>]*battlemap\s*=/.test(fields.text || "")) {
			add(title, "warning", "the parameter battlemap of a spot is no longer shown - battle maps go into map");
		}
		// <<image "a.png, b.png" folder:"event">> and <$transclude $variable="image" files=...>
		var calls = function(nodes) {
			$tw.utils.each(nodes, function(node) {
				var attrs = node.attributes || {},
					variable = node.type === "transclude" && attrs["$variable"];
				if(variable && variable.value === "image") {
					var list = attrs["0"] || attrs.files,
						dir = attrs.folder ? attrs.folder.value : folder;
					if(list && list.type === "string" && list.value.trim()) {
						if(dir) {
							missing(list.value, dir, "<<image>>");
						} else {
							add(title, "warning", "<<image \"" + list.value + "\">> in a tiddler without type: name the folder (folder:\"event\")");
						}
					}
				}
				if(node.children) {
					calls(node.children);
				}
			});
		};
		var tree = wiki.parseTiddler(title);
		calls(tree ? tree.tree : []);
		if(!tiddler.hasTag("Location")) {
			return;
		}
		$tw.utils.each(spots.read(wiki, title).spots, function(spot) {
			var target = spots.targetOf(wiki, spot);
			if(target && wiki.tiddlerExists(target)) {
				if(spot.image || spot.map) {
					add(title, "hint", "spot " + spot.plain + " is joined to " + target + " - its images and maps show there, set them in that tiddler");
				}
			} else {
				missing(spot.image, "location", "image of spot " + spot.plain);
				missing(spot.map, "map", "map of spot " + spot.plain);
			}
		});
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
			if(!event) {
				$tw.utils.each(dates.openPhases(parsed), function(section) {
					add(title, "hint", "a phase without an end before a later one: " + section.text);
				});
			}
			if(!event && parsed.sections.length && parsed.sections[0].start === dates.FOREVER) {
				add(title, "hint", "\"..\" as start (since time immemorial)");
			}
		}
		if(/search:date\[\.\]/.test(JSON.stringify(fields))) {
			add(title, "error", "filter on the old dead marker search:date[.] - use trpg.dead[]");
		}
		if(fields.link !== undefined) {
			add(title, "warning", "the field link is no longer shown - where the images come from goes into the field source");
		}
		checkImages(tiddler, title);
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
	// Quests (modules/quests.js), over all markers whatever the view: a quest tiddler without a
	// marker has no history; two names that differ only a little are likely one quest written
	// two ways (a typo in a marker makes a new rumour)
	var quests = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/quests.js"),
		questNames = quests.index(wiki).names.slice();
	$tw.utils.each(wiki.getTiddlersWithTag("Quest"), function(name) {
		if(questNames.indexOf(name) === -1) {
			add(name, "hint", "quest without a marker - mark it in an event: <<quest \"" + name + "\">>");
			questNames.push(name);
		}
	});
	questNames.sort();
	var plain = function(name) {
		return name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
	};
	// Edit distance of two strings: insert, delete or replace one character, or swap two
	// neighbours ("Labore"/"Lbaore") - one step each
	var distance = function(a, b) {
		var d = [];
		for(var i = 0; i <= a.length; i++) {
			d.push([i]);
			for(var j = 1; j <= b.length; j++) {
				d[i].push(i ? 0 : j);
			}
		}
		for(i = 1; i <= a.length; i++) {
			for(j = 1; j <= b.length; j++) {
				d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
				if(i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
					d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
				}
			}
		}
		return d[a.length][b.length];
	};
	// One step apart, case, spaces and punctuation aside ("Die Schamanin Eoria" and "Die
	// Schamanin Tyria" are two steps: two quests)
	questNames.forEach(function(name, i) {
		questNames.slice(i + 1).forEach(function(other) {
			var a = plain(name), b = plain(other);
			if(distance(a, b) <= 1) {
				add(name, "hint", "similar to the " + (quests.isQuest(wiki, other) ? "quest " : "rumour ") + other + " - one quest written two ways?");
			}
		});
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
