/*
 * The fields of the rules (modules/fields.js) against fixture-ruleset-5e-mini: definitions and
 * schemas per type, merged with those of the wiki; labels; what a field derives (modifier,
 * average, total, lookup, sum over the entries of a list, computed entries); the header line;
 * "when"; copyFrom() with the lock; the rule fields/schema.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki, fields, checks, rules;

var TAG = "$:/tags/tiddlyrpg/RulesFields";

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		fields = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/fields.js");
		checks = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/checks.js");
		rules = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/rules.js");
		h.setLanguage(wiki, "de-DE");
	});
});

function read(values, field) {
	return fields.read(wiki, values, field);
}

function withSchema(title, data, fn) {
	h.add(wiki, {title: title, tags: TAG, type: "application/json", text: JSON.stringify(data)});
	try {
		return fn();
	} finally {
		wiki.deleteTiddler(title);
	}
}

function schemaMessages() {
	var all = checks.all(wiki, "dm", ["fields"]),
		out = [];
	Object.keys(all).forEach(function(title) {
		all[title].forEach(function(message) {
			out.push({title: title, key: message.key, field: message.params.field});
		});
	});
	return out;
}

test.describe("schemas", function() {
	test("the fields of a type in the order of its schema, groups, labels", function() {
		var schema = fields.forTypes(wiki, ["Item"]);
		assert.equal(schema.fields.join(), "category,rarity,attunement,damage,range,bonus,ac,weight,healing");
		assert.equal(schema.groups.map(function(g) { return g.id; }).join(), "properties,trade");
		assert.equal(fields.forTypes(wiki, ["Spell"]).labels.level, "Rules/Field/level/spell");
		assert.equal(fields.forTypes(wiki, ["Location"]).fields.length, 0);
	});

	test("the schema of a tiddler follows its type tags", function() {
		h.add(wiki, {title: "Ring", tags: "Item"});
		try {
			assert.equal(fields.forTiddler(wiki, "Ring").fields[0], "category");
		} finally {
			wiki.deleteTiddler("Ring");
		}
	});

	test("labels in the language of the ruleset; per schema; the name without key", function() {
		assert.equal(fields.label(wiki, "ac"), "Rüstungsklasse");
		assert.equal(fields.label(wiki, "level", fields.forTypes(wiki, ["Spell"]).labels), "Zaubergrad");
		assert.equal(fields.label(wiki, "saves"), "Rettungswürfe", "a field with a domain");
		assert.equal(fields.label(wiki, "nope"), "nope");
	});

	test("a schema of the wiki adds fields and fields of a group", function() {
		withSchema("Fields of the campaign", {
			definitions: {charm: {format: "text"}},
			types: ["Item"],
			fields: ["charm", "rarity"],
			groups: [{id: "properties", fields: ["charm"]}]
		}, function() {
			var schema = fields.forTypes(wiki, ["Item"]);
			assert.equal(schema.fields[schema.fields.length - 1], "charm");
			assert.equal(schema.fields.filter(function(f) { return f === "rarity"; }).length, 1);
			assert.equal(schema.groups[0].fields.join(), "damage,range,ac,bonus,healing,charm");
			assert.deepEqual(schemaMessages().map(function(m) { return m.key + " " + m.field; }), ["Check/Fields/Hidden charm"], "the field list of the editor would show it too");
			h.add(wiki, {title: "$:/config/EditTemplateFields/Visibility/charm", text: "hide"});
			try {
				assert.deepEqual(schemaMessages(), []);
			} finally {
				wiki.deleteTiddler("$:/config/EditTemplateFields/Visibility/charm");
			}
		});
		assert.equal(fields.forTypes(wiki, ["Item"]).groups[0].fields.join(), "damage,range,ac,bonus,healing", "the ruleset's group unchanged");
	});

	test("fields/schema: reserved names, defined twice, without definition, not hidden", function() {
		withSchema("Bad fields", {
			definitions: {title: {format: "text"}, price: {format: "text"}, owner: {format: "text"}, damage: {format: "text"}},
			types: ["Item"],
			fields: ["nope"]
		}, function() {
			var messages = schemaMessages();
			assert.deepEqual(messages.map(function(m) { return m.key + " " + m.field; }).sort(), [
				"Check/Fields/Reserved owner",
				"Check/Fields/Reserved price",
				"Check/Fields/Reserved title",
				"Check/Fields/Twice damage",
				"Check/Fields/Undefined nope"
			]);
			assert.ok(messages.every(function(m) { return m.title === "Bad fields"; }));
			assert.equal(fields.spec(wiki, "damage").format, "damage", "the ruleset's definition stays");
		});
	});
});

test.describe("values", function() {
	test("a modifier beside the value", function() {
		assert.equal(read({str: "8"}, "str").text, "8 (-1)");
		assert.equal(read({str: "12"}, "str").text, "12 (+1)");
		assert.equal(read({str: "40"}, "str").problem, "Rules/Check/NumberRange");
	});

	test("an average before the dice", function() {
		assert.match(read({healing: "2d4 + 2"}, "healing").text, /^7 \(2W4 \+ 2\)$/);
		assert.equal(fields.average("1d8"), 4);
		assert.equal(fields.average("2d6+1d4-1"), 8);
		assert.equal(fields.average("Feuer"), null);
	});

	test("a total beside the value; the sign of the value stays", function() {
		assert.equal(read({ac: "18", bonus: "+1"}, "ac").text, "19 (18 + 1)");
		assert.equal(read({ac: "+2", bonus: "+1"}, "ac").text, "+3 (+2 + 1)");
		assert.equal(read({ac: "16"}, "ac").text, "16");
		assert.equal(read({bonus: "+2"}, "bonus").text, "+2");
	});

	test("lookup: a column of the entry another field names; a written value wins", function() {
		var wolf = {cr: "5"};
		assert.equal(read(wolf, "proficiency").text, "+3");
		assert.equal(read(wolf, "proficiency").derived, true);
		assert.equal(read(wolf, "xp").text, "1800");
		assert.equal(read({cr: "1/4"}, "xp").text, "50");
		assert.equal(read({cr: "0", xp: "0"}, "xp").text, "0");
		assert.equal(read({cr: "0", xp: "0"}, "xp").written, true);
		assert.equal(read({}, "proficiency").text, "");
		assert.equal(read({}, "proficiency").derived, false);
	});

	test("sum over the entries of a list: saves, skills with expertise", function() {
		var wolf = {cr: "5", dex: "15", wis: "12", saves: "dex", skills: "perception, stealth +6", expertise: "perception"};
		assert.equal(read(wolf, "saves").text, "GES +5");
		assert.equal(read(wolf, "skills").text, "Wahrnehmung +7, Heimlichkeit +6");
		assert.equal(read(Object.assign({}, wolf, {expertise: ""}), "skills").text, "Wahrnehmung +4, Heimlichkeit +6");
		assert.equal(read({saves: "dex"}, "saves").text, "GES", "nothing to sum: the entry alone");
	});

	test("a computed entry: passive perception from the skill, else from wisdom; a written one wins", function() {
		var wolf = {cr: "5", wis: "12", skills: "perception", expertise: "perception", senses: "darkvision 60 ft"};
		assert.match(read(wolf, "senses").text, /^Dunkelsicht \S+ m, passive Wahrnehmung 17$/);
		assert.equal(read({wis: "8"}, "senses").text, "passive Wahrnehmung 9", "computed without a written value");
		assert.equal(read({wis: "8", senses: "passive perception 13"}, "senses").text, "passive Wahrnehmung 13");
		assert.equal(read({}, "senses").text, "");
	});

	test("a field without definition: as written", function() {
		assert.equal(read({mood: "grim"}, "mood").text, "grim");
	});
});

test.describe("an entry shown bare", function() {
	test("with a value it shows the value alone, without one its term; read by its words", function() {
		h.add(wiki, {title: "$:/tiddlyrpg/rules/domain/Move", tags: "$:/tags/tiddlyrpg/RulesDomain", type: "application/json",
			text: JSON.stringify({domain: "Move", type: "label", keys: "Rules/Move/", entries: [{id: "walk", bare: true}, {id: "fly"}]})});
		h.add(wiki, {title: "$:/tiddlyrpg/language/de-DE/Rules/Move/fly", text: "Fliegen"});
		try {
			var spec = {format: "labels", domain: "Move", value: {format: "unit", domain: "Length"}};
			assert.equal(rules.value(wiki, spec, "walk 30 ft, fly 60 ft").text, "9 m, Fliegen 18 m");
			assert.equal(rules.value(wiki, spec, "walk").text, "walk");
		} finally {
			wiki.deleteTiddler("$:/tiddlyrpg/rules/domain/Move");
			wiki.deleteTiddler("$:/tiddlyrpg/language/de-DE/Rules/Move/fly");
		}
	});
});

test.describe("when", function() {
	test("a field holds one of the values, an id of a list counts", function() {
		var when = fields.spec(wiki, "damage").when;
		assert.equal(fields.fits(wiki, {category: "weapon, melee"}, when), true);
		assert.equal(fields.fits(wiki, {category: "Waffe"}, when), true, "read by its label");
		assert.equal(fields.fits(wiki, {category: "potion"}, when), false);
		assert.equal(fields.fits(wiki, {}, when), false);
		assert.equal(fields.fits(wiki, {}, null), true);
	});

	test("a field the schema does not have sets no condition", function() {
		var when = fields.spec(wiki, "damage").when;
		assert.equal(fields.fits(wiki, {}, when, fields.forTypes(wiki, ["Spell"]).fields), true);
		assert.equal(fields.fits(wiki, {}, when, fields.forTypes(wiki, ["Item"]).fields), false);
	});
});

test.describe("summary", function() {
	var schema;

	test.before(function() {
		schema = fields.forTypes(wiki, ["Spell"]);
	});

	test("ordinal and flag, in the language of the ruleset", function() {
		assert.equal(fields.summary(wiki, {level: "1", ritual: "yes"}, schema).text, "Zauber 1. Grades (Ritual)");
		assert.equal(fields.summary(wiki, {level: "1", ritual: "no"}, schema).text, "Zauber 1. Grades", "a flag in braces falls away");
		assert.equal(fields.summary(wiki, {level: "3"}, schema).text, "Zauber 3. Grades");
		assert.equal(fields.summary(wiki, {level: "1"}, schema).fields.join(), "level,ritual");
	});

	test("a part in braces falls away when a field in it is empty; a field outside empties the whole", function() {
		var items = fields.forTypes(wiki, ["Item"]);
		assert.equal(fields.summary(wiki, {category: "potion"}, items).text, "Trank");
		assert.equal(fields.summary(wiki, {category: "potion", rarity: "rare"}, items).text, "Trank, selten");
		assert.equal(fields.summary(wiki, {category: "potion", attunement: "yes"}, items).text, "Trank (erfordert Einstimmung)");
		assert.equal(fields.summary(wiki, {rarity: "rare", attunement: "yes"}, items).text, "", "no kind: no header line");
		assert.deepEqual(fields.summary(wiki, {rarity: "rare"}, items).fields.length, 0, "then the fields show as lines");
	});

	test("a key of its own while a field holds anything (ifSet)", function() {
		withSchema("Swarm", {types: ["Organisation"], fields: ["size", "hp"], summary: {key: "Swarm/Plain", ifSet: {hp: "Swarm/Set"}}}, function() {
			h.add(wiki, {title: "$:/tiddlyrpg/language/de-DE/Swarm/Plain", text: "$size$"});
			h.add(wiki, {title: "$:/tiddlyrpg/language/de-DE/Swarm/Set", text: "$size$ mit $hp$"});
			try {
				var creature = fields.forTypes(wiki, ["Organisation"]);
				assert.equal(fields.summary(wiki, {size: "tiny"}, creature).text, "winzig");
				assert.equal(fields.summary(wiki, {size: "tiny", hp: "2d4"}, creature).text, "winzig mit 5 (2W4)");
			} finally {
				wiki.deleteTiddler("$:/tiddlyrpg/language/de-DE/Swarm/Plain");
				wiki.deleteTiddler("$:/tiddlyrpg/language/de-DE/Swarm/Set");
			}
		});
	});

	test("another key for a value; empty without the field", function() {
		assert.equal(fields.summary(wiki, {level: "0"}, schema).text, "Zaubertrick");
		assert.equal(fields.summary(wiki, {}, schema).text, "");
		assert.equal(fields.summary(wiki, {level: "1"}, fields.forTypes(wiki, ["Item"])).text, "");
	});

	test("en-GB", function() {
		h.setLanguage(wiki, "en-GB");
		try {
			assert.equal(fields.summary(wiki, {level: "1", ritual: "yes"}, schema).text, "1st-level spell (ritual)");
			assert.equal(fields.summary(wiki, {level: "0"}, schema).text, "cantrip");
		} finally {
			h.setLanguage(wiki, "de-DE");
		}
	});
});

test.describe("copyFrom", function() {
	test.before(function() {
		h.add(wiki, {title: "Draft of Frostbringer", tags: "Item", "draft.of": "Frostbringer"});
	});

	test.after(function() {
		wiki.deleteTiddler("Draft of Frostbringer");
	});

	test("the empty fields of the schema, never price, nothing written over", function() {
		var out = fields.copyFrom(wiki, {title: "Draft of Frostbringer", damage: "1d8 bludgeoning"},
			{title: "Warhammer", category: "weapon, martial, melee, versatile", damage: "1d8 bludgeoning", weight: "2 lb", price: "15 gp", mood: "grim"});
		assert.equal(JSON.stringify(out), JSON.stringify({category: "weapon, martial, melee, versatile", weight: "2 lb"}));
	});

	test("a locked field comes with its lock", function() {
		var draft = {title: "Draft of Frostbringer", "secret-fields": "rarity"},
			out = fields.copyFrom(wiki, draft, {title: "Hammer", category: "weapon", weight: "2 lb", "secret-fields": "weight"});
		assert.equal(out.weight, "2 lb");
		assert.equal(out["secret-fields"], "rarity weight");
		assert.equal(fields.copyFrom(wiki, draft, {title: "Hammer", category: "weapon"})["secret-fields"], undefined);
		var all = fields.copyFrom(wiki, {title: "Draft of Frostbringer"}, {title: "Hammer", category: "weapon", "secret-fields": ""});
		assert.equal(all["secret-fields"], "category");
	});

	test("locked: none, all, a list", function() {
		assert.equal(fields.locked({}), null);
		assert.equal(fields.locked({"secret-fields": ""}), "all");
		assert.equal(fields.locked({"secret-fields": "all"}), "all");
		assert.equal(fields.locked({"secret-fields": "ac cursed"}).join(), "ac,cursed");
	});
});

test.describe("the block of values", function() {
	function block(title) {
		var html = h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/viewtemplates/fields\" mode=\"block\"/>", {currentTiddler: title});
		return html.replace(/>\s+</g, "><");
	}

	function withTiddler(fieldsOf, fn) {
		h.add(wiki, fieldsOf);
		try {
			return fn();
		} finally {
			wiki.deleteTiddler(fieldsOf.title);
		}
	}

	test("sections parted by lines: the fields of no group with the price, then the groups; values as text", function() {
		withTiddler({title: "Langschwert", tags: "Item", category: "weapon, martial, melee, versatile", damage: "1d8 slashing", range: "5 ft",
			rarity: "<b>rare</b>", weight: "3 lb", price: "15 gp"}, function() {
			var html = block("Langschwert");
			assert.match(html, /<div class="trpg-fields-summary">Kriegswaffe \(Nahkampf, vielseitig\), &lt;b&gt;rare&lt;\/b&gt;<\/div>/, "unread: as written, as text");
			assert.match(html, /<span class="trpg-fields-label">Schaden<\/span> 1W8 Hiebschaden<\/span><\/div><div class="trpg-fields-lines"><span class="trpg-fields-line"><span class="trpg-fields-label">Reichweite<\/span>/);
			assert.match(html, /<div class="trpg-fields-section trpg-fields-inline"><div class="trpg-fields-lines"><span class="trpg-fields-line"><span class="trpg-fields-label">Gewicht<\/span> [^<]+<\/span> · <span class="trpg-fields-line"><span class="trpg-fields-label">Preis<\/span> 15 GM<\/span>/, "a group names the price");
			assert.doesNotMatch(html, /Rüstungsklasse/);
		});
	});

	test("the header line: kind, rarity, attunement; its fields not again", function() {
		withTiddler({title: "Klingenschild", tags: "Item", category: "weapon, martial, armor, medium", rarity: "rare", attunement: "yes", ac: "14", bonus: "+2"}, function() {
			var html = block("Klingenschild");
			assert.match(html, /<div class="trpg-fields-summary">Kriegswaffe und mittelschwere Rüstung, selten \(erfordert Einstimmung\)<\/div>/);
			assert.doesNotMatch(html, /Seltenheit|Einstimmung<\/span>/);
			assert.match(html, /Rüstungsklasse<\/span> 16 \(14 \+ 2\)/);
		});
		withTiddler({title: "Ring", tags: "Item", rarity: "rare", price: "50 gp"}, function() {
			var html = block("Ring");
			assert.doesNotMatch(html, /trpg-fields-summary/, "no kind, no header line");
			assert.ok(html.indexOf("Seltenheit") < html.indexOf("Preis"), "the fields of no group first, the price in the group that names it");
		});
	});

	test("a condition hides a field; nothing without values", function() {
		withTiddler({title: "Trank", tags: "Item", category: "potion", damage: "1d6 fire", ac: "12", healing: "2d4 + 2"}, function() {
			var html = block("Trank");
			assert.doesNotMatch(html, /Schaden|Rüstungsklasse/, "damage only with weapon, AC only with armor");
			assert.match(html, /Heilung<\/span> 7 \(2W4 \+ 2\)/);
		});
		withTiddler({title: "Leer", tags: "Item"}, function() {
			assert.doesNotMatch(block("Leer"), /trpg-fields/);
		});
		withTiddler({title: "Ort", tags: "Location", damage: "1d6"}, function() {
			assert.doesNotMatch(block("Ort"), /trpg-fields/, "no schema");
		});
	});

	test("spell and creature: combined lines, a row, a field only for the editor", function() {
		withTiddler({title: "Feuerball", tags: "Spell", level: "3", range: "150 ft", duration: "1 minute", concentration: "yes", damage: "8d6 fire"}, function() {
			var html = block("Feuerball");
			assert.match(html, /<div class="trpg-fields-summary">Zauber 3\. Grades<\/div>/);
			assert.doesNotMatch(html, /Zaubergrad|Konzentration<\/span>/);
			assert.match(html, /Wirkungsdauer<\/span> Konzentration, bis zu 1 Minute<\/span>/);
			assert.match(html, /Schaden<\/span> 8W6 Feuerschaden/, "damage on a spell: no category, no condition");
			assert.equal(h.checks(wiki, "Feuerball", "fields").length, 0);
		});
		withTiddler({title: "Wolf", tags: "Creature", size: "medium", str: "12", cr: "1/4", wis: "12", skills: "perception", expertise: "perception"}, function() {
			var html = block("Wolf");
			assert.match(html, /<div class="trpg-fields-summary">mittelgroß<\/div>/);
			assert.match(html, /<div class="trpg-fields-section trpg-fields-row"><div class="trpg-fields-cell"><span class="trpg-fields-label">STR<\/span>12 \(\+1\)<\/div>/);
			assert.match(html, /Herausforderungsgrad<\/span> 1\/4 \(50 EP\)<\/span>/);
			assert.doesNotMatch(html, /<span class="trpg-fields-label">EP/, "xp in the line of the challenge");
			assert.doesNotMatch(html, /Expertise/, "only in the editor");
			assert.match(html, /Fertigkeiten<\/span> Wahrnehmung \+5/);
			assert.match(html, /passive Wahrnehmung 15/);
		});
	});

	test("after the image, before the body; the price on any tiddler", function() {
		withTiddler({title: "Ring", tags: "Item", rarity: "rare", price: "50 gp", text: "Ein Ring Zx9."}, function() {
			var html = h.view(wiki, "Ring").replace(/>\s+</g, "><");
			assert.ok(html.indexOf("trpg-fields") < html.indexOf("Zx9"), "the block before the body");
			assert.ok(html.indexOf("Zx9") < html.indexOf("relations/graph"), "the body before the relations");
		});
		withTiddler({title: "Hafen", tags: "Location", price: "5 sp"}, function() {
			assert.match(block("Hafen"), /<span class="trpg-fields-label">Preis<\/span> 5 SM/);
		});
	});

	test("the colour of the type on the block", function() {
		withTiddler({title: "Ring", tags: "Item", rarity: "rare"}, function() {
			var colour = wiki.getTiddler("Item") && wiki.getTiddler("Item").fields.color;
			assert.ok(colour);
			assert.ok(block("Ring").indexOf("--trpg-type:" + colour) !== -1);
		});
	});

	test("not for a tiddler the view does not see", function() {
		withTiddler({title: "Geheim", tags: "Item Secret", rarity: "rare"}, function() {
			h.inView(wiki, "public", function() {
				assert.doesNotMatch(block("Geheim"), /trpg-fields/);
			});
			assert.match(block("Geheim"), /trpg-fields/);
		});
	});
});

test.describe("fields/value, fields/when, fields/tag", function() {
	function keys(fieldsOf) {
		h.add(wiki, fieldsOf);
		try {
			return h.checks(wiki, fieldsOf.title, "fields").map(function(m) { return m.level + " " + m.key + " " + m.text; });
		} finally {
			wiki.deleteTiddler(fieldsOf.title);
		}
	}

	test("a value its format does not read, naming the field", function() {
		var out = keys({title: "Krug", tags: "Item", rarity: "legendary", bonus: "zwei", weight: "schwer", category: "weapon, armor, light"});
		assert.ok(out.indexOf("error Rules/Check/Label Feld Seltenheit prüfen: „legendary“ ist hier kein bekannter Begriff") !== -1, out.join("\n"));
		assert.ok(out.some(function(m) { return /^error Rules\/Check\/Number Feld Bonus prüfen/.test(m); }));
		assert.ok(out.indexOf("error Check/Fields/Value Feld Gewicht prüfen: „schwer“ ist nicht lesbar") !== -1, out.join("\n"));
		assert.ok(out.some(function(m) { return /^hint Rules\/Check\/TraitTwice Feld Art prüfen/.test(m); }));
	});

	test("a value whose condition does not hold; derived values are no problem", function() {
		var out = keys({title: "Krug", tags: "Item Consumable", category: "potion", damage: "1d6 fire"});
		assert.deepEqual(out, ["hint Check/Fields/When Feld Schaden prüfen: es gilt nur bei Art: Waffe"]);
		assert.deepEqual(keys({title: "Wolf", tags: "Creature", cr: "5", saves: "dex"}), []);
		assert.deepEqual(keys({title: "Ort", tags: "Location", rarity: "legendary"}), [], "no schema, no check");
	});

	test("the condition of a group counts too", function() {
		withSchema("Fields of the campaign", {
			definitions: {charm: {format: "text"}},
			types: ["Item"],
			fields: ["charm"],
			groups: [{id: "magic", fields: ["charm"], when: {category: ["focus"]}}]
		}, function() {
			assert.deepEqual(keys({title: "Krug", tags: "Item Equipment", category: "weapon", charm: "glows"}),
				["hint Check/Fields/When Feld charm prüfen: es gilt nur bei Art: Fokus"]);
			assert.deepEqual(keys({title: "Krug", tags: "Item Equipment", category: "focus", charm: "glows"}), []);
		});
	});

	test("a main entry names the category tag the tiddler lacks: a hint with the fix", function() {
		var fixes = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/fixes.js");
		assert.deepEqual(keys({title: "Krug", tags: "Item", category: "potion"}), ["hint Check/Fields/Tag Feld Art prüfen: Trank gehört zur Kategorie Verbrauchsgut – Tag setzen"]);
		assert.deepEqual(keys({title: "Krug", tags: "Item Verbrauchsgut", category: "potion"}), [], "the tag under its translated name");
		assert.deepEqual(keys({title: "Krug", tags: "Item", category: "weapon, armor"}).length, 1, "one hint per tag");
		h.add(wiki, {title: "Draft of 'Krug'", "draft.of": "Krug", tags: "Item", category: "potion"});
		try {
			var message = checks.forDraft(wiki, "Draft of 'Krug'").filter(function(m) { return m.id === "fields/tag"; })[0];
			assert.ok(fixes.apply(wiki, "Draft of 'Krug'", message.fix));
			assert.deepEqual(Array.from(wiki.getTiddler("Draft of 'Krug'").fields.tags), ["Item", "Consumable"]);
			assert.equal(fixes.apply(wiki, "Draft of 'Krug'", message.fix), false, "done once");
		} finally {
			wiki.deleteTiddler("Draft of 'Krug'");
		}
	});
});

test.describe("the lock of values (secret-fields)", function() {
	function block(title) {
		return h.render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/tiddlyrpg-core/viewtemplates/fields\" mode=\"block\"/>", {currentTiddler: title}).replace(/>\s+</g, "><");
	}

	function withTiddler(fieldsOf, fn) {
		h.add(wiki, fieldsOf);
		try {
			return fn();
		} finally {
			wiki.deleteTiddler(fieldsOf.title);
		}
	}

	test("a locked field: gone for others, marked for the DM and the players tagged", function() {
		withTiddler({title: "Kelch", tags: "Item Consumable Frigg", category: "potion", rarity: "rare", healing: "2d4", "secret-fields": "rarity"}, function() {
			h.inView(wiki, "public", function() {
				var html = block("Kelch");
				assert.match(html, /<div class="trpg-fields-summary">Trank<\/div>/, "the header line without the locked part");
				assert.doesNotMatch(html, /selten|trpg-fields-locked|Gesperrt/, "no value, no mark");
				assert.match(html, /Heilung<\/span> 5 \(2W4\)/);
			});
			h.inView(wiki, "player:Anna", function() {
				assert.match(block("Kelch"), /Trank, selten/);
			});
			h.inView(wiki, "player:Bert", function() {
				assert.doesNotMatch(block("Kelch"), /selten/);
			});
			var dm = block("Kelch");
			assert.match(dm, /<div class="trpg-fields-lockmark">Gesperrt/);
			assert.match(dm, /Trank, selten/);
		});
	});

	test("what derives from a locked value is locked with it", function() {
		withTiddler({title: "Oger", tags: "Creature", str: "18", wis: "12", saves: "str", skills: "perception", cr: "5", "secret-fields": "str cr"}, function() {
			h.inView(wiki, "public", function() {
				var html = block("Oger");
				assert.doesNotMatch(html, /18|\+4|\+7|\+3|1800|Herausforderungsgrad|Übungsbonus/, "no score, no modifier, no save, no proficiency, no XP");
				assert.match(html, /Rettungswürfe<\/span> STR<\/span>/, "the save without its value");
				assert.match(html, /Fertigkeiten<\/span> Wahrnehmung<\/span>/, "the skill without its value: it needs the proficiency");
				assert.doesNotMatch(html, /passive Wahrnehmung/);
				assert.match(html, /WEI<\/span>12 \(\+1\)/, "what is not locked stays");
			});
			var dm = block("Oger");
			assert.match(dm, /<div class="trpg-fields-cell trpg-fields-locked"><span class="trpg-fields-label">STR<\/span>18 \(\+4\)/);
			assert.match(dm, /<span class="trpg-fields-line trpg-fields-locked"><span class="trpg-fields-label">Rettungswürfe<\/span> STR \+7/, "derived from a locked value: marked too");
			assert.match(dm, /<span class="trpg-fields-line trpg-fields-locked"><span class="trpg-fields-label">Sinne<\/span> passive Wahrnehmung 14/, "through the proficiency of the skill");
			assert.match(dm, /<div class="trpg-fields-cell"><span class="trpg-fields-label">WEI/, "not derived from one: not marked");
		});
	});

	test("all: the whole block and the price", function() {
		withTiddler({title: "Kelch", tags: "Item Consumable", category: "potion", price: "50 gp", "secret-fields": "all"}, function() {
			h.inView(wiki, "public", function() {
				assert.doesNotMatch(block("Kelch"), /trpg-fields/);
			});
			assert.match(block("Kelch"), /<div class="trpg-fields trpg-fields-locked"/);
		});
		withTiddler({title: "Kelch", tags: "Item", price: "50 gp", "secret-fields": ""}, function() {
			h.inView(wiki, "public", function() {
				assert.doesNotMatch(block("Kelch"), /trpg-fields/, "empty: all");
			});
		});
	});

	test("the messages on a locked value only for those who see it", function() {
		withTiddler({title: "Kelch", tags: "Item Consumable", category: "potion", rarity: "legendary", "secret-fields": "rarity"}, function() {
			h.inView(wiki, "public", function() {
				assert.deepEqual(h.checkKeys(wiki, "Kelch", "fields"), []);
			});
			assert.deepEqual(h.checkKeys(wiki, "Kelch", "fields"), ["Rules/Check/Label"]);
		});
	});

	test("the editor: a pill for all and per field written; the last one out takes the field out", function() {
		h.add(wiki, {title: "Draft of 'Kelch'", "draft.of": "Kelch", tags: "Item", rarity: "rare", weight: "1 lb"});
		try {
			var form = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/form.js"),
				f = function(text) { return Array.from(h.filter(wiki, text)); };
			assert.ok(form.offered(wiki, "Draft of 'Kelch'").indexOf("secret-fields") !== -1);
			assert.deepEqual(f("[[Draft of 'Kelch']trpglockfields[]]"), ["rarity", "weight"]);
			assert.deepEqual(f("[[Draft of 'Kelch']trpglocktoggle[rarity]]"), ["rarity"]);
			h.add(wiki, {title: "Draft of 'Kelch'", "draft.of": "Kelch", tags: "Item", rarity: "rare", "secret-fields": "rarity"});
			assert.deepEqual(f("[[Draft of 'Kelch']trpglockon[rarity]]"), ["yes"]);
			assert.deepEqual(f("[[Draft of 'Kelch']trpglocktoggle[rarity]]"), [""], "nothing stays: the field goes");
			assert.deepEqual(f("[[Draft of 'Kelch']trpglocktoggle[all]]"), ["all"]);
			assert.match(h.render(wiki, "text/plain", "{{||$:/plugins/tiddlyrpg-core/editor/form}}", {currentTiddler: "Draft of 'Kelch'"}), /Gesperrte Werte.*alle.*Seltenheit/);
		} finally {
			wiki.deleteTiddler("Draft of 'Kelch'");
		}
	});
});
