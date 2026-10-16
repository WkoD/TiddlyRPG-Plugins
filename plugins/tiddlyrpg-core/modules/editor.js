/*\
title: $:/plugins/tiddlyrpg-core/modules/editor.js
type: application/javascript
module-type: library
created: 20261016184211000
modified: 20261016214011000

The buttons of the editor toolbar on the text in the editor (editor/operation.js) - the one place
of these rules, plain functions on a text so the tests reach them without a browser.

Every kind of section (modules/sections.js) is set the same way:

  without selection  the short form before the unit the cursor stands in: a paragraph, a list,
                     a table, a heading or any other block of the level (the body or the content
                     of a block of a kind). A quest marker goes to the start of the paragraph or
                     list item itself. A lock goes before the marker of its section; where the
                     unit starts no section, the block form goes around the unit instead
                     (<<secret>> in the middle of a section has no effect). A cursor in the gap
                     between two units stands at the next one. Behind the last unit of the level
                     (the paragraph before it is left) the marker goes to the cursor, for the text
                     the DM writes next, and the cursor behind it; a lock there is an empty block
                     with the cursor inside
  with selection     the block form around it: date and spot around the whole units it touches,
                     secret and quest inline around the selection when it lies in one paragraph
                     (both may enclose part of a paragraph), else around the units

A unit that already has a marker of the kind (its own lead markers, or the marker lines right
before it) or lies in a block of the kind is "at" that marker: probe() reports it, so the
dropdown changes or removes it instead of setting a second one. The quest status steps open ->
complete -> failed -> open; open is no status at all.

A date also changes the field date: the n-th marker is the n-th section of the field. A new
marker gets its section at its place, a removed one takes its section with it, and explicit
numbers behind it (<<date 3>>, section="3") count on.

input   {text, selStart, selEnd, tags, fields, title}: the text in the editor, the tags and fields
        of the draft, the title it is the draft of
result  {text, selStart, selEnd, fields, create, navigate, error}: the new text, fields of the
        draft to change, a tiddler to create, a title to open, or the language key of why
        nothing changed (Editor/Error/Quotes: a value with both quotes that no quoting holds -
        in an attribute ending in " or holding """, in a macro parameter also holding ]])

  probe(wiki,input,kind)      what stands at the cursor for <kind>: form "short", "block" or ""
                              (nothing - an empty text, as jsonget reads JSON null as "null")
  apply(wiki,input,action)    action {kind, op, ...}: op insert, change, remove, add (a further
                              quest marker), cycle (quest status); values name, status, names,
                              dm, date, label. Kind sublocation: the spot at the cursor becomes a
                              location of its own; kind spotlink: <<spotlink>> with place and
                              spot at the cursor, a selection as the text of the link
  questStatusNamed(wiki,text,tags,start)  <<quest "N" "complete">> -> status:"complete"
  dateLabelNamed(wiki,text,tags,start)    <<date "Caption">> -> label:"Caption"
  taken(wiki,title)           the tiddler (not a draft) or shadow named <title> in any case - the
                              files of both would clash; null if none

\*/

"use strict";

var sections = require("$:/plugins/tiddlyrpg-core/modules/sections.js"),
	visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js");

var STATUS_NEXT = {"": "complete", open: "complete", complete: "failed", failed: ""};

/* ---------- Text ---------- */

// Thrown by quote() for a value no quoting holds; apply() turns it into Editor/Error/Quotes
var UNQUOTABLE = {};

/*
A value as macro parameter or attribute: "…", '…' or """…""" ("""…""" ends at the first """, so
not for a value ending in " or holding """); a macro parameter also [[…]] (not for a value holding
]]). An attribute has no further form: then UNQUOTABLE.
*/
var quote = exports.quote = function(value,attribute) {
	value = value || "";
	if(value.indexOf("\"") === -1) {
		return "\"" + value + "\"";
	}
	if(value.indexOf("'") === -1) {
		return "'" + value + "'";
	}
	if(value.indexOf("\"\"\"") === -1 && value.charAt(value.length - 1) !== "\"") {
		return "\"\"\"" + value + "\"\"\"";
	}
	if(!attribute && value.indexOf("]]") === -1) {
		return "[[" + value + "]]";
	}
	throw UNQUOTABLE;
};

// The end of the opening tag of a widget at <start> (after ">"), and whether it closes itself
function openTag(text,start) {
	var i = start + 1,
		quoteChar = null;
	while(i < text.length) {
		if(quoteChar) {
			if(text.substr(i,quoteChar.length) === quoteChar) {
				i += quoteChar.length;
				quoteChar = null;
			} else {
				i++;
			}
			continue;
		}
		if(text.substr(i,3) === "\"\"\"") {
			quoteChar = "\"\"\"";
			i += 3;
		} else if(text[i] === "\"" || text[i] === "'") {
			quoteChar = text[i];
			i++;
		} else if(text.substr(i,3) === "{{{") {
			quoteChar = "}}}";
			i += 3;
		} else if(text.substr(i,2) === "{{") {
			quoteChar = "}}";
			i += 2;
		} else if(text.substr(i,2) === "<<") {
			quoteChar = ">>";
			i += 2;
		} else if(text.substr(i,2) === "/>") {
			return {end: i + 2, self: true};
		} else if(text[i] === ">") {
			return {end: i + 1, self: false};
		} else {
			i++;
		}
	}
	return {end: text.length, self: true};
}

