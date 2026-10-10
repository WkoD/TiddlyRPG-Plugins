/*\
title: $:/plugins/tiddlyrpg-core/modules/rules.js
type: application/javascript
module-type: library
created: 20261009183000000
modified: 20261010070618000

Rules engine: the macros <<unit>>, <<dice>>, <<damage>> and <<term>> (functions.tid, operators in
filters/rules.js) show rules terms in the display language of their domain (modules/language.js,
"rules language"). The engine knows types of domains, never their names; what a domain contains
is data of the active ruleset or setting, in the JSON of its domain tiddler and in language keys
$:/tiddlyrpg/language/<code>/<key>. Parsing accepts the words of every language, case-insensitive.

Domain types and their data:

  unit     numbers with a unit, converted between systems (e.g. imperial and metric)
    "units":    {"<id>": {"system": "<system>", "factor": <n>, "shortcut": "<name>"}} - factor =
                size in the base unit of its system in this domain (Length: in 1, ft 12, mi
                63360; cm 1, m 100); shortcut optional (see shortcuts())
    "pairs":    [["<unit>", "<unit>", <factor>]] - first unit times factor gives the second; per
                pair, not over a common base, as the rules round per pair (ft->m 0.3, mi->km 1.6);
                a value converts by the pair of its unit, else by the first pair of its system
    "defaults": ["<unit>"] - units for which this domain applies without a kind
    "kinds":    {"<kind>": {"unit": {"<system>": "<unit>"}, "display": {"<system>": rule}}} - a
                kind (height, range ...) chooses the domain, the unit of a number without unit
                by the system of the input language, and optionally a display of its own
    "display":  {"<system>": rule} - how a value is shown in a system, without kind or for a
                kind without display of its own: {"steps": [step, ...]}, the first step whose
                "below" (in base units of the system) the value is under, else the last; a step
                is {"unit": "m", "decimals": 2} or {"compound": ["ft", "in"]} - whole big units
                and the rest in whole small units
    keys: Rules/Unit/<id> (label), Rules/Unit/<id>/Parse (more words, comma separated),
          Rules/Unit/System (the system of a language: imperial, metric ...)
    A value already in the display system stays as written; only the label is translated.

  label    terms shown by id, e.g. abilities, conditions
    "entries":  [{"id": "<id>", "shortcut": "<name>"}] - shortcut optional (see shortcuts())
    keys: Rules/Term/<id>, Rules/Term/<id>/<variant>; a label with $value$ takes a number

  tokens   single tokens inside expressions, e.g. the die in 1d6 / 1W6, Bulk L
    "tokens":   [{"id": "<id>", "before": "<regex>", "after": "<regex>"}] - the token counts
                only between these (dice: "\\d*" and "\\d+")
    keys: Rules/Token/<id>

  damage   damage expressions: parts of a calculation (dice, numbers, +/-, an average with the
           dice in brackets), qualifiers and a type; parts joined by "+", "plus", "and"
    "entries":  [{"id": "<id>"}, {"id": "<id>", "qualifier": true}] - "shortcut" optional
    keys: Rules/Damage/<id> (name), Rules/Damage/<id>/Phrase (the type as it reads after the
          dice, "cold damage", "Kälteschaden"), Rules/Damage/<id>/Parse (more words),
          Rules/Damage/Pattern ($dice$ $qualifiers$ $type$), Rules/Damage/Join (between parts),
          Rules/Damage/Joiners, Rules/Damage/Fillers, Rules/Damage/Extras (words to read and
          drop: "plus", "damage", "extra"; comma separated)
    The dice of the calculation follow the tokens domains.

  calendar, currency: see modules/calendar.js and modules/currency.js. <<unit>> shows coins
  ("3 gp 5 sp") through the currency when the text holds no length or weight.

Every domain may have "example": an input shown in the settings tab next to its output ("228 cm",
"1d8 cold", "wis save", a date for a calendar).

Numbers take "." or "," as decimal mark and are shown with the one of the wiki language
(Number/Decimal); no thousands separator.

Every function returns {text, problem}: what to show and, if something was not understood, a
problem key (Rules/Check/...) with its values; unknown parts show unchanged. check() lists the
problems of the macro calls in the body of a tiddler.

\*/

"use strict";

var language = require("$:/plugins/tiddlyrpg-core/modules/language.js");

