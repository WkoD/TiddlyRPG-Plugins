/*\
title: $:/plugins/tiddlyrpg-core/modules/symmetric.js
type: application/javascript
module-type: library
created: 20261016184211000
modified: 20261016184211000

Symmetric relations on both ends (tiddlyrpg-symmetric: spouse, sibling, family, alliance, bond,
enmity; modules/relations.js): what a tiddler gains or loses in such a field, the other end gains
or loses as well. Run on saving (startup/symmetric.js); the fix of the hint relations/symmetric
only puts the other end into the draft, saving does the rest. Only for ends that exist as
tiddlers; an open draft of an end gets the same change, so saving it later does not undo it. A
renamed tiddler is renamed at its other ends too (the core relinks only tags and list). Deleting
a tiddler changes nothing: the convention keeps both ends, so the other one loses nothing.

Switched off with $:/config/tiddlyrpg/editor/symmetric = no.

  enabled(wiki)                      whether the switch is on
  sync(wiki,title,before,after,was)  writes the other ends of <title> for the change from the
                                     fields <before> to <after> (objects of fields; before null
                                     for a new tiddler); <was> the title before a rename (else
                                     <title> or empty); returns the titles changed

\*/

"use strict";

var relations = require("$:/plugins/tiddlyrpg-core/modules/relations.js");

var SWITCH = "$:/config/tiddlyrpg/editor/symmetric";

exports.enabled = function(wiki) {
	return wiki.getTiddlerText(SWITCH,"yes").trim() !== "no";
};

function list(value) {
	return $tw.utils.parseStringArray(value || "") || [];
}

// The drafts of <title> open in the editor
function draftsOf(wiki,title) {
	var drafts = [];
	wiki.each(function(tiddler,other) {
		if(tiddler.fields["draft.of"] === title) {
			drafts.push(other);
		}
	});
	return drafts;
}

// Adds or removes <value> in <field> of <target>; true if it changed
function change(wiki,target,field,value,present) {
	var tiddler = wiki.getTiddler(target);
	if(!tiddler) {
		return false;
	}
	var values = list(tiddler.fields[field]),
		has = values.indexOf(value) !== -1;
	if(has === present) {
		return false;
	}
	values = present ? values.concat([value]) : values.filter(function(v) { return v !== value; });
	var fields = {};
	fields[field] = values.length ? $tw.utils.stringifyList(values) : undefined;
	wiki.addTiddler(new $tw.Tiddler(tiddler,fields,wiki.getModificationFields()));
	return true;
}

function apply(wiki,title,field,other,present) {
	var changed = change(wiki,other,field,title,present);
	$tw.utils.each(draftsOf(wiki,other),function(draft) {
		change(wiki,draft,field,title,present);
	});
	return changed;
}

exports.sync = function(wiki,title,before,after,was) {
	var all = relations.types(wiki),
		renamed = !!was && was !== title,
		changed = [],
		note = function(other) {
			if(changed.indexOf(other) === -1) {
				changed.push(other);
			}
		};
	$tw.utils.each(all,function(type,field) {
		if(!type.symmetric || type.kind !== "field") {
			return;
		}
		var old = list(before ? before[field] : ""),
			now = list(after ? after[field] : "");
		$tw.utils.each(now,function(other) {
			if(other === title || other === was || !wiki.tiddlerExists(other)) {
				return;
			}
			// A rename: the old title goes at the other end, also where the relation stays
			var gone = renamed && old.indexOf(other) !== -1 && apply(wiki,was,field,other,false);
			if((old.indexOf(other) === -1 || renamed) && apply(wiki,title,field,other,true) || gone) {
				note(other);
			}
		});
		$tw.utils.each(old,function(other) {
			if(now.indexOf(other) === -1 && other !== title && other !== was && wiki.tiddlerExists(other) &&
				apply(wiki,renamed ? was : title,field,other,false)) {
				note(other);
			}
		});
	});
	return changed;
};
