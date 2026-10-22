/*\
title: $:/plugins/tiddlyrpg-core/modules/labels.js
type: application/javascript
module-type: library
created: 20261022135703721
modified: 20261022150508705

Values made of the entries of label domains (modules/rules.js): one entry ("rare"), a list
("fire, cold"), entries with a value after them ("dex +6", "darkvision 60 ft"), and lists of main
entries with their traits ("weapon, martial, melee, versatile"). Damage domains count as label
domains here: their entries are the damage types (keys Rules/Damage/<id>).

Main entries and traits, in the JSON of a label domain:
  {"id": "weapon", "main": true, "tag": "Equipment"}  a main entry, standing alone; "tag" is the
                                                     category tag of the wiki it stands for
  {"id": "martial", "for": ["weapon"]}               a trait of weapon, never standing alone
  {"id": "ammunition", "main": true, "for": ["weapon"]}  a main entry and a trait of weapon
  {"id": "arrow", "for": ["ammunition"]}             a trait of a trait - any depth
In a list the order does not matter and every level is written: an id that can be a trait of
another id in the list is that trait ("weapon, ammunition": a weapon that takes ammunition),
else it must stand alone ("ammunition": ammunition). A trait whose parents are all missing is a
problem; a trait that fits two ids of the list gives a hint. Display, as in a rulebook: per main
entry in the order of the domain its label, then its traits in brackets ("martial weapon (melee,
versatile)"); a trait with a variant for its parent (Rules/Term/<trait>/<parent>, "medium
armor") takes the place of the parent's label, the first one only; deeper traits follow their
parent after ": "; several main entries are joined by Rules/List/And ("... and medium armor"). Ids need to be unique only among the
entries that stand alone; a trait may carry an id of another domain ("medium" of Size) - its
domain then needs keys of its own ("keys": "Rules/Category/"), as labels share their keys
otherwise ("mittel" of the armor, "mittelgroß" of the size).

Extensions: a domain tiddler with "extends": true and the "domain" of an existing label domain
adds its "entries" to it (modules/language.js, domains()); its keys come from the wiki.

Every function returns {text, problem, values} like modules/rules.js, plus what it read.

\*/

"use strict";

var language = require("$:/plugins/tiddlyrpg-core/modules/language.js");

var PREFIX = "$:/tiddlyrpg/language/";

function result(text,problem,values,extra) {
	var r = {text: text, problem: problem || null, values: values || {}};
	$tw.utils.extend(r,extra || {});
	return r;
}

function keyOf(domain,id) {
	return (domain.keys || "Rules/Term/") + id;
}

// Whether an entry can stand alone: no "for", or "main"
var standsAlone = exports.standsAlone = function(entry) {
	return !entry.for || !!entry.main;
};

// Whether the entries of a domain are main entries and traits
var structured = exports.structured = function(domain) {
	return (domain.entries || []).some(function(e) { return e.main || e.for; });
};

// The label domains (and damage domains) by name, the names in order
function labelDomains(wiki,names) {
	var all = language.domains(wiki),
		list = names ? [].concat(names) : Object.keys(all).sort();
	return list.map(function(name) { return all[name]; }).filter(function(d) {
		return d && (d.type === "label" || d.type === "damage");
	});
}

// The label of an entry in the display language of its domain; with a variant if it has one
var labelOf = exports.labelOf = function(wiki,domain,id,variant) {
	var key = keyOf(domain,id);
	return (variant && language.lookupRules(wiki,domain.domain,key + "/" + variant)) ||
		language.lookupRules(wiki,domain.domain,key) || id;
};

// The words an entry is read by, lower case: its id (also with spaces for "-"), its label and
// the words of Parse in every language, its variants without $value$
function index(wiki,domain) {
	return wiki.getGlobalCache("tiddlyrpg-labels-words-" + domain.domain,function() {
		var map = Object.create(null),
			codes = language.languages(wiki);
		var add = function(word,id) {
			word = word.trim().toLowerCase();
			if(word && !map[word]) {
				map[word] = id;
			}
		};
		(domain.entries || []).forEach(function(entry) {
			add(entry.id,entry.id);
			add(entry.id.replace(/-/g," "),entry.id);
		});
		var ids = (domain.entries || []).map(function(e) { return e.id; });
		(domain.entries || []).forEach(function(entry) {
			var key = keyOf(domain,entry.id);
			codes.forEach(function(code) {
				var base = PREFIX + code + "/" + key,
					label = wiki.getTiddlerText(base),
					parse = wiki.getTiddlerText(base + "/Parse");
				if(label && label.indexOf("$value$") === -1) {
					add(label,entry.id);
				}
				(parse || "").split(",").forEach(function(word) { add(word,entry.id); });
			});
		});
		// Variants name the entry too ("Strength" of str), not those named after another entry
		// (the variant "medium/armor" stands for two entries)
		var variants = function(tiddler,title) {
			codes.some(function(code) {
				var start = PREFIX + code + "/" + (domain.keys || "Rules/Term/");
				if(title.indexOf(start) !== 0) {
					return false;
				}
				var rest = title.substr(start.length).split("/"),
					text = tiddler.fields.text || "";
				if(rest.length === 2 && ids.indexOf(rest[0]) !== -1 && ids.indexOf(rest[1]) === -1 &&
					rest[1] !== "Parse" && rest[1] !== "Plural" && text.indexOf("$value$") === -1) {
					add(text,rest[0]);
				}
				return true;
			});
		};
		wiki.each(variants);
		wiki.eachShadow(variants);
		return map;
	});
}

