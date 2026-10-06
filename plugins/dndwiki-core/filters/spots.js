/*\
title: $:/plugins/dndwiki-core/filters/spots.js
type: application/javascript
module-type: filteroperator
created: 20261006064449000
modified: 20261006064449000

Filter operators on the spots of a location and the references to them (modules/spots.js).

[<title>spots[]]              plain names of the spots of <title>, in document order
[<title>spots:raw[]]          the names as written (wikitext)
[<title>spots:section[]]      each spot as written in the body: its <<spot>> call and its text
[<title>spottargets[]]        the tiddlers the spots of <title> are joined to (existing only)
[<title>spottext<name>]       wikitext of the spot <name> (plain or raw name) of <title>
[<title>spotintro[]]          the body of <title> before its first spot
[<name>spotplain[]]           plain name of a spot name
[<name>spotanchor[]]          jump mark of a spot name ("spot-schloss-baile")
[<name>spottarget<target>]    the tiddler a spot is joined to: <target> or the tiddler with
                              the plain name; nothing if neither exists
[<spec>spotref:text[]]        the text shown by <<spotlink>> for its second parameter
[<spec>spotref:spot[]]        the spot it points to
[<title>spotowner[]]          the locations that have <title> as a joined spot
[<place>spotlinked[]]         the tiddlers that reference a spot of <place> with <<spotlink>>
[<title>maptabs[]]            the battle map tabs of a location, as JSON
                              {"id", "label", "file", "spot"}: first the battle maps of the
                              field battlemap, then per spot those of its parameter and of the
                              field battlemap of the tiddler it is joined to. The label is the
                              location, with a spot its plain name; a number only if there is
                              more than one map with the same label.

\*/

"use strict";

var spots = require("$:/plugins/dndwiki-core/modules/spots.js");

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
		var text = mode === "section" ? ((wiki.getTiddler(title) || {fields: {}}).fields.text || "") : "";
		$tw.utils.each(spots.read(wiki,title).spots,function(spot) {
			if(mode === "section") {
				results.push(text.substring(spot.start,spot.textEnd).replace(/\s+$/,""));
			} else {
				results.push(mode === "raw" ? spot.name : spot.plain);
			}
		});
	});
};

exports.spottargets = function(source,operator,options) {
	var wiki = options.wiki;
	return each(source,function(title,results) {
		$tw.utils.each(spots.read(wiki,title).spots,function(spot) {
			var target = spots.targetOf(wiki,spot);
			if(target && target !== title && wiki.tiddlerExists(target) && results.indexOf(target) === -1) {
				results.push(target);
			}
		});
	});
};

exports.spottext = function(source,operator,options) {
	return each(source,function(title,results) {
		var text = spots.text(options.wiki,title,operator.operand);
		if(text !== undefined) {
			results.push(text);
		}
	});
};

exports.spotintro = function(source,operator,options) {
	return each(source,function(title,results) {
		results.push(spots.read(options.wiki,title).intro);
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
	var owners = spots.index(options.wiki).owners;
	return each(source,function(title,results) {
		$tw.utils.each(owners[title] || [],function(owner) {
			if(results.indexOf(owner) === -1) {
				results.push(owner);
			}
		});
	});
};

exports.spotlinked = function(source,operator,options) {
	var linkers = spots.index(options.wiki).linkers;
	return each(source,function(place,results) {
		$tw.utils.each(linkers[place] || [],function(title) {
			if(results.indexOf(title) === -1) {
				results.push(title);
			}
		});
	});
};

exports.maptabs = function(source,operator,options) {
	var wiki = options.wiki;
	return each(source,function(title,results) {
		var tiddler = wiki.getTiddler(title),
			groups = [];
		if(!tiddler) {
			return;
		}
		groups.push({label: title, spot: "", files: spots.files(tiddler.fields.battlemap), key: "battlemap"});
		$tw.utils.each(spots.read(wiki,title).spots,function(spot) {
			var files = spots.files(spot.battlemap),
				target = spots.targetOf(wiki,spot),
				joined = target && target !== title ? wiki.getTiddler(target) : null;
			if(joined) {
				$tw.utils.each(spots.files(joined.fields.battlemap),function(file) {
					if(files.indexOf(file) === -1) {
						files.push(file);
					}
				});
			}
			groups.push({label: title + " " + spot.plain, spot: spot.plain, files: files, key: spots.anchor(spot.name).replace(/^spot-/,"battlemap-")});
		});
		$tw.utils.each(groups,function(group) {
			$tw.utils.each(group.files,function(file,i) {
				var numbered = group.files.length > 1;
				results.push(JSON.stringify({
					id: group.key + (numbered ? "-" + (i + 1) : ""),
					label: group.label + (numbered ? " " + (i + 1) : ""),
					file: file,
					spot: group.spot
				}));
			});
		});
	});
};
