/*
 * Shortcuts (modules/rules.js shortcuts()): the data names them (shortcut of a label entry, a
 * unit, a coin), the plugin brings the procedures (tag $:/tags/Global). With the fixtures:
 * fixture-ruleset-5e-mini (str wis ac dc xp, ft mi lb) and fixture-setting-harptos (cp gp; sp
 * without procedure). Data and procedures match per plugin; a shortcut shows like the macro it
 * stands for; without its plugin it is gone and the check reports it; the check of the rules
 * macros reads its calls; the hubs strike through a shortcut without procedure.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki, rules, macros;

function settle() {
	return new Promise(function(resolve) {
		setTimeout(resolve, 0);
	});
}

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		rules = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/rules.js");
		macros = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/macros-check.js");
		h.setLanguage(wiki, "de-DE");
	});
});

// A filter result as an array of this realm (deepEqual compares prototypes)
function copy(list) {
	return JSON.parse(JSON.stringify(list));
}

function show(text) {
	return h.render(wiki, "text/plain", text);
}

// The names the procedures tiddler of a plugin defines
function procedures(plugin) {
	return (wiki.getTiddlerText("$:/plugins/" + plugin + "/rules/shortcuts", "").match(/^\\procedure\s+[^\s(]+/mg) || []).map(function(d) {
		return d.replace(/^\\procedure\s+/, "");
	}).sort();
}

// The shortcuts of the data of a plugin
function inData(plugin) {
	var domains = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/language.js").domains(wiki),
		all = rules.shortcuts(wiki);
	return Object.keys(all).filter(function(name) {
		var s = all[name];
		if(s.kind === "coin") {
			return plugin === "fixture-setting-harptos";
		}
		return Object.keys(domains).some(function(d) {
			return domains[d].source === "$:/plugins/" + plugin && (
				(domains[d].entries || []).some(function(e) { return e.shortcut === name; }) ||
				Object.keys(domains[d].units || {}).some(function(u) { return domains[d].units[u].shortcut === name; }));
		});
	}).sort();
}

test("data and procedures match per plugin", function() {
	assert.deepEqual(procedures("fixture-ruleset-5e-mini"), inData("fixture-ruleset-5e-mini"));
	assert.deepEqual(inData("fixture-ruleset-5e-mini"), ["ac", "dc", "ft", "lb", "mi", "str", "wis", "xp"]);
	// sp: in the data, deliberately without procedure
	assert.deepEqual(inData("fixture-setting-harptos"), ["cp", "gp", "sp"]);
	assert.deepEqual(procedures("fixture-setting-harptos"), ["cp", "gp"]);
});

test("a shortcut shows like the macro it stands for", function() {
	assert.equal(show("A <<wis>> B"), "A WEI B");
	assert.equal(show("<<wis save>>"), show("<<term wis save>>"));
	assert.equal(show("<<ft 30>>"), show("<<unit \"30 ft\">>"));
	assert.equal(show("<<ft 60 range>>"), show("<<unit \"60 ft\" range>>"));
	assert.equal(show("<<lb 10>>"), "5 kg");
	assert.equal(show("<<gp 50>>"), "50 GM");
});

test("the check of the rules macros reads the calls of shortcuts", function() {
	h.add(wiki, {title: "Kurzprobe", text: "<<wis bogus>> <<ft abc>> <<gp>> <<wis save>> <<ft 30>>"});
	try {
		assert.deepEqual(copy(h.filter(wiki, "[[Kurzprobe]trpgrulecheck[]]")), [
			"Text prüfen: <<term wis>> hat keine Variante „bogus“",
			"Text prüfen: keine bekannte Einheit in <<unit \"abc ft\">>",
			"Text prüfen: keine bekannte Einheit in <<unit \"gp\">>"
		]);
		assert.equal(h.filter(wiki, "[[Kurzprobe]macrocheck[]]").length, 0);
	} finally {
		wiki.deleteTiddler("Kurzprobe");
	}
});

test("a shortcut in the data without procedure: the check reports its call", function() {
	assert.equal(show("<<sp 2>>"), "");
	h.add(wiki, {title: "Silberprobe", text: "<<sp 2>>"});
	try {
		assert.deepEqual(copy(h.filter(wiki, "[[Silberprobe]macrocheck[]]")), ["Text prüfen: <<sp>> ist kein bekanntes Makro"]);
	} finally {
		wiki.deleteTiddler("Silberprobe");
	}
});

test("without its plugin the shortcut is gone: nothing shows, the check reports it", function() {
	h.add(wiki, {title: "Ohneprobe", text: "<<wis save>> <<gp 5>>"});
	h.add(wiki, {title: "$:/config/tiddlyrpg/ruleset", text: "none"});
	h.add(wiki, {title: "$:/config/tiddlyrpg/setting", text: "none"});
	return settle().then(function() {
		assert.equal(macros.defined(wiki, "wis"), false);
		assert.equal(show("A <<wis save>> B"), "A  B");
		assert.deepEqual(copy(h.filter(wiki, "[[Ohneprobe]macrocheck[]]")), [
			"Text prüfen: <<wis>> ist kein bekanntes Makro",
			"Text prüfen: <<gp>> ist kein bekanntes Makro"
		]);
	}).finally(function() {
		wiki.deleteTiddler("Ohneprobe");
		wiki.deleteTiddler("$:/config/tiddlyrpg/ruleset");
		wiki.deleteTiddler("$:/config/tiddlyrpg/setting");
		return settle();
	}).then(function() {
		assert.equal(macros.defined(wiki, "wis"), true);
	});
});

test("the hub Ruleset: the shortcut of a unit", function() {
	var html = h.render(wiki, "text/html", "{{Ruleset}}").replace(/>\s+</g, "><");
	assert.match(html, /<td><code>ft<\/code><\/td><td><code>&lt;&lt;ft&gt;&gt;<\/code><\/td>/);
	assert.match(html, /<td><code>in<\/code><\/td><td><\/td>/);
});

test("the hub Currency: a column for the shortcuts, one without procedure struck through", function() {
	var html = h.render(wiki, "text/html", "{{Currency}}");
	assert.match(html, /<th[^>]*>Kurzform<\/th><\/tr>/);
	assert.match(html, /<td[^>]*>GM<\/td><td[^>]*>1 GM<\/td><td[^>]*><code>&lt;&lt;gp&gt;&gt;<\/code><\/td>/);
	assert.match(html, /<td[^>]*>SM<\/td><td[^>]*>0,1 GM<\/td><td[^>]*><s title="Noch kein Makro &lt;&lt;sp&gt;&gt; – &lt;&lt;unit 'n sp'&gt;&gt; schreiben"><code>&lt;&lt;sp&gt;&gt;<\/code><\/s><\/td>/);
	assert.match(html, /<td[^>]*>EM<\/td><td[^>]*>0,5 GM<\/td><td[^>]*><\/td>/);
});

test("the hint on a shortcut without procedure names the macro to write", function() {
	assert.equal(rules.noShortcut(wiki, "sp"), "Noch kein Makro <<sp>> – <<unit \"n sp\">> schreiben");
	assert.equal(rules.noShortcut(wiki, "wis"), "Noch kein Makro <<wis>> – <<term wis>> schreiben");
});
