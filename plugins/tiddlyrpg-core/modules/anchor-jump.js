/*\
title: $:/plugins/tiddlyrpg-core/modules/anchor-jump.js
type: application/javascript
module-type: library
created: 20261004170125000
modified: 20261006064449000

Jump to a mark inside a tiddler right after navigating to it. A mark is any element with
data-trpg-anchor="<name>" inside the tiddler (names in kebab-case; the dated sections of a body
are "date-<n>", procedure date in functions.tid). Used by the wrapper widget trpg-jump
(widgets/jump.js) and the timeline.

  jump(widget,title,anchor)   call right after dispatching tm-navigate to <title>
  now(widget,title,anchor)    scroll to the mark if <title> already shows it; true if it did

The navigation only changes $:/StoryList and $:/HistoryList; the tiddler shows after the next
refresh. So the jump waits for the next change event of the wiki (the main refresh is
registered first and runs before) and one animation frame, then sends tm-scroll with the mark
as target. The page scroller replaces the scroll to the tiddler with it and measures the target
in every frame, so the insert animation does not throw it off. Without a mark (tiddler in edit
mode, folded, locked for the player, mark not rendered) nothing more happens: the normal
navigation stands.

Kept thin on purpose: should the core navigation learn anchors one day (TiddlyWiki PR #7744 or a
successor), only this module is replaced.

\*/

"use strict";

// How long a jump waits for the refresh before it gives up
var TIMEOUT = 1000;

// The mark inside the tiddler <title> in the story river, or null
function find(doc,title,anchor) {
	var frames = doc.querySelectorAll(".tc-story-river .tc-tiddler-frame[data-tiddler-title]"),
		selector = "[data-trpg-anchor=\"" + $tw.utils.escapeCSS(anchor) + "\"]";
	for(var i = 0; i < frames.length; i++) {
		if(frames[i].getAttribute("data-tiddler-title") === title) {
			var mark = frames[i].querySelector(selector);
			if(mark) {
				return mark;
			}
		}
	}
	return null;
}

exports.now = function(widget,title,anchor) {
	var doc = widget.document;
	if(!$tw.browser || !title || !anchor || !doc || !doc.querySelectorAll) {
		return false;
	}
	var mark = find(doc,title,anchor);
	if(mark) {
		$tw.rootWidget.dispatchEvent({type: "tm-scroll", target: mark});
		return true;
	}
	return false;
};

exports.jump = function(widget,title,anchor) {
	var doc = widget.document,
		wiki = widget.wiki;
	if(!$tw.browser || !title || !anchor || !doc || !doc.querySelectorAll) {
		return;
	}
	var win = doc.defaultView || window,
		timer;
	var onChange = function() {
		wiki.removeEventListener("change",onChange);
		clearTimeout(timer);
		win.requestAnimationFrame(function() {
			var mark = find(doc,title,anchor);
			if(mark) {
				$tw.rootWidget.dispatchEvent({type: "tm-scroll", target: mark});
			}
		});
	};
	wiki.addEventListener("change",onChange);
	timer = setTimeout(function() {
		wiki.removeEventListener("change",onChange);
	},TIMEOUT);
};
