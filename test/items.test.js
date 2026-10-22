/*
 * Items (checks/items.js): base type and categories and their messages, the price with the
 * currency of the fixture setting (without currency: currency.test.js), the hub lists of
 * Item and of a category, a category of the campaign, the file of a book (field data) and
 * colour and image folder through the base type. Items at a location: location.test.js.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var wiki;

var ITEMS = [
	{title: "Sword", tags: "Artifact Equipment", owner: "Grum", text: "A unique sword."},
	{title: "Chronicle", tags: "Artifact Book", data: "Chronicle.pdf", text: "The only copy."},
	{title: "Newspaper", tags: "Item Book", data: "Bote 1350-11.pdf", text: "Many copies."},
	{title: "Potion", tags: "Item Consumable", text: "Heals."},
	{title: "Snail", tags: "Item", text: "Two of them."},
	{title: "Moss", tags: "Material", text: "Glows."}
];

test.before(function() {
	return h.boot().then(function($tw) {
		wiki = $tw.wiki;
		h.setLanguage(wiki, "de-DE");
		ITEMS.forEach(function(fields) { h.add(wiki, fields); });
	});
});

function f(text) {
	return Array.from(h.filter(wiki, text));
}

// The language keys of the messages of the theme items (checks/items.js) of a tiddler, of several
function keys(title) {
	return h.checkKeys(wiki, title, "items");
}

function keysOf(titles) {
	return [].concat.apply([], titles.map(keys));
}

function withTiddlers(list, fn) {
	list.forEach(function(fields) { h.add(wiki, fields); });
	try {
		fn();
	} finally {
		list.forEach(function(fields) { wiki.deleteTiddler(fields.title); });
	}
}

// True if the strings occur in the text in this order (each searched after the one before)
function inOrder(text, strings) {
	var from = 0;
	return strings.every(function(s) {
		var p = text.indexOf(s, from);
		from = p + s.length;
		return p !== -1;
	});
}

test.describe("base type", function() {
	test("no hint: one base type with or without categories", function() {
		assert.deepEqual(keysOf(["Sword", "Chronicle", "Newspaper", "Potion", "Snail", "Moss"]), []);
	});

	test("category without base type", function() {
		withTiddlers([{title: "Loose Book", tags: "Book"}], function() {
			assert.deepEqual(keys("Loose Book"), ["Item/Check/NoBase"]);
		});
	});

	test("two base types", function() {
		withTiddlers([{title: "Undecided", tags: "Artifact Item"}], function() {
			assert.deepEqual(keys("Undecided"), ["Item/Check/TwoBases"]);
		});
	});

	test("the hubs themselves: no hint", function() {
		assert.deepEqual(keysOf(["Book", "Consumable", "Equipment", "Item"]), []);
	});

	test("a category of the campaign counts too", function() {
		withTiddlers([{title: "Rune", tags: "$:/tags/tiddlyrpg/ItemKind"}, {title: "Loose Rune", tags: "Rune"}], function() {
			assert.deepEqual(keys("Loose Rune"), ["Item/Check/NoBase"]);
		});
	});

	test("hint below the title, not in the published copy", function() {
		withTiddlers([{title: "Loose Book", tags: "Book"}], function() {
			assert.ok(h.view(wiki, "Loose Book").indexOf("Gegenstand prüfen: Eine Kategorie wie Buch braucht dazu einen Grundtyp") !== -1);
			h.add(wiki, {title: "$:/status/IsReadOnly", text: "yes"});
			try {
				assert.ok(h.view(wiki, "Loose Book").indexOf("Gegenstand prüfen") === -1);
			} finally {
				wiki.deleteTiddler("$:/status/IsReadOnly");
			}
		});
	});
});

test.describe("price", function() {
	test("shown as written with the labels of the display language", function() {
		withTiddlers([{title: "Trank", tags: "Item Consumable", price: "50 gp"}], function() {
			assert.match(h.view(wiki, "Trank"), /<span class="trpg-fields-label">Preis<\/span> 50 GM<\/span>/);
			assert.deepEqual(keys("Trank"), []);
		});
	});

	test("with a currency a plain number gets a hint", function() {
		withTiddlers([{title: "Trank", tags: "Item Consumable", price: "50"}], function() {
			assert.deepEqual(keys("Trank"), ["Item/Check/PriceNoCurrency"]);
			assert.match(h.view(wiki, "Trank"), /<span class="trpg-fields-label">Preis<\/span> 50<\/span>/);
			assert.match(h.view(wiki, "Trank"), /Preis prüfen: Er braucht eine Münze des Geldsystems/);
		});
	});

	test("a coin the currency does not have, or a text: a hint", function() {
		withTiddlers([{title: "Trank", tags: "Item", price: "50 xp"}, {title: "Trank2", tags: "Item", price: "teuer"}], function() {
			assert.deepEqual(keys("Trank"), ["Item/Check/PriceUnit"]);
			assert.deepEqual(keys("Trank2"), ["Item/Check/PriceCurrency"]);
		});
	});
});

test.describe("hubs", function() {
	test("Item: the base types in order, items without category first, then one heading per category", function() {
		var hub = h.body(wiki, "Item");
		assert.ok(inOrder(hub, ["Artefakte", "Ausrüstung", "Sword", "Bücher", "Chronicle",
			"Gegenstände", "Snail", "Bücher", "Newspaper", "Verbrauchsgüter", "Potion", "Materialien", "Moss"]), hub);
		assert.ok(hub.indexOf("Artefakte") < hub.indexOf("Sword") && hub.indexOf("Sword") < hub.indexOf("Gegenstände"), hub);
	});

	test("a category hub lists only its own items, per base type", function() {
		var hub = h.body(wiki, "Book");
		assert.ok(inOrder(hub, ["Artefakte", "Chronicle", "Gegenstände", "Newspaper"]), hub);
		assert.ok(["Sword", "Potion", "Snail", "Moss", "Materialien", "Bücher"].every(function(s) { return hub.indexOf(s) === -1; }), hub);
	});

	test("a category of the campaign: heading with its display name", function() {
		withTiddlers([{title: "Rune", tags: "$:/tags/tiddlyrpg/ItemKind"}, {title: "Hagalaz", tags: "Item Rune"}], function() {
			assert.ok(inOrder(h.body(wiki, "Item"), ["Gegenstände", "Rune", "Hagalaz", "Materialien"]));
		});
	});

	test("category hubs translated", function() {
		assert.match(h.view(wiki, "Consumable"), /<h2 class="tc-title">\s*Verbrauchsgut\s*<\/h2>/);
		assert.match(h.view(wiki, "Equipment"), /<h2 class="tc-title">\s*Ausrüstung\s*<\/h2>/);
	});

	["Item", "Book", "Consumable", "Equipment"].forEach(function(title) {
		test("no pragma text in " + title, function() {
			assert.doesNotMatch(h.body(wiki, title), /(^|\n)\s*(define|procedure|function|whitespace|import) /);
		});
	});
});

test.describe("file of a book", function() {
	test("embedded below the body from data/book/", function() {
		assert.ok(h.view(wiki, "Newspaper").indexOf("<embed height=\"850\" src=\"data/book/Bote%201350-11.pdf\" width=\"100%\">") !== -1);
	});

	test("only for books", function() {
		withTiddlers([{title: "Map Scroll", tags: "Item", data: "Scroll.pdf"}], function() {
			assert.ok(h.view(wiki, "Map Scroll").indexOf("<embed") === -1);
		});
	});

	test("not for tiddlers locked for the view", function() {
		withTiddlers([{title: "Diary", tags: "Artifact Book Frigg Secret", data: "Diary.pdf"}], function() {
			assert.ok(h.inView(wiki, "public", function() { return h.view(wiki, "Diary"); }).indexOf("<embed") === -1);
			assert.ok(h.inView(wiki, "player:Anna", function() { return h.view(wiki, "Diary"); }).indexOf("<embed") !== -1);
		});
	});

	test("before the relations", function() {
		var html = h.view(wiki, "Newspaper");
		assert.ok(html.indexOf("<embed") !== -1 && html.indexOf("<embed") < html.indexOf("tc-tab-set"), html);
	});
});

test.describe("base type", function() {
	test("colour of the item types", function() {
		["Sword", "Newspaper", "Potion", "Moss"].forEach(function(title) {
			assert.equal(wiki.filterTiddlers("[[" + title + "]] :cascade[all[shadows+tiddlers]tag[$:/tags/TiddlerColourFilter]!is[draft]get[text]]").join(), "#ff80ff");
		});
	});

	test("image folder item", function() {
		withTiddlers([{title: "Pictured", tags: "Item Book", image: "Pictured.png"}], function() {
			assert.ok(h.render(wiki, "text/html", "<<image>>", {currentTiddler: "Pictured"}).indexOf("src=\"images/item/Pictured.png\"") !== -1);
		});
	});
});
