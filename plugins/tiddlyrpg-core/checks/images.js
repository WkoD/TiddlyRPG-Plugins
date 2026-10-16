/*\
title: $:/plugins/tiddlyrpg-core/checks/images.js
type: application/javascript
module-type: trpg-check
created: 20261015193638000
modified: 20261015204520000

Checks of images and maps (modules/images.js; modules/checks.js runs them).

  images/folder   error: <<image "...">> in a tiddler without type and without folder:"..." - no
                  folder to look in
  images/joined   hint: images or maps at a spot joined to a tiddler - they show in that tiddler,
                  set them there
  images/files    error: a file that is not in images/ (fields image and map, the parameters
                  image and map of a spot without tiddler, the files of <<image>>). Only where
                  the folder of the wiki is known (checks.setFolder(), scripts/check-wiki.js);
                  in the browser it gives nothing
  images/unused   hint, scope wiki: a file in the image folder of a type or in images/map/ that
                  no tiddler names (fields image and map, the parameters image and map of a
                  spot, <<image>>) - use it or remove it. Other folders below images/ are the
                  campaign's own. The title of the message is the path of the file: it shows
                  only in scripts/check-wiki.js

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
		id: "images/unused",
		scope: "wiki",
		run: function(wiki,view) {
			var root = checks.folder();
			if(!root) {
				return [];
			}
			var fs = require("fs"),
				path = require("path"),
				used = Object.create(null);
			var mark = function(dir,list) {
				$tw.utils.each(images.files(list),function(file) {
					used[dir + "/" + file] = true;
				});
			};
			wiki.each(function(tiddler,title) {
				var own = images.folderOf(tiddler);
				if(own) {
					mark(own,tiddler.fields.image);
				}
				mark("map",tiddler.fields.map);
				if(tiddler.hasTag("Location")) {
					$tw.utils.each(spots.read(wiki,title).spots,function(spot) {
						mark("location",spot.image);
						mark("map",spot.map);
					});
				}
				if((tiddler.fields.text || "").indexOf("image") !== -1) {
					$tw.utils.each(calls(wiki,title,view),function(call) {
						if(call.folder || own) {
							mark(call.folder || own,call.files);
						}
					});
				}
			});
			var dirs = ["map"],
				messages = [];
			$tw.utils.each(images.FOLDERS,function(entry) {
				if(dirs.indexOf(entry.folder) === -1) {
					dirs.push(entry.folder);
				}
			});
			$tw.utils.each(dirs.sort(),function(dir) {
				var full = path.join(root,"images",dir);
				if(!fs.existsSync(full)) {
					return;
				}
				$tw.utils.each(fs.readdirSync(full).sort(),function(file) {
					if(file.charAt(0) !== "." && !used[dir + "/" + file] && fs.statSync(path.join(full,file)).isFile()) {
						messages.push({title: "images/" + dir + "/" + file, level: "hint", key: "Check/Images/Unused"});
					}
				});
			});
			return messages;
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
