/*\
title: image
type: application/javascript
module-type: macro
\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

exports.name = "image";

exports.params = [
   { name: "title" },
   { name: "parent" }
];

// Image folder per type tag (images/<folder>/); the first matching tag wins
var FOLDERS = [
   {tags: ["Event"], folder: "event"},
   {tags: ["Artifact", "Item", "Material"], folder: "item"},
   {tags: ["Organisation"], folder: "organisation"},
   {tags: ["Location"], folder: "location"},
   {tags: ["Person", "Deity"], folder: "person"},
   {tags: ["Player"], folder: "player"}
];

/*
Run the macro
*/
exports.run = function(title, parent) {
   var tiddler = this.wiki.getTiddler(title);
   var ptiddler = this.wiki.getTiddler(parent);

   var ret = "";

   if (tiddler && tiddler.fields.image) {
      var images = tiddler.fields.image.split(",");

      for (var i = 0; i < images.length; ++i) {
         // "a.png, b.png" -> without spaces; skip empty entries (e.g. a trailing comma)
         var name = images[i].trim();

         if (name) {
            ret += buildImage(tiddler, ptiddler, name);
         }
      }
   }

   return ret;
};

function folderOf(tiddler) {
   for (var i = 0; i < FOLDERS.length; ++i) {
      for (var j = 0; j < FOLDERS[i].tags.length; ++j) {
         if (tiddler.hasTag(FOLDERS[i].tags[j])) {
            return FOLDERS[i].folder;
         }
      }
   }
   return null;
}

function buildImage(tiddler, ptiddler, name) {
   var folder = folderOf(tiddler);

   if (!folder) {
      return ptiddler ? buildImage(ptiddler, null, name) : "";
   }

   // The map image (field map) and battle maps (field battlemap) of a location have their own
   // tabs (viewtemplates/location), not this macro
   return "[img[images/" + folder + "/" + name + "]]";
};

})();
