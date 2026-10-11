/*\
title: $:/plugins/tiddlyrpg-core/parsers/markdown.js
type: application/javascript
module-type: parser
created: 20261011204850000
modified: 20261011204850000

Parser of the content type text/x-tiddlyrpg-markdown: the part of a README.md chosen by its
markers, as wikitext without wikilinks, macros or transclusions (modules/markdown.js).

\*/

"use strict";

var markdown = require("$:/plugins/tiddlyrpg-core/modules/markdown.js"),
	WikiParser = require("$:/core/modules/parsers/wikiparser/wikiparser.js")["text/vnd.tiddlywiki"];

var MarkdownParser = function(type,text,options) {
	var parser = new WikiParser("text/vnd.tiddlywiki",markdown.convert(text),options);
	this.tree = parser.tree;
	this.source = text;
	this.type = type;
};

exports[markdown.TYPE] = MarkdownParser;
