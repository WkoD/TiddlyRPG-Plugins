/*\
title: $:/plugins/tiddlyrpg-core/filters/visibility.js
type: application/javascript
module-type: filteroperator
created: 20261007162511000
modified: 20261007162511000

Views and the lock (modules/visibility.js):

[<titles>trpgvisible[]]          the input titles the active view sees
[trpgview[]]                     the active view: public, player:<name> or dm
[trpgview:mode[]]                its mode: public, player or dm
[trpgview:choices[]]             the views that can be chosen: public, player:<name> per player of
                                an active character, dm (not in the read-only copy unless
                                $:/config/tiddlyrpg/view/dm-published is yes)
[<titles>trpgcharacter[]]        the input titles that are player characters (active or former)
[<title>trpgcharacters[]]        the player characters a tiddler is tagged with
[<title>trpgplayer[]]            the real player of a character
[<player>trpgplayedby[]]         the active characters of a real player, sorted

\*/

"use strict";

var visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js");

function each(source,fn) {
	var results = [];
	source(function(tiddler,title) {
		fn(title,results);
	});
	return results;
}

exports.trpgvisible = function(source,operator,options) {
	var wiki = options.wiki,
		view = visibility.current(wiki);
	return each(source,function(title,results) {
		if(visibility.visible(wiki,title,view)) {
			results.push(title);
		}
	});
};

exports.trpgview = function(source,operator,options) {
	var wiki = options.wiki,
		view = visibility.current(wiki);
	if(operator.suffix === "mode") {
		return [view.mode];
	}
	if(operator.suffix === "choices") {
		var choices = ["public"].concat(visibility.players(wiki).map(function(player) {
			return "player:" + player;
		}));
		if(visibility.dmAllowed(wiki)) {
			choices.push("dm");
		}
		return choices;
	}
	return [view.name];
};

exports.trpgcharacter = function(source,operator,options) {
	return each(source,function(title,results) {
		if(visibility.isCharacter(options.wiki,title)) {
			results.push(title);
		}
	});
};

exports.trpgcharacters = function(source,operator,options) {
	return each(source,function(title,results) {
		$tw.utils.each(visibility.characters(options.wiki,title),function(character) {
			if(results.indexOf(character) === -1) {
				results.push(character);
			}
		});
	});
};

exports.trpgplayer = function(source,operator,options) {
	return each(source,function(title,results) {
		var player = visibility.playerOf(options.wiki,title);
		if(player) {
			results.push(player);
		}
	});
};

exports.trpgplayedby = function(source,operator,options) {
	var wiki = options.wiki;
	return each(source,function(player,results) {
		$tw.utils.each(wiki.getTiddlersWithTag("Player"),function(title) {
			var tiddler = wiki.getTiddler(title);
			if(tiddler && !tiddler.isDraft() && visibility.playerOf(wiki,title) === player && results.indexOf(title) === -1) {
				results.push(title);
			}
		});
		results.sort();
	});
};
