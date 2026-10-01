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
   {tags: ["Artifact", "Book", "Item", "Material"], folder: "item"},
   {tags: ["BattleMap"], folder: "battlemap"},
   {tags: ["Map"], folder: "map"},
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

   var path = "images/" + folder + "/" + name;

   // Battle maps: scaled to the width, a click opens the original file
   if (folder === "battlemap") {
      return "<a class=\"dnd-battlemap\" href=\"" + encodeURI(path) + "\" target=\"_blank\" rel=\"noopener noreferrer\">[img[" + path + "]]</a>";
   }

   return "[img[" + path + "]]";
};

})();
