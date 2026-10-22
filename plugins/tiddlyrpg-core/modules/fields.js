/*\
title: $:/plugins/tiddlyrpg-core/modules/fields.js
type: application/javascript
module-type: library
created: 20261022141507011
modified: 20261022173314535

The fields of the rules: which fields a type has, how their values read and show. The data is the
ruleset's (or the wiki's), the core knows no field name. JSON data tiddlers tagged
$:/tags/tiddlyrpg/RulesFields, two kinds:

  definitions  {"definitions": {"<field>": spec, ...}} - every field once (the ruleset:
               $:/tiddlyrpg/rules/fields); spec as in modules/rules.js value(): "format",
               "domain", "kind", "words", "only", "value", "values", "min", "max", plus
                 "derive"  {"kind": "modifier", "base": 10, "step": 2}   "8 (-1)" beside the value
                           {"kind": "average"}                         "7 (2d6)" beside dice
                           {"kind": "total", "parts": [part, ...]}     "19 (18 + 1)" beside a number
                           {"kind": "lookup", "from": "cr", "column": "xp"}
                                 the value when empty: a column of the entry its field "from" names
                           {"kind": "sum", "parts": [part, ...]}       the value when empty
                 "computed" {"<entry>": derive}  entries of a labels field shown with their value
                           even when not written (senses: passive-perception)
                 "signed"  a number shown with its sign ("+6")
                 "view": false  only in the editor, not in the block (expertise: it shows in
                           the values of the skills already)
               A part of a sum: {"number": 10}, {"field": "proficiency"} (its value, written or
               derived), {"modifier": "wis"} (the modifier of that field), {"entry": "skills",
               "id": "perception", "else": part} (the value of an entry of a labels field); in
               the value of an entry "$entry" is its id, "$entry.<column>" a column of it ("ability"
               of a skill); "times": {"list": "expertise", "factor": 2} multiplies a part when the
               entry stands in that list.
  schema       {"types": ["Item", ...], "fields": ["<field>", ...], "labels": {"<field>": "<key>"},
                "summary": {"key", "byValue": {"<field>": {"<value>": "<key>"}}, "ifSet": {"<field>":
                "<key>"}, "flags": {"<field>": "<key>"}}, "groups": [group, ...]}
               - per type which fields, in which order; several schemas of a type are merged,
               the ruleset's first, then the wiki's (a campaign adds fields).
  group        {"id", "layout": "list"|"row"|"inline", "fields": [...], "combine": [{"fields":
               [...], "key", "flags"}], "relations": [...], "when": {...}} - a section of the
               block in the order of the groups, after the fields of no group (and the price,
               unless a group names "price"): "list" a line per field, "row" a table (the
               abilities), "inline" the lines in one line. A combine shows its fields in one
               line under the label of the first (fill(): "1/4 (50 XP)").
  patterns     (summary, combine) keys of the ruleset with $field$, $field.ordinal$
               (Rules/Ordinal/<value>) and $field.flag$ (the key of flags when the field is yes);
               a part in {...} falls away when a field in it is empty: "{$category$}{, $rarity$}
               { $attunement.flag$}".
  "when" (definition or group): {"<field>": ["<value>", ...]} - offered and shown only while that
  field holds one of the values (an id of a labels field counts).

A field name the core or a relation uses is reserved; a field defined twice or used without
definition is a problem (rule fields/schema), as is a field the field list of the core shows - the
form shows it, so the ruleset (or the wiki) hides it: $:/config/EditTemplateFields/Visibility/
<field> "hide" (a multids config/form-fields-hidden). Labels: Rules/Field/<field> or the key of the
schema, in the display language of the field's domain, else of the group ruleset.

Values are never stored by the core: what is shown is read from the field, a derived value only
when the field is empty. copyFrom() gives the values of another tiddler (a base item) to write
into a draft once - nothing stays linked.

  registry(wiki)              {definitions, schemas, problems}
  spec(wiki,field)            the definition of a field
  forTypes(wiki,types)        {fields, groups, labels, summary} of the merged schemas
  forTiddler(wiki,title)      the same for the types of a tiddler
  label(wiki,field,labels)    the label of a field
  read(wiki,fields,field)     {text, problem, values, written, derived, items} of a field of a
                              tiddler (its fields as an object)
  summary(wiki,fields,schema) the header line, or ""; the fields it uses
  fill(wiki,fields,key,flags) a pattern filled
  line(wiki,fields,combine)   the text of a combine
  fits(wiki,fields,when,list) whether a "when" holds (list: the fields of the schema)
  copyFrom(wiki,draft,source) the values to copy: {field: value}, "secret-fields" included
  locked(fields)              the fields secret-fields locks: null, "all" or [fields]
  problem(wiki,fields,field,labels)  the problem of a written value: {level, key, params} or null

\*/

