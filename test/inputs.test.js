/*
 * Inputs keep their focus: typing into an $edit-text of the plugins must not render it anew (in
 * the browser the field would lose the focus after every key). One case per input field - the
 * converters of Calendar and Currency, renaming a rumour - and a check that every $edit-text in
 * the wikitext of the plugins of this repo has its case.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	h = require("./helpers");

var wiki;

// source: the tiddler holding the input; variables: set around it; type: the fields typed into
// the target tiddler (title); shows: the output that follows the input.
var CASES = [
	{source: "Calendar", type: {title: "$:/temp/tiddlyrpg/calendar", calc_date: "1351-07-30", calc_day: "1"}, shows: /Mittsommer \(07\/08\)/},
	{source: "Calendar", type: {title: "$:/temp/tiddlyrpg/calendar", calc_from: "1351-01-01", calc_to: "1351-01-11"}, shows: /Tage:10(?!\d)/},
	{source: "Currency", type: {title: "$:/temp/tiddlyrpg/currency", amount: "3 gp"}, shows: /30/},
	{source: "$:/plugins/tiddlyrpg-core/templates/quest-body", variables: {currentTiddler: "Spur"},
		type: {title: "$:/state/tiddlyrpg-core/quest-rename/Spur", text: "Turm"}, shows: /Umbenennen/},
	// The dropdowns of the editor toolbar (editor/toolbar) and the fields of the form (editor/fields)
	{source: "$:/plugins/tiddlyrpg-core/editor/toolbar/date-dropdown", variables: {targetTiddler: "Spurensuche"},
		type: {title: "$:/temp/tiddlyrpg-core/editor/input/Spurensuche", date: "1351-07-30", label: "Rast"}, shows: /Einsetzen/},
	{source: "$:/plugins/tiddlyrpg-core/editor/toolbar/spot-dropdown", variables: {targetTiddler: "Baile"},
		type: {title: "$:/temp/tiddlyrpg-core/editor/input/Baile", name: "Markt"}, shows: /Einsetzen/},
	{source: "$:/plugins/tiddlyrpg-core/editor/toolbar/term-dropdown", variables: {targetTiddler: "Spurensuche"},
		type: {title: "$:/temp/tiddlyrpg-core/editor/input/Spurensuche", term: "str", unit: "60 ft"}, shows: /60 ft/},
	{source: "$:/plugins/tiddlyrpg-core/editor/toolbar/sublocation-dropdown", variables: {targetTiddler: "Baile"},
		type: {title: "$:/temp/tiddlyrpg-core/editor/input/Baile", name: "Mühle"}, shows: /Anlegen/},
	{source: "$:/plugins/tiddlyrpg-core/editor/fields/date", variables: {currentTiddler: "Draft of 'Neu'", currentField: "date"},
		type: {title: "Draft of 'Neu'", date: "1351-07-30"}, shows: /1:/},
	{source: "$:/plugins/tiddlyrpg-core/editor/fields/images", variables: {currentTiddler: "Draft of 'Neu'", currentField: "map"},
		type: {title: "Draft of 'Neu'", map: "Neu.png"}, shows: /^$/},
	{source: "$:/plugins/tiddlyrpg-core/editor/fields/price", variables: {currentTiddler: "Draft of 'Neu'", currentField: "price"},
		type: {title: "Draft of 'Neu'", price: "5 gp"}, shows: /5/},
	{source: "$:/plugins/tiddlyrpg-core/editor/fields/rules", variables: {currentTiddler: "Draft of 'Neu'", currentField: "weight"},
		type: {title: "Draft of 'Neu'", weight: "3 lb"}, shows: /Ausgabe: 1,5 kg/},
	{source: "$:/plugins/tiddlyrpg-core/ui/new-event", variables: {"trpg-input": "$:/temp/tiddlyrpg-core/new-event"},
		type: {title: "$:/temp/tiddlyrpg-core/new-event", text: "1351-07-30"}, shows: /Anlegen/}
];

var EVENT = {title: "Spurensuche", tags: "Event", date: "1351-01-01", text: "<<date>>\n\n<<quest \"Spur\">>Eine Spur.\n"};

test.before(function() {
	return h.boot().then(function($tw) {
		wiki = $tw.wiki;
		h.setLanguage(wiki, "de-DE");
		h.add(wiki, EVENT);
		h.add(wiki, {title: "Turm", tags: "Quest", text: "Den Turm finden."});
	});
});

CASES.forEach(function(c) {
	var fields = Object.keys(c.type).filter(function(name) { return name !== "title"; });
	test(c.source + ": typing into " + fields.join(", ") + " keeps the inputs", function() {
		var result = h.typeInto(wiki, c.source, c.type, c.variables);
		assert.ok(result.kept, "the same input fields after a change");
		assert.match(result.text, c.shows, "the output follows");
	});
});

test("every $edit-text of the plugins has its case", function() {
	var found = {},
		covered = {};
	["$:/plugins/tiddlyrpg-core", "$:/plugins/staticfiles"].forEach(function(plugin) {
		wiki.filterTiddlers("[[" + plugin + "]plugintiddlers[]]").forEach(function(title) {
			var type = wiki.getTiddler(title).fields.type || "",
				text = wiki.getTiddlerText(title, "").replace(/<!--[\s\S]*?-->/g, ""),
				count = (text.match(/<\$edit-text\b/g) || []).length;
			if(count && (type === "" || type === "text/vnd.tiddlywiki")) {
				found[title] = count;
			}
		});
	});
	CASES.forEach(function(c) {
		covered[c.source] = (covered[c.source] || 0) + Object.keys(c.type).length - 1;
	});
	assert.ok(Object.keys(found).length > 0, "the scan finds the inputs");
	assert.deepEqual(covered, found, "inputs per tiddler: cases above against $edit-text in the plugins");
});
