/*
 * Integration with tw5-graph. The graph widget itself needs a browser; this checks the override
 * of $:/plugins/flibbles/graph/macros/edges.typed (translated edge labels are in lang/i18n).
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

test("edges.typed override wins over tw5-graph (plugin-priority)", function() {
	assert.ok((wiki.getTiddlerText("$:/plugins/flibbles/graph/macros/edges.typed") || "").indexOf("dndtranslate") !== -1);
});
