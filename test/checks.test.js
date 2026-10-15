/*
 * The checks (modules/checks.js, the modules of checks/): the registry of the rules (ids, themes),
 * the messages of a tiddler with their level and text in the wiki language, below the title
 * (viewtemplates/checks: classes, the id as tooltip; not in the published copy, not for system
 * tiddlers or tiddlers the view does not see), the fields trpg-noerror and trpg-noinfo, the rules
 * of scope wiki at the titles they name, what a message leaves out for a view, and the rules
 * without a topic of their own (links, types, events, expected fields). The other rules are
 * tested with their topic (dates, locations, items, spots, relations, ...), the report of
 * scripts/check-wiki.js in check-wiki.test.js.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki, checks;

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		checks = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/checks.js");
		h.setLanguage(wiki, "de-DE");
	});
});

function withTiddlers(list, fn) {
	list.forEach(function(fields) { h.add(wiki, fields); });
	try {
		return fn();
	} finally {
		list.forEach(function(fields) { wiki.deleteTiddler(fields.title); });
	}
}

// The messages below the title, as the view template renders them
function below(title) {
	return h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/viewtemplates/checks\"/>", {currentTiddler: title});
}

function ids(title) {
	return h.checks(wiki, title).map(function(message) { return message.id; });
}

test.describe("registry", function() {
	test("every rule has a unique id <theme>/<name> and a scope", function() {
		var seen = {};
		checks.rules().forEach(function(rule) {
			assert.match(rule.id, /^[a-z]+\/[a-z]+$/, rule.id);
			assert.ok(!seen[rule.id], "twice: " + rule.id);
			assert.ok(rule.scope === "tiddler" || rule.scope === "wiki", rule.id);
			seen[rule.id] = true;
		});
	});

	test("the themes are the first parts of the ids", function() {
		var themes = Array.from(checks.themes());
		["checks", "dates", "events", "expected", "images", "items", "legacy", "links", "locations", "macros", "plugins", "quests", "relations", "secrets", "sections", "spots", "types"].forEach(function(theme) {
			assert.ok(themes.indexOf(theme) !== -1, theme);
		});
	});
});

test.describe("messages", function() {
	test("level, key and text in the wiki language, errors first", function() {
		withTiddlers([{title: "Mischung", tags: "Event", date: "1351-13", link: "x", text: "<<date>>\n\nA <<nope>>."}], function() {
			var messages = h.checks(wiki, "Mischung");
			assert.deepEqual(messages.map(function(m) { return m.level; }), ["error", "error", "hint"]);
			assert.ok(messages.some(function(m) { return m.text === "Datum prüfen: 1351-13 – den Monat 13 gibt es nicht"; }));
			h.setLanguage(wiki, "en-GB");
			try {
				assert.ok(h.checks(wiki, "Mischung").some(function(m) { return m.text === "Check the date: 1351-13 - month 13 does not exist"; }));
			} finally {
				h.setLanguage(wiki, "de-DE");
			}
		});
	});

	test("below the title: a line per message, the level as class, the id as tooltip", function() {
		withTiddlers([{title: "Mischung", tags: "Event", date: "1351-13", link: "x", text: "<<date>>\n\nA."}], function() {
			var html = h.view(wiki, "Mischung");
			assert.match(html, /<div class="trpg-check trpg-check-error" title="dates\/format">Datum prüfen: 1351-13 – den Monat 13 gibt es nicht<\/div>/);
			assert.match(html, /<div class="trpg-check trpg-check-hint" title="legacy\/link">Felder prüfen: /);
			assert.ok(html.indexOf("trpg-check-error") < html.indexOf("trpg-check-hint"));
		});
	});

	test("not in the published copy", function() {
		withTiddlers([{title: "Mischung", tags: "Event", date: "1351-13", text: "<<date>>\n\nA."}], function() {
			h.add(wiki, {title: "$:/status/IsReadOnly", text: "yes"});
			try {
				assert.doesNotMatch(h.view(wiki, "Mischung"), /trpg-check/);
			} finally {
				wiki.deleteTiddler("$:/status/IsReadOnly");
			}
		});
	});

	test("not for system tiddlers, not for a tiddler the view does not see", function() {
		withTiddlers([
			{title: "$:/Systemprobe", text: "A <<nope>>."},
			{title: "Geheimprobe", tags: "Secret", text: "A <<nope>>."}
		], function() {
			assert.doesNotMatch(h.view(wiki, "$:/Systemprobe"), /trpg-check/);
			assert.match(h.view(wiki, "Geheimprobe"), /trpg-check-error/);
			h.inView(wiki, "public", function() {
				assert.doesNotMatch(h.view(wiki, "Geheimprobe"), /trpg-check/);
			});
		});
	});
});

test.describe("switching off", function() {
	var fields = {title: "Schalter", tags: "Event", date: "1351-13", link: "x", text: "<<date>>\n\nA <<nope>>."};

	test("trpg-noerror with ids leaves out these errors only", function() {
		withTiddlers([Object.assign({"trpg-noerror": "macros/unknown"}, fields)], function() {
			assert.deepEqual(ids("Schalter"), ["dates/format", "legacy/link"]);
		});
	});

	test("trpg-noinfo with ids leaves out these hints only", function() {
		withTiddlers([Object.assign({"trpg-noinfo": "legacy/link"}, fields)], function() {
			assert.deepEqual(ids("Schalter"), ["dates/format", "macros/unknown"]);
		});
	});

	test("present but empty: every message of its level", function() {
		withTiddlers([Object.assign({"trpg-noerror": ""}, fields)], function() {
			assert.deepEqual(ids("Schalter"), ["legacy/link"]);
		});
		withTiddlers([Object.assign({"trpg-noinfo": ""}, fields)], function() {
			assert.deepEqual(ids("Schalter"), ["dates/format", "macros/unknown"]);
		});
	});

	test("an id that is no rule: a hint", function() {
		withTiddlers([Object.assign({"trpg-noerror": "macros/unknown macros/typo"}, fields)], function() {
			var switches = h.checks(wiki, "Schalter").filter(function(m) { return m.id === "checks/switches"; });
			assert.deepEqual(switches.map(function(m) { return m.text; }), ["Felder prüfen: trpg-noerror nennt „macros/typo“, das ist keine Prüfung"]);
		});
	});
});

test.describe("rules of scope wiki", function() {
	test("similar quest names: at both names, below the title of a quest tiddler", function() {
		withTiddlers([
			{title: "Zug", tags: "Event", date: "1351", text: "<<date>>\n\n<<quest \"Rettung von Biale\">>A."},
			{title: "Rettung von Baile", tags: "Quest", text: "Planning."}
		], function() {
			var texts = h.checks(wiki, "Rettung von Baile", "quests").map(function(m) { return m.text; });
			assert.ok(texts.indexOf("Namen prüfen: Er gleicht fast dem Gerücht Rettung von Biale – ein Quest zweimal verschieden geschrieben?") !== -1, texts.join("\n"));
			assert.match(below("Rettung von Baile"), /title="quests\/similar"/);
		});
	});

	test("only names the view sees", function() {
		withTiddlers([
			{title: "Zug", tags: "Event", date: "1351, 1352", text: "<<date>>\n\nOpen.\n\n<<secret>><<date>>\n\n<<quest \"Rettung von Biale\">>A."},
			{title: "Rettung von Baile", tags: "Quest", text: "Planning."}
		], function() {
			assert.ok(ids("Rettung von Baile").indexOf("quests/similar") !== -1);
			h.inView(wiki, "public", function() {
				assert.ok(ids("Rettung von Baile").indexOf("quests/similar") === -1);
			});
		});
	});
});

test.describe("what a message leaves out for a view", function() {
	test("a transcluded secret only for a view that sees it", function() {
		var ids = function(title) {
			return h.checks(wiki, title, "secrets").map(function(message) { return message.id; });
		};
		withTiddlers([{title: "Einbindung", text: "{{Hideout}}"}], function() {
			assert.deepEqual(ids("Einbindung"), ["secrets/transclusion"]);
			h.inView(wiki, "public", function() {
				assert.deepEqual(ids("Einbindung"), []);
			});
			h.inView(wiki, "player:Anna", function() {
				assert.deepEqual(ids("Einbindung"), ["secrets/transclusion"]);
			});
		});
	});

	test("a parent hidden from someone: for the DM only", function() {
		withTiddlers([
			{title: "Hidden Realm", tags: "Location Secret", text: "Locked."},
			{title: "Open Town", tags: "Location", location: "[[Hidden Realm]]", text: "Open."}
		], function() {
			assert.ok(h.checkKeys(wiki, "Open Town", "locations").indexOf("Location/Check/LockedParent") !== -1);
			h.inView(wiki, "public", function() {
				assert.ok(h.checkKeys(wiki, "Open Town", "locations").indexOf("Location/Check/LockedParent") === -1);
			});
		});
	});
});

test.describe("content", function() {
	test("links/missing: a link to a tiddler that does not exist, once; not in a section the view does not see", function() {
		withTiddlers([{title: "Verweise", tags: "Event Frigg", date: "1351, 1352", text: "<<date>>\n\n[[Nirgendwo]], [[Nirgendwo]], [[Baile]], [[$:/Fehlt]].\n\n<<secret>><<date>>\n\n[[Geheimort]]."}], function() {
			assert.deepEqual(h.checks(wiki, "Verweise", "links").map(function(m) { return m.params.target; }), ["Nirgendwo", "Geheimort"]);
			h.inView(wiki, "public", function() {
				assert.deepEqual(h.checks(wiki, "Verweise", "links").map(function(m) { return m.params.target; }), ["Nirgendwo"]);
			});
		});
	});

	test("types/missing: a tiddler without type tag; not a hub, a data tiddler or one with a type", function() {
		withTiddlers([
			{title: "Ohne Typ", tags: "Secret", text: "Loose."},
			{title: "Daten", type: "application/json", text: "{}"},
			{title: "Kategorie", tags: "$:/tags/tiddlyrpg/ItemKind", text: "A category of the campaign."},
			{title: "Mit Kategorie", tags: "Kategorie Item", text: "Typed through the base type."}
		], function() {
			assert.deepEqual(h.checkKeys(wiki, "Ohne Typ", "types"), ["Check/Types/Missing"]);
			assert.deepEqual(h.checkKeys(wiki, "Daten", "types"), []);
			assert.deepEqual(h.checkKeys(wiki, "Mit Kategorie", "types"), []);
			assert.deepEqual(h.checkKeys(wiki, "Person", "types"), [], "a hub");
			assert.deepEqual(h.checkKeys(wiki, "Baile", "types"), []);
		});
	});

	test("events/participants: a linked player character that is not tagged", function() {
		withTiddlers([
			{title: "Mit Frigg", tags: "Event", date: "1351", text: "<<date>>\n\n[[Frigg]] at [[Baile]]."},
			{title: "Frigg dabei", tags: "Event Frigg", date: "1351", text: "<<date>>\n\n[[Frigg]] at [[Baile]]."}
		], function() {
			assert.deepEqual(h.checks(wiki, "Mit Frigg", "events").map(function(m) { return m.text; }),
				["Ereignis prüfen: Es verlinkt die Spielerfigur Frigg, die nicht als Tag dabei ist – der Tag heißt: war dabei"]);
			assert.deepEqual(h.checkKeys(wiki, "Frigg dabei", "events"), []);
		});
	});

	test("expected: image of persons, player characters and locations, map of locations, player of player characters", function() {
		withTiddlers([
			{title: "Ohne Bild", tags: "Person", text: "Someone."},
			{title: "Mit Bild", tags: "Person", image: "a.jpg", text: "Someone."},
			{title: "Neue Figur", tags: "Player", text: "Unplayed."}
		], function() {
			assert.deepEqual(h.checkKeys(wiki, "Ohne Bild", "expected"), ["Check/Expected/Image"]);
			assert.deepEqual(h.checkKeys(wiki, "Mit Bild", "expected"), []);
			assert.deepEqual(h.checkKeys(wiki, "Neue Figur", "expected"), ["Check/Expected/Image", "Check/Expected/Player"]);
			assert.deepEqual(h.checkKeys(wiki, "Nowhere", "expected"), ["Check/Expected/Image", "Check/Expected/Map"]);
			assert.deepEqual(h.checkKeys(wiki, "Tavern", "expected"), ["Check/Expected/Map"]);
		});
	});
});
