/*
 * Integration with tw5-graph: the override of $:/plugins/flibbles/graph/macros/edges.typed, the
 * function edges, the ego graph, the map and the view template dnd-graph - through the nodes and
 * edges they hand to vis-network (h.graph, without a browser). What vis-network draws from them
 * is not checked here; translated edge labels are in lang/i18n.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var wiki, tw;

test.before(function() {
	return h.boot().then(function($tw) {
		tw = $tw;
		wiki = $tw.wiki;
	});
});

function f(text) {
	return Array.from(h.filter(wiki, text));
}

var EGO = "<$graph.view $tiddler=\"$:/plugins/dndwiki-core/graph/ego\"/>",
	MAP = "<$graph.view $tiddler=\"$:/plugins/dndwiki-core/graph/map\"/>";

function ego(node) {
	return h.graph(wiki, EGO, {currentNode: node});
}

function map(node) {
	return h.graph(wiki, MAP, {currentNode: node});
}

// Edges as "from -> to (label)", sorted
function edges(graph) {
	return graph.edges.map(function(edge) {
		return edge.from + " -> " + edge.to + (edge.props.label ? " (" + edge.props.label + ")" : "");
	}).sort();
}

function nodes(graph) {
	return Object.keys(graph.nodes).sort();
}

function colour(hub) {
	return wiki.getTiddler(hub).fields.color;
}

// Runs fn with the given tiddlers added, then puts back what was there before
function withTiddlers(list, fn) {
	var before = list.map(function(fields) { return wiki.getTiddler(fields.title); });
	list.forEach(function(fields) {
		var old = wiki.getTiddler(fields.title);
		wiki.addTiddler(new tw.Tiddler(old || {}, fields));
	});
	try {
		return fn();
	} finally {
		list.forEach(function(fields, i) {
			if(before[i]) {
				wiki.addTiddler(before[i]);
			} else {
				wiki.deleteTiddler(fields.title);
			}
		});
	}
}

test("leader: the field edge leaves out locations (dndwiki-exclude)", function() {
	assert.deepEqual(f("[[Guild]get[leader]enlist-input[]] -[subfilter{$:/config/flibbles/graph/edges/fields/leader!!dndwiki-exclude}]"), []);
	assert.deepEqual(f("[[Guildmaster]get[leader]enlist-input[]] -[subfilter{$:/config/flibbles/graph/edges/fields/leader!!dndwiki-exclude}]"), ["Guild"]);
});

test("function edge rules: leader -> location", function() {
	assert.deepEqual(f("[[Guild]subfilter{$:/config/flibbles/graph/edges/functions/rules!!filter}]"), ["Town"]);
	assert.deepEqual(f("[[Guildmaster]subfilter{$:/config/flibbles/graph/edges/functions/rules!!filter}]"), []);
});

test("function edge spots: a spot that is a location -> the location it is part of", function() {
	assert.deepEqual(f("[[Tavern]subfilter{$:/config/flibbles/graph/edges/functions/spots!!filter}]"), ["Town"]);
	assert.deepEqual(f("[[Town]subfilter{$:/config/flibbles/graph/edges/functions/spots!!filter}]"), []);
	// a spot joined to an organisation is no part of the location
	assert.deepEqual(f("[[Guild]subfilter{$:/config/flibbles/graph/edges/functions/spots!!filter}]"), []);
});

test("override: leader -> location only as the function edge rules, labels from the language keys", function() {
	// The label "controls" and the missing leader edge Guild -> Town both come from the
	// override, so it wins over tw5-graph (plugin-priority); rules includes location, so the
	// field location of Guild draws nothing to Town
	assert.deepEqual(edges(ego("Guildmaster")), [
		"Guild -> Town (controls)",
		"Guildmaster -> Guild (leads)",
		"Guildmaster -> Town (in)"
	]);
});

test("override: style of an edge type from its config", function() {
	var leader = ego("Guildmaster").edges.filter(function(edge) { return edge.props.label === "leads"; })[0];
	assert.equal(leader.props.color, "#ff8000");
	assert.equal(leader.props.width, "5.5");
	var spot = ego("Town").edges.filter(function(edge) { return edge.from === "Tavern" && edge.to === "Town"; });
	assert.equal(spot.length, 1);
	assert.equal(spot[0].props.stroke, "dashed", "function edge spots");
});

test("ego graph of a person: centre and neighbours in the colours of their types", function() {
	var graph = ego("Guildmaster");
	assert.deepEqual(nodes(graph), ["Guild", "Guildmaster", "Town"]);
	assert.equal(graph.nodes.Guildmaster.color, colour("Person"));
	assert.equal(graph.nodes.Guild.color, colour("Organisation"));
	assert.equal(graph.nodes.Town.color, colour("Location"));
	assert.equal(graph.nodes.Guildmaster.shape, "box");
});

test("ego graph: the dead in grey, bordered in the colour of their type", function() {
	var grum = ego("Insel Avalon").nodes.Grum;
	assert.equal(grum.color, "#dddddd");
	assert.equal(grum.borderColor, colour("Person"));
});

test("ego graph of a location: its spots count as the centre, other locations stay out", function() {
	var graph = ego("Town");
	assert.deepEqual(nodes(graph), ["Barkeep", "Guild", "Guildmaster", "Tavern", "Town", "Wanderer"]);
	assert.equal(graph.nodes.Tavern.label, "Tavern");
	assert.equal(graph.nodes.Tavern.dndToggle, undefined);
	assert.ok(edges(graph).indexOf("Barkeep -> Tavern (in)") !== -1, "who is in a spot");
	assert.ok(edges(graph).every(function(edge) { return edge.indexOf("Kingdom") === -1; }), "no edge to the parent");
});

test("ego graph of a location: places with someone in them start folded, a click state unfolds them", function() {
	var state = "$:/state/dndwiki-core/ego-open/Kingdom",
		folded = ego("Kingdom");
	assert.deepEqual(nodes(folded), ["Guild", "Kingdom", "Neighbour", "Tavern", "Town", "Twice", "Wanderer"]);
	assert.equal(folded.nodes.Town.label, "▸ Town");
	assert.equal(folded.nodes.Town.dndToggle, state);
	assert.equal(folded.nodes.Twice.label, "Twice", "nobody there: nothing to fold");
	withTiddlers([{title: state, list: "Town"}], function() {
		var open = ego("Kingdom");
		assert.equal(open.nodes.Town.label, "▾ Town");
		assert.equal(open.nodes.Tavern.label, "▸ Tavern");
		assert.ok(open.nodes.Guildmaster, "the neighbours of Town");
		assert.ok(edges(open).indexOf("Guildmaster -> Guild (leads)") !== -1);
	});
});

test("map: places lying in the location and its spots as pins, no edges", function() {
	var graph = map("Town");
	assert.deepEqual(Object.keys(graph.nodes), ["Tavern", "Town#Old Well", "Town#Tempel von Chauntea", "Guild"]);
	assert.deepEqual(graph.edges, []);
	assert.equal(graph.nodes.Tavern.dndPin, "tiddler");
	// a spot joined to a tiddler that is no location: a point of interest, pinned as that tiddler
	assert.equal(graph.nodes.Guild.dndPin, "tiddler");
	assert.equal(graph.nodes.Guild.color, colour("Organisation"));
	var well = graph.nodes["Town#Old Well"];
	assert.equal(well.dndPin, "spot");
	assert.equal(well.label, "Old Well");
	assert.equal(well.color, "#ffffff");
	assert.equal(well.borderColor, colour("Location"));
	assert.equal(graph.graph.dndMapImage, "images/map/Town.png");
	assert.equal(graph.graph.dndMapFit, "image");
});

test("map: places lying in it at every depth, the parts of a place only on its own map", function() {
	var graph = map("Kingdom");
	assert.deepEqual(nodes(graph), ["Neighbour", "Town", "Twice"]);
	assert.equal(graph.graph.dndMapImage, undefined);
	assert.equal(graph.graph.dndMapFit, "nodes");
});

test("map: saved positions, a slot in the grid for the rest", function() {
	withTiddlers([{title: "Town", "map-positions": "{\"Tavern\":\"10,-20\"}"}], function() {
		var graph = map("Town");
		assert.equal(graph.nodes.Tavern.x, "10");
		assert.equal(graph.nodes.Tavern.y, "-20");
		assert.equal(graph.nodes.Tavern.dndUnplaced, undefined);
		assert.equal(graph.nodes["Town#Old Well"].dndUnplaced, "yes");
	});
});

test("map: pins fixed, movable while editing, never in the published copy", function() {
	var saves = function(node) { return (node.free || "").indexOf("map-positions") !== -1; },
		edit = {title: "$:/state/dndwiki-core/map-edit/Town", text: "yes"};
	var graph = map("Town");
	assert.equal(graph.nodes.Tavern.fixed, "yes");
	assert.ok(!saves(graph.nodes.Tavern));
	withTiddlers([edit], function() {
		graph = map("Town");
		assert.equal(graph.nodes.Tavern.fixed, "no");
		assert.ok(saves(graph.nodes.Tavern));
		withTiddlers([{title: "$:/status/IsReadOnly", text: "yes"}], function() {
			graph = map("Town");
			assert.equal(graph.nodes.Tavern.fixed, "yes");
			assert.ok(!saves(graph.nodes.Tavern));
		});
	});
});

test("map: hidden nodes leave only the image", function() {
	withTiddlers([{title: "$:/state/dndwiki-core/map-nodes/Town", text: "hide"}], function() {
		var graph = map("Town");
		assert.deepEqual(nodes(graph), []);
		assert.equal(graph.graph.dndMapImage, "images/map/Town.png");
	});
});

test("view template dnd-graph: nodes from the filter, edge types of the view", function() {
	withTiddlers([{
		title: "$:/graph/Test", type: "application/json", text: "{}",
		template: "$:/plugins/dndwiki-core/graph/templates/dnd-graph",
		filter: "[[Guild]] [[Guildmaster]] [[Town]]",
		"edges.fields": "leader",
		"edges.functions": "rules"
	}], function() {
		var graph = h.graph(wiki, "<$graph.view $tiddler=\"$:/graph/Test\"/>");
		assert.deepEqual(nodes(graph), ["Guild", "Guildmaster", "Town"]);
		assert.deepEqual(edges(graph), ["Guild -> Town (controls)", "Guildmaster -> Guild (leads)"]);
		assert.equal(graph.nodes.Guild.color, colour("Organisation"));
	});
});

test("map view lies outside $:/graph/ (not in the dropdown)", function() {
	assert.ok(wiki.tiddlerExists("$:/plugins/dndwiki-core/graph/map") || wiki.isShadowTiddler("$:/plugins/dndwiki-core/graph/map"));
	assert.deepEqual(f("[all[shadows+tiddlers]prefix[$:/graph/]] +[match[$:/plugins/dndwiki-core/graph/map]]"), []);
});

test("map fit: the map 600 units wide across the container, height from the aspect ratio, a hidden tab waits", function() {
	var mapFit = tw.modules.execute("$:/plugins/dndwiki-core/graph/map-fit.js"),
		moved = [],
		element = {clientWidth: 800, style: {}, ownerDocument: {defaultView: {innerHeight: 1000}}},
		adapter = {
			dndMapFit: "image",
			dndImage: {width: 1600, height: 1200},
			element: element,
			vis: {setSize: function() {}, moveTo: function(options) { moved.push(options); }}
		};
	assert.equal(mapFit.fit(adapter, true), true);
	assert.equal(element.style.height, "600px");
	assert.equal(moved[0].scale, 800 / 600);
	assert.ok(moved[0].position.x === 0 && moved[0].position.y === 0);
	// a tall image keeps its whole height, nothing is cut off
	adapter.dndImage = {width: 800, height: 2000};
	mapFit.fit(adapter, true);
	assert.equal(element.style.height, "2000px");
	// a tab not shown yet has no width
	element.clientWidth = 0;
	assert.equal(mapFit.fit(adapter, true), false);
});

test("map: nodes without a position get a grid slot, kept per id", function() {
	var mapFit = tw.modules.execute("$:/plugins/dndwiki-core/graph/map-fit.js"),
		adapter = {},
		changes = {nodes: {a: {dndUnplaced: true}, b: {dndUnplaced: true}, c: {dndUnplaced: true, x: 5, y: 6}}};
	mapFit.process.call(adapter, {}, changes);
	assert.ok(changes.nodes.a.x !== changes.nodes.b.x, "side by side");
	assert.ok(changes.nodes.c.x === 5 && changes.nodes.c.y === 6, "a saved position wins");
	var again = {nodes: {a: {dndUnplaced: true}}};
	mapFit.process.call(adapter, {}, again);
	assert.equal(again.nodes.a.x, changes.nodes.a.x);
	assert.equal(again.nodes.a.dndUnplaced, undefined);
});

test("ego toggle: a click folds or unfolds after a short wait, a double click does not", async function() {
	var toggleModule = tw.modules.execute("$:/plugins/dndwiki-core/graph/ego-toggle.js"),
		state = "$:/state/dndwiki-core/ego-open/Kingdom",
		handlers = {},
		adapter = {};
	toggleModule.process.call(adapter, {}, {nodes: {Town: {dndToggle: state}, Other: {label: "x"}}});
	assert.equal(adapter.dndToggles.Town, state);
	assert.equal(adapter.dndToggles.Other, undefined);
	toggleModule.init.call(adapter, {on: function(name, fn) { handlers[name] = fn; }});
	var wait = function() { return new Promise(function(resolve) { setTimeout(resolve, toggleModule.DELAY + 50); }); };
	try {
		handlers.click({nodes: ["Town"]});
		await wait();
		assert.deepEqual(Array.from(wiki.getTiddlerList(state)), ["Town"], "unfolded");
		handlers.click({nodes: ["Town"]});
		handlers.click({nodes: ["Town"]});
		handlers.doubleClick({nodes: ["Town"]});
		await wait();
		assert.deepEqual(Array.from(wiki.getTiddlerList(state)), ["Town"], "a double click leaves it");
		handlers.click({nodes: ["Other"]});
		handlers.click({nodes: ["Town"]});
		await wait();
		assert.deepEqual(Array.from(wiki.getTiddlerList(state)), [], "folded again");
	} finally {
		wiki.deleteTiddler(state);
	}
});

test("map pin: a custom shape, the same size on screen at any zoom", function() {
	var pin = tw.modules.execute("$:/plugins/dndwiki-core/graph/map-pin.js"),
		scale = 1,
		adapter = {vis: {getScale: function() { return scale; }}},
		changes = {nodes: {a: {dndPin: "spot"}, b: {dndPin: "tiddler"}, c: {label: "c"}}};
	pin.process.call(adapter, {}, changes);
	assert.equal(changes.nodes.a.shape, "custom");
	assert.equal(typeof changes.nodes.b.ctxRenderer, "function");
	assert.equal(changes.nodes.a.dndPin, undefined);
	assert.equal(changes.nodes.c.shape, undefined);
	var drawn = [],
		ctx = {font: "12px arial", measureText: function() { return {width: parseFloat(this.font) * 4}; }, beginPath: function() {}, arc: function() {}, fill: function() {}, stroke: function() {},
			moveTo: function() {}, arcTo: function() {}, closePath: function() {}, fillText: function(t) { drawn.push(t); },
			setLineDash: function(d) { drawn.push(Array.from(d).length); }},
		args = {ctx: ctx, x: 0, y: 0, style: {color: "#ff0000", borderColor: "#ff0000"}, label: "Kantine", state: {}};
	var near = changes.nodes.a.ctxRenderer(args);
	scale = 4;
	var far = changes.nodes.a.ctxRenderer(args);
	assert.ok(Math.abs(near.nodeDimensions.width / far.nodeDimensions.width - 4) < 1e-9, "zoomed in four times: a quarter of the size on the map");
	far.drawNode();
	assert.ok(drawn.indexOf("Kantine") !== -1 && drawn.indexOf(2) !== -1, "label in a dashed pill");
});

test("map fit: a pin below the image makes the frame taller, one beside it wider", function() {
	var mapFit = tw.modules.execute("$:/plugins/dndwiki-core/graph/map-fit.js"),
		moved = [],
		element = {clientWidth: 600, style: {}, ownerDocument: {defaultView: {}}},
		positions = {a: {x: 0, y: 0}},
		adapter = {
			dndMapFit: "image",
			dndImage: {width: 1200, height: 800},
			element: element,
			vis: {setSize: function() {}, moveTo: function(options) { moved.push(options); }, getPositions: function() { return positions; }}
		};
	mapFit.fit(adapter, true);
	assert.equal(element.style.height, "400px", "inside the image: the image alone");
	positions.b = {x: 0, y: 300};
	mapFit.fit(adapter, true);
	assert.equal(element.style.height, Math.round(200 + 300 + 35) + "px");
	assert.equal(moved[1].scale, 1);
	positions.c = {x: 400, y: 0};
	mapFit.fit(adapter, true);
	assert.ok(moved[2].scale < 1, "wider: smaller");
});

test("map fit without an image: fit to the nodes, the height stays", function() {
	var mapFit = tw.modules.execute("$:/plugins/dndwiki-core/graph/map-fit.js"),
		fitted = 0,
		element = {clientWidth: 800, style: {}, ownerDocument: {defaultView: {innerHeight: 1000}}},
		adapter = {
			dndMapFit: "nodes",
			element: element,
			vis: {fit: function() { fitted++; }, setSize: function() { throw new Error("no resize"); }}
		};
	assert.equal(mapFit.fit(adapter, false), true);
	assert.equal(fitted, 1);
	assert.equal(element.style.height, undefined);
	// moved by the viewer: only the button fits again
	adapter.dndMapMoved = true;
	mapFit.fit(adapter, false);
	assert.equal(fitted, 1);
	mapFit.fit(adapter, true);
	assert.equal(fitted, 2);
});

// Symmetric relations (field config dndwiki-symmetric): kept on both ends by convention, drawn
// as one edge with arrows on both ends; an end without the field leaves a plain arrow
var SYMMETRIC = ["alliance", "bond", "enmity", "family", "sibling", "spouse"];

function relations(list, fn) {
	return withTiddlers(list.map(function(fields) {
		return Object.assign({tags: "Person", text: "Someone."}, fields);
	}), fn);
}

test("symmetric fields: marked in their config, curves allowed", function() {
	SYMMETRIC.forEach(function(field) {
		var config = wiki.getTiddler("$:/config/flibbles/graph/edges/fields/" + field);
		assert.equal(config.fields["dndwiki-symmetric"], "yes", field);
		assert.equal(JSON.parse(config.fields.text).smooth, undefined, field);
	});
	assert.equal(wiki.getTiddler("$:/config/flibbles/graph/edges/fields/mentor").fields["dndwiki-symmetric"], undefined);
});

test("symmetric field on both ends: one edge with arrows on both ends", function() {
	relations([{title: "Alice", alliance: "Bob"}, {title: "Bob", alliance: "Alice"}], function() {
		[ego("Alice"), ego("Bob")].forEach(function(graph) {
			var alliance = graph.edges.filter(function(edge) { return edge.props.label === "Alliance"; });
			assert.equal(alliance.length, 1, edges(graph).join(" / "));
			assert.deepEqual([alliance[0].from, alliance[0].to].sort(), ["Alice", "Bob"]);
			assert.equal(alliance[0].props.arrows, "to from");
			assert.equal(alliance[0].props.smooth, undefined);
		});
	});
});

test("symmetric field on one end only: a plain arrow", function() {
	relations([{title: "Alice", alliance: "Bob"}, {title: "Bob"}, {title: "Carol", enmity: "Alice"}], function() {
		var graph = ego("Alice");
		assert.deepEqual(edges(graph), ["Alice -> Bob (Alliance)", "Carol -> Alice (Enmity)"]);
		graph.edges.forEach(function(edge) {
			assert.equal(edge.props.arrows, undefined);
		});
	});
});

test("symmetric fields: every pair once, in the ego graph and in a view", function() {
	relations([{title: "Alice", family: "Bob"}, {title: "Bob", family: "Alice Carol"}, {title: "Carol", family: "Bob"}], function() {
		// Alice - Bob - Carol: in the ego graph of Bob all three
		assert.equal(ego("Bob").edges.length, 2, edges(ego("Bob")).join(" / "));
		withTiddlers([{
			title: "$:/graph/Test", type: "application/json", text: "{}",
			template: "$:/plugins/dndwiki-core/graph/templates/dnd-graph",
			filter: "[[Alice]] [[Bob]] [[Carol]]"
		}], function() {
			var graph = h.graph(wiki, "<$graph.view $tiddler=\"$:/graph/Test\"/>");
			assert.equal(graph.edges.length, 2, edges(graph).join(" / "));
			graph.edges.forEach(function(edge) {
				assert.equal(edge.props.arrows, "to from");
			});
		});
	});
});

test("a field that is not symmetric keeps one edge per end", function() {
	relations([{title: "Alice", mentor: "Bob"}, {title: "Bob", mentor: "Alice"}], function() {
		assert.deepEqual(edges(ego("Alice")), ["Alice -> Bob (student of)", "Bob -> Alice (student of)"]);
	});
});

// The relation rules (modules/relations.js): axes, included types, every type its own edge,
// the arrow from the dependent to what it depends on

// Edges as "from -> to (label)", an edge with arrows on both ends as "a <-> b (label)" with
// its ends sorted (either end may be its from)
function pairs(graph) {
	return graph.edges.map(function(edge) {
		var label = edge.props.label ? " (" + edge.props.label + ")" : "";
		if(edge.props.arrows === "to from") {
			return [edge.from, edge.to].sort().join(" <-> ") + label;
		}
		return edge.from + " -> " + edge.to + label;
	}).sort();
}

function view(filter, fields, functions, fn) {
	return withTiddlers([{
		title: "$:/graph/Test", type: "application/json", text: "{}",
		template: "$:/plugins/dndwiki-core/graph/templates/dnd-graph",
		filter: filter,
		"edges.fields": fields,
		"edges.functions": functions
	}], function() {
		return fn(h.graph(wiki, "<$graph.view $tiddler=\"$:/graph/Test\"/>"));
	});
}

test("relations: a type includes others, the included one is not drawn (leader > officer > member, parent > ancestor)", function() {
	relations([{title: "Alice", leader: "Guild", member: "Guild"}, {title: "Bob", officer: "Guild", member: "Guild"}], function() {
		assert.deepEqual(edges(ego("Guild")).filter(function(edge) { return /Alice|Bob/.test(edge); }), [
			"Alice -> Guild (leads)",
			"Bob -> Guild (officer of)"
		]);
	});
	relations([{title: "Child", parent: "Mother", ancestor: "Mother Founder"}, {title: "Mother"}, {title: "Founder"}], function() {
		assert.deepEqual(edges(ego("Child")), ["Child -> Founder (descendant of)", "Child -> Mother (child of)"]);
	});
});

test("relations: different types of one direction stay edges of their own", function() {
	relations([{title: "Ellid", under: "Tyria", mentor: "Tyria"}, {title: "Tyria"}], function() {
		var graph = ego("Ellid");
		assert.deepEqual(edges(graph), ["Ellid -> Tyria (answers to)", "Ellid -> Tyria (student of)"]);
		var under = graph.edges.filter(function(edge) { return edge.props.label === "answers to"; })[0];
		assert.equal(under.props.color, "#ff8000", "colour of the axis power");
	});
	withTiddlers([{title: "Axe", tags: "Artifact", creator: "Grum", former: "Grum", text: "An axe."}], function() {
		assert.deepEqual(edges(ego("Axe")), ["Axe -> Grum (formerly with)", "Axe -> Grum (made by)"]);
	});
});

test("relations: a symmetric type is never merged with a directed one", function() {
	relations([{title: "Agin", bond: "Lagertha"}, {title: "Lagertha", bond: "Agin", mentor: "Agin"}], function() {
		assert.deepEqual(pairs(ego("Agin")), ["Agin <-> Lagertha (Bond)", "Lagertha -> Agin (student of)"]);
	});
});

test("relations: a type the view does not draw neither draws nor hides another one", function() {
	view("[[Guild]] [[Town]] [[Kingdom]]", "location", "spots", function(graph) {
		assert.deepEqual(edges(graph), ["Guild -> Kingdom (in)", "Guild -> Town (in)", "Town -> Kingdom (in)"]);
	});
	view("[[Guild]] [[Town]] [[Kingdom]]", "location", "rules", function(graph) {
		assert.deepEqual(edges(graph), ["Guild -> Kingdom (in)", "Guild -> Town (controls)", "Town -> Kingdom (in)"]);
	});
});

test("relations: colour of the axis, the colour of a type wins", function() {
	relations([{title: "Alice", location: "Town", alliance: "Bob"}, {title: "Bob", alliance: "Alice"}], function() {
		var graph = ego("Alice"),
			place = graph.edges.filter(function(edge) { return edge.to === "Town"; })[0],
			alliance = graph.edges.filter(function(edge) { return edge.props.label === "Alliance"; })[0];
		assert.equal(place.props.color, wiki.getTiddlerData("$:/config/dndwiki/graph/axes/place").color);
		assert.equal(alliance.props.color, "#06e502");
	});
});

test("relations: every type is on an axis, except links, spots and transcludes", function() {
	var outside = f("[relationtypes[]] :filter[relationaxis[]is[blank]]").filter(function(type) {
		return ["tags", "list", "links", "spots", "transcludes"].indexOf(type) === -1;
	});
	assert.deepEqual(outside, []);
});

test("family: parent from the child, spouse and sibling both ways, a shared parent alone makes no siblings", function() {
	relations([{title: "Sven"}, {title: "Lagertha", parent: "Sven", spouse: "Ragna", sibling: "Bjorn"}, {title: "Bjorn", parent: "Sven", sibling: "Lagertha"}, {title: "Ragna", spouse: "Lagertha"}, {title: "Foster", parent: "Sven"}], function() {
		var graph = ego("Lagertha");
		assert.deepEqual(pairs(graph), [
			"Bjorn -> Sven (child of)",
			"Bjorn <-> Lagertha (Sibling)",
			"Lagertha -> Sven (child of)",
			"Lagertha <-> Ragna (Spouse)"
		]);
		assert.ok(!graph.nodes.Foster, "same parent, no sibling: not a neighbour");
		graph.edges.forEach(function(edge) {
			assert.equal(edge.props.color, "#a8a102", "axis family");
		});
	});
});

test("links: their own edge in grey, mutual links as one edge with two arrows", function() {
	relations([{title: "Alice", text: "Knows [[Bob]]."}, {title: "Bob", text: "Knows [[Alice]]."}, {title: "Carol", text: "Knows [[Alice]].", bond: "Alice"}], function() {
		view("[[Alice]] [[Bob]] [[Carol]]", "[all[]] -[[tags]] -[[list]]", "links", function(graph) {
			assert.deepEqual(pairs(graph), [
				"Alice <-> Bob (references)",
				"Carol -> Alice (Bond)",
				"Carol -> Alice (references)"
			]);
			graph.edges.filter(function(edge) { return edge.props.label === "references"; }).forEach(function(edge) {
				assert.equal(edge.props.color, "#999999");
			});
		});
	});
});