var PREFIX = "$:/tiddlyrpg/language/",
	BASE = "en-GB",
	MACROS = {unit: ["value","kind"], dice: ["value"], damage: ["value"], term: ["id","arg"]};

function escape(text) {
	return text.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
}

// A key in one language, then en-GB
function inLanguage(wiki,code,key) {
	return wiki.getTiddlerText(PREFIX + code + "/" + key) || wiki.getTiddlerText(PREFIX + BASE + "/" + key) || null;
}

// The texts of a key in every language
function everyLanguage(wiki,key) {
	return language.languages(wiki).map(function(code) {
		return wiki.getTiddlerText(PREFIX + code + "/" + key);
	}).filter(Boolean);
}

// The words of keys in every language, split at commas
function words(wiki,keys) {
	var result = [];
	keys.forEach(function(key) {
		everyLanguage(wiki,key).forEach(function(text) {
			text.split(",").forEach(function(word) {
				word = word.trim();
				if(word && result.indexOf(word) === -1) {
					result.push(word);
				}
			});
		});
	});
	return result;
}

function byType(wiki,type) {
	var domains = language.domains(wiki);
	return Object.keys(domains).map(function(name) { return domains[name]; }).filter(function(d) {
		return d.type === type;
	});
}

function result(text,problem,values) {
	return {text: text, problem: problem || null, values: values || {}};
}

/* Numbers */

function parseNumber(text) {
	return parseFloat(text.replace(",","."));
}

// Rounded half up to the decimals (2.275 -> 2.28, which toFixed gives as 2.27), trailing zeros
// dropped, with the decimal mark of the wiki language
var formatNumber = exports.formatNumber = function(wiki,value,decimals) {
	decimals = decimals || 0;
	var rounded = Number(Math.round(Number(value + "e" + decimals)) + "e-" + decimals);
	if(!isFinite(rounded)) {
		rounded = Number(value.toFixed(decimals));
	}
	var text = rounded.toString();
	if(text.indexOf("e") !== -1) {
		text = rounded.toFixed(decimals);
	}
	return text.replace(".",language.t(wiki,"Number/Decimal") === "," ? "," : ".");
};

// A number as written, with the decimal mark of the wiki language
function asWritten(wiki,text) {
	return text.replace(/[.,]/,language.t(wiki,"Number/Decimal") === "," ? "," : ".");
}

/* Units */

// {word (lower case): unit id}, longest words first in .pattern
function unitWords(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-rules-unit-words",function() {
		var map = Object.create(null);
		byType(wiki,"unit").forEach(function(domain) {
			Object.keys(domain.units || {}).forEach(function(id) {
				[id].concat(words(wiki,["Rules/Unit/" + id,"Rules/Unit/" + id + "/Parse"])).forEach(function(word) {
					map[word.toLowerCase()] = map[word.toLowerCase()] || id;
				});
			});
		});
		var list = Object.keys(map).sort(function(a,b) { return b.length - a.length; });
		return {map: map, pattern: list.length ? list.map(escape).join("|") : null};
	});
}

function systemOf(wiki,code) {
	return (inLanguage(wiki,code,"Rules/Unit/System") || "").trim() || null;
}

function displaySystem(wiki,domain) {
	return systemOf(wiki,language.rulesLang(wiki,domain.domain,"display"));
}

function unitLabel(wiki,domain,id) {
	return language.lookupRules(wiki,domain.domain,"Rules/Unit/" + id) || id;
}

// The domain of units written next to each other ("7 ft 7 in"): the one of the kind if it knows
// them all, else of the domains that know them all in one system the one that is the default
// for most of them ("30 ft" is a distance, "7 ft 7 in" a size); null if none knows them all
function domainOfUnits(wiki,ids,kindDomain) {
	var knows = function(d) {
		var units = d.units || {};
		return ids.every(function(id) { return units[id] && units[id].system === units[ids[0]].system; });
	};
	if(kindDomain && knows(kindDomain)) {
		return kindDomain;
	}
	var best = null,
		bestScore = -1;
	byType(wiki,"unit").filter(knows).forEach(function(d) {
		var score = ids.filter(function(id) { return (d.defaults || []).indexOf(id) !== -1; }).length;
		if(score > bestScore) {
			best = d;
			bestScore = score;
		}
	});
	return best;
}

