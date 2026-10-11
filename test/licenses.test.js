/*
 * Licenses and sources: the tabs "readme" and "license" of the plugins of this repo (from the
 * files of the repo, files/tiddlywiki.files), the tab License of the ControlPanel
 * (ui/controlpanel-license: the license of the wiki and of every plugin) in the public view and
 * in the view of the DM, and the line "Source" of the field source (viewtemplates/source).
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	fs = require("fs"),
	path = require("path"),
	h = require("./helpers");

var $tw, wiki;

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
	});
});

var root = path.join(__dirname, "..");

test.describe("the tabs of the plugins", function() {
	test("tiddlyrpg-core: readme and license from the files of the repo", function() {
		var plugin = wiki.getTiddler("$:/plugins/tiddlyrpg-core");
		assert.equal(plugin.getFieldString("list"), "readme license");
		var license = wiki.getTiddler("$:/plugins/tiddlyrpg-core/license");
		assert.equal(license.fields.type, "text/plain");
		assert.equal(license.fields.text, fs.readFileSync(path.join(root, "LICENSE"), "utf8"));
		assert.match(license.fields.text, /^MIT License/);
		assert.equal(wiki.getTiddler("$:/plugins/tiddlyrpg-core/readme").fields.type, "text/x-tiddlyrpg-markdown");
	});

	test("staticfiles: license", function() {
		assert.equal(wiki.getTiddler("$:/plugins/staticfiles").getFieldString("list"), "license");
		assert.match(wiki.getTiddlerText("$:/plugins/staticfiles/license"), /^MIT License/);
	});
});

test.describe("ControlPanel -> License", function() {
	function tab() {
		return h.render(wiki, "text/html", "{{$:/plugins/tiddlyrpg-core/ui/controlpanel-license}}").replace(/\s*\n\s*/g, "");
	}

	// The row of a plugin: [name, version, author, license]
	function row(out, name) {
		var match = new RegExp("<tr><td><a[^>]*>" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "</a></td>(.*?)</tr>").exec(out);
		return match && match[1].replace(/<\/td><td>/g, "|").replace(/<\/?td>/g, "").trim();
	}

	test("a tab of the ControlPanel, after Plugins", function() {
		var t = wiki.getTiddler("$:/plugins/tiddlyrpg-core/ui/controlpanel-license");
		assert.ok(t.hasTag("$:/tags/ControlPanel"));
		assert.equal(t.fields["list-after"], "$:/core/ui/ControlPanel/Plugins");
		assert.equal(h.render(wiki, "text/plain", t.fields.caption).trim(), "License");
	});

	test("without license files the wiki names none", function() {
		assert.match(tab(), /The wiki names no license for its content\./);
	});

	test("the notice of the wiki and the full text of its license", function() {
		h.add(wiki, {title: "$:/tiddlyrpg/license/notice", type: "text/x-tiddlyrpg-markdown",
			text: "# Campaign\n\nSetup.\n\n<!-- wiki -->\n**Fan content.** Own content: [CC0](https://creativecommons.org/publicdomain/zero/1.0/).\n<!-- /wiki -->\n"});
		h.add(wiki, {title: "$:/tiddlyrpg/license", type: "text/plain", text: "CC0 1.0 Universal"});
		try {
			var out = tab();
			assert.match(out, /<strong>Fan content\.<\/strong> Own content: <a class="tc-tiddlylink-external" href="https:\/\/creativecommons.org\/publicdomain\/zero\/1.0\/"/);
			assert.doesNotMatch(out, /Setup|names no license/);
			assert.match(out, /<details class="trpg-license-text"><summary>Full text<\/summary>.*CC0 1\.0 Universal.*<\/details>/);
		} finally {
			wiki.deleteTiddler("$:/tiddlyrpg/license/notice");
			wiki.deleteTiddler("$:/tiddlyrpg/license");
		}
	});

	test("every plugin with version, author and license", function() {
		var out = tab();
		// Its own tab
		assert.match(row(out, "tiddlyrpg-core"), /^2\.\d+\.\d+\|WkoD\|<a [^>]*href="#%24%3A%2Fplugins%2Ftiddlyrpg-core%2Flicense">show<\/a>$/);
		assert.match(row(out, "Relink"), /href="#%24%3A%2Fplugins%2Fflibbles%2Frelink%2Flicense">show<\/a>$/);
		// TiddlyWiki itself
		assert.match(row(out, "Core"), /href="#%24%3A%2Fcore%2Fcopyright.txt">TiddlyWiki \(BSD-3-Clause\)<\/a>$/);
		// No tab: the name from $:/config/tiddlyrpg/licenses
		assert.match(row(out, "Graph"), /\|BSD-3-Clause$/);
		// Nothing known
		assert.match(row(out, "fixture-setting-krynn"), /\|not stated$/);
		// Server only: not in the published copy, not listed
		assert.equal(row(out, "staticfiles"), null);
	});

	test("the same in the public view and in the view of the DM, in German too", function() {
		var dm = h.inView(wiki, "dm", tab);
		assert.equal(h.inView(wiki, "public", tab), dm);
		h.setLanguage(wiki, "de-DE");
		try {
			assert.match(tab(), /Das Wiki nennt keine Lizenz für seinen Inhalt\..*<th>Lizenz<\/th>.*>anzeigen</);
		} finally {
			h.setLanguage(wiki, "en-GB");
		}
	});
});

test.describe("the field source", function() {
	var FIXTURES = [
		{title: "Fallcrest", tags: "Location", image: "Fallcrest.jpg", source: "[[rpg.fandom.com|https://rpg.fandom.com/wiki/Fallcrest]], CC BY-SA", text: "A town."},
		{title: "Hidden Map", tags: "Location Secret", source: "Drawn by the DM", text: "Secret."}
	];

	test.before(function() {
		FIXTURES.forEach(function(fields) { h.add(wiki, fields); });
	});

	test.after(function() {
		FIXTURES.forEach(function(fields) { wiki.deleteTiddler(fields.title); });
		h.setLanguage(wiki, "en-GB");
	});

	test("below the tiddler as wikitext, with its label", function() {
		var out = h.view(wiki, "Fallcrest").replace(/\s*\n\s*/g, "");
		assert.match(out, /<div class="tc-subtitle">Source: <a class="tc-tiddlylink-external" href="https:\/\/rpg.fandom.com\/wiki\/Fallcrest"[^>]*>rpg.fandom.com<\/a>, CC BY-SA/);
		h.setLanguage(wiki, "de-DE");
		assert.match(h.view(wiki, "Fallcrest"), /Quelle: <a /);
	});

	test("not for a tiddler the view does not see", function() {
		assert.doesNotMatch(h.inView(wiki, "public", function() { return h.view(wiki, "Hidden Map"); }), /Drawn by the DM/);
		assert.match(h.inView(wiki, "dm", function() { return h.view(wiki, "Hidden Map"); }), /Drawn by the DM/);
	});

	test("nothing without the field", function() {
		assert.doesNotMatch(h.view(wiki, "Baile"), /Source:|Quelle:/);
	});
});
