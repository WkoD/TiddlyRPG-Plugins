/*\
title: $:/plugins/tiddlyrpg-core/modules/formula.js
type: application/javascript
module-type: library
created: 20261026130930621
modified: 20261026143641254

A formula of the rules as the text shows it - how a value is computed, never computed: the value
of <<term>> (<<term dc value:"10 + cr">> -> "DC 10 + CR"), the text of <<dice>> that holds
more than dice (<<dice "1d4 + 'Rage Damage|Barbarian'">>) and the calculation of a part of
<<damage>> ("1d6 + 'Rage Damage|Barbarian' cold"), modules/rules.js. Read piece by
piece, each in the rules language and with its link:

  number    "10", "1,5", "1/4" (no space around the slash), "½" - with the decimal mark of the
            wiki language; no thousands separator
  dice      "1d8", "1W8" - the tokens of every language, shown in the rules language
  operator  + - − * x × / ÷ - "*" and "x" (a word of its own) show as "×"; one space on each side
            of an operator between two values, none after a sign at the start or after "("
  bracket   ( )
  term      the id of a term with an optional variant: "cr", "pb", "con:mod" - the label of
            <<term>>, a link to its entry of the glossary (modules/glossary.js term)
  name      'Name' or 'Name|Entry' - a section, a table heading or an entry with a text of its own
            (modules/glossary.js ref), a link with its jump mark; one the view only sees locked
            shows plain

Anything else is a problem (Rules/Check/Formula), shown as written; a bracket not closed or
closed too often too (Rules/Check/FormulaSyntax). The first problem counts.

  read(wiki,text,view)   {text, parts: [{text, to, anchor}], problem, values}; to: the title a
                         piece links to, anchor its jump mark
  plain(wiki,text)       whether <text> is no formula: only dice, numbers, + and - (<<dice>>
                         shows it as before)

\*/

"use strict";

var rules = require("$:/plugins/tiddlyrpg-core/modules/rules.js"),
	glossary = require("$:/plugins/tiddlyrpg-core/modules/glossary.js");

// The patterns of the pieces, at the start of the rest of the text
function patterns(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-formula-patterns",function() {
		var tokens = rules.tokenAlternatives(wiki);
		return {
			name: /^'([^']*)'/,
			dice: tokens ? new RegExp("^\\d*(?:" + tokens + ")\\d+(?![\\p{L}\\d])","iu") : null,
			number: /^(?:\d+(?:[.,]\d+)?(?:\/\d+)?[½¼¾]?|[½¼¾])(?![\p{L}\d])/u,
			operator: /^(?:[+\-−*×÷\/]|x(?![\p{L}\d:-]))/u,
			bracket: /^[()]/,
			term: /^[a-z][a-z0-9-]*(?::[a-z0-9-]+)?(?![\p{L}\d'])/iu,
			word: /^[^\s()+*×÷\/']+|^'[^']*$/u
		};
	});
}

exports.plain = function(wiki,text) {
	var p = patterns(wiki),
		rest = (text || "").toString().trim();
	while(rest.length) {
		var m = (p.dice && p.dice.exec(rest)) || p.number.exec(rest) || /^[+\-−]/.exec(rest);
		if(!m || (m[0] !== "+" && m[0] !== "-" && m[0] !== "−" && /\//.test(m[0]))) {
			return false;
		}
		rest = rest.slice(m[0].length).replace(/^\s+/,"");
	}
	return true;
};

exports.read = function(wiki,text,view) {
	var p = patterns(wiki),
		rest = (text || "").toString().trim(),
		pieces = [],
		problem = null,
		depth = 0;
	var fail = function(key,values) {
		problem = problem || {key: key, values: values};
	};
	while(rest.length) {
		var m, piece = null;
		if((m = p.name.exec(rest))) {
			var bar = m[1].lastIndexOf("|"),
				name = (bar === -1 ? m[1] : m[1].slice(0,bar)).trim(),
				ref = glossary.ref(wiki,name,bar === -1 ? "" : m[1].slice(bar + 1),view);
			if(ref.problem) {
				fail(ref.problem,ref.values);
			}
			piece = {kind: "value", text: name, to: ref.title || "", anchor: ref.anchor || ""};
		} else if(p.dice && (m = p.dice.exec(rest))) {
			piece = {kind: "value", text: rules.dice(wiki,m[0]).text};
		} else if((m = p.number.exec(rest))) {
			piece = {kind: "value", text: rules.asWritten(wiki,m[0])};
		} else if((m = p.operator.exec(rest))) {
			piece = {kind: "operator", text: m[0] === "*" || m[0] === "x" ? "×" : m[0]};
		} else if((m = p.bracket.exec(rest))) {
			depth += m[0] === "(" ? 1 : -1;
			if(depth < 0) {
				fail("Rules/Check/FormulaSyntax",{text: text});
				depth = 0;
			}
			piece = {kind: m[0] === "(" ? "open" : "close", text: m[0]};
		} else if((m = p.term.exec(rest))) {
			var colon = m[0].indexOf(":"),
				id = colon === -1 ? m[0] : m[0].slice(0,colon),
				variant = colon === -1 ? "" : m[0].slice(colon + 1),
				term = rules.term(wiki,id,variant);
			if(term.problem === "Rules/Check/Term") {
				fail("Rules/Check/Formula",{text: m[0], formula: text});
				piece = {kind: "value", text: m[0]};
			} else {
				if(term.problem) {
					fail(term.problem,term.values);
				}
				piece = {kind: "value", text: term.text, to: term.problem ? "" : glossary.term(wiki,id,view) || ""};
			}
		} else {
			m = p.word.exec(rest) || [rest.charAt(0)];
			fail("Rules/Check/Formula",{text: m[0], formula: text});
			piece = {kind: "value", text: m[0]};
		}
		pieces.push(piece);
		rest = rest.slice(m[0].length).replace(/^\s+/,"");
	}
	if(depth > 0) {
		fail("Rules/Check/FormulaSyntax",{text: text});
	}
	// The spaces: around an operator between two values, between two values; none inside brackets
	// and after a sign
	var parts = [];
	var push = function(t,to,anchor) {
		var last = parts[parts.length - 1];
		if(!to && last && !last.to) {
			last.text += t;
		} else if(t) {
			parts.push(to ? {text: t, to: to, anchor: anchor || ""} : {text: t});
		}
	};
	pieces.forEach(function(piece,i) {
		var before = pieces[i - 1],
			binary = piece.kind === "operator" && before && (before.kind === "value" || before.kind === "close");
		if(i > 0 && piece.kind !== "close" && before.kind !== "open" &&
			!(before.kind === "operator" && !isBinary(pieces,i - 1)) && (piece.kind !== "operator" || binary)) {
			push(" ");
		}
		push(piece.text,piece.to,piece.anchor);
	});
	return {
		text: parts.map(function(part) { return part.text; }).join(""),
		parts: parts,
		problem: problem ? problem.key : null,
		values: problem ? problem.values || {} : {}
	};
};

// Whether the operator at <i> stands between two values (else it is a sign)
function isBinary(pieces,i) {
	var before = pieces[i - 1];
	return !!before && (before.kind === "value" || before.kind === "close");
}
