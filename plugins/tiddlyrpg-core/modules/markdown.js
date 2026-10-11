/*\
title: $:/plugins/tiddlyrpg-core/modules/markdown.js
type: application/javascript
module-type: library
created: 20261011204850000
modified: 20261011204850000

Markdown as wikitext for the content type text/x-tiddlyrpg-markdown (parser: parsers/markdown.js):
the README.md of a repo shown in the wiki (plugin tabs "readme" and "license", ControlPanel ->
License), loaded by a tiddlywiki.files from the file itself, so the text lives only once. Not a
Markdown parser for tiddlers (that is the plugin tiddlywiki/markdown, with a type of its own;
both can be installed).

What it reads - the part of GitHub Markdown the READMEs use:
  headings (#), paragraphs, lists (-, *, +, 1.; nested by indentation, items over several
  lines), tables (with the row |---|), fenced code (```), rules (---), inline code, **bold**,
  [text](url) and <url> (only http, https and mailto; another target keeps only its text),
  backslash escapes, HTML comments (left out). Anything else is plain text.

Which part of the file - marker lines:
  <!-- wiki -->            ...  <!-- /wiki -->     a section shown in the wiki
  <!-- wiki NAME NAME2 --> ...  <!-- /wiki -->     a section for the names NAME and NAME2 only
  <!-- wiki-select NAME -->                         first line of the text (a prefix in the
                                                    tiddlywiki.files): only the sections of NAME
Without wiki-select the sections without names count, without any of them the whole file. With
wiki-select and no section of its name the text gives nothing. Names hold letters, digits and
"_.-/". Several sections are joined in the order of the file. GitHub does not show the markers.

The text becomes HTML elements in wikitext parsed inline (no paragraphs of its own around them)
with the rules html, entity and extlink only: no wikilinks, macros, transclusions or other
wikitext - a word of the file never links to a tiddler, and "<<", "{{", "''", "--" stay text.
Plain text and code are escaped as entities.

\*/

"use strict";

exports.TYPE = "text/x-tiddlyrpg-markdown";

var RULES = "\\parsermode inline\n\\rules only html entity extlink\n",
	MARKER = /^\s*<!--\s*(\/?)wiki((?:\s+[\w.\-\/]+)*)\s*-->\s*$/,
	SELECT = /^\s*<!--\s*wiki-select\s+([\w.\-\/]+)\s*-->[ \t]*\r?\n?/;

