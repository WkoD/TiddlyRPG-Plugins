/*\
title: $:/plugins/tiddlyrpg-core/filters/quests.js
type: application/javascript
module-type: filteroperator
created: 20261015122743000
modified: 20261015174341000

Filter operators of the quests (modules/quests.js), all for the active view:

[questnames[]]                  the names of the quests and rumours, newest marker first (input
                                ignored)
[<names>questreal[]]            the input names that have a tiddler tagged Quest
[<names>queststatus[]]          the status of each input name: open, complete or failed
[<name>questmarks[]]            the ids of its markers, newest first
[<name>questlast[]]             the id of its newest marker
[<name>questplayers[]]          who takes part (player characters)
[<name>questlinks[]]            the quests linked with it
[<titles>questmarked[]]         the input titles that are names of a quest or rumour with a marker
[<name>questmentions[]]         what its markers link ([[...]], <<spotlink>>: the location);
                                questmentions<event>: only its markers in that event
[<name>questevents[]]           the events of its markers, newest first
[<name>questlinkat<other>]      the events where it is linked with <other>
[<name>questpins<map>]          the nodes of the map of the location <map> its newest marker
                                leads to; <map> itself for the location as a whole
[<name>questroutes<map>]        each way there as JSON {node, via, how}: what it links (via) and
                                how - location, spot, node, located, section
[<title>questsabout[]]          the open quests and rumours whose markers link the input titles
[<id>questmark:event[]]         of a marker: its event; key (its position, for $quest of
                                trpg-body), number (its dated section), date (the text of the
                                section), status (as written: complete, failed or empty), anchor
                                (the jump mark of its section, empty for the first)
\*/

"use strict";

var quests = require("$:/plugins/tiddlyrpg-core/modules/quests.js");

function each(source,fn) {
	var results = [];
	source(function(tiddler,title) {
		$tw.utils.each(fn(title),function(value) {
			if(value !== undefined && value !== null && results.indexOf(value) === -1) {
				results.push(value);
			}
		});
	});
	return results;
}

exports.questnames = function(source,operator,options) {
	return quests.names(options.wiki);
};

exports.questreal = function(source,operator,options) {
	return each(source,function(name) {
		return quests.isQuest(options.wiki,name) ? [name] : [];
	});
};

exports.queststatus = function(source,operator,options) {
	var results = [];
	source(function(tiddler,name) {
		results.push(quests.status(options.wiki,name));
	});
	return results;
};

exports.questmarks = function(source,operator,options) {
	return each(source,function(name) {
		return quests.marks(options.wiki,name).map(function(mark) { return mark.id; });
	});
};

exports.questlast = function(source,operator,options) {
	return each(source,function(name) {
		var list = quests.marks(options.wiki,name);
		return list.length ? [list[0].id] : [];
	});
};

exports.questplayers = function(source,operator,options) {
	return each(source,function(name) {
		return quests.players(options.wiki,name);
	});
};

exports.questlinks = function(source,operator,options) {
	return each(source,function(name) {
		return quests.links(options.wiki,name);
	});
};

exports.questmarked = function(source,operator,options) {
	return each(source,function(title) {
		return quests.marks(options.wiki,title).length ? [title] : [];
	});
};

exports.questmentions = function(source,operator,options) {
	return each(source,function(name) {
		return quests.mentions(options.wiki,name,null,operator.operand || null);
	});
};

exports.questevents = function(source,operator,options) {
	return each(source,function(name) {
		return quests.events(options.wiki,name);
	});
};

exports.questpins = function(source,operator,options) {
	return each(source,function(name) {
		return quests.pins(options.wiki,name,operator.operand);
	});
};

exports.questroutes = function(source,operator,options) {
	return each(source,function(name) {
		return quests.routes(options.wiki,name,operator.operand).map(function(route) {
			return JSON.stringify(route);
		});
	});
};

exports.questlinkat = function(source,operator,options) {
	return each(source,function(name) {
		return quests.linkEvents(options.wiki,name,operator.operand);
	});
};

exports.questsabout = function(source,operator,options) {
	return each(source,function(title) {
		return quests.about(options.wiki,title);
	});
};

exports.questmark = function(source,operator,options) {
	var results = [];
	source(function(tiddler,id) {
		var mark = quests.mark(options.wiki,id),
			value = "";
		if(mark) {
			switch(operator.suffix) {
				case "event": value = mark.event; break;
				case "key": value = mark.key; break;
				case "number": value = mark.number ? mark.number.toString() : ""; break;
				case "date": value = mark.date; break;
				case "status": value = mark.status; break;
				case "anchor": value = mark.number && !mark.firstSection ? "date-" + mark.number : ""; break;
			}
		}
		results.push(value);
	});
	return results;
};
