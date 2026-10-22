/*\
title: $:/plugins/tiddlyrpg-core/filters/fields.js
type: application/javascript
module-type: filteroperator
created: 20261022142450275
modified: 20261022150508705

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

\*/

"use strict";

var fields = require("$:/plugins/tiddlyrpg-core/modules/fields.js"),
	types = require("$:/plugins/tiddlyrpg-core/modules/types.js"),
	language = require("$:/plugins/tiddlyrpg-core/modules/language.js"),
	currency = require("$:/plugins/tiddlyrpg-core/modules/currency.js"),
	visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js");

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
