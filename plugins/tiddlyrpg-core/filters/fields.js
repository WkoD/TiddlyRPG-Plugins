/*\
title: $:/plugins/tiddlyrpg-core/filters/fields.js
type: application/javascript
module-type: filteroperator
created: 20261022142450275
modified: 20261022144503108

The fields of the rules of a tiddler (modules/fields.js) for the block of values
(viewtemplates/fields). A field is shown when it has a text - written or derived -, its "when"
holds, and the header line does not name it already.

[<title>trpgfieldsummary[]]          the header line of each input, if any
[<title>trpgfieldlist[]]             the fields shown outside the groups, in the order of the schema
[<title>trpgfieldlist[<group>]]      the fields shown in a group
[<title>trpgfieldgroups[]]           the groups with a field shown or a relation to a tiddler the
                                     view sees, whose "when" holds
[<title>trpgfieldgroup:label[<id>]]  the label of a group (Rules/Group/<id>); :layout row or list;
                                     :relations the relations it shows
[<title>trpgfieldshow[<field>]]      the text of a field
[<title>trpgfieldparts[<field>]]     the parts of a list (labels), each a pill; else the text
[<title>trpgfieldlabel[<field>]]     the label of a field, by the schema of the tiddler
[<field>trpgfieldformat[]]           the format of each input field (its definition)
[<title>trpgfieldcolor[]]            the colour of its first type that has one

\*/

"use strict";

var fields = require("$:/plugins/tiddlyrpg-core/modules/fields.js"),
	types = require("$:/plugins/tiddlyrpg-core/modules/types.js"),
	language = require("$:/plugins/tiddlyrpg-core/modules/language.js"),
	visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js");

function valuesOf(wiki,title) {
	var tiddler = wiki.getTiddler(title);
	return tiddler ? $tw.utils.extend({},tiddler.fields) : {title: title};
}

// What a tiddler shows: {schema, values, summary, shown(field)}
function state(wiki,title) {
	var schema = fields.forTiddler(wiki,title),
		values = valuesOf(wiki,title),
		summary = fields.summary(wiki,values,schema);
	return {
		schema: schema,
		values: values,
		summary: summary,
		shown: function(field) {
			var spec = fields.spec(wiki,field);
			return schema.fields.indexOf(field) !== -1 && summary.fields.indexOf(field) === -1 &&
				fields.fits(wiki,values,spec && spec.when,schema.fields) && !!fields.read(wiki,values,field).text;
		}
	};
}

function each(source,fn) {
	var results = [];
	source(function(tiddler,title) {
		Array.prototype.push.apply(results,fn(title));
	});
	return results;
}

function grouped(schema) {
	var out = [];
	schema.groups.forEach(function(group) {
		out = out.concat(group.fields || []);
	});
	return out;
}

exports.trpgfieldsummary = function(source,operator,options) {
	return each(source,function(title) {
		var text = state(options.wiki,title).summary.text;
		return text ? [text] : [];
	});
};

exports.trpgfieldlist = function(source,operator,options) {
	var id = operator.operand;
	return each(source,function(title) {
		var s = state(options.wiki,title),
			group = id ? s.schema.groups.filter(function(g) { return g.id === id; })[0] : null,
			list = id ? (group ? group.fields || [] : []) : s.schema.fields.filter(function(field) {
				return grouped(s.schema).indexOf(field) === -1;
			});
		return list.filter(s.shown);
	});
};

// Whether a relation of a tiddler names a tiddler the view sees
function related(wiki,values,name) {
	var view = visibility.current(wiki);
	return ($tw.utils.parseStringArray(values[name] || "") || []).some(function(target) {
		return visibility.visible(wiki,target,view);
	});
}

exports.trpgfieldgroups = function(source,operator,options) {
	return each(source,function(title) {
		var s = state(options.wiki,title);
		return s.schema.groups.filter(function(group) {
			return fields.fits(options.wiki,s.values,group.when,s.schema.fields) && ((group.fields || []).some(s.shown) ||
				(group.relations || []).some(function(name) { return related(options.wiki,s.values,name); }));
		}).map(function(group) { return group.id; });
	});
};

exports.trpgfieldgroup = function(source,operator,options) {
	var what = operator.suffix || "label",
		id = operator.operand;
	return each(source,function(title) {
		var group = fields.forTiddler(options.wiki,title).groups.filter(function(g) { return g.id === id; })[0];
		if(!group) {
			return [];
		}
		if(what === "relations") {
			return group.relations || [];
		}
		return [what === "layout" ? (group.layout || "list") : (language.lookupGroup(options.wiki,"ruleset","Rules/Group/" + id) || id)];
	});
};

exports.trpgfieldshow = function(source,operator,options) {
	return each(source,function(title) {
		var text = fields.read(options.wiki,valuesOf(options.wiki,title),operator.operand).text;
		return text ? [text] : [];
	});
};

exports.trpgfieldparts = function(source,operator,options) {
	return each(source,function(title) {
		var spec = fields.spec(options.wiki,operator.operand),
			r = fields.read(options.wiki,valuesOf(options.wiki,title),operator.operand);
		if(!r.text) {
			return [];
		}
		// Entries part at ", ", several main entries at " · " (modules/labels.js)
		return spec && spec.format === "labels" && !r.problem ? r.text.split(/, | · /) : [r.text];
	});
};

exports.trpgfieldlabel = function(source,operator,options) {
	return each(source,function(title) {
		return [fields.label(options.wiki,operator.operand,fields.forTiddler(options.wiki,title).labels)];
	});
};

exports.trpgfieldformat = function(source,operator,options) {
	return each(source,function(field) {
		var spec = fields.spec(options.wiki,field);
		return spec && spec.format ? [spec.format] : [];
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
