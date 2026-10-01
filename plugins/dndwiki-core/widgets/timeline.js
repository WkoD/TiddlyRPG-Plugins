/*\
title: $:/plugins/dndwiki-core/widgets/timeline.js
type: application/javascript
module-type: widget
created: 20261001133844000
modified: 20261001160600000

Vertical, interactive timeline of event tiddlers.

<$dnd-timeline filter="[tag[Event]]"/>

Reads from bottom (old) to top (new) like the event table; events without a date follow at the
very bottom as "????".

Layout is computed with time running downwards and mirrored when drawing. One anchor per
distinct start day (plus the start of every year that has an event). Between anchors the axis
is proportional to the zoom (px per year), but an anchor never moves into the cards of the
previous one - dense stretches stretch the axis, sparse ones keep their scale. Gaps of several
years collapse into a break that can be opened by click. Spans (several points in time or an
open end) are bars in lanes next to the axis; lanes are assigned greedily and reused.
Positions come from the calendar engine (dayNumber), labels from monthDay, so festivals and
leap days count correctly.

At most L.maxLanes lanes: where more spans run side by side, they merge into one beam of that
width and continue inside it as thin threads, spread over the full width by the number of
threads at that height; where there is room again they leave it and get a lane of their own.
The free pieces get their lanes greedily, independently of the beams.

Year and month labels are vertical (read bottom to top like the time). A tick marks the exact
place; a label may slide along the axis as long as its tick stays within the text. Years win,
months and in-between years are fitted in or left out.

A selected span draws a line from every point in time on its bar to the card, all leaving the
card where its own connector ends.

Campaign events (with the player characters) are drawn solid, all other events dashed.

Interaction: hovering previews an event (highlight); a click or tap selects it - the highlight
stays and its card grows to show all points in time and the tags. Inside the selected card the
title and the tags are links; Ctrl/Cmd+click opens an event directly. A click on an empty spot
or on the selected card again clears the selection.

\*/

"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget,
	calendar = require("$:/plugins/dndwiki-core/modules/calendar.js"),
	eventDates = require("$:/plugins/dndwiki-core/modules/events.js"),
	language = require("$:/plugins/dndwiki-core/modules/language.js");

var SVGNS = "http://www.w3.org/2000/svg";

// Geometry in px
var L = {
	axisX: 34,       // axis line; the vertical year/month labels sit left of it
	labelX: 14,      // centre of the vertical label column
	laneGap: 16,     // axis -> first lane
	laneW: 8,        // lane pitch
	barW: 4,
	cardGap: 22,     // last lane -> cards
	cardH: 44,
	cardSpace: 6,    // between stacked cards
	pad: 24,         // top/bottom padding
	fade: 48,        // length of an open start/end
	breakH: 52,
	breakYears: 5,   // gaps from this length on collapse into a break
	minSpan: 10,     // shortest visible bar
	selectedW: 260,  // a selected card narrower than this widens to the left over the lanes
	maxLanes: 5,     // more spans side by side merge into one beam of this width
	thread: 1.5,     // width of a span inside a beam
	turn: 6          // half height of the curve where a span enters or leaves a beam
};

// Zoom levels: px per year (0 = compact, only the cards determine the spacing)
var ZOOM = [0,30,90,270,810,2430,7290];
var DEFAULT_ZOOM = 2;

var CONFIG = "$:/config/dndwiki/calendar";

// Spans get a colour per lane so that bar and card belong together at a glance; single
// events keep the colour of their type hub
var LANE_COLOURS = ["#2a9d8f","#e76f51","#7b61ff","#e9a400","#3a86ff","#d1495b","#43aa8b","#b5179e","#577590","#f3722c"];

var UNKNOWN = "????";

var TimelineWidget = function(parseTreeNode,options) {
	this.initialise(parseTreeNode,options);
};

TimelineWidget.prototype = new Widget();

TimelineWidget.prototype.render = function(parent,nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	if(this.zoom === undefined) {
		this.zoom = DEFAULT_ZOOM;
		this.gaps = true;
		this.expanded = Object.create(null);
	}
	var doc = this.document;
	this.domNode = doc.createElement("div");
	this.domNode.className = "dnd-tl";
	this.toolbar = doc.createElement("div");
	this.toolbar.className = "dnd-tl-toolbar";
	this.domNode.appendChild(this.toolbar);
	this.scroller = doc.createElement("div");
	this.scroller.className = "dnd-tl-scroll";
	this.domNode.appendChild(this.scroller);
	parent.insertBefore(this.domNode,nextSibling);
	this.domNodes.push(this.domNode);
	this.data = this.collect();
	// The selection survives a refresh by title: positions change when events change
	var self = this;
	this.selected = undefined;
	this.hovered = undefined;
	this.shown = undefined;
	$tw.utils.each(this.data.all,function(ev) {
		if(ev.title === self.selectedTitle) {
			self.selected = ev.idx;
		}
	});
	this.drawToolbar();
	this.drawCanvas();
	this.bindEvents();
};

TimelineWidget.prototype.execute = function() {
	this.filter = this.getAttribute("filter","[tag[Event]]");
	this.list = this.wiki.filterTiddlers(this.filter,this);
};

TimelineWidget.prototype.refresh = function(changedTiddlers) {
	var changedAttributes = this.computeAttributes(),
		calTitle = (this.wiki.getTiddlerText(CONFIG,"") || "").trim();
	if(changedAttributes.filter || changedTiddlers["$:/language"] || changedTiddlers[CONFIG] ||
		(calTitle && changedTiddlers[calTitle]) || changedTiddlers.Event || changedTiddlers.Campaign) {
		this.refreshSelf();
		return true;
	}
	var list = this.wiki.filterTiddlers(this.filter,this);
	if(list.join("\n") !== this.list.join("\n") || list.some(function(title) { return changedTiddlers[title]; })) {
		this.refreshSelf();
		return true;
	}
	return false;
};

/* ---------- Data ---------- */