function domainOfKind(wiki,kind) {
	return byType(wiki,"unit").filter(function(d) { return d.kinds && d.kinds[kind]; })[0] || null;
}

// A value in base units of the source system converted to base units of the target system
function convert(domain,value,unit,target) {
	var units = domain.units,
		source = units[unit].system,
		pairs = (domain.pairs || []).map(function(p) {
			return units[p[0]] && units[p[0]].system === source && units[p[1]] && units[p[1]].system === target ? {from: p[0], to: p[1], factor: p[2]} :
				units[p[1]] && units[p[1]].system === source && units[p[0]] && units[p[0]].system === target ? {from: p[1], to: p[0], factor: 1 / p[2]} : null;
		}).filter(Boolean),
		pair = pairs.filter(function(p) { return p.from === unit; })[0] || pairs[0];
	if(!pair) {
		return null;
	}
	return value / units[pair.from].factor * pair.factor * units[pair.to].factor;
}

// A value in base units of a system as text, by the display rule of the kind or of the domain
function show(wiki,domain,system,value,kind) {
	var ofKind = kind && domain.kinds && domain.kinds[kind] && domain.kinds[kind].display,
		rule = (ofKind && ofKind[system]) || (domain.display || {})[system],
		units = domain.units,
		steps = rule && rule.steps || [],
		step = steps.filter(function(s) { return s.below === undefined || value < s.below; })[0] || steps[steps.length - 1];
	if(!step) {
		return null;
	}
	if(step.compound) {
		var big = step.compound[0],
			small = step.compound[1],
			ratio = Math.round(units[big].factor / units[small].factor),
			total = Math.round(value / units[small].factor),
			n = Math.floor(total / ratio),
			rest = total - n * ratio,
			parts = [];
		if(n) {
			parts.push(n + " " + unitLabel(wiki,domain,big));
		}
		if(rest || !n) {
			parts.push(rest + " " + unitLabel(wiki,domain,small));
		}
		return parts.join(" ");
	}
	return formatNumber(wiki,value / units[step.unit].factor,step.decimals) + " " + unitLabel(wiki,domain,step.unit);
}

// <<unit value kind>>: "228 cm", "30 ft., fly 50 ft.", "7 ft 7 in", or a number with a kind
exports.unit = function(wiki,text,kind) {
	text = (text || "").toString().trim();
	kind = (kind || "").trim();
	var kindDomain = kind ? domainOfKind(wiki,kind) : null;
	if(kind && !kindDomain) {
		return result(text,"Rules/Check/Kind",{kind: kind});
	}
	if(/^\d+(?:[.,]\d+)?$/.test(text)) {
		if(!kindDomain) {
			return result(text,"Rules/Check/NoUnit",{text: text});
		}
		var system = systemOf(wiki,language.rulesLang(wiki,kindDomain.domain,"input")),
			id = system && (kindDomain.kinds[kind].unit || {})[system];
		if(!id) {
			return result(text,"Rules/Check/NoUnit",{text: text});
		}
		text = text + " " + id;
	}
	var unitInfo = unitWords(wiki);
	// Coins, when no length or weight is written (the German KM is also km): the currency
	var asPrice = function() {
		var currency = require("$:/plugins/tiddlyrpg-core/modules/currency.js"),
			cur = !kind && currency.active(wiki),
			parsed = cur && currency.parse(wiki,cur,text);
		return parsed && parsed.amounts.length && !parsed.invalid && !parsed.unknown ? result(currency.format(wiki,cur,text)) : null;
	};
	if(!unitInfo.pattern) {
		return asPrice() || result(text,"Rules/Check/NoRules",{type: "unit"});
	}
	var re = new RegExp("(\\d+(?:[.,]\\d+)?)\\s*(" + unitInfo.pattern + ")(?![\\p{L}\\d])","giu"),
		found = [],
		match;
	while((match = re.exec(text))) {
		found.push({start: match.index, end: match.index + match[0].length, number: match[1], unit: unitInfo.map[match[2].toLowerCase()]});
	}
	if(!found.length) {
		return asPrice() || result(text,"Rules/Check/Unit",{text: text});
	}
	// Quantities next to each other (only spaces between) that one domain knows are one value
	var groups = [];
	found.forEach(function(q) {
		var last = groups[groups.length - 1],
			units = last ? last.units.concat(q.unit) : null;
		if(last && /^\s*$/.test(text.slice(last.end,q.start)) && domainOfUnits(wiki,units,kindDomain)) {
			last.items.push(q);
			last.units = units;
			last.end = q.end;
		} else {
			groups.push({items: [q], units: [q.unit], start: q.start, end: q.end});
		}
	});
	groups.forEach(function(group) {
		group.domain = domainOfUnits(wiki,group.units,kindDomain);
	});
	var output = "",
		pos = 0;
	groups.forEach(function(group) {
		var domain = group.domain,
			first = group.items[0].unit,
			source = domain.units[first].system,
			target = displaySystem(wiki,domain),
			shown = null;
		if(target && target !== source) {
			var value = 0;
			group.items.forEach(function(q) {
				value += parseNumber(q.number) * domain.units[q.unit].factor;
			});
			var converted = convert(domain,value,first,target);
			shown = converted === null ? null : show(wiki,domain,target,converted,domain === kindDomain ? kind : null);
		}
		if(shown === null) {
			shown = group.items.map(function(q) {
				return asWritten(wiki,q.number) + " " + unitLabel(wiki,domain,q.unit);
			}).join(" ");
		}
		output += text.slice(pos,group.start) + shown;
		pos = group.end;
	});
	return result(output + text.slice(pos));
};

