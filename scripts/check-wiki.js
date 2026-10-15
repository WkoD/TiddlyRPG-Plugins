#!/usr/bin/env node
/*
 * Checks a TiddlyRPG wiki with the rules of tiddlyrpg-core (modules/checks.js, the modules of
 * checks/): the same messages the wiki shows below the title, over every tiddler, in the view
 * of the DM, plus the files in images/ the wiki names. Reports only, changes nothing.
 *
 *   node scripts/check-wiki.js <wiki folder> [theme ...] [--github]
 *   npm run check-wiki -- <wiki folder>          (in this repo)
 *   npm run check                                (in a wiki: node_modules/tiddlyrpg-plugins/...)
 *
 * Themes are the first part of the ids of the rules (dates, sections, locations, relations, ...);
 * without one, all run. The messages are in the language of the wiki, each with the id of its
 * rule - the name for the fields trpg-noerror and trpg-noinfo that switch it off at a tiddler.
 * --github also writes each message as a workflow command (::error, ::notice), so that it shows
 * as an annotation in GitHub Actions.
 *
 * Boots the wiki with the plugins of this repo, so the calendar of the wiki applies and bodies
 * are read from their parse tree, like the format layer does. Plugins of other packages (a
 * setting with the calendar, a ruleset) come from the `plugins` folders of the packages in
 * <wiki folder>/node_modules; the ones of this repo win.
 *
 * Exit code 1 if there is an error, 2 on a wrong call.
 */
var path = require("path"),
	fs = require("fs");

var args = process.argv.slice(2),
	github = args.indexOf("--github") !== -1,
	positional = args.filter(function(arg) { return arg !== "--github"; }),
	wikiDir = positional[0],
	themes = positional.slice(1);

var usage = function(extra) {
	console.error("Usage: node scripts/check-wiki.js <wiki folder> [theme ...] [--github]" + (extra ? "\n" + extra : ""));
	process.exit(2);
};

if(!wikiDir || !fs.existsSync(path.join(wikiDir, "tiddlywiki.info"))) {
	usage();
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
		checks = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/checks.js"),
		calendar = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/calendar.js"),
		cal = calendar.active(wiki),
		known = checks.themes();
	var unknown = themes.filter(function(theme) { return known.indexOf(theme) === -1; });
	if(unknown.length) {
		usage("Unknown theme: " + unknown.join(", ") + " - themes: " + known.join(", "));
	}
	checks.setFolder(path.resolve(wikiDir));
	var found = checks.all(wiki, {mode: "dm", player: "", name: "dm"}, themes.length ? themes : null),
		titles = Object.keys(found).sort(),
		counts = {error: 0, hint: 0};
	// Workflow commands: % and line breaks escaped, in a property also : and ,
	var escape = function(text, property) {
		text = text.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
		return property ? text.replace(/:/g, "%3A").replace(/,/g, "%2C") : text;
	};
	console.log("Checked: " + path.resolve(wikiDir) + (cal ? " (calendar " + cal.id + ")" : " (no calendar)") +
		(themes.length ? " - " + themes.join(", ") : ""));
	titles.forEach(function(title) {
		console.log("\n" + title);
		found[title].forEach(function(message) {
			var text = checks.text(wiki, message);
			counts[message.level]++;
			console.log("  " + message.level + "  " + text + "  [" + message.id + "]");
			if(github) {
				console.log("::" + (message.level === "error" ? "error" : "notice") + " title=" + escape(title, true) + "::" + escape(text + " [" + message.id + "]"));
			}
		});
	});
	console.log("\n" + counts.error + " errors, " + counts.hint + " hints in " + titles.length + " tiddlers");
	process.exit(counts.error ? 1 : 0);
});