// The lines of the sections to show
var select = exports.select = function(text) {
	var name = null,
		match = SELECT.exec(text);
	if(match) {
		name = match[1];
		text = text.slice(match[0].length);
	}
	var lines = text.split(/\r?\n/),
		out = [],
		found = false,
		inside = false,
		fence = false;
	lines.forEach(function(line) {
		if(/^\s*```/.test(line)) {
			fence = !fence;
		}
		var marker = !fence && MARKER.exec(line);
		if(marker) {
			if(marker[1]) {
				inside = false;
			} else {
				var names = marker[2].trim() ? marker[2].trim().split(/\s+/) : [];
				inside = name === null ? !names.length : names.indexOf(name) !== -1;
				if(inside && found) {
					out.push("");
				}
				found = found || inside;
			}
			return;
		}
		if(inside) {
			out.push(line);
		}
	});
	if(found) {
		return out;
	}
	return name === null ? lines : [];
};

// Text as entities where it could mean something to the wikitext parser or to HTML
function escapeText(text) {
	return text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// Code: every character but letters, digits and spaces as an entity (no URL becomes a link)
function escapeCode(text) {
	return text.replace(/[^A-Za-z0-9 ]/g,function(c) {
		return "&#" + c.charCodeAt(0) + ";";
	});
}

function link(url,html) {
	if(!/^(https?:|mailto:)/i.test(url)) {
		return html;
	}
	return "<a class=\"tc-tiddlylink-external\" href=\"" + url.replace(/"/g,"%22") +
		"\" rel=\"noopener noreferrer\" target=\"_blank\">" + html + "</a>";
}

var INLINE = /(`+)([\s\S]*?[^`])\1(?!`)|\[((?:[^\[\]]|\[[^\[\]]*\])+)\]\(([^()\s]+)\)|\*\*([\s\S]+?)\*\*|<!--[\s\S]*?-->|<((?:https?|mailto):[^>\s]+)>|\\([\\`*_{}\[\]()#+\-.!|<>~])/g;

// One line or paragraph of inline Markdown as HTML
var inline = exports.inline = function(text) {
	var expression = new RegExp(INLINE.source,"g"),
		out = "",
		last = 0,
		match;
	while((match = expression.exec(text))) {
		out += escapeText(text.slice(last,match.index));
		last = expression.lastIndex;
		if(match[1]) {
			var code = match[2].replace(/\r?\n/g," ");
			if(/^ .* $/.test(code) && /\S/.test(code)) {
				code = code.slice(1,-1);
			}
			out += "<code>" + escapeCode(code) + "</code>";
		} else if(match[3] !== undefined) {
			out += link(match[4],inline(match[3]));
		} else if(match[5] !== undefined) {
			out += "<strong>" + inline(match[5]) + "</strong>";
		} else if(match[6] !== undefined) {
			out += link(match[6],escapeCode(match[6]));
		} else if(match[7] !== undefined) {
			out += escapeCode(match[7]);
		}
	}
	return out + escapeText(text.slice(last));
};

function indentOf(line) {
	return /^ */.exec(line)[0].length;
}

var ITEM = /^( *)([-*+]|\d+[.)])[ \t]+(.*)$/,
	FENCE = /^( *)```\s*([\w\-]*)\s*$/,
	HEADING = /^(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/,
	RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/,
	TABLE_SEPARATOR = /^ *\|?(?: *:?-+:? *\|)+ *:?-*:? *\|? *$/;

// The cells of a table row; "\|" is a pipe inside a cell
function cells(line) {
	var row = line.trim().replace(/^\|/,"").replace(/\|$/,""),
		out = [],
		cell = "";
	for(var i = 0; i < row.length; i++) {
		if(row[i] === "\\" && row[i + 1] === "|") {
			cell += "|";
			i++;
		} else if(row[i] === "|") {
			out.push(cell.trim());
			cell = "";
		} else {
			cell += row[i];
		}
	}
	out.push(cell.trim());
	return out;
}

// Blocks of Markdown lines as HTML
function blocks(lines) {
	var out = [],
		paragraph = [],
		i = 0;
	function flush() {
		if(paragraph.length) {
			var html = inline(paragraph.join("\n")).trim();
			if(html) {
				out.push("<p>" + html + "</p>");
			}
			paragraph = [];
		}
	}
	while(i < lines.length) {
		var line = lines[i],
			match;
		if(/^\s*$/.test(line)) {
			flush();
			i++;
		} else if(/^\s*<!--/.test(line) && !/-->/.test(line.replace(/^\s*<!--/,""))) {
			// A comment over several lines
			flush();
			while(i < lines.length && !/-->/.test(lines[i])) {
				i++;
			}
			i++;
		} else if(/^\s*<!--[\s\S]*-->\s*$/.test(line)) {
			flush();
			i++;
		} else if((match = FENCE.exec(line))) {
			flush();
			var indent = match[1].length,
				language = match[2],
				code = [];
			i++;
			while(i < lines.length && !/^ *```\s*$/.test(lines[i])) {
				code.push(lines[i].slice(Math.min(indent,indentOf(lines[i]))));
				i++;
			}
			i++;
			out.push("<pre><code" + (language ? " class=\"language-" + language + "\"" : "") + ">" +
				escapeCode(code.join("\n")) + "</code></pre>");
		} else if((match = HEADING.exec(line))) {
			flush();
			var level = match[1].length;
			out.push("<h" + level + ">" + inline(match[2]) + "</h" + level + ">");
			i++;
		} else if(RULE.test(line) && !paragraph.length) {
			out.push("<hr/>");
			i++;
		} else if(/^ *\|/.test(line) && i + 1 < lines.length && TABLE_SEPARATOR.test(lines[i + 1])) {
			flush();
			var head = cells(line),
				rows = [];
			i += 2;
			while(i < lines.length && /^ *\|/.test(lines[i])) {
				rows.push(cells(lines[i]));
				i++;
			}
			out.push("<table><thead><tr>" + head.map(function(cell) {
				return "<th>" + inline(cell) + "</th>";
			}).join("") + "</tr></thead><tbody>" + rows.map(function(row) {
				return "<tr>" + head.map(function(unused,n) {
					return "<td>" + inline(row[n] || "") + "</td>";
				}).join("") + "</tr>";
			}).join("") + "</tbody></table>");
		} else if((match = ITEM.exec(line)) && (!paragraph.length || !/\d/.test(match[2]) || /^1[.)]$/.test(match[2]))) {
			// A bullet list, or one starting with 1, interrupts a paragraph (as on GitHub)
			flush();
			var list = readList(lines,i);
			out.push(list.html);
			i = list.end;
		} else {
			paragraph.push(line.trim());
			i++;
		}
	}
	flush();
	return out;
}

// A list starting at line i: its items with the lines that belong to them (more indented, or
// after a blank line when more indented lines follow), nested lists inside an item
function readList(lines,i) {
	var first = ITEM.exec(lines[i]),
		base = first[1].length,
		ordered = /\d/.test(first[2]),
		start = ordered ? parseInt(first[2],10) : 1,
		items = [];
	while(i < lines.length) {
		var match = ITEM.exec(lines[i]);
		if(!match || match[1].length !== base || /\d/.test(match[2]) !== ordered) {
			break;
		}
		var content = base + match[2].length + 1,
			body = [match[3]];
		i++;
		while(i < lines.length) {
			var line = lines[i];
			if(/^\s*$/.test(line)) {
				// A blank line belongs to the item if more of it follows
				var next = i + 1;
				while(next < lines.length && /^\s*$/.test(lines[next])) {
					next++;
				}
				if(next < lines.length && indentOf(lines[next]) > base) {
					body.push("");
					i++;
					continue;
				}
				break;
			}
			var item = ITEM.exec(line);
			if(item && item[1].length <= base) {
				break;
			}
			if(!item && indentOf(line) <= base && body[body.length - 1] === "") {
				break;
			}
			body.push(line.slice(Math.min(content,indentOf(line))));
			i++;
		}
		while(body.length && body[body.length - 1] === "") {
			body.pop();
		}
		var html = blocks(body);
		if(html.length && /^<p>/.test(html[0])) {
			html[0] = html[0].slice(3,-4);
		}
		items.push("<li>" + html.join("") + "</li>");
		// Stop at a blank line that ends the list
		if(i < lines.length && /^\s*$/.test(lines[i])) {
			var after = i;
			while(after < lines.length && /^\s*$/.test(lines[after])) {
				after++;
			}
			var again = after < lines.length && ITEM.exec(lines[after]);
			if(!again || again[1].length !== base) {
				break;
			}
			i = after;
		}
	}
	var tag = ordered ? "ol" : "ul";
	return {
		html: "<" + tag + (ordered && start !== 1 ? " start=\"" + start + "\"" : "") + ">" + items.join("") + "</" + tag + ">",
		end: i
	};
}

// The Markdown text (after the selection) as wikitext for the wikitext parser
var convert = exports.convert = function(text) {
	return RULES + blocks(select(text || "")).join("\n") + "\n";
};
