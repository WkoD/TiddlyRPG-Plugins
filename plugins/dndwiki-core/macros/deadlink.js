/*\
title: deadlink
type: application/javascript
module-type: macro
\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

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
   // Deceased/destroyed: a dot in the date field (cf. dnd.dead in functions.tid)
   var dead = !!(tiddler && tiddler.fields.date && tiddler.fields.date.indexOf(".") !== -1);

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
