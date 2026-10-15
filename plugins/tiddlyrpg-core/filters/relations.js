/*\
title: $:/plugins/tiddlyrpg-core/filters/relations.js
type: application/javascript
module-type: filteroperator
created: 20261008062202000
modified: 20261015155038000

Filters over the relation rules (modules/relations.js). <selected> is a title list of the
relation types in play (a graph view may draw only some); empty or missing: all.

[<from>relationtargets<type>,<selected>]        targets <type> shows from <from>: the
                                                excluded ones and those another type of <from>
                                                includes left out
[<to>relationsources<type>,<selected>]          who has <to> as a shown target of <type>
[<type>relationlabel[]]                         edge label of <type> (Edge/<type>), if any
[<type>relationaxis[]]                          config title of the axis of <type>
[<type>relationsymmetric[]]                     <type> if it is symmetric
[relationtypes[]]                               all relation types, by axis, then the rest
[relationtypes:list[]]                          those of the relation list: the fields
                                                without tags and list, the functions on an axis
[<titles>relationneighbours[]]                  what the input titles are related to, both ways,
                                                through the types of the relation list
[<titles>relationkind[]]                        the kind of each title for the filter of the
                                                relations block: player, person (deities too),
                                                organisation, location, item (artifacts and
                                                materials too), quest (a quest or rumour), else
                                                other

\*/

"use strict";

var relations = require("$:/plugins/tiddlyrpg-core/modules/relations.js"),
	quests = require("$:/plugins/tiddlyrpg-core/modules/quests.js");

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
		var label = relations.label(options.wiki,title);
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

// The kinds of the filter of the relations block, by their tag; the first that fits counts
var KINDS = [["Player","player"],["Person","person"],["Organisation","organisation"],["Deity","person"],
	["Location","location"],["Artifact","item"],["Item","item"],["Material","item"],["Quest","quest"]];

exports.relationkind = function(source,operator,options) {
	var wiki = options.wiki,
		results = [];
	source(function(tiddler,title) {
		var kind = "other";
		if(tiddler) {
			$tw.utils.each(KINDS,function(entry) {
				if(kind === "other" && tiddler.hasTag(entry[0])) {
					kind = entry[1];
				}
			});
		} else if(quests.index(wiki).names.indexOf(title) !== -1) {
			kind = "quest";
		}
		results.push(kind);
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
