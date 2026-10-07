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
		{title: "Insel Avalon", tags: "Location", map: "Insel Avalon.jpg", battlemap: "Insel Avalon.jpg", text: "Island of the pirates.\n\n<<spot \"Kantine\">>\n\nAn orc cooks."},
		{title: "Baile", tags: "Location", map: "Baile.png", text: "Town."},
		// Locations within locations (filters/location.js) and spots (modules/spots.js)
		{title: "Continent", tags: "Location", text: "A continent."},
		{title: "Kingdom", tags: "Location", location: "Continent", text: "A kingdom.\n\n<<spot \"Twice\">>\n\nA place claimed twice."},
		{title: "Neighbour", tags: "Location", location: "Kingdom", text: "Next door.\n\n<<spot \"Twice\">>\n\nClaimed again."},
		{title: "Twice", tags: "Location", text: "A spot of two locations."},
		{title: "Town", tags: "Location", location: "Kingdom", map: "Town.png", battlemap: "Market.jpg, Gate.jpg", text: "A town.\n\n<<spot \"Tavern\">>\n\nWhere they drink.\n\n<<spot \"Old Well\" battlemap:\"Well.jpg\">>\n\nDeep and dark.\n\n<<spot \"Tempel von [[Chauntea]]\">>\n\nA temple.\n\n<<spot \"Guild\">>\n\nThe guild house."},
		{title: "Tavern", tags: "Location", battlemap: "Tavern.jpg", text: "The tavern."},
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

// Result of a filter (array of titles)
exports.filter = function(wiki, text, variables) {
	return wiki.filterTiddlers(text, $tw.rootWidget.makeFakeWidgetWithVariables(variables || {}));
};
