/*\
title: $:/plugins/dndwiki-core/modules/events.js
type: application/javascript
module-type: library
created: 20261001154438000
modified: 20261001154438000

The date field of an event, split into its points in time - shared by the event table
(filters/eventlist.js) and the timeline (widgets/timeline.js), so that both read it by the
same rules:

  "1351-07-01"                    one point in time
  "1351-07-01.1351-07-11"         several points, separated by "."
  "1351-06-27.1351-11-19."        a dot at the end: open end (the last point stays "continued")
  ".1489-06-05"                   a dot at the start: unknown beginning
  ""                              no date

Each point is "YYYY", "YYYY-MM" or "YYYY-MM-DD" (a time after it, "-10:00", is kept in text
only). Year, month and day stay strings as entered; calendar arithmetic lives in
modules/calendar.js.

\*/

"use strict";

/*
Returns {points, count, openStart, openEnd}:
  points     the non-empty parts in order: {text, index, year, month, day}; index is the
             position among all parts (empty ones included), month/day undefined if missing
  count      number of parts, empty ones included
  openStart  several parts and the first is empty
  openEnd    several parts and the last is empty
*/
exports.parse = function(text) {
	var parts = (text || "").trim() ? (text || "").trim().split(".") : [],
		points = [];
	for(var i = 0; i < parts.length; i++) {
		if(parts[i]) {
			var bits = parts[i].split("-");
			points.push({text: parts[i], index: i, year: bits[0], month: bits[1], day: bits[2]});
		}
	}
	return {
		points: points,
		count: parts.length,
		openStart: parts.length > 1 && !parts[0],
		openEnd: parts.length > 1 && !parts[parts.length - 1]
	};
};