// The parts of a block widget node: {start, openEnd, closeStart, end, self}
function blockParts(text,node,kind) {
	var open = openTag(text,node.start),
		close = "</$" + kind + ">",
		closeStart = open.self ? open.end : text.lastIndexOf(close,node.end);
	if(!open.self && (closeStart === -1 || closeStart < open.end)) {
		closeStart = node.end;
	}
	return {start: node.start, openEnd: open.end, closeStart: closeStart, end: node.end, self: open.self};
}

// Replaces [from,to) of the input text; the selection follows
function splice(text,from,to,insert) {
	return text.substring(0,from) + insert + text.substring(to);
}

function shift(pos,from,to,insertLength) {
	if(pos <= from) {
		return pos;
	}
	if(pos >= to) {
		return pos - (to - from) + insertLength;
	}
	return from + insertLength;
}

// Applies edits [{from, to, text}] (not overlapping) at once; the selection moves with the text
function edit(input,edits) {
	var text = input.text,
		selStart = input.selStart,
		selEnd = input.selEnd;
	edits.slice().sort(function(a,b) { return b.from - a.from; }).forEach(function(e) {
		text = splice(text,e.from,e.to,e.text);
		selStart = shift(selStart,e.from,e.to,e.text.length);
		selEnd = shift(selEnd,e.from,e.to,e.text.length);
	});
	return {text: text, selStart: selStart, selEnd: selEnd};
}

// The end of the text in [from,to): a node ends after the line break that follows it
function textEnd(text,from,to) {
	while(to > from && /\s/.test(text[to - 1])) {
		to--;
	}
	return to;
}

// The end of the whitespace after <pos>, up to the next text
function skipBlank(text,pos) {
	while(pos < text.length && /\s/.test(text[pos])) {
		pos++;
	}
	return pos;
}

/* ---------- Markers ---------- */

function attr(node,name) {
	var a = node.attributes && node.attributes[name];
	return a && a.type === "string" ? a.value : undefined;
}

function shortMarker(kind,params) {
	params = params || {};
	switch(kind) {
		case "date":
			return "<<date" + (params.n ? " " + params.n : "") + (params.label ? " label:" + quote(params.label) : "") + ">>";
		case "spot":
			return "<<spot " + quote(params.name) + ">>";
		case "secret":
			return "<<secret" + (params.names || []).map(function(name) { return " " + quote(name); }).join("") + ">>";
		case "quest":
			return "<<quest " + quote(params.name) + (params.status ? " status:" + quote(params.status) : "") + ">>";
	}
	return "";
}

function blockOpen(kind,params) {
	params = params || {};
	switch(kind) {
		case "date":
			return "<$date" + (params.n ? " section=" + quote(String(params.n),true) : "") + (params.label ? " label=" + quote(params.label,true) : "") + ">";
		case "spot":
			return "<$spot name=" + quote(params.name,true) + ">";
		case "secret":
			return "<$secret for=" + quote($tw.utils.stringifyList(params.names || []),true) + ">";
		case "quest":
			return "<$quest name=" + quote(params.name,true) + (params.status ? " status=" + quote(params.status,true) : "") + ">";
	}
	return "";
}

// The parameters of an existing marker or block as the generators above take them
function paramsOf(kind,node,form) {
	var def = sections.kind(kind),
		p = def.params(node,form);
	switch(kind) {
		case "date":
			return {n: p.n, label: p.label};
		case "spot":
			return {name: p.name};
		case "secret":
			return {names: p.names};
		case "quest":
			return {name: p.name, status: p.status === "open" ? "" : p.status};
	}
	return {};
}

/* ---------- Levels ---------- */

function isPragma(node) {
	return node.type === "importvariables" || node.type === "parameters" ||
		(node.type === "set" && !!(node.isMacroDefinition || node.isProcedureDefinition || node.isFunctionDefinition || node.isWidgetDefinition));
}

function unwrap(nodes) {
	while(nodes.length === 1 && isPragma(nodes[0])) {
		nodes = nodes[0].children || [];
	}
	return nodes;
}

function isBlank(node) {
	return node.type === "text" && !/\S/.test(node.text || "");
}

// The non-blank nodes of a level
function units(nodes) {
	return unwrap(nodes || []).filter(function(node) {
		return !isBlank(node) && node.start !== undefined;
	});
}

// The index of the unit at <pos>: the one holding it, else the next one, else the last
function unitAt(list,pos) {
	var i;
	for(i = 0; i < list.length; i++) {
		if(list[i].start <= pos && pos <= list[i].end) {
			return i;
		}
	}
	for(i = 0; i < list.length; i++) {
		if(list[i].start > pos) {
			return i;
		}
	}
	return list.length - 1;
}

