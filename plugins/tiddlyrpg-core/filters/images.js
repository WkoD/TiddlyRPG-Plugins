/*\
title: $:/plugins/tiddlyrpg-core/filters/images.js
type: application/javascript
module-type: filteroperator
created: 20261014180236000
modified: 20261014185321000

Filter operators on the images and maps of a tiddler or a spot (modules/images.js). Each result
is an entry as JSON {"id", "label", "path"}; the procedure trpg.images shows one on its own and
several as tabs.

[<title>imagetabs[]]          the field image of <title>, in the folder of its type
                              (images/<folder>/); ids "image-<n>". Nothing without a folder.
[<title>maptabs[]]            the field map of a location (images/map/); ids "map" (the first,
                              with the graph), then "map-<n>"
[<list>imagelist[<folder>]]   a list of files in images/<folder>/ - the parameters image and
                              map of a spot, the files of <<image>>; ids "<folder>-<n>"
[<title>imagefolder[]]        the image folder of <title> by its type tag ("event", ...);
                              nothing without one

\*/

"use strict";

var images = require("$:/plugins/tiddlyrpg-core/modules/images.js");

function collect(source,fn) {
	var results = [];
	source(function(tiddler,title) {
		$tw.utils.each(fn(tiddler,title),function(entry) {
			results.push(JSON.stringify(entry));
		});
	});
	return results;
}

exports.imagetabs = function(source,operator,options) {
	var wiki = options.wiki;
	return collect(source,function(tiddler,title) {
		tiddler = wiki.getTiddler(title);
		var folder = tiddler && images.folderOf(tiddler);
		return folder ? images.entries(tiddler.fields.image,folder,"image") : [];
	});
};

exports.maptabs = function(source,operator,options) {
	var wiki = options.wiki;
	return collect(source,function(tiddler,title) {
		tiddler = wiki.getTiddler(title);
		return tiddler ? images.entries(tiddler.fields.map,"map","map","map") : [];
	});
};

exports.imagefolder = function(source,operator,options) {
	var wiki = options.wiki,
		results = [];
	source(function(tiddler,title) {
		tiddler = wiki.getTiddler(title);
		var folder = tiddler && images.folderOf(tiddler);
		if(folder) {
			results.push(folder);
		}
	});
	return results;
};

exports.imagelist = function(source,operator) {
	var folder = operator.operand;
	return collect(source,function(tiddler,title) {
		return folder ? images.entries(title,folder,folder) : [];
	});
};
