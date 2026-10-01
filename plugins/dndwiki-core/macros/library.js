/*\
title: library
type: application/javascript
module-type: library
\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

// Splits "YYYY-MM-DD" (optionally with further parts, e.g. a time "YYYY-MM-DD-10:00") into
// numbers; the rest stays as text. Invalid -> null. Calendar arithmetic lives in
// modules/calendar.js, this parser is calendar independent.
exports.parseDate = function(text) {
   var parts = (text || "").split("-");
   if (parts.length < 3) {
      return null;
   }
   var result = {
      year: parseInt(parts[0], 10),
      month: parseInt(parts[1], 10),
      day: parseInt(parts[2], 10),
      rest: parts.slice(3).join("-")
   };
   if (isNaN(result.year) || isNaN(result.month) || isNaN(result.day)) {
      return null;
   }
   return result;
};

exports.comparePropertyNumber = function(a, b) {
  return (a || b) ? (!a ? -1 : !b ? 1 : a.toString().localeCompare(b, undefined, {numeric: true, sensitivity: 'base'})) : 0;
};

})();