"use strict";

var language = require("$:/plugins/tiddlyrpg-core/modules/language.js"),
	types = require("$:/plugins/tiddlyrpg-core/modules/types.js");

var TAG = "$:/tags/tiddlyrpg/RulesFields",
	HIDDEN = "$:/config/EditTemplateFields/Visibility/",
	// Fields of TiddlyWiki and of tiddlyrpg-core that a schema must not use
	CORE = ["title","text","tags","type","created","modified","creator","modifier","list","caption",
		"color","icon","draft.of","draft.title","revision","bag","plugin-type","source","secret-fields",
		"trpg-noerror","trpg-noinfo","map-positions","data"];

function rules() {
	return require("$:/plugins/tiddlyrpg-core/modules/rules.js");
}

// The names a schema must not use: the core's, the general fields of the form, the relations
function reserved(wiki) {
	var form = require("$:/plugins/tiddlyrpg-core/modules/form.js"),
		relations = require("$:/plugins/tiddlyrpg-core/modules/relations.js"),
		all = relations.types(wiki);
	return CORE.concat(form.GENERAL).concat(Object.keys(all).filter(function(name) {
		return all[name].kind === "field";
	}));
}

var registry = exports.registry = function(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-fields",function() {
		var definitions = Object.create(null),
			schemas = [],
			problems = [],
			taken = reserved(wiki),
			titles = wiki.filterTiddlers("[all[shadows+tiddlers]tag[" + TAG + "]sort[]]");
		// The ruleset first (shadows), then the wiki
		var fromWiki = function(title) { return wiki.tiddlerExists(title) && !wiki.isShadowTiddler(title); };
		titles.sort(function(a,b) { return (fromWiki(a) ? 1 : 0) - (fromWiki(b) ? 1 : 0); });
		titles.forEach(function(title) {
			var data = wiki.getTiddlerData(title,null);
			if(!data || typeof data !== "object") {
				return;
			}
			$tw.utils.each(data.definitions || {},function(spec,field) {
				if(taken.indexOf(field) !== -1) {
					problems.push({title: title, key: "Check/Fields/Reserved", params: {field: field}});
				} else if(definitions[field]) {
					problems.push({title: title, key: "Check/Fields/Twice", params: {field: field, other: definitions[field].title}});
				} else {
					definitions[field] = $tw.utils.extend({},spec,{field: field, title: title});
				}
			});
			if($tw.utils.isArray(data.types)) {
				schemas.push({
					title: title,
					types: data.types,
					fields: $tw.utils.isArray(data.fields) ? data.fields : [],
					labels: data.labels || {},
					groups: $tw.utils.isArray(data.groups) ? data.groups : [],
					summary: data.summary || null
				});
			}
		});
		schemas.forEach(function(schema) {
			schema.fields.forEach(function(field) {
				if(!definitions[field]) {
					problems.push({title: schema.title, key: "Check/Fields/Undefined", params: {field: field}});
				}
			});
		});
		// The field list of the core must not show it beside the form
		$tw.utils.each(definitions,function(spec,field) {
			if((wiki.getTiddlerText(HIDDEN + field) || "").trim() !== "hide") {
				problems.push({title: spec.title, key: "Check/Fields/Hidden", params: {field: field}});
			}
		});
		return {definitions: definitions, schemas: schemas, problems: problems};
	});
};

var spec = exports.spec = function(wiki,field) {
	return registry(wiki).definitions[field] || null;
};

// Every field any schema uses, in the order of the schemas
exports.all = function(wiki) {
	var out = [];
	registry(wiki).schemas.forEach(function(schema) {
		schema.fields.forEach(function(field) {
			if(out.indexOf(field) === -1 && spec(wiki,field)) {
				out.push(field);
			}
		});
	});
	return out;
};

