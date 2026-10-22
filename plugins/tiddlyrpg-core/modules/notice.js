/*\
title: $:/plugins/tiddlyrpg-core/modules/notice.js
type: application/javascript
module-type: library
created: 20261022184833627
modified: 20261022184833627

The notifications of the editor (a draft, a save, a tiddler taken or copied): the text goes into
NOTICE, where the latest stays to read, and a copy of it into one of a few slots, which the
notifier shows. The notifier shows a tiddler live, so two notifications of one tiddler in a row -
values copied from a base item, then the base item taken - both showed the second text; each slot
keeps its own.

  show(wiki,text)   the text in NOTICE and on screen (without a notifier, as in the tests: only
                    NOTICE)

\*/

"use strict";

var NOTICE = exports.NOTICE = "$:/temp/tiddlyrpg-core/editor/notice",
	SLOTS = 8;

var next = 0;

exports.show = function(wiki,text) {
	wiki.addTiddler(new $tw.Tiddler({title: NOTICE, text: text}));
	if($tw.notifier) {
		var slot = NOTICE + "/" + next;
		next = (next + 1) % SLOTS;
		wiki.addTiddler(new $tw.Tiddler({title: slot, text: text}));
		$tw.notifier.display(slot);
	}
};