function makeCal(wiki) {
	var cal = calendar.active(wiki);
	if(cal) {
		return {
			cal: cal,
			months: cal.months.length,
			perYear: cal.yearBase + (cal.every > 0 ? cal.leapExtra / cal.every : 0),
			dn: function(y,m,d) { return calendar.dayNumber(cal,y,m,d); },
			monthLength: function(y,m) { return calendar.monthLength(cal,y,m); }
		};
	}
	// Without a calendar: 12 months of 30 days, only for the positions
	return {
		cal: null,
		months: 12,
		perYear: 360,
		dn: function(y,m,d) { return y * 360 + (m - 1) * 30 + d; },
		monthLength: function() { return 30; }
	};
}

// A point from modules/events.js as numbers plus the range of days it can mean; null if no year
function toPoint(point,C) {
	var y = parseInt(point.year,10),
		m = parseInt(point.month,10),
		d = parseInt(point.day,10),
		text = point.text;
	if(isNaN(y)) {
		return null;
	}
	m = isNaN(m) || m < 1 ? 0 : Math.min(m,C.months);
	d = !m || isNaN(d) || d < 1 ? 0 : d;
	var p = {y: y, m: m, d: d, text: text};
	// Earliest and latest day the point can mean (a year without month = the whole year)
	p.lo = C.dn(y,m || 1,d || 1);
	p.hi = d ? p.lo : (m ? C.dn(y,m,C.monthLength(y,m)) : C.dn(y,C.months,C.monthLength(y,C.months)));
	return p;
}

function monthName(wiki,C,m) {
	return calendar.monthDay(wiki,C.cal,m.toString(),"")[0].replace(/\s*\(\d+(\/\d+)?\)$/,"");
}

function pointLabel(wiki,C,p) {
	if(!p.m) {
		return p.y.toString();
	}
	if(!C.cal) {
		return p.text;
	}
	var md = calendar.monthDay(wiki,C.cal,p.m.toString(),p.d ? p.d.toString() : ""),
		month = md[0].replace(/\s*\(\d+(\/\d+)?\)$/,"");
	if(md[1]) {
		return language.format(language.t(wiki,"Date/DayMonth"),{day: md[1], month: month}) + " " + p.y;
	}
	return month + " " + p.y;
}

// Colour of a tiddler: own color field, else that of its first tag with one (type hub)
function colourOf(wiki,title) {
	var tiddler = wiki.getTiddler(title);
	if(!tiddler) {
		return null;
	}
	if(tiddler.fields.color) {
		return tiddler.fields.color;
	}
	var tags = tiddler.fields.tags || [];
	for(var i = 0; i < tags.length; i++) {
		var tag = wiki.getTiddler(tags[i]);
		if(tag && tag.fields.color) {
			return tag.fields.color;
		}
	}
	return null;
}

function byTitle(a,b) {
	return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
}

TimelineWidget.prototype.collect = function() {
	var wiki = this.wiki,
		C = makeCal(wiki),
		events = [],
		undated = [],
		eventColour = colourOf(wiki,"Event") || "#48a4ff",
		campaignColour = colourOf(wiki,"Campaign") || "#0069d2";
	$tw.utils.each(this.list,function(title) {
		var tiddler = wiki.getTiddler(title);
		if(!tiddler) {
			return;
		}
		var parsed = eventDates.parse(tiddler.fields.date),
			points = [],
			campaign = tiddler.hasTag("Campaign"),
			ev = {
				title: title,
				campaign: campaign,
				colour: campaign ? campaignColour : eventColour,
				tags: (tiddler.fields.tags || []).filter(function(tag) {
					return tag !== "Event" && tag !== "Campaign";
				})
			};
		$tw.utils.each(parsed.points,function(point) {
			var p = toPoint(point,C);
			if(p) {
				points.push(p);
			}
		});
		if(points.length === 0) {
			ev.undated = true;
			ev.points = [];
			ev.label = UNKNOWN;
			undated.push(ev);
			return;
		}
		ev.points = points;
		ev.openStart = parsed.openStart;
		ev.openEnd = parsed.openEnd;
		ev.span = points.length > 1 || ev.openStart || ev.openEnd;
		ev.start = points[0].lo;
		ev.end = points[points.length - 1].hi;
		var first = points[0],
			last = points[points.length - 1],
			sameYear = points.length > 1 && !ev.openEnd && first.y === last.y && first.m;
		if(!ev.span) {
			ev.label = pointLabel(wiki,C,first);
		} else if(ev.openStart && points.length === 1) {
			ev.label = "? – " + pointLabel(wiki,C,first);
		} else {
			ev.label = (ev.openStart ? "?" : (sameYear ? pointLabel(wiki,C,first).replace(/ -?\d+$/,"") : pointLabel(wiki,C,first))) + " – " +
				(ev.openEnd ? language.t(wiki,"Timeline/Open") : pointLabel(wiki,C,last));
		}
		events.push(ev);
	});
	events.sort(function(a,b) {
		return (a.start - b.start) || (b.end - a.end) || byTitle(a,b);
	});
	undated.sort(byTitle);
	var all = events.concat(undated);
	$tw.utils.each(all,function(ev,i) {
		ev.idx = i;
	});
	return {C: C, events: events, undated: undated, all: all};
};

/* ---------- Layout (time runs downwards here; drawing mirrors it) ---------- */