var forTypes = exports.forTypes = function(wiki,list) {
	var result = {fields: [], groups: [], labels: {}, summary: null};
	registry(wiki).schemas.forEach(function(schema) {
		if(!schema.types.some(function(type) { return list.indexOf(type) !== -1; })) {
			return;
		}
		schema.fields.forEach(function(field) {
			if(result.fields.indexOf(field) === -1 && spec(wiki,field)) {
				result.fields.push(field);
			}
		});
		// A group of the same id gets the fields it lacks
		schema.groups.forEach(function(group) {
			var same = result.groups.filter(function(g) { return g.id === group.id; })[0];
			if(!same) {
				result.groups.push($tw.utils.extend({},group,{fields: (group.fields || []).slice(), relations: (group.relations || []).slice()}));
			} else {
				(group.fields || []).forEach(function(field) {
					if(same.fields.indexOf(field) === -1) {
						same.fields.push(field);
					}
				});
			}
		});
		$tw.utils.each(schema.labels,function(key,field) {
			result.labels[field] = result.labels[field] || key;
		});
		result.summary = result.summary || schema.summary;
	});
	return result;
};

exports.forTiddler = function(wiki,title) {
	return forTypes(wiki,types.of(wiki,title));
};

var label = exports.label = function(wiki,field,labels) {
	var s = spec(wiki,field),
		key = (labels && labels[field]) || "Rules/Field/" + field;
	return (s && s.domain && !$tw.utils.isArray(s.domain) ? language.lookupRules(wiki,s.domain,key) : language.lookupGroup(wiki,"ruleset",key)) || field;
};

/* Values */

function signed(wiki,n) {
	var text = rules().formatNumber(wiki,Math.abs(n),2);
	return (n < 0 ? "-" : "+") + text;
}

// The raw text of a field
function raw(fields,field) {
	var value = fields[field];
	return value === undefined || value === null ? "" : value.toString().trim();
}

// The number a field stands for: its value, or what it derives; null if none
function numberOf(wiki,fields,field,depth) {
	if((depth || 0) > 8) {
		return null;
	}
	var text = raw(fields,field);
	if(text) {
		var n = parseFloat(text.replace(",",".").replace("−","-"));
		return isNaN(n) ? null : n;
	}
	var s = spec(wiki,field);
	return s && s.derive ? compute(wiki,fields,s.derive,null,(depth || 0) + 1) : null;
}

// The modifier of a field by the formula of its derive "modifier"
function modifierOf(wiki,fields,field,depth) {
	var s = spec(wiki,field),
		n = numberOf(wiki,fields,field,depth);
	if(n === null || !s || !s.derive || s.derive.kind !== "modifier") {
		return null;
	}
	return Math.floor((n - (s.derive.base || 0)) / (s.derive.step || 1));
}

// "$entry" and "$entry.<column>" in a part of the value of an entry
function resolve(name,entry) {
	if(!entry || typeof name !== "string" || name.indexOf("$entry") !== 0) {
		return name;
	}
	var column = name.substr("$entry".length + 1);
	return column ? entry.entry[column] : entry.id;
}

// The entries of a labels field as {id: value or null} (written values only)
function entriesOf(wiki,fields,field) {
	var s = spec(wiki,field),
		r = s && rules().value(wiki,s,raw(fields,field)),
		out = {};
	(r && r.items || []).forEach(function(item) {
		out[item.id] = item.value !== undefined ? item.value : null;
	});
	return out;
}

// The value of a derive that computes (lookup, sum), or null
function compute(wiki,fields,derive,entry,depth) {
	if(!derive || depth > 8) {
		return null;
	}
	if(derive.kind === "lookup") {
		var from = spec(wiki,derive.from),
			text = raw(fields,derive.from),
			id = from && text && rules().value(wiki,from,text).id,
			domain = id && language.domains(wiki)[from.domain],
			hit = domain && (domain.entries || []).filter(function(e) { return e.id === id; })[0];
		return hit && hit[derive.column] !== undefined ? Number(hit[derive.column]) : null;
	}
	if(derive.kind === "sum") {
		var total = 0;
		for(var i = 0; i < (derive.parts || []).length; i++) {
			var n = part(wiki,fields,derive.parts[i],entry,depth);
			if(n === null) {
				return null;
			}
			total += n;
		}
		return total;
	}
	return null;
}

function part(wiki,fields,p,entry,depth) {
	var n = null;
	if(p.number !== undefined) {
		n = Number(p.number);
	} else if(p.field !== undefined) {
		n = numberOf(wiki,fields,resolve(p.field,entry),depth + 1);
	} else if(p.modifier !== undefined) {
		n = modifierOf(wiki,fields,resolve(p.modifier,entry),depth + 1);
	} else if(p.entry !== undefined) {
		var list = entriesOf(wiki,fields,p.entry),
			id = resolve(p.id,entry);
		if(id in list) {
			n = list[id] !== null ? parseFloat(list[id].replace(",",".").replace("−","-")) : entryValue(wiki,fields,p.entry,id,depth + 1);
		} else if(p.else) {
			n = part(wiki,fields,p.else,entry,depth + 1);
		}
	}
	if(n !== null && p.times && entry) {
		var marked = entriesOf(wiki,fields,p.times.list);
		if(resolve("$entry",entry) in marked) {
			n *= p.times.factor;
		}
	}
	return n === null || isNaN(n) ? null : n;
}

