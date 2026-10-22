/*\
title: $:/plugins/tiddlyrpg-core/filters/content.js
type: application/javascript
module-type: filteroperator
created: 20261022165648795
modified: 20261022184441974

The offers of the content packages (modules/content.js) for the templates:

[trpgcontentready[]]               "yes" if a package of the active ruleset is loaded (the
                                   condition trpg.content of every part of the packages)
[<title>trpgcontentfor[]]          the ids of the offers titled like each input
[trpgcontentids[]]                 the ids of every offer, in the order of the packages
[<text>trpgcontentsearch[]]        the ids of the offers whose title contains the text (any
                                   case), at most 30 - the group of the search
[<title>trpgwikilink[]]            "[[<title>]]" (a filter cannot write "]]")
[<field>relationcontent[]]         the titles of the offers a relation field may name: their type
                                   one of the tags its tiddlyrpg-targets names (the pickers)
[<id>trpgcontentoffer[title]]      a property of each entry: title (taken or to take), type,
                                   package (its name), language, taken ("yes"), summary (its
                                   header line by the schema of its type); nothing for an offer
                                   that is no more (operand empty: the id if it is an offer)

The hub Content (a state tiddler with the fields type, page and filter-<field>; the search in the
text of <state>/search):
[trpgcontenttypes[]]               the types the entries have, in their order
[trpgcontentlist[<state>]]         the ids of the page of the list: of the type, the title
                                   containing the search (any case), every filter-<field> of a
                                   field of the type an id its value holds (one set for another
                                   type does not count); PAGE entries a page. :count the number of
                                   them, :pages the number of pages, :page the page shown
[<type>trpgcontentfilters[]]       the fields of the schema of the type that filter: one or a list
                                   of entries of a domain, with a value in an entry of the type
[<field>trpgcontentvalues<type>]   the ids its values hold in the entries of the type, in the
                                   order of the domain

\*/

"use strict";

var content = require("$:/plugins/tiddlyrpg-core/modules/content.js"),
	fields = require("$:/plugins/tiddlyrpg-core/modules/fields.js"),
	rules = require("$:/plugins/tiddlyrpg-core/modules/rules.js"),
	language = require("$:/plugins/tiddlyrpg-core/modules/language.js");

var PAGE = 50;

function each(source,fn) {
	var results = [];
	source(function(tiddler,title) {
		Array.prototype.push.apply(results,fn(title));
	});
	return results;
}

exports.trpgcontentready = function(source,operator,options) {
	return content.packages(options.wiki).some(function(p) { return (p.entries || []).length; }) ? ["yes"] : [];
};

exports.trpgcontentfor = function(source,operator,options) {
	return each(source,function(title) {
		return content.find(options.wiki,title).map(function(o) { return o.id; });
	});
};

exports.trpgcontentsearch = function(source,operator,options) {
	return each(source,function(text) {
		text = text.trim().toLowerCase();
		return text ? content.offers(options.wiki).filter(function(o) {
			return o.title.toLowerCase().indexOf(text) !== -1;
		}).slice(0,30).map(function(o) { return o.id; }) : [];
	});
};

exports.trpgwikilink = function(source,operator,options) {
	return each(source,function(title) {
		return ["[[" + title + "]]"];
	});
};

exports.relationcontent = function(source,operator,options) {
	var wiki = options.wiki,
		all = require("$:/plugins/tiddlyrpg-core/modules/relations.js").types(wiki);
	return each(source,function(field) {
		var type = all[field],
			tags = [],
			re = /tag\[([^\]]+)\]/g,
			m;
		while(type && type.candidates && (m = re.exec(type.candidates))) {
			tags.push(m[1]);
		}
		return content.offers(wiki).filter(function(o) { return tags.indexOf(o.type) !== -1; }).map(function(o) { return o.title; });
	});
};

exports.trpgcontentids = function(source,operator,options) {
	return content.offers(options.wiki).map(function(o) { return o.id; });
};

