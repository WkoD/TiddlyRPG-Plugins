/*
 * Integration with tw5-graph. The graph widget itself needs a browser; this checks the override
 * of $:/plugins/flibbles/graph/macros/edges.typed (translated edge labels are in lang/i18n).
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

test("edges.typed override wins over tw5-graph (plugin-priority)", function() {
	assert.ok((wiki.getTiddlerText("$:/plugins/flibbles/graph/macros/edges.typed") || "").indexOf("dndtranslate") !== -1);
});

function f(text) {
	return Array.from(h.filter(wiki, text));
}

test("leader: the field edge leaves out locations (dndwiki-exclude)", function() {
	assert.deepEqual(f("[[Guild]get[leader]enlist-input[]] -[subfilter{$:/config/flibbles/graph/edges/fields/leader!!dndwiki-exclude}]"), []);
	assert.deepEqual(f("[[Guildmaster]get[leader]enlist-input[]] -[subfilter{$:/config/flibbles/graph/edges/fields/leader!!dndwiki-exclude}]"), ["Guild"]);
});

test("override: field targets cleaned by dndwiki-exclude, function labels translated", function() {
	var text = wiki.getTiddlerText("$:/plugins/flibbles/graph/macros/edges.typed") || "";
	assert.ok(text.indexOf("-[subfilter<dndExclude>]") !== -1);
	assert.ok(text.indexOf("then<functionName>addprefix[Field/]dndtranslate[]") !== -1);
});

test("function edge rules: leader -> location", function() {
	assert.deepEqual(f("[[Guild]subfilter{$:/config/flibbles/graph/edges/functions/rules!!filter}]"), ["Town"]);
	assert.deepEqual(f("[[Guildmaster]subfilter{$:/config/flibbles/graph/edges/functions/rules!!filter}]"), []);
});

test("function edge spots: location -> its spots that are locations", function() {
	assert.deepEqual(f("[[Town]subfilter{$:/config/flibbles/graph/edges/functions/spots!!filter}]"), ["Tavern"]);
});

test("label of rules translated", function() {
	h.setLanguage(wiki, "de-DE");
	assert.deepEqual(f("[[Field/rules]dndtranslate[]]"), ["Kontrolliert"]);
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