/*
The level of the sections around <pos>: the body, or the content of a block of a kind that
holds it. {list, index, unit, owner, ownerKind, blocks, after}: blocks are the blocks of kinds
around <pos>, innermost last. after: <pos> lies behind the last unit of the level on a line of its
own (the paragraph before it is left, a single line break is enough) - then no unit, and index is
the length of the list.
*/
function levelAt(text,tree,pos) {
	var list = units(tree),
		owner = null,
		blocks = [];
	for(;;) {
		var lastUnit = list[list.length - 1],
			lastEnd = lastUnit && textEnd(text,lastUnit.start,lastUnit.end);
		if(lastUnit && pos > lastEnd && text.substring(lastEnd,pos).indexOf("\n") !== -1) {
			return {list: list, index: list.length, unit: null, owner: owner, blocks: blocks, after: true};
		}
		var index = unitAt(list,pos),
			unit = index === -1 ? null : list[index],
			kind = unit && sections.blockKind(unit);
		if(kind) {
			var parts = blockParts(text,unit,kind);
			if(!parts.self && parts.openEnd <= pos && pos <= parts.closeStart) {
				owner = unit;
				blocks.push({node: unit, kind: kind, parts: parts});
				list = units(unit.children);
				continue;
			}
		}
		return {list: list, index: index, unit: unit, owner: owner, blocks: blocks};
	}
}

// The short markers a unit consists of (a marker line, or a paragraph of markers only), or null
function markerUnit(node) {
	if(sections.shortKind(node)) {
		return [node];
	}
	if(node.type === "element" && node.tag === "p") {
		var markers = [];
		for(var i = 0; i < (node.children || []).length; i++) {
			var child = node.children[i];
			if(sections.shortKind(child)) {
				markers.push(child);
			} else if(!isBlank(child)) {
				return null;
			}
		}
		return markers.length ? markers : null;
	}
	return null;
}

// The short markers at the start of a paragraph unit, before its text
function leadOf(node) {
	var lead = [];
	if(node && node.type === "element" && node.tag === "p") {
		for(var i = 0; i < (node.children || []).length; i++) {
			var child = node.children[i];
			if(sections.shortKind(child)) {
				lead.push(child);
			} else if(!isBlank(child)) {
				break;
			}
		}
	}
	return lead;
}

/*
The head of the unit at <index>: the markers on the marker lines right before it and its own lead
markers; first: no unit of text before it on its level (the start of the body or of a block).
*/
function headOf(level) {
	var markers = [],
		first = true,
		i;
	if(level.index === -1) {
		return {markers: markers, first: true, lines: []};
	}
	var lines = [];
	for(i = level.index - 1; i >= 0; i--) {
		var m = markerUnit(level.list[i]);
		if(!m) {
			break;
		}
		lines.unshift(level.list[i]);
		markers = m.concat(markers);
	}
	first = i < 0;
	var own = level.unit ? markerUnit(level.unit) || leadOf(level.unit) : [];
	return {markers: markers.concat(own), first: first, lines: lines};
}

// The innermost paragraph, list item, cell or heading holding <pos>, for a quest marker
var NEST_TAGS = ["p","li","td","th","h1","h2","h3","h4","h5","h6","dd","dt"];

function nestContainer(nodes,pos,found) {
	$tw.utils.each(nodes,function(node) {
		if(node.start !== undefined && node.start <= pos && pos <= node.end) {
			if(node.type === "element" && NEST_TAGS.indexOf(node.tag) !== -1) {
				found = node;
			}
			found = nestContainer(node.children || [],pos,found);
		} else if(node.start === undefined && node.children) {
			found = nestContainer(node.children,pos,found);
		}
	});
	return found;
}

// The leading quest markers of a container
function leadQuests(node) {
	var out = [];
	$tw.utils.each(node ? node.children || [] : [],function(child) {
		if(out.done) {
			return;
		}
		if(sections.nestKind(child) === "quest") {
			out.push(child);
		} else if(!isBlank(child)) {
			out.done = true;
		}
	});
	return out;
}

// Where the content of a container starts (after "* " of a list item)
function contentStart(node) {
	var children = (node.children || []).filter(function(child) { return child.start !== undefined; });
	return children.length ? children[0].start : node.end;
}

/* ---------- Analysis ---------- */

function analyse(wiki,input) {
	var text = input.text || "",
		tree = wiki.parseText("text/vnd.tiddlywiki",text).tree || [],
		pos = Math.min(input.selStart,input.selEnd);
	return {
		text: text,
		tree: tree,
		pos: pos,
		selStart: Math.min(input.selStart,input.selEnd),
		selEnd: Math.max(input.selStart,input.selEnd),
		level: levelAt(text,tree,pos),
		model: sections.readText(wiki,text,input.tags || [])
	};
}

// The block of <kind> around the cursor, innermost first, or null
function blockAround(a,kind) {
	for(var i = a.level.blocks.length - 1; i >= 0; i--) {
		if(a.level.blocks[i].kind === kind) {
			return a.level.blocks[i];
		}
	}
	return null;
}

