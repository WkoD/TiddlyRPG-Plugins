/*
 * The tag pill: tag-pill-inner and tag-pill-styles defined again in functions ($:/tags/Global)
 * instead of an override of $:/core/macros/tag (see "Core overrides" in CLAUDE.md). The pill
 * keeps its translated name and its colours wherever the core renders it - its own templates,
 * the sidebar, the tag manager, the whole page with a refresh - and the tag picker, which calls
 * tag-pill-styles with variables of its own, gets the same colours. The stripes of a dead tag:
 * hubs.test.js.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki;

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = tw.wiki;
	});
});

// The style attribute of the first pill in html
function style(html) {
	return (html.match(/class="tc-tag-label[^"]*"[^>]*style="([^"]*)"|style="([^"]*)"[^>]*class="tc-tag-label/) || []).slice(1).join("");
}

// A pill of the tag picker, with the variables $:/core/macros/tag-picker sets around it
function pickerPill(tag) {
	return h.render(wiki, "text/html",
		"<$let palette={{$:/palette}} colourA={{{ [<palette>getindex[foreground]] }}} colourB={{{ [<palette>getindex[background]] }}} fallbackTarget={{{ [<palette>getindex[tag-background]] }}}>" +
		"<$tiddler tiddler=\"" + tag + "\">{{||$:/core/ui/TagPickerTagTemplate}}</$tiddler></$let>");
}

test("$:/core/macros/tag is the core one, not overridden", function() {
	assert.equal(wiki.getShadowSource("$:/core/macros/tag"), "$:/core");
});

test.describe("de-DE", function() {
	test.before(function() {
		h.setLanguage(wiki, "de-DE");
	});

	test("translated name through the core macros and templates", function() {
		assert.match(h.render(wiki, "text/html", "<<tag Location>>"), />Ort</);
		assert.match(h.render(wiki, "text/html", "<<tag-pill Location>>"), />Ort</);
		assert.match(h.render(wiki, "text/html", "{{Location||$:/core/ui/TagTemplate}}"), />Ort</);
		assert.match(h.render(wiki, "text/html", "{{$:/core/ui/MoreSideBar/Tags}}"), />Ort</);
		assert.match(h.render(wiki, "text/html", "<$tiddler tiddler=\"Insel Avalon\">{{||$:/Manager/ItemSidebar/Tags}}</$tiddler>"), />Ort</);
	});

	test("the whole page: translated, and again after a change of the language", function() {
		h.add(wiki, {title: "$:/StoryList", list: "[[Insel Avalon]]"});
		var container = $tw.fakeDocument.createElement("div"),
			widget = wiki.makeTranscludeWidget("$:/core/ui/RootTemplate", {
				document: $tw.fakeDocument, parentWidget: $tw.rootWidget, recursionMarker: "no", importPageMacros: true
			}),
			pill = function() {
				return (container.innerHTML.match(/data-tag-title="Location"[\s\S]*?<span class="tc-tag-(?:exists|missing)">([^<]*)</) || [])[1];
			};
		try {
			widget.render(container, null);
			assert.equal(pill(), "Ort");
			h.setLanguage(wiki, "en-GB");
			widget.refresh({"$:/language": {modified: true}}, container, null);
			assert.equal(pill(), "Location");
		} finally {
			h.setLanguage(wiki, "de-DE");
			wiki.deleteTiddler("$:/StoryList");
		}
	});

	test("colours: outline in the colour of the tag, light inside, text in the foreground colour", function() {
		var css = style(h.render(wiki, "text/html", "<<tag-pill Location>>"));
		assert.match(css, /background-color:color-mix\(in srgb, #ff2b2b 18%, #ffffff\)/);
		assert.match(css, /box-shadow:inset 0 0 0 1px #ff2b2b/);
		assert.match(css, /;color:#333333/);
	});

	test("colours: a tag without a colour takes tag-background of the palette", function() {
		var css = style(h.render(wiki, "text/html", "<<tag-pill [[No such tag]]>>"));
		assert.match(css, /background-color:color-mix\(in srgb, #eecc66 18%, #ffffff\)/);
		assert.match(css, /box-shadow:inset 0 0 0 1px #eecc66/);
	});

	test("tag picker: the same colours from the variables of the picker", function() {
		var css = style(pickerPill("Location"));
		assert.match(css, /background-color:color-mix\(in srgb, #ff2b2b 18%, #ffffff\)/);
		assert.match(css, /box-shadow:inset 0 0 0 1px #ff2b2b/);
		assert.match(css, /;color:#333333/);
		assert.match(style(pickerPill("No such tag")), /box-shadow:inset 0 0 0 1px #eecc66/);
	});
});
