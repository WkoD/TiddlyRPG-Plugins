/*
 * The check for unknown macros (modules/macros-check.js, rule macros/unknown): a call nothing
 * defines is reported, under the title and not in the published copy; global definitions,
 * definitions and variables set around the call, the variables of the page and view template,
 * the wildcards; calls in a section the view does not see, in code and in definitions are left
 * out; no hint for data tiddlers and editor snippets.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki, macros;

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		macros = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/macros-check.js");
		h.setLanguage(wiki, "de-DE");
	});
});

function unknown(text, fields) {
	h.add(wiki, Object.assign({title: "Makroprobe", text: text}, fields || {}));
	try {
		return macros.unknown(wiki, "Makroprobe").join();
	} finally {
		wiki.deleteTiddler("Makroprobe");
	}
}

test("a call nothing defines; each name once, in document order", function() {
	assert.equal(unknown("A <<nope>> B <<other x>> <<nope>>."), "nope,other");
});

test("the other forms of a call: $transclude $variable, $macrocall, an attribute value", function() {
	assert.equal(unknown("<$transclude $variable=\"t1\"/> <$macrocall $name=\"t2\"/> <$link to=<<t3>>>x</$link>"), "t1,t2,t3");
});

test("global: core macros, JavaScript macros, the procedures of tiddlyrpg-core and of $:/tags/Global", function() {
	assert.equal(unknown("<<tag Baile>> <<now>> <<qualify x>> <<date>> <<unit \"3 ft\">> <<trpg.places 1>>"), "");
	h.add(wiki, {title: "Eigene Makros", tags: "$:/tags/Global", text: "\\procedure mine() M\n\\function my.fn() [[x]]\n"});
	try {
		assert.equal(unknown("<<mine>> <<my.fn>>"), "");
	} finally {
		wiki.deleteTiddler("Eigene Makros");
	}
	assert.equal(unknown("<<mine>>"), "mine");
});

test("set in the tiddler: pragmas, $set, $let, $vars, $list, $range, $wikify, $parameters", function() {
	assert.equal(unknown("\\procedure here() H\n\\define old() O\n\n<<here>> <<old>>"), "");
	assert.equal(unknown("<$set name=\"s\" value=\"1\"><<s>></$set> <$let a=\"1\" b=\"2\"><<a>><<b>></$let> <$vars v=\"1\"><<v>></$vars>"), "");
	assert.equal(unknown("<$list filter=\"x\" variable=\"item\" counter=\"n\"><<item>><<n>><<n-first>></$list> <$list filter=\"x\"><<currentTiddler>></$list>"), "");
	assert.equal(unknown("<$range from=1 to=3 variable=\"i\"><<i>></$range> <$wikify name=\"w\" text=\"x\"><<w>></$wikify>"), "");
});

test("only around the call: after the $let or $list it is unknown again", function() {
	assert.equal(unknown("<$let a=\"1\"><<a>></$let> <<a>> <$list filter=\"x\" variable=\"item\"/> <<item>>"), "a,item");
});

test("the variables of the page and view template; tv-*; inside $importvariables everything", function() {
	assert.equal(unknown("<<currentTiddler>> <<storyTiddler>> <<transclusion>> <<tv-wikilinks>> <<folded-state>>"), "");
	assert.equal(unknown("<$importvariables filter=\"[[Somewhere]]\"><<imported>></$importvariables>"), "");
	assert.equal(unknown("\\import [[Somewhere]]\n\n<<imported>>"), "");
});

test("not looked at: code, the body of a definition", function() {
	assert.equal(unknown("`<<inline>>`\n\n```\n<<block>>\n```\n"), "");
	assert.equal(unknown("\\procedure p()\n<<inside>>\n\\end\n\nText."), "");
});

test("no check for data tiddlers and editor snippets", function() {
	assert.equal(unknown("{\"a\": \"<<nope>>\"}", {type: "application/json"}), "");
	assert.equal(unknown("<<nope>>", {tags: "$:/tags/TextEditor/Snippet"}), "");
});

test("a locked section: left out for a view that does not see it, reported to the DM", function() {
	h.add(wiki, {title: "Geheimprobe", tags: "Location", text: "Open.\n\n<<secret>><<spot \"Ecke\">>\n\n<<hidden>>"});
	try {
		assert.equal(macros.unknown(wiki, "Geheimprobe").join(), "hidden");
		assert.equal(h.inView(wiki, "public", function() { return macros.unknown(wiki, "Geheimprobe").join(); }), "");
	} finally {
		wiki.deleteTiddler("Geheimprobe");
	}
});

test("the hint below the title, not in the published copy", function() {
	h.add(wiki, {title: "Hinweisprobe", text: "A <<nope>> B"});
	try {
		assert.match(h.view(wiki, "Hinweisprobe"), /class="trpg-check trpg-check-error" title="macros\/unknown">Text prüfen: &lt;&lt;nope&gt;&gt; ist kein bekanntes Makro</);
		h.add(wiki, {title: "$:/status/IsReadOnly", text: "yes"});
		assert.doesNotMatch(h.view(wiki, "Hinweisprobe"), /kein bekanntes Makro/);
	} finally {
		wiki.deleteTiddler("$:/status/IsReadOnly");
		wiki.deleteTiddler("Hinweisprobe");
	}
});

test("the message is in the wiki language", function() {
	h.add(wiki, {title: "Operatorprobe", text: "<<nope>>"});
	var text = function() {
		return h.checks(wiki, "Operatorprobe", "macros").map(function(message) { return message.text; }).join();
	};
	try {
		assert.equal(text(), "Text prüfen: <<nope>> ist kein bekanntes Makro");
		h.setLanguage(wiki, "en-GB");
		assert.equal(text(), "Check the text: <<nope>> is no known macro");
	} finally {
		h.setLanguage(wiki, "de-DE");
		wiki.deleteTiddler("Operatorprobe");
	}
});
