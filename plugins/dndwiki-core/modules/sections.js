/*\
title: $:/plugins/dndwiki-core/modules/sections.js
type: application/javascript
module-type: library
created: 20261007170000000
modified: 20261007170000000

The sections of a body - the one place of these rules. Used by modules/dates.js (dated
sections), modules/spots.js (spots), the widgets dnd-body, dnd-section and the block widgets
date, spot and secret (widgets/sections.js), and the filters of filters/sections.js.

Every kind of section has a short and a block form:

  <<date>>  <<date 3 "Caption">>              short: runs to the next marker on the same level
  <$date n="3" label="Caption">...</$date>    block: runs to its closing tag

  date    dated section of an event (tag Event): number and caption, see modules/dates.js
  spot    spot of a location (tag Location): name, joined tiddler, battle maps, see
          modules/spots.js
  secret  a lock (modules/visibility.js): <<secret "Theren" "Actia">> locks the section it
          stands at - directly before or after its marker, or at the very start of the body
          (then the text before the first marker); <$secret for="Theren Actia">...</$secret>
          locks what it encloses. Without a character: the DM only.

register() adds a kind (e.g. a quest): it is found, locked, nested and rendered like the others.

Rules:
- A short form ends at the next short marker of any kind on the same level, at a block of a
  kind other than secret, or at the end of the block around it. Short forms only split the body
  and the content of a block: inside an HTML element, a table or a $list they cannot end, the
  marker is reported and does not count - use the block form there.
- Blocks nest in any order (a date in a quest, a quest in a date); a section of a kind inside
  one of the same kind is reported and does not count (no number).
- A date counts only in a tiddler tagged Event, a spot only in one tagged Location.
- <<secret>> anywhere else in a section is reported and has no effect.
- Subtrees with the class tc-tiddler-frame (notes of the DM) hold no sections; their links are
  kept with the flag frame (backlinks), not for the pills of a section.

The model of a body is read from its parse tree (cached per tiddler); positions are the start
offsets of the parse tree nodes, so the rendering finds its section by them. What a view sees is
decided when asked, not cached.

\*/

"use strict";

var visibility = require("$:/plugins/dndwiki-core/modules/visibility.js"),
	language = require("$:/plugins/dndwiki-core/modules/language.js");

var LINK = /\[\[([^\]]*?)\]\]/g;

function attribute(node,name) {
	var attr = node.attributes && node.attributes[name];
	return attr && attr.type === "string" ? attr.value : undefined;
}

function hasClass(node,name) {
	var cls = attribute(node,"class");
	return !!cls && (" " + cls + " ").indexOf(" " + name + " ") !== -1;
}

// Plain text of a name: every link replaced by its visible text, whitespace collapsed
var plain = exports.plain = function(name) {
	return (name || "").replace(LINK,function(match,inner) {
		var bar = inner.indexOf("|");
		return bar === -1 ? inner : inner.substring(0,bar);
	}).replace(/\s+/g," ").trim();
};

/* ---------- Kinds ---------- */

var KINDS = Object.create(null);

/*
A kind: {types, params(node,form), visible(wiki,record,view)}
  types    tags of which a tiddler needs one for the kind to count; null: any tiddler
  params   the parameters of a marker or block node
  visible  optional: a further condition for the view to see a section of this kind
*/
var register = exports.register = function(name,def) {
	KINDS[name] = def;
};

exports.kind = function(name) {
	return KINDS[name] || null;
};

register("date",{
	types: ["Event"],
	// <<date>>, <<date 3>>, <<date "Caption">>, <<date 3 "Caption">>, <<date n:3 label:"Caption">>;
	// <$date n="3" label="Caption">
	params: function(node) {
		var first = attribute(node,"0"),
			second = attribute(node,"1"),
			n = attribute(node,"n"),
			label = attribute(node,"label");
		if(first !== undefined) {
			if(n === undefined && /^\s*\d+\s*$/.test(first)) {
				n = first;
			} else if(label === undefined) {
				label = first;
			}
		}
		if(second !== undefined && label === undefined) {
			label = second;
		}
		return {n: n !== undefined && /^\s*\d+\s*$/.test(n) ? parseInt(n,10) : null, label: (label || "").trim()};
	}
});

