/*
 * The relation rules (modules/relations.js, filters/relations.js): the filters, the relation
 * list forward and back, included types, symmetric types, family, and who leads a location
 * as present there. Edges in the graph: graph.test.js.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var wiki;

test.before(function() {
	return h.boot().then(function($tw) {
		wiki = $tw.wiki;
		h.setLanguage(wiki, "de-DE");
	});
});

function f(text) {
	return Array.from(h.filter(wiki, text));
}

// Runs fn with the given persons added (tag Person unless given), then removes them
function people(list, fn) {
	list.forEach(function(fields) {
		h.add(wiki, Object.assign({tags: "Person", text: "Someone."}, fields));
	});
	try {
		return fn();
	} finally {
		list.forEach(function(fields) {
			wiki.deleteTiddler(fields.title);
		});
	}
}

function list(self) {
	return h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/dndwiki-core/viewtemplates/relations/list\" mode=\"block\"/>", {self: self, currentTiddler: self});
}

// The groups of a relation list: {heading: [titles]}
function groups(html) {
	var result = {};
	html.split("<h3 class=\"dnd-relations-group\">").slice(1).forEach(function(part) {
		var heading = part.slice(0, part.indexOf("</h3>")),
			titles = [];
		part.replace(/<a [^>]*>([^<]*)<\/a>/g, function(match, title) {
			titles.push(title);
		});
		result[heading] = titles;
	});
	return result;
}

test("filters: targets without the excluded and the included ones, the way back, the label", function() {
	people([{title: "Alice", leader: "Guild Town", member: "Guild"}], function() {
		assert.deepEqual(f("[[Alice]relationtargets[leader]]"), ["Guild"], "a location is drawn by rules");
		assert.deepEqual(f("[[Alice]relationtargets[member]]"), [], "leader includes member");
		assert.deepEqual(f("[[Alice]relationtargets[rules]]"), ["Town"]);
		assert.deepEqual(f("[[Guild]relationsources[leader]]").sort(), ["Alice", "Guildmaster"]);
		assert.deepEqual(f("[[Guild]relationsources[member]]"), []);
		assert.deepEqual(f("[[Town]relationsources[rules]]").sort(), ["Alice", "Guild"]);
		assert.deepEqual(f("[[leader]relationlabel[]]"), ["führt"]);
		assert.deepEqual(f("[[spots]relationlabel[]]"), [], "no key, no label");
	});
});

test("filters: only the types in play count", function() {
	assert.deepEqual(f("[[Guild]relationtargets[location],[location]]"), ["Town", "Kingdom"], "without rules, location draws Town");
	assert.deepEqual(f("[[Guild]relationtargets[location]]"), ["Kingdom"]);
});

test("filters: different types to the same target are not included in each other", function() {
	people([{title: "Ellid", under: "Tyria", mentor: "Tyria"}, {title: "Tyria"}], function() {
		assert.deepEqual(f("[[Ellid]relationtargets[under]]"), ["Tyria"]);
		assert.deepEqual(f("[[Ellid]relationtargets[mentor]]"), ["Tyria"]);
	});
});

test("relation list: forward and back under their own headings", function() {
	var guild = groups(list("Guild")),
		master = groups(list("Guildmaster"));
	assert.deepEqual(guild["Anführer"], ["Guildmaster"]);
	assert.deepEqual(master["Führt"], ["Guild"]);
	assert.equal(master["Anführer"], undefined);
	assert.deepEqual(guild["Kontrolliert"], ["Town"]);
});

test("relation list: an included type is left out on both sides", function() {
	people([{title: "Alice", leader: "Guild", member: "Guild"}, {title: "Bob", member: "Guild"}], function() {
		var alice = groups(list("Alice")),
			guild = groups(list("Guild"));
		assert.deepEqual(alice["Führt"], ["Guild"]);
		assert.equal(alice["Mitglied von"], undefined);
		assert.deepEqual(guild["Mitglieder"], ["Bob"]);
		assert.deepEqual(guild["Anführer"], ["Alice", "Guildmaster"]);
	});
});

test("relation list: a symmetric type as one group, both ways", function() {
	people([{title: "Alice", alliance: "Bob"}, {title: "Bob"}, {title: "Carol", alliance: "Alice"}], function() {
		assert.deepEqual(groups(list("Alice"))["Allianz"], ["Bob", "Carol"]);
	});
});

test("relation list: family - parents, children, siblings", function() {
	people([{title: "Sven"}, {title: "Lagertha", parent: "Sven", sibling: "Bjorn"}, {title: "Bjorn", parent: "Sven", sibling: "Lagertha"}, {title: "Foster", parent: "Sven"}], function() {
		var sven = groups(list("Sven")),
			lagertha = groups(list("Lagertha"));
		assert.deepEqual(sven["Kinder"], ["Bjorn", "Foster", "Lagertha"]);
		assert.deepEqual(lagertha["Eltern"], ["Sven"]);
		assert.deepEqual(lagertha["Geschwister"], ["Bjorn"], "only what is entered, not everyone with the same parent");
		assert.equal(sven["Geschwister"], undefined);
	});
});

test("relation list: the headings in the order of the axes", function() {
	people([{title: "Alice", location: "Town", member: "Guild", parent: "Grum", alliance: "Bob", mentor: "Bob"}, {title: "Bob", alliance: "Alice"}], function() {
		var headings = Object.keys(groups(list("Alice")));
		assert.deepEqual(headings, ["Ort", "Mitglied von", "Eltern", "Allianz", "Mentor"]);
	});
});

test("who leads a location is present there, marked in the tree", function() {
	h.add(wiki, {title: "Watch", tags: "Organisation", leader: "Tavern", text: "Keeps order."});
	try {
		assert.ok(f("[[Tavern]occupants[]]").indexOf("Watch") !== -1);
		assert.ok(f("[[Town]occupants[]]").indexOf("Watch") !== -1, "through the spot");
		var town = list("Town");
		assert.match(town, /<a [^>]*>Guild<\/a><span class="dnd-via"> \(kontrolliert\)<\/span>/);
		assert.match(town, /<a [^>]*>Watch<\/a><span class="dnd-via"> \(kontrolliert\)<\/span>/);
		assert.ok(town.indexOf(">Wanderer</a><span") === -1, "someone who is only there: no mark");
	} finally {
		wiki.deleteTiddler("Watch");
	}
});
