/*\
title: $:/plugins/tiddlyrpg-core/modules/checks.js
type: application/javascript
module-type: library
created: 20261015191942000
modified: 20261015191942000

Checks: the problems of the tiddlers of a wiki - the one place that runs them. The same rules
give the messages below the title (viewtemplates/checks, filter trpgcheck) and the report of
scripts/check-wiki.js.

A rule lives in a module of type trpg-check (checks/<theme>.js), which exports rules:

  {id, scope, run}
    id      "<theme>/<name>": the theme groups the rules (check-wiki.js <wiki> <theme>), the id
            is what a DM writes into trpg-noerror or trpg-noinfo
    scope   "tiddler" (default): run(wiki,title,view) gives the messages of <title>;
            "wiki": run(wiki,view) gives messages over the whole wiki, each with its title
    message {level, key, params} (scope wiki: also title) - level "error" (something is broken
            or does not work as meant) or "hint" (fine, but better with ...); key a language key,
            params its $name$ values

Every rule takes the view (modules/visibility.js) and leaves out a whole message that names a
title the view does not see, or that repeats text of a section it does not see. The script runs
in the view of the DM.

Switching off at a tiddler: the field trpg-noerror (errors) or trpg-noinfo (hints) holds a list
of rule ids, whose messages of that level are left out; present but empty, it leaves out every
message of that level.

  rules()                       all rules, by id
  themes()                      the themes, sorted
  text(wiki,message)            the text of a message in the wiki language
  forTiddler(wiki,title,view)   the messages of a tiddler, errors first (global cache)
  all(wiki,view,themes)         {title: messages} over the wiki: every tiddler that is no system
                                tiddler (graph views aside) and no draft, plus the titles the
                                rules of scope wiki name; themes (optional) limits the rules
  plain(text), distance(a,b)    for names that differ only a little (quests, spots)
  setFolder(path), folder()     the folder of the wiki on disk, for the rules that look at files
                                (scripts/check-wiki.js sets it; in the browser there is none)

\*/

"use strict";

var language = require("$:/plugins/tiddlyrpg-core/modules/language.js"),
	visibility = require("$:/plugins/tiddlyrpg-core/modules/visibility.js");

var FIELDS = {error: "trpg-noerror", hint: "trpg-noinfo"},
	ORDER = {error: 0, hint: 1};

var cache = null,
	wikiFolder = "";

exports.setFolder = function(folder) {
	wikiFolder = folder || "";
};

exports.folder = function() {
	return wikiFolder;
};

var rules = exports.rules = function() {
	if(!cache) {
		cache = [];
		$tw.modules.forEachModuleOfType("trpg-check",function(title,module) {
			$tw.utils.each(module.rules,function(rule) {
				cache.push({
					id: rule.id,
					theme: rule.id.split("/")[0],
					scope: rule.scope || "tiddler",
					run: rule.run
				});
			});
		});
		cache.sort(function(a,b) {
			return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
		});
	}
	return cache;
};

exports.themes = function() {
	var result = [];
	$tw.utils.each(rules(),function(rule) {
		if(result.indexOf(rule.theme) === -1) {
			result.push(rule.theme);
		}
	});
	return result.sort();
};

exports.text = function(wiki,message) {
	return language.format(language.t(wiki,message.key),message.params || {});
};

// The rule ids a field of <title> switches off: null if the field is missing, [] for all
var switchedOff = exports.switchedOff = function(wiki,title,level) {
	var tiddler = wiki.getTiddler(title),
		value = tiddler && tiddler.fields[FIELDS[level]];
	if(value === undefined || value === null || !tiddler) {
		return null;
	}
	return $tw.utils.parseStringArray(value.toString()) || [];
};

function selected(rule,scope,themes) {
	return rule.scope === scope && (!themes || themes.indexOf(rule.theme) !== -1);
}

// Messages of the rules: the id added, duplicates left out
function collect(list,rule,messages) {
	$tw.utils.each(messages,function(message) {
		var entry = {id: rule.id, level: message.level, key: message.key, params: message.params || {}},
			same = list.some(function(other) {
				return other.id === entry.id && other.key === entry.key && JSON.stringify(other.params) === JSON.stringify(entry.params);
			});
		if(!same) {
			list.push(entry);
		}
	});
}

function runTiddler(wiki,title,view,themes) {
	var list = [];
	$tw.utils.each(rules(),function(rule) {
		if(selected(rule,"tiddler",themes)) {
			collect(list,rule,rule.run(wiki,title,view));
		}
	});
	return list;
}

// {title: messages} of the rules of scope wiki
function runWiki(wiki,view,themes) {
	var compute = function() {
		var byTitle = Object.create(null);
		$tw.utils.each(rules(),function(rule) {
			if(selected(rule,"wiki",themes)) {
				$tw.utils.each(rule.run(wiki,view),function(message) {
					collect(byTitle[message.title] = byTitle[message.title] || [],rule,[message]);
				});
			}
		});
		return byTitle;
	};
	return themes ? compute() : wiki.getGlobalCache("tiddlyrpg-checks-wiki/" + view.name,compute);
}

// Without what the tiddler switches off, errors first
function finish(wiki,title,list) {
	var off = {error: switchedOff(wiki,title,"error"), hint: switchedOff(wiki,title,"hint")};
	return list.filter(function(message) {
		var ids = off[message.level];
		return !ids || (ids.length && ids.indexOf(message.id) === -1);
	}).sort(function(a,b) {
		return ORDER[a.level] - ORDER[b.level];
	});
}

exports.forTiddler = function(wiki,title,view) {
	view = view || visibility.current(wiki);
	return wiki.getGlobalCache("tiddlyrpg-checks/" + view.name + "/" + title,function() {
		return finish(wiki,title,runTiddler(wiki,title,view).concat(runWiki(wiki,view)[title] || []));
	});
};

exports.all = function(wiki,view,themes) {
	view = view || visibility.current(wiki);
	var result = Object.create(null),
		wide = runWiki(wiki,view,themes);
	wiki.each(function(tiddler,title) {
		if((wiki.isSystemTiddler(title) && !/^\$:\/graph\//.test(title)) || tiddler.isDraft()) {
			return;
		}
		var list = finish(wiki,title,runTiddler(wiki,title,view,themes).concat(wide[title] || []));
		if(list.length) {
			result[title] = list;
		}
	});
	$tw.utils.each(wide,function(list,title) {
		if(!result[title] && !(wiki.tiddlerExists(title) && !wiki.isSystemTiddler(title))) {
			list = finish(wiki,title,list);
			if(list.length) {
				result[title] = list;
			}
		}
	});
	return result;
};

// Lower case without spaces and punctuation: "Die Schamanin Eoria" -> "dieschamanineoria"
exports.plain = function(text) {
	return (text || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu,"");
};

// Edit distance of two strings: insert, delete or replace one character, or swap two
// neighbours ("Labore"/"Lbaore") - one step each
exports.distance = function(a,b) {
	var d = [], i, j;
	for(i = 0; i <= a.length; i++) {
		d.push([i]);
		for(j = 1; j <= b.length; j++) {
			d[i].push(i ? 0 : j);
		}
	}
	for(i = 1; i <= a.length; i++) {
		for(j = 1; j <= b.length; j++) {
			d[i][j] = Math.min(d[i - 1][j] + 1,d[i][j - 1] + 1,d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
			if(i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
				d[i][j] = Math.min(d[i][j],d[i - 2][j - 2] + 1);
			}
		}
	}
	return d[a.length][b.length];
};
