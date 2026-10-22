/*\
title: $:/plugins/tiddlyrpg-core/modules/inverse.js
type: application/javascript
module-type: library
created: 20261022171029770
modified: 20261022171029770

The way back of a relation in the form of its target: a relation whose config has
tiddlyrpg-inverse: yes (owner) offers a row in the form of a tiddler it may name (a person: "give
an item") - the field lives on the other end, so the draft holds the chosen ones in the field
FIELD<name> until it is saved; then each of them gets the title of the saved tiddler in its field
<name> (one that holds one entry for its type is replaced, modules/form.js single), and the
field goes from the saved tiddler (startup/inverse.js, hook th-saving-tiddler). Cancelling
changes nothing. The candidates: tiddlyrpg-sources of the config (what may carry the field) and
the offers of the content packages of those types - one chosen is taken at once.

  FIELD                       the prefix of the field on the draft
  relations(wiki,title)       the relations with a way back in the form of <title>
  sources(wiki,name)          the titles that may carry <name>, with the offers of the packages
  apply(wiki,fields)          writes the chosen ones of a tiddler being saved: {fields (without
                              the fields FIELD*), changed (the titles written)}

\*/

"use strict";

var relations = require("$:/plugins/tiddlyrpg-core/modules/relations.js"),
	types = require("$:/plugins/tiddlyrpg-core/modules/types.js");

var FIELD = exports.FIELD = "trpg-inverse-";

function list(value) {
	return $tw.utils.parseStringArray(value || "") || [];
}

// The tags a filter of candidates names ("[tag[Person]] [tag[Player]]")
function tagsOf(filter) {
	var out = [],
		re = /tag\[([^\]]+)\]/g,
		m;
	while(filter && (m = re.exec(filter))) {
		out.push(m[1]);
	}
	return out;
}

function config(wiki,name) {
	var type = relations.types(wiki)[name];
	return type ? (wiki.getTiddler(type.config) || {fields: {}}).fields : {};
}

exports.relations = function(wiki,title) {
	var own = types.of(wiki,title),
		all = relations.types(wiki);
	return relations.ordered(wiki).filter(function(name) {
		var fields = config(wiki,name);
		return all[name].kind === "field" && fields["tiddlyrpg-inverse"] === "yes" &&
			tagsOf(all[name].candidates).some(function(tag) { return own.indexOf(tag) !== -1; });
	});
};

exports.sources = function(wiki,name) {
	var filter = config(wiki,name)["tiddlyrpg-sources"] || "",
		out = wiki.filterTiddlers(filter).filter(function(title) {
			var tiddler = wiki.getTiddler(title);
			return !(tiddler && tiddler.isDraft());
		}),
		tags = tagsOf(filter),
		content = require("$:/plugins/tiddlyrpg-core/modules/content.js");
	content.offers(wiki).forEach(function(o) {
		if(tags.indexOf(o.type) !== -1 && out.indexOf(o.title) === -1) {
			out.push(o.title);
		}
	});
	return out;
};

exports.apply = function(wiki,fields) {
	var form = require("$:/plugins/tiddlyrpg-core/modules/form.js"),
		title = fields.title,
		out = $tw.utils.extend({},fields),
		changed = [];
	Object.keys(fields).forEach(function(key) {
		if(key.indexOf(FIELD) !== 0) {
			return;
		}
		var name = key.substr(FIELD.length);
		delete out[key];
		list(fields[key]).forEach(function(source) {
			var tiddler = wiki.getTiddler(source);
			if(!tiddler) {
				return;
			}
			var entries = list(tiddler.fields[name]);
			if(entries.indexOf(title) !== -1) {
				return;
			}
			entries = form.single(wiki,source,name) ? [title] : entries.concat([title]);
			var change = {};
			change[name] = $tw.utils.stringifyList(entries);
			wiki.addTiddler(new $tw.Tiddler(tiddler,change,wiki.getModificationFields()));
			changed.push(source);
		});
	});
	return {fields: out, changed: changed};
};
