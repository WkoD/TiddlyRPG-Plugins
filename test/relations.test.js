/*
 * The relation rules (modules/relations.js, filters/relations.js): the filters, the relation
 * list forward and back, included types, symmetric types, family, who leads a location as
 * present there, and the messages on the relation fields (checks/relations.js). Edges in the
 * graph: graph.test.js.
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
	return h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/viewtemplates/relations/list\" mode=\"block\"/>", {self: self, currentTiddler: self});
}

// The groups of a relation list: {heading: [titles]}
function groups(html) {
	var result = {};
	html.split("<h3 class=\"trpg-relations-group\">").slice(1).forEach(function(part) {
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
		assert.match(town, /<a [^>]*>Guild<\/a><span class="trpg-via"> \(kontrolliert\)<\/span>/);
		assert.match(town, /<a [^>]*>Watch<\/a><span class="trpg-via"> \(kontrolliert\)<\/span>/);
		assert.ok(town.indexOf(">Wanderer</a><span") === -1, "someone who is only there: no mark");
	} finally {
		wiki.deleteTiddler("Watch");
	}
});

// The messages of the theme relations (checks/relations.js): [{id, key, params}]
function messages(title, id) {
	return h.checks(wiki, title, "relations").filter(function(m) {
		return !id || m.id === id;
	}).map(function(m) {
		return {key: m.key, params: Object.assign({}, m.params)};
	});
}

test.describe("messages", function() {
	test("a field naming a tiddler that does not exist: an error, for location the spot of that name", function() {
		people([{title: "R Waise", member: "[[R Nirgends]]", location: "[[Old Well]]"}], function() {
			assert.deepEqual(messages("R Waise", "relations/missing"), [
				{key: "Check/Relations/MissingSpot", params: {field: "location", target: "Old Well", place: "Town"}},
				{key: "Check/Relations/Missing", params: {field: "member", target: "R Nirgends"}}
			]);
			assert.ok(h.checks(wiki, "R Waise").some(function(m) { return m.text === "Feld member prüfen: R Nirgends gibt es nicht"; }));
		});
		people([{title: "R Getaggt", tags: "Person [[R Kein Tiddler]]", list: "[[R Auch keiner]]"}], function() {
			assert.deepEqual(messages("R Getaggt"), [], "tags and list are no relations");
		});
	});

	test("an entry another field to the same target includes: a hint", function() {
		people([{title: "R Chef", leader: "Guild", member: "Guild"}, {title: "R Enkel", parent: "Grum", ancestor: "Grum"}], function() {
			assert.deepEqual(messages("R Chef", "relations/included"), [{key: "Check/Relations/Included", params: {field: "member", other: "leader", target: "Guild"}}]);
			assert.deepEqual(messages("R Enkel", "relations/included"), [{key: "Check/Relations/Included", params: {field: "ancestor", other: "parent", target: "Grum"}}]);
		});
	});

	test("member and former, owner and former on the same target: an error", function() {
		people([{title: "R Wechsel", member: "Guild", former: "Guild"}, {title: "R Ring", tags: "Artifact", owner: "Grum", former: "Grum"}], function() {
			assert.deepEqual(messages("R Wechsel", "relations/former"), [{key: "Check/Relations/Former", params: {field: "member", target: "Guild"}}]);
			assert.deepEqual(messages("R Ring", "relations/former"), [{key: "Check/Relations/Former", params: {field: "owner", target: "Grum"}}]);
		});
	});

	test("a symmetric type only on one side: a hint at the side it is missing", function() {
		people([{title: "R Feind A", enmity: "[[R Feind B]]"}, {title: "R Feind B"}], function() {
			assert.deepEqual(messages("R Feind B", "relations/symmetric"), [{key: "Check/Relations/Symmetric", params: {field: "enmity", other: "R Feind A"}}]);
			assert.deepEqual(messages("R Feind A", "relations/symmetric"), []);
		});
	});

	test("children of the same parent: a hint without sibling, none with it on either side", function() {
		people([{title: "R Mutter"}, {title: "R Kind 1", parent: "[[R Mutter]]"}, {title: "R Kind 2", parent: "[[R Mutter]]"}], function() {
			assert.deepEqual(messages("R Kind 1", "relations/siblings"), [{key: "Check/Relations/Siblings", params: {other: "R Kind 2", parent: "R Mutter"}}]);
			people([{title: "R Kind 3", parent: "[[R Mutter]]", sibling: "[[R Kind 1]]"}], function() {
				assert.ok(messages("R Kind 1", "relations/siblings").every(function(m) { return m.params.other !== "R Kind 3"; }));
				assert.deepEqual(messages("R Kind 3", "relations/siblings"), [{key: "Check/Relations/Siblings", params: {other: "R Kind 2", parent: "R Mutter"}}]);
			});
		});
	});

	test("family next to another family relation of the pair: a hint", function() {
		people([{title: "R Schwester", sibling: "[[R Bruder]]", family: "[[R Bruder]]"}, {title: "R Bruder", sibling: "[[R Schwester]]"}, {title: "R Tante", family: "[[R Bruder]]"}], function() {
			assert.deepEqual(messages("R Schwester", "relations/family"), [{key: "Check/Relations/Family", params: {other: "R Bruder"}}]);
			assert.deepEqual(messages("R Tante", "relations/family"), []);
		});
	});

	test("an ancestor the line of parents reaches over a generation: a hint", function() {
		people([{title: "R Ahn"}, {title: "R Vater", parent: "[[R Ahn]]"}, {title: "R Sohn", parent: "[[R Vater]]", ancestor: "[[R Ahn]] Grum"}], function() {
			assert.deepEqual(messages("R Sohn", "relations/ancestor"), [{key: "Check/Relations/Ancestor", params: {other: "R Ahn"}}]);
		});
	});

	test("an organisation with several living leaders: a hint at it, the dead do not count", function() {
		people([{title: "R Bund", tags: "Organisation"}, {title: "R Erste", leader: "[[R Bund]]"}, {title: "R Zweite", leader: "[[R Bund]]"}], function() {
			assert.deepEqual(messages("R Bund", "relations/leaders"), [{key: "Check/Relations/Leaders", params: {leaders: "R Erste, R Zweite"}}]);
			people([{title: "R Zweite", leader: "[[R Bund]]", date: "1300/1340"}], function() {
				assert.deepEqual(messages("R Bund", "relations/leaders"), []);
				assert.deepEqual(messages("R Zweite", "relations/deadleader"), [{key: "Check/Relations/DeadLeader", params: {targets: "R Bund"}}]);
			});
		});
	});

	test("trpg-noinfo switches the hint on a council off", function() {
		people([{title: "R Rat", tags: "Organisation", "trpg-noinfo": "relations/leaders"}, {title: "R Erste", leader: "[[R Rat]]"}, {title: "R Zweite", leader: "[[R Rat]]"}], function() {
			assert.deepEqual(messages("R Rat"), []);
		});
	});
});
