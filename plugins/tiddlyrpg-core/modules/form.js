/*\
title: $:/plugins/tiddlyrpg-core/modules/form.js
type: application/javascript
module-type: library
created: 20261016184211000
modified: 20261022141507011

The form in the editor (editor/form): which fields a draft shows there and how they are filled.

The form knows the relation fields (modules/relations.js, the field types without tags and list)
and GENERAL. Per type tag, $:/config/tiddlyrpg/form/<type> names in field list the fields it
shows also while empty - those whose absence a check reports (expected/*, dates/event;
test/editor-form.test.js keeps both in step) - and in field more the other fields of the type,
offered under "More fields" (an item category stands next to a base type, whose fields it gets
that way). It shows for a draft
  - the fields its types expect (list);
  - the fields added in the editor ($:/state/tiddlyrpg-core/form-extra/<draft>, field list);
  - every known field the draft has, whatever its type - the field list of the core hides them
    ($:/config/EditTemplateFields/Visibility/<field>), so they must show here.
It offers the fields of more that it does not show; a draft whose types have no config is
offered every known field. Order: GENERAL first, then the relation fields by axis
(modules/relations.js ordered). An empty field is not saved: the picker and the inputs write the
field only with a value, × takes it out again.

The states of a draft (form-extra, the inputs of the toolbar, the pickers) go when it is saved or
cancelled (startup/editor-states.js, states()). When the type of a draft changes, the known
fields the new type does not have (list and more) go from the draft and from form-extra
(startup/editor-states.js, dropped()); the first type of a draft without one is no change.

SINGLE: fields that hold one entry for a type; the picker replaces instead of adding. The same
rule as the errors of locations/structure (checks/locations.js); test/editor-form.test.js keeps
both in step.

  known(wiki)               the fields the form knows
  types(wiki,title)         the type tags of a tiddler, also typed under a translated name
  fields(wiki,title)        the fields of the form for a draft
  offered(wiki,title)       the fields it offers to add
  single(wiki,title,field)  whether <field> holds one entry for <title>
  dropped(wiki,title)       the known fields of <title> and of its form-extra its types do not
                            have; none if no type has a config
  states(wiki,draft)        the temp and state tiddlers of the editor that belong to <draft>
  noteCreated(wiki,draft,tiddler)  remembers a tiddler the toolbar of <draft> saved at once (a
                            sub-location), with its modified: cancelling <draft> takes it back
  forgetCreated(wiki,draft) <draft> was saved: what it created stays
  undoCreated(wiki,draft)   <draft> was cancelled: deletes what it created and is unchanged since
                            (no later save, no draft open), and takes it out of the story;
                            {removed, kept} - kept: changed since

\*/

"use strict";

var relations = require("$:/plugins/tiddlyrpg-core/modules/relations.js"),
	typeTags = require("$:/plugins/tiddlyrpg-core/modules/types.js");

var GENERAL = exports.GENERAL = ["date","player","price","image","map"],
	CONFIG = "$:/config/tiddlyrpg/form/",
	EXTRA = "$:/state/tiddlyrpg-core/form-extra/",
	CREATED = "$:/temp/tiddlyrpg-core/editor/created/",
	STATES = ["$:/state/tiddlyrpg-core/form-extra/","$:/temp/tiddlyrpg-core/editor/probe/","$:/temp/tiddlyrpg-core/editor/input/",
		"$:/temp/tiddlyrpg-core/pick/",CREATED],
	SINGLE = exports.SINGLE = {
		location: ["Location","Person","Player","Artifact"],
		owner: ["Artifact"]
	};

function list(text) {
	return $tw.utils.parseStringArray(text || "") || [];
}

var known = exports.known = function(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-form-known",function() {
		var all = relations.types(wiki);
		return GENERAL.concat(relations.ordered(wiki).filter(function(name) {
			return all[name].kind === "field" && name !== "tags" && name !== "list";
		}));
	});
};

// The type tags of a tiddler (modules/types.js of())
var types = exports.types = function(wiki,title) {
	return typeTags.of(wiki,title);
};

