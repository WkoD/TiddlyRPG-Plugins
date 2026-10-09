/*\
title: deadlink
type: application/javascript
module-type: macro
\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var dates = require("$:/plugins/tiddlyrpg-core/modules/dates.js");

exports.name = "deadlink";

exports.params = [
   { name: "title" },
   { name: "style" }
];

/*
Run the macro
*/
exports.run = function(title, style) {
   var tiddler = this.wiki.getTiddler(title);
   // Deceased/destroyed: the date field ends, events excluded (cf. trpg.dead in functions.tid)
   var dead = !!(tiddler && !tiddler.hasTag("Event") && dates.parse(tiddler.fields.date).ended);

   if (dead === true) {
	  if (style) {
		 return style + "[[" + title + "]]" + style;
	  } else {
         return "~~[[" + title + "]]~~";
	  }
   } else {
      return "[[" + title + "]]";
   }
};

})();
