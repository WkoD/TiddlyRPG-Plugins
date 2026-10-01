/*\
title: eventlist
type: application/javascript
module-type: filteroperator

Filter operator for the event table: one row per point in time from the date field
(points separated by "."), sorted by date, rows of the same year/month/day/event merged.
Without "!" prefix the order is reversed.

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var calendar = require("$:/plugins/dndwiki-core/modules/calendar.js"),
   language = require("$:/plugins/dndwiki-core/modules/language.js"),
   library = require("$:/plugins/dndwiki-core/macros/library");

// Internal flag values; the text is only translated on output
var FLAG_KEYS = {start: "Event/Start", end: "Event/End", cont: "Event/Continued"};

exports.eventlist = function(source,operator,options) {
   var wiki = options.wiki,
      cal = calendar.active(wiki);
   var result = prepare_results(source);
   var out = [];

   if (result.length === 0) {
      return out;
   }

   // sort by date
   result.sort(function(a, b) {
      var year = library.comparePropertyNumber(a.year, b.year);

      if (year === 0) {
         var month = library.comparePropertyNumber(a.month, b.month);

         if (month === 0) {
            var day = library.comparePropertyNumber(a.day, b.day);

            if (day === 0) {
               return a.order - b.order;
            } else {
                return day;
            }
         } else {
             return month;
         }
      } else {
          return year;
      }
   });

   // reverse for building the table
   if (operator.prefix !== "!") {
      result.reverse();
   }

   var flagText = function(flag) {
      return "//" + language.t(wiki, FLAG_KEYS[flag]) + "//";
   };

   // Month and day cells: through the calendar, or as entered without one
   var monthDay = function(month, day) {
      if (!month) {
         return [];
      }
      if (!cal) {
         return [month, day];
      }
      return calendar.monthDay(wiki, cal, month, day);
   };

   var lastresult = result[0];
   var yearmerge = 1;
   var monthmerge = 1;
   var daymerge = 1;
   var titlemerge = 1;
   var titleflag;

   for (var i = 0; i < result.length; ++i) {
      var entry = result[i + 1];
      var line = "<tr style=\"height: 1em\">";
      var same = false;
      var monthday = monthDay(lastresult.month, lastresult.day);

      // year
      if (entry && entry.year === lastresult.year) {
         same = true;
         yearmerge++;
      } else {
         line += "<td align=\"right\" rowspan=\"" + yearmerge + "\">" + lastresult.year + "</td>";
         yearmerge = 1;
      }

      // month
      if (same && entry.month === lastresult.month && (entry.day <= 30 || entry.day === lastresult.day)) {
         monthmerge++;
      } else if (lastresult.month) {
         line += "<td align=\"center\" rowspan=\"" + monthmerge + "\">" + monthday[0] + "</td>";
         same = false;
         monthmerge = 1;
      } else {
         line += "<td rowspan=\"" + monthmerge + "\"></td>";
         same = false;
         monthmerge = 1;
      }

      // day
      if (same && entry.day === lastresult.day) {
         daymerge++;
      } else if (monthday[1]) {
         line += "<td rowspan=\"" + daymerge + "\">" + monthday[1] + "</td>";
         daymerge = 1;
      } else {
         line += "<td rowspan=\"" + daymerge + "\"></td>";
         daymerge = 1;
      }

      if (entry && entry.title === lastresult.title) {
         if (titlemerge === 1) {
            titleflag = lastresult.flag;
         }

         titlemerge++;
      } else {
         line += "<td rowspan=\"" + titlemerge + "\">";

         if (lastresult.tt) {
            line += "__[[" + lastresult.title + "]]__";
         } else {
            line += "[[" + lastresult.title + "]]";
         }

         if (titleflag) {
            if (titleflag === lastresult.flag) {
               line += " " + flagText(titleflag);
            } else if (titleflag === "start" && lastresult.flag !== "end") {
               line += " " + flagText(titleflag);
            } else if (titleflag !== "start" && lastresult.flag === "end") {
               line += " " + flagText(lastresult.flag);
            }
         } else if (lastresult.flag) {
            line += " " + flagText(lastresult.flag);
         }

         line += "</td>";
         titlemerge = 1;
         titleflag = null;
      }

      line += "</tr>";

      out.push(line);
      lastresult = entry;
   }

   // back to the requested order
   out.reverse();

   return out;
};

// Numeric key YYYYMMDD; a missing month/day counts as 0
var dateKey = function(date) {
   return (parseInt(date[0], 10) || 0) * 10000 + (parseInt(date[1], 10) || 0) * 100 + (parseInt(date[2], 10) || 0);
};

var prepare_results = function (source) {
   var results = [];
   source(function(tiddler,title) {
      if (tiddler) {
         var hastag = tiddler.hasTag("Adventure");
         if (tiddler.fields.date) {
            // Points in time separated by "."; empty parts are skipped (a dot at the end =
            // open end: the last real point stays "continued")
            var dates = tiddler.fields.date.split(".");
            var flag = dates.length > 1 ? "start" : null;
            var prev = 0;

            for (var i = 0; i < dates.length; ++i) {
               if (dates[i]) {
                  var date = dates[i].split("-");
                  var key = dateKey(date);

                  if (i === 0) {
                     prev = key;
                  }

                  if (flag && (i === (dates.length - 1))) {
                     flag = "end";
                  }

                  // Order on the same day: later points (negative, depending on the distance to
                  // the previous point) before first points (1); several first points keep
                  // their input order
                  results.push({title: tiddler.fields.title, year: date[0], month: date[1], day: date[2], order: (key === prev ? 1 : -1 / (key - prev)), flag: flag, tt: hastag});

                  flag = "cont";
                  prev = key;
               }
            }
         } else {
            results.push({title: tiddler.fields.title, year: "????", month: null, day: null, order: 0, flag: null, tt: hastag});
         }
      }
   });
   return results;
};

})();
