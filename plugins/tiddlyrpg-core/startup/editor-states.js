/*\
title: $:/plugins/tiddlyrpg-core/startup/editor-states.js
type: application/javascript
module-type: startup
created: 20261016184211000
modified: 20261022160104767

The states of the editor that belong to a draft (modules/form.js states: the fields added to the
form, the values of the toolbar dropdowns, the pickers) go when the draft goes - saved, or
cancelled and confirmed. Else a new tiddler opened later under the same draft title would show
the fields added to one that was thrown away. Listens to the changes of the wiki, as the hook of
cancelling runs before the confirmation.

When the type of a draft changes (its type tags, modules/form.js types), the fields of the form
the new type does not have go from the draft and from the added fields (form.dropped); a
notification names those that had a value - so a price does not stay behind when an item
becomes an event. Only a change from one type to another counts: the first type of a draft
without one changes nothing; a draft whose type was taken out keeps its last types, so taking
one out and setting another is one change. Cancelling brings the fields back.

A tiddler the toolbar saved at once (a sub-location, modules/form.js noteCreated) goes again when
its draft is cancelled - unless it was changed since or is open in the editor itself; a
notification names what went and what stayed. Saving the draft (hook th-saving-tiddler) keeps
it: the moved text is gone from the draft then, the tiddler holds it.

\*/

"use strict";

exports.name = "tiddlyrpg-editor-states";
exports.after = ["startup"];
exports.synchronous = true;

var form = require("$:/plugins/tiddlyrpg-core/modules/form.js"),
	language = require("$:/plugins/tiddlyrpg-core/modules/language.js");

var NOTICE = "$:/temp/tiddlyrpg-core/editor/notice";

// Takes the fields the types of <draft> do not have out of it and of its added fields
function drop(wiki,draft) {
	var gone = form.dropped(wiki,draft);
	if(!gone.length) {
		return;
	}
	var update = {},
		tiddler = wiki.getTiddler(draft),
		extra = wiki.getTiddler(form.EXTRA + draft),
		filled = gone.filter(function(field) {
			return (tiddler.fields[field] || "").toString().trim() !== "";
		});
	$tw.utils.each(gone,function(field) {
		update[field] = undefined;
	});
	wiki.addTiddler(new $tw.Tiddler(tiddler,update));
	if(extra) {
		wiki.addTiddler(new $tw.Tiddler(extra,{list: (extra.fields.list || []).filter(function(field) {
			return gone.indexOf(field) === -1;
		})}));
	}
	// The notification names the fields that had a value, not those added and left empty
	if(filled.length) {
		wiki.addTiddler(new $tw.Tiddler({title: NOTICE, text: language.format(language.t(wiki,"Editor/Form/Dropped"),{
			fields: filled.map(function(field) { return form.label(wiki,draft,field); }).join(", ")
		})}));
		if($tw.notifier) {
			$tw.notifier.display(NOTICE);
		}
	}
}

// The tiddlers a cancelled draft created at once: back out while unchanged, a notification
function undoCreated(wiki,draft) {
	var undone = form.undoCreated(wiki,draft),
		lines = [];
	if(undone.removed.length) {
		lines.push(language.format(language.t(wiki,"Editor/Sublocation/Removed"),{titles: undone.removed.join(", ")}));
	}
	if(undone.kept.length) {
		lines.push(language.format(language.t(wiki,"Editor/Sublocation/Kept"),{titles: undone.kept.join(", ")}));
	}
	if(lines.length) {
		wiki.addTiddler(new $tw.Tiddler({title: NOTICE, text: lines.join("\n\n")}));
		if($tw.notifier) {
			$tw.notifier.display(NOTICE);
		}
	}
}

exports.startup = function() {
	// Saved: what the draft created stays
	$tw.hooks.addHook("th-saving-tiddler",function(newTiddler,draftTiddler) {
		if(draftTiddler && draftTiddler.fields["draft.of"] !== undefined) {
			form.forgetCreated($tw.wiki,draftTiddler.fields.title);
		}
		return newTiddler;
	});
	// Draft title -> its last types that were not none ("" while it had none)
	var drafts = Object.create(null);
	$tw.wiki.addEventListener("change",function(changes) {
		$tw.utils.each(changes,function(change,title) {
			// A batch of changes keeps "deleted" when a draft went and came again in one tick: the
			// one that went is forgotten, the one that came is new
			if(change.deleted && drafts[title] !== undefined) {
				delete drafts[title];
				undoCreated($tw.wiki,title);
				$tw.utils.each(form.states($tw.wiki,title),function(state) {
					$tw.wiki.deleteTiddler(state);
				});
			}
			if($tw.wiki.tiddlerExists(title)) {
				var tiddler = $tw.wiki.getTiddler(title);
				if(tiddler && tiddler.fields["draft.of"] !== undefined) {
					var types = form.types($tw.wiki,title).sort().join("\n"),
						before = drafts[title];
					if(types) {
						drafts[title] = types;
						if(before && before !== types) {
							drop($tw.wiki,title);
						}
					} else if(before === undefined) {
						drafts[title] = "";
					}
				}
			}
		});
	});
};