/*
What stands at the cursor for <kind>: {form: "short"|"block"|null, node, parts, params}. A quest
also lists every marker that holds the cursor - those at the start of its paragraph or list item
and the blocks around it - as markers [{node, form, parts, params}], the first one is the one
changed. A lock or quest block counts wherever it stands, also inside a paragraph.
*/
function existing(a,kind) {
	var blocks = blocksAround(a,kind),
		inner = blocks[blocks.length - 1];
	if(kind === "quest") {
		var container = nestContainer(a.tree,a.pos,null),
			markers = leadQuests(container).map(function(node) {
				return {node: node, form: "short", params: paramsOf("quest",node,"short")};
			}).concat(blocks.slice().reverse().map(function(b) {
				return {node: b.node, form: "block", parts: b.parts, params: paramsOf("quest",b.node,"block")};
			}));
		if(!markers.length) {
			return {form: null, container: container, markers: markers};
		}
		var first = markers[0];
		return {form: first.form, node: first.node, parts: first.parts, params: first.params, container: container, markers: markers,
			all: markers.filter(function(m) { return m.form === "short"; }).map(function(m) { return m.node; })};
	}
	var head = headOf(a.level);
	for(var i = 0; i < head.markers.length; i++) {
		if(sections.shortKind(head.markers[i]) === kind) {
			return {form: "short", node: head.markers[i], params: paramsOf(kind,head.markers[i],"short")};
		}
	}
	if(inner) {
		return {form: "block", node: inner.node, parts: inner.parts, params: paramsOf(kind,inner.node,"block")};
	}
	return {form: null};
}

// The blocks of <kind> whose content holds the cursor (the whole selection), outermost first -
// on the level of the sections or inside a paragraph
function blocksAround(a,kind) {
	var found = [];
	(function walk(nodes) {
		$tw.utils.each(nodes,function(node) {
			if(node.start !== undefined && node.start <= a.selStart && a.selEnd <= node.end) {
				if(sections.blockKind(node) === kind) {
					var parts = blockParts(a.text,node,kind);
					if(!parts.self && parts.openEnd <= a.selStart && a.selEnd <= parts.closeStart) {
						found.push({node: node, kind: kind, parts: parts});
					}
				}
				walk(node.children || []);
			} else if(node.start === undefined && node.children) {
				walk(node.children);
			}
		});
	})(a.tree);
	return found;
}

// The date record of a marker or block node
function dateRecord(a,node) {
	return a.model.byKey[node.start.toString()] || null;
}

/* ---------- Date field ---------- */

// The field date as {before, sections, after}: "." or ".." at the ends are no sections
function splitDate(value) {
	var parts = (value || "").split(",").map(function(part) { return part.trim(); }),
		out = {before: null, sections: parts, after: null};
	if(parts.length === 1 && parts[0] === "") {
		out.sections = [];
		return out;
	}
	if(parts.length > 1 && (parts[0] === "." || parts[0] === "..")) {
		out.before = parts[0];
		out.sections = out.sections.slice(1);
	}
	if(out.sections.length > 1 && (out.sections[out.sections.length - 1] === "." || out.sections[out.sections.length - 1] === "..")) {
		out.after = out.sections[out.sections.length - 1];
		out.sections = out.sections.slice(0,-1);
	}
	return out;
}

function joinDate(split) {
	var parts = [];
	if(split.before) {
		parts.push(split.before);
	}
	parts = parts.concat(split.sections);
	if(split.after) {
		parts.push(split.after);
	}
	return parts.join(", ");
}

// The counted date records in document order
function dateRecords(a) {
	return a.model.records.filter(function(record) {
		return record.kind === "date" && record.counts;
	});
}

// Edits that move the explicit numbers of the dates after <from> with a number >= <n> by <delta>
function renumber(a,from,n,delta) {
	var edits = [];
	$tw.utils.each(dateRecords(a),function(record) {
		if(record.start > from && record.explicit && record.number >= n) {
			var node = findNode(a.tree,record.start),
				params = {n: record.number + delta, label: record.label};
			if(node && record.form === "short") {
				edits.push({from: node.start, to: node.end, text: shortMarker("date",params)});
			} else if(node) {
				var parts = blockParts(a.text,node,"date");
				edits.push({from: parts.start, to: parts.openEnd, text: blockOpen("date",params)});
			}
		}
	});
	return edits;
}

// The parse tree node starting at <start> that is a marker or block
function findNode(nodes,start) {
	var found = null;
	(function walk(list) {
		$tw.utils.each(list,function(node) {
			if(found) {
				return;
			}
			if(node.start === start && (sections.shortKind(node) || sections.nestKind(node) || sections.blockKind(node))) {
				found = node;
				return;
			}
			walk(node.children || []);
		});
	})(nodes);
	return found;
}

/* ---------- Probe ---------- */

exports.probe = function(wiki,input,kind) {
	var a = analyse(wiki,input),
		result = {kind: kind, form: ""};
	if(kind === "sublocation") {
		var spot = spotAt(wiki,a,input);
		result.selection = a.selStart !== a.selEnd;
		if(spot) {
			result.spot = {name: spot.record.params.name, title: spot.title, problem: spot.problem || ""};
		}
		return result;
	}
	var at = existing(a,kind);
	result.form = at.form || "";
	result.selection = a.selStart !== a.selEnd;
	var split = splitDate((input.fields || {}).date);
	if(at.form) {
		result.params = at.params;
		if(kind === "date") {
			var record = dateRecord(a,at.node);
			if(record) {
				result.number = record.number;
				result.date = split.sections[record.number - 1] || "";
			}
		}
	} else if(kind === "date") {
		// The number a new marker gets, and the dates of the sections around it
		var n = newDateNumber(a);
		result.number = n;
		result.prev = split.sections[n - 2] || "";
		result.next = split.sections[n - 1] || "";
	}
	if(kind === "quest") {
		// Every quest at the cursor: to remove one of them, and not to set one twice
		result.markers = (at.markers || []).map(function(m) {
			return {name: m.params.name, status: m.params.status, start: m.node.start, form: m.form};
		});
		result.names = $tw.utils.stringifyList(result.markers.map(function(m) { return m.name; }));
	}
	return result;
};

