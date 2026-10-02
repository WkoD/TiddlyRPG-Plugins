/*
 * Shared setup for the tests (npm test).
 *
 * Every test file runs in its own process (node:test), boots TiddlyWiki once with the smoke
 * edition (all plugins, de-DE language pack) and adds the fixture tiddlers below. Files do not
 * share wiki state; within a file, a test that changes the wiki restores it afterwards.
 */
var path = require("path");

require("../scripts/plugin-path")();

var root = path.join(__dirname, ".."),
	$tw;

// Boots the wiki with the fixtures; resolves with $tw
exports.boot = function() {
	return new Promise(function(resolve) {
		$tw = require("tiddlywiki").TiddlyWiki();
		$tw.boot.argv = [path.join(root, "editions", "smoke")];
		$tw.boot.boot(function() {
			fixtures($tw.wiki);
			resolve($tw);
		});
	});
};

function fixtures(wiki) {
	var T = "20261001000000000";
	[
		{title: "Insel Avalon", tags: "Location", text: "Island of the pirates."},
		{title: "Insel Avalon/Map", tags: "Map", text: "!!!! Kantine\n\nAn orc cooks."},
		{title: "Insel Avalon/BattleMap", tags: "BattleMap", image: "Insel Avalon.jpg", text: ""},
		{title: "Baile", tags: "Location", text: "Town."},
		{title: "Baile/Map", tags: "Map", image: "Baile.png", text: ""},
		{title: "Nowhere", tags: "Location", text: "Empty."},
		{title: "Grum", tags: "Person", location: "Insel Avalon", date: "./1350-07", text: "An orc."},
		{title: "Frigg", tags: "Player", player: "Anna", text: "A player character."},
		{title: "Secret", tags: "Location Frigg", text: "Only for Frigg."},
		{title: "Der dunkle Turm", tags: "Campaign Event", date: "1351-07-01, 1351-07-11", text: "At [[Baile]].\n\n<<date 2 \"Traum von Shinfel\">>\n\nAt [[Insel Avalon]]."},
		{title: "Hafenfest", tags: "Event", date: "1351-07-05", text: "At [[Insel Avalon]]."},
		{title: "Sage", tags: "Event", text: "Undated."},
		{title: "Friggs Traum", tags: "Event Frigg", date: "1351-07-03", text: "At [[Insel Avalon]]."},
		{title: "PlayerLevel", tags: "Information", text: "100000 EXP"},
		// The graph widget needs a browser; the relation tests use the list tab
		{title: "$:/state/dndwiki-core/relations-tab", text: "$:/plugins/dndwiki-core/viewtemplates/relations/list"},
		// The history checks read the table; the timeline is checked on its own
		{title: "$:/state/dndwiki-core/events-tab", text: "$:/plugins/dndwiki-core/viewtemplates/event-list/list"}
	].forEach(function(fields) {
		fields.created = T;
		fields.modified = T;
		wiki.addTiddler(new $tw.Tiddler(fields));
	});
}

exports.setLanguage = function(wiki, code) {
	wiki.addTiddler(new $tw.Tiddler({title: "$:/language", text: "$:/languages/" + code}));
};

// Adds a tiddler from plain fields
exports.add = function(wiki, fields) {
	wiki.addTiddler(new $tw.Tiddler(fields));
};

// Renders wikitext with the global definitions imported, as the page template does in the browser
var IMPORT = "\\import [subfilter{$:/core/config/GlobalImportFilter}]\n";

function render(wiki, type, text, variables) {
	return wiki.renderText(type, "text/vnd.tiddlywiki", IMPORT + text, {variables: variables || {}});
}
exports.render = render;

// A tiddler through the story view template, as the browser shows it
exports.view = function(wiki, title) {
	return render(wiki, "text/html", "<$transclude $tiddler=\"$:/core/ui/ViewTemplate\" mode=\"block\"/>", {currentTiddler: title, storyTiddler: title});
};

// The body of a tiddler as text
exports.body = function(wiki, title) {
	return render(wiki, "text/plain", "<$transclude $tiddler=\"" + title + "\" mode=\"block\"/>", {currentTiddler: title});
};

// Result of a filter (array of titles)
exports.filter = function(wiki, text, variables) {
	return wiki.filterTiddlers(text, $tw.rootWidget.makeFakeWidgetWithVariables(variables || {}));
};
