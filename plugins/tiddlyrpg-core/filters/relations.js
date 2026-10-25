/*\
title: $:/plugins/tiddlyrpg-core/filters/relations.js
type: application/javascript
module-type: filteroperator
created: 20261008062202000
modified: 20261025135015562

Filters over the relation rules (modules/relations.js). <selected> is a title list of the
relation types in play (a graph view may draw only some); empty or missing: all.

[<from>relationtargets<type>,<selected>]        targets <type> shows from <from>: the
                                                excluded ones and those another type of <from>
                                                includes left out
[<to>relationsources<type>,<selected>]          who has <to> as a shown target of <type>
[<type>relationlabel[]]                         edge label of <type> (Edge/<type>), if any
[<type>relationlabel<from>]                     the same for an edge from <from>
                                                (Edge/<type>/<its type>, else Edge/<type>)
[<type>relationaxis[]]                          config title of the axis of <type>
[<type>relationsymmetric[]]                     <type> if it is symmetric
[<type>relationtree[]]                          <type> if it is a tree (tiddlyrpg-tree)
[<type>relationfield<title>]                    the label of the field <type> on <title>
                                                (Field/<type>/<its type>, else Field/<type>)
[<hubs>relationgroups[]]                        the groups of the way back of a tree: the input hubs
                                                (trpg.kindhubs), Information split into its
                                                categories before it
[<titles>relationgroup[]]                       the group of each title (a category of
                                                Information, else the hub of its kind)
[<title>relationlines<type>]                    the entries <title> names through the tree
                                                <type> that the view sees, one line per entry
                                                without parent among them, each as a title
                                                list: top, then what belongs to it (an entry
                                                the view does not see takes its branch along)
[relationtypes[]]                               all relation types, by axis, then the rest
[relationtypes:list[]]                          those of the relation list: the fields
                                                without tags and list, the functions on an axis
[<titles>relationneighbours[]]                  what the input titles are related to, both ways,
                                                through the types of the relation list
[<titles>relationkind[]]                        the kind of each title for the filter of the
                                                relations block: player, person (deities too),
                                                organisation, location, item (artifacts and
                                                materials too), quest (a quest or rumour), else
                                                other (modules/relations.js kindOf)
[<titles>relationkind[events]]                  the same, events as a kind of their own (the
                                                kinds of the search)

\*/

"use strict";

var relations = require("$:/plugins/tiddlyrpg-core/modules/relations.js"),
	visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js");

function selection(operator,index) {
	return $tw.utils.parseStringArray((operator.operands || [])[index] || "") || [];
}

exports.relationtargets = function(source,operator,options) {
	var name = (operator.operands || [])[0] || operator.operand,
		selected = selection(operator,1),
		results = [];
	source(function(tiddler,title) {
		$tw.utils.each(relations.shown(options.wiki,name,title,selected),function(to) {
			results.push(to);
		});
	});
	return results;
};

exports.relationsources = function(source,operator,options) {
	var name = (operator.operands || [])[0] || operator.operand,
		selected = selection(operator,1),
		results = [];
	source(function(tiddler,title) {
		$tw.utils.each(relations.sources(options.wiki,name,title,selected),function(from) {
			if(results.indexOf(from) === -1) {
				results.push(from);
			}
		});
	});
	return results;
};

exports.relationlabel = function(source,operator,options) {
	var results = [];
	source(function(tiddler,title) {
		var label = relations.label(options.wiki,title,operator.operand);
		if(label) {
			results.push(label);
		}
	});
	return results;
};

exports.relationaxis = function(source,operator,options) {
	var results = [];
	source(function(tiddler,title) {
		var axis = relations.axisOf(options.wiki,title);
		if(axis) {
			results.push(axis);
		}
	});
	return results;
};

exports.relationtypes = function(source,operator,options) {
	var wiki = options.wiki,
		all = relations.types(wiki);
	return relations.ordered(wiki).filter(function(name) {
		if(operator.suffix !== "list") {
			return true;
		}
		return all[name].kind === "field" ? name !== "tags" && name !== "list" : !!all[name].axis;
	});
};

exports.relationneighbours = function(source,operator,options) {
	var wiki = options.wiki,
		all = relations.types(wiki),
		names = relations.ordered(wiki).filter(function(name) {
			return all[name].kind === "field" ? name !== "tags" && name !== "list" : !!all[name].axis;
		}),
		results = [];
	source(function(tiddler,title) {
		$tw.utils.each(names,function(name) {
			$tw.utils.each(relations.shown(wiki,name,title,[]).concat(relations.sources(wiki,name,title,[])),function(other) {
				if(other !== title && results.indexOf(other) === -1) {
					results.push(other);
				}
			});
		});
	});
	return results;
};

exports.relationkind = function(source,operator,options) {
	var wiki = options.wiki,
		events = operator.operand === "events",
		results = [];
	source(function(tiddler,title) {
		results.push(relations.kindOf(wiki,title,events));
	});
	return results;
};

exports.relationsymmetric = function(source,operator,options) {
	var all = relations.types(options.wiki),
		results = [];
	source(function(tiddler,title) {
		if(all[title] && all[title].symmetric) {
			results.push(title);
		}
	});
	return results;
};

exports.relationtree = function(source,operator,options) {
	var all = relations.types(options.wiki),
		results = [];
	source(function(tiddler,title) {
		if(all[title] && all[title].tree) {
			results.push(title);
		}
	});
	return results;
};

exports.relationfield = function(source,operator,options) {
	var results = [];
	source(function(tiddler,title) {
		results.push(relations.fieldLabel(options.wiki,title,operator.operand || ""));
	});
	return results;
};

exports.relationlines = function(source,operator,options) {
	var wiki = options.wiki,
		view = visibility.current(wiki),
		results = [];
	source(function(tiddler,title) {
		$tw.utils.each(relations.lines(wiki,operator.operand,title,function(entry) {
			return visibility.visible(wiki,entry,view);
		}),function(line) {
			results.push($tw.utils.stringifyList(line));
		});
	});
	return results;
};

exports.relationgroups = function(source,operator,options) {
	var hubs = [];
	source(function(tiddler,title) {
		hubs.push(title);
	});
	return relations.groups(options.wiki,hubs);
};

exports.relationgroup = function(source,operator,options) {
	var results = [];
	source(function(tiddler,title) {
		results.push(relations.group(options.wiki,title));
	});
	return results;
};
