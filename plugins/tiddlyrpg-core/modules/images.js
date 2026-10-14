/*\
title: $:/plugins/tiddlyrpg-core/modules/images.js
type: application/javascript
module-type: library
created: 20261014180236000
modified: 20261014180236000

Images and maps of a tiddler or a spot - the one place of these rules. Used by the image filters
(filters/images.js), the macro image (macros/image.js) and scripts/check-wiki.js.

  image: a.jpg, b.jpg          field image of every type, in images/<folder>/ by the type tag
  map: a.jpg, b.jpg            field map of a location, in images/map/; the first one carries
                               the graph of the location (graph/templates/trpg-map)
  <<spot "Name" image:"a.jpg" map:"b.jpg">>   a spot without a tiddler of its own: images in
                               images/location/, maps in images/map/

A list of files is comma separated. Each file is an entry {id, label, path}: the label is the
file name without its extension, the path the file below the wiki ("images/map/a.jpg"). One
entry shows on its own, two or more as tabs labelled with these names (procedure trpg.images).

\*/

"use strict";

// Image folder per type tag (images/<folder>/); the first matching tag wins
var FOLDERS = exports.FOLDERS = [
	{tags: ["Event"], folder: "event"},
	{tags: ["Artifact", "Item", "Material"], folder: "item"},
	{tags: ["Organisation"], folder: "organisation"},
	{tags: ["Location"], folder: "location"},
	{tags: ["Person", "Deity"], folder: "person"},
	{tags: ["Player"], folder: "player"},
	{tags: ["Information"], folder: "information"}
];

// The image folder of a tiddler by its type tag, or null
exports.folderOf = function(tiddler) {
	for(var i = 0; i < FOLDERS.length; i++) {
		for(var j = 0; j < FOLDERS[i].tags.length; j++) {
			if(tiddler.hasTag(FOLDERS[i].tags[j])) {
				return FOLDERS[i].folder;
			}
		}
	}
	return null;
};

// "a.jpg, b.jpg" -> ["a.jpg", "b.jpg"]; empty entries are skipped
var files = exports.files = function(text) {
	return (text || "").split(",").map(function(s) { return s.trim(); }).filter(function(s) { return !!s; });
};

// The name of a file without its extension: "Hain von Sigurd.jpg" -> "Hain von Sigurd"
var label = exports.label = function(file) {
	return file.replace(/\.[^.\/]*$/,"");
};

/*
The entries of a list of files in images/<folder>/: [{id, label, path}]. id is <prefix>-<n>
(counting from 1), or <first> for the first one if given (the map tab "map").
*/
exports.entries = function(text,folder,prefix,first) {
	return files(text).map(function(file,i) {
		return {
			id: i === 0 && first ? first : prefix + "-" + (i + 1),
			label: label(file),
			path: "images/" + folder + "/" + file
		};
	});
};