// The derived value of an entry of a labels field (its spec.value.derive), or null
function entryValue(wiki,fields,field,id,depth) {
	var s = spec(wiki,field),
		derive = s && s.value && s.value.derive,
		domain = s && language.domains(wiki)[$tw.utils.isArray(s.domain) ? s.domain[0] : s.domain],
		entry = domain && (domain.entries || []).filter(function(e) { return e.id === id; })[0];
	return derive && entry ? compute(wiki,fields,derive,{id: id, entry: entry},depth || 0) : null;
}

// The text of a number in a field: signed or as it is
function numberText(wiki,s,n) {
	return s && s.signed ? signed(wiki,n) : rules().formatNumber(wiki,n,2);
}

// The text beside a value: "8 (-1)" of a modifier, "7 (2d6)" of an average, "19 (18 + 1)" of a
// total (the parts that are empty left out)
function beside(wiki,s,r,text,fields,field) {
	var d = s.derive;
	if(!d || r.problem) {
		return r.text;
	}
	if(d.kind === "modifier") {
		var m = modifierOf(wiki,fields,field);
		return m === null ? r.text : r.text + " (" + signed(wiki,m) + ")";
	}
	if(d.kind === "average") {
		var avg = average(text);
		return avg === null ? r.text : rules().formatNumber(wiki,avg,0) + " (" + r.text + ")";
	}
	if(d.kind === "total" && r.value !== undefined) {
		var total = r.value,
			shown = [r.text];
		(d.parts || []).forEach(function(p) {
			var n = part(wiki,fields,p,null,0);
			if(n) {
				total += n;
				shown.push((n < 0 ? "- " : "+ ") + rules().formatNumber(wiki,Math.abs(n),2));
			}
		});
		return shown.length === 1 ? r.text : (/^[+\-−]/.test(text) ? signed(wiki,total) : rules().formatNumber(wiki,total,2)) + " (" + shown.join(" ") + ")";
	}
	return r.text;
}

// The average of a dice expression ("2d6 + 2" -> 9, rounded down), or null
var average = exports.average = function(text) {
	var expr = text.replace(/\s+/g,""),
		re = /([+\-−]?)(\d*)[dDwW](\d+)|([+\-−]?)(\d+)/g,
		total = 0,
		matched = "",
		m;
	if(!/\d/.test(expr)) {
		return null;
	}
	while((m = re.exec(expr))) {
		matched += m[0];
		if(m[3]) {
			var sign = m[1] === "-" || m[1] === "−" ? -1 : 1;
			total += sign * (m[2] ? parseInt(m[2],10) : 1) * (parseInt(m[3],10) + 1) / 2;
		} else {
			total += (m[4] === "-" || m[4] === "−" ? -1 : 1) * parseInt(m[5],10);
		}
	}
	return matched.length === expr.length ? Math.floor(total) : null;
};