/* ---------- Apply ---------- */

function insertShort(a,kind,params) {
	var marker = shortMarker(kind,params);
	if(!a.level.unit) {
		return atCursor(a,marker + "\n\n");
	}
	return [{from: a.level.unit.start, to: a.level.unit.start, text: marker + "\n\n"}];
}

/*
<text> at the cursor where it stands behind the last unit or in an empty level, as a block of its
own: a blank line before it unless there is one. The cursor goes to <inner> in <text> (default:
behind it), where the DM writes on; the edits carry it as cursor.
*/
function atCursor(a,text,inner) {
	var before = a.text.substring(0,a.pos),
		prefix = !/\S/.test(before) || /\n[ \t]*\n\s*$/.test(before) ? "" : (/\n[ \t]*$/.test(before) ? "\n" : "\n\n"),
		edits = [{from: a.pos, to: a.pos, text: prefix + text}];
	edits.cursor = a.pos + prefix.length + (inner === undefined ? text.length : inner);
	return edits;
}

// The units a selection touches on the level of its start
function touched(a) {
	var list = a.level.list,
		first = unitAt(list,a.selStart),
		last = unitAt(list,a.selEnd);
	if(first === -1) {
		return null;
	}
	if(last < first) {
		last = first;
	}
	// An end in the gap before a unit belongs to the unit before
	if(last > first && list[last].start > a.selEnd) {
		last--;
	}
	return {from: list[first].start, to: textEnd(a.text,list[last].start,list[last].end), one: first === last ? list[first] : null};
}

function wrapUnits(a,kind,params) {
	var range = touched(a);
	if(!range) {
		return null;
	}
	return [
		{from: range.from, to: range.from, text: blockOpen(kind,params) + "\n\n"},
		{from: range.to, to: range.to, text: "\n\n</$" + kind + ">"}
	];
}

// Inline around the selection when it lies within one paragraph and is not the whole of it
function wrapInline(a,kind,params) {
	var container = nestContainer(a.tree,a.selStart,null);
	if(!container || a.selEnd > container.end) {
		return null;
	}
	var start = contentStart(container);
	if(a.selStart <= start && a.selEnd >= container.end) {
		return null;
	}
	return [
		{from: a.selStart, to: a.selStart, text: blockOpen(kind,params)},
		{from: a.selEnd, to: a.selEnd, text: "</$" + kind + ">"}
	];
}

// Removes a short marker; a line of its own goes with the blank lines after it
function removeShort(a,node) {
	var line = null;
	$tw.utils.each(a.level.list,function(unit) {
		if(unit === node || (unit.children || []).indexOf(node) !== -1) {
			line = unit;
		}
	});
	if(line === node || (line && (markerUnit(line) || []).length === 1)) {
		return [{from: line.start, to: skipBlank(a.text,line.end), text: ""}];
	}
	return [{from: node.start, to: node.end, text: ""}];
}

// Removes a block and keeps what it holds
function unwrapBlock(a,parts) {
	if(parts.self) {
		return [{from: parts.start, to: skipBlank(a.text,parts.end), text: ""}];
	}
	var content = a.text.substring(parts.openEnd,parts.closeStart).replace(/^[ \t]*\n(\s*\n)?/,"").replace(/\n\s*$/,"");
	return [{from: parts.start, to: parts.end, text: content}];
}

// Rewrites a marker or the opening tag of a block with new parameters
function rewrite(a,kind,at,params) {
	if(at.form === "short") {
		return [{from: at.node.start, to: at.node.end, text: shortMarker(kind,params)}];
	}
	return [{from: at.parts.start, to: at.parts.openEnd, text: blockOpen(kind,params)}];
}

// The result of <edits>; the cursor where atCursor() put it
function done(input,edits,extra) {
	var out = edit(input,edits);
	if(edits.cursor !== undefined) {
		out.selStart = out.selEnd = edits.cursor;
	}
	return $tw.utils.extend(out,extra || {});
}

function fail(key) {
	return {error: key};
}

exports.apply = function(wiki,input,action) {
	try {
		return applyAction(wiki,input,action);
	} catch(e) {
		if(e === UNQUOTABLE) {
			return fail("Editor/Error/Quotes");
		}
		throw e;
	}
};

