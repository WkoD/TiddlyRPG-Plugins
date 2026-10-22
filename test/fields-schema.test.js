/*
 * The fields of the rules (modules/fields.js) against fixture-ruleset-5e-mini: definitions and
 * schemas per type, merged with those of the wiki; labels; what a field derives (modifier,
 * average, total, lookup, sum over the entries of a list, computed entries); the header line;
 * "when"; copyFrom() with the lock; the rule fields/schema.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var $tw, wiki, fields, checks;

var TAG = "$:/tags/tiddlyrpg/RulesFields";

test.before(function() {
	return h.boot().then(function(tw) {
		$tw = tw;
		wiki = $tw.wiki;
		fields = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/fields.js");
		checks = $tw.modules.execute("$:/plugins/tiddlyrpg-core/modules/checks.js");
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
		assert.equal(schema.groups.map(function(g) { return g.id; }).join(), "weapon,armor");
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
			groups: [{id: "weapon", fields: ["charm"]}]
		}, function() {
			var schema = fields.forTypes(wiki, ["Item"]);
			assert.equal(schema.fields[schema.fields.length - 1], "charm");
			assert.equal(schema.fields.filter(function(f) { return f === "rarity"; }).length, 1);
			assert.equal(schema.groups[0].fields.join(), "damage,range,charm");
			assert.deepEqual(schemaMessages(), []);
		});
		assert.equal(fields.forTypes(wiki, ["Item"]).groups[0].fields.join(), "damage,range", "the ruleset's group unchanged");
	});

	test("fields/schema: reserved names, defined twice, without definition", function() {
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
		assert.equal(fields.summary(wiki, {level: "3"}, schema).text, "Zauber 3. Grades");
		assert.equal(fields.summary(wiki, {level: "1"}, schema).fields.join(), "level,ritual");
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

	test("the list, a group as a row, lists as pills, values as text", function() {
		withTiddler({title: "Langschwert", tags: "Item", category: "weapon, martial, melee, versatile", damage: "1d8 slashing", range: "5 ft", rarity: "<b>rare</b>"}, function() {
			var html = block("Langschwert");
			assert.match(html, /<dt>Art<\/dt><dd><span class="trpg-fields-pills"><span class="trpg-fields-pill">Kriegswaffe<\/span><span class="trpg-fields-pill">Nahkampf<\/span><span class="trpg-fields-pill">vielseitig<\/span><\/span><\/dd>/);
			assert.match(html, /<dt>Seltenheit<\/dt><dd>&lt;b&gt;rare&lt;\/b&gt;<\/dd>/, "unread, as written, as text");
			assert.match(html, /<div class="trpg-fields-group-label">Waffe<\/div><table class="trpg-fields-row"><tr><th>Schaden<\/th><th>Reichweite<\/th><\/tr><tr><td>1W8 Hiebschaden<\/td><td>[^<]+<\/td><\/tr>/);
			assert.doesNotMatch(html, /Rüstung/, "the group armor does not fit");
		});
	});

	test("a group only when its condition holds; nothing without values", function() {
		withTiddler({title: "Trank", tags: "Item", category: "potion", damage: "1d6 fire", healing: "2d4 + 2"}, function() {
			var html = block("Trank");
			assert.doesNotMatch(html, /Schaden/, "damage only with weapon");
			assert.match(html, /<dt>Heilung<\/dt><dd>7 \(2W4 \+ 2\)<\/dd>/);
		});
		withTiddler({title: "Leer", tags: "Item"}, function() {
			assert.doesNotMatch(block("Leer"), /trpg-fields/);
		});
		withTiddler({title: "Ort", tags: "Location", damage: "1d6"}, function() {
			assert.doesNotMatch(block("Ort"), /trpg-fields/, "no schema");
		});
	});

	test("the header line, its fields not again; derived values", function() {
		// Type tags for the test: hubs of the same name
		h.add(wiki, {title: "Spell", tags: "Index"});
		h.add(wiki, {title: "Creature", tags: "Index"});
		try {
			withTiddler({title: "Feuerball", tags: "Spell", level: "3", range: "150 ft", damage: "8d6 fire"}, function() {
				var html = block("Feuerball");
				assert.match(html, /<div class="trpg-fields-summary">Zauber 3\. Grades<\/div>/);
				assert.doesNotMatch(html, /Zaubergrad/);
				assert.match(html, /<dt>Schaden<\/dt>/, "damage on a spell: no category, no condition");
				assert.equal(h.checks(wiki, "Feuerball", "fields").length, 0);
			});
			withTiddler({title: "Wolf", tags: "Creature", str: "12", cr: "1/4", wis: "12"}, function() {
				var html = block("Wolf");
				assert.match(html, /<th>STR<\/th>.*<td>12 \(\+1\)<\/td>/);
				assert.match(html, /<dt>EP<\/dt><dd>50<\/dd>/);
				assert.match(html, /passive Wahrnehmung 11/);
			});
		} finally {
			wiki.deleteTiddler("Spell");
			wiki.deleteTiddler("Creature");
		}
	});

	test("before the body, the price as its first line - on any tiddler", function() {
		withTiddler({title: "Ring", tags: "Item", rarity: "rare", price: "50 gp", text: "Ein Ring Zx9."}, function() {
			var html = h.view(wiki, "Ring").replace(/>\s+</g, "><");
			assert.match(html, /<dl class="trpg-fields-list"><dt>Preis<\/dt><dd>50 GM<\/dd><dt>Seltenheit<\/dt>/);
			assert.ok(html.indexOf("trpg-fields") < html.indexOf("Zx9"), "the block before the body");
		});
		withTiddler({title: "Hafen", tags: "Location", price: "5 sp"}, function() {
			assert.match(block("Hafen"), /<dt>Preis<\/dt><dd>5 SM<\/dd>/);
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

test.describe("fields/value, fields/when", function() {
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
		var out = keys({title: "Krug", tags: "Item", category: "potion", damage: "1d6 fire"});
		assert.deepEqual(out, ["hint Check/Fields/When Feld Schaden prüfen: es gilt nur bei Art: Waffe"]);
		assert.deepEqual(keys({title: "Wolf", tags: "Creature", cr: "5", saves: "dex"}), []);
		assert.deepEqual(keys({title: "Ort", tags: "Location", rarity: "legendary"}), [], "no schema, no check");
	});
});
