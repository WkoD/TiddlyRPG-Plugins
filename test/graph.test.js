/*
 * Integration with tw5-graph: the override of $:/plugins/flibbles/graph/macros/edges.typed, the
 * function edges, the ego graph, the map and the view template trpg-graph - through the nodes and
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

var EGO = "<$graph.view $tiddler=\"$:/plugins/tiddlyrpg-core/graph/ego\"/>",
	MAP = "<$graph.view $tiddler=\"$:/plugins/tiddlyrpg-core/graph/map\"/>";

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

test("leader: the field edge leaves out locations (tiddlyrpg-exclude)", function() {
	assert.deepEqual(f("[[Guild]get[leader]enlist-input[]] -[subfilter{$:/config/flibbles/graph/edges/fields/leader!!tiddlyrpg-exclude}]"), []);
	assert.deepEqual(f("[[Guildmaster]get[leader]enlist-input[]] -[subfilter{$:/config/flibbles/graph/edges/fields/leader!!tiddlyrpg-exclude}]"), ["Guild"]);
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

test("ego graph: the dead marked (striped by graph/pill.js) in the colour of their type", function() {
	var grum = ego("Insel Avalon").nodes.Grum;
	assert.equal(grum.color, colour("Person"));
	assert.equal(grum.trpgDead, "yes");
});

test("ego graph of a location: its spots count as the centre, other locations stay out", function() {
	var graph = ego("Town");
	assert.deepEqual(nodes(graph), ["Barkeep", "Guild", "Guildmaster", "Tavern", "Town", "Wanderer"]);
	assert.equal(graph.nodes.Tavern.label, "Tavern");
	assert.equal(graph.nodes.Tavern.trpgToggle, undefined);
	assert.ok(edges(graph).indexOf("Barkeep -> Tavern (in)") !== -1, "who is in a spot");
	assert.ok(edges(graph).every(function(edge) { return edge.indexOf("Kingdom") === -1; }), "no edge to the parent");
});

test("ego graph of a location: the places within as plain nodes, without their neighbours", function() {
	var graph = ego("Kingdom");
	assert.deepEqual(nodes(graph), ["Guild", "Kingdom", "Neighbour", "Tavern", "Town", "Twice", "Wanderer"]);
	assert.equal(graph.nodes.Town.label, "Town");
	assert.equal(graph.nodes.Town.trpgToggle, undefined);
	assert.ok(!graph.nodes.Guildmaster, "who is in Town stays out");
});

test("map: places lying in the location and its spots as pins, no edges", function() {
	var graph = map("Town");
	assert.deepEqual(Object.keys(graph.nodes), ["Tavern", "Town#Old Well", "Town#Tempel von Chauntea", "Guild"]);
	assert.deepEqual(graph.edges, []);
	assert.equal(graph.nodes.Tavern.trpgPin, "tiddler");
	// a spot joined to a tiddler that is no location: a point of interest, pinned as that tiddler
	assert.equal(graph.nodes.Guild.trpgPin, "tiddler");
	assert.equal(graph.nodes.Guild.color, colour("Organisation"));
	var well = graph.nodes["Town#Old Well"];
	assert.equal(well.trpgPin, "spot");
	assert.equal(well.label, "Old Well");
	assert.equal(well.color, "#ffffff");
	assert.equal(well.borderColor, colour("Location"));
	assert.equal(graph.graph.trpgMapImage, "images/map/Town.png");
	assert.equal(graph.graph.trpgMapFit, "image");
});

test("map: places lying in it at every depth, the parts of a place only on its own map", function() {
	var graph = map("Kingdom");
	assert.deepEqual(nodes(graph), ["Neighbour", "Town", "Twice"]);
	assert.equal(graph.graph.trpgMapImage, undefined);
	assert.equal(graph.graph.trpgMapFit, "nodes");
});

test("map: saved positions, a slot in the grid for the rest", function() {
	withTiddlers([{title: "Town", "map-positions": "{\"Tavern\":\"10,-20\"}"}], function() {
		var graph = map("Town");
		assert.equal(graph.nodes.Tavern.x, "10");
		assert.equal(graph.nodes.Tavern.y, "-20");
		assert.equal(graph.nodes.Tavern.trpgUnplaced, undefined);
		assert.equal(graph.nodes["Town#Old Well"].trpgUnplaced, "yes");
	});
});

test("map: pins fixed, movable while editing, never in the published copy", function() {
	var saves = function(node) { return (node.free || "").indexOf("map-positions") !== -1; },
		edit = {title: "$:/state/tiddlyrpg-core/map-edit/Town", text: "yes"};
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

test("map: open quests as pills with edges to the nodes their newest marker leads to, those about the location below the map", function() {
	withTiddlers([{title: "Mapquests", tags: "Event", date: "1351-01-01, 1351-02-01",
		text: "<<date>>\n\n<<quest \"Q Gilde\">>Zur [[Guild]].\n\n<<quest \"Q Brunnen\">>Am <<spotlink \"Town\" \"Old Well\">>.\n\n<<quest \"Q Stadt\">>Mit [[Guildmaster]].\n\n" +
			"<<quest \"Q Fertig\" status:\"complete\">>Zur [[Guild]].\n\n<<secret>><<date>>\n\n<<quest \"Q Geheim\">>Zur [[Guild]]."}], function() {
		var graph = map("Town"),
			all = edges(graph);
		["Q Gilde", "Q Brunnen", "Q Stadt", "Q Geheim"].forEach(function(name) { assert.ok(graph.nodes[name], name); });
		assert.ok(!graph.nodes["Q Fertig"], "complete: not on the map");
		assert.ok(all.indexOf("Q Gilde -> Guild") !== -1 && all.indexOf("Q Brunnen -> Town#Old Well") !== -1, all.join());
		assert.equal(graph.nodes["Q Stadt"].trpgUnplaced, "yes", "about the town as a whole: below the map");
		assert.ok(all.every(function(edge) { return edge.indexOf("Q Stadt") === -1; }));
		assert.ok(!h.inView(wiki, "public", function() { return map("Town"); }).nodes["Q Geheim"], "a locked marker leads nowhere");
		withTiddlers([{title: "$:/state/tiddlyrpg-core/map-filter/Town", list: "quest"}], function() {
			assert.ok(!map("Town").nodes["Q Gilde"]);
		});
	});
});

test("map: a kind switched off leaves out its nodes (a spot without a tiddler counts as a location); all off leaves the image", function() {
	withTiddlers([{title: "$:/state/tiddlyrpg-core/map-filter/Town", list: "location"}], function() {
		assert.deepEqual(nodes(map("Town")), ["Guild"]);
	});
	withTiddlers([{title: "$:/state/tiddlyrpg-core/map-filter/Town", list: "location organisation"}], function() {
		var graph = map("Town");
		assert.deepEqual(nodes(graph), []);
		assert.equal(graph.graph.trpgMapImage, "images/map/Town.png");
	});
});

test("view template trpg-graph: nodes from the filter, edge types of the view", function() {
	withTiddlers([{
		title: "$:/graph/Test", type: "application/json", text: "{}",
		template: "$:/plugins/tiddlyrpg-core/graph/templates/trpg-graph",
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
	assert.ok(wiki.tiddlerExists("$:/plugins/tiddlyrpg-core/graph/map") || wiki.isShadowTiddler("$:/plugins/tiddlyrpg-core/graph/map"));
	assert.deepEqual(f("[all[shadows+tiddlers]prefix[$:/graph/]] +[match[$:/plugins/tiddlyrpg-core/graph/map]]"), []);
});

test("map fit: the map 600 units wide across the container, height from the aspect ratio, a hidden tab waits", function() {
	var mapFit = tw.modules.execute("$:/plugins/tiddlyrpg-core/graph/map-fit.js"),
		moved = [],
		element = {clientWidth: 800, style: {}, ownerDocument: {defaultView: {innerHeight: 1000}}},
		adapter = {
			trpgMapFit: "image",
			trpgImage: {width: 1600, height: 1200},
			element: element,
			vis: {setSize: function() {}, moveTo: function(options) { moved.push(options); }}
		};
	assert.equal(mapFit.fit(adapter, true), true);
	assert.equal(element.style.height, "600px");
	assert.equal(moved[0].scale, 800 / 600);
	assert.ok(moved[0].position.x === 0 && moved[0].position.y === 0);
	// a tall image keeps its whole height, nothing is cut off
	adapter.trpgImage = {width: 800, height: 2000};
	mapFit.fit(adapter, true);
	assert.equal(element.style.height, "2000px");
	// a tab not shown yet has no width
	element.clientWidth = 0;
	assert.equal(mapFit.fit(adapter, true), false);
});

test("map: nodes without a position get a grid slot, kept per id", function() {
	var mapFit = tw.modules.execute("$:/plugins/tiddlyrpg-core/graph/map-fit.js"),
		adapter = {},
		changes = {nodes: {a: {trpgUnplaced: true}, b: {trpgUnplaced: true}, c: {trpgUnplaced: true, x: 5, y: 6}}};
	mapFit.process.call(adapter, {}, changes);
	assert.ok(changes.nodes.a.x !== changes.nodes.b.x, "side by side");
	assert.ok(changes.nodes.c.x === 5 && changes.nodes.c.y === 6, "a saved position wins");
	var again = {nodes: {a: {trpgUnplaced: true}}};
	mapFit.process.call(adapter, {}, again);
	assert.equal(again.nodes.a.x, changes.nodes.a.x);
	assert.equal(again.nodes.a.trpgUnplaced, undefined);
});

test("pill: the colour of a node as its border, light inside, the label in the font colour; the dead striped", function() {
	var pill = tw.modules.execute("$:/plugins/tiddlyrpg-core/graph/pill.js"),
		adapter = {},
		changes = {
			graph: {trpgPillBase: "#ffffff", trpgPillText: "#333333"},
			nodes: {a: {trpgPill: "yes", color: "#00a600", shape: "box"}, dead: {trpgPill: "yes", trpgDead: "yes", color: "#00a600", shape: "box"},
				own: {trpgPill: "yes", color: "#ffffff", borderColor: "#00a600"}, plain: {label: "x"}}
		};
	pill.process.call(adapter, {}, changes);
	assert.deepEqual(JSON.parse(JSON.stringify(changes.nodes.a.color)), {background: "#d1efd1", border: "#00a600", highlight: {background: "#d1efd1", border: "#00a600"}, hover: {background: "#d1efd1", border: "#00a600"}});
	assert.equal(changes.nodes.a.font.color, "#333333");
	assert.equal(changes.nodes.a.trpgPill, undefined);
	assert.equal(changes.nodes.own.color, "#ffffff", "a border colour of its own: as it is");
	assert.equal(changes.graph.trpgPillBase, undefined);
	assert.equal(pill.mix("#e6b400", "#1c1d20"), "#40381a", "a dark palette: dark inside");
	assert.equal(changes.nodes.plain.color, undefined);
	// The dead: a box of its own, striped grey (the font colour) and its colour, both at 18 %
	assert.equal(changes.nodes.dead.shape, "custom");
	var fills = [], texts = [],
		ctx = {font: "14px arial", measureText: function() { return {width: 40}; }, beginPath: function() {}, moveTo: function() {}, lineTo: function() {}, arcTo: function() {},
			closePath: function() {}, save: function() {}, restore: function() {}, clip: function() {}, stroke: function() {},
			fill: function() { fills.push(this.fillStyle); }, fillRect: function() { fills.push(this.fillStyle); }, fillText: function(t) { texts.push(t); }},
		drawn = changes.nodes.dead.ctxRenderer({ctx: ctx, x: 0, y: 0, label: "Grum", state: {}});
	drawn.drawNode();
	assert.deepEqual(Array.from(new Set(fills)), [pill.mix("#333333", "#ffffff"), "#d1efd1"]);
	assert.deepEqual(texts, ["Grum"]);
	assert.equal(drawn.nodeDimensions.width, 50);
});

test("map pin: a custom shape, the same size on screen at any zoom", function() {
	var pin = tw.modules.execute("$:/plugins/tiddlyrpg-core/graph/map-pin.js"),
		scale = 1,
		adapter = {vis: {getScale: function() { return scale; }}},
		changes = {nodes: {a: {trpgPin: "spot"}, b: {trpgPin: "tiddler"}, c: {label: "c"}}};
	pin.process.call(adapter, {}, changes);
	assert.equal(changes.nodes.a.shape, "custom");
	assert.equal(typeof changes.nodes.b.ctxRenderer, "function");
	assert.equal(changes.nodes.a.trpgPin, undefined);
	assert.equal(changes.nodes.c.shape, undefined);
	var drawn = [],
		filled = [],
		ctx = {font: "12px arial", measureText: function() { return {width: parseFloat(this.font) * 4}; }, beginPath: function() {}, arc: function() {}, stroke: function() {},
			moveTo: function() {}, lineTo: function() {}, arcTo: function() {}, closePath: function() {}, save: function() {}, restore: function() {}, clip: function() {},
			fill: function() { filled.push(this.fillStyle); }, fillRect: function() { filled.push(this.fillStyle); }, fillText: function(t) { drawn.push(t); },
			setLineDash: function(d) { drawn.push(Array.from(d).length); }},
		args = {ctx: ctx, x: 0, y: 0, style: {color: "#ff0000", borderColor: "#ff0000"}, label: "Kantine", state: {}};
	adapter.trpgPillBase = "#ffffff";
	adapter.trpgPillText = "#333333";
	var near = changes.nodes.a.ctxRenderer(args);
	scale = 4;
	var far = changes.nodes.a.ctxRenderer(args);
	assert.ok(Math.abs(near.nodeDimensions.width / far.nodeDimensions.width - 4) < 1e-9, "zoomed in four times: a quarter of the size on the map");
	far.drawNode();
	assert.ok(drawn.indexOf("Kantine") !== -1 && drawn.indexOf(2) !== -1, "label in a dashed pill");
	assert.ok(filled.indexOf("#ffffff") !== -1 && filled.indexOf("#ffd1d1") !== -1, "a spot striped white and its colour: " + filled.join());
	// A dead place: its pill striped (graph/pill.js), the text in the font colour of the graph
	var dead = {nodes: {d: {trpgPin: "tiddler", trpgDead: "yes"}}};
	filled = [];
	pin.process.call(adapter, {}, dead);
	dead.nodes.d.ctxRenderer({ctx: ctx, x: 0, y: 0, style: {color: "#ffd5d5", borderColor: "#ff0000"}, label: "Burg", state: {}}).drawNode();
	assert.ok(filled.indexOf("#dadada") !== -1 && filled.indexOf("#ffd1d1") !== -1, filled.join());
	assert.equal(ctx.fillStyle, "#333333");
});

test("map fit: a pin below the image makes the frame taller, one beside it wider", function() {
	var mapFit = tw.modules.execute("$:/plugins/tiddlyrpg-core/graph/map-fit.js"),
		moved = [],
		element = {clientWidth: 600, style: {}, ownerDocument: {defaultView: {}}},
		positions = {a: {x: 0, y: 0}},
		adapter = {
			trpgMapFit: "image",
			trpgImage: {width: 1200, height: 800},
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
	var mapFit = tw.modules.execute("$:/plugins/tiddlyrpg-core/graph/map-fit.js"),
		fitted = 0,
		element = {clientWidth: 800, style: {}, ownerDocument: {defaultView: {innerHeight: 1000}}},
		adapter = {
			trpgMapFit: "nodes",
			element: element,
			vis: {fit: function() { fitted++; }, setSize: function() { throw new Error("no resize"); }}
		};
	assert.equal(mapFit.fit(adapter, false), true);
	assert.equal(fitted, 1);
	assert.equal(element.style.height, undefined);
	// moved by the viewer: only the button fits again
	adapter.trpgMapMoved = true;
	mapFit.fit(adapter, false);
	assert.equal(fitted, 1);
	mapFit.fit(adapter, true);
	assert.equal(fitted, 2);
});

// Symmetric relations (field config tiddlyrpg-symmetric): kept on both ends by convention, drawn
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
		assert.equal(config.fields["tiddlyrpg-symmetric"], "yes", field);
		assert.equal(JSON.parse(config.fields.text).smooth, undefined, field);
	});
	assert.equal(wiki.getTiddler("$:/config/flibbles/graph/edges/fields/mentor").fields["tiddlyrpg-symmetric"], undefined);
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
			template: "$:/plugins/tiddlyrpg-core/graph/templates/trpg-graph",
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
		template: "$:/plugins/tiddlyrpg-core/graph/templates/trpg-graph",
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
		assert.equal(place.props.color, wiki.getTiddlerData("$:/config/tiddlyrpg/graph/axes/place").color);
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
