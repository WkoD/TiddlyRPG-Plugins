/*\
title: $:/plugins/dndwiki-core/modules/spots.js
type: application/javascript
module-type: library
created: 20261006064449000
modified: 20261006064449000

Spots: the places of interest of a location, written in its body - the one place of these rules.
Used by the spot filters (filters/spots.js), the location rules (filters/location.js) and the
dated sections of a body (modules/dates.js, for <<spotlink>>).

  <<spot "Schloss Baile">>                        a spot; its text runs to the next <<spot>>
  <<spot "Tempel von [[Chauntea]]">>              the name may hold wikitext (links stay links)
  <<spot "Anzeige" "Tiddler">>                    joined to another tiddler than the name says
  <<spot "Schloss" battlemap:"a.jpg, b.jpg">>     with battle maps (images/battlemap/)

The plain name of a spot (anchor, node label, target of <<spotlink>>) is its name with every
link replaced by its visible text. The spot is joined to a tiddler if one has its plain name, or
the one named as second parameter. A spot joined to a location is a part of the location that
has it ("Teil von"); any other spot is a point of interest of its own.

  <<spotlink "Baile" "Schloss Baile">>                          a reference to a spot
  <<spotlink "Miehall" "[[Trunkenen Eulenbären|Zum Trunkenen Eulenbären]]">>

The second parameter of <<spotlink>> is the plain name of the spot, or a link in wikitext
syntax: then the text before "|" is shown and the target is the spot. Unlike <<spot>> the
target counts here, not the visible text.

Both are read from the parse tree of a tiddler (cached per tiddler). Calls in code are not
parsed, subtrees with the class tc-tiddler-frame (notes of the DM) are skipped. A spot inside a
block hidden from players is still found - the walk does not evaluate $list/<%if%>/$reveal.

\*/

"use strict";

var LINK = /\[\[([^\]]*?)\]\]/g;

function attribute(node,name) {
	var attr = node.attributes && node.attributes[name];
	return attr && attr.type === "string" ? attr.value : undefined;
}

function hasClass(node,name) {
	var cls = attribute(node,"class");
	return !!cls && (" " + cls + " ").indexOf(" " + name + " ") !== -1;
}

// Plain text of a name: every link replaced by its visible text, whitespace collapsed
var plain = exports.plain = function(name) {
	return (name || "").replace(LINK,function(match,inner) {
		var bar = inner.indexOf("|");
		return bar === -1 ? inner : inner.substring(0,bar);
	}).replace(/\s+/g," ").trim();
};

/*
The second parameter of <<spotlink>>: {text, spot}. A link "[[Text|Spot]]" or "[[Spot]]"
standing alone gives its text and target; anything else is the plain name of the spot.
*/
exports.reference = function(spec) {
	spec = (spec || "").trim();
	var match = /^\[\[([^\]]*?)\]\]$/.exec(spec);
	if(match) {
		var inner = match[1],
			bar = inner.indexOf("|");
		if(bar === -1) {
			return {text: inner.trim(), spot: inner.trim()};
		}
		return {text: inner.substring(0,bar).trim(), spot: inner.substring(bar + 1).trim()};
	}
	var name = plain(spec);
	return {text: name, spot: name};
};

// Anchor of a spot (data-dnd-anchor), from its name: "spot-schloss-baile"
exports.anchor = function(name) {
	var text = plain(name).toLowerCase();
	if($tw.utils.transliterate) {
		text = $tw.utils.transliterate(text);
	}
	return "spot-" + text.replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
};

// Battle maps of a field or parameter: "a.jpg, b.jpg" -> ["a.jpg", "b.jpg"]
exports.files = function(text) {
	return (text || "").split(",").map(function(s) { return s.trim(); }).filter(function(s) { return !!s; });
};

