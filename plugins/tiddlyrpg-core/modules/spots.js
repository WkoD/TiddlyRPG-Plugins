/*\
title: $:/plugins/tiddlyrpg-core/modules/spots.js
type: application/javascript
module-type: library
created: 20261006064449000
modified: 20261014194538000

Spots: the places of interest of a location, written in its body - the one place of these rules.
Used by the spot filters (filters/spots.js), the location rules (filters/location.js) and the
dated sections of a body (modules/dates.js, for <<spotlink>>).

  <<spot "Schloss Baile">>                        a spot; its text runs to the next marker
  <<spot "Tempel von [[Chauntea]]">>              the name may hold wikitext (links stay links)
  <<spot "Anzeige" tiddler:"Tiddler">>                    joined to another tiddler than the name says
  <<spot "Schloss" image:"a.jpg, b.jpg" map:"c.jpg">>   with images and maps (modules/images.js)
  <$spot name="Schloss" tiddler="Tiddler" image="a.jpg">...</$spot>   the block form

The plain name of a spot (anchor, node label, target of <<spotlink>>) is its name with every
link replaced by its visible text. The spot is joined to a tiddler if one has its plain name, or
the one named as second parameter. A spot joined to a location is a part of the location that
has it ("Teil von"); any other spot is a point of interest of its own.

  <<spotlink "Baile" "Schloss Baile">>                          a reference to a spot
  <<spotlink "Miehall" "[[Trunkenen Eulenbären|Zum Trunkenen Eulenbären]]">>

The second parameter of <<spotlink>> is the plain name of the spot, or a link in wikitext
syntax: then the text before "|" is shown and the target is the spot. Unlike <<spot>> the
target counts here, not the visible text.

Both come from the model of the body (modules/sections.js): the rules of sections apply - a spot
counts only in a location, a locked spot (<<secret>>) and a spot joined to a tiddler the view
does not see are left out by visibleSpots() and the checks below.

\*/

"use strict";

var sections = require("$:/plugins/tiddlyrpg-core/modules/sections.js"),
	visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js");

// Plain text of a name: every link replaced by its visible text, whitespace collapsed
var plain = exports.plain = sections.plain;

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

// Anchor of a spot (data-trpg-anchor), from its name: "spot-schloss-baile"
exports.anchor = function(name) {
	var text = plain(name).toLowerCase();
	if($tw.utils.transliterate) {
		text = $tw.utils.transliterate(text);
	}
	return "spot-" + text.replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
};

/*
The spots and spot references of a tiddler (cached per tiddler):
  spots     [{id, name, plain, target, image, map, start, end}] in document order; target is the
            second parameter as written (or ""), image and map the parameters; id: the section
            (modules/sections.js)
  links     [{place, spot, text, start, id}] - the <<spotlink>> calls; id: the innermost
            section they stand in, -1 for none
*/
var read = exports.read = function(wiki,title) {
	return wiki.getCacheForTiddler(title,"tiddlyrpg-spots",function() {
		var model = sections.read(wiki,title),
			found = [],
			links = [];
		$tw.utils.each(model.records,function(record) {
			if(record.kind === "spot" && record.counts) {
				found.push({id: record.id, name: record.params.name, plain: record.params.plain, target: record.params.target,
					image: record.params.image, map: record.params.map, start: record.start, end: record.end});
			}
		});
		$tw.utils.each(model.spotlinks,function(link) {
			var ref = exports.reference(link.spec);
			links.push({place: link.place, spot: ref.spot, text: ref.text, start: link.start, id: link.section});
		});
		return {spots: found, links: links};
	});
};

// The tiddler a spot is joined to (the second parameter, or a tiddler with its plain name), or ""
var targetOf = exports.targetOf = function(wiki,spot) {
	var title = spot.target || spot.plain;
	return title && wiki.tiddlerExists(title) ? title : (spot.target || "");
};

// The spots of <title> the active view (or <view>) sees
var visibleSpots = exports.visibleSpots = function(wiki,title,view) {
	view = view || visibility.current(wiki);
	return read(wiki,title).spots.filter(function(spot) {
		return sections.visible(wiki,title,spot.id,view);
	});
};

// Whether <owner> has <title> as a joined spot the view sees
exports.ownsVisibly = function(wiki,owner,title,view) {
	return visibleSpots(wiki,owner,view).some(function(spot) {
		return targetOf(wiki,spot) === title;
	});
};

// Whether <linker> references a spot of <place> with a <<spotlink>> the view sees
exports.linksVisibly = function(wiki,linker,place,view) {
	view = view || visibility.current(wiki);
	return visibility.visible(wiki,linker,view) && read(wiki,linker).links.some(function(link) {
		return link.place === place && sections.visible(wiki,linker,link.id,view);
	});
};

/*
Index over all locations (global cache, recomputed after any change), whatever the view:
  owners    {<title>: [locations that have <title> as a joined spot]}
  linkers   {<place>: [tiddlers that reference a spot of <place> with <<spotlink>>]}
*/
exports.index = function(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-spot-index",function() {
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
