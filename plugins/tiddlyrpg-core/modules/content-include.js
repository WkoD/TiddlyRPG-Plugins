/*\
title: $:/plugins/tiddlyrpg-core/modules/content-include.js
type: application/javascript
module-type: library
created: 20261103173828774
modified: 20261103173828774

The entries of the content packages a wiki names, included in the wiki as the shadow tiddlers of
the plugin content.PLUGIN ($:/plugins/tiddlyrpg/content-packages): no copy in the repo, not the
whole package. Built on Node at the start (startup/content-include.js: the server, the build,
check-wiki.js) and saved into the page like any plugin, so the published copy has them too. A
tiddler of the title wins over its shadow: the DM edits an entry and TiddlyWiki keeps an own
version; deleting it brings the entry back. ControlPanel -> Plugins switches the plugin off.

What names an entry (an offer of modules/content.js titled so, one offer of that title; for a
relation the offer whose type it may name, content.forRelation()) - in every tiddler of the wiki,
whatever the view (the DM sees all), then in every entry included, until nothing comes:
  - the relation fields (kind field), tags and list
  - the fields of the rules of the format titles (the classes with their levels) and label or
    labels (the entry of the glossary of each term, glossary.term())
  - in the text: links and transclusions (also inside the parameters of a macro, where the parse
    tree shows no link), the parts with a link of <<term>>, <<dice>>, <<damage>> and <<rule>>
    (formulas too, rules.js), the names of the sections of the ruleset (glossary.named()), the
    tiddler a spot is joined to
Shadows of other plugins name nothing: the hub Ruleset would take in every entry of the glossary.

Where an included entry counts like a tiddler of the wiki, beside what TiddlyWiki lists by tag
with its shadows anyway (getTiddlersWithTag: the hubs of a type, multitag, tagging[]):
  - the candidates of a relation (filters/editor.js relationcandidates), of a field of the
    format titles (rules.candidates()), of the way back (inverse.sources()): their filter runs
    on content.withIncluded()
  - the glossary and the names of <<rule>> (glossary.js), the hubs with an own filter
    (filters/hubs.js), the search ($:/core/ui/DefaultSearchResultList): [all[tiddlers+included]]
  - the copy sources of the form (form.js) by tag, as before
It stays out of: the checks (modules/checks.js reads the tiddlers of the wiki; package content is
not checked), the hub Content (it shows it "included").

Shown in italics while it has no own version: links through the stylesheet STYLES of the plugin
(a selector per title), tag pills through tag-pill-inner (functions, class trpg-included), the
nodes of the graphs through graph/included.js.

  STYLES                  the title of the stylesheet in the plugin
  collect(wiki,wikiPath)  the entries to include, {<title>: fields}, from the packages of the
                          active ruleset in <wikiPath>/node_modules; installs the plugin round by
                          round, so the next round reads the entries as tiddlers. The ruleset and
                          the setting must be unpacked (the startup module does that first)
  names(wiki,title)       what a tiddler names: [{title, relation}] - relation the field of a
                          relation, else null
  install(wiki,tiddlers)  the plugin with <tiddlers> ({<title>: fields}) and its stylesheet,
                          registered and unpacked (TiddlyWiki clears its caches); none: the
                          plugin is gone
  styles(titles)          the text of the stylesheet

\*/

"use strict";

var STYLES,
	DM = {mode: "dm", player: "", name: "dm"},
	MACROS = /<<(term|dice|damage|rule)\s[^<>]*?>>/g,
	LINKS = /\[\[([^\]]+)\]\]/g;

function lib(name) {
	return require("$:/plugins/tiddlyrpg-core/modules/" + name + ".js");
}

STYLES = exports.STYLES = lib("content").PLUGIN + "/styles";

function list(value) {
	return $tw.utils.isArray(value) ? value.map(String) : ($tw.utils.parseStringArray(String(value || "")) || []);
}

function exists(wiki,title) {
	return wiki.tiddlerExists(title) || wiki.isShadowTiddler(title);
}