exports.trpgcontentoffer = function(source,operator,options) {
	var wiki = options.wiki,
		what = operator.operand;
	return each(source,function(id) {
		if(!what) {
			return content.offer(wiki,id) ? [id] : [];
		}
		var e = content.entryOf(wiki,id);
		if(!e) {
			return [];
		}
		switch(what) {
			case "type": return [e.type];
			case "package": return [e.package.name];
			case "language": return [e.package.language];
			case "taken": return e.taken ? ["yes"] : [];
			case "summary":
				var text = fields.summary(wiki,e.entry.fields || {},fields.forTypes(wiki,[e.type])).text;
				return text ? [text] : [];
			default: return [e.title];
		}
	});
};

// The ids a field of an entry holds (one entry or a list)
function idsOf(wiki,field,value) {
	var spec = fields.spec(wiki,field),
		r = spec && value !== undefined && value !== null && rules.value(wiki,spec,String(value));
	if(!r || r.problem) {
		return [];
	}
	return r.items ? r.items.map(function(item) { return item.id; }) : (r.id ? [r.id] : []);
}

exports.trpgcontenttypes = function(source,operator,options) {
	var out = [];
	content.entries(options.wiki).forEach(function(e) {
		if(out.indexOf(e.type) === -1) {
			out.push(e.type);
		}
	});
	return out;
};

exports.trpgcontentlist = function(source,operator,options) {
	var wiki = options.wiki,
		state = (wiki.getTiddler(operator.operand) || {fields: {}}).fields,
		search = (wiki.getTiddlerText(operator.operand + "/search") || "").trim().toLowerCase(),
		// a filter of a field the type does not have (one set for another type) does not count
		known = state.type ? fields.forTypes(wiki,[state.type]).fields : [],
		hits = content.entries(wiki).filter(function(e) {
			if(state.type && e.type !== state.type) {
				return false;
			}
			if(search && e.title.toLowerCase().indexOf(search) === -1) {
				return false;
			}
			return Object.keys(state).every(function(name) {
				if(name.indexOf("filter-") !== 0 || !state[name] || known.indexOf(name.substr(7)) === -1) {
					return true;
				}
				return idsOf(wiki,name.substr(7),(e.entry.fields || {})[name.substr(7)]).indexOf(state[name]) !== -1;
			});
		});
	if(operator.suffix === "count") {
		return [String(hits.length)];
	}
	var pages = Math.max(1,Math.ceil(hits.length / PAGE));
	if(operator.suffix === "pages") {
		return [String(pages)];
	}
	var page = Math.min(Math.max(parseInt(state.page,10) || 1,1),pages);
	if(operator.suffix === "page") {
		return [String(page)];
	}
	return hits.slice((page - 1) * PAGE,page * PAGE).map(function(e) { return e.id; });
};

exports.trpgcontentfilters = function(source,operator,options) {
	var wiki = options.wiki;
	return each(source,function(type) {
		var list = content.entries(wiki).filter(function(e) { return e.type === type; });
		return fields.forTypes(wiki,[type]).fields.filter(function(field) {
			var spec = fields.spec(wiki,field);
			return spec && (spec.format === "label" || spec.format === "labels") && spec.view !== false &&
				list.some(function(e) { return idsOf(wiki,field,(e.entry.fields || {})[field]).length; });
		});
	});
};

exports.trpgcontentvalues = function(source,operator,options) {
	var wiki = options.wiki,
		type = operator.operand;
	return each(source,function(field) {
		var found = [];
		content.entries(wiki).forEach(function(e) {
			if(e.type === type) {
				idsOf(wiki,field,(e.entry.fields || {})[field]).forEach(function(id) {
					if(found.indexOf(id) === -1) {
						found.push(id);
					}
				});
			}
		});
		var spec = fields.spec(wiki,field),
			order = [];
		[].concat(spec && spec.domain || []).forEach(function(name) {
			var domain = language.domains(wiki)[name];
			order = order.concat((domain && domain.entries || []).map(function(entry) { return entry.id; }));
		});
		return found.sort(function(a,b) { return order.indexOf(a) - order.indexOf(b); });
	});
};
