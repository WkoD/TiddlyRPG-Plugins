/*\
title: $:/plugins/tiddlyrpg-core/filters/fields.js
type: application/javascript
module-type: filteroperator
created: 20261022142450275
modified: 20261022160104767

The block of values of a tiddler (viewtemplates/fields), laid out like the stat block of a
rulebook: the header line, then sections - the fields of no group (with the price, unless a group
names "price"), then the groups of the schema (modules/fields.js). A line is a field, or the first
field of a combine standing for all of its fields. A line shows when it has a text - written or
derived -, its "when" holds, the field is shown in the view at all ("view": false is not) and the
header line does not name it already.

[<title>trpgfieldsummary[]]            the header line of each input, if any
[<title>trpgfieldsections[]]           the sections with a line to show or a relation to a tiddler
                                       the view sees: "-" (the fields of no group), then group ids
[<title>trpgfieldlines[<section>]]     the lines of a section, each by its (first) field; "price"
                                       is the price
[<title>trpgfieldsection:layout[<id>]] list, row or inline; :relations the relations it shows
[<title>trpgfieldshow[<field>]]        the text of a line: a combine filled, the price formatted
[<title>trpgfieldlabel[<field>]]       the label of a field, by the schema of the tiddler
[<title>trpgfieldcolor[]]              the colour of its first type that has one

The editor of a field of the rules (editor/fields/rules), for a draft:
[<field>trpgfieldinput[]]              boolean (a checkbox), select (one entry of a domain), pills (a
                                       list of entries without values) or text
[<draft>trpgfieldchoices<field>]       the ids to choose: the entries that stand alone (in "only");
                                       for pills also the traits whose parent is in the field
[<id>trpgfieldchoice<field>]           the label of each input id
[<draft>trpgfieldchosen<field>]        the ids the field holds
[<draft>trpgfieldtoggle<field>,<id>]   the value of the field with <id> added or taken out
[<draft>trpgfieldreading<field>]       the reading below the input: "Output: ..." of a value, the
                                       derived value of an empty field; :problem the problem

\*/

"use strict";

var fields = require("$:/plugins/tiddlyrpg-core/modules/fields.js"),
	types = require("$:/plugins/tiddlyrpg-core/modules/types.js"),
	language = require("$:/plugins/tiddlyrpg-core/modules/language.js"),
	currency = require("$:/plugins/tiddlyrpg-core/modules/currency.js"),
	visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js"),
	labels = require("$:/plugins/tiddlyrpg-core/modules/labels.js"),
	rules = require("$:/plugins/tiddlyrpg-core/modules/rules.js");

var PRICE = "price",
	REST = "-";

function valuesOf(wiki,title) {
	var tiddler = wiki.getTiddler(title);
	return tiddler ? $tw.utils.extend({},tiddler.fields) : {title: title};
}

function each(source,fn) {
	var results = [];
	source(function(tiddler,title) {
		Array.prototype.push.apply(results,fn(title));
	});
	return results;
}

// What a tiddler shows: {schema, values, summary, sections: [{id, layout, lines, relations}]}
function state(wiki,title) {
	var schema = fields.forTiddler(wiki,title),
		values = valuesOf(wiki,title),
		summary = fields.summary(wiki,values,schema),
		combineOf = function(field) {
			var found = null;
			schema.groups.some(function(group) {
				return (group.combine || []).some(function(c) {
					if((c.fields || []).indexOf(field) !== -1) {
						found = c;
					}
					return !!found;
				});
			});
			return found;
		};
	var shows = function(field) {
		if(field === PRICE) {
			return !!values.price;
		}
		var spec = fields.spec(wiki,field),
			combine = combineOf(field);
		if(schema.fields.indexOf(field) === -1 || summary.fields.indexOf(field) !== -1 || (spec && spec.view === false) ||
			!fields.fits(wiki,values,spec && spec.when,schema.fields)) {
			return false;
		}
		if(combine) {
			return combine.fields[0] === field && !!fields.line(wiki,values,combine);
		}
		return !!fields.read(wiki,values,field).text;
	};
	var grouped = [];
	schema.groups.forEach(function(group) {
		grouped = grouped.concat(group.fields || []);
	});
	var rest = (grouped.indexOf(PRICE) === -1 ? [PRICE] : []).concat(schema.fields.filter(function(field) {
		return grouped.indexOf(field) === -1;
	}));
	var view = visibility.current(wiki);
	var sections = [{id: REST, layout: "list", lines: rest.filter(shows), relations: []}].concat(schema.groups.filter(function(group) {
		return fields.fits(wiki,values,group.when,schema.fields);
	}).map(function(group) {
		return {
			id: group.id,
			layout: group.layout || "list",
			lines: (group.fields || []).filter(shows),
			relations: (group.relations || []).filter(function(name) {
				return ($tw.utils.parseStringArray(values[name] || "") || []).some(function(target) {
					return visibility.visible(wiki,target,view);
				});
			})
		};
	})).filter(function(section) {
		return section.lines.length || section.relations.length;
	});
	return {schema: schema, values: values, summary: summary, sections: sections, combineOf: combineOf};
}

function section(s,id) {
	return s.sections.filter(function(sec) { return sec.id === id; })[0] || null;
}

exports.trpgfieldsummary = function(source,operator,options) {
	return each(source,function(title) {
		var text = state(options.wiki,title).summary.text;
		return text ? [text] : [];
	});
};

exports.trpgfieldsections = function(source,operator,options) {
	return each(source,function(title) {
		return state(options.wiki,title).sections.map(function(sec) { return sec.id; });
	});
};

exports.trpgfieldlines = function(source,operator,options) {
	return each(source,function(title) {
		var sec = section(state(options.wiki,title),operator.operand || REST);
		return sec ? sec.lines : [];
	});
};