register("spot",{
	types: ["Location"],
	// <<spot "Name" "Tiddler" battlemap:"a.jpg">>; <$spot name="Name" target="Tiddler" battlemap="a.jpg">
	params: function(node) {
		var name = attribute(node,"name"),
			target = attribute(node,"target");
		if(name === undefined) {
			name = attribute(node,"0") || "";
		}
		if(target === undefined) {
			target = attribute(node,"1") || "";
		}
		return {name: name, plain: plain(name), target: target.trim(), battlemap: attribute(node,"battlemap") || ""};
	},
	// A spot joined to a tiddler the view does not see is not seen either
	visible: function(wiki,record,view) {
		var target = record.params.target || record.params.plain;
		return !target || !wiki.tiddlerExists(target) || visibility.visible(wiki,target,view);
	}
});

register("secret",{
	types: null,
	// <<secret "Theren" "Actia">>: one character per parameter; <$secret for="Theren Actia">
	params: function(node,form) {
		var names = [];
		if(form === "block") {
			names = $tw.utils.parseStringArray(attribute(node,"for") || "") || [];
		} else {
			for(var i = 0; attribute(node,i.toString()) !== undefined; i++) {
				names.push(attribute(node,i.toString()).trim());
			}
		}
		return {names: names.filter(function(name) { return !!name; })};
	}
});

/* ---------- Nodes ---------- */

// The kind of a short marker <<kind ...>> (a transclude node with a position), or null
var shortKind = exports.shortKind = function(node) {
	if(node && node.type === "transclude" && node.start !== undefined) {
		var name = attribute(node,"$variable");
		return name && KINDS[name] ? name : null;
	}
	return null;
};

// The kind of a block <$kind ...>...</$kind>, or null
var blockKind = exports.blockKind = function(node) {
	return node && KINDS[node.type] && node.tag === "$" + node.type ? node.type : null;
};

function isPragma(node) {
	return node.type === "importvariables" || node.type === "parameters" ||
		(node.type === "set" && !!(node.isMacroDefinition || node.isProcedureDefinition || node.isFunctionDefinition || node.isWidgetDefinition));
}

function isBlank(node) {
	return node.type === "text" && !/\S/.test(node.text || "");
}

function isFrame(node) {
	return hasClass(node,"tc-tiddler-frame");
}

// Short markers below a node, not inside frames or blocks
function deepMarkers(node,out) {
	$tw.utils.each(node.children,function(child) {
		if(isFrame(child) || blockKind(child)) {
			return;
		}
		if(shortKind(child)) {
			out.push(child);
		} else {
			deepMarkers(child,out);
		}
	});
	return out;
}

/*
The markers a node of a level begins with: {lead, stray, rest}. A marker itself, or a paragraph
whose first content are markers (<<secret "T">><<date>> Text). stray: markers elsewhere in it;
rest: whether content follows the markers.
*/
function leadMarkers(node) {
	if(shortKind(node)) {
		return {lead: [node], stray: [], rest: false};
	}
	if(node.type === "element" && node.tag === "p") {
		var lead = [], stray = [], rest = false;
		$tw.utils.each(node.children,function(child) {
			if(!rest && isBlank(child)) {
				return;
			}
			if(!rest && shortKind(child)) {
				lead.push(child);
				return;
			}
			if(!isBlank(child)) {
				rest = true;
			}
			if(shortKind(child)) {
				stray.push(child);
			} else if(!isFrame(child) && !blockKind(child)) {
				deepMarkers(child,stray);
			}
		});
		return {lead: lead, stray: stray, rest: rest};
	}
	return {lead: [], stray: isFrame(node) ? [] : deepMarkers(node,[]), rest: !isBlank(node)};
}