TimelineWidget.prototype.layout = function() {
	var self = this,
		C = this.data.C,
		events = this.data.events,
		perDay = ZOOM[this.zoom] / C.perYear,
		// Before the first / after the last anchor at least a little scale, also when compact
		edgePerDay = Math.max(perDay,30 / C.perYear),
		byDay = Object.create(null),
		anchors = [],
		breaks = [];
	if(events.length === 0) {
		return {anchors: [], breaks: [], lanes: 0, height: 0, axisStart: 0, axisEnd: 0, yOf: function() { return 0; }};
	}
	function anchor(day) {
		if(!byDay[day]) {
			byDay[day] = {day: day, events: [], year: null};
			anchors.push(byDay[day]);
		}
		return byDay[day];
	}
	$tw.utils.each(events,function(ev) {
		anchor(ev.start).events.push(ev);
		var year = ev.points[0].y;
		anchor(C.dn(year,1,1)).year = year;
	});
	anchors.sort(function(a,b) { return a.day - b.day; });
	var anyOpenStart = events.some(function(ev) { return ev.openStart; }),
		half = L.cardH / 2,
		step = L.cardH + L.cardSpace,
		prev = null;
	$tw.utils.each(anchors,function(a) {
		if(!prev) {
			a.y = L.pad + (anyOpenStart ? L.fade : 0) + half;
		} else {
			var gap = a.day - prev.day,
				key = prev.day + ":" + a.day,
				minY = prev.bottom + L.cardSpace + (a.events.length ? half : 10);
			if(self.gaps && gap >= L.breakYears * C.perYear && !self.expanded[key]) {
				var b = {key: key, from: prev.day, to: a.day, years: Math.round(gap / C.perYear), y0: prev.bottom + 10};
				b.y1 = b.y0 + L.breakH;
				breaks.push(b);
				a.y = b.y1 + 10 + (a.events.length ? half : 10);
			} else {
				a.y = Math.max(prev.y + gap * perDay,minY);
			}
		}
		a.bottom = a.y + (a.events.length ? (a.events.length - 1) * step + half : 10);
		prev = a;
	});
	function yOf(day) {
		var first = anchors[0],
			last = anchors[anchors.length - 1];
		if(day <= first.day) {
			return first.y - (first.day - day) * edgePerDay;
		}
		if(day >= last.day) {
			return last.y + (day - last.day) * edgePerDay;
		}
		// Binary search for the surrounding anchors, linear in between
		var lo = 0, hi = anchors.length - 1;
		while(hi - lo > 1) {
			var mid = (lo + hi) >> 1;
			if(anchors[mid].day <= day) {
				lo = mid;
			} else {
				hi = mid;
			}
		}
		var a = anchors[lo], b = anchors[hi];
		return a.y + (b.y - a.y) * (day - a.day) / (b.day - a.day);
	}
	// Cards: stacked after their anchor in sort order
	var bottom = anchors[anchors.length - 1].bottom;
	$tw.utils.each(anchors,function(a) {
		$tw.utils.each(a.events,function(ev,k) {
			ev.cardY = a.y + k * step;
			ev.y0 = a.y;
		});
	});
	// Bars; the end of open spans is the end of the axis
	$tw.utils.each(events,function(ev) {
		if(ev.span) {
			ev.y1 = Math.max(yOf(ev.end),ev.y0 + L.minSpan);
			if(!ev.openEnd) {
				bottom = Math.max(bottom,ev.y1);
			}
		}
	});
	var axisEnd = bottom + (events.some(function(ev) { return ev.openEnd; }) ? L.fade : 0) + 8,
		axisStart = L.pad;
	$tw.utils.each(events,function(ev) {
		if(!ev.span) {
			return;
		}
		if(ev.openEnd) {
			ev.y1 = Math.max(axisEnd,ev.y1);
		}
		if(ev.openStart) {
			// The known point is the end; the bar comes from the oldest end of the axis
			ev.y1 = ev.points.length === 1 ? ev.y0 : ev.y1;
			ev.y0 = axisStart;
		}
		ev.ticks = ev.points.slice(1,ev.openEnd ? undefined : -1).map(function(p) {
			return yOf(p.lo);
		});
		if(ev.openStart && ev.points.length > 1) {
			ev.ticks.unshift(yOf(ev.points[0].lo));
		}
		// Uncertain ends (only year or month known) fade in/out over their range
		ev.solid0 = ev.openStart ? ev.y0 + L.fade : Math.max(ev.y0,Math.min(yOf(ev.points[0].hi),ev.y1));
		ev.solid1 = ev.openEnd ? ev.y1 - L.fade : Math.min(ev.y1,Math.max(yOf(ev.points[ev.points.length - 1].lo),ev.y0));
	});
	// Lanes: greedy, by pixels
	var lanes = [];
	$tw.utils.each(events.filter(function(ev) { return ev.span; }).sort(function(a,b) {
		return (a.y0 - b.y0) || (b.y1 - a.y1);
	}),function(ev) {
		for(var l = 0; l < lanes.length; l++) {
			if(lanes[l] + 8 < ev.y0) {
				break;
			}
		}
		lanes[l] = ev.y1;
		ev.lane = l;
		ev.colour = LANE_COLOURS[l % LANE_COLOURS.length];
	});
	// Beams: stretches with more than maxLanes spans side by side (the greedy lanes above stay
	// for colour and thread order)
	var spans = events.filter(function(ev) { return ev.span; }),
		bundles = [];
	if(lanes.length > L.maxLanes) {
		var marks = [],
			count = 0,
			open = null;
		$tw.utils.each(spans,function(ev) {
			marks.push([ev.y0,1]);
			marks.push([ev.y1 + 8,-1]);
		});
		marks.sort(function(a,b) { return (a[0] - b[0]) || (a[1] - b[1]); });
		$tw.utils.each(marks,function(m) {
			count += m[1];
			if(count > L.maxLanes && open === null) {
				open = m[0];
			} else if(count <= L.maxLanes && open !== null) {
				var last = bundles[bundles.length - 1];
				// A short free stretch between two beams is not worth leaving the beam
				if(last && open - last.y1 < 40) {
					last.y1 = m[0];
				} else {
					bundles.push({y0: open, y1: m[0]});
				}
				open = null;
			}
		});
		$tw.utils.each(bundles,function(b) {
			b.members = spans.filter(function(ev) {
				return ev.y0 < b.y1 && ev.y1 > b.y0;
			}).sort(function(a,c) { return a.lane - c.lane; });
			// Slices between the points where a thread enters or leaves: the threads present
			// share the full width
			var cuts = [b.y0,b.y1];
			$tw.utils.each(b.members,function(ev) {
				if(ev.y0 > b.y0 && ev.y0 < b.y1) {
					cuts.push(ev.y0);
				}
				if(ev.y1 > b.y0 && ev.y1 < b.y1) {
					cuts.push(ev.y1);
				}
			});
			cuts.sort(function(x,y) { return x - y; });
			b.slices = [];
			for(var i = 0; i < cuts.length - 1; i++) {
				if(cuts[i + 1] > cuts[i]) {
					b.slices.push({y0: cuts[i], y1: cuts[i + 1], threads: b.members.filter(function(ev) {
						return ev.y0 < cuts[i + 1] && ev.y1 > cuts[i];
					})});
				}
			}
		});
	}
	// Pieces of every span: inside a beam or free
	var free = [];
	$tw.utils.each(spans,function(ev) {
		var pieces = [],
			y = ev.y0;
		$tw.utils.each(bundles,function(b) {
			if(b.y1 <= ev.y0 || b.y0 >= ev.y1) {
				return;
			}
			if(b.y0 > y) {
				pieces.push({y0: y, y1: b.y0});
			}
			$tw.utils.each(b.slices,function(slice) {
				var y0 = Math.max(slice.y0,ev.y0),
					y1 = Math.min(slice.y1,ev.y1),
					k = slice.threads.indexOf(ev),
					n = slice.threads.length,
					last = pieces[pieces.length - 1];
				if(y1 <= y0 || k === -1) {
					return;
				}
				if(last && last.bundle === b && last.k === k && last.n === n) {
					last.y1 = y1;
				} else {
					pieces.push({y0: y0, y1: y1, bundle: b, k: k, n: n});
				}
			});
			y = Math.min(b.y1,ev.y1);
		});
		if(y < ev.y1) {
			pieces.push({y0: y, y1: ev.y1});
		}
		$tw.utils.each(pieces,function(piece) {
			if(!piece.bundle) {
				free.push(piece);
			}
		});
		ev.pieces = pieces;
	});
	// Free pieces: greedy lanes; outside the beams there are never more than maxLanes
	var freeLanes = [];
	$tw.utils.each(free.sort(function(a,b) { return (a.y0 - b.y0) || (b.y1 - a.y1); }),function(piece) {
		for(var l = 0; l < freeLanes.length; l++) {
			if(freeLanes[l] + 8 < piece.y0) {
				break;
			}
		}
		if(bundles.length && l >= L.maxLanes) {
			// Safety net (touching ends): share the lane that frees up first
			l = freeLanes.indexOf(Math.min.apply(null,freeLanes));
		}
		freeLanes[l] = Math.max(freeLanes[l] === undefined ? -Infinity : freeLanes[l],piece.y1);
		piece.lane = l;
	});
	return {
		anchors: anchors,
		breaks: breaks,
		bundles: bundles,
		yOf: yOf,
		lanes: bundles.length ? L.maxLanes : lanes.length,
		height: axisEnd + L.pad,
		axisStart: axisStart,
		axisEnd: axisEnd
	};
};