exports.trpgfieldsection = function(source,operator,options) {
	return each(source,function(title) {
		var sec = section(state(options.wiki,title),operator.operand);
		if(!sec) {
			return [];
		}
		return operator.suffix === "relations" ? sec.relations : [sec.layout];
	});
};

exports.trpgfieldshow = function(source,operator,options) {
	var field = operator.operand;
	return each(source,function(title) {
		var wiki = options.wiki,
			values = valuesOf(wiki,title),
			text;
		if(field === PRICE) {
			text = values.price ? currency.format(wiki,currency.active(wiki),values.price) : "";
		} else {
			var combine = state(wiki,title).combineOf(field);
			text = combine ? fields.line(wiki,values,combine) : fields.read(wiki,values,field).text;
		}
		return text ? [text] : [];
	});
};

exports.trpgfieldlabel = function(source,operator,options) {
	return each(source,function(title) {
		if(operator.operand === PRICE) {
			return [language.t(options.wiki,"Item/Price")];
		}
		return [fields.label(options.wiki,operator.operand,fields.forTiddler(options.wiki,title).labels)];
	});
};

exports.trpgfieldcolor = function(source,operator,options) {
	return each(source,function(title) {
		var colour = "";
		types.of(options.wiki,title).some(function(type) {
			var tiddler = options.wiki.getTiddler(type);
			colour = tiddler && tiddler.fields.color || "";
			return !!colour;
		});
		return colour ? [colour] : [];
	});
};

/* The editor */

// The label domains of a definition
function domainsOf(wiki,spec) {
	var all = language.domains(wiki);
	return [].concat(spec && spec.domain || []).map(function(name) { return all[name]; }).filter(function(d) {
		return d && (d.type === "label" || d.type === "damage");
	});
}

var inputOf = function(wiki,field) {
	var spec = fields.spec(wiki,field);
	if(!spec) {
		return "text";
	}
	if(spec.format === "boolean") {
		return "boolean";
	}
	if(spec.format === "label" && domainsOf(wiki,spec).length === 1) {
		return "select";
	}
	if(spec.format === "labels" && !spec.value && !spec.values && domainsOf(wiki,spec).length) {
		return "pills";
	}
	return "text";
};

// The parts of the value of a list and the id each one reads as (null if none)
function partsOf(wiki,spec,text) {
	return (text || "").split(",").map(function(part) { return part.trim(); }).filter(Boolean).map(function(part) {
		var r = rules.value(wiki,{format: "label", domain: spec.domain},part);
		return {text: part, id: r.problem ? null : r.id};
	});
}

exports.trpgfieldinput = function(source,operator,options) {
	return each(source,function(field) {
		return [inputOf(options.wiki,field)];
	});
};

exports.trpgfieldchoices = function(source,operator,options) {
	var wiki = options.wiki,
		field = operator.operand,
		spec = fields.spec(wiki,field);
	return each(source,function(title) {
		if(!spec) {
			return [];
		}
		var chosen = partsOf(wiki,spec,valuesOf(wiki,title)[field]).map(function(p) { return p.id; }),
			out = [];
		domainsOf(wiki,spec).forEach(function(domain) {
			(domain.entries || []).forEach(function(entry) {
				var alone = labels.standsAlone(entry),
					fits = spec.format === "labels" && (entry.for || []).some(function(parent) { return chosen.indexOf(parent) !== -1; });
				if((alone || fits) && (!spec.only || spec.only.indexOf(entry.id) !== -1) && out.indexOf(entry.id) === -1) {
					out.push(entry.id);
				}
			});
		});
		return out;
	});
};

exports.trpgfieldchoice = function(source,operator,options) {
	var wiki = options.wiki,
		domains = domainsOf(wiki,fields.spec(wiki,operator.operand));
	return each(source,function(id) {
		var domain = domains.filter(function(d) {
			return (d.entries || []).some(function(e) { return e.id === id; });
		})[0];
		return [domain ? labels.labelOf(wiki,domain,id) : id];
	});
};

exports.trpgfieldchosen = function(source,operator,options) {
	var wiki = options.wiki,
		spec = fields.spec(wiki,operator.operand);
	return each(source,function(title) {
		return spec ? partsOf(wiki,spec,valuesOf(wiki,title)[operator.operand]).map(function(p) { return p.id; }).filter(Boolean) : [];
	});
};

// Toggled: the parts that read as <id> go, else <id> comes at the end; what cannot be read stays
exports.trpgfieldtoggle = function(source,operator,options) {
	var wiki = options.wiki,
		field = operator.operands[0],
		id = operator.operands[1],
		spec = fields.spec(wiki,field);
	return each(source,function(title) {
		var parts = spec ? partsOf(wiki,spec,valuesOf(wiki,title)[field]) : [],
			kept = parts.filter(function(p) { return p.id !== id; });
		if(kept.length === parts.length) {
			kept.push({text: id});
		}
		return [kept.map(function(p) { return p.text; }).join(", ")];
	});
};

exports.trpgfieldreading = function(source,operator,options) {
	var wiki = options.wiki,
		field = operator.operand;
	return each(source,function(title) {
		var values = valuesOf(wiki,title),
			schema = fields.forTiddler(wiki,title),
			written = (values[field] || "").toString().trim() !== "";
		if(operator.suffix === "problem") {
			var problem = written ? fields.problem(wiki,values,field,schema.labels) : null;
			return problem ? [language.format(language.t(wiki,problem.key),problem.params)] : [];
		}
		var r = fields.read(wiki,values,field);
		if(!r.text || (written && r.problem)) {
			return [];
		}
		return [language.format(language.t(wiki,written ? "Editor/Field/Output" : "Editor/Field/Derived"),{value: r.text})];
	});
};