/* Tokens */

// The tokens domains as [{re, id, domain}]: the token words of every language in their context
function tokenRules(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-rules-tokens",function() {
		var rules = [];
		byType(wiki,"tokens").forEach(function(domain) {
			(domain.tokens || []).forEach(function(token) {
				var list = words(wiki,["Rules/Token/" + token.id]).sort(function(a,b) { return b.length - a.length; });
				if(list.length) {
					rules.push({
						id: token.id,
						domain: domain,
						re: new RegExp("(" + (token.before || "") + ")(?:" + list.map(escape).join("|") + ")(" + (token.after || "") + ")","gi")
					});
				}
			});
		});
		return rules;
	});
}

var dice = exports.dice = function(wiki,text) {
	text = (text || "").toString();
	tokenRules(wiki).forEach(function(rule) {
		var label = language.lookupRules(wiki,rule.domain.domain,"Rules/Token/" + rule.id) || "";
		rule.re.lastIndex = 0;
		text = text.replace(rule.re,function(all,before,after) {
			return before + label + after;
		});
	});
	return result(text);
};

/* Labels */

function findEntry(wiki,type,id) {
	var lower = id.toLowerCase(),
		found = null;
	byType(wiki,type).some(function(domain) {
		return (domain.entries || []).some(function(entry) {
			if(entry.id.toLowerCase() === lower) {
				found = {domain: domain, entry: entry};
				return true;
			}
			return false;
		});
	});
	return found;
}

// <<term id variant|value>>: "wis", "wis save", "frightened 2"
exports.term = function(wiki,id,arg) {
	id = (id || "").toString().trim();
	arg = (arg || "").toString().trim();
	var found = id && findEntry(wiki,"label",id);
	if(!found) {
		return result(id + (arg ? " " + arg : ""),"Rules/Check/Term",{id: id});
	}
	var domain = found.domain.domain,
		key = "Rules/Term/" + found.entry.id,
		value = /^-?\d+$/.test(arg);
	if(arg && !value) {
		var variant = language.lookupRules(wiki,domain,key + "/" + arg);
		if(variant === null) {
			return result(id + " " + arg,"Rules/Check/Variant",{id: id, variant: arg});
		}
		return result(variant);
	}
	var label = language.lookupRules(wiki,domain,key) || found.entry.id;
	if(value) {
		label = label.indexOf("$value$") !== -1 ? label.replace("$value$",arg) : label + " " + arg;
	}
	return result(label.replace(/\s*\$value\$/,""));
};

/* Damage */

