/*\
title: $:/plugins/tiddlyrpg-core/modules/visibility.js
type: application/javascript
module-type: library
created: 20261007162511000
modified: 20261022160742118

Who sees what - the one place of these rules. Used by the filters in filters/visibility.js
(trpg.visible in functions.tid wraps one of them), the location rules, the timeline and the
event table.

Player characters: tiddlers tagged Player (active), and tiddlers with a field player (a figure
someone played before, e.g. a Person). The field player names the real player; an active
character without it counts as its own player.

The view, $:/state/tiddlyrpg/view:
  public          what everyone sees
  player:<name>   what the player <name> sees
  dm              everything
Empty or missing: dm in an editable wiki, public in the read-only copy ($:/status/IsReadOnly is
yes). The read-only copy offers dm only if $:/config/tiddlyrpg/view/dm-published is yes; without
that, a view dm counts as public there.

A tiddler tagged Secret is visible to the DM and to the players of the player characters it is
tagged with; without such a tag, to the DM only. Every other tiddler is visible to all. The same
rule decides for a locked section of a body (a list of characters instead of the tags).

Values of fields locked: the field secret-fields of a tiddler that is not locked as a whole locks
the values of the rules - present but empty, or "all", the whole block of values (and the price);
else the fields it lists. They are visible like a Secret: to the DM and to the players of the
characters the tiddler is tagged with (taggedPlayers). What derives from a locked value is locked
with it: the block reads the fields of a tiddler without those the view may not see
(filters/fields.js), so a derived value has nothing to read.

\*/

"use strict";

var STATE = "$:/state/tiddlyrpg/view",
	READONLY = "$:/status/IsReadOnly",
	DMPUBLISHED = "$:/config/tiddlyrpg/view/dm-published";

// Tiddlers whose change can change what is visible (for the refresh of widgets)
exports.STATE = STATE;
exports.watched = [STATE,READONLY,DMPUBLISHED];

function text(wiki,title) {
	return (wiki.getTiddlerText(title,"") || "").trim();
}

var readOnly = exports.readOnly = function(wiki) {
	return text(wiki,READONLY) === "yes";
};

// Whether the view dm can be chosen
var dmAllowed = exports.dmAllowed = function(wiki) {
	return !readOnly(wiki) || text(wiki,DMPUBLISHED) === "yes";
};

// The active view: {mode: "public"|"player"|"dm", player, name}; name is the value as stored
var current = exports.current = function(wiki) {
	var value = text(wiki,STATE);
	if(!value) {
		value = readOnly(wiki) ? "public" : "dm";
	}
	if(value === "dm") {
		return dmAllowed(wiki) ? {mode: "dm", player: "", name: "dm"} : {mode: "public", player: "", name: "public"};
	}
	if(value.indexOf("player:") === 0 && value.length > 7) {
		return {mode: "player", player: value.substring(7), name: value};
	}
	return {mode: "public", player: "", name: "public"};
};

// Whether <title> is a player character (active or former)
var isCharacter = exports.isCharacter = function(wiki,title) {
	var tiddler = wiki.getTiddler(title);
	return !!tiddler && (tiddler.hasTag("Player") || !!(tiddler.fields.player || "").trim());
};

// The real player of a character, "" for no character
var playerOf = exports.playerOf = function(wiki,title) {
	var tiddler = wiki.getTiddler(title);
	if(!tiddler) {
		return "";
	}
	var player = (tiddler.fields.player || "").trim();
	return player || (tiddler.hasTag("Player") ? title : "");
};

// The player characters a tiddler is tagged with
var characters = exports.characters = function(wiki,title) {
	var tiddler = wiki.getTiddler(title);
	return tiddler ? (tiddler.fields.tags || []).filter(function(tag) {
		return isCharacter(wiki,tag);
	}) : [];
};

// Whether the active view may see something locked for these characters ([] = DM only)
var allows = exports.allows = function(wiki,recipients,view) {
	view = view || current(wiki);
	if(view.mode === "dm") {
		return true;
	}
	if(view.mode !== "player") {
		return false;
	}
	return recipients.some(function(character) {
		return playerOf(wiki,character) === view.player;
	});
};

// Whether a tiddler is locked (tagged Secret)
var locked = exports.locked = function(wiki,title) {
	var tiddler = wiki.getTiddler(title);
	return !!tiddler && tiddler.hasTag("Secret");
};

// Whether the active view sees <title>
exports.visible = function(wiki,title,view) {
	return !locked(wiki,title) || allows(wiki,characters(wiki,title),view);
};

// The fields a value of secret-fields locks: null (none), "all" (present but empty, or "all") or
// a list
var parseLock = exports.parseLock = function(value) {
	if(value === undefined || value === null) {
		return null;
	}
	var list = $tw.utils.parseStringArray(value.toString()) || [];
	return !list.length || list.indexOf("all") !== -1 ? "all" : list;
};

// The fields of <title> its secret-fields locks (parseLock)
var lockedFields = exports.lockedFields = function(wiki,title) {
	var tiddler = wiki.getTiddler(title);
	return tiddler ? parseLock(tiddler.fields["secret-fields"]) : null;
};

// Whether <field> of <title> is locked by secret-fields; "all" locks every field of the rules
// (list: the fields of its schema) and the price
var fieldLocked = exports.fieldLocked = function(wiki,title,field,list) {
	var lock = lockedFields(wiki,title);
	if(lock === "all") {
		return field === "price" || !list || list.indexOf(field) !== -1;
	}
	return !!lock && lock.indexOf(field) !== -1;
};

// Whether the active view sees the value of <field> of <title>
exports.fieldVisible = function(wiki,title,field,view,list) {
	return !fieldLocked(wiki,title,field,list) || allows(wiki,characters(wiki,title),view);
};

// The real players of the player characters <title> is tagged with, sorted - whether it is
// locked or not (a lock of its fields)
var taggedPlayers = exports.taggedPlayers = function(wiki,title) {
	var players = [];
	$tw.utils.each(characters(wiki,title),function(character) {
		var player = playerOf(wiki,character);
		if(player && players.indexOf(player) === -1) {
			players.push(player);
		}
	});
	return players.sort();
};

/*
Who may see <title> besides the DM: null for everyone, otherwise the real players (sorted,
possibly empty). Two tiddlers can be compared by it (filters/location.js).
*/
exports.audience = function(wiki,title) {
	return locked(wiki,title) ? taggedPlayers(wiki,title) : null;
};

// The real players that can be chosen as a view: those of the active characters, sorted
exports.players = function(wiki) {
	var players = [];
	$tw.utils.each(wiki.getTiddlersWithTag("Player"),function(title) {
		var tiddler = wiki.getTiddler(title);
		if(tiddler && !tiddler.isDraft()) {
			var player = playerOf(wiki,title);
			if(player && players.indexOf(player) === -1) {
				players.push(player);
			}
		}
	});
	return players.sort();
};

// Whether an event belongs to the campaign: a player character is tagged on it
exports.campaign = function(wiki,title) {
	return characters(wiki,title).length > 0;
};