/* ---------- Drawing ---------- */

function svg(doc,tag,attrs,parent) {
	var el = doc.createElementNS(SVGNS,tag);
	$tw.utils.each(attrs,function(value,name) {
		el.setAttribute(name,value);
	});
	if(parent) {
		parent.appendChild(el);
	}
	return el;
}

TimelineWidget.prototype.t = function(key,values) {
	var text = language.t(this.wiki,key);
	return values ? language.format(text,values) : text;
};

TimelineWidget.prototype.button = function(text,tooltip,action,pressed) {
	var self = this,
		btn = this.document.createElement("button");
	btn.className = "dnd-tl-button" + (pressed ? " dnd-tl-pressed" : "");
	btn.setAttribute("title",tooltip);
	btn.appendChild(this.document.createTextNode(text));
	if(btn.addEventListener) {
		btn.addEventListener("click",function(event) {
			action.call(self,event);
		},false);
	}
	this.toolbar.appendChild(btn);
	return btn;
};

TimelineWidget.prototype.drawToolbar = function() {
	while(this.toolbar.firstChild) {
		this.toolbar.removeChild(this.toolbar.firstChild);
	}
	var self = this;
	this.button("−",this.t("Timeline/ZoomOut"),function() { self.setZoom(self.zoom - 1); });
	this.button("+",this.t("Timeline/ZoomIn"),function() { self.setZoom(self.zoom + 1); });
	var scale = this.document.createElement("span");
	scale.className = "dnd-tl-scale";
	for(var z = 0; z < ZOOM.length; z++) {
		var dot = this.document.createElement("span");
		dot.className = "dnd-tl-scale-dot" + (z <= this.zoom ? " dnd-tl-on" : "");
		scale.appendChild(dot);
	}
	this.toolbar.appendChild(scale);
	this.button(this.t("Timeline/Gaps"),this.t("Timeline/GapsHint"),function() {
		self.gaps = !self.gaps;
		self.expanded = Object.create(null);
		self.drawToolbar();
		self.drawCanvas();
	},this.gaps);
	var hint = this.document.createElement("span");
	hint.className = "dnd-tl-hint";
	hint.appendChild(this.document.createTextNode(this.t("Timeline/WheelHint")));
	this.toolbar.appendChild(hint);
};