// The fields of the configs of the types of <title> in <name> (list or more); null if no type has
// a config
function configured(wiki,title,name) {
	var out = null;
	$tw.utils.each(types(wiki,title),function(type) {
		var config = wiki.getTiddler(CONFIG + type);
		if(config) {
			out = out || [];
			$tw.utils.each(list(config.fields[name]),function(field) {
				if(out.indexOf(field) === -1) {
					out.push(field);
				}
			});
		}
	});
	return out;
}

var fields = exports.fields = function(wiki,title) {
	var tiddler = wiki.getTiddler(title);
	if(!tiddler || wiki.isSystemTiddler(tiddler.fields["draft.of"] || title)) {
		return [];
	}
	var wanted = (configured(wiki,title,"list") || []).concat(list((wiki.getTiddler(EXTRA + title) || {fields: {}}).fields.list));
	return known(wiki).filter(function(field) {
		return wanted.indexOf(field) !== -1 || tiddler.fields[field] !== undefined;
	});
};

exports.offered = function(wiki,title) {
	var shown = fields(wiki,title),
		more = configured(wiki,title,"more");
	return known(wiki).filter(function(field) {
		return shown.indexOf(field) === -1 && (more === null || more.indexOf(field) !== -1);
	});
};

exports.single = function(wiki,title,field) {
	var own = types(wiki,title);
	return (SINGLE[field] || []).some(function(type) {
		return own.indexOf(type) !== -1;
	});
};

exports.dropped = function(wiki,title) {
	var tiddler = wiki.getTiddler(title),
		mine = configured(wiki,title,"list"),
		extra = list((wiki.getTiddler(EXTRA + title) || {fields: {}}).fields.list);
	if(!tiddler || mine === null) {
		return [];
	}
	mine = mine.concat(configured(wiki,title,"more"));
	return known(wiki).filter(function(field) {
		return mine.indexOf(field) === -1 && (tiddler.fields[field] !== undefined || extra.indexOf(field) !== -1);
	});
};

exports.states = function(wiki,draft) {
	var out = [];
	$tw.utils.each(STATES,function(prefix) {
		$tw.utils.each(wiki.filterTiddlers("[prefix[" + prefix + draft + "]]"),function(title) {
			out.push(title);
		});
	});
	return out;
};

// The tiddlers <draft> created at once: {title: modified as at creation}
function created(wiki,draft) {
	var tiddler = wiki.getTiddler(CREATED + draft);
	try {
		return tiddler ? JSON.parse(tiddler.fields.text || "{}") : {};
	} catch(e) {
		return {};
	}
}

function stamp(tiddler) {
	var modified = tiddler && tiddler.fields.modified;
	return modified instanceof Date ? $tw.utils.stringifyDate(modified) : String(modified || "");
}

exports.noteCreated = function(wiki,draft,tiddler) {
	var map = created(wiki,draft);
	map[tiddler.fields.title] = stamp(tiddler);
	wiki.addTiddler(new $tw.Tiddler({title: CREATED + draft, type: "application/json", text: JSON.stringify(map)}));
};

exports.forgetCreated = function(wiki,draft) {
	wiki.deleteTiddler(CREATED + draft);
};

exports.undoCreated = function(wiki,draft) {
	var map = created(wiki,draft),
		out = {removed: [], kept: []},
		drafts = [];
	wiki.each(function(tiddler) {
		if(tiddler.fields["draft.of"]) {
			drafts.push(tiddler.fields["draft.of"]);
		}
	});
	$tw.utils.each(map,function(modified,title) {
		var tiddler = wiki.getTiddler(title);
		if(!tiddler) {
			return;
		}
		if(stamp(tiddler) === modified && drafts.indexOf(title) === -1) {
			wiki.deleteTiddler(title);
			out.removed.push(title);
		} else {
			out.kept.push(title);
		}
	});
	if(out.removed.length) {
		var story = wiki.getTiddler("$:/StoryList"),
			list = story ? $tw.utils.parseStringArray(story.fields.list || "") || [] : [];
		if(list.some(function(title) { return out.removed.indexOf(title) !== -1; })) {
			wiki.addTiddler(new $tw.Tiddler(story,{list: list.filter(function(title) { return out.removed.indexOf(title) === -1; })}));
		}
	}
	wiki.deleteTiddler(CREATED + draft);
	return out;
};

exports.EXTRA = EXTRA;
