/*\
title: $:/plugins/tiddlyrpg-core/modules/categories.js
type: application/javascript
module-type: library
created: 20261024152302984
modified: 20261024152302984

The categories of a base type - the one place of them. A category is a hub tagged
$:/tags/tiddlyrpg/Category; its field tiddlyrpg-bases lists the base types it stands next to,
never alone (checks/categories.js):

  Book, Consumable, Equipment   tiddlyrpg-bases: Artifact Item Material
  Folk                          tiddlyrpg-bases: Information

Without the field a category belongs to the items (Artifact Item Material). The tag of the
releases before 2.2.0, $:/tags/tiddlyrpg/ItemKind, still makes a category of the items; a hub
with it needs no field. A category is a type (modules/types.js): its schema of the rules and its
form config count beside those of the base type.

  list(wiki)            the categories, sorted (global cache)
  isCategory(wiki,t)    whether <t> is a category
  basesOf(wiki,t)       the base types of the category <t>
  of(wiki,base)         the categories of the base type <base>, sorted

\*/

"use strict";

exports.TAG = "$:/tags/tiddlyrpg/Category";

var LEGACY = "$:/tags/tiddlyrpg/ItemKind",
	ITEMS = exports.ITEMS = ["Artifact","Item","Material"];

var list = exports.list = function(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-categories",function() {
		return wiki.filterTiddlers("[all[shadows+tiddlers]tag[" + exports.TAG + "]] [all[shadows+tiddlers]tag[" + LEGACY + "]] -[[Index]] +[sort[]]");
	});
};

var isCategory = exports.isCategory = function(wiki,title) {
	return list(wiki).indexOf(title) !== -1;
};

var basesOf = exports.basesOf = function(wiki,title) {
	if(!isCategory(wiki,title)) {
		return [];
	}
	var bases = $tw.utils.parseStringArray(wiki.getTiddler(title).fields["tiddlyrpg-bases"] || "");
	return bases.length ? bases : ITEMS.slice();
};

exports.of = function(wiki,base) {
	return list(wiki).filter(function(category) {
		return basesOf(wiki,category).indexOf(base) !== -1;
	});
};