// The words of the damage domains: [{word, kind: type|qualifier|joiner|filler|extra, id, domain}]
function damageWords(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-rules-damage-words",function() {
		var list = [];
		var add = function(kind,id,domain,keys) {
			words(wiki,keys).forEach(function(word) {
				list.push({word: word.toLowerCase(), kind: kind, id: id, domain: domain});
			});
		};
		byType(wiki,"damage").forEach(function(domain) {
			(domain.entries || []).forEach(function(entry) {
				var key = "Rules/Damage/" + entry.id;
				list.push({word: entry.id.toLowerCase(), kind: entry.qualifier ? "qualifier" : "type", id: entry.id, domain: domain});
				add(entry.qualifier ? "qualifier" : "type",entry.id,domain,[key,key + "/Phrase",key + "/Parse"]);
			});
			add("joiner",null,domain,["Rules/Damage/Joiners"]);
			add("filler",null,domain,["Rules/Damage/Fillers"]);
			add("extra",null,domain,["Rules/Damage/Extras"]);
		});
		// Longest first, so that "cold damage" wins over "cold"
		return list.sort(function(a,b) { return b.word.length - a.word.length; });
	});
}

// The start of a calculation: an average with the dice in brackets ("7 (1d8 + 3)"), dice with
// the tokens of every language ("1d8", "1W8"), a number, an operator or spaces
function calcPattern(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-rules-calc",function() {
		var tokens = [];
		byType(wiki,"tokens").forEach(function(domain) {
			(domain.tokens || []).forEach(function(token) {
				tokens = tokens.concat(words(wiki,["Rules/Token/" + token.id]));
			});
		});
		var die = tokens.length ? "|\\d*\\s*(?:" + tokens.map(escape).join("|") + ")\\s*\\d+" : "";
		return new RegExp("^(?:\\d+\\s*\\([^)]*\\)" + die + "|\\d+|[+\\-−]|\\s+)","i");
	});
}

// <<damage value>>: "1d8 slashing", "1d8 + 1d4 + 1 fire DMG", "1d8 bludgeon und 1d8 cold"
exports.damage = function(wiki,text) {
	text = (text || "").toString().trim();
	var known = damageWords(wiki);
	if(!known.length) {
		return result(dice(wiki,text).text,"Rules/Check/NoRules",{type: "damage"});
	}
	var calc = calcPattern(wiki),
		parts = [],
		part = {calc: "", qualifiers: [], type: null},
		rest = text,
		domain = null,
		unknown = null;
	while(rest.length) {
		var lower,
			hit = null;
		// A "+" right after a type starts the next part; before it, it belongs to the calculation
		if(part.type && /^\s*\+/.test(rest)) {
			parts.push(part);
			part = {calc: "", qualifiers: [], type: null};
			rest = rest.replace(/^\s*\+\s*/,"");
			continue;
		}
		var m = !part.type && !part.qualifiers.length && calc.exec(rest);
		if(m && m[0].length) {
			part.calc += m[0];
			rest = rest.slice(m[0].length);
			continue;
		}
		rest = rest.replace(/^\s+/,"");
		if(!rest.length) {
			break;
		}
		lower = rest.toLowerCase();
		known.some(function(w) {
			if(lower.indexOf(w.word) === 0 && !/[\p{L}\d]/u.test(lower.charAt(w.word.length))) {
				hit = w;
				return true;
			}
			return false;
		});
		if(!hit) {
			unknown = rest.split(/\s/)[0];
			break;
		}
		rest = rest.slice(hit.word.length);
		domain = domain || hit.domain;
		if(hit.kind === "type") {
			if(part.type) {
				unknown = hit.word;
				break;
			}
			part.type = hit.id;
		} else if(hit.kind === "qualifier") {
			part.qualifiers.push(hit.id);
		} else if(hit.kind === "joiner") {
			if(part.type) {
				parts.push(part);
				part = {calc: "", qualifiers: [], type: null};
			}
		}
		// fillers and extras are read and dropped
	}
	parts.push(part);
	if(unknown) {
		return result(dice(wiki,text).text,"Rules/Check/Damage",{text: unknown});
	}
	if(!parts.some(function(p) { return p.type; })) {
		return result(dice(wiki,text).text,"Rules/Check/DamageType",{text: text});
	}
	var name = domain.domain,
		pattern = language.lookupRules(wiki,name,"Rules/Damage/Pattern") || "$dice$ $qualifiers$ $type$",
		join = language.lookupRules(wiki,name,"Rules/Damage/Join") || "+";
	var shown = parts.filter(function(p) { return p.calc.trim() || p.type; }).map(function(p) {
		var key = "Rules/Damage/" + p.type;
		return language.format(pattern,{
			dice: dice(wiki,p.calc.trim().replace(/\s+/g," ")).text,
			qualifiers: p.qualifiers.map(function(q) {
				return language.lookupRules(wiki,name,"Rules/Damage/" + q) || q;
			}).join(" "),
			type: p.type ? (language.lookupRules(wiki,name,key + "/Phrase") || language.lookupRules(wiki,name,key) || p.type) : ""
		}).replace(/\s+/g," ").trim();
	});
	return result(shown.join(" " + join + " "));
};