function applyAction(wiki,input,action) {
	var a = analyse(wiki,input),
		kind = action.kind,
		op = action.op;
	if(kind === "date") {
		return applyDate(wiki,a,input,action);
	}
	if(kind === "quest") {
		return applyQuest(a,input,action);
	}
	if(kind === "sublocation") {
		return applySublocation(wiki,a,input);
	}
	if(kind === "newsublocation") {
		return applyNewSublocation(wiki,a,input,action);
	}
	if(kind === "spotlink") {
		// <<spotlink "Place" "Spot">> at the cursor; a selection is the text of the link
		var place = (action.place || "").trim(),
			spotName = (action.spot || "").trim(),
			shown = a.text.substring(a.selStart,a.selEnd).trim();
		if(!place || !spotName) {
			return fail("Editor/Error/NoName");
		}
		return done(input,[{from: a.selStart, to: a.selEnd, text: "<<spotlink " + quote(place) + " " + quote(shown ? "[[" + shown + "|" + spotName + "]]" : spotName) + ">>"}]);
	}
	var at = existing(a,kind),
		params = kind === "secret" ? {names: action.dm === "yes" ? [] : $tw.utils.parseStringArray(action.names || "") || []} : {name: (action.name || "").trim()};
	if(kind === "spot" && !params.name && op !== "remove") {
		return fail("Editor/Error/NoName");
	}
	if(op === "remove") {
		if(!at.form) {
			return fail("Editor/Error/Nothing");
		}
		return done(input,at.form === "short" ? removeShort(a,at.node) : unwrapBlock(a,at.parts));
	}
	if(op === "change") {
		if(!at.form) {
			return fail("Editor/Error/Nothing");
		}
		return done(input,rewrite(a,kind,at,params));
	}
	// insert
	if(a.selStart !== a.selEnd) {
		var edits = (kind === "secret" && wrapInline(a,kind,params)) || wrapUnits(a,kind,params);
		return edits ? done(input,edits) : fail("Editor/Error/Nothing");
	}
	if(kind === "secret") {
		return done(input,insertSecret(a,params));
	}
	return done(input,insertShort(a,kind,params));
}

/*
A lock without selection: before the marker of the section the unit starts, or at the start of
the body or block; where the unit starts no section, the block form around the unit. Behind the
last unit an empty block with the cursor in it, for the text the DM writes next.
*/
function insertSecret(a,params) {
	var head = headOf(a.level),
		section = null;
	for(var i = 0; i < head.markers.length; i++) {
		if(sections.shortKind(head.markers[i]) !== "secret") {
			section = head.markers[i];
			break;
		}
	}
	if(section) {
		return [{from: section.start, to: section.start, text: shortMarker("secret",params)}];
	}
	if(head.first && a.level.unit) {
		return [{from: a.level.unit.start, to: a.level.unit.start, text: shortMarker("secret",params) + "\n\n"}];
	}
	if(!a.level.unit && head.first) {
		return atCursor(a,shortMarker("secret",params) + "\n\n");
	}
	if(!a.level.unit) {
		var open = blockOpen("secret",params) + "\n\n";
		return atCursor(a,open + "\n\n</$secret>",open.length);
	}
	return [
		{from: a.level.unit.start, to: a.level.unit.start, text: blockOpen("secret",params) + "\n\n"},
		{from: textEnd(a.text,a.level.unit.start,a.level.unit.end), to: textEnd(a.text,a.level.unit.start,a.level.unit.end), text: "\n\n</$secret>"}
	];
}

function applyQuest(a,input,action) {
	var at = existing(a,"quest"),
		op = action.op,
		name = (action.name || "").trim();
	if(op === "cycle") {
		if(!at.form) {
			return fail("Editor/Error/NoQuest");
		}
		var next = STATUS_NEXT[at.params.status] !== undefined ? STATUS_NEXT[at.params.status] : "complete";
		return done(input,rewrite(a,"quest",at,{name: at.params.name, status: next}));
	}
	if(op === "remove") {
		// The marker at <start>, else the first one at the cursor
		var gone = at.markers.filter(function(m) { return String(m.node.start) === String(action.start); })[0] || at.markers[0];
		if(!gone) {
			return fail("Editor/Error/Nothing");
		}
		return done(input,gone.form === "short" ? [{from: gone.node.start, to: gone.node.end, text: ""}] : unwrapBlock(a,gone.parts));
	}
	if(!name) {
		return fail("Editor/Error/NoName");
	}
	// A quest marks the same text once: a second marker of it would not count (Nested)
	var others = at.markers.filter(function(m) { return op !== "change" || m !== at.markers[0]; });
	if(others.some(function(m) { return m.params.name === name; })) {
		return fail("Editor/Error/QuestTwice");
	}
	if(op === "change") {
		if(!at.form) {
			return fail("Editor/Error/Nothing");
		}
		return done(input,rewrite(a,"quest",at,{name: name, status: at.params.status}));
	}
	var params = {name: name, status: action.status === "open" ? "" : action.status || ""};
	if(a.selStart !== a.selEnd) {
		var edits = wrapInline(a,"quest",params) || wrapUnits(a,"quest",params);
		return edits ? done(input,edits) : fail("Editor/Error/Nothing");
	}
	// add: a further marker after those at the start (two quests linked)
	if(op === "add" && at.form === "short") {
		var last = at.all[at.all.length - 1];
		return done(input,[{from: last.end, to: last.end, text: shortMarker("quest",params)}]);
	}
	var container = at.container || nestContainer(a.tree,a.pos,null);
	if(!container && !a.level.unit) {
		return done(input,atCursor(a,shortMarker("quest",params)));
	}
	var where = container ? contentStart(container) : a.level.unit.start;
	return done(input,[{from: where, to: where, text: shortMarker("quest",params)}]);
}

