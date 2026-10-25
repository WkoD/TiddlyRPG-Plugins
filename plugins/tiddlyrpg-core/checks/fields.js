/*\
title: $:/plugins/tiddlyrpg-core/checks/fields.js
type: application/javascript
module-type: trpg-check
created: 20261022140929737
modified: 20261025191849828

Checks of the fields of the rules (modules/fields.js; modules/checks.js runs them).

  fields/schema   error: a definition with a name the core or a relation uses, a field defined
                  twice (the ruleset and the wiki, or two tiddlers), a schema that lists a field
                  without definition, a field the field list of the core does not hide
  fields/value    error: a written value its format does not read (fields.problem(): the problem
                  of the format, else Check/Fields/Value); hint: a property that fits two main
                  entries
  fields/when     hint: a written value of a field whose "when" - or that of its group - does not
                  hold (damage on a potion)
  fields/levels   a field of the format titles with "tree" and "sum" (class-levels): error when
                  it names an entry that is none of the tree without parent (a class the
                  figure does not have) or its numbers add up to more than the field "sum" (the
                  level by the XP); hint when a class of the tree has no number, or the numbers
                  add up to less ("level up due"). Nothing when it names what the view does not see
  fields/tag      hint: a main entry of a list names the category tag of the wiki it stands for
                  ("tag" in its domain: a potion is Consumable) and the tiddler lacks it; fix:
                  set the tag

Only the fields of the schema of the tiddler, only what is written - a derived value is no
problem of the tiddler -, only values the view sees (secret-fields, fields.seen()): a condition
on a locked field and a level by locked XP count as not there, so no message tells what they hold.

\*/

"use strict";

var fields = require("$:/plugins/tiddlyrpg-core/modules/fields.js"),
	rules = require("$:/plugins/tiddlyrpg-core/modules/rules.js"),
	visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js"),
	language = require("$:/plugins/tiddlyrpg-core/modules/language.js");

// The written fields of the schema of a tiddler the view sees: [{field, spec, text, label, fields,
// schema}] - fields the values the view reads (fields.seen(): without what secret-fields locks
// from it), schema the fields of the schema it sees, so a condition on a locked field counts as
// one on a field the schema lacks
function written(wiki,title,view) {
	var tiddler = wiki.getTiddler(title),
		schema = tiddler ? fields.forTiddler(wiki,title) : null;
	if(!schema) {
		return [];
	}
	var values = fields.seen(wiki,title,view),
		list = fields.lockable(wiki,title,tiddler.fields),
		seenSchema = schema.fields.filter(function(field) {
			return visibility.fieldVisible(wiki,title,field,view,list);
		});
	return seenSchema.filter(function(field) {
		var value = values[field];
		return value !== undefined && value.toString().trim() !== "";
	}).map(function(field) {
		return {field: field, spec: fields.spec(wiki,field), text: values[field].toString().trim(),
			label: fields.label(wiki,field,schema.labels), fields: values, schema: seenSchema};
	});
}

// A condition as text: "Category: weapon"
function whenText(wiki,when) {
	return Object.keys(when).map(function(name) {
		var spec = fields.spec(wiki,name);
		return fields.label(wiki,name) + ": " + [].concat(when[name]).map(function(id) {
			return spec ? rules.value(wiki,spec,id).text || id : id;
		}).join(", ");
	}).join("; ");
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
		run: function(wiki,title,view) {
			var messages = [],
				schema = fields.forTiddler(wiki,title);
			written(wiki,title,view).forEach(function(w) {
				var problem = fields.problem(wiki,w.fields,w.field,schema.labels);
				if(problem) {
					messages.push(problem);
				}
			});
			return messages;
		}
	},
	{
		id: "fields/tag",
		run: function(wiki,title,view) {
			var messages = [],
				tiddler = wiki.getTiddler(title),
				tags = (tiddler && tiddler.fields.tags || []).map(function(tag) { return language.internalTitle(wiki,tag); });
			written(wiki,title,view).forEach(function(w) {
				if(!w.spec || (w.spec.format !== "labels" && w.spec.format !== "label")) {
					return;
				}
				var r = rules.value(wiki,w.spec,w.text);
				if(!r.problem && r.tag && tags.indexOf(r.tag) === -1 && messages.every(function(m) { return m.fix.tag !== r.tag; })) {
					messages.push({level: "hint", key: "Check/Fields/Tag", params: {field: w.label, value: r.text, tag: language.title(wiki,r.tag)},
						fix: {kind: "tag", tag: r.tag}});
				}
			});
			return messages;
		}
	},
	{
		id: "fields/levels",
		run: function(wiki,title,view) {
			var messages = [],
				relations = require("$:/plugins/tiddlyrpg-core/modules/relations.js");
			written(wiki,title,view).forEach(function(w) {
				if(!w.spec || w.spec.format !== "titles" || !w.spec.tree) {
					return;
				}
				var r = rules.value(wiki,w.spec,w.text);
				if(r.problem) {
					return;
				}
				var named = (r.items || []).map(function(item) { return item.title; }),
					tops = relations.lines(wiki,w.spec.tree,title,null).map(function(line) { return line[0]; }),
					seen = function(t) { return visibility.visible(wiki,t,view); };
				if(!named.concat(tops).every(seen)) {
					return;
				}
				named.filter(function(t) { return tops.indexOf(t) === -1; }).forEach(function(t) {
					messages.push({level: "error", key: "Check/Fields/LevelsNotTree", params: {field: w.label, target: language.title(wiki,t),
						tree: language.t(wiki,"Field/" + w.spec.tree)}});
				});
				tops.filter(function(t) { return named.indexOf(t) === -1; }).forEach(function(t) {
					messages.push({level: "hint", key: "Check/Fields/LevelsMissing", params: {field: w.label, target: language.title(wiki,t)}});
				});
				if(w.spec.sum) {
					var total = (r.items || []).reduce(function(a,item) { return a + (typeof item.number === "number" ? item.number : 0); },0),
						target = fields.number(wiki,w.fields,w.spec.sum),
						other = fields.label(wiki,w.spec.sum,fields.forTiddler(wiki,title).labels);
					if(target !== null && total > target) {
						messages.push({level: "error", key: "Check/Fields/LevelsHigh", params: {field: w.label, total: total, target: target, other: other}});
					} else if(target !== null && total < target) {
						messages.push({level: "hint", key: "Check/Fields/LevelsLow", params: {field: w.label, total: total, target: target, other: other}});
					}
				}
			});
			return messages;
		}
	},
	{
		id: "fields/when",
		run: function(wiki,title,view) {
			var messages = [],
				groups = fields.forTiddler(wiki,title).groups;
			written(wiki,title,view).forEach(function(w) {
				// Its own condition, else the condition of a group it stands in
				var when = w.spec && w.spec.when;
				if(!when || fields.fits(wiki,w.fields,when,w.schema)) {
					when = null;
					groups.some(function(group) {
						if(group.when && (group.fields || []).indexOf(w.field) !== -1 && !fields.fits(wiki,w.fields,group.when,w.schema)) {
							when = group.when;
						}
						return !!when;
					});
				}
				if(when) {
					messages.push({level: "hint", key: "Check/Fields/When", params: {field: w.label, when: whenText(wiki,when)}});
				}
			});
			return messages;
		}
	}
];