/* Shortcuts */

/*
The shortcuts the data names, {name: {kind, id}}: a label entry (kind "term", <<wis save>> is
<<term wis save>>), a damage entry ("damage", <<fire 1d6>> is <<damage "1d6 fire">>), a unit
("unit", <<ft 30 range>> is <<unit "30 ft" range>>) and a coin of the active currency ("coin",
<<gp 50>> is <<unit "50 gp">>). The procedures stand next to the data in their plugin (tag
$:/tags/Global); the hub strikes through a shortcut without one, the check reads its calls like
those of the macro it stands for. The first entry of a name wins.
*/
var shortcuts = exports.shortcuts = function(wiki) {
	return wiki.getGlobalCache("tiddlyrpg-rules-shortcuts",function() {
		var result = Object.create(null);
		var add = function(name,kind,id) {
			if(name && !result[name]) {
				result[name] = {kind: kind, id: id};
			}
		};
		$tw.utils.each(language.domains(wiki),function(domain) {
			if(domain.type === "label" || domain.type === "damage") {
				$tw.utils.each(domain.entries,function(entry) {
					add(entry.shortcut,domain.type === "label" ? "term" : "damage",entry.id);
				});
			} else if(domain.type === "unit") {
				$tw.utils.each(domain.units,function(unit,id) {
					add(unit.shortcut,"unit",id);
				});
			}
		});
		var cur = require("$:/plugins/tiddlyrpg-core/modules/currency.js").active(wiki);
		$tw.utils.each(cur ? cur.coins : [],function(coin) {
			add(coin.shortcut,"coin",coin.id);
		});
		return result;
	});
};

// The hint on a shortcut without procedure, naming the macro to write instead
exports.noShortcut = function(wiki,name) {
	var shortcut = shortcuts(wiki)[name],
		long = !shortcut ? "" :
			shortcut.kind === "term" ? "<<term " + shortcut.id + ">>" :
			shortcut.kind === "damage" ? "<<damage \"n " + shortcut.id + "\">>" :
			"<<unit \"n " + shortcut.id + "\">>";
	return language.format(language.t(wiki,"Ruleset/Hub/NoShortcut"),{name: name, long: long});
};

/* The hub "Ruleset" */

// The display name of a domain (Rules/Domain/<name> of the data plugins), else its name
var domainLabel = exports.domainLabel = function(wiki,name) {
	return language.lookup(wiki,"Rules/Domain/" + name) || name;
};

// Whether a global macro, procedure or function of that name exists ($:/tags/Global, the core
// macros)
function defined(wiki,name) {
	return require("$:/plugins/tiddlyrpg-core/modules/macros-check.js").defined(wiki,name);
}

function html(text) {
	return $tw.utils.htmlEncode(text === null || text === undefined ? "" : text.toString());
}

// The keys under a prefix in a language: {rest of the key: text}
function keysIn(wiki,code,prefix) {
	var result = {},
		full = PREFIX + code + "/" + prefix;
	var add = function(tiddler,title) {
		if(title.indexOf(full) === 0) {
			result[title.substr(full.length)] = wiki.getTiddlerText(title);
		}
	};
	wiki.each(add);
	wiki.eachShadow(add);
	return result;
}