/*
The groups of one level (a list of sibling nodes): [{kind, form, marker, head, prefix, nodes,
open}]. The first group holds what comes before the first marker (kind null). A block of a kind
other than secret is a group of its own, followed by a group without kind. prefix: the
<<secret>> markers that lock the group. errors: [{node, key, kind}].
*/
function group(nodes) {
	var groups = [{kind: null, form: null, marker: null, head: null, prefix: [], nodes: [], open: true}],
		pending = [],
		errors = [];
	var flush = function() {
		$tw.utils.each(pending,function(marker) {
			errors.push({node: marker, key: "Section/Check/SecretMidText", kind: "secret"});
		});
		pending = [];
	};
	$tw.utils.each(nodes,function(node) {
		var current = groups[groups.length - 1],
			bk = blockKind(node);
		if(bk && bk !== "secret") {
			groups.push({kind: bk, form: "block", marker: node, head: node, prefix: pending, nodes: [node], open: false});
			pending = [];
			groups.push({kind: null, form: null, marker: null, head: null, prefix: [], nodes: [], open: false});
			return;
		}
		if(bk || isFrame(node)) {
			flush();
			current.nodes.push(node);
			current.open = false;
			return;
		}
		var lead = leadMarkers(node),
			markers = lead.lead.filter(function(m) { return shortKind(m) !== "secret"; }),
			secrets = lead.lead.filter(function(m) { return shortKind(m) === "secret"; });
		$tw.utils.each(lead.stray,function(marker) {
			var kind = shortKind(marker);
			errors.push({node: marker, key: kind === "secret" ? "Section/Check/SecretMidText" : "Section/Check/Inside", kind: kind});
		});
		if(markers.length) {
			$tw.utils.each(markers.slice(1),function(marker) {
				errors.push({node: marker, key: "Section/Check/Inside", kind: shortKind(marker)});
			});
			groups.push({kind: shortKind(markers[0]), form: "short", marker: markers[0], head: node, prefix: pending.concat(secrets), nodes: [node], open: !lead.rest});
			pending = [];
			return;
		}
		if(secrets.length) {
			if(current.open) {
				current.prefix = current.prefix.concat(secrets);
			} else {
				pending = pending.concat(secrets);
			}
			current.nodes.push(node);
			if(lead.rest) {
				flush();
				current.open = false;
			}
			return;
		}
		if(!isBlank(node)) {
			flush();
			current.open = false;
		}
		current.nodes.push(node);
	});
	flush();
	return {groups: groups, errors: errors};
}

// The content of a level: the nodes below the pragmas at its start
function unwrap(nodes) {
	while(nodes.length === 1 && isPragma(nodes[0])) {
		nodes = nodes[0].children || [];
	}
	return nodes;
}

/* ---------- Model ---------- */

function rangeOf(nodes) {
	var from, to;
	$tw.utils.each(nodes,function(node) {
		if(node.start !== undefined && (from === undefined || node.start < from)) {
			from = node.start;
		}
		if(node.end !== undefined && (to === undefined || node.end > to)) {
			to = node.end;
		}
	});
	return {from: from, to: to};
}

