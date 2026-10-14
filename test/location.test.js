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
		return h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/viewtemplates/relations/list\" mode=\"block\"/>", {self: self, currentTiddler: self});
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
			path = lantern.slice(lantern.indexOf("trpg-location-path"));
		path = path.slice(0, path.indexOf("</div>"));
		var order = ["Continent", "Kingdom", "Town", "Tavern"].map(function(s) { return path.indexOf(">" + s + "<"); });
		assert.ok(order.every(function(p, i) { return p !== -1 && (i === 0 || p > order[i - 1]); }), path);
	});

	test("material: one path line per location", function() {
		assert.equal((h.view(wiki, "Herb").match(/class="trpg-location-path"/g) || []).length, 2);
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
		assert.match(list("Town"), /<details class="trpg-tree"><summary class="tc-menu-list-subitem"><a [^>]*>Cellar<\/a><\/summary><div class="trpg-tree-children"><div class="tc-menu-list-subitem"><a [^>]*>Barrel<\/a>/);
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
			path = barkeep.slice(barkeep.indexOf("trpg-location-path"));
		path = path.slice(0, path.indexOf("</div>"));
		var order = ["Continent", "Kingdom", "Town", "Tavern"].map(function(s) { return path.indexOf(">" + s + "<"); });
		assert.ok(order.every(function(p, i) { return p !== -1 && (i === 0 || p > order[i - 1]); }), path);
	});

	test("path of a location ends before itself", function() {
		var town = h.view(wiki, "Town"),
			path = town.slice(town.indexOf("trpg-location-path"));
		path = path.slice(0, path.indexOf("</div>"));
		assert.ok(path.indexOf(">Kingdom<") !== -1 && path.indexOf(">Town<") === -1, path);
	});

	test("organisation: one path line per location, and the locations it rules", function() {
		var guild = h.view(wiki, "Guild");
		assert.equal((guild.match(/class="trpg-location-path"/g) || []).length, 2);
		assert.match(guild, /class="trpg-location-path trpg-location-rules">Kontrolliert: /);
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
		assert.ok(h.view(wiki, "Hafenfest").indexOf("trpg-location-path") === -1);
	});

	test("... not even with a field location", function() {
		h.add(wiki, {title: "Placed Event", tags: "Event", location: "Town", text: ""});
		try {
			assert.ok(h.view(wiki, "Placed Event").indexOf("trpg-location-path") === -1);
		} finally {
			wiki.deleteTiddler("Placed Event");
		}
	});

	test("relation list of a location: who is there, a spot as a branch of the tree", function() {
		var list = h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/viewtemplates/relations/list\" mode=\"block\"/>", {self: "Town", currentTiddler: "Town"});
		assert.ok(list.indexOf(">Wanderer<") !== -1 && list.indexOf(">Guild<") !== -1);
		assert.match(list, /<summary class="tc-menu-list-subitem"><a [^>]*>Tavern<\/a><span class="trpg-via"> \(Spot\)<\/span><\/summary><div class="trpg-tree-children"><div class="tc-menu-list-subitem"><a [^>]*>Barkeep<\/a>/);
	});

	test("relation list of a location: the places within as a tree, the parent left out", function() {
		var list = h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/viewtemplates/relations/list\" mode=\"block\"/>", {self: "Kingdom", currentTiddler: "Kingdom"}),
			ort = list.slice(list.indexOf(">Anwesend<"));
		assert.ok(ort.indexOf(">Continent<") === -1, ort);
		// Town with its people and the Tavern below it, Barkeep inside the Tavern
		var town = ort.indexOf(">Town<"), tavern = ort.indexOf(">Tavern<"), barkeep = ort.indexOf(">Barkeep<");
		assert.ok(town !== -1 && town < tavern && tavern < barkeep, ort);
		assert.ok(ort.indexOf("Unterorte") === -1);
	});

	test("relation list of a location: every place with entries starts folded", function() {
		var list = h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/viewtemplates/relations/list\" mode=\"block\"/>", {self: "Kingdom", currentTiddler: "Kingdom"});
		assert.match(list, /<details class="trpg-tree"><summary class="tc-menu-list-subitem"><a [^>]*>Town<\/a>/);
		assert.match(list, /<details class="trpg-tree"><summary class="tc-menu-list-subitem"><a [^>]*>Tavern<\/a>/);
		assert.ok(list.indexOf("open=") === -1, list);
	});

	test("relation list: Rules and Leader apart", function() {
		var list = h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/viewtemplates/relations/list\" mode=\"block\"/>", {self: "Guild", currentTiddler: "Guild"}),
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

	test("one map: no tabs, the map with its graph", function() {
		assert.ok(avalon.indexOf('class="trpg-map"') !== -1 && avalon.indexOf('data-tab-title="map') === -1, avalon);
	});

	test("map: a rule parts it from the relations", function() {
		var start = avalon.indexOf('class="trpg-map"');
		assert.ok(start !== -1 && avalon.lastIndexOf("<hr>", start) > avalon.indexOf(">Graph<"), avalon);
	});

	test("map tab: the spot heading", function() {
		assert.match(avalon, /<h3 class="trpg-spot" data-trpg-anchor="spot-kantine">Kantine<\/h3>/);
	});

	test("map tab: buttons in one row, editing only outside the published copy", function() {
		var row = avalon.split('class="trpg-map-buttons"');
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
		h.add(wiki, {title: "$:/state/tiddlyrpg-core/map-nodes/Insel Avalon", text: "hide"});
		try {
			var html = h.view(wiki, "Insel Avalon");
			assert.ok(html.indexOf("Knoten einblenden") !== -1 && html.indexOf("trpg-map-button-off") !== -1);
		} finally {
			wiki.deleteTiddler("$:/state/tiddlyrpg-core/map-nodes/Insel Avalon");
		}
	});

	test("map for a location with places within only (no image, no spots)", function() {
		var html = h.view(wiki, "Continent");
		assert.ok(html.indexOf('class="trpg-map"') !== -1 && html.indexOf('data-tab-title="map') === -1, html);
	});

	test("several maps: a tab per map named after its file, the first with the graph", function() {
		var town = h.view(wiki, "Town"),
			labels = ["Town", "Market", "Gate"].map(function(s) { return town.indexOf("<span>" + s + "</span>"); });
		assert.ok(labels.every(function(p, i) { return p !== -1 && (i === 0 || p > labels[i - 1]); }), town);
		assert.ok(town.indexOf('data-tab-title="map"') !== -1 && town.indexOf('class="trpg-map"') !== -1, town);
	});

	test("a further map links to its file", function() {
		h.add(wiki, {title: "$:/state/tiddlyrpg-core/location-tab/Town", text: "map-2"});
		try {
			var town = h.view(wiki, "Town");
			assert.ok(town.indexOf('href="images/map/Market.jpg"') !== -1 && town.indexOf('class="trpg-map"') === -1, town);
		} finally {
			wiki.deleteTiddler("$:/state/tiddlyrpg-core/location-tab/Town");
		}
	});

	test("spots below the maps, outside the tabs", function() {
		var town = h.view(wiki, "Town"),
			spots = town.indexOf('class="trpg-spots"');
		assert.ok(spots > town.indexOf('class="trpg-map"') && town.indexOf("Deep and dark") > spots, town);
	});

	test("spot with an image and a map: tabs below its heading, the text below them", function() {
		var town = h.view(wiki, "Town"),
			heading = town.indexOf('data-trpg-anchor="spot-old-well"'),
			well = town.indexOf("<span>Well</span>"),
			shaft = town.indexOf("<span>Well shaft</span>");
		assert.ok(heading !== -1 && heading < well && well < shaft && shaft < town.indexOf("Deep and dark"), town);
		assert.ok(town.indexOf('href="images/location/Well.jpg"') !== -1, town);
	});

	test("spot with one image: no tabs", function() {
		var town = h.view(wiki, "Town"),
			temple = town.slice(town.indexOf('data-trpg-anchor="spot-tempel-von-chauntea"'));
		assert.ok(temple.indexOf('href="images/location/Temple.jpg"') !== -1 && temple.indexOf("<span>Temple</span>") === -1, temple);
	});

	test("a spot joined to a tiddler: its images show there, not at the location", function() {
		var town = h.view(wiki, "Town");
		assert.ok(town.indexOf("Tavern.jpg") === -1 && town.indexOf("Guild house.jpg") === -1, town);
		assert.ok(h.view(wiki, "Tavern").indexOf('href="images/location/Tavern.jpg"') !== -1);
	});

	test("the field image: one without tabs, several as tabs named after the files", function() {
		var added = [
			{title: "Pic One", tags: "Person", image: "Face.jpg"},
			{title: "Pic Two", tags: "Person", image: "Front.png, Side view.png"},
			{title: "Pic Info", tags: "Information", image: "Note.png"}
		];
		added.forEach(function(fields) { h.add(wiki, fields); });
		try {
			var one = h.view(wiki, "Pic One"),
				two = h.view(wiki, "Pic Two");
			assert.ok(one.indexOf('href="images/person/Face.jpg"') !== -1 && one.indexOf("<span>Face</span>") === -1, one);
			assert.ok(two.indexOf("<span>Front</span>") !== -1 && two.indexOf("<span>Front</span>") < two.indexOf("<span>Side view</span>"), two);
			assert.ok(two.indexOf('href="images/person/Front.png"') !== -1 && two.indexOf("Side%20view.png") === -1, two);
			assert.ok(h.view(wiki, "Pic Info").indexOf('href="images/information/Note.png"') !== -1);
		} finally {
			added.forEach(function(fields) { wiki.deleteTiddler(fields.title); });
		}
	});

	test("no images of a spot in the tooltip of the map", function() {
		var tip = h.render(wiki, "text/html", "<$let trpg-spot-media=\"no\"><$trpg-body $tiddler=\"Town\" $mode=\"block\" $only=\"spot\" $name=\"Old Well\" $marker=\"no\"/></$let>");
		assert.ok(tip.indexOf("Deep and dark") !== -1 && tip.indexOf("Well.jpg") === -1, tip);
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

	test("location with a map only: the map, no tabs", function() {
		var baile = h.view(wiki, "Baile");
		assert.ok(baile.indexOf('class="trpg-map"') !== -1 && baile.indexOf('data-tab-title="map') === -1);
	});

	test("location without map, spots and places within: no map", function() {
		assert.ok(h.view(wiki, "Nowhere").indexOf('class="trpg-map"') === -1);
	});

	test("relation list heading", function() {
		assert.ok(h.view(wiki, "Grum").indexOf("Ort") !== -1);
	});

	test("dead class", function() {
		var html = h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/core/ui/StoryTiddlerTemplate\" mode=\"block\"/>", {currentTiddler: "Grum", storyTiddler: "Grum"});
		assert.ok(html.indexOf("trpg-dead") !== -1);
	});

	test("activity line year", function() {
		assert.ok(h.view(wiki, "Grum").indexOf("<div class=\"trpg-dateline\">???? – 1350 DR</div>") !== -1);
	});

	test("activity line after a death and a return: the last phase only, alive", function() {
		h.add(wiki, {title: "Back Again", tags: "Person", date: "./1351-08-04, 1355", text: "A wolf."});
		try {
			var html = h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/core/ui/StoryTiddlerTemplate\" mode=\"block\"/>", {currentTiddler: "Back Again", storyTiddler: "Back Again"});
			assert.ok(html.indexOf("<div class=\"trpg-dateline\">1355 DR</div>") !== -1, html);
			assert.ok(html.indexOf("trpg-dead") === -1);
		} finally {
			wiki.deleteTiddler("Back Again");
		}
	});
});

test.describe("en-GB", function() {
	test.before(function() {
		h.setLanguage(wiki, "en-GB");
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
		assert.match(h.view(wiki, "Guild"), /trpg-location-rules">Controls: /);
	});
});

test.describe("without calendar", function() {
	var avalon;

	test.before(function() {
		h.setLanguage(wiki, "de-DE");
		h.add(wiki, {title: "$:/config/tiddlyrpg/calendar", text: ""});
		avalon = h.view(wiki, "Insel Avalon");
	});

	test.after(function() {
		wiki.deleteTiddler("$:/config/tiddlyrpg/calendar");
	});

	test("history header without era", function() {
		assert.ok(avalon.indexOf("Zeitpunkt") !== -1 && avalon.indexOf("(DR)") === -1);
	});

	test("raw month and day in the history", function() {
		assert.ok(avalon.indexOf(">07<") !== -1 && avalon.indexOf(">01<") !== -1);
	});
});