// Where a new marker or block goes: before the first unit of the selection, or of the cursor
function insertAt(a) {
	if(a.selStart !== a.selEnd) {
		return (touched(a) || {from: a.pos}).from;
	}
	return a.level.unit ? a.level.unit.start : a.pos;
}

// The number a new date gets: one after the date before it
function newDateNumber(a) {
	var from = insertAt(a),
		before = dateRecords(a).filter(function(other) { return other.start < from; });
	return before.length ? before[before.length - 1].number + 1 : 1;
}

function applyDate(wiki,a,input,action) {
	var at = existing(a,"date"),
		op = action.op,
		split = splitDate((input.fields || {}).date),
		record, edits;
	if(op === "remove" || op === "change") {
		if(!at.form) {
			return fail("Editor/Error/Nothing");
		}
		record = dateRecord(a,at.node);
	}
	if(op === "remove") {
		edits = at.form === "short" ? removeShort(a,at.node) : unwrapBlock(a,at.parts);
		if(!record) {
			return done(input,edits);
		}
		var shared = dateRecords(a).filter(function(other) { return other.number === record.number; }).length > 1;
		if(record.explicit || shared) {
			return done(input,edits);
		}
		split.sections.splice(record.number - 1,1);
		return done(input,edits.concat(renumber(a,record.start,record.number + 1,-1)),{fields: {date: joinDate(split)}});
	}
	var date = (action.date || "").trim(),
		label = (action.label || "").trim();
	if(op === "change") {
		edits = rewrite(a,"date",at,{n: at.params.n, label: label});
		var extra = {};
		if(record && date) {
			while(split.sections.length < record.number) {
				split.sections.push("");
			}
			split.sections[record.number - 1] = date;
			extra.fields = {date: joinDate(split)};
		}
		return done(input,edits,extra);
	}
	if(!date) {
		return fail("Editor/Error/NoDate");
	}
	if(blockAround(a,"date")) {
		return fail("Editor/Error/InDate");
	}
	var params = {label: label},
		from = insertAt(a),
		n = newDateNumber(a);
	edits = a.selStart !== a.selEnd ? wrapUnits(a,"date",params) : insertShort(a,"date",params);
	if(!edits) {
		return fail("Editor/Error/Nothing");
	}
	while(split.sections.length < n - 1) {
		split.sections.push("");
	}
	split.sections.splice(n - 1,0,date);
	// The renumbered markers lie behind the new one, so the cursor of atCursor() stays
	var all = edits.concat(renumber(a,from - 1,n,1));
	all.cursor = edits.cursor;
	return done(input,all,{fields: {date: joinDate(split)}});
}

/* ---------- Spot to location ---------- */

// The spot at the cursor that has no tiddler yet: {record, title, problem}
function spotAt(wiki,a,input) {
	var found = null;
	$tw.utils.each(a.model.records,function(record) {
		if(record.kind === "spot" && record.counts && record.start <= a.pos && a.pos <= Math.max(record.to || 0,record.end || 0)) {
			found = record;
		}
	});
	if(!found) {
		return null;
	}
	var title = found.params.plain,
		problem = "";
	if(!title) {
		problem = "Editor/Error/NoName";
	} else if(found.params.target || wiki.tiddlerExists(title) || wiki.isShadowTiddler(title)) {
		problem = "Editor/Sublocation/Joined";
	} else if(taken(wiki,title)) {
		problem = "Editor/Sublocation/Taken";
	}
	return {record: found, title: title, problem: problem};
}

// The tiddler of that title in any case (the files of the tiddlers would clash), or null
var taken = exports.taken = function(wiki,title) {
	var lower = title.toLowerCase(),
		found = wiki.isShadowTiddler(title) ? title : null;
	wiki.each(function(tiddler,other) {
		if(!found && !tiddler.isDraft() && other.toLowerCase() === lower) {
			found = other;
		}
	});
	return found;
};

/*
A new location inside the one in the editor: saved at once and opened (not for editing), with
the field location; a selection moves into it as its text, with the lock of the section it
stood in.
*/
function applyNewSublocation(wiki,a,input,action) {
	var title = (action.name || "").trim();
	if(!title) {
		return fail("Editor/Error/NoName");
	}
	if(taken(wiki,title)) {
		return fail("Editor/Sublocation/Taken");
	}
	var fields = {title: title, tags: ["Location"], location: $tw.utils.stringifyList([input.title]), text: ""},
		edits = [];
	if(a.selStart !== a.selEnd) {
		fields.text = a.text.substring(a.selStart,a.selEnd).trim();
		// Whole lines take the blank lines after them along, so no gap stays behind
		var cut = a.selEnd;
		if((a.selStart === 0 || a.text[a.selStart - 1] === "\n") && (cut === a.text.length || a.text[cut] === "\n")) {
			cut = skipBlank(a.text,cut);
		}
		edits.push({from: a.selStart, to: cut, text: ""});
		var holder = null;
		$tw.utils.each(a.model.records,function(record) {
			if(record.from !== undefined && record.from <= a.selStart && a.selEnd <= record.to) {
				holder = record;
			}
		});
		var lock = holder ? lockedFor(wiki,a,holder,input) : lockedFor(wiki,a,{id: -1},input);
		if(lock !== null) {
			fields.tags = fields.tags.concat(["Secret"],lock);
		}
	} else if((input.tags || []).indexOf("Secret") !== -1) {
		fields.tags = fields.tags.concat(["Secret"],lockedFor(wiki,a,{id: -1},input));
	}
	return done(input,edits,{create: fields, navigate: title});
}

