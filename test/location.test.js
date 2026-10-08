/*
 * Location and person views: the parents of a location (filters/location.js) and the path below
 * the title, who is at a location (items too), the hints of locationcheck, the relation list of a location,
 * the events of the places within, the map tabs (map and battle maps), the event history under a
 * location (player lock, with and without calendar) and the person view (relations, dead class,
 * activity line). Spots and <<spotlink>> are in spots.test.js.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var wiki;

test.before(function() {
	return h.boot().then(function($tw) {
		wiki = $tw.wiki;
	});
});

function f(text) {
	return Array.from(h.filter(wiki, text));
}

test.describe("hierarchy", function() {
	test("parent through the field location", function() {
		assert.deepEqual(f("[[Kingdom]locationparent[]]"), ["Continent"]);
	});

	test("parent through a spot (Teil von)", function() {
		assert.deepEqual(f("[[Tavern]locationparent[]]"), ["Town"]);
	});

	test("path from the root down, without the location itself", function() {
		assert.deepEqual(f("[[Tavern]locationpath[]]"), ["Continent", "Kingdom", "Town"]);
	});

	test("a parent that is no location is ignored", function() {
		assert.deepEqual(f("[[Stray]locationpath[]]"), []);
	});

	test("a cycle stops at the first repetition", function() {
		assert.deepEqual(f("[[Loop A]locationpath[]]"), ["Loop B"]);
	});

	test("places directly within, both ways", function() {
		assert.deepEqual(f("[[Kingdom]sublocations[]sort[]]"), ["Neighbour", "Town", "Twice"]);
	});

	test("places within at any depth", function() {
		assert.deepEqual(f("[[Kingdom]sublocations:all[]sort[]]"), ["Neighbour", "Tavern", "Town", "Twice"]);
	});

	test("only the spots", function() {
		assert.deepEqual(f("[[Town]sublocations[spot]]"), ["Tavern"]);
	});

	test("occupants: through spots, not through places that lie within", function() {
		assert.deepEqual(f("[[Town]occupants[]sort[]]"), ["Barkeep", "Guild", "Guildmaster", "Wanderer"]);
		assert.deepEqual(f("[[Kingdom]occupants[]sort[]]"), ["Guild", "Wanderer"]);
	});
});

test.describe("checks", function() {
	test("person with two locations", function() {
		assert.deepEqual(f("[[Wanderer]locationcheck[]]"), ["Location/Check/PersonTwice"]);
	});

	test("an organisation may have several", function() {
		h.add(wiki, {title: "Traders", tags: "Organisation", location: "Town Kingdom", text: ""});
		try {
			assert.deepEqual(f("[[Traders]locationcheck[]]"), []);
		} finally {
			wiki.deleteTiddler("Traders");
		}
	});

	test("location names a place the field leader already holds", function() {
		assert.deepEqual(f("[[Guild]locationcheck[]]"), ["Location/Check/LedAndLocation"]);
	});

	test("spot of two locations", function() {
		assert.deepEqual(f("[[Twice]locationcheck[]]"), ["Location/Check/SpotTwice"]);
	});

	test("cycle", function() {
		assert.ok(f("[[Loop A]locationcheck[]]").indexOf("Location/Check/Cycle") !== -1);
	});

	test("location in a tiddler that is no location", function() {
		assert.deepEqual(f("[[Stray]locationcheck[]]"), ["Location/Check/NotALocation"]);
	});

	test("spot and field location together", function() {
		h.add(wiki, {title: "Both", tags: "Location", location: "Continent", text: ""});
		h.add(wiki, {title: "Holder", tags: "Location", text: "<<spot \"Both\">>"});
		try {
			assert.deepEqual(f("[[Both]locationcheck[]]"), ["Location/Check/SpotAndLocation"]);
		} finally {
			wiki.deleteTiddler("Both");
			wiki.deleteTiddler("Holder");
		}
	});

	test("parent locked for someone who sees the location", function() {
		h.add(wiki, {title: "Hidden Land", tags: "Location Frigg Secret", text: ""});
		h.add(wiki, {title: "Open Village", tags: "Location", location: "[[Hidden Land]]", text: ""});
		h.add(wiki, {title: "Ragna", tags: "Player", player: "Jan"});
		try {
			assert.deepEqual(f("[[Open Village]locationcheck[]]"), ["Location/Check/LockedParent"]);
			// Locked for the same players: fine; for more players: reported
			h.add(wiki, {title: "Open Village", tags: "Location Frigg Secret", location: "[[Hidden Land]]", text: ""});
			assert.deepEqual(f("[[Open Village]locationcheck[]]"), []);
			h.add(wiki, {title: "Open Village", tags: "Location Frigg Ragna Secret", location: "[[Hidden Land]]", text: ""});
			assert.deepEqual(f("[[Open Village]locationcheck[]]"), ["Location/Check/LockedParent"]);
			// A player character tagged without Secret is no lock
			h.add(wiki, {title: "Hidden Land", tags: "Location Frigg", text: ""});
			assert.deepEqual(f("[[Open Village]locationcheck[]]"), []);
		} finally {
			["Hidden Land", "Open Village", "Ragna"].forEach(function(title) { wiki.deleteTiddler(title); });
		}
	});
});

// Items at a location (filters/item.js: Artifact unique, Item and Material several)
test.describe("items", function() {
	var ITEMS = [
		{title: "Lantern", tags: "Artifact", location: "Tavern", text: "Lies in the tavern."},
		{title: "Herb", tags: "Material", location: "Town Kingdom", text: "Grows in town and land."},
		{title: "Rope", tags: "Item", owner: "Barkeep Wanderer", location: "Town", text: "Several of it."},
		{title: "Crown", tags: "Artifact", owner: "Guildmaster", text: "Worn by the guildmaster."},
		{title: "Cellar", tags: "Location", location: "Town", text: "Below the town."},
		{title: "Barrel", tags: "Artifact", location: "Cellar", text: "Only an item is here."}
	];

	function list(self) {
		return h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/dndwiki-core/viewtemplates/relations/list\" mode=\"block\"/>", {self: self, currentTiddler: self});
	}

	function withItem(fields, fn) {
		h.add(wiki, fields);
		try {
			fn();
		} finally {
			wiki.deleteTiddler(fields.title);
		}
	}

	test.before(function() {
		h.setLanguage(wiki, "de-DE");
		ITEMS.forEach(function(fields) { h.add(wiki, fields); });
	});

	test.after(function() {
		ITEMS.forEach(function(fields) { wiki.deleteTiddler(fields.title); });
	});

	test("occupants: items too, through spots as well", function() {
		assert.deepEqual(f("[[Town]occupants[]sort[]]"), ["Barkeep", "Guild", "Guildmaster", "Herb", "Lantern", "Rope", "Wanderer"]);
		assert.deepEqual(f("[[Kingdom]occupants[]sort[]]"), ["Guild", "Herb", "Wanderer"]);
	});

	test("no hint: artifact with one location or one owner, item and material with several", function() {
		assert.deepEqual(f("[[Lantern]] [[Crown]] [[Herb]] [[Rope]] +[locationcheck[]]"), []);
	});

	test("artifact with two locations", function() {
		withItem({title: "Twin", tags: "Artifact", location: "Town Kingdom"}, function() {
			assert.deepEqual(f("[[Twin]locationcheck[]]"), ["Location/Check/ArtifactTwice"]);
		});
	});

	test("artifact with two owners", function() {
		withItem({title: "Shared", tags: "Artifact", owner: "Barkeep Wanderer"}, function() {
			assert.deepEqual(f("[[Shared]locationcheck[]]"), ["Location/Check/ArtifactOwners"]);
		});
	});

	test("artifact with owner and location", function() {
		withItem({title: "Torn", tags: "Artifact", owner: "Barkeep", location: "Town"}, function() {
			assert.deepEqual(f("[[Torn]locationcheck[]]"), ["Location/Check/OwnerAndLocation"]);
		});
	});

	test("path below the title of an artifact", function() {
		var lantern = h.view(wiki, "Lantern"),
			path = lantern.slice(lantern.indexOf("dnd-location-path"));
		path = path.slice(0, path.indexOf("</div>"));
		var order = ["Continent", "Kingdom", "Town", "Tavern"].map(function(s) { return path.indexOf(">" + s + "<"); });
		assert.ok(order.every(function(p, i) { return p !== -1 && (i === 0 || p > order[i - 1]); }), path);
	});

	test("material: one path line per location", function() {
		assert.equal((h.view(wiki, "Herb").match(/class="dnd-location-path"/g) || []).length, 2);
	});

	test("hint below the title", function() {
		withItem({title: "Torn", tags: "Artifact", owner: "Barkeep", location: "Town"}, function() {
			assert.ok(h.view(wiki, "Torn").indexOf("Ort prüfen: Ein Artefakt hat einen Besitzer oder einen Ort, nicht beides") !== -1);
		});
	});

	test("relation list of a location: items in the tree like everyone else", function() {
		var ort = list("Kingdom");
		ort = ort.slice(ort.indexOf(">Anwesend<"));
		var herb = ort.indexOf(">Herb<"), town = ort.indexOf(">Town<"), rope = ort.indexOf(">Rope<"),
			tavern = ort.indexOf(">Tavern<"), lantern = ort.indexOf(">Lantern<");
		assert.ok(herb !== -1 && herb < town && town < rope && rope < tavern && tavern < lantern, ort);
	});

	test("relation list of a location: a place with only an item starts folded", function() {
		assert.match(list("Town"), /<details class="dnd-tree"><summary class="tc-menu-list-subitem"><a [^>]*>Cellar<\/a><\/summary><div class="dnd-tree-children"><div class="tc-menu-list-subitem"><a [^>]*>Barrel<\/a>/);
	});
});

test.describe("de-DE", function() {
	var avalon;

	test.before(function() {
		h.setLanguage(wiki, "de-DE");
		avalon = h.view(wiki, "Insel Avalon");
	});

	test("path below the title: location, its parents in order", function() {
		var barkeep = h.view(wiki, "Barkeep"),
			path = barkeep.slice(barkeep.indexOf("dnd-location-path"));
		path = path.slice(0, path.indexOf("</div>"));
		var order = ["Continent", "Kingdom", "Town", "Tavern"].map(function(s) { return path.indexOf(">" + s + "<"); });
		assert.ok(order.every(function(p, i) { return p !== -1 && (i === 0 || p > order[i - 1]); }), path);
	});

	test("path of a location ends before itself", function() {
		var town = h.view(wiki, "Town"),
			path = town.slice(town.indexOf("dnd-location-path"));
		path = path.slice(0, path.indexOf("</div>"));
		assert.ok(path.indexOf(">Kingdom<") !== -1 && path.indexOf(">Town<") === -1, path);
	});

	test("organisation: one path line per location, and the locations it rules", function() {
		var guild = h.view(wiki, "Guild");
		assert.equal((guild.match(/class="dnd-location-path"/g) || []).length, 2);
		assert.match(guild, /class="dnd-location-path dnd-location-rules">Kontrolliert: /);
	});

	test("hint for the editor", function() {
		assert.ok(h.view(wiki, "Wanderer").indexOf("Ort prüfen: Eine Person hat einen Ort") !== -1);
	});

	test("... not in the published copy", function() {
		h.add(wiki, {title: "$:/status/IsReadOnly", text: "yes"});
		try {
			assert.ok(h.view(wiki, "Wanderer").indexOf("Ort prüfen") === -1);
		} finally {
			wiki.deleteTiddler("$:/status/IsReadOnly");
		}
	});

	test("no path for events", function() {
		assert.ok(h.view(wiki, "Hafenfest").indexOf("dnd-location-path") === -1);
	});

	test("... not even with a field location, nobody logged in", function() {
		h.add(wiki, {title: "Placed Event", tags: "Event", location: "Town", text: ""});
		try {
			assert.ok(h.view(wiki, "Placed Event").indexOf("dnd-location-path") === -1);
		} finally {
			wiki.deleteTiddler("Placed Event");
		}
	});

	test("relation list of a location: who is there, a spot as a branch of the tree", function() {
		var list = h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/dndwiki-core/viewtemplates/relations/list\" mode=\"block\"/>", {self: "Town", currentTiddler: "Town"});
		assert.ok(list.indexOf(">Wanderer<") !== -1 && list.indexOf(">Guild<") !== -1);
		assert.match(list, /<summary class="tc-menu-list-subitem"><a [^>]*>Tavern<\/a><span class="dnd-via"> \(Spot\)<\/span><\/summary><div class="dnd-tree-children"><div class="tc-menu-list-subitem"><a [^>]*>Barkeep<\/a>/);
	});

	test("relation list of a location: the places within as a tree, the parent left out", function() {
		var list = h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/dndwiki-core/viewtemplates/relations/list\" mode=\"block\"/>", {self: "Kingdom", currentTiddler: "Kingdom"}),
			ort = list.slice(list.indexOf(">Anwesend<"));
		assert.ok(ort.indexOf(">Continent<") === -1, ort);
		// Town with its people and the Tavern below it, Barkeep inside the Tavern
		var town = ort.indexOf(">Town<"), tavern = ort.indexOf(">Tavern<"), barkeep = ort.indexOf(">Barkeep<");
		assert.ok(town !== -1 && town < tavern && tavern < barkeep, ort);
		assert.ok(ort.indexOf("Unterorte") === -1);
	});

	test("relation list of a location: every place with entries starts folded", function() {
		var list = h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/dndwiki-core/viewtemplates/relations/list\" mode=\"block\"/>", {self: "Kingdom", currentTiddler: "Kingdom"});
		assert.match(list, /<details class="dnd-tree"><summary class="tc-menu-list-subitem"><a [^>]*>Town<\/a>/);
		assert.match(list, /<details class="dnd-tree"><summary class="tc-menu-list-subitem"><a [^>]*>Tavern<\/a>/);
		assert.ok(list.indexOf("open=") === -1, list);
	});

	test("relation list: Rules and Leader apart", function() {
		var list = h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/dndwiki-core/viewtemplates/relations/list\" mode=\"block\"/>", {self: "Guild", currentTiddler: "Guild"}),
			leader = list.slice(list.indexOf(">Anführer<"));
		leader = leader.slice(0, leader.indexOf("<h3"));
		var rules = list.slice(list.indexOf(">Kontrolliert<"));
		assert.ok(leader.indexOf(">Guildmaster<") !== -1 && leader.indexOf(">Town<") === -1, leader);
		assert.ok(rules.indexOf(">Town<") !== -1, rules);
	});

	test("events of the places within (Tavern -> Town -> Kingdom -> Continent)", function() {
		h.add(wiki, {title: "Tavern Brawl", tags: "Event", date: "1351-08-01", text: "<<date>>\n\nAt [[Tavern]]."});
		try {
			["Town", "Kingdom", "Continent"].forEach(function(title) {
				assert.ok(h.view(wiki, title).indexOf("Tavern Brawl") !== -1, title);
			});
			assert.ok(h.view(wiki, "Neighbour").indexOf("Tavern Brawl") === -1);
		} finally {
			wiki.deleteTiddler("Tavern Brawl");
		}
	});

	test("map tabs: Karte and the battle map", function() {
		assert.ok(avalon.indexOf(">Karte<") !== -1 && avalon.indexOf("data-tab-title=\"battlemap\"") !== -1, avalon);
	});

	test("map tab: a rule parts it from the relations", function() {
		var start = avalon.indexOf('data-tab-title="map"');
		assert.ok(start !== -1 && avalon.lastIndexOf("<hr>", start) > avalon.indexOf(">Graph<"), avalon);
	});

	test("map tab: the spot heading", function() {
		assert.match(avalon, /<h3 class="dnd-spot" data-dnd-anchor="spot-kantine">Kantine<\/h3>/);
	});

	test("map tab: buttons in one row, editing only outside the published copy", function() {
		var row = avalon.split('class="dnd-map-buttons"');
		assert.equal(row.length, 2, avalon);
		var fit = row[1].indexOf("Karte einpassen"), hide = row[1].indexOf("Knoten ausblenden"), edit = row[1].indexOf("Positionen bearbeiten");
		assert.ok(fit !== -1 && fit < hide && hide < edit, row[1]);
		h.add(wiki, {title: "$:/status/IsReadOnly", text: "yes"});
		try {
			assert.ok(h.view(wiki, "Insel Avalon").indexOf("Positionen bearbeiten") === -1);
		} finally {
			wiki.deleteTiddler("$:/status/IsReadOnly");
		}
	});

	test("map tab: nodes hidden, editing switched off", function() {
		h.add(wiki, {title: "$:/state/dndwiki-core/map-nodes/Insel Avalon", text: "hide"});
		try {
			var html = h.view(wiki, "Insel Avalon");
			assert.ok(html.indexOf("Knoten einblenden") !== -1 && html.indexOf("dnd-map-button-off") !== -1);
		} finally {
			wiki.deleteTiddler("$:/state/dndwiki-core/map-nodes/Insel Avalon");
		}
	});

	test("map tab for a location with places within only (no image, no spots)", function() {
		var html = h.view(wiki, "Continent");
		assert.ok(html.indexOf(">Karte<") !== -1 && html.indexOf('class="dnd-map"') !== -1, html);
	});

	test("battle map tab links to the file", function() {
		var battlemap = h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/dndwiki-core/viewtemplates/location/battlemap\" mode=\"block\"/>", {currentTiddler: "Insel Avalon", currentTab: "battlemap"});
		assert.ok(battlemap.indexOf('href="images/battlemap/Insel%20Avalon.jpg"') !== -1, battlemap);
	});

	test("tabs: Karte before the battle map, labels and numbers", function() {
		var town = h.view(wiki, "Town"),
			labels = ["Karte", "Town 1", "Town 2", "Town Tavern", "Town Old Well"].map(function(s) { return town.indexOf("<span>" + s + "</span>"); });
		assert.ok(labels.every(function(p, i) { return p !== -1 && (i === 0 || p > labels[i - 1]); }), town);
	});

	test("history header with era", function() {
		assert.ok(avalon.indexOf("Zeitpunkt (DR)") !== -1);
	});

	test("history flags", function() {
		assert.ok(avalon.indexOf("(Start)") !== -1 && avalon.indexOf("(Ende)") !== -1);
	});

	test("map block before history", function() {
		assert.ok(avalon.indexOf("Kantine") < avalon.indexOf(">Zeitstrahl<"));
	});

	test("locked events are left out of the event list", function() {
		assert.ok(h.inView(wiki, "public", function() { return h.view(wiki, "Insel Avalon"); }).indexOf("Friggs Traum") === -1);
	});

	test("... but shown to their player and the DM", function() {
		assert.ok(h.inView(wiki, "player:Anna", function() { return h.view(wiki, "Insel Avalon"); }).indexOf("Friggs Traum") !== -1);
		assert.ok(avalon.indexOf("Friggs Traum") !== -1);
	});

	test("location with a map only: one tab", function() {
		var baile = h.view(wiki, "Baile");
		assert.ok(baile.indexOf(">Karte<") !== -1 && baile.indexOf("data-tab-title=\"battlemap") === -1);
	});

	test("location without map, spots and places within: no map tab", function() {
		assert.ok(h.view(wiki, "Nowhere").indexOf(">Karte<") === -1);
	});

	test("relation list heading", function() {
		assert.ok(h.view(wiki, "Grum").indexOf("Ort") !== -1);
	});

	test("dead class", function() {
		var html = h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/core/ui/StoryTiddlerTemplate\" mode=\"block\"/>", {currentTiddler: "Grum", storyTiddler: "Grum"});
		assert.ok(html.indexOf("dnd-dead") !== -1);
	});

	test("activity line year", function() {
		assert.ok(h.view(wiki, "Grum").indexOf("<div class=\"dnd-dateline\">???? – 1350 DR</div>") !== -1);
	});
});

test.describe("en-GB", function() {
	test.before(function() {
		h.setLanguage(wiki, "en-GB");
	});

	test("en tabs", function() {
		var avalon = h.view(wiki, "Insel Avalon");
		assert.ok(avalon.indexOf(">Map<") !== -1 && avalon.indexOf("<span>Insel Avalon</span>") !== -1);
	});

	test("en history header", function() {
		assert.ok(h.view(wiki, "Insel Avalon").indexOf("Date (DR)") !== -1);
	});

	test("en map buttons", function() {
		var avalon = h.view(wiki, "Insel Avalon");
		["Fit map", "Hide nodes", "Edit positions"].forEach(function(label) {
			assert.ok(avalon.indexOf(label) !== -1, label);
		});
	});

	test("en path hint and rules", function() {
		assert.ok(h.view(wiki, "Wanderer").indexOf("Check the location: a person has one location") !== -1);
		assert.match(h.view(wiki, "Guild"), /dnd-location-rules">Controls: /);
	});
});

test.describe("without calendar", function() {
	var avalon;

	test.before(function() {
		h.setLanguage(wiki, "de-DE");
		h.add(wiki, {title: "$:/config/dndwiki/calendar", text: ""});
		avalon = h.view(wiki, "Insel Avalon");
	});

	test.after(function() {
		wiki.deleteTiddler("$:/config/dndwiki/calendar");
	});

	test("history header without era", function() {
		assert.ok(avalon.indexOf("Zeitpunkt") !== -1 && avalon.indexOf("(DR)") === -1);
	});

	test("raw month and day in the history", function() {
		assert.ok(avalon.indexOf(">07<") !== -1 && avalon.indexOf(">01<") !== -1);
	});
});