/*
The table of a domain for the hub, as HTML: one row per entry, unit or token, a column for the
shortcut (struck through while no macro of that name exists) and one per language that has keys
of the domain, the display language marked. Units also list their pairs and kinds. Calendar and
currency point to their hubs. Empty for an unknown domain.
*/
exports.table = function(wiki,name) {
	var domain = language.domains(wiki)[name];
	if(!domain) {
		return "";
	}
	if(domain.type === "calendar" || domain.type === "currency") {
		var hub = domain.type === "calendar" ? "Calendar" : "Currency";
		return "<p>" + html(language.format(language.t(wiki,"Ruleset/Hub/See"),{hub: language.title(wiki,hub)})) +
			" <$link to=\"" + hub + "\">" + html(language.title(wiki,hub)) + "</$link></p>";
	}
	var codes = language.languages(wiki,domain.keys),
		shown = language.rulesLang(wiki,name,"display"),
		cls = function(code) { return code === shown ? " class=\"trpg-rules-shown\"" : ""; },
		rows = [],
		hasShortcut = domain.type === "label" || domain.type === "damage" || domain.type === "unit";
	var cell = function(text) { return "<td>" + html(text) + "</td>"; };
	var row = function(id,shortcut,texts) {
		var short = "";
		if(hasShortcut) {
			short = !shortcut ? "<td></td>" : defined(wiki,shortcut) ? "<td><code>&lt;&lt;" + html(shortcut) + "&gt;&gt;</code></td>" :
				// The attribute is encoded by the wikitext parser itself
				"<td><s title=\"" + exports.noShortcut(wiki,shortcut).replace(/"/g,"'") + "\">&lt;&lt;" + html(shortcut) + "&gt;&gt;</s></td>";
		}
		rows.push("<tr><td><code>" + html(id) + "</code></td>" + short + codes.map(function(code,i) {
			return "<td" + cls(code) + ">" + texts[i] + "</td>";
		}).join("") + "</tr>");
	};
	if(domain.type === "label") {
		(domain.entries || []).forEach(function(entry) {
			row(entry.id,entry.shortcut,codes.map(function(code) {
				var all = keysIn(wiki,code,"Rules/Term/" + entry.id),
					variants = Object.keys(all).filter(function(k) { return k.charAt(0) === "/"; }).sort();
				return html(all[""] || "") + variants.map(function(k) {
					return "<br><small>" + html(k.substr(1)) + ": " + html(all[k]) + "</small>";
				}).join("");
			}));
		});
	} else if(domain.type === "damage") {
		(domain.entries || []).forEach(function(entry) {
			row(entry.id,entry.shortcut,codes.map(function(code) {
				var key = "Rules/Damage/" + entry.id,
					phrase = wiki.getTiddlerText(PREFIX + code + "/" + key + "/Phrase");
				return html(wiki.getTiddlerText(PREFIX + code + "/" + key) || "") + (phrase ? "<br><small>" + html(phrase) + "</small>" : "") +
					(entry.qualifier ? " <small>(" + html(language.t(wiki,"Ruleset/Hub/Qualifier")) + ")</small>" : "");
			}));
		});
	} else if(domain.type === "tokens") {
		(domain.tokens || []).forEach(function(token) {
			row(token.id,null,codes.map(function(code) {
				return "<code>" + html(wiki.getTiddlerText(PREFIX + code + "/Rules/Token/" + token.id) || "") + "</code>";
			}));
		});
	} else if(domain.type === "unit") {
		Object.keys(domain.units || {}).forEach(function(id) {
			row(id,domain.units[id].shortcut,codes.map(function(code) {
				return html(wiki.getTiddlerText(PREFIX + code + "/Rules/Unit/" + id) || "");
			}));
		});
	}
	var head = "<tr><th>" + html(language.t(wiki,"Ruleset/Hub/Id")) + "</th>" +
		(hasShortcut ? "<th>" + html(language.t(wiki,"Ruleset/Hub/Shortcut")) + "</th>" : "") +
		codes.map(function(code) {
			var name = wiki.getTiddler("$:/languages/" + code) ? wiki.getTiddler("$:/languages/" + code).fields.description || code : code;
			return "<th" + cls(code) + ">" + html(name) + "</th>";
		}).join("") + "</tr>";
	var out = "<table class=\"trpg-rules-hub\">" + head + rows.join("") + "</table>";
	if(domain.type === "unit") {
		var pairs = (domain.pairs || []).map(function(p) {
				return "1 " + unitLabel(wiki,domain,p[0]) + " = " + formatNumber(wiki,p[2],4) + " " + unitLabel(wiki,domain,p[1]);
			}),
			kinds = Object.keys(domain.kinds || {}).map(function(kind) {
				var units = domain.kinds[kind].unit || {};
				return kind + " (" + Object.keys(units).map(function(s) { return unitLabel(wiki,domain,units[s]); }).join(" / ") + ")";
			});
		out += "<p>" + (pairs.length ? html(language.t(wiki,"Ruleset/Hub/Pairs")) + " " + html(pairs.join(", ")) : "") +
			(kinds.length ? "<br>" + html(language.t(wiki,"Ruleset/Hub/Kinds")) + " " + html(kinds.join(", ")) : "") + "</p>";
	}
	return out;
};

/* Examples */

// The example of a domain ("example" in its JSON) as {input, output}, shown the way its type
// shows it; null without example. A label example is "<id> [variant|value]".
exports.example = function(wiki,name) {
	var domain = language.domains(wiki)[name],
		input = domain && domain.example ? domain.example.toString() : "";
	if(!input) {
		return null;
	}
	var output;
	switch(domain.type) {
		case "unit":
		case "currency":
			output = exports.unit(wiki,input).text;
			break;
		case "tokens":
			output = dice(wiki,input).text;
			break;
		case "damage":
			output = exports.damage(wiki,input).text;
			break;
		case "label":
			var parts = input.split(/\s+/);
			output = exports.term(wiki,parts[0],parts.slice(1).join(" ")).text;
			break;
		case "calendar":
			output = wiki.filterTiddlers("[<v>dateformat[]]",$tw.rootWidget.makeFakeWidgetWithVariables({v: input}))[0] || input;
			break;
		default:
			output = input;
	}
	return {input: input, output: output};
};

/* Check */

// The values of the parameters of a macro call node
function params(node,names) {
	var values = {},
		attributes = node.attributes || {};
	names.forEach(function(name,index) {
		var a = attributes[name] || attributes[index.toString()];
		values[name] = a && a.type === "string" ? a.value : (a ? null : "");
	});
	return values;
}

// Whether a parameter is computed (null): such a call cannot be checked here
function computed(p) {
	return Object.keys(p).some(function(name) { return p[name] === null; });
}

// The result of a call of a rules macro, or null
function runMacro(wiki,name,node) {
	var p = params(node,MACROS[name]);
	return computed(p) ? null :
		name === "unit" ? exports.unit(wiki,p.value,p.kind) :
		name === "dice" ? dice(wiki,p.value) :
		name === "damage" ? exports.damage(wiki,p.value) :
		exports.term(wiki,p.id,p.arg);
}

// The result of a call of a shortcut, as the macro it stands for computes it, or null
var SHORTCUT_PARAMS = {term: ["variant"], damage: ["dice"], unit: ["n","kind"], coin: ["n"]};
function runShortcut(wiki,name,node) {
	var shortcut = shortcuts(wiki)[name],
		p = shortcut && params(node,SHORTCUT_PARAMS[shortcut.kind]);
	return !shortcut || computed(p) ? null :
		shortcut.kind === "term" ? exports.term(wiki,shortcut.id,p.variant) :
		shortcut.kind === "damage" ? exports.damage(wiki,(p.dice + " " + shortcut.id).trim()) :
		exports.unit(wiki,(p.n + " " + shortcut.id).trim(),p.kind || "");
}

// The problems of the rules macros and shortcuts in the body of a tiddler: texts in the wiki
// language. Calls in a section the active view does not see are left out - the hint would show
// their text.
exports.check = function(wiki,title) {
	var parsed = wiki.parseTiddler(title),
		hidden = require("$:/plugins/tiddlyrpg-core/modules/sections.js").hiddenRanges(wiki,title),
		problems = [];
	var inHidden = function(node) {
		return node.start !== undefined && hidden.some(function(range) {
			return node.start >= range[0] && node.start < range[1];
		});
	};
	var walk = function(nodes) {
		$tw.utils.each(nodes,function(node) {
			var attrs = node.attributes || {},
				name = node.type === "transclude" && attrs.$variable && attrs.$variable.value,
				r = name && !inHidden(node) ? (MACROS[name] ? runMacro(wiki,name,node) : runShortcut(wiki,name,node)) : null;
			if(r && r.problem) {
				var text = language.format(language.t(wiki,r.problem),r.values);
				if(problems.indexOf(text) === -1) {
					problems.push(text);
				}
			}
			walk(node.children);
		});
	};
	walk(parsed ? parsed.tree : []);
	return problems;
};