function entryOf(domain,id) {
	return (domain.entries || []).filter(function(e) { return e.id === id; })[0] || null;
}

// The longest start of a text that names an entry of the domains: {domain, entry, rest}
function match(wiki,domains,text) {
	var tokens = text.trim().split(/\s+/);
	for(var n = tokens.length; n > 0; n--) {
		var words = tokens.slice(0,n).join(" ").toLowerCase().replace(/[.:]$/,"");
		for(var i = 0; i < domains.length; i++) {
			var id = index(wiki,domains[i])[words];
			if(id) {
				return {domain: domains[i], entry: entryOf(domains[i],id), rest: tokens.slice(n).join(" ")};
			}
		}
	}
	return null;
}

// One item: an entry, maybe a value after it
function readItem(wiki,spec,domains,text) {
	var hit = match(wiki,domains,text);
	if(!hit) {
		return {text: text, problem: {key: "Rules/Check/Label", values: {text: text}}};
	}
	var item = {text: text, domain: hit.domain, entry: hit.entry, id: hit.entry.id};
	if(spec.only && spec.only.indexOf(item.id) === -1) {
		item.problem = {key: "Rules/Check/Only", values: {text: text, only: spec.only.join(", ")}};
	}
	var valueSpec = (spec.values && spec.values[item.id]) || spec.value;
	if(hit.rest) {
		if(!valueSpec) {
			item.problem = item.problem || {key: "Rules/Check/Label", values: {text: text}};
		} else {
			var rules = require("$:/plugins/tiddlyrpg-core/modules/rules.js"),
				value = rules.value(wiki,valueSpec,hit.rest);
			item.value = hit.rest;
			item.valueText = value.text;
			if(value.problem && !item.problem) {
				item.problem = {key: value.problem, values: value.values};
			}
		}
	}
	return item;
}

// The roles of the items of a structured list: each a main entry or a trait with its parents
// present; problems for a trait without parent and hints for one that fits twice
function roles(items) {
	var ids = items.map(function(item) { return item.id; }),
		problem = null,
		hint = null;
	items.forEach(function(item) {
		var parents = (item.entry.for || []).filter(function(p) { return p !== item.id && ids.indexOf(p) !== -1; });
		if(parents.length) {
			item.parents = parents;
			if(parents.length > 1 && !hint) {
				hint = {key: "Rules/Check/TraitTwice", values: {id: item.id, parents: parents.join(", ")}};
			}
		} else if(standsAlone(item.entry)) {
			item.main = true;
		} else if(!problem) {
			problem = {key: "Rules/Check/TraitParent", values: {id: item.id, parents: (item.entry.for || []).join(", ")}};
		}
	});
	return problem || hint;
}

// The text of a structured list: per main entry its label and its traits (see the header)
function showStructured(wiki,domain,items) {
	var order = (domain.entries || []).map(function(e) { return e.id; }),
		byOrder = function(a,b) { return order.indexOf(a.id) - order.indexOf(b.id); },
		used = [];
	var text = function(item,parent) {
		return (item.value ? labelOf(wiki,domain,item.id,parent) + " " + item.valueText : labelOf(wiki,domain,item.id,parent));
	};
	var childrenOf = function(id) {
		return items.filter(function(item) {
			return used.indexOf(item) === -1 && item.parents && item.parents.indexOf(id) !== -1;
		}).sort(byOrder);
	};
	// The traits below an item as text ("crystal"), each with its own below it after ": "
	var below = function(item) {
		used.push(item);
		var kids = childrenOf(item.id);
		kids.forEach(function(kid) { used.push(kid); });
		return kids.length ? kids.map(function(kid) {
			var deeper = below(kid);
			return text(kid,item.id) + (deeper ? ": " + deeper : "");
		}).join(", ") : null;
	};
	return items.filter(function(item) { return item.main; }).sort(byOrder).map(function(main) {
		used.push(main);
		var kids = childrenOf(main.id),
			head = labelOf(wiki,domain,main.id),
			rest = [];
		var absorbing = kids.filter(function(kid) {
			return language.lookupRules(wiki,domain.domain,keyOf(domain,kid.id) + "/" + main.id) !== null;
		})[0];
		if(absorbing) {
			head = text(absorbing,main.id);
			var deeper = below(absorbing);
			if(deeper) {
				head += ": " + deeper;
			}
		}
		kids.forEach(function(kid) {
			if(kid !== absorbing && used.indexOf(kid) === -1) {
				var deeper = below(kid),
					shown = text(kid,main.id);
				rest.push(deeper ? shown + ": " + deeper : shown);
			}
		});
		return head + (rest.length ? " (" + rest.join(", ") + ")" : "");
	}).join(" " + (language.lookupRules(wiki,domain.domain,"Rules/List/And") || "and") + " ");
}

