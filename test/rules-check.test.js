/*
 * The messages on rules macros (modules/rules.js check(), rule macros/rules): what is not
 * understood by <<unit>>, <<dice>>, <<damage>> and <<term>> in a body, as text in the wiki
 * language below the title (viewtemplates/checks); not in the published copy; not for a call in a
 * section the active view does not see; not for computed parameters.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki;

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		h.setLanguage(wiki, "de-DE");
	});
});

function check(title) {
	return h.checks(wiki, title).filter(function(message) {
		return message.id === "macros/rules";
	}).map(function(message) {
		return message.text;
	});
}

function withTiddler(fields, fn) {
	h.add(wiki, fields);
	try {
		return fn();
	} finally {
		wiki.deleteTiddler(fields.title);
	}
}

test("a clean body has no hints", function() {
	withTiddler({title: "Sauber", text: "<<unit \"30 ft\">> <<dice \"1d6\">> <<damage \"1d8 cold\">> <<term wis save>>"}, function() {
		assert.deepEqual(check("Sauber"), []);
	});
});

test("one hint per problem, in the wiki language", function() {
	withTiddler({title: "Fehler", text: "<<unit \"3 cubits\">> <<unit 5>> <<term xyz>> <<term wis check>> <<damage \"1d4 + Rage\">> <<damage \"1d6\">> <<term xyz>>"}, function() {
		assert.deepEqual(check("Fehler"), [
			"Text prüfen: keine bekannte Einheit in <<unit \"3 cubits\">>",
			"Text prüfen: <<unit 5>> braucht eine Einheit",
			"Text prüfen: <<term>> kennt kein „xyz“",
			"Text prüfen: <<term wis>> hat keine Variante „check“",
			"Text prüfen: „Rage“ in <<damage>> ist kein bekanntes Schadenswort",
			"Text prüfen: <<damage \"1d6\">> nennt keine Schadensart"
		]);
	});
});

test("named parameters and the widget form are checked, computed ones not", function() {
	// id:{{...}} is plain text in a macro call (TiddlyWiki 5.3+), id={{...}} is computed
	withTiddler({title: "Formen", text: "<<unit value:\"3 cubits\">> <$transclude $variable=\"term\" id=\"abc\"/> <<term id={{Irgendwo}}>> <$transclude $variable=\"term\" id={{Irgendwo}}/>"}, function() {
		var hints = check("Formen");
		assert.equal(hints.length, 2, hints.join("\n"));
	});
});

test("below the title in the editable wiki, not in the published copy", function() {
	withTiddler({title: "Unter Titel", text: "<<term xyz>>"}, function() {
		assert.match(h.view(wiki, "Unter Titel"), /trpg-check trpg-check-error" title="macros\/rules">Text prüfen: &lt;&lt;term&gt;&gt; kennt kein „xyz“/);
		h.add(wiki, {title: "$:/status/IsReadOnly", text: "yes"});
		try {
			assert.doesNotMatch(h.view(wiki, "Unter Titel"), /kennt kein/);
		} finally {
			wiki.deleteTiddler("$:/status/IsReadOnly");
		}
	});
});

test("a call in a section the view does not see gives no hint there", function() {
	withTiddler({title: "Verborgen", tags: "Event", date: "1351, 1352", text: "<<date>>\n\nOffen.\n\n<<secret>><<date>>\n\n<<term geheimwort>>"}, function() {
		assert.equal(check("Verborgen").length, 1, "the DM sees it");
		h.inView(wiki, "public", function() {
			assert.deepEqual(check("Verborgen"), []);
		});
	});
});
