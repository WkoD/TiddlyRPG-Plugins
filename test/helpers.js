/*
 * Shared setup for the tests (npm test).
 *
 * Every test file runs in its own process (node:test), boots TiddlyWiki once with the test
 * edition (editions/test: the plugins of this repo, the fixture plugins of test/fixtures/plugins,
 * de-DE language pack) and adds the fixture tiddlers below. Files do not share wiki state;
 * within a file, a test that changes the wiki restores it afterwards.
 */
var path = require("path");

var root = path.join(__dirname, "..");

// The fixture plugins stand in for the content of other repos (calendar data, ...)
exports.fixturePlugins = path.join(root, "test", "fixtures", "plugins");

require("../scripts/plugin-path")([exports.fixturePlugins]);

var $tw;

// Boots the wiki with the fixtures; resolves with $tw
exports.boot = function() {
	return new Promise(function(resolve) {
		$tw = require("tiddlywiki").TiddlyWiki();
		$tw.boot.argv = [path.join(root, "editions", "test")];
		$tw.boot.boot(function() {
			fixtures($tw.wiki);
			resolve($tw);
		});
	});
};

function fixtures(wiki) {
	var T = "20261001000000000";
	[
		{title: "Insel Avalon", tags: "Location", map: "Insel Avalon.jpg", text: "Island of the pirates.\n\n<<spot \"Kantine\">>\n\nAn orc cooks."},
		{title: "Baile", tags: "Location", map: "Baile.png", text: "Town."},
		// Locations within locations (filters/location.js) and spots (modules/spots.js)
		{title: "Continent", tags: "Location", text: "A continent."},
		{title: "Kingdom", tags: "Location", location: "Continent", text: "A kingdom.\n\n<<spot \"Twice\">>\n\nA place claimed twice."},
		{title: "Neighbour", tags: "Location", location: "Kingdom", text: "Next door.\n\n<<spot \"Twice\">>\n\nClaimed again."},
		{title: "Twice", tags: "Location", text: "A spot of two locations."},
		{title: "Town", tags: "Location", location: "Kingdom", map: "Town.png, Market.jpg, Gate.jpg", text: "A town.\n\n<<spot \"Tavern\">>\n\nWhere they drink.\n\n<<spot \"Old Well\" image:\"Well.jpg\" map:\"Well shaft.jpg\">>\n\nDeep and dark.\n\n<<spot \"Tempel von [[Chauntea]]\" image:\"Temple.jpg\">>\n\nA temple.\n\n<<spot \"Guild\" image:\"Guild house.jpg\">>\n\nThe guild house."},
		{title: "Tavern", tags: "Location", image: "Tavern.jpg", text: "The tavern."},
		{title: "Chauntea", tags: "Deity", text: "Goddess."},
		{title: "Guild", tags: "Organisation", location: "Town Kingdom", leader: "Town", text: "Traders."},
		{title: "Guildmaster", tags: "Person", location: "Town", leader: "Guild", text: "Leads the guild."},
		{title: "Barkeep", tags: "Person", location: "Tavern", text: "Pours."},
		{title: "Wanderer", tags: "Person", location: "Town Kingdom", text: "Moves around."},
		{title: "Loop A", tags: "Location", text: "<<spot \"Loop B\">>"},
		{title: "Loop B", tags: "Location", text: "<<spot \"Loop A\">>"},
		{title: "Stray", tags: "Location", location: "Grum", text: "Lies in a person."},
		{title: "Nowhere", tags: "Location", text: "Empty."},
		{title: "Grum", tags: "Person", location: "[[Insel Avalon]]", date: "./1350-07", text: "An orc."},
		// Player characters and the lock (modules/visibility.js): Frigg is played by Anna
		{title: "Frigg", tags: "Player", player: "Anna", text: "A player character."},
		{title: "Hideout", tags: "Location Frigg Secret", text: "Only for Frigg."},
		{title: "Der dunkle Turm", tags: "Event Frigg", date: "1351-07-01, 1351-07-11", text: "At [[Baile]].\n\n<<date 2 label:\"Traum von Shinfel\">>\n\nAt [[Insel Avalon]]."},
		{title: "Hafenfest", tags: "Event", date: "1351-07-05", text: "At [[Insel Avalon]]."},
		{title: "Sage", tags: "Event", text: "Undated."},
		{title: "Friggs Traum", tags: "Event Frigg Secret", date: "1351-07-03", text: "At [[Insel Avalon]]."},
		{title: "PlayerLevel", tags: "Information", text: "100000 EXP"}
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

// Sets the view (modules/visibility.js): "public", "player:<name>", "dm"; null removes it, then
// the default applies - dm here, as the tests run without $:/status/IsReadOnly
exports.setView = function(wiki, view) {
	if(view === null) {
		wiki.deleteTiddler("$:/state/tiddlyrpg/view");
	} else {
		wiki.addTiddler(new $tw.Tiddler({title: "$:/state/tiddlyrpg/view", text: view}));
	}
};

// Runs fn in a view and restores the default afterwards
exports.inView = function(wiki, view, fn) {
	exports.setView(wiki, view);
	try {
		return fn();
	} finally {
		exports.setView(wiki, null);
	}
};

// Renders wikitext with the global definitions imported, as the page template does in the browser
var IMPORT = "\\import [subfilter{$:/core/config/GlobalImportFilter}]\n";

function render(wiki, type, text, variables) {
	return wiki.renderText(type, "text/vnd.tiddlywiki", IMPORT + text, {variables: variables || {}});
}
exports.render = render;

// The tabs exports.view opens, as a reader would have chosen them: the relations block "list" or
// "graph", the events "list" or "timeline". The tab state is per tiddler
// ($:/state/tiddlyrpg-core/relations-tab/<title>, events-tab/<title>); the default of the
// plugin, graph and timeline, is no use here: the graph widget needs a browser, and the history
// checks read the table (the timeline is checked on its own).
exports.tabs = {relations: "list", events: "list"};

// Sets the tab states of <title> to exports.tabs (only a state that differs: every change of the
// wiki clears the caches)
exports.openTabs = function(wiki, title) {
	[["$:/state/tiddlyrpg-core/relations-tab/", "$:/plugins/tiddlyrpg-core/viewtemplates/relations/" + exports.tabs.relations],
		["$:/state/tiddlyrpg-core/events-tab/", "$:/plugins/tiddlyrpg-core/viewtemplates/event-list/" + exports.tabs.events]].forEach(function(state) {
		if(wiki.getTiddlerText(state[0] + title) !== state[1]) {
			exports.add(wiki, {title: state[0] + title, text: state[1]});
		}
	});
};

// A tiddler through the story view template, as the browser shows it, with the tabs of
// exports.tabs
exports.view = function(wiki, title) {
	exports.openTabs(wiki, title);
	return render(wiki, "text/html", "<$transclude $tiddler=\"$:/core/ui/ViewTemplate\" mode=\"block\"/>", {currentTiddler: title, storyTiddler: title});
};

// The body of a tiddler as text
exports.body = function(wiki, title) {
	return render(wiki, "text/plain", "<$transclude $tiddler=\"" + title + "\" mode=\"block\"/>", {currentTiddler: title});
};

// Nodes and edges of a graph as tw5-graph hands them to vis-network, without a browser: the
// widget <$graph> (it needs a window) is replaced by one that only renders its children, then
// the node and edge widgets are collected by id - the last one wins, as in findGraphObjects of
// tw5-graph - and edges whose ends are no nodes are left out (EdgeWidget.curate). props are the
// raw properties of an object: edge/node type config, enclosing $properties and own attributes;
// graph holds those of every $properties $for=graph, a later one wins.
// Returns {graph, nodes: {id: props}, edges: [{id, from, to, props}], refresh(changedTiddlers)}; refresh
// refreshes the widget tree and returns the objects anew. What vis-network draws from them
// (position, curves, tooltip) still needs a browser.
var graphStubbed = false;

function stubGraph() {
	if(graphStubbed) {
		return;
	}
	var Widget = $tw.modules.execute("$:/core/modules/widgets/widget.js").widget,
		Stub = function(parseTreeNode, options) {
			this.initialise(parseTreeNode, options);
		};
	Stub.prototype = new Widget();
	Stub.prototype.render = function(parent, nextSibling) {
		this.parentDomNode = parent;
		this.computeAttributes();
		this.makeChildWidgets();
		this.renderChildren(parent, nextSibling);
	};
	Stub.prototype.refresh = function(changedTiddlers) {
		return this.refreshChildren(changedTiddlers);
	};
	Widget.prototype.widgetClasses.graph = Stub;
	graphStubbed = true;
}

function graphObjects(widget) {
	var found = {nodes: Object.create(null), edges: Object.create(null)},
		graph = Object.create(null),
		nodes = Object.create(null),
		edges = [];
	(function walk(w) {
		if(found[w.graphObjectType]) {
			found[w.graphObjectType][w.id] = w;
		} else if(w.parseTreeNode && w.parseTreeNode.type === "properties" && w.type === "graph") {
			Object.assign(graph, w.properties);
		}
		(w.children || []).forEach(walk);
	})(widget);
	Object.keys(found.nodes).forEach(function(id) {
		nodes[id] = found.nodes[id].computeProperties({});
	});
	Object.keys(found.edges).forEach(function(id) {
		var edge = found.edges[id];
		if(nodes[edge.fromTiddler] && nodes[edge.toTiddler]) {
			edges.push({id: id, from: edge.fromTiddler, to: edge.toTiddler, props: edge.computeProperties({})});
		}
	});
	return {graph: graph, nodes: nodes, edges: edges};
}

exports.graph = function(wiki, text, variables) {
	stubGraph();
	var parser = wiki.parseText("text/vnd.tiddlywiki", IMPORT + text),
		widget = wiki.makeWidget(parser, {document: $tw.fakeDocument, variables: variables || {}});
	widget.render($tw.fakeDocument.createElement("div"), null);
	var result = graphObjects(widget);
	result.refresh = function(changedTiddlers) {
		widget.refresh(changedTiddlers);
		var again = graphObjects(widget);
		again.refresh = result.refresh;
		return again;
	};
	return result;
};

// The messages of a tiddler for the active view (modules/checks.js), errors first:
// [{id, level, key, params, text}]; theme (optional) keeps those of the rules of that theme
exports.checks = function(wiki, title, theme) {
	var checks = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/checks.js");
	return Array.from(checks.forTiddler(wiki, title)).filter(function(message) {
		return !theme || message.id.split("/")[0] === theme;
	}).map(function(message) {
		return Object.assign({text: checks.text(wiki, message)}, message);
	});
};

// The language keys of those messages
exports.checkKeys = function(wiki, title, theme) {
	return exports.checks(wiki, title, theme).map(function(message) {
		return message.key;
	});
};

// Result of a filter (array of titles)
exports.filter = function(wiki, text, variables) {
	return wiki.filterTiddlers(text, $tw.rootWidget.makeFakeWidgetWithVariables(variables || {}));
};

// Renders a tiddler into a fake DOM, sets the fields of a temp tiddler as typing would and
// refreshes: {kept, text} - kept is whether every input field ($edit-text) is still the same
// widget (one rendered anew loses the focus in the browser), text the text of the page after it.
// Removes the temp tiddler. variables (optional) are set around the tiddler, e.g. currentTiddler
// for a template.
exports.typeInto = function(wiki, title, fields, variables) {
	var container = $tw.fakeDocument.createElement("div"),
		widget = wiki.makeTranscludeWidget(title, {document: $tw.fakeDocument, importPageMacros: true, variables: variables || {}});
	var inputs = function(w, list) {
		if(w.parseTreeNode && w.parseTreeNode.type === "edit-text") {
			list.push(w);
		}
		(w.children || []).forEach(function(child) { inputs(child, list); });
		return list;
	};
	widget.render(container, null);
	var before = inputs(widget, []),
		changes = {};
	exports.add(wiki, fields);
	try {
		changes[fields.title] = {modified: true};
		widget.refresh(changes);
		var after = inputs(widget, []);
		return {
			kept: before.length > 0 && after.length === before.length && after.every(function(w, i) { return w === before[i]; }),
			text: container.textContent
		};
	} finally {
		wiki.deleteTiddler(fields.title);
	}
};