TimelineWidget.prototype.drawCanvas = function() {
	var self = this,
		doc = this.document,
		wiki = this.wiki,
		C = this.data.C,
		events = this.data.events,
		undated = this.data.undated;
	while(this.scroller.firstChild) {
		this.scroller.removeChild(this.scroller.firstChild);
	}
	this.nodesByIdx = [];
	this.shown = undefined;
	if(events.length === 0 && undated.length === 0) {
		return;
	}
	var lay = this.layout(),
		H = lay.height,
		// Mirror: layout time runs downwards, the drawing has the newest at the top
		Y = function(y) { return H - y; },
		step = L.cardH + L.cardSpace,
		undatedTop = H + (events.length ? 8 : L.pad),
		total = undated.length ? undatedTop + undated.length * step + L.pad : H;
	this.lay = lay;
	this.H = H;
	var laneX = function(l) { return L.axisX + L.laneGap + l * L.laneW; },
		beamLeft = laneX(0) - L.barW / 2,
		beamW = laneX(L.maxLanes - 1) - laneX(0) + L.barW,
		pieceX = function(piece) {
			return piece.bundle ? beamLeft + (piece.k + 0.5) * beamW / piece.n : laneX(piece.lane);
		},
		// x of a span at layout height y
		spanX = function(ev,y) {
			for(var i = 0; i < ev.pieces.length; i++) {
				if(y <= ev.pieces[i].y1 || i === ev.pieces.length - 1) {
					return pieceX(ev.pieces[i]);
				}
			}
		},
		inBeam = function(ev,y) {
			for(var i = 0; i < ev.pieces.length; i++) {
				if(y <= ev.pieces[i].y1) {
					return !!ev.pieces[i].bundle;
				}
			}
			return false;
		},
		cardX = laneX(lay.lanes) + L.cardGap - (lay.lanes ? L.laneW / 2 : 0),
		canvas = doc.createElement("div");
	canvas.className = "dnd-tl-canvas";
	canvas.style.height = total + "px";
	this.scroller.appendChild(canvas);
	this.canvas = canvas;
	var root = svg(doc,"svg",{"class": "dnd-tl-svg", width: cardX, height: total});
	canvas.appendChild(root);
	var defs = svg(doc,"defs",{},root),
		gLines = svg(doc,"g",{"class": "dnd-tl-connectors"},root),
		gAxis = svg(doc,"g",{"class": "dnd-tl-axis"},root),
		gBars = svg(doc,"g",{"class": "dnd-tl-bars"},root),
		gDots = svg(doc,"g",{"class": "dnd-tl-dots"},root),
		// The connectors of the highlighted event move up here, above all bars and beams
		gTop = svg(doc,"g",{"class": "dnd-tl-top"},root);
	var remember = function(idx,node) {
		(self.nodesByIdx[idx] = self.nodesByIdx[idx] || []).push(node);
		node.setAttribute("data-idx",idx);
	};
	var axisLine = function(y0,y1,cls) {
		svg(doc,"line",{"class": cls || "dnd-tl-axis-line", x1: L.axisX, x2: L.axisX, y1: y0, y2: y1},gAxis);
	};
	var connector = function(ev,x0,y0,cy) {
		var path = "M" + x0 + " " + y0 + " C" + (x0 + 28) + " " + y0 + " " + (cardX - 28) + " " + cy + " " + cardX + " " + cy;
		remember(ev.idx,svg(doc,"path",{"class": "dnd-tl-connector", d: path, stroke: ev.colour},gLines));
	};
	var card = function(ev,cy) {
		var node = doc.createElement("div");
		node.className = "dnd-tl-card " + (ev.campaign ? "dnd-tl-campaign" : "dnd-tl-other");
		node.style.top = cy - L.cardH / 2 + "px";
		node.style.left = cardX + "px";
		node.setAttribute("data-left",cardX);
		node.style.minHeight = L.cardH + "px";
		node.style.borderLeftColor = ev.colour;
		var meta = doc.createElement("div");
		meta.className = "dnd-tl-date";
		meta.appendChild(doc.createTextNode(ev.label));
		$tw.utils.each(ev.tags,function(tag) {
			var dot = doc.createElement("span"),
				colour = colourOf(wiki,tag);
			dot.className = "dnd-tl-tagdot";
			if(colour) {
				dot.style.backgroundColor = colour;
			}
			dot.setAttribute("title",language.title(wiki,tag) || tag);
			meta.appendChild(dot);
		});
		node.appendChild(meta);
		var link = doc.createElement("a");
		link.className = "dnd-tl-title tc-tiddlylink tc-tiddlylink-resolves";
		link.setAttribute("href","#" + encodeURIComponent(ev.title));
		link.setAttribute("data-title",ev.title);
		link.appendChild(doc.createTextNode(language.title(wiki,ev.title) || ev.title));
		node.appendChild(link);
		node.appendChild(self.details(ev));
		remember(ev.idx,node);
		canvas.appendChild(node);
	};
	var point = function(ev,cy) {
		remember(ev.idx,svg(doc,"circle",{
			"class": "dnd-tl-point " + (ev.campaign ? "dnd-tl-campaign" : "dnd-tl-other"),
			cx: L.axisX, cy: cy, r: 6,
			fill: ev.campaign ? ev.colour : "none", stroke: ev.colour
		},gDots));
	};
	// Labels are collected and placed at the end (see placeLabels)
	var labels = [];
	var label = function(text,y,major,priority) {
		labels.push({text: text, y: y, major: major, priority: priority, half: (text.length * (major ? 7.4 : 5.8) + 4) / 2});
	};
	if(events.length) {
		// Axis, broken at the gaps (in layout coordinates, mirrored)
		var segStart = lay.axisStart;
		$tw.utils.each(lay.breaks,function(b) {
			axisLine(Y(segStart),Y(b.y0));
			var top = Y(b.y1),
				zig = "M" + L.axisX + " " + top;
			for(var y = top + 6, side = 1; y < Y(b.y0) - 2; y += 6, side = -side) {
				zig += " L" + (L.axisX + 4 * side) + " " + y;
			}
			zig += " L" + L.axisX + " " + Y(b.y0);
			svg(doc,"path",{"class": "dnd-tl-axis-break", d: zig},gAxis);
			segStart = b.y1;
			var node = doc.createElement("div");
			node.className = "dnd-tl-break";
			node.style.top = (top + Y(b.y0)) / 2 - 10 + "px";
			node.style.left = L.axisX + 12 + "px";
			node.setAttribute("title",self.t("Timeline/Expand"));
			node.appendChild(doc.createTextNode("⋯ " + self.t("Timeline/Gap",{n: b.years}) + " ⋯"));
			if(node.addEventListener) {
				node.addEventListener("click",function() {
					self.expanded[b.key] = true;
					self.drawCanvas();
				},false);
			}
			canvas.appendChild(node);
		});
		axisLine(Y(segStart),Y(lay.axisEnd));
		// Year labels: anchor years first, then months, then the years in between
		$tw.utils.each(lay.anchors,function(a) {
			if(a.year !== null) {
				label(a.year.toString(),Y(a.y),true,3);
			}
		});
		var lastMonth = null;
		$tw.utils.each(lay.anchors,function(a) {
			var p = a.events.length ? a.events[0].points[0] : null;
			if(!p || !p.m || !C.cal || a.events[0].openStart) {
				return;
			}
			var key = p.y + "-" + p.m;
			if(key !== lastMonth) {
				lastMonth = key;
				label(monthName(wiki,C,p.m),Y(a.y),false,2);
			}
		});
		if(ZOOM[this.zoom] > 0) {
			var firstYear = events[0].points[0].y,
				lastYear = Math.floor(lay.anchors[lay.anchors.length - 1].day / C.perYear) + 1;
			for(var year = firstYear; year <= lastYear; year++) {
				var day = C.dn(year,1,1),
					inBreak = lay.breaks.some(function(b) { return day > b.from && day < b.to; });
				if(!inBreak) {
					var yy = lay.yOf(day);
					if(yy > lay.axisStart && yy < lay.axisEnd) {
						label(year.toString(),Y(yy),false,1);
					}
				}
			}
		}
	}
	this.spanX = spanX;
	this.gLines = gLines;
	this.gTop = gTop;
	// Beams behind the spans
	$tw.utils.each(lay.bundles,function(b) {
		svg(doc,"rect",{"class": "dnd-tl-beam", x: beamLeft - 3, y: Y(b.y1), width: beamW + 6, height: b.y1 - b.y0, rx: 7},gBars);
	});
	// Dated events
	$tw.utils.each(events,function(ev) {
		var cy = Y(ev.cardY),
			x0 = ev.span ? spanX(ev,ev.openStart ? ev.cardY : ev.y0) : L.axisX,
			y0 = Y(ev.y0);
		if(ev.span && ev.openStart) {
			connector(ev,x0,cy,cy);
		} else {
			connector(ev,x0,y0,cy);
		}
		if(ev.span) {
			var w = L.barW,
				gid = "dnd-tl-g-" + self.uid() + "-" + ev.idx,
				h = ev.y1 - ev.y0,
				grad = svg(doc,"linearGradient",{id: gid, gradientUnits: "userSpaceOnUse", x1: 0, y1: Y(ev.y0), x2: 0, y2: Y(ev.y1)},defs),
				stop = function(y,opacity) {
					svg(doc,"stop",{offset: Math.min(1,Math.max(0,(y - ev.y0) / h)), "stop-color": ev.colour, "stop-opacity": opacity},grad);
				};
			stop(ev.y0,ev.openStart ? 0 : (ev.points[0].d ? 1 : 0.25));
			stop(ev.solid0,1);
			stop(ev.solid1,1);
			stop(ev.y1,ev.openEnd ? 0 : (ev.points[ev.points.length - 1].d ? 1 : 0.25));
			var g = svg(doc,"g",{"class": "dnd-tl-bar " + (ev.campaign ? "dnd-tl-campaign" : "dnd-tl-other")},gBars),
				thick = "",
				thin = "";
			// Free pieces thick, pieces in a beam thin; a short curve where the lane changes
			$tw.utils.each(ev.pieces,function(piece,i) {
				var x = pieceX(piece),
					prev = ev.pieces[i - 1],
					next = ev.pieces[i + 1],
					turnIn = prev ? Math.min(L.turn,(piece.y1 - piece.y0) / 2) : 0,
					turnOut = next ? Math.min(L.turn,(piece.y1 - piece.y0) / 2) : 0,
					d = "M" + x + " " + Y(piece.y0 + turnIn) + " L" + x + " " + Y(piece.y1 - turnOut);
				if(piece.bundle) {
					thin += d;
				} else {
					thick += d;
				}
				if(next) {
					var nx = pieceX(next),
						nTurn = Math.min(L.turn,(next.y1 - next.y0) / 2);
					thin += "M" + x + " " + Y(piece.y1 - turnOut) + " C" + x + " " + Y(piece.y1) + " " + nx + " " + Y(piece.y1) + " " + nx + " " + Y(piece.y1 + nTurn);
				}
			});
			if(thick) {
				svg(doc,"path",{"class": "dnd-tl-stroke", d: thick, fill: "none", stroke: "url(#" + gid + ")", "stroke-width": w},g);
			}
			if(thin) {
				svg(doc,"path",{"class": "dnd-tl-thread", d: thin, fill: "none", stroke: "url(#" + gid + ")", "stroke-width": L.thread},g);
			}
			// Wider invisible hit area along the whole span
			svg(doc,"path",{"class": "dnd-tl-hit", d: thick + thin, fill: "none"},g);
			if(!ev.openStart) {
				svg(doc,"circle",{"class": "dnd-tl-start", cx: x0, cy: y0, r: inBeam(ev,ev.y0) ? 2.5 : w / 2 + 1.5, fill: ev.colour},g);
			}
			$tw.utils.each(ev.ticks,function(ty) {
				svg(doc,"circle",{"class": "dnd-tl-mid", cx: spanX(ev,ty), cy: Y(ty), r: inBeam(ev,ty) ? 1.8 : 2.5, stroke: ev.colour},g);
			});
			remember(ev.idx,g);
		} else {
			point(ev,y0);
		}
		card(ev,cy);
	});
	// Undated events at the very bottom: one shared point like events of the same date,
	// cards stacked upwards from it
	if(undated.length) {
		var at = undatedTop + (undated.length - 1) * step + L.cardH / 2;
		axisLine(undatedTop - 8,at,"dnd-tl-axis-line dnd-tl-axis-unknown");
		label(UNKNOWN,at,true,3);
		$tw.utils.each(undated,function(ev,k) {
			var cy = at - k * step;
			connector(ev,L.axisX,at,cy);
			point(ev,at);
			card(ev,cy);
		});
	}
	this.placeLabels(labels,total,gAxis);
	this.highlight();
};

