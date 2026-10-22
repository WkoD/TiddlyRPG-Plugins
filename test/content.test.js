/*
 * Content packages (modules/content-server.js, server/content-route.js): packages in
 * <wiki>/node_modules found through package.json, their manifests and entries; the route with its
 * index and entry, 403 for who may not write, 404 for an unknown id, the ruleset as filter, an id
 * that names a path, a package for a core it does not fit.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	fs = require("fs"),
	os = require("os"),
	path = require("path"),
	h = require("./helpers");

var $tw, content, route, dir;

var RULESET = "$:/plugins/fixture-ruleset-5e-mini";

function write(file, data) {
	fs.mkdirSync(path.dirname(file), {recursive: true});
	fs.writeFileSync(file, typeof data === "string" ? data : JSON.stringify(data));
}

// A package in node_modules with one manifest and its files
function pack(name, manifest, files) {
	var base = path.join(dir, "node_modules", name);
	write(path.join(base, "package.json"), {name: name, version: "1.0.0", tiddlyrpg: {content: ["content/manifest.json"]}});
	write(path.join(base, "content", "manifest.json"), manifest);
	Object.keys(files).forEach(function(file) {
		write(path.join(base, "content", file), files[file]);
	});
}

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		content = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/content-server.js");
		route = $tw.modules.execute("$:/plugins/tiddlyrpg-core/server/content-route.js");
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "trpg-content-"));
		pack("srd-mini", {name: "SRD mini", ruleset: RULESET, language: "en-GB", "tiddlyrpg-core-version": ">=2.0.0", source: "SRD 5.1",
			files: ["items.json", "spells.json"]}, {
			"items.json": {entries: [
				{id: "longsword", title: "Longsword", type: "Item", tags: ["Equipment"], fields: {category: "weapon, martial, melee, versatile", damage: "1d8 slashing"}, text: "A sword."},
				{id: "potion-of-healing", title: "Potion of Healing", type: "Item", tags: ["Consumable"], fields: {category: "potion", rarity: "common"}, text: "Red."}
			]},
			"spells.json": {entries: [{id: "fireball", title: "Fireball", type: "Spell", fields: {level: "3"}, text: "Boom."}]}
		});
		pack("@wkod/other", {name: "Other", ruleset: "$:/plugins/fixture-ruleset-probe", language: "de-DE", "tiddlyrpg-core-version": ">=2.0.0",
			files: ["e.json"]}, {"e.json": {entries: [{id: "x", title: "X", type: "Item"}]}});
		pack("too-new", {name: "Too new", ruleset: RULESET, "tiddlyrpg-core-version": ">=99.0.0", files: ["e.json"]}, {"e.json": {entries: [{id: "y", title: "Y", type: "Item"}]}});
		write(path.join(dir, "node_modules", "plain", "package.json"), {name: "plain"});
	});
});

test.after(function() {
	fs.rmSync(dir, {recursive: true, force: true});
});

// Runs the route as the server would: {status, data}
function get(which, query, writer) {
	var out = {};
	route.handler({}, {}, {
		boot: {wikiPath: dir},
		params: [which],
		queryParameters: query,
		authenticatedUsername: writer === false ? "reader" : "dm",
		server: {isAuthorized: function(type, user) { return user === "dm"; }},
		sendResponse: function(status, headers, text) {
			out.status = status;
			out.data = JSON.parse(text);
		}
	});
	return out;
}

test("the packages of node_modules, scoped ones too; a package for a newer core is left out", function() {
	var names = content.packages(dir).map(function(p) { return p.name; }).sort();
	assert.equal(names.join(), "Other,SRD mini");
});

test("index: the packages of the ruleset, the entries without their texts", function() {
	var r = get("index", {ruleset: RULESET});
	assert.equal(r.status, 200);
	assert.equal(r.data.packages.length, 1);
	var p = r.data.packages[0];
	assert.equal(p.name, "SRD mini");
	assert.equal(p.language, "en-GB");
	assert.deepEqual(p.entries.map(function(e) { return e.id; }), ["longsword", "potion-of-healing", "fireball"]);
	assert.equal(p.entries[0].text, undefined);
	assert.equal(p.entries[0].fields.damage, "1d8 slashing");
	assert.equal(get("index", {ruleset: "$:/plugins/fixture-ruleset-probe"}).data.packages[0].name, "Other");
	assert.deepEqual(get("index", {ruleset: "none"}).data.packages, []);
});

test("entry: with its text and its package; 404 for an unknown id or another ruleset", function() {
	var r = get("entry", {ruleset: RULESET, id: "fireball"});
	assert.equal(r.status, 200);
	assert.equal(r.data.entry.text, "Boom.");
	assert.equal(r.data.package.source, "SRD 5.1");
	assert.equal(get("entry", {ruleset: RULESET, id: "nope"}).status, 404);
	assert.equal(get("entry", {ruleset: "$:/plugins/fixture-ruleset-probe", id: "fireball"}).status, 404);
	assert.equal(get("entry", {ruleset: RULESET, id: "../package"}).status, 404, "an id is no path");
});

test("403 for who may not write", function() {
	assert.equal(get("index", {ruleset: RULESET}, false).status, 403);
	assert.equal(get("entry", {ruleset: RULESET, id: "fireball"}, false).status, 403);
});

test("the path of the route", function() {
	assert.ok(route.path.test("/tiddlyrpg/content/index.json"));
	assert.ok(route.path.test("/tiddlyrpg/content/entry.json"));
	assert.ok(!route.path.test("/tiddlyrpg/content/../x.json"));
	assert.equal(route.methods.join(), "GET");
});

test.describe("in the browser: the offers of the index", function() {
	var wiki, offers;

	function index(packages) {
		h.add(wiki, {title: "$:/temp/tiddlyrpg-core/content/index", type: "application/json", text: JSON.stringify({ruleset: RULESET, packages: packages})});
	}

	var PKG = {name: "SRD mini", language: "en-GB", source: "SRD 5.1", entries: [
		{id: "longsword", title: "Longsword", type: "Item", tags: ["Equipment"], fields: {category: "weapon, martial", price: 15, weight: "3 lb"}},
		{id: "book", title: "Book", type: "Item", fields: {price: 25}},
		{id: "balor", title: "Balor", type: "Creature", fields: {}},
		{id: "frost", title: "Frost Brand", type: "Item", fields: {base: "Longsword", spells: "Fireball [[Cone of Cold]]"}},
		{id: "fireball", title: "Fireball", type: "Spell", fields: {level: "3"}},
		{id: "hidden", title: "Geheimnis", type: "Item", fields: {}}
	]};

	test.before(function() {
		wiki = $tw.wiki;
		offers = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/content.js");
		h.setLanguage(wiki, "de-DE");
		h.add(wiki, {title: "Balor", tags: "Person", text: "A man."});
		h.add(wiki, {title: "Geheimnis", tags: "Item Secret", text: "Locked."});
		index([PKG]);
	});

	test.after(function() {
		["Balor", "Geheimnis", "$:/temp/tiddlyrpg-core/content/index"].forEach(function(t) { wiki.deleteTiddler(t); });
	});

	test("titles: free as it is; taken under the same type; another type with the type of the language of the package", function() {
		var titles = offers.offers(wiki).map(function(o) { return o.title; });
		assert.ok(titles.indexOf("Longsword") !== -1);
		assert.ok(titles.indexOf("Book (Item)") !== -1, "the hub Book of the core is a shadow - it wins");
		assert.ok(titles.indexOf("Balor (Creature)") !== -1, "the person Balor wins");
		assert.equal(titles.indexOf("Geheimnis"), -1, "a locked tiddler of the same title and type: taken - nothing tells it");
		h.add(wiki, {title: "Longsword", tags: "Item", text: "Ours."});
		try {
			assert.equal(offers.offer(wiki, "longsword"), null, "taken once it is there");
		} finally {
			wiki.deleteTiddler("Longsword");
		}
	});

	test("the fields to take: type and tags, a price of the ruleset in the coins of the setting, the source", function() {
		var o = offers.offer(wiki, "longsword"),
			fields = offers.toFields(wiki, o.package, o.entry, o.title);
		assert.equal(fields.tags.join(), "Item,Equipment");
		assert.equal(fields.price, "15 gp");
		assert.equal(fields.weight, "3 lb");
		assert.equal(fields.source, "SRD 5.1");
	});

	test("what an entry names in base and spells that the wiki lacks, with its offer", function() {
		var wanting = offers.wanting(wiki, {base: "Longsword", spells: "Fireball [[Cone of Cold]]"});
		assert.deepEqual(wanting.map(function(w) { return w.title + ">" + w.id; }).join(), "Longsword>longsword,Fireball>fireball", "Cone of Cold has no offer");
	});

	test("filters and the box of a missing tiddler", function() {
		assert.deepEqual(Array.from(h.filter(wiki, "[trpgcontentready[]]")), ["yes"]);
		assert.deepEqual(Array.from(h.filter(wiki, "[[Book (Item)]trpgcontentfor[]]")), ["book"]);
		var html = h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/viewtemplates/content-missing\" mode=\"block\"/>", {currentTiddler: "Fireball"});
		assert.match(html, /SRD mini hat dies als Zauber/);
		assert.match(html, /Übernehmen/);
		assert.doesNotMatch(h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/viewtemplates/content-missing\" mode=\"block\"/>", {currentTiddler: "Balor"}), /Übernehmen/, "a tiddler that exists: no box");
	});

	test("without a package: nothing", function() {
		index([]);
		try {
			assert.deepEqual(Array.from(h.filter(wiki, "[trpgcontentready[]]")), []);
			assert.doesNotMatch(h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/viewtemplates/content-missing\" mode=\"block\"/>", {currentTiddler: "Fireball"}), /Übernehmen/);
		} finally {
			index([PKG]);
		}
	});
});
