/*\
title: $:/plugins/tiddlyrpg-core/checks/images.js
type: application/javascript
module-type: trpg-check
created: 20261015191942000
modified: 20261015191942000

Checks of images and maps (modules/images.js; modules/checks.js runs them).

  images/folder   error: <<image "...">> in a tiddler without type and without folder:"..." - no
                  folder to look in
  images/joined   hint: images or maps at a spot joined to a tiddler - they show in that tiddler,
                  set them there
  images/files    error: a file that is not in images/ (fields image and map, the parameters
                  image and map of a spot without tiddler, the files of <<image>>). Only where
                  the folder of the wiki is known (checks.setFolder(), scripts/check-wiki.js);
                  in the browser it gives nothing

Calls and spots in a section the view does not see are left out (the message repeats them).

\*/

"use strict";

var images = require("$:/plugins/tiddlyrpg-core/modules/images.js"),
	spots = require("$:/plugins/tiddlyrpg-core/modules/spots.js"),
	sections = require("$:/plugins/tiddlyrpg-core/modules/sections.js"),
	checks = require("$:/plugins/tiddlyrpg-core/modules/checks.js");

// The <<image>> calls of a body the view sees: [{files, folder}]; folder "" if none is named
function calls(wiki,title,view) {
	var parsed = wiki.parseTiddler(title),
		hidden = sections.hiddenRanges(wiki,title,view),
		result = [];
	var walk = function(nodes) {
		$tw.utils.each(nodes,function(node) {
			var attrs = node.attributes || {},
				variable = node.type === "transclude" && attrs["$variable"],
				inHidden = node.start !== undefined && hidden.some(function(range) {
					return node.start >= range[0] && node.start < range[1];
				});
			if(variable && variable.value === "image" && !inHidden) {
				var list = attrs["0"] || attrs.files;
				if(list && list.type === "string" && list.value.trim()) {
					result.push({files: list.value, folder: attrs.folder ? attrs.folder.value : ""});
				}
			}
			walk(node.children);
		});
	};
	walk(parsed ? parsed.tree : []);
	return result;
}

// The spots of a location the view sees, each with the tiddler it is joined to ("" for none)
function spotsOf(wiki,tiddler,title,view) {
	if(!tiddler.hasTag("Location")) {
		return [];
	}
	return spots.visibleSpots(wiki,title,view).map(function(spot) {
		var target = spots.targetOf(wiki,spot);
		return {spot: spot, joined: target && wiki.tiddlerExists(target) ? target : ""};
	});
}

exports.rules = [
	{
		id: "images/folder",
		run: function(wiki,title,view) {
			var tiddler = wiki.getTiddler(title);
			if(!tiddler || images.folderOf(tiddler)) {
				return [];
			}
			return calls(wiki,title,view).filter(function(call) {
				return !call.folder;
			}).map(function(call) {
				return {level: "error", key: "Check/Images/NoFolder", params: {files: call.files}};
			});
		}
	},
	{
		id: "images/joined",
		run: function(wiki,title,view) {
			var tiddler = wiki.getTiddler(title);
			if(!tiddler) {
				return [];
			}
			return spotsOf(wiki,tiddler,title,view).filter(function(entry) {
				return entry.joined && (entry.spot.image || entry.spot.map);
			}).map(function(entry) {
				return {level: "hint", key: "Check/Images/Joined", params: {spot: entry.spot.plain, target: entry.joined}};
			});
		}
	},
	{
		id: "images/files",
		run: function(wiki,title,view) {
			var root = checks.folder(),
				tiddler = wiki.getTiddler(title);
			if(!root || !tiddler) {
				return [];
			}
			var fs = require("fs"),
				path = require("path"),
				fields = tiddler.fields,
				own = images.folderOf(tiddler),
				messages = [];
			var missing = function(list,dir,key,params) {
				$tw.utils.each(images.files(list),function(file) {
					var where = dir + "/" + file;
					if(!fs.existsSync(path.join(root,"images",dir,file))) {
						messages.push({level: "error", key: key, params: $tw.utils.extend({path: "images/" + where},params || {})});
					}
				});
			};
			if(own) {
				missing(fields.image,own,"Check/Images/Image");
			}
			missing(fields.map,"map","Check/Images/Map");
			$tw.utils.each(calls(wiki,title,view),function(call) {
				if(call.folder || own) {
					missing(call.files,call.folder || own,"Check/Images/Macro");
				}
			});
			$tw.utils.each(spotsOf(wiki,tiddler,title,view),function(entry) {
				if(!entry.joined) {
					missing(entry.spot.image,"location","Check/Images/SpotImage",{spot: entry.spot.plain});
					missing(entry.spot.map,"map","Check/Images/SpotMap",{spot: entry.spot.plain});
				}
			});
			return messages;
		}
	}
];