// Vertical labels: by priority, each as close to its tick as possible without overlapping
// another; the tick has to stay within the text, otherwise the label is left out
TimelineWidget.prototype.placeLabels = function(labels,height,parent) {
	var doc = this.document,
		placed = [],
		gap = 6;
	labels.sort(function(a,b) { return (b.priority - a.priority) || (a.y - b.y); });
	$tw.utils.each(labels,function(lb) {
		var candidates = [lb.y],
			best = null,
			i;
		for(i = 0; i < placed.length; i++) {
			candidates.push(placed[i].c + placed[i].half + gap + lb.half);
			candidates.push(placed[i].c - placed[i].half - gap - lb.half);
		}
		$tw.utils.each(candidates,function(c) {
			if(Math.abs(c - lb.y) > lb.half - 2 || c - lb.half < 2 || c + lb.half > height - 2) {
				return;
			}
			for(var j = 0; j < placed.length; j++) {
				if(c + lb.half + gap > placed[j].c - placed[j].half && c - lb.half - gap < placed[j].c + placed[j].half) {
					return;
				}
			}
			if(best === null || Math.abs(c - lb.y) < Math.abs(best - lb.y)) {
				best = c;
			}
		});
		if(best === null && !lb.major) {
			return;
		}
		svg(doc,"line",{"class": "dnd-tl-tick" + (lb.major ? " dnd-tl-major" : ""), x1: L.axisX - (lb.major ? 7 : 4), x2: L.axisX, y1: lb.y, y2: lb.y},parent);
		if(best === null) {
			return;
		}
		lb.c = best;
		placed.push(lb);
		var text = svg(doc,"text",{
			"class": lb.major ? "dnd-tl-year dnd-tl-major" : (lb.priority === 1 ? "dnd-tl-year" : "dnd-tl-month"),
			x: L.labelX, y: best, "text-anchor": "middle", "dominant-baseline": "central",
			transform: "rotate(-90 " + L.labelX + " " + best + ")"
		},parent);
		text.appendChild(doc.createTextNode(lb.text));
	});
};

