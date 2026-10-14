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
   { name: "title" }
];

/*
The images of the field image of <title> one below the other, in the folder of its type tag
(modules/images.js) - for the cards of the Player hub. The view template shows them as tabs
instead (procedure trpg.images).
*/
exports.run = function(title) {
   var tiddler = this.wiki.getTiddler(title),
      folder = tiddler && images.folderOf(tiddler);

   if (!tiddler || !folder) {
      return "";
   }
   return images.files(tiddler.fields.image).map(function(name) {
      return "[img[images/" + folder + "/" + name + "]]";
   }).join("");
};

})();
