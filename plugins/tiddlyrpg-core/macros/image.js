/*\
title: image
type: application/javascript
module-type: macro
\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var images = require("$:/plugins/tiddlyrpg-core/modules/images.js");

exports.name = "image";

exports.params = [
   { name: "title" },
   { name: "parent" }
];

/*
The images of the field image of <title> one below the other, in the folder of its type tag
(modules/images.js); a tiddler without a type takes the folder of <parent> (sub-tiddlers,
macros/subtiddler.js). The view template shows them as tabs instead (procedure trpg.images).
*/
exports.run = function(title, parent) {
   var tiddler = this.wiki.getTiddler(title),
      ptiddler = this.wiki.getTiddler(parent),
      folder = tiddler && (images.folderOf(tiddler) || (ptiddler && images.folderOf(ptiddler)));

   if (!tiddler || !folder) {
      return "";
   }
   return images.files(tiddler.fields.image).map(function(name) {
      return "[img[images/" + folder + "/" + name + "]]";
   }).join("");
};

})();