// Selected span: a line from every point in time on its bar, all leaving the card at one spot
TimelineWidget.prototype.drawExtras = function() {
	var self = this,
		doc = this.document;
	$tw.utils.each(this.extras || [],function(node) {
		if(node.parentNode) {
			node.parentNode.removeChild(node);
		}
	});
	this.extras = [];
	var idx = this.selected,
		ev = idx !== undefined ? this.data.all[idx] : null;
	if(!ev || !ev.span || !this.gLines || !this.nodesByIdx[idx]) {
		return;
	}
	var card = null;
	$tw.utils.each(this.nodesByIdx[idx],function(node) {
		if(typeof node.className === "string" && node.className.indexOf("dnd-tl-card") !== -1) {
			card = node;
		}
	});
	if(!card || !card.querySelectorAll) {
		return;
	}
	var left = parseFloat(card.style.left),
		top = card.offsetTop;
	$tw.utils.each(card.querySelectorAll("[data-y]"),function(line) {
		var y = parseFloat(line.getAttribute("data-y")),
			x0 = self.spanX(ev,y),
			y0 = self.H - y,
			cy = top + L.cardH / 2;
		self.extras.push(svg(doc,"path",{
			"class": "dnd-tl-connector dnd-tl-extra",
			d: "M" + x0 + " " + y0 + " C" + (x0 + 28) + " " + y0 + " " + (left - 28) + " " + cy + " " + left + " " + cy,
			stroke: ev.colour
		},self.gTop));
		self.extras.push(svg(doc,"circle",{"class": "dnd-tl-extra-dot", cx: x0, cy: y0, r: 3.5, stroke: ev.colour},self.gTop));
	});
};

// Extra lines of a selected card: all points in time, then the tags as links
TimelineWidget.prototype.details = function(ev) {
	var self = this,
		doc = this.document,
		wiki = this.wiki,
		C = this.data.C,
		box = doc.createElement("div");
	box.className = "dnd-tl-details";
	// One date per line, oldest first; "?" and "open" stand in for an open start/end
	var line = function(text,y) {
		var div = doc.createElement("div");
		div.className = "dnd-tl-point-date";
		if(y !== undefined) {
			div.setAttribute("data-y",y);
		}
		div.appendChild(doc.createTextNode(text));
		box.appendChild(div);
	};
	if(ev.span) {
		if(ev.openStart) {
			line("?");
		}
		$tw.utils.each(ev.points,function(p,i) {
			var first = i === 0 && !ev.openStart,
				last = i === ev.points.length - 1 && !ev.openEnd,
				y = first ? ev.y0 : (last ? ev.y1 : self.lay.yOf(p.lo));
			line(pointLabel(wiki,C,p),y);
		});
		if(ev.openEnd) {
			line(this.t("Timeline/Open"));
		}
	}
	if(ev.tags.length) {
		var tags = doc.createElement("div");
		tags.className = "dnd-tl-tags";
		$tw.utils.each(ev.tags,function(tag) {
			var link = doc.createElement("a"),
				dot = doc.createElement("span"),
				colour = colourOf(wiki,tag);
			link.className = "dnd-tl-tag tc-tiddlylink tc-tiddlylink-resolves";
			link.setAttribute("href","#" + encodeURIComponent(tag));
			link.setAttribute("data-title",tag);
			dot.className = "dnd-tl-tagdot";
			if(colour) {
				dot.style.backgroundColor = colour;
			}
			link.appendChild(dot);
			link.appendChild(doc.createTextNode(language.title(wiki,tag) || tag));
			tags.appendChild(link);
		});
		box.appendChild(tags);
	}
	return box;
};

TimelineWidget.prototype.uid = function() {
	if(!this._uid) {
		TimelineWidget.counter = (TimelineWidget.counter || 0) + 1;
		this._uid = TimelineWidget.counter;
	}
	return this._uid;
};

/* ---------- Interaction ---------- */

TimelineWidget.prototype.setZoom = function(zoom,clientY) {
	zoom = Math.max(0,Math.min(ZOOM.length - 1,zoom));
	if(zoom === this.zoom) {
		return;
	}
	// Keep the day under the mouse (or the middle of the view) in place
	var rect = this.scroller.getBoundingClientRect(),
		offset = (clientY === undefined ? rect.height / 2 : clientY - rect.top),
		day = this.dayAt(this.H - (this.scroller.scrollTop + offset));
	this.zoom = zoom;
	this.drawToolbar();
	this.drawCanvas();
	if(day !== null) {
		this.scroller.scrollTop = this.H - this.lay.yOf(day) - offset;
	}
};