// The parameters of one macro call as TiddlyWiki reads them: {positional, named}
function params(wiki,call) {
	var tree = (wiki.parseText("text/vnd.tiddlywiki",call,{parseAsInline: true}) || {tree: []}).tree,
		node = tree[0],
		out = {positional: [], named: Object.create(null)};
	while(node && node.type !== "transclude" && node.children) {
		node = node.children[0];
	}
	$tw.utils.each(node && node.type === "transclude" ? node.orderedAttributes : [],function(attribute) {
		if(attribute.name.charAt(0) === "$") {
			return;
		}
		if(/^\d+$/.test(attribute.name)) {
			out.positional[parseInt(attribute.name,10)] = attribute.value;
		} else {
			out.named[attribute.name] = attribute.value;
		}
	});
	return out;
}

// The parts of a rules macro, as the macro shows them (functions.tid): [{text, to, anchor}]
function parts(wiki,macro,p) {
	var rules = lib("rules"),
		at = function(name,index) {
			return p.named[name] !== undefined ? p.named[name] : (p.positional[index] || "");
		};
	switch(macro) {
		case "term": return rules.term(wiki,at("id",0),at("variant",1),at("value",2),DM).parts;
		case "dice": return rules.diceText(wiki,at("value",0),DM).parts;
		case "damage": return rules.damage(wiki,at("value",0),false,DM).parts;
		default: return rules.rule(wiki,at("name",0),at("entry",1),DM).parts;
	}
}

exports.names = function(wiki,title) {
	var tiddler = wiki.getTiddler(title),
		out = [];
	if(!tiddler) {
		return out;
	}
	var f = tiddler.fields,
		types = lib("relations").types(wiki),
		fields = lib("fields"),
		glossary = lib("glossary"),
		add = function(name,relation) {
			if(typeof name === "string" && name.trim()) {
				out.push({title: name.trim(), relation: relation || null});
			}
		};
	$tw.utils.each(types,function(type,name) {
		if(type.kind === "field" && f[name]) {
			list(f[name]).forEach(function(target) { add(target,name); });
		}
	});
	list(f.tags).concat(list(f.list)).forEach(function(name) { add(name); });
	Object.keys(f).forEach(function(name) {
		var spec = !types[name] && fields.spec(wiki,name);
		if(!spec || ["titles","labels","label"].indexOf(spec.format) === -1) {
			return;
		}
		var read = fields.read(wiki,f,name);
		if(spec.format === "titles") {
			$tw.utils.each(read.items,function(item) { add(item.title); });
		} else {
			// As the block of values links them (filters/fields.js): an entry of a domain
			$tw.utils.each(read.items || (read.id ? [read] : []),function(item) {
				add(item.domain ? glossary.term(wiki,item.id,DM) : null);
			});
		}
	});
	if((f.type || "text/vnd.tiddlywiki") !== "text/vnd.tiddlywiki" || !f.text) {
		return out;
	}
	var text = f.text,
		parser = wiki.parseTiddler(title),
		tree = parser ? parser.tree : [],
		sections = lib("sections"),
		kinds = sections.rulesKinds(wiki);
	wiki.extractLinks(tree).concat(wiki.extractTranscludes(tree,title)).forEach(function(name) { add(name); });
	text.replace(LINKS,function(match,inner) {
		add(inner.indexOf("|") === -1 ? inner : inner.slice(inner.indexOf("|") + 1));
		return match;
	});
	text.replace(MACROS,function(call,macro) {
		$tw.utils.each(parts(wiki,macro,params(wiki,call)),function(part) { add(part.to); });
		return call;
	});
	$tw.utils.each(sections.read(wiki,title).records,function(record) {
		var p = record.params || {};
		if(kinds[record.kind] && p.plain) {
			add(glossary.named(wiki,p.plain,DM));
		} else if(record.kind === "spot" && p.target) {
			add(p.target);
		}
	});
	return out;
};

