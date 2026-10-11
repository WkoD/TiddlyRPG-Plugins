/*
 * The content type text/x-tiddlyrpg-markdown (modules/markdown.js, parsers/markdown.js): the
 * README.md of a repo in the wiki. The markers that choose a part, what of Markdown it reads, that
 * nothing of it becomes wikitext (links to tiddlers, macros, transclusions), and the real README.md
 * of this repo as the tab "readme" of tiddlyrpg-core.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	fs = require("fs"),
	path = require("path"),
	h = require("./helpers");

var $tw, wiki, markdown;

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		markdown = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/markdown.js");
	});
});

// The text as HTML through the parser
function html(text) {
	h.add(wiki, {title: "Markdown probe", type: "text/x-tiddlyrpg-markdown", text: text});
	try {
		return wiki.renderTiddler("text/html", "Markdown probe").trim();
	} finally {
		wiki.deleteTiddler("Markdown probe");
	}
}

test.describe("markers", function() {
	var TEXT = "# Repo\n\nIntro.\n\n<!-- wiki -->\nOne.\n<!-- /wiki -->\n\nSetup.\n\n<!-- wiki -->\nTwo.\n<!-- /wiki -->\n\n" +
		"<!-- wiki notice -->\nFan content.\n<!-- /wiki notice -->\n";

	test("the unnamed sections, joined", function() {
		assert.equal(html(TEXT), "<p>One.</p>\n<p>Two.</p>");
	});

	test("wiki-select: only the named sections", function() {
		assert.equal(html("<!-- wiki-select notice -->\n" + TEXT), "<p>Fan content.</p>");
	});

	test("a section for several names", function() {
		var text = "<!-- wiki a/license b -->\nShared.\n<!-- /wiki -->\n\n<!-- wiki b -->\nOnly b.\n<!-- /wiki -->\n";
		assert.equal(html("<!-- wiki-select a/license -->\n" + text), "<p>Shared.</p>");
		assert.equal(html("<!-- wiki-select b -->\n" + text), "<p>Shared.</p>\n<p>Only b.</p>");
		// Without wiki-select and without a section without names: the whole file
		assert.equal(html("Intro.\n\n" + text), "<p>Intro.</p>\n<p>Shared.</p>\n<p>Only b.</p>");
	});

	test("a named section that is missing gives nothing", function() {
		assert.equal(html("<!-- wiki-select other -->\n" + TEXT), "");
	});

	test("without markers the whole text", function() {
		assert.equal(html("# Repo\n\nIntro."), "<h1>Repo</h1>\n<p>Intro.</p>");
	});

	test("a marker inside code or within a line is no marker", function() {
		assert.equal(html("Lines `<!-- wiki -->` mark it.\n\n```\n<!-- wiki -->\n```"),
			"<p>Lines <code>&lt;!-- wiki --&gt;</code> mark it.</p>\n<pre><code>&lt;!-- wiki --&gt;</code></pre>");
	});
});

test.describe("what it reads", function() {
	test("headings, paragraphs over several lines, bold, code", function() {
		assert.equal(html("## Dates\n\nThe field **date** holds\nthe `date`."),
			"<h2>Dates</h2>\n<p>The field <strong>date</strong> holds\nthe <code>date</code>.</p>");
	});

	test("lists: items over several lines, nested, ordered with its start", function() {
		assert.equal(html("- one\n  more\n  - inner\n- two"),
			"<ul><li>one\nmore<ul><li>inner</li></ul></li><li>two</li></ul>");
		assert.equal(html("3. three\n4. four"), "<ol start=\"3\"><li>three</li><li>four</li></ol>");
	});

	test("an item with code inside, the list goes on", function() {
		assert.equal(html("1. Set it:\n   ```\n   a\n   ```\n2. Done."),
			"<ol><li>Set it:<pre><code>a</code></pre></li><li>Done.</li></ol>");
	});

	test("tables: header, cells, a pipe as \\|", function() {
		assert.equal(html("| A | B |\n|---|---|\n| `x\\|y` | **z** |"),
			"<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td><code>x|y</code></td><td><strong>z</strong></td></tr></tbody></table>");
	});

	test("code blocks keep their text", function() {
		assert.equal(html("```json\n{\"a\": 1}\n```"),
			"<pre><code class=\"language-json\">{\"a\": 1}</code></pre>");
	});

	test("links: http, https and mailto; another target keeps its text", function() {
		assert.equal(html("[tw5-graph](https://github.com/flibbles/tw5-graph) and [CLAUDE](CLAUDE.md)"),
			"<p><a class=\"tc-tiddlylink-external\" href=\"https://github.com/flibbles/tw5-graph\" rel=\"noopener noreferrer\" target=\"_blank\">tw5-graph</a> and CLAUDE</p>");
	});

	test("comments are left out", function() {
		assert.equal(html("A <!-- note --> B\n\n<!--\nlong\n-->\nC"), "<p>A  B</p>\n<p>C</p>");
	});
});

test.describe("no wikitext", function() {
	test("no link to a tiddler, no macro, no transclusion, no formatting", function() {
		h.add(wiki, {title: "Secret thing", text: "x"});
		try {
			var out = html("[[Secret thing]] <<now>> {{Secret thing}} ''bold'' //it// a--b ~~s~~ <$link to=\"Secret thing\"/> &lt;");
			assert.doesNotMatch(out, /<a |tc-tiddlylink/);
			assert.equal(out, "<p>[[Secret thing]] &lt;&lt;now&gt;&gt; {{Secret thing}} ''bold'' //it// a--b ~~s~~ &lt;$link to=\"Secret thing\"/&gt; &amp;lt;</p>");
		} finally {
			wiki.deleteTiddler("Secret thing");
		}
	});

	test("a URL inside code is no link, outside it is", function() {
		var out = html("`https://example.org` https://example.org");
		assert.equal((out.match(/<a /g) || []).length, 1);
	});
});

test.describe("the README.md of this repo as the tab readme", function() {
	var file = fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8");

	test("loaded from the file, with the type of the parser", function() {
		var tiddler = wiki.getTiddler("$:/plugins/tiddlyrpg-core/readme");
		assert.equal(tiddler.fields.type, "text/x-tiddlyrpg-markdown");
		assert.equal(tiddler.fields.text, file);
	});

	test("only the marked part, every heading and table of it", function() {
		var part = markdown.select(file).join("\n"),
			out = wiki.renderTiddler("text/html", "$:/plugins/tiddlyrpg-core/readme");
		assert.match(out, /<h2>Languages<\/h2>/);
		assert.match(out, /<h2>Licenses in the wiki<\/h2>/);
		assert.doesNotMatch(out, /Using it in TiddlyWiki|<h1>/);
		assert.equal((out.match(/<h[1-6]>/g) || []).length, (part.match(/^#{1,6} /mg) || []).length);
		assert.equal((out.match(/<table>/g) || []).length, (part.match(/^\|[-| :]+\|\s*$/mg) || []).length);
		assert.equal((out.match(/<pre>/g) || []).length, (part.match(/^ *```/mg) || []).length / 2);
		// Nothing left of the Markdown syntax outside code
		var text = out.replace(/<code[^>]*>[\s\S]*?<\/code>/g, "");
		assert.doesNotMatch(text, /\*\*|```|^#|\]\(/m);
		assert.doesNotMatch(out, /<p><(h\d|ul|ol|table|pre)/);
	});
});