// Inverse of yOf between the anchors (layout coordinates)
TimelineWidget.prototype.dayAt = function(y) {
	var anchors = this.lay && this.lay.anchors;
	if(!anchors || anchors.length === 0) {
		return null;
	}
	for(var i = 0; i < anchors.length - 1; i++) {
		var a = anchors[i], b = anchors[i + 1];
		if(y < b.y) {
			return y <= a.y ? a.day : a.day + (b.day - a.day) * (y - a.y) / (b.y - a.y);
		}
	}
	return anchors[anchors.length - 1].day;
};

// Highlight the selected event, else the hovered one; only the selected card grows
TimelineWidget.prototype.highlight = function() {
	var self = this,
		idx = this.selected !== undefined ? this.selected : this.hovered;
	if(this.shown !== undefined && this.nodesByIdx[this.shown]) {
		$tw.utils.each(this.nodesByIdx[this.shown],function(node) {
			$tw.utils.removeClass(node,"dnd-tl-active");
			if(node.parentNode === self.gTop) {
				self.gLines.appendChild(node);
			}
			if((node.classList && node.classList.contains("dnd-tl-selected")) && node.getAttribute("data-left")) {
				node.style.left = node.getAttribute("data-left") + "px";
			}
			$tw.utils.removeClass(node,"dnd-tl-selected");
		});
	}
	this.shown = idx;
	if(idx !== undefined && this.nodesByIdx[idx]) {
		$tw.utils.each(this.nodesByIdx[idx],function(node) {
			$tw.utils.addClass(node,"dnd-tl-active");
			if((node.classList && node.classList.contains("dnd-tl-connector")) && self.gTop) {
				self.gTop.appendChild(node);
			} else if(node.namespaceURI === SVGNS && node.parentNode && node.parentNode.lastChild !== node) {
				node.parentNode.appendChild(node);
			}
			if(idx === self.selected) {
				$tw.utils.addClass(node,"dnd-tl-selected");
				// Narrow screen: widen the card to the left (the other lanes are dimmed anyway)
				var left = parseFloat(node.getAttribute("data-left"));
				if(!isNaN(left) && node.offsetWidth && node.offsetWidth < L.selectedW) {
					node.style.left = Math.max(L.axisX + 12,left - (L.selectedW - node.offsetWidth)) + "px";
				}
			}
		});
		$tw.utils.addClass(this.domNode,"dnd-tl-has-active");
	} else {
		$tw.utils.removeClass(this.domNode,"dnd-tl-has-active");
	}
	this.drawExtras();
};

TimelineWidget.prototype.select = function(idx) {
	this.selected = idx;
	this.selectedTitle = idx === undefined ? null : this.data.all[idx].title;
	this.highlight();
	if(idx === undefined || !this.nodesByIdx[idx]) {
		return;
	}
	// Bring the (grown) card into view if a bar or point far away was tapped
	var scroller = this.scroller;
	$tw.utils.each(this.nodesByIdx[idx],function(node) {
		if(typeof node.className === "string" && node.className.indexOf("dnd-tl-card") !== -1) {
			var top = node.offsetTop,
				bottom = top + node.offsetHeight;
			if(top < scroller.scrollTop) {
				scroller.scrollTop = top - 12;
			} else if(bottom > scroller.scrollTop + scroller.clientHeight) {
				scroller.scrollTop = bottom - scroller.clientHeight + 12;
			}
		}
	});
};

// The link (title or tag) a click landed on, if any
function linkOf(node) {
	while(node && node.getAttribute) {
		if(node.getAttribute("data-title")) {
			return node;
		}
		node = node.parentNode;
	}
	return null;
}

function idxOf(node) {
	while(node && node.getAttribute) {
		var idx = node.getAttribute("data-idx");
		if(idx !== null && idx !== undefined && idx !== "") {
			return parseInt(idx,10);
		}
		node = node.parentNode;
	}
	return undefined;
}

TimelineWidget.prototype.bindEvents = function() {
	var self = this,
		scroller = this.scroller;
	if(!scroller.addEventListener) {
		return;
	}
	scroller.addEventListener("mousemove",function(event) {
		var idx = idxOf(event.target);
		if(idx !== self.hovered) {
			self.hovered = idx;
			self.highlight();
		}
	},false);
	scroller.addEventListener("mouseleave",function() {
		self.hovered = undefined;
		self.highlight();
	},false);
	scroller.addEventListener("click",function(event) {
		var idx = idxOf(event.target),
			link = linkOf(event.target);
		if(link) {
			event.preventDefault();
		}
		if(idx !== undefined && (event.ctrlKey || event.metaKey)) {
			self.navigate(self.data.all[idx].title,event);
		} else if(link && idx !== undefined && idx === self.selected) {
			self.navigate(link.getAttribute("data-title"),event);
		} else {
			self.select(idx === self.selected ? undefined : idx);
		}
	},false);
	scroller.addEventListener("wheel",function(event) {
		if(!event.ctrlKey) {
			return;
		}
		event.preventDefault();
		self.setZoom(self.zoom + (event.deltaY < 0 ? 1 : -1),event.clientY);
	},{passive: false});
};

TimelineWidget.prototype.navigate = function(title,event) {
	var bounds = event.target.getBoundingClientRect ? event.target.getBoundingClientRect() : null;
	this.dispatchEvent({
		type: "tm-navigate",
		navigateTo: title,
		navigateFromTitle: this.getVariable("storyTiddler"),
		navigateFromNode: this,
		navigateFromClientRect: bounds && {top: bounds.top, left: bounds.left, width: bounds.width, right: bounds.right, bottom: bounds.bottom, height: bounds.height},
		navigateSuppressNavigation: event.metaKey || event.ctrlKey || (event.button === 1),
		metaKey: event.metaKey,
		ctrlKey: event.ctrlKey,
		altKey: event.altKey,
		shiftKey: event.shiftKey,
		event: event
	});
};

exports["dnd-timeline"] = TimelineWidget;
