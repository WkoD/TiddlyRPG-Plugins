/*\
title: $:/plugins/tiddlyrpg-core/modules/macros-check.js
type: application/javascript
module-type: library
created: 20261010065649000
modified: 20261015193623000

Check for unknown macros: a call <<name>> (also <$transclude $variable="name">, <$macrocall
$name="name"> and <<name>> as an attribute value) in the body of a tiddler whose name nothing
defines. Without a definition TiddlyWiki renders nothing, "A <<wis>> B" reads "A  B" - a typo
disappears silently.

Defined is a name that is
  - global: a definition (\procedure, \define, \function, \widget) in a tiddler of the global
    import ($:/core/config/GlobalImportFilter: $:/core/ui/PageMacros, $:/tags/Macro,
    $:/tags/Global) or of the view template imports ($:/tags/Macro/View, .../View/Body,
    $:/tags/Global/View, .../View/Body), or a JavaScript macro;
  - set around the call in the tiddler itself: pragmas and $set (name), $let and $vars (their
    attributes), $list and $range (variable, counter with -first/-last), $wikify (name),
    $parameters (its attributes);
  - one of the variables the page and the view template give every body (CONTEXT, measured
    with [variables[]] in the body of a tiddler in the story), or one with a prefix of
    PREFIXES (tv-*; the event variables of $eventcatcher and the like).
Inside $importvariables (\import), $setmultiplevariables and the widgets that hand variables to
their actions (WILDCARDS) every name counts as defined. Calls inside a definition (the text of
a procedure or macro) are not looked at, nor are calls with a computed name. Calls in a section
the active view does not see are left out, like the hints of the rules macros.

\*/

"use strict";

var VIEW_TAGS = ["$:/tags/Macro/View","$:/tags/Macro/View/Body","$:/tags/Global/View","$:/tags/Global/View/Body"],
	CONTEXT = ["currentTiddler","storyTiddler","thisTiddler","transclusion","tiddlerInfoState","folded-state",
		"cancel-delete-tiddler-actions","listItem","languageTitle","storyviewTitle",
		"modifier","actionTiddler","actionTiddlerList","navigateTo","importTitle","importTiddler"],
	PREFIXES = ["tv-","dom-","event-"],
	WILDCARDS = ["importvariables","setmultiplevariables","eventcatcher","messagecatcher","keyboard","droppable","dropzone","linkcatcher"],
	DEFINITION = /^\\(?:procedure|define|function|widget)[ \t]+([^\s(]+)/mg;

// The names a text defines with pragmas
function definitions(text) {
	var names = [],
		match;
	DEFINITION.lastIndex = 0;
	while((match = DEFINITION.exec(text || ""))) {
		names.push(match[1]);
	}
	return names;
}

// The global names: {name: true}; cached until the next change
var globals = exports.globals = function(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-macros-global",function() {
		var names = Object.create(null),
			filter = (wiki.getTiddlerText("$:/core/config/GlobalImportFilter") || "") + " " +
				VIEW_TAGS.map(function(tag) { return "[all[shadows+tiddlers]tag[" + tag + "]!is[draft]]"; }).join(" ");
		$tw.utils.each(wiki.filterTiddlers(filter),function(title) {
			$tw.utils.each(definitions(wiki.getTiddlerText(title,"")),function(name) {
				names[name] = true;
			});
		});
		$tw.utils.each($tw.macros,function(macro,name) {
			names[name] = true;
		});
		return names;
	});
};


function attr(node,name) {
	var a = node.attributes && node.attributes[name];
	return a && a.type === "string" ? a.value : undefined;
}

// The names a node sets for its children, or true for "every name"
function sets(node) {
	if(WILDCARDS.indexOf(node.type) !== -1) {
		return true;
	}
	var names = [],
		attributes = node.attributes || {};
	switch(node.type) {
		case "set":
		case "wikify":
			if(attr(node,"name")) {
				names.push(attr(node,"name"));
			}
			break;
		case "let":
		case "vars":
		case "parameters":
			names = Object.keys(attributes).filter(function(name) { return name.charAt(0) !== "$"; });
			break;
		case "list":
		case "range":
			names.push(attr(node,"variable") || "currentTiddler");
			if(attr(node,"counter")) {
				names.push(attr(node,"counter"),attr(node,"counter") + "-first",attr(node,"counter") + "-last");
			}
			break;
		case "tiddler":
			names.push("currentTiddler");
			break;
	}
	return names;
}

// The name a node calls, or null
function called(node) {
	if(node.type === "transclude") {
		return attr(node,"$variable") || null;
	}
	if(node.type === "macrocall") {
		return attr(node,"$name") || null;
	}
	return null;
}

// The calls in the attributes of a node: <$link to=<<name>>>
function attributeCalls(node) {
	var names = [];
	$tw.utils.each(node.attributes,function(a) {
		if(a && a.type === "macro" && a.value) {
			var name = a.value.name || attr(a.value,"$variable");
			if(name) {
				names.push(name);
			}
		}
	});
	return names;
}

/*
The unknown names called in the body of <title>, in document order, each once. None for a tiddler
that is no wikitext and for editor snippets ($:/tags/TextEditor/Snippet: they are templates).
*/
var unknown = exports.unknown = function(wiki,title,view) {
	var tiddler = wiki.getTiddler(title),
		type = tiddler && tiddler.fields.type;
	if(!tiddler || (type && type !== "text/vnd.tiddlywiki") || tiddler.hasTag("$:/tags/TextEditor/Snippet")) {
		return [];
	}
	var parsed = wiki.parseTiddler(title),
		hidden = require("$:/plugins/tiddlyrpg-core/modules/sections.js").hiddenRanges(wiki,title,view),
		known = globals(wiki),
		result = [];
	var inHidden = function(node) {
		return node.start !== undefined && hidden.some(function(range) {
			return node.start >= range[0] && node.start < range[1];
		});
	};
	var isKnown = function(name,scope) {
		return scope === true || known[name] || scope[name] || CONTEXT.indexOf(name) !== -1 ||
			PREFIXES.some(function(prefix) { return name.indexOf(prefix) === 0; });
	};
	var report = function(name,node,scope) {
		if(!isKnown(name,scope) && !inHidden(node) && result.indexOf(name) === -1) {
			result.push(name);
		}
	};
	var walk = function(nodes,scope) {
		$tw.utils.each(nodes,function(node) {
			$tw.utils.each(attributeCalls(node),function(name) {
				report(name,node,scope);
			});
			var name = called(node);
			if(name) {
				report(name,node,scope);
			}
			var names = scope === true ? [] : sets(node),
				inner = scope;
			if(names === true) {
				inner = true;
			} else if(names.length) {
				inner = Object.create(scope);
				names.forEach(function(n) { inner[n] = true; });
			}
			walk(node.children,inner);
		});
	};
	walk(parsed ? parsed.tree : [],Object.create(null));
	return result;
};

// The problems, each {key, params} (checks/macros.js)
exports.check = function(wiki,title,view) {
	return unknown(wiki,title,view).map(function(name) {
		return {key: "Text/Check/UnknownMacro", params: {name: name}};
	});
};