/*
The value of a field of a tiddler: {text, problem, values, written, derived, items}. Written: read
by its format, with what derives beside it; empty: what it derives, if anything. A labels field
shows the derived values of its entries without a written one and its computed entries.
*/
exports.read = function(wiki,fields,field) {
	var s = spec(wiki,field),
		text = raw(fields,field);
	if(!s) {
		return {text: text, problem: null, values: {}, written: !!text, derived: false};
	}
	if(!text) {
		var n = s.derive ? compute(wiki,fields,s.derive,null,0) : null;
		if(n === null && s.computed) {
			text = "";
		} else {
			return n === null ? {text: "", problem: null, values: {}, written: false, derived: false} :
				{text: numberText(wiki,s,n), problem: null, values: {}, written: false, derived: true};
		}
	}
	var r = rules().value(wiki,s,text);
	if(s.format === "labels" && !r.problem && (s.value && s.value.derive || s.computed)) {
		var items = (r.items || []).map(function(item) {
			var shown = item.valueText;
			if(item.value === undefined && s.value && s.value.derive) {
				var n2 = entryValue(wiki,fields,field,item.id,0);
				shown = n2 === null ? undefined : numberText(wiki,s.value,n2);
			}
			return {id: item.id, domain: item.domain, text: shown};
		});
		$tw.utils.each(s.computed || {},function(derive,id) {
			if(!items.some(function(item) { return item.id === id; })) {
				var domains = language.domains(wiki),
					domain = domains[$tw.utils.isArray(s.domain) ? s.domain[0] : s.domain],
					entry = domain && (domain.entries || []).filter(function(e) { return e.id === id; })[0],
					n3 = entry ? compute(wiki,fields,derive,{id: id, entry: entry},0) : null;
				if(n3 !== null) {
					items.push({id: id, domain: domain, text: numberText(wiki,(s.values && s.values[id]) || s.value || {},n3)});
				}
			}
		});
		var labels = require("$:/plugins/tiddlyrpg-core/modules/labels.js");
		r = {text: items.map(function(item) {
			return labels.shown(wiki,item.domain,(item.domain.entries || []).filter(function(e) { return e.id === item.id; })[0] || {id: item.id},item.text);
		}).join(", "), problem: null, values: {}, items: r.items};
	} else {
		r = {text: beside(wiki,s,r,text,fields,field), problem: r.problem, values: r.values, items: r.items, tag: r.tag};
	}
	r.written = !!raw(fields,field);
	r.derived = !r.written && !!r.text;
	return r;
};

// Whether a "when" holds: every field it names holds one of its values (an id of a list counts);
// a field the schema of the tiddler does not have (schemaFields, optional) sets no condition -
// damage on a weapon only, on a spell always
var fits = exports.fits = function(wiki,fields,when,schemaFields) {
	if(!when) {
		return true;
	}
	return Object.keys(when).every(function(field) {
		if(schemaFields && schemaFields.indexOf(field) === -1) {
			return true;
		}
		var wanted = [].concat(when[field]),
			s = spec(wiki,field),
			text = raw(fields,field),
			r = s && (s.format === "labels" || s.format === "label") && rules().value(wiki,s,text),
			ids = r && r.items ? r.items.map(function(item) { return item.id; }) : (r && r.id ? [r.id] : [text]);
		return ids.some(function(id) { return wanted.indexOf(id) !== -1; });
	});
};

/*
The header line of a schema ("1st-level abjuration (ritual)"): its key (or one of byValue for the
value a field holds) with $field$ (the text of a field), $field.ordinal$ (Rules/Ordinal/<value>,
else the value) and $field.flag$ (the key of flags when the field is yes, else nothing). Empty
when a field it needs is empty.
*/
var PLACEHOLDER = /\$([a-zA-Z0-9_-]+)(?:\.(ordinal|flag))?\$/g;

// The fields a pattern names
function named(pattern) {
	var out = [],
		m;
	PLACEHOLDER.lastIndex = 0;
	while((m = PLACEHOLDER.exec(pattern))) {
		if(out.indexOf(m[1]) === -1) {
			out.push(m[1]);
		}
	}
	return out;
}

/*
A pattern of the ruleset filled with the values of a tiddler: $field$ (the text of a field),
$field.ordinal$ (Rules/Ordinal/<value>, else the value), $field.flag$ (the key flags[field] when
the field is yes). A part in {...} falls away when a field in it is empty (or a flag no); a field
outside braces that is empty empties the whole. Returns the text, "" if nothing.
*/
var fill = exports.fill = function(wiki,fields,key,flags) {
	var pattern = language.lookupGroup(wiki,"ruleset",key);
	if(!pattern) {
		return "";
	}
	var missing = false;
	var part = function(text) {
		var empty = false;
		var out = text.replace(PLACEHOLDER,function(all,field,how) {
			var value = raw(fields,field);
			if(how === "flag") {
				var yes = value && rules().value(wiki,{format: "boolean"},value).value,
					shown = yes && flags && flags[field] ? language.lookupGroup(wiki,"ruleset",flags[field]) || "" : "";
				empty = empty || !shown;
				return shown;
			}
			// A value written or derived ("1/4 (50 XP)": xp from cr)
			var shownText = how === "ordinal" ? (value ? language.lookupGroup(wiki,"ruleset","Rules/Ordinal/" + value) || value : "") :
				exports.read(wiki,fields,field).text;
			empty = empty || !shownText;
			return shownText;
		});
		return {text: out, empty: empty};
	};
	var text = pattern.split(/(\{[^{}]*\})/).map(function(piece) {
		if(piece.charAt(0) === "{" && piece.charAt(piece.length - 1) === "}") {
			var optional = part(piece.slice(1,-1));
			return optional.empty ? "" : optional.text;
		}
		var required = part(piece);
		missing = missing || (required.empty && named(piece).length > 0);
		return required.text;
	}).join("");
	return missing ? "" : text.replace(/\s+/g," ").trim();
};

