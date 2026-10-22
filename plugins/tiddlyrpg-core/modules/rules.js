/*\
title: $:/plugins/tiddlyrpg-core/modules/rules.js
type: application/javascript
module-type: library
created: 20261009183000000
modified: 20261022141507011

Rules engine: the macros <<unit>>, <<dice>>, <<damage>> and <<term>> (functions.tid, operators in
filters/rules.js) show rules terms in the display language of their domain (modules/language.js,
"rules language"). The engine knows types of domains, never their names; what a domain contains
is data of the active ruleset or setting, in the JSON of its domain tiddler and in language keys
$:/tiddlyrpg/language/<code>/<key>. Parsing accepts the words of every language, case-insensitive.

Domain types and their data:

  unit     numbers with a unit, converted between systems (e.g. imperial and metric)
    "units":    {"<id>": {"system": "<system>", "factor": <n>}} - factor = size in the base
                unit of its system in this domain (Length: in 1, ft 12, mi 63360; cm 1, m 100)
    "pairs":    [["<unit>", "<unit>", <factor>]] - first unit times factor gives the second; per
                pair, not over a common base, as the rules round per pair (ft->m 0.3, mi->km 1.6);
                a value converts by the pair of its unit, else by the first pair of its system
    "defaults": ["<unit>"] - units for which this domain applies without a kind
    "kinds":    {"<kind>": {"display": {"<system>": rule}, "pair": true}} - a kind (range,
                distance, size ...) chooses the domain and optionally a display of its own; the
                value still carries its unit (<<unit "60 ft" kind:"range">>) - a number without
                unit is not read. Where the display of the kind would show a value that is not 0
                as 0 (30 ft as distance: "0 km"), the display of the domain applies. "pair": the
                kind reads "a/b <unit>" as two values ("20/60 ft" -> "6/18 m"); without it "a/b"
                is a fraction ("1/4 lb") when b is 2, 3, 4, 8 or 16 and a < b, else a pair with the
                hint Rules/Check/Pair
    "display":  {"<system>": rule} - how a value is shown in a system, without kind or for a
                kind without display of its own: {"steps": [step, ...]}, the first step whose
                "below" (in base units of the system) the value is under, else the last; a step
                is {"unit": "m", "decimals": 2} or {"compound": ["ft", "in"]} - whole big units
                and the rest in whole small units
    keys: Rules/Unit/<id> (label), Rules/Unit/<id>/Plural (label for an amount other than 1,
          optional: "round" / "rounds"), Rules/Unit/<id>/Parse (more words, comma separated),
          Rules/Unit/System (the system of a language: imperial, metric ...)
    A value already in the display system stays as written; only the label is translated. A
    domain whose units all have a system no language names (e.g. "none": durations) is never
    converted, only labelled. Amounts: "1,5", "1/4", "½", "1½"; measures "10 x 10 x 1 ft" convert
    every number; a unit followed by ² or ³ is not that unit (ft³ must be a unit of its own). The
    value 0 shows in the unit its pair converts to ("0 ft" -> "0 m").

  label    terms shown by id, e.g. abilities, conditions
    "entries":  [{"id": "<id>"}] - or main entries and traits ({"id", "main": true, "tag"},
                {"id", "for": [...]}) and their reading: modules/labels.js
    "extends":  true - not a domain of its own: adds its "entries" to the label domain named in
                "domain" (an extension of a campaign; modules/language.js)
    keys: <keys><id>, <keys><id>/<variant> with "keys" of the domain, default Rules/Term/; a
          label with $value$ takes a number. Ids are unique among the entries that stand alone; a
          domain whose traits repeat ids of another domain needs keys of its own.
    <<term "armor medium">>: a main entry with its traits; a single id finds only an entry that
    stands alone.

  tokens   single tokens inside expressions, e.g. the die in 1d6 / 1W6, Bulk L
    "tokens":   [{"id": "<id>", "before": "<regex>", "after": "<regex>"}] - the token counts
                only between these (dice: "\\d*" and "\\d+")
    keys: Rules/Token/<id>

  damage   damage expressions: parts of a calculation (dice, numbers, +/-, an average with the
           dice in brackets), qualifiers and a type; parts joined by "+", "plus", "and"
    "entries":  [{"id": "<id>"}, {"id": "<id>", "qualifier": true}]
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
	MACROS = {unit: ["value","kind"], dice: ["value"], damage: ["value"], term: ["id","variant","value"]};

// modules/labels.js, loaded when first used (it requires this module for the values of entries)
function labels() {
	return require("$:/plugins/tiddlyrpg-core/modules/labels.js");
}

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

var VULGAR = {"½": 0.5, "¼": 0.25, "¾": 0.75};

function parseNumber(text) {
	return parseFloat(text.replace(",","."));
}

// Whether "a/b" is a fraction: a small denominator of a measure (2, 3, 4, 8, 16) above the
// numerator - "1/4 lb"; a range like "20/60" or "80/320" never is
function isFraction(a,b) {
	var n = parseInt(a,10),
		d = parseInt(b,10);
	return /^\d+$/.test(a.trim()) && /^\d+$/.test(b.trim()) && [2,3,4,8,16].indexOf(d) !== -1 && n < d;
}

// An amount as written before a unit: "3", "1,5", "1/4", "½", "1½"
function parseAmount(text) {
	text = text.trim();
	var fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(text);
	if(fraction) {
		return parseInt(fraction[1],10) / parseInt(fraction[2],10);
	}
	var m = /^(\d+(?:[.,]\d+)?)?\s*([½¼¾])?$/.exec(text);
	return m ? (m[1] ? parseNumber(m[1]) : 0) + (m[2] ? VULGAR[m[2]] : 0) : NaN;
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

// The system a unit domain is shown in, as the label of the wiki language
// (Settings/Rules/System/<system>, else the id): "metrisch". "" for other domain types.
exports.systemLabel = function(wiki,name) {
	var domain = language.domains(wiki)[name],
		system = domain && domain.type === "unit" ? systemOf(wiki,language.rulesLang(wiki,name)) : null;
	return system ? language.lookup(wiki,"Settings/Rules/System/" + system) || system : "";
};

function displaySystem(wiki,domain) {
	return systemOf(wiki,language.rulesLang(wiki,domain.domain));
}

// The label of a unit; for an amount other than 1 the plural (Rules/Unit/<id>/Plural) if the
// data has one: "1 round", "2 rounds"
function unitLabel(wiki,domain,id,amount) {
	var plural = amount !== undefined && amount !== 1 && language.lookupRules(wiki,domain.domain,"Rules/Unit/" + id + "/Plural");
	return plural || language.lookupRules(wiki,domain.domain,"Rules/Unit/" + id) || id;
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

// The kinds that read "a/b <unit>" as two values ("pair": true): their names, for the hint
function pairKinds(wiki) {
	var names = [];
	byType(wiki,"unit").forEach(function(d) {
		Object.keys(d.kinds || {}).forEach(function(k) {
			if(d.kinds[k].pair && names.indexOf(k) === -1) {
				names.push(k);
			}
		});
	});
	return names;
}

// The unit a value of a unit is converted to: the target of its pair (ft -> m)
function pairTarget(domain,unit,target) {
	var units = domain.units,
		hit = null;
	(domain.pairs || []).some(function(p) {
		if(p[0] === unit && units[p[1]] && units[p[1]].system === target) {
			hit = p[1];
		} else if(p[1] === unit && units[p[0]] && units[p[0]].system === target) {
			hit = p[0];
		}
		return !!hit;
	});
	return hit;
}

// A value in base units of the source system converted to base units of the target system, cut
// to 12 significant digits: 70 in / 12 * 0.3 m is 174.99999999999997 cm in floating point, which
// would show as 1,7 m with one decimal and miss the step "below 100" at 99.99999 cm
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
	return Number((value / units[pair.from].factor * pair.factor * units[pair.to].factor).toPrecision(12));
}

// A value in base units of a system as text, by the display rule of the kind or of the domain. A
// value that is not 0 never shows as 0: then the rule of the domain applies.
function show(wiki,domain,system,value,kind) {
	var ofKind = kind && domain.kinds && domain.kinds[kind] && domain.kinds[kind].display,
		byKind = !!(ofKind && ofKind[system]),
		rule = byKind ? ofKind[system] : (domain.display || {})[system],
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
		if(!total && value && byKind) {
			return show(wiki,domain,system,value,null);
		}
		if(n) {
			parts.push(n + " " + unitLabel(wiki,domain,big));
		}
		if(rest || !n) {
			parts.push(rest + " " + unitLabel(wiki,domain,small));
		}
		return parts.join(" ");
	}
	var amount = formatNumber(wiki,value / units[step.unit].factor,step.decimals);
	if(value && byKind && parseFloat(amount.replace(",",".")) === 0) {
		return show(wiki,domain,system,value,null);
	}
	return amount + " " + unitLabel(wiki,domain,step.unit,parseFloat(amount.replace(",",".")));
}

// Several values with one unit ("20/60 ft", "10 × 10 × 1 ft") as text: the step the largest value
// takes, every number with its decimals, the label once; a compound step shows each value on
// its own
function showMany(wiki,domain,system,values,kind,separator) {
	var ofKind = kind && domain.kinds && domain.kinds[kind] && domain.kinds[kind].display,
		rule = ofKind && ofKind[system] ? ofKind[system] : (domain.display || {})[system],
		steps = rule && rule.steps || [],
		largest = Math.max.apply(null,values),
		step = steps.filter(function(s) { return s.below === undefined || largest < s.below; })[0] || steps[steps.length - 1];
	if(!step) {
		return null;
	}
	if(step.compound) {
		return values.map(function(v) { return show(wiki,domain,system,v,kind); }).join(separator);
	}
	var factor = domain.units[step.unit].factor;
	return values.map(function(v) {
		return formatNumber(wiki,v / factor,step.decimals);
	}).join(separator) + " " + unitLabel(wiki,domain,step.unit,largest / factor);
}

// <<unit value kind>>: "228 cm", "30 ft., fly 50 ft.", "7 ft 7 in"; a kind chooses the display.
// A number without unit is not read: what a text means does not depend on a setting.
// An amount is a number ("1,5"), a fraction ("1/4", "½", "1½"), two values of a kind that reads
// pairs ("20/60 ft" with kind range, "pair": true) or measures ("10 x 10 x 1 ft"); every number
// of a pair or of measures is converted. "a/b" without such a kind is a fraction when b is 2, 3,
// 4, 8 or 16 and a < b ("1/4 lb"), else read as a pair with a hint (Rules/Check/Pair). A unit followed by ² or ³ is no length:
// such a value needs a unit of its own (ft³ of a volume domain).
exports.unit = function(wiki,text,kind) {
	text = (text || "").toString().trim();
	kind = (kind || "").trim();
	var kindDomain = kind ? domainOfKind(wiki,kind) : null;
	if(kind && !kindDomain) {
		return result(text,"Rules/Check/Kind",{kind: kind});
	}
	if(/^\d+(?:[.,]\d+)?$/.test(text)) {
		return result(text,"Rules/Check/NoUnit",{text: text});
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
	var NUM = "(?:\\d+(?:[.,]\\d+)?\\s?[½¼¾]?|[½¼¾])",
		re = new RegExp("(" + NUM + "(?:\\s*[/x×]\\s*" + NUM + ")*)\\s*(" + unitInfo.pattern + ")(?![\\p{L}\\d²³])","giu"),
		pairKind = !!(kindDomain && kindDomain.kinds[kind].pair),
		problem = null,
		found = [],
		match;
	while((match = re.exec(text))) {
		var amount = match[1],
			dims = amount.split(/\s*[x×]\s*/),
			q = {start: match.index, end: match.index + match[0].length, unit: unitInfo.map[match[2].toLowerCase()]};
		if(dims.length > 1) {
			q.form = "dims";
			q.parts = dims;
		} else if(/\//.test(amount)) {
			var halves = amount.split(/\s*\/\s*/);
			if(pairKind || !isFraction(halves[0],halves[1])) {
				q.form = "pair";
				q.parts = halves;
				if(!pairKind) {
					problem = problem || {key: "Rules/Check/Pair",values: {text: text,kinds: pairKinds(wiki).join(", ")}};
				}
			} else {
				q.form = "single";
				q.parts = [amount];
			}
		} else {
			q.form = "single";
			q.parts = [amount];
		}
		q.values = q.parts.map(parseAmount);
		found.push(q);
	}
	if(!found.length) {
		return asPrice() || result(text,"Rules/Check/Unit",{text: text});
	}
	// Quantities next to each other (only spaces between) that one domain knows are one value
	var groups = [];
	found.forEach(function(q) {
		var last = groups[groups.length - 1],
			units = last ? last.units.concat(q.unit) : null;
		if(last && q.form === "single" && last.items[0].form === "single" && /^\s*$/.test(text.slice(last.end,q.start)) && domainOfUnits(wiki,units,kindDomain)) {
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
			first = group.items[0],
			source = domain.units[first.unit].system,
			target = displaySystem(wiki,domain),
			ownKind = domain === kindDomain ? kind : null,
			separator = first.form === "pair" ? "/" : " × ",
			shown = null;
		if(target && target !== source) {
			if(first.form === "single") {
				var value = 0;
				group.items.forEach(function(q) {
					value += q.values[0] * domain.units[q.unit].factor;
				});
				var converted = convert(domain,value,first.unit,target),
					to = pairTarget(domain,first.unit,target);
				shown = converted === null ? null :
					converted === 0 && to ? "0 " + unitLabel(wiki,domain,to,0) :
					show(wiki,domain,target,converted,ownKind);
			} else {
				var values = first.values.map(function(v) {
					return convert(domain,v * domain.units[first.unit].factor,first.unit,target);
				});
				shown = values.some(function(v) { return v === null; }) ? null : showMany(wiki,domain,target,values,ownKind,separator);
			}
		}
		if(shown === null) {
			shown = group.items.map(function(q) {
				var written = q.parts.map(function(p) { return asWritten(wiki,p.trim()); }).join(q.form === "pair" ? "/" : " × ");
				return written + " " + unitLabel(wiki,domain,q.unit,Math.max.apply(null,q.values));
			}).join(" ");
		}
		output += text.slice(pos,group.start) + shown;
		pos = group.end;
	});
	var done = problem ? result(output + text.slice(pos),problem.key,problem.values) : result(output + text.slice(pos));
	done.domains = groups.map(function(group) { return group.domain.domain; });
	return done;
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

// The entry of an id among the entries that stand alone (modules/labels.js: a trait is found only
// with its main entry, <<term "armor medium">>)
function findEntry(wiki,type,id) {
	var lower = id.toLowerCase(),
		found = null;
	byType(wiki,type).some(function(domain) {
		return (domain.entries || []).some(function(entry) {
			if(entry.id.toLowerCase() === lower && labels().standsAlone(entry)) {
				found = {domain: domain, entry: entry};
				return true;
			}
			return false;
		});
	});
	return found;
}

// <<term id variant|value>>: "wis", "wis save", "frightened 2"
// A term in the rules language: <id>, with a variant ("save": Rules/Term/<id>/<variant>) and/or
// a value ("frightened 2": in place of $value$ in the text, or after it)
exports.term = function(wiki,id,variant,value) {
	id = (id || "").toString().trim();
	variant = (variant || "").toString().trim();
	value = (value || "").toString().trim();
	var written = [id,variant,value].filter(function(s) { return !!s; }).join(" ");
	// Several ids: a main entry and its traits (<<term "armor medium">>)
	if(/\s/.test(id)) {
		var chain = labels().chain(wiki,id.split(/\s+/));
		return chain || result(written,"Rules/Check/Term",{id: id});
	}
	var found = id && findEntry(wiki,"label",id);
	if(!found) {
		return result(written,"Rules/Check/Term",{id: id});
	}
	var domain = found.domain.domain,
		key = (found.domain.keys || "Rules/Term/") + found.entry.id,
		text = language.lookupRules(wiki,domain,variant ? key + "/" + variant : key);
	if(text === null) {
		if(variant) {
			return result(written,"Rules/Check/Variant",{id: id, variant: variant});
		}
		text = found.entry.id;
	}
	if(value) {
		text = text.indexOf("$value$") !== -1 ? text.replace("$value$",value) : text + " " + value;
	}
	return result(text.replace(/\s*\$value\$/,""));
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

/* Values of fields (modules/fields.js) */

// A number: "19", "+2", "-1", "1,5"; spec.min/spec.max limit it. Shown as written, with the
// decimal mark of the wiki language and the sign it carries.
var number = exports.number = function(wiki,spec,text) {
	text = (text || "").toString().trim();
	if(!/^[+\-−]?\d+(?:[.,]\d+)?$/.test(text)) {
		return result(text,"Rules/Check/Number",{text: text});
	}
	var value = parseNumber(text.replace("−","-"));
	if((spec.min !== undefined && value < spec.min) || (spec.max !== undefined && value > spec.max)) {
		return result(text,"Rules/Check/NumberRange",{text: text, min: spec.min === undefined ? "" : spec.min, max: spec.max === undefined ? "" : spec.max});
	}
	var r = result(asWritten(wiki,text.replace("−","-")));
	r.value = value;
	return r;
};

// Yes or no: the words of Field/Boolean/Yes|No and their Parse in every language; shown in the
// wiki language
var boolean = exports.boolean = function(wiki,spec,text) {
	text = (text || "").toString().trim().toLowerCase();
	var yes = ["yes","true"].concat(words(wiki,["Field/Boolean/Yes","Field/Boolean/Yes/Parse"])).map(function(w) { return w.toLowerCase(); }),
		no = ["no","false"].concat(words(wiki,["Field/Boolean/No","Field/Boolean/No/Parse"])).map(function(w) { return w.toLowerCase(); });
	if(yes.indexOf(text) !== -1 || no.indexOf(text) !== -1) {
		var r = result(language.t(wiki,yes.indexOf(text) !== -1 ? "Field/Boolean/Yes" : "Field/Boolean/No"));
		r.value = yes.indexOf(text) !== -1;
		return r;
	}
	return result(text,"Rules/Check/Boolean",{text: text});
};

// A dice expression to check: dice and numbers joined by + and - ("1d6", "1d4 + 1", "2"), with the
// tokens of spec.domain (a tokens domain, e.g. Bulk "L") or of every tokens domain; an average
// with the dice in brackets ("7 (2d6)") too
var diceValue = exports.diceValue = function(wiki,spec,text) {
	text = (text || "").toString().trim();
	var tokens = [];
	byType(wiki,"tokens").filter(function(domain) {
		return !spec.domain || domain.domain === spec.domain;
	}).forEach(function(domain) {
		(domain.tokens || []).forEach(function(token) {
			tokens = tokens.concat(words(wiki,["Rules/Token/" + token.id]));
		});
	});
	var tok = tokens.length ? "(?:" + tokens.sort(function(a,b) { return b.length - a.length; }).map(escape).join("|") + ")" : null,
		term = tok ? "(?:\\d*\\s*" + tok + "\\s*\\d*|\\d+)" : "\\d+",
		re = new RegExp("^(?:\\d+\\s*\\(\\s*)?" + term + "(?:\\s*[+\\-−]\\s*" + term + ")*(?:\\s*\\))?$","i");
	return re.test(text) ? dice(wiki,text) : result(text,"Rules/Check/Dice",{text: text});
};

/*
The value of a field by its definition (spec, modules/fields.js): spec.format is one of
  unit     spec.domain, spec.kind; spec.words: a label domain whose entries stand in place of a
           number (range "self"), spec.only limits them; the units must belong to spec.domain
  damage   a damage expression
  dice     diceValue(), spec.domain a tokens domain
  label    one entry (modules/labels.js), spec.domain, spec.only
  labels   a list (modules/labels.js), spec.domain (a name or a list), spec.only, spec.value,
           spec.values
  number   spec.min, spec.max
  boolean  yes or no
  text     shown as written, never checked
Returns {text, problem, values} like the macros.
*/
exports.value = function(wiki,spec,text) {
	spec = spec || {};
	text = (text === undefined || text === null ? "" : text).toString().trim();
	switch(spec.format) {
		case "unit":
			if(spec.words) {
				var word = labels().label(wiki,{domain: spec.words, only: spec.only},text);
				if(!word.problem) {
					return word;
				}
			}
			var u = exports.unit(wiki,text,spec.kind);
			if(!u.problem && spec.domain && (u.domains || []).some(function(d) { return d !== spec.domain; })) {
				return result(text,"Rules/Check/UnitDomain",{text: text, domain: domainLabel(wiki,spec.domain)});
			}
			return u;
		case "damage":
			return exports.damage(wiki,text);
		case "dice":
			return diceValue(wiki,spec,text);
		case "label":
			return labels().label(wiki,spec,text);
		case "labels":
			return labels().labels(wiki,spec,text);
		case "number":
			return number(wiki,spec,text);
		case "boolean":
			return boolean(wiki,spec,text);
		default:
			return result(text);
	}
};

/* The hub "Ruleset" */

// The display name of a domain (Rules/Domain/<name> of the data plugins), else its name
var domainLabel = exports.domainLabel = function(wiki,name) {
	return language.lookup(wiki,"Rules/Domain/" + name) || name;
};

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
The table of a domain for the hub, as HTML: one row per entry, unit or token, and the column of
the language the domain is shown in (rulesLang; a key missing there in en-GB, like
lookupRules). Units also list their pairs and kinds. Calendar and currency point to their hubs.
Empty for an unknown domain.
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
	var code = language.rulesLang(wiki,name),
		rows = [];
	var text = function(key) {
		return wiki.getTiddlerText(PREFIX + code + "/" + key) || wiki.getTiddlerText(PREFIX + BASE + "/" + key) || "";
	};
	var row = function(id,shown) {
		rows.push("<tr><td><code>" + html(id) + "</code></td><td>" + shown + "</td></tr>");
	};
	if(domain.type === "label") {
		(domain.entries || []).forEach(function(entry) {
			var prefix = (domain.keys || "Rules/Term/") + entry.id,
				all = $tw.utils.extend(keysIn(wiki,BASE,prefix),keysIn(wiki,code,prefix)),
				variants = Object.keys(all).filter(function(k) { return k.charAt(0) === "/"; }).sort();
			row(entry.id,html(all[""] || "") + variants.map(function(k) {
				return "<br><small>" + html(k.substr(1)) + ": " + html(all[k]) + "</small>";
			}).join(""));
		});
	} else if(domain.type === "damage") {
		(domain.entries || []).forEach(function(entry) {
			var key = "Rules/Damage/" + entry.id,
				phrase = text(key + "/Phrase");
			row(entry.id,html(text(key)) + (phrase ? "<br><small>" + html(phrase) + "</small>" : "") +
				(entry.qualifier ? " <small>(" + html(language.t(wiki,"Ruleset/Hub/Qualifier")) + ")</small>" : ""));
		});
	} else if(domain.type === "tokens") {
		(domain.tokens || []).forEach(function(token) {
			row(token.id,"<code>" + html(text("Rules/Token/" + token.id)) + "</code>");
		});
	} else if(domain.type === "unit") {
		Object.keys(domain.units || {}).forEach(function(id) {
			row(id,html(text("Rules/Unit/" + id)));
		});
	}
	var pack = wiki.getTiddler("$:/languages/" + code),
		head = "<tr><th>" + html(language.t(wiki,"Ruleset/Hub/Id")) + "</th><th>" +
			html(pack ? pack.fields.description || code : code) + "</th></tr>";
	var out = "<table class=\"trpg-rules-hub\">" + head + rows.join("") + "</table>";
	if(domain.type === "unit") {
		var pairs = (domain.pairs || []).map(function(p) {
				return "1 " + unitLabel(wiki,domain,p[0]) + " = " + formatNumber(wiki,p[2],4) + " " + unitLabel(wiki,domain,p[1]);
			}),
			kinds = Object.keys(domain.kinds || {});
		out += "<p>" + (pairs.length ? html(language.t(wiki,"Ruleset/Hub/Pairs")) + " " + html(pairs.join(", ")) : "") +
			(kinds.length ? "<br>" + html(language.t(wiki,"Ruleset/Hub/Kinds")) + " " + html(kinds.join(", ")) : "") + "</p>";
	}
	return out;
};

/* Examples */

// The example of a domain ("example" in its JSON) as {input, output}, shown the way its type
// shows it; null without example. A label example is "<id> [variant] [value]", a number is the
// value.
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
			var parts = input.split(/\s+/),
				last = parts.length > 1 && /^-?\d+$/.test(parts[parts.length - 1]) ? parts.pop() : "";
			output = exports.term(wiki,parts[0],parts.slice(1).join(" "),last).text;
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
		exports.term(wiki,p.id,p.variant,p.value);
}

// The problems of the rules macros in the body of a tiddler, each {key, params}
// (checks/macros.js, rule macros/rules). Calls in a section the view does not see are left out -
// the hint would show their text.
exports.check = function(wiki,title,view) {
	var parsed = wiki.parseTiddler(title),
		hidden = require("$:/plugins/tiddlyrpg-core/modules/sections.js").hiddenRanges(wiki,title,view),
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
				r = name && MACROS[name] && !inHidden(node) ? runMacro(wiki,name,node) : null;
			if(r && r.problem) {
				problems.push({key: r.problem, params: r.values || {}});
			}
			walk(node.children);
		});
	};
	walk(parsed ? parsed.tree : []);
	return problems;
};