// The characters who may see what a record holds: null for everyone, [] for the DM only
function lockedFor(wiki,a,record,input) {
	var names = null,
		narrow = function(list) {
			var valid = list.filter(function(name) { return visibility.isCharacter(wiki,name); });
			names = names === null ? valid : names.filter(function(name) { return valid.indexOf(name) !== -1; });
		};
	for(var up = record.id; up !== -1 && up !== undefined; up = a.model.records[up].parent) {
		$tw.utils.each(a.model.records[up].locks,narrow);
	}
	var tags = input.tags || [];
	if(tags.indexOf("Secret") !== -1) {
		narrow(tags);
	}
	return names;
}

function applySublocation(wiki,a,input) {
	var spot = spotAt(wiki,a,input);
	if(!spot) {
		return fail("Editor/Sublocation/NoSpot");
	}
	if(spot.problem) {
		return fail(spot.problem);
	}
	var record = spot.record,
		node = findNode(a.tree,record.start),
		body, edits;
	if(record.form === "block") {
		var parts = blockParts(a.text,node,"spot");
		body = parts.self ? "" : a.text.substring(parts.openEnd,parts.closeStart);
		edits = [{from: parts.start, to: parts.end, text: "<$spot name=" + quote(record.params.name,true) + "/>"}];
	} else {
		var to = textEnd(a.text,node.end,Math.max(record.to || node.end,node.end));
		body = a.text.substring(node.end,to);
		edits = [{from: node.start, to: to, text: shortMarker("spot",{name: record.params.name})}];
	}
	var fields = {title: spot.title, tags: ["Location"], text: body.trim()},
		lock = lockedFor(wiki,a,record,input);
	if(lock !== null) {
		fields.tags = fields.tags.concat(["Secret"],lock);
	}
	if(record.params.image) {
		fields.image = record.params.image;
	}
	if(record.params.map) {
		fields.map = record.params.map;
	}
	return done(input,edits,{create: fields, navigate: spot.title});
}

/* ---------- Fixes of hints ---------- */

// A fix whose marker no quoting holds changes nothing (null)
function orNull(fn) {
	return function() {
		try {
			return fn.apply(this,arguments);
		} catch(e) {
			if(e === UNQUOTABLE) {
				return null;
			}
			throw e;
		}
	};
}

// <<quest "Name" "complete">> -> <<quest "Name" status:"complete">> (the marker at <start>)
exports.questStatusNamed = orNull(function(wiki,text,tags,start) {
	var tree = wiki.parseText("text/vnd.tiddlywiki",text).tree,
		node = findNode(tree,start);
	if(!node || sections.nestKind(node) !== "quest") {
		return null;
	}
	var name = attr(node,"name") !== undefined ? attr(node,"name") : attr(node,"0") || "",
		status = attr(node,"status") || attr(node,"1") || "";
	return splice(text,node.start,node.end,shortMarker("quest",{name: name.trim(), status: status.trim() === "open" ? "" : status.trim()}));
});

// <<date "Caption">> -> <<date label:"Caption">> (the marker at <start>)
exports.dateLabelNamed = orNull(function(wiki,text,tags,start) {
	var tree = wiki.parseText("text/vnd.tiddlywiki",text).tree,
		node = findNode(tree,start);
	if(!node || sections.shortKind(node) !== "date") {
		return null;
	}
	var p = sections.kind("date").params(node,"short");
	return splice(text,node.start,node.end,shortMarker("date",{n: p.n, label: p.label || p.bad}));
});

// The text of a short spot or block without what it holds (the marker stays), or null
exports.spotEmptied = orNull(function(wiki,text,tags,start) {
	var model = sections.readText(wiki,text,tags),
		tree = wiki.parseText("text/vnd.tiddlywiki",text).tree,
		record = model.byKey[start.toString()],
		node = findNode(tree,start);
	if(!record || !node || record.kind !== "spot") {
		return null;
	}
	if(record.form === "block") {
		var parts = blockParts(text,node,"spot");
		return splice(text,parts.start,parts.end,"<$spot name=" + quote(record.params.name,true) + "/>");
	}
	return splice(text,node.end,textEnd(text,node.end,Math.max(record.to || node.end,node.end)),"");
});

// The text of the body of a spot (for the hint of a joined spot that holds the same text)
exports.spotText = function(wiki,title,start) {
	var tiddler = wiki.getTiddler(title),
		text = tiddler ? tiddler.fields.text || "" : "",
		model = sections.read(wiki,title),
		record = model.byKey[start.toString()];
	if(!record || record.kind !== "spot") {
		return "";
	}
	var tree = wiki.parseTiddler(title).tree,
		node = findNode(tree,start);
	if(!node) {
		return "";
	}
	if(record.form === "block") {
		var parts = blockParts(text,node,"spot");
		return parts.self ? "" : text.substring(parts.openEnd,parts.closeStart).trim();
	}
	return text.substring(node.end,Math.max(record.to || node.end,node.end)).trim();
};

exports.splitDate = splitDate;
exports.joinDate = joinDate;