/*
The header line of a schema ("1st-level abjuration (ritual)", "Martial weapon (melee), rare
(requires attunement)"): fill() of its key, or of byValue's key for the value a field holds, or
of ifSet's while a field holds anything.
Returns {text, fields}: the fields it names, which the block does not show again.
*/
exports.summary = function(wiki,fields,schema) {
	var sum = schema && schema.summary;
	if(!sum || !sum.key) {
		return {text: "", fields: []};
	}
	var key = sum.key;
	$tw.utils.each(sum.byValue || {},function(map,field) {
		var value = raw(fields,field);
		if(map[value]) {
			key = map[value];
		}
	});
	// A key of its own while a field holds anything (a swarm: "Medium swarm of Tiny beasts")
	$tw.utils.each(sum.ifSet || {},function(other,field) {
		if(raw(fields,field)) {
			key = other;
		}
	});
	var text = fill(wiki,fields,key,sum.flags),
		used = named(language.lookupGroup(wiki,"ruleset",key) || "");
	Object.keys(sum.byValue || {}).forEach(function(field) {
		if(used.indexOf(field) === -1) {
			used.push(field);
		}
	});
	return text ? {text: text, fields: used} : {text: "", fields: []};
};

/*
A line that joins fields (a "combine" of a group: {"fields": ["cr", "xp"], "key":
"Rules/Line/challenge", "flags": {...}}): fill() of its key - "1/4 (50 XP)", "Concentration, up to
1 minute".
*/
exports.line = function(wiki,fields,combine) {
	return fill(wiki,fields,combine.key,combine.flags);
};

// The fields secret-fields locks: null (none), "all" (present but empty, or "all") or a list
exports.locked = function(fields) {
	return require("$:/plugins/tiddlyrpg-core/modules/visibility.js").parseLock(fields["secret-fields"]);
};

/*
The values to copy from a source (the fields of a base item, of a tiddler or of an entry of a
content package) into a draft: every field of the draft's schema that the draft has empty and the
source has, never price; a field the source locks comes with its lock (secret-fields of the
draft). Returns {field: value}.
*/
exports.copyFrom = function(wiki,draft,source) {
	var schema = forTypes(wiki,types.of(wiki,draft.title)),
		out = {},
		lock = exports.locked(source),
		draftLock = exports.locked(draft),
		locks = [];
	schema.fields.forEach(function(field) {
		var value = raw(source,field);
		if(field !== "price" && value && !raw(draft,field)) {
			out[field] = value;
			if(lock === "all" || (lock && lock.indexOf(field) !== -1)) {
				locks.push(field);
			}
		}
	});
	if(locks.length && draftLock !== "all") {
		var list = (draftLock || []).slice();
		locks.forEach(function(field) {
			if(list.indexOf(field) === -1) {
				list.push(field);
			}
		});
		out["secret-fields"] = $tw.utils.stringifyList(list);
	}
	return out;
};

// The problems of rules.value() that name the field; the others are written for the macros
var OWN = ["Label","Only","TraitParent","TraitTwice","Number","NumberRange","Boolean","Dice","UnitDomain"].map(function(name) {
	return "Rules/Check/" + name;
});

/*
The problem of a written value of a field (rule fields/value, the reading in the editor):
{level, key, params} or null - the problem of its format, naming the field, else
Check/Fields/Value; a trait that fits two main entries is a hint.
*/
exports.problem = function(wiki,fields,field,labels) {
	var s = spec(wiki,field),
		text = raw(fields,field);
	if(!s || !text) {
		return null;
	}
	var r = rules().value(wiki,s,text),
		name = label(wiki,field,labels);
	if(!r.problem) {
		return null;
	}
	if(OWN.indexOf(r.problem) !== -1) {
		return {level: r.problem === "Rules/Check/TraitTwice" ? "hint" : "error", key: r.problem,
			params: $tw.utils.extend({},r.values,{field: name})};
	}
	return {level: "error", key: "Check/Fields/Value", params: {field: name, text: text}};
};

// The problems of the schemas: reserved names, fields defined twice or without definition
exports.problems = function(wiki) {
	return registry(wiki).problems;
};
