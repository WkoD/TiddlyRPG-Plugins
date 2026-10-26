/*
 * <<rule "Name" entry:"Entry">> and the names in formulas (modules/glossary.js ref, modules/rules.js
 * rule): the order entry - section - table heading, the entry that keeps the search to it, a name
 * twice, an entry that is none; a package entry not taken with the names of its index; the jump
 * marks of the sections of the ruleset and of table headings; what a view does not see (a locked
 * class, a locked section, a column in a locked section) tells nothing; relink renames the entry.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki, rules, glossary;

var INDEX = "$:/temp/tiddlyrpg-core/content/index";

var FIXTURES = [
	{title: "Barbar", tags: "Information Class", text: "|!Level |!Rage Damage |\n|1st |+2 |\n\n<<trait \"Rage\">> In battle you rage.\n\n<<trait \"Danger Sense\">> You sense it."},
	{title: "Berserker", tags: "Information Class", text: "|!Level |!Rage Damage |\n|1st |+3 |\n\n<<trait \"Frenzy\">> Wilder."},
	{title: "Kämpfer", tags: "Information Class", text: "<<trait \"Extra Attack\">> Twice."},
	{title: "Waldläufer", tags: "Information Class", text: "<<trait \"Extra Attack\">> Twice too."},
	{title: "Odemwaffe", tags: "Information Trait", text: "A breath."},
	{title: "Gewöhnlich", tags: "Item", text: "<<trait \"Hidden Blade\">> Not named: no category with a text of its own."},
	{title: "Ringer", tags: "Information Class", text: "A grappler.\n\n<<trait \"Griff\">> Open.\n\n<<secret>><<trait \"Geheimgriff\">> Locked.\n\n|!Level |!Geheimspalte |\n|1st |+1 |"},
	{title: "Zorn", tags: "Information Class Secret", text: "A locked class.\n\n<<trait \"Wutanfall\">> Rage."}
];

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		rules = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/rules.js");
		glossary = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/glossary.js");
		h.setLanguage(wiki, "en-GB");
		FIXTURES.forEach(function(fields) { h.add(wiki, fields); });
	});
});

function ref(name, entry, view) {
	return Object.assign({}, glossary.ref(wiki, name, entry || "", view));
}

// The jump marks around the links of rendered wikitext: [{anchor, to}]
function jumps(text) {
	var parser = wiki.parseText("text/vnd.tiddlywiki", "\\import [subfilter{$:/core/config/GlobalImportFilter}]\n" + text),
		root = wiki.makeWidget(parser, {document: $tw.fakeDocument}),
		out = [];
	root.render($tw.fakeDocument.createElement("div"), null);
	(function walk(widget, anchor) {
		if(widget.parseTreeNode && widget.parseTreeNode.type === "trpg-jump") {
			anchor = widget.getAttribute("anchor");
		}
		if(widget.parseTreeNode && widget.parseTreeNode.type === "link") {
			out.push({anchor: anchor || "", to: widget.getAttribute("to")});
		}
		(widget.children || []).forEach(function(child) { walk(child, anchor); });
	})(root, "");
	return out;
}

test("the order: an entry of that title, a section of the ruleset, a table heading", function() {
	assert.deepEqual(ref("Odemwaffe"), {title: "Odemwaffe", anchor: ""});
	assert.deepEqual(ref("Rage"), {title: "Barbar", anchor: "trait-rage"});
	assert.deepEqual(ref("danger sense"), {title: "Barbar", anchor: "trait-danger-sense"}, "any case");
	assert.deepEqual(ref("Rage Damage", "Barbar"), {title: "Barbar", anchor: "column-rage-damage"});
	assert.equal(ref("Hidden Blade").problem, "Rules/Check/Name", "only in a category with a text of its own");
});

test("the entry keeps the search to it; two hits without it are a problem that names them", function() {
	var twice = ref("Rage Damage");
	assert.equal(twice.problem, "Rules/Check/NameTwice");
	assert.equal(twice.values.titles, "Barbar, Berserker");
	assert.deepEqual(ref("Rage Damage", "Berserker"), {title: "Berserker", anchor: "column-rage-damage"});
	assert.equal(ref("Extra Attack").problem, "Rules/Check/NameTwice");
	assert.deepEqual(ref("Extra Attack", "Kämpfer"), {title: "Kämpfer", anchor: ""}, "at the very start of the body: no mark");
	assert.equal(ref("Frenzy", "Barbar").problem, "Rules/Check/Name", "not in that entry");
	assert.equal(ref("Rage", "Gewöhnlich").problem, "Rules/Check/NameEntry");
	assert.equal(ref("Rage", "Nirgends").problem, "Rules/Check/NameEntry");
	assert.deepEqual(ref("Barbar", "Barbar"), {title: "Barbar", anchor: ""}, "the entry itself");
});

test("rendered: the name in one dotted span, a link with the jump mark", function() {
	var out = h.render(wiki, "text/html", "Once per <<rule \"Rage\" entry:\"Barbar\">>.");
	assert.match(out, /Once per <span class="trpg-rule"><a [^>]*href="#Barbar"[^>]*>Rage<\/a><\/span>\./, out);
	assert.deepEqual(jumps("<<rule \"Rage\" entry:\"Barbar\">> <<rule \"Odemwaffe\">> <<dice \"1d4 + 'Rage Damage|Barbar'\">>"), [
		{anchor: "trait-rage", to: "Barbar"},
		{anchor: "", to: "Odemwaffe"},
		{anchor: "column-rage-damage", to: "Barbar"}
	]);
	assert.match(h.render(wiki, "text/html", "<<rule \"Unknown Name\">>"), /<span class="trpg-rule">Unknown Name<\/span>/);
});

test("the marks: a section of the ruleset and a table heading carry theirs; not at the very start of the body", function() {
	var body = h.render(wiki, "text/html", "<$trpg-body $tiddler=\"Barbar\" $mode=\"block\"/>", {currentTiddler: "Barbar"});
	assert.match(body, /<th[^>]* data-trpg-anchor="column-rage-damage"[^>]*>Rage Damage/, body);
	assert.match(body, /<th[^>]* data-trpg-anchor="column-level"[^>]*>Level/);
	assert.match(body, /data-trpg-anchor="trait-rage"/);
	var lead = h.render(wiki, "text/html", "<$trpg-body $tiddler=\"Kämpfer\" $mode=\"block\"/>", {currentTiddler: "Kämpfer"});
	assert.doesNotMatch(lead, /data-trpg-anchor/, "the first section at the very start: the plain navigation shows it");
	assert.ok(lead.indexOf("Extra Attack") !== -1);
});

test("a package entry not taken: the names of its index, no jump into a text that is no tiddler", function() {
	h.add(wiki, {title: INDEX, type: "application/json", text: JSON.stringify({ruleset: "$:/plugins/fixture-ruleset-5e-mini", packages: [{name: "SRD mini", language: "en-GB", entries: [
		{id: "class:monk", title: "Monk", type: "Class", tags: ["Information"], fields: {}, names: [{kind: "trait", name: "Flurry of Blows"}, {kind: "column", name: "Ki Points"}, {kind: "nosuchkind", name: "Odd"}]}
	]}]})});
	try {
		assert.deepEqual(ref("Flurry of Blows"), {title: "Monk", anchor: "trait-flurry-of-blows"});
		assert.deepEqual(ref("Ki Points", "Monk"), {title: "Monk", anchor: "column-ki-points"});
		assert.deepEqual(ref("Monk"), {title: "Monk", anchor: ""});
		assert.equal(ref("Odd").problem, "Rules/Check/Name", "a kind the ruleset does not have");
	} finally {
		wiki.deleteTiddler(INDEX);
	}
});

test("the index of a package names the sections and table headings of a class (modules/content-server.js)", function() {
	var server = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/content-server.js"),
		path = require("path"),
		fs = require("fs"),
		os = require("os"),
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "trpg-names-")),
		pkg = path.join(dir, "node_modules", "names-pkg");
	fs.mkdirSync(pkg, {recursive: true});
	fs.writeFileSync(path.join(pkg, "package.json"), JSON.stringify({name: "names-pkg", tiddlyrpg: {content: ["manifest.json"]}}));
	fs.writeFileSync(path.join(pkg, "manifest.json"), JSON.stringify({name: "Names", ruleset: "$:/r", language: "en-GB", "tiddlyrpg-core-version": ">=2.0.0", files: ["e.json"]}));
	fs.writeFileSync(path.join(pkg, "e.json"), JSON.stringify({entries: [
		{id: "c", title: "Monk", type: "Class", fields: {}, text: "|!Level |!Ki Points |\n|1st |- |\n\n<<feature \"Flurry of Blows\">> Hits."},
		{id: "i", title: "Rope", type: "Item", fields: {}, text: "<<effect \"Bind\">> Ties."}
	]}));
	try {
		var entries = server.index(dir, "$:/r")[0].entries;
		assert.deepEqual(Array.from(entries[0].names, function(n) { return Object.assign({}, n); }), [{kind: "feature", name: "Flurry of Blows"}, {kind: "column", name: "Level"}, {kind: "column", name: "Ki Points"}]);
		assert.equal(entries[1].names, undefined, "an item has no names");
		assert.equal(entries[0].text, undefined, "the index still without texts");
	} finally {
		fs.rmSync(dir, {recursive: true, force: true});
	}
});

test("views: a locked class, a locked section, a column in a locked section tell nothing", function() {
	assert.deepEqual(ref("Wutanfall"), {title: "Zorn", anchor: "trait-wutanfall"}, "the DM");
	h.inView(wiki, "public", function() {
		assert.deepEqual(ref("Wutanfall"), {hidden: true});
		assert.deepEqual(ref("Wutanfall", "Zorn"), {hidden: true});
		assert.deepEqual(ref("Zorn", "Zorn"), {hidden: true}, "the locked entry itself");
		assert.deepEqual(ref("Zorn"), {hidden: true});
		assert.deepEqual(ref("Griff"), {title: "Ringer", anchor: "trait-griff"});
		assert.deepEqual(ref("Geheimgriff"), {hidden: true});
		assert.deepEqual(ref("Geheimspalte", "Ringer"), {hidden: true});
		var out = h.render(wiki, "text/html", "<<rule \"Wutanfall\" entry:\"Zorn\">> <<dice \"10 + 'Geheimspalte'\">>");
		assert.equal(out.indexOf("Zorn"), -1, out);
		assert.equal(out.indexOf("<a"), -1, out);
	});
	assert.deepEqual(ref("Geheimspalte", "Ringer"), {title: "Ringer", anchor: "column-geheimspalte"}, "the DM");
});

test("checks: the messages of macros/rules, none for a name only a locked text has", function() {
	h.add(wiki, {title: "Probe Name", tags: "Item", text: "<<rule \"Nothing Here\">> <<rule \"Rage Damage\">> <<rule \"Rage\" entry:\"Gewöhnlich\">> <<rule \"Wutanfall\">>"});
	try {
		assert.deepEqual(h.checkKeys(wiki, "Probe Name", "macros"), ["Rules/Check/Name", "Rules/Check/NameTwice", "Rules/Check/NameEntry"]);
		h.inView(wiki, "public", function() {
			assert.deepEqual(h.checkKeys(wiki, "Probe Name", "macros").indexOf("Rules/Check/Name") !== -1, true);
			assert.equal(h.checks(wiki, "Probe Name", "macros").filter(function(m) { return m.text.indexOf("Wutanfall") !== -1; }).length, 0);
		});
	} finally {
		wiki.deleteTiddler("Probe Name");
	}
});

test("relink: renaming the entry rewrites entry:", function() {
	h.add(wiki, {title: "Probe Relink", tags: "Item", text: "<<rule \"Frenzy\" entry:\"Berserker\">>"});
	try {
		wiki.renameTiddler("Berserker", "Wilder Krieger");
		assert.equal(wiki.getTiddler("Probe Relink").fields.text, "<<rule \"Frenzy\" entry:\"Wilder Krieger\">>");
	} finally {
		wiki.renameTiddler("Wilder Krieger", "Berserker");
		wiki.deleteTiddler("Probe Relink");
	}
});