/*
The model of a body (cached per tiddler):
  records    [{id, kind, form, key, start, end, params, parent, locks, from, to, counts,
              number, explicit, label, first}] in document order of their markers; kind "intro"
              is the text before the first marker when <<secret>> locks it; key: the start of the
              marker or block ("intro" for the intro); locks: lists of names, one per lock;
              from/to: the range of the text; counts: false if reported; number/explicit/label/
              first: dates (number counting on, the first is 1; first: only whitespace or
              pragmas before it)
  links      [{to, section, frame}]; section: the id of the innermost record, -1 for none
  spotlinks  [{place, spec, start, section}] - the <<spotlink>> calls
  errors     [{key, kind, start}]
*/
var read = exports.read = function(wiki,title) {
	return wiki.getCacheForTiddler(title,"dndwiki-section-model",function() {
		var tiddler = wiki.getTiddler(title),
			text = (tiddler && tiddler.fields.text) || "",
			parser = tiddler ? wiki.parseTiddler(title) : null,
			records = [],
			links = [],
			spotlinks = [],
			errors = [],
			byKey = Object.create(null);
		var add = function(kind,form,node,parent,prefix,nodes,key) {
			var range = rangeOf(nodes),
				record = {
					id: records.length,
					kind: kind,
					form: form,
					key: key,
					start: node ? node.start : range.from,
					end: node ? node.end : range.to,
					params: node && KINDS[kind] ? KINDS[kind].params(node,form) : {},
					parent: parent,
					locks: prefix.map(function(marker) { return KINDS.secret.params(marker,"short").names; }),
					from: range.from,
					to: range.to,
					counts: true
				};
			records.push(record);
			byKey[key] = record;
			return record;
		};
		var visitNode, visitContainer;
		var visitBlock = function(node,parent,prefix) {
			var kind = blockKind(node),
				record = add(kind,"block",node,parent,prefix,[node],node.start.toString());
			if(kind === "secret") {
				record.locks.push(record.params.names);
			}
			visitContainer(node.children || [],record.id,record);
		};
		var visitFrame = function(node,section) {
			$tw.utils.each(node.children,function(child) {
				if(child.type === "link" && attribute(child,"to")) {
					links.push({to: attribute(child,"to"), section: section, frame: true});
				}
				visitFrame(child,section);
			});
		};
		visitNode = function(node,section) {
			if(isFrame(node)) {
				visitFrame(node,section);
				return;
			}
			if(shortKind(node)) {
				return;
			}
			if(blockKind(node)) {
				visitBlock(node,section,[]);
				return;
			}
			if(node.type === "link" && attribute(node,"to")) {
				links.push({to: attribute(node,"to"), section: section, frame: false});
			} else if(node.type === "transclude" && attribute(node,"$variable") === "spotlink" && node.start !== undefined) {
				var place = attribute(node,"place"),
					spec = attribute(node,"spot");
				spotlinks.push({place: (place === undefined ? attribute(node,"0") || "" : place).trim(), spec: spec === undefined ? attribute(node,"1") || "" : spec, start: node.start, section: section});
			}
			$tw.utils.each(node.children,function(child) {
				visitNode(child,section);
			});
		};
		visitContainer = function(nodes,parent,owner) {
			var result = group(unwrap(nodes));
			$tw.utils.each(result.errors,function(error) {
				errors.push({key: error.key, kind: error.kind, start: error.node.start});
			});
			$tw.utils.each(result.groups,function(g) {
				var section = parent;
				if(g.form === "block") {
					visitBlock(g.marker,parent,g.prefix);
					return;
				}
				if(g.kind) {
					section = add(g.kind,"short",g.marker,parent,g.prefix,g.nodes,g.marker.start.toString()).id;
				} else if(g.prefix.length) {
					if(owner) {
						owner.locks = owner.locks.concat(g.prefix.map(function(marker) { return KINDS.secret.params(marker,"short").names; }));
					} else {
						section = add("intro",null,null,parent,g.prefix,g.nodes,"intro").id;
					}
				}
				$tw.utils.each(g.nodes,function(node) {
					visitNode(node,section);
				});
			});
		};
		visitContainer(parser && parser.tree ? parser.tree : [],-1,null);
		records.sort(function(a,b) { return (a.start || 0) - (b.start || 0); });
		var index = Object.create(null);
		$tw.utils.each(records,function(record,i) {
			index[record.id] = i;
		});
		$tw.utils.each(records,function(record) {
			record.id = index[record.id];
			record.parent = record.parent === -1 ? -1 : index[record.parent];
		});
		$tw.utils.each(links,function(link) {
			link.section = link.section === -1 ? -1 : index[link.section];
		});
		$tw.utils.each(spotlinks,function(link) {
			link.section = link.section === -1 ? -1 : index[link.section];
		});
		// Kinds in the wrong tiddler, kinds within the same kind
		$tw.utils.each(records,function(record) {
			var def = KINDS[record.kind];
			if(!def) {
				return;
			}
			if(def.types && !(tiddler && def.types.some(function(tag) { return tiddler.hasTag(tag); }))) {
				record.counts = false;
				errors.push({key: "Section/Check/WrongType", kind: record.kind, start: record.start});
			}
			for(var up = record.parent; up !== -1; up = records[up].parent) {
				if(records[up].kind === record.kind) {
					record.counts = false;
					errors.push({key: "Section/Check/Nested", kind: record.kind, start: record.start});
					break;
				}
			}
		});
		// Numbers of the dates, counting on in document order over both forms
		var number = 0;
		$tw.utils.each(records,function(record) {
			if(record.kind === "date" && record.counts) {
				record.explicit = record.params.n !== null;
				number = record.explicit ? record.params.n : number + 1;
				record.number = number;
				record.label = record.params.label;
				record.first = text.substring(0,record.start).replace(/^[ \t]*\\.*$/mg,"").trim() === "";
			}
		});
		errors.sort(function(a,b) { return (a.start || 0) - (b.start || 0); });
		return {records: records, links: links, spotlinks: spotlinks, errors: errors, byKey: byKey};
	});
};

/* ---------- Views ---------- */

// The record of a marker or block by its key (start offset, or "intro"), or null
exports.byKey = function(wiki,title,key) {
	return read(wiki,title).byKey[key] || null;
};

// The names of the locks of a record and its parents, one list per lock
function locksOf(model,id) {
	var locks = [];
	for(var up = id; up !== -1 && up !== undefined; up = model.records[up].parent) {
		locks = locks.concat(model.records[up].locks);
	}
	return locks;
}

// The characters among names (a lock names player characters only)
function characters(wiki,names) {
	return names.filter(function(name) {
		return visibility.isCharacter(wiki,name);
	});
}

