/*\
title: $:/plugins/tiddlyrpg-core/checks/fields.js
type: application/javascript
module-type: trpg-check
created: 20261022140929737
modified: 20261022142450275

Checks of the fields of the rules (modules/fields.js; modules/checks.js runs them).

  fields/schema   error: a definition with a name the core or a relation uses, a field defined
                  twice (the ruleset and the wiki, or two tiddlers), a schema that lists a field
                  without definition
  fields/value    error: a written value its format does not read (rules.value(): the problem of
                  the format, else Check/Fields/Value); hint: a trait that fits two main entries
  fields/when     hint: a written value of a field whose "when" does not hold (damage on a potion)

Only the fields of the schema of the tiddler, only what is written - a derived value is no
problem of the tiddler.

\*/

"use strict";

var fields = require("$:/plugins/tiddlyrpg-core/modules/fields.js"),
	rules = require("$:/plugins/tiddlyrpg-core/modules/rules.js");

// The problems of rules.value() that name the field; the others are written for the macros
var OWN = ["Label","Only","TraitParent","TraitTwice","Number","NumberRange","Boolean","Dice","UnitDomain"].map(function(name) {
	return "Rules/Check/" + name;
});

// The written fields of the schema of a tiddler: [{field, spec, text, label, fields, schema}]
function written(wiki,title) {
	var tiddler = wiki.getTiddler(title),
		schema = tiddler ? fields.forTiddler(wiki,title) : null;
	if(!schema) {
		return [];
	}
	return schema.fields.filter(function(field) {
		var value = tiddler.fields[field];
		return value !== undefined && value.toString().trim() !== "";
	}).map(function(field) {
		return {field: field, spec: fields.spec(wiki,field), text: tiddler.fields[field].toString().trim(),
			label: fields.label(wiki,field,schema.labels), fields: tiddler.fields, schema: schema.fields};
	});
}

exports.rules = [
	{
		id: "fields/schema",
		scope: "wiki",
		run: function(wiki) {
			return fields.problems(wiki).map(function(problem) {
				return {title: problem.title, level: "error", key: problem.key, params: problem.params};
			});
		}
	},
	{
		id: "fields/value",
		run: function(wiki,title) {
			var messages = [];
			written(wiki,title).forEach(function(w) {
				var r = rules.value(wiki,w.spec,w.text);
				if(!r.problem) {
					return;
				}
				if(OWN.indexOf(r.problem) !== -1) {
					messages.push({level: r.problem === "Rules/Check/TraitTwice" ? "hint" : "error", key: r.problem,
						params: $tw.utils.extend({},r.values,{field: w.label})});
				} else {
					messages.push({level: "error", key: "Check/Fields/Value", params: {field: w.label, text: w.text}});
				}
			});
			return messages;
		}
	},
	{
		id: "fields/when",
		run: function(wiki,title) {
			var messages = [];
			written(wiki,title).forEach(function(w) {
				var when = w.spec && w.spec.when;
				if(when && !fields.fits(wiki,w.fields,when,w.schema)) {
					messages.push({level: "hint", key: "Check/Fields/When", params: {field: w.label, when: Object.keys(when).map(function(name) {
						var spec = fields.spec(wiki,name);
						return fields.label(wiki,name) + ": " + [].concat(when[name]).map(function(id) {
							return spec ? rules.value(wiki,spec,id).text || id : id;
						}).join(", ");
					}).join("; ")}});
				}
			});
			return messages;
		}
	}
];
