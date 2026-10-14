/*\
title: $:/plugins/tiddlyrpg-core/filters/spots.js
type: application/javascript
module-type: filteroperator
created: 20261006064449000
modified: 20261014180236000

Filter operators on the spots of a location and the references to them (modules/spots.js).

[<title>spots[]]              plain names of the spots of <title> the active view sees, in
                              document order (modules/spots.js visibleSpots)
[<title>spots:raw[]]          the names as written (wikitext)
[<title>spottargets[]]        the tiddlers these spots are joined to (existing only)
[<name>spotplain[]]           plain name of a spot name
[<name>spotanchor[]]          jump mark of a spot name ("spot-schloss-baile")
[<name>spottarget<target>]    the tiddler a spot is joined to: <target> or the tiddler with
                              the plain name; nothing if neither exists
[<spec>spotref:text[]]        the text shown by <<spotlink>> for its second parameter
[<spec>spotref:spot[]]        the spot it points to
[<title>spotowner[]]          the locations that have <title> as a joined spot the view sees
[<place>spotlinked[]]         the tiddlers that reference a spot of <place> with a <<spotlink>>
                              the view sees

\*/

"use strict";

var spots = require("$:/plugins/tiddlyrpg-core/modules/spots.js");

function each(source,fn) {
	var results = [];
	source(function(tiddler,title) {
		fn(title,results);
	});
	return results;
}

exports.spots = function(source,operator,options) {
	var wiki = options.wiki,
		mode = operator.suffix || "";
	return each(source,function(title,results) {
		$tw.utils.each(spots.visibleSpots(wiki,title),function(spot) {
			results.push(mode === "raw" ? spot.name : spot.plain);
		});
	});
};

exports.spottargets = function(source,operator,options) {
	var wiki = options.wiki;
	return each(source,function(title,results) {
		$tw.utils.each(spots.visibleSpots(wiki,title),function(spot) {
			var target = spots.targetOf(wiki,spot);
			if(target && target !== title && wiki.tiddlerExists(target) && results.indexOf(target) === -1) {
				results.push(target);
			}
		});
	});
};


exports.spotplain = function(source) {
	return each(source,function(name,results) {
		results.push(spots.plain(name));
	});
};

exports.spotanchor = function(source) {
	return each(source,function(name,results) {
		results.push(spots.anchor(name));
	});
};

exports.spottarget = function(source,operator,options) {
	var wiki = options.wiki;
	return each(source,function(name,results) {
		var target = spots.targetOf(wiki,{plain: spots.plain(name), target: (operator.operand || "").trim()});
		if(target && wiki.tiddlerExists(target)) {
			results.push(target);
		}
	});
};

exports.spotref = function(source,operator) {
	var part = operator.suffix === "text" ? "text" : "spot";
	return each(source,function(spec,results) {
		results.push(spots.reference(spec)[part]);
	});
};

exports.spotowner = function(source,operator,options) {
	var wiki = options.wiki,
		owners = spots.index(wiki).owners;
	return each(source,function(title,results) {
		$tw.utils.each(owners[title] || [],function(owner) {
			if(results.indexOf(owner) === -1 && spots.ownsVisibly(wiki,owner,title)) {
				results.push(owner);
			}
		});
	});
};

exports.spotlinked = function(source,operator,options) {
	var wiki = options.wiki,
		linkers = spots.index(wiki).linkers;
	return each(source,function(place,results) {
		$tw.utils.each(linkers[place] || [],function(title) {
			if(results.indexOf(title) === -1 && spots.linksVisibly(wiki,title,place)) {
				results.push(title);
			}
		});
	});
};