// The tag of a structured list: of its first main entry in the order of the domain that has one
function tagOf(domain,items) {
	var mains = items.filter(function(item) { return item.main && item.entry.tag; }),
		order = (domain.entries || []).map(function(e) { return e.id; });
	mains.sort(function(a,b) { return order.indexOf(a.id) - order.indexOf(b.id); });
	return mains.length ? mains[0].entry.tag : null;
}

/*
A list: items split at commas, each an entry of spec.domain (a name or a list of names) with an
optional value after it (spec.value: the format of the value, modules/rules.js value(); spec.values:
{"<id>": format} for single entries), limited to spec.only. Returns {text, problem, values, items,
tag}.
*/
exports.labels = function(wiki,spec,text) {
	text = (text || "").toString().trim();
	var domains = labelDomains(wiki,spec.domain);
	if(!domains.length) {
		return result(text,"Rules/Check/NoRules",{type: "labels"});
	}
	if(!text) {
		return result("",null,{},{items: []});
	}
	var items = text.split(",").map(function(part) { return part.trim(); }).filter(Boolean).map(function(part) {
		return readItem(wiki,spec,domains,part);
	});
	var bad = items.filter(function(item) { return item.problem; })[0];
	if(bad) {
		return result(text,bad.problem.key,bad.problem.values,{items: items});
	}
	var domain = items[0].domain;
	if(structured(domain) && items.every(function(item) { return item.domain === domain; })) {
		var problem = roles(items);
		if(problem && problem.key === "Rules/Check/TraitParent") {
			return result(text,problem.key,problem.values,{items: items});
		}
		return result(showStructured(wiki,domain,items),problem && problem.key,problem && problem.values,{items: items, tag: tagOf(domain,items)});
	}
	return result(items.map(function(item) {
		return labelOf(wiki,item.domain,item.id) + (item.value ? " " + item.valueText : "");
	}).join(", "),null,{},{items: items});
};

// One entry of spec.domain, limited to spec.only
exports.label = function(wiki,spec,text) {
	text = (text || "").toString().trim();
	var domains = labelDomains(wiki,spec.domain);
	if(!domains.length) {
		return result(text,"Rules/Check/NoRules",{type: "label"});
	}
	if(!text) {
		return result("");
	}
	var item = readItem(wiki,{only: spec.only},domains,text);
	return item.problem ? result(text,item.problem.key,item.problem.values) :
		result(labelOf(wiki,item.domain,item.id),null,{},{id: item.id, domain: item.domain.domain});
};

/*
<<term "armor medium">>: ids of one structured label domain, a main entry and its traits, shown as
in a list; null when no domain has them all (modules/rules.js term() then reports it).
*/
exports.chain = function(wiki,ids) {
	var found = null;
	labelDomains(wiki).some(function(domain) {
		if(!structured(domain)) {
			return false;
		}
		var entries = ids.map(function(id) { return entryOf(domain,id.toLowerCase()); });
		if(entries.some(function(e) { return !e; })) {
			return false;
		}
		var items = entries.map(function(entry) { return {id: entry.id, entry: entry, domain: domain}; }),
			problem = roles(items);
		if(problem && problem.key === "Rules/Check/TraitParent") {
			return false;
		}
		found = result(showStructured(wiki,domain,items));
		return true;
	});
	return found;
};

/*
The problems of the data of the label domains, each {title, key, params}: a trait whose "for"
names no entry of its domain, a cycle of traits (checks/plugins.js, rule plugins/domains; the
extensions are reported by modules/language.js).
*/
exports.dataProblems = function(wiki) {
	var problems = [];
	labelDomains(wiki).forEach(function(domain) {
		var ids = (domain.entries || []).map(function(e) { return e.id; });
		(domain.entries || []).forEach(function(entry) {
			(entry.for || []).forEach(function(parent) {
				if(ids.indexOf(parent) === -1) {
					problems.push({title: domain.title, key: "Check/Plugins/TraitFor", params: {domain: domain.domain, id: entry.id, parent: parent}});
				}
			});
			// A cycle: the way up the parents comes back to the entry
			var seen = [],
				walk = function(id) {
					var e = entryOf(domain,id);
					return (e && e.for || []).some(function(p) {
						if(p === entry.id) {
							return true;
						}
						if(seen.indexOf(p) !== -1) {
							return false;
						}
						seen.push(p);
						return walk(p);
					});
				};
			if(walk(entry.id)) {
				problems.push({title: domain.title, key: "Check/Plugins/TraitCycle", params: {domain: domain.domain, id: entry.id}});
			}
		});
	});
	return problems;
};