/*
The spots and spot references of a tiddler (cached per tiddler):
  intro     text of the body before the first spot (the whole body without spots)
  spots     [{name, plain, target, battlemap, start, end, textStart, textEnd}] in document
            order; target is the second parameter as written (or ""), battlemap the parameter
  links     [{place, spot, text, start}] - the <<spotlink>> calls
*/
var read = exports.read = function(wiki,title) {
	return wiki.getCacheForTiddler(title,"dndwiki-spots",function() {
		var tiddler = wiki.getTiddler(title),
			text = (tiddler && tiddler.fields.text) || "",
			parser = tiddler ? wiki.parseTiddler(title) : null,
			spots = [],
			links = [];
		var walk = function(nodes) {
			$tw.utils.each(nodes,function(node) {
				if(hasClass(node,"tc-tiddler-frame")) {
					return;
				}
				var variable = node.type === "transclude" ? attribute(node,"$variable") : undefined;
				if(variable === "spot" && node.start !== undefined) {
					var name = attribute(node,"name");
					if(name === undefined) {
						name = attribute(node,"0") || "";
					}
					var target = attribute(node,"target");
					if(target === undefined) {
						target = attribute(node,"1") || "";
					}
					spots.push({name: name, plain: plain(name), target: target.trim(), battlemap: attribute(node,"battlemap") || "", start: node.start, end: node.end});
				} else if(variable === "spotlink" && node.start !== undefined) {
					var place = attribute(node,"place");
					if(place === undefined) {
						place = attribute(node,"0") || "";
					}
					var spec = attribute(node,"spot");
					if(spec === undefined) {
						spec = attribute(node,"1") || "";
					}
					var ref = exports.reference(spec);
					links.push({place: place.trim(), spot: ref.spot, text: ref.text, start: node.start});
				}
				if(node.children) {
					walk(node.children);
				}
			});
		};
		walk(parser && parser.tree ? parser.tree : []);
		$tw.utils.each(spots,function(spot,i) {
			spot.textStart = spot.end;
			spot.textEnd = i + 1 < spots.length ? spots[i + 1].start : text.length;
		});
		return {
			intro: spots.length ? text.substring(0,spots[0].start) : text,
			spots: spots,
			links: links
		};
	});
};

// The tiddler a spot is joined to (the second parameter, or a tiddler with its plain name), or ""
var targetOf = exports.targetOf = function(wiki,spot) {
	var title = spot.target || spot.plain;
	return title && wiki.tiddlerExists(title) ? title : (spot.target || "");
};

// The text of a spot of <title> (by its name or plain name), or undefined
exports.text = function(wiki,title,name) {
	var data = read(wiki,title),
		want = plain(name),
		text = (wiki.getTiddler(title) || {fields: {}}).fields.text || "";
	for(var i = 0; i < data.spots.length; i++) {
		if(data.spots[i].plain === want) {
			return text.substring(data.spots[i].textStart,data.spots[i].textEnd).replace(/^\s*\n/,"").replace(/\s+$/,"");
		}
	}
	return undefined;
};

/*
Index over all locations (global cache, recomputed after any change):
  owners    {<title>: [locations that have <title> as a joined spot]}
  linkers   {<place>: [tiddlers that reference a spot of <place> with <<spotlink>>]}
*/
exports.index = function(wiki) {
	return wiki.getGlobalCache("dndwiki-spot-index",function() {
		var owners = Object.create(null),
			linkers = Object.create(null);
		wiki.each(function(tiddler,title) {
			var text = tiddler.fields.text || "";
			if(text.indexOf("spot") === -1 || tiddler.isDraft()) {
				return;
			}
			var data = read(wiki,title);
			if(tiddler.hasTag("Location")) {
				$tw.utils.each(data.spots,function(spot) {
					var target = targetOf(wiki,spot);
					if(target && target !== title) {
						var list = owners[target] = owners[target] || [];
						if(list.indexOf(title) === -1) {
							list.push(title);
						}
					}
				});
			}
			$tw.utils.each(data.links,function(link) {
				if(link.place) {
					var list = linkers[link.place] = linkers[link.place] || [];
					if(list.indexOf(title) === -1) {
						list.push(title);
					}
				}
			});
		});
		return {owners: owners, linkers: linkers};
	});
};
