/*\
title: subtiddler
type: application/javascript
module-type: macro
\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

exports.name = "subtiddler";

exports.params = [
   { name: "title"},
   { name: "sub" },
   { name: "heading" },
   { name: "tags" },
   { name: "template" },
   { name: "style" }
];

/*
Run the macro: renders the sub-tiddler "<title>/<sub>" with its images and text
*/
exports.run = function(title, sub, heading, tags, template, style) {
   var tiddler = this.wiki.getTiddler(title + "/" + sub);
   var parent = this.wiki.getTiddler(title);
   var ret = "";
   
   if (tiddler) {
	   if (template) {
		  ret += "<p class=\"" + template;
		  
		  if (style) {
			 ret += "\" style=\"" + style;
		  }
		  
		  ret += "\">";
	   }
	   
	   if (heading) {
		  ret += "<h3>" + heading + "</h3>";
	   }
	   
	   if (tags) {
	      ret += "<$list filter=\"[title[" + tiddler.fields.title + "]tags[]!title[" + sub + "]sort[title]]\" template=\"$:/core/ui/TagTemplate\" />";
	   }
	   
	   if (tiddler.fields.image) {
		  ret += "<div align=\"center\"><<image title=\"\"\"" + tiddler.fields.title + "\"\"\" parent=\"\"\"" + (parent ? parent.fields.title : "") + "\"\"\">></div>"
	   }
	   
       ret += "<$transclude tiddler=\"\"\"" + tiddler.fields.title + "\"\"\" mode=\"block\"/>";
	   
	   if (template) {
	      ret += "</p>";
	   }
   }
    
   return ret;
};

})();