// Whether the active view (or <view>) sees the section <id> of <title> (-1: outside any)
var visible = exports.visible = function(wiki,title,id,view) {
	if(id === -1 || id === undefined || id === null) {
		return true;
	}
	var model = read(wiki,title);
	view = view || visibility.current(wiki);
	for(var up = id; up !== -1; up = model.records[up].parent) {
		var record = model.records[up],
			def = KINDS[record.kind];
		if(def && def.visible && !def.visible(wiki,record,view)) {
			return false;
		}
		for(var k = 0; k < record.locks.length; k++) {
			if(!visibility.allows(wiki,characters(wiki,record.locks[k]),view)) {
				return false;
			}
		}
	}
	return true;
};

/*
The lock shown on a section: null if the record has no lock of its own, else the characters
it is for ([] = DM only). Several locks narrow: only who passes all of them.
*/
exports.lockOf = function(wiki,title,id) {
	var record = read(wiki,title).records[id];
	if(!record || !record.locks.length) {
		return null;
	}
	var names = null;
	$tw.utils.each(record.locks,function(list) {
		var valid = characters(wiki,list);
		names = names === null ? valid : names.filter(function(name) { return valid.indexOf(name) !== -1; });
	});
	return names;
};

// Whether a text position lies in a section the view does not see (for the search)
exports.hiddenRanges = function(wiki,title,view) {
	var model = read(wiki,title),
		ranges = [];
	view = view || visibility.current(wiki);
	$tw.utils.each(model.records,function(record) {
		if(record.from !== undefined && !visible(wiki,title,record.id,view)) {
			ranges.push([record.from,record.to]);
		}
	});
	return ranges;
};

/*
The problems of a body as translated texts: the rules above, and names in a lock that are no
player characters. None for editor snippets ($:/tags/TextEditor/Snippet): they are templates.
*/
exports.check = function(wiki,title) {
	var tiddler = wiki.getTiddler(title),
		model = read(wiki,title),
		messages = [];
	if(tiddler && tiddler.hasTag("$:/tags/TextEditor/Snippet")) {
		return messages;
	}
	$tw.utils.each(model.errors,function(error) {
		var def = KINDS[error.kind],
			text = language.format(language.t(wiki,error.key),{
				macro: error.kind,
				kind: language.t(wiki,"Section/Kind/" + error.kind),
				type: def && def.types ? language.title(wiki,def.types[0]) : ""
			});
		if(messages.indexOf(text) === -1) {
			messages.push(text);
		}
	});
	$tw.utils.each(model.records,function(record) {
		$tw.utils.each(record.locks,function(list) {
			$tw.utils.each(list,function(name) {
				if(!visibility.isCharacter(wiki,name)) {
					var text = language.format(language.t(wiki,"Section/Check/NoCharacter"),{name: name});
					if(messages.indexOf(text) === -1) {
						messages.push(text);
					}
				}
			});
		});
	});
	return messages;
};

/* ---------- Rendering ---------- */

/*
The parse tree of a level, prepared for rendering: each short section and a locked intro are
wrapped in a widget dnd-section (widgets/sections.js), which renders them only for a view that
sees them; blocks render themselves. The pragmas at the start stay around everything.
options: only (render only sections of this kind), omit (leave them out), match (a function on
the record: render only matching sections), nomarker (without the node of the marker), root
(the level is the body itself: a locked intro has the key "intro").
*/
var transform = exports.transform = function(wiki,title,nodes,options) {
	options = options || {};
	if(nodes.length === 1 && isPragma(nodes[0])) {
		var wrapper = $tw.utils.extend({},nodes[0]);
		wrapper.children = transform(wiki,title,nodes[0].children || [],options);
		return [wrapper];
	}
	var model = read(wiki,title),
		out = [];
	$tw.utils.each(group(nodes).groups,function(g) {
		var key = g.kind ? g.marker.start.toString() : (g.prefix.length && options.root ? "intro" : null),
			record = key ? model.byKey[key] || null : null;
		if(options.only && g.kind !== options.only) {
			return;
		}
		if(options.omit && g.kind === options.omit) {
			return;
		}
		if(options.match && !(record && options.match(record))) {
			return;
		}
		if(g.form === "block") {
			out.push(g.marker);
			return;
		}
		if(key) {
			out.push({
				type: "dnd-section",
				attributes: {key: {type: "string", value: key}, kind: {type: "string", value: g.kind || "intro"}},
				children: options.nomarker ? g.nodes.filter(function(node) { return node !== g.head; }) : g.nodes,
				isBlock: true
			});
			return;
		}
		Array.prototype.push.apply(out,g.nodes);
	});
	return out;
};
