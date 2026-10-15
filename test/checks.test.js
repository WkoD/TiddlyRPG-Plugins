/*
 * The checks (modules/checks.js, the modules of checks/): the registry of the rules (ids, themes),
 * the messages of a tiddler with their level and text in the wiki language, below the title
 * (viewtemplates/checks: classes, the id as tooltip; not in the published copy, not for system
 * tiddlers or tiddlers the view does not see), the fields trpg-noerror and trpg-noinfo, the rules
 * of scope wiki at the titles they name, what a message leaves out for a view, and the rules
 * without a topic of their own (links, types, expected fields). The other rules are
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
		["checks", "dates", "expected", "images", "items", "links", "locations", "macros", "plugins", "quests", "relations", "secrets", "sections", "spots", "types"].forEach(function(theme) {
			assert.ok(themes.indexOf(theme) !== -1, theme);
		});
	});
});

test.describe("messages", function() {
	test("level, key and text in the wiki language, errors first", function() {
		withTiddlers([{title: "Mischung", tags: "Event", date: "1351-13", text: "<<date>>\n\nA <<nope>> and [[Nirgendwo]]."}], function() {
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
		withTiddlers([{title: "Mischung", tags: "Event", date: "1351-13", text: "<<date>>\n\nA [[Nirgendwo]]."}], function() {
			var html = h.view(wiki, "Mischung");
			assert.match(html, /<div class="trpg-check trpg-check-error" title="dates\/format">Datum prüfen: 1351-13 – den Monat 13 gibt es nicht<\/div>/);
			assert.match(html, /<div class="trpg-check trpg-check-hint" title="links\/missing">Link prüfen: /);
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
	var fields = {title: "Schalter", tags: "Event", date: "1351-13", text: "<<date>>\n\nA <<nope>> and [[Nirgendwo]]."};

	test("trpg-noerror with ids leaves out these errors only", function() {
		withTiddlers([Object.assign({"trpg-noerror": "macros/unknown"}, fields)], function() {
			assert.deepEqual(ids("Schalter"), ["dates/format", "links/missing"]);
		});
	});

	test("trpg-noinfo with ids leaves out these hints only", function() {
		withTiddlers([Object.assign({"trpg-noinfo": "links/missing"}, fields)], function() {
			assert.deepEqual(ids("Schalter"), ["dates/format", "macros/unknown"]);
		});
	});

	test("present but empty: every message of its level", function() {
		withTiddlers([Object.assign({"trpg-noerror": ""}, fields)], function() {
			assert.deepEqual(ids("Schalter"), ["links/missing"]);
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

	test("a transcluded secret where only who may see it sees it: no error", function() {
		var ids = function(title) {
			return h.checks(wiki, title, "secrets").map(function(message) { return message.id; });
		};
		withTiddlers([
			{title: "Auch Geheim", tags: "Event Frigg Secret", date: "1351", text: "<<date>>\n\n{{Hideout}}"},
			{title: "Nur DM", tags: "Secret", text: "{{Hideout}}"},
			{title: "Gesperrter Abschnitt", tags: "Event Frigg", date: "1351, 1352", text: "<<date>>\n\nOpen.\n\n<<secret \"Frigg\">><<date>>\n\n{{Hideout}}"},
			{title: "Offener Abschnitt", tags: "Event Frigg", date: "1351, 1352", text: "<<date>>\n\n{{Hideout}}\n\n<<secret \"Frigg\">><<date>>\n\nLocked."}
		], function() {
			assert.deepEqual(ids("Auch Geheim"), [], "locked for the same character");
			assert.deepEqual(ids("Nur DM"), [], "locked for fewer (the DM only)");
			assert.deepEqual(ids("Gesperrter Abschnitt"), [], "in a section locked for the same character");
			assert.deepEqual(ids("Offener Abschnitt"), ["secrets/transclusion"], "in the open part");
		});
	});

	test("a list filtered with trpg.visible does not ask the view; the state tiddler and trpgview do", function() {
		withTiddlers([
			{title: "Liste", tags: "Information", text: "<$list filter=\"[tag[Person]] :filter[trpg.visible[]]\"><<currentTiddler>></$list>"},
			{title: "Abfrage", tags: "Information", text: "<%if [{$:/state/tiddlyrpg/view}match[dm]] %>DM<%endif%>"},
			{title: "Operator", tags: "Information", text: "<$list filter=\"[trpgview:choices[]]\"/>"}
		], function() {
			assert.deepEqual(h.checkKeys(wiki, "Liste", "secrets"), []);
			assert.deepEqual(h.checkKeys(wiki, "Abfrage", "secrets"), ["Check/Secrets/View"]);
			assert.deepEqual(h.checkKeys(wiki, "Operator", "secrets"), ["Check/Secrets/View"]);
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

test.describe("similar names", function() {
	test("the same plain form always, one step apart only from five letters on", function() {
		assert.equal(checks.similar("Tyrias Labore finden", "Tyrias labore finden!"), true);
		assert.equal(checks.similar("Tor", "tor"), true);
		assert.equal(checks.similar("Rettung von Baile", "Rettung von Biale"), true);
		assert.equal(checks.similar("Tavrn", "Tavern"), true);
		assert.equal(checks.similar("Turm", "Sturm"), false);
		assert.equal(checks.similar("Tor", "Thor"), false);
		assert.equal(checks.similar("Tor", "Tür"), false);
		assert.equal(checks.similar("Die Schamanin Eoria", "Die Schamanin Tyria"), false);
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

	test("links/missing: the name of a spot names its location; several linking tiddlers are counted, as far as the view sees them", function() {
		withTiddlers([
			{title: "Brunnenweg", tags: "Event", date: "1351", text: "<<date>>\n\nTo the [[Old Well]] and [[Ferne Insel]]; [[Einsam]]."},
			{title: "Inselfahrt", tags: "Event", date: "1351", text: "<<date>>\n\nTo [[Ferne Insel]]."},
			{title: "Geheimfahrt", tags: "Event Frigg", date: "1351, 1352", text: "<<date>>\n\nOpen.\n\n<<secret>><<date>>\n\nTo [[Ferne Insel]]."}
		], function() {
			var found = function() {
				return h.checks(wiki, "Brunnenweg", "links").map(function(m) { return m.key + " " + JSON.stringify(m.params); });
			};
			assert.deepEqual(found(), [
				"Check/Links/MissingSpot {\"target\":\"Old Well\",\"place\":\"Town\"}",
				"Check/Links/MissingOften {\"target\":\"Ferne Insel\",\"count\":3}",
				"Check/Links/Missing {\"target\":\"Einsam\"}"
			]);
			assert.equal(h.checks(wiki, "Brunnenweg", "links")[0].text, "Link prüfen: Old Well ist kein Tiddler, nur ein Spot von Town – mit <<spotlink \"Town\" \"Old Well\">> verlinken oder den Tiddler anlegen");
			h.inView(wiki, "public", function() {
				assert.ok(found().indexOf("Check/Links/MissingOften {\"target\":\"Ferne Insel\",\"count\":2}") !== -1, "the locked section does not count");
			});
		});
	});

	test("expected/text: a tiddler without text; not a quest, a book with its file, a hub", function() {
		withTiddlers([
			{title: "Leerer Ort", tags: "Location", text: ""},
			{title: "Leerer Quest", tags: "Quest", text: ""},
			{title: "Zeitung", tags: "Item Book", data: "Zeitung.pdf", text: ""}
		], function() {
			assert.deepEqual(h.checkKeys(wiki, "Leerer Ort", "expected").filter(function(k) { return k === "Check/Expected/Text"; }), ["Check/Expected/Text"]);
			assert.ok(h.checkKeys(wiki, "Leerer Quest", "expected").indexOf("Check/Expected/Text") === -1);
			assert.ok(h.checkKeys(wiki, "Zeitung", "expected").indexOf("Check/Expected/Text") === -1);
			assert.ok(h.checkKeys(wiki, "Baile", "expected").indexOf("Check/Expected/Text") === -1, "has a text");
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

	test("types/missing: Campaign is the start page, no type", function() {
		var types = Array.from($tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/types.js").list(wiki));
		assert.ok(types.indexOf("Campaign") === -1 && types.indexOf("Index") === -1, types.join());
		withTiddlers([{title: "Kampagnennotiz", tags: "Campaign", text: "A note."}], function() {
			assert.deepEqual(h.checkKeys(wiki, "Kampagnennotiz", "types"), ["Check/Types/Missing"]);
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