exports.collect = function(wiki,wikiPath) {
	var content = lib("content"),
		server = lib("content-server"),
		ruleset = lib("plugin-types").active(wiki,"ruleset"),
		index = ruleset ? server.index(wikiPath,ruleset) : [],
		tiddlers = Object.create(null),
		round = [];
	if(!index.some(function(p) { return p.entries.length; })) {
		return tiddlers;
	}
	// From the start: entries included before count as not there
	exports.install(wiki,{});
	wiki.addTiddler(new $tw.Tiddler({title: content.INDEX, type: "application/json", text: JSON.stringify({ruleset: ruleset, packages: index})}));
	wiki.each(function(tiddler,title) {
		if(!tiddler.isDraft() && !tiddler.isPlugin() && !/^\$:\/(temp|state)\//.test(title)) {
			round.push(title);
		}
	});
	while(round.length) {
		var found = Object.create(null);
		round.forEach(function(title) {
			exports.names(wiki,title).forEach(function(n) {
				if(exists(wiki,n.title)) {
					return;
				}
				var hits = n.relation ? [content.forRelation(wiki,n.relation,n.title)].filter(Boolean) : content.find(wiki,n.title);
				if(hits.length === 1) {
					found[hits[0].id] = hits[0];
				}
			});
		});
		round = [];
		$tw.utils.each(found,function(offer) {
			var hit = server.entry(wikiPath,ruleset,offer.entry.id,offer.package.name);
			if(hit && !tiddlers[offer.title]) {
				tiddlers[offer.title] = content.toFields(wiki,offer.package,hit.entry,offer.title);
				round.push(offer.title);
			}
		});
		if(round.length) {
			exports.install(wiki,tiddlers);
		}
	}
	wiki.deleteTiddler(content.INDEX);
	return tiddlers;
};

exports.install = function(wiki,tiddlers) {
	var PLUGIN = lib("content").PLUGIN,
		titles = Object.keys(tiddlers),
		all = Object.create(null);
	if(!titles.length) {
		if(wiki.tiddlerExists(PLUGIN)) {
			wiki.unregisterPluginTiddlers(null,[PLUGIN]);
			wiki.deleteTiddler(PLUGIN);
			wiki.unpackPluginTiddlers();
		}
		return;
	}
	$tw.utils.each(tiddlers,function(fields,title) {
		all[title] = $tw.utils.extend({},fields,{title: title, tags: $tw.utils.stringifyList(fields.tags || [])});
	});
	all[STYLES] = {title: STYLES, type: "text/css", tags: "$:/tags/Stylesheet", text: exports.styles(titles)};
	wiki.addTiddler(new $tw.Tiddler({
		title: PLUGIN,
		type: "application/json",
		"plugin-type": "plugin",
		name: "Content packages",
		description: "Entries of the content packages this wiki names",
		version: lib("plugin-types").coreVersion(wiki) || "",
		text: JSON.stringify({tiddlers: all})
	}));
	wiki.readPluginInfo([PLUGIN]);
	wiki.registerPluginTiddlers("plugin",[PLUGIN]);
	wiki.unpackPluginTiddlers();
};

// A link to an entry without an own version: italics in the weight of a link, as the core shows a
// missing link (styles/links shows missing ones in the weight of the text); an own version in the
// weight of a link, not lighter as the core shows a changed shadow
exports.styles = function(titles) {
	var quote = function(text) {
			return "\"" + text.replace(/\\/g,"\\\\").replace(/"/g,"\\\"") + "\"";
		},
		selector = function(suffix) {
			return titles.map(function(title) {
				return "a.tc-tiddlylink-shadow" + suffix + "[href=" + quote("#" + $tw.utils.encodeURIComponentExtended(title)) + "]";
			}).join(",\n");
		};
	if(!titles.length) {
		return "";
	}
	return "/* The entries of the content packages the wiki names (modules/content-include.js) */\n" +
		selector(":not(.tc-tiddlylink-resolves)") + " {\n\tfont-style: italic;\n\tfont-weight: 500;\n}\n" +
		selector(".tc-tiddlylink-resolves") + " {\n\tfont-weight: 500;\n}\n";
};
