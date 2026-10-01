#!/usr/bin/env node
/*
 * Functional test for dndwiki-core + dndwiki-forgottenrealms (npm test).
 *
 * Boots TiddlyWiki in-process with the smoke edition (all plugins, de-DE language pack),
 * adds a small set of fixture tiddlers and checks:
 *   - the calendar engine against the former hard-wired Harptos arithmetic (reference test)
 *     and a leap rule with start != 0 against a year-by-year count, negative years included
 *   - rendered output in de-DE and en-GB, with and without an active calendar
 *   - that date output refreshes when $:/language or the calendar data changes
 *   - the tag hook (translated tag names are stored under the internal name) and the search
 *
 * Exits with code 1 on the first failed group; prints every failed check.
 */
process.noDeprecation = true;

var path = require("path"),
	fs = require("fs");

var root = path.join(__dirname, ".."),
	nodeModules = path.join(root, "node_modules");

var pluginPaths = [path.join(root, "plugins")];
["tw5-graph", "tw5-vis-network", "tw5-relink"].forEach(function(pkg) {
	pluginPaths.push(path.join(nodeModules, pkg, "plugins"));
});
process.env.TIDDLYWIKI_PLUGIN_PATH = pluginPaths.filter(function(p) { return fs.existsSync(p); }).join(path.delimiter);

var $tw = require("tiddlywiki").TiddlyWiki();
$tw.boot.argv = [path.join(root, "editions", "smoke")];

var failures = 0,
	checks = 0;

function check(name, condition, detail) {
	checks++;
	if(!condition) {
		failures++;
		console.log("FAIL " + name + (detail !== undefined ? "\n     " + JSON.stringify(detail) : ""));
	}
}

function fixtures(wiki) {
	var T = "20261001000000000";
	[
		{title: "Insel Avalon", tags: "Location", text: "Island of the pirates."},
		{title: "Insel Avalon/Map", tags: "Map", text: "!!!! Kantine\n\nAn orc cooks."},
		{title: "Insel Avalon/BattleMap", tags: "BattleMap", image: "Insel Avalon.jpg", text: ""},
		{title: "Baile", tags: "Location", text: "Town."},
		{title: "Baile/Map", tags: "Map", image: "Baile.png", text: ""},
		{title: "Nowhere", tags: "Location", text: "Empty."},
		{title: "Grum", tags: "Person", location: "Insel Avalon", date: ".1350-07", text: "An orc."},
		{title: "Frigg", tags: "Player", player: "Anna", text: "A player character."},
		{title: "Secret", tags: "Location Frigg", text: "Only for Frigg."},
		{title: "Der dunkle Turm", tags: "Adventure Event", date: "1351-07-01.1351-07-11", text: "<b>Jahr:</b> <$macrocall $name=\"datelong\" date=\"1351-07-11\"/>\n\nAt [[Insel Avalon]]."},
		{title: "Hafenfest", tags: "Event", date: "1351-07-05", text: "At [[Insel Avalon]]."},
		{title: "Sage", tags: "Event", text: "Undated."},
		{title: "Friggs Traum", tags: "Event Frigg", date: "1351-07-03", text: "At [[Insel Avalon]]."},
		{title: "PlayerLevel", tags: "Information", text: "100000 EXP"},
		// The graph widget needs a browser; the relation tests use the list tab
		{title: "$:/state/dndwiki-core/relations-tab", text: "$:/plugins/dndwiki-core/viewtemplates/relations/list"},
		// The history checks read the table; the timeline is checked on its own below
		{title: "$:/state/dndwiki-core/events-tab", text: "$:/plugins/dndwiki-core/viewtemplates/event-list/list"}
	].forEach(function(fields) {
		fields.created = T;
		fields.modified = T;
		wiki.addTiddler(new $tw.Tiddler(fields));
	});
}

function setLanguage(wiki, code) {
	wiki.addTiddler(new $tw.Tiddler({title: "$:/language", text: "$:/languages/" + code}));
}

// Renders wikitext with the global definitions imported, as the page template does in the browser
var IMPORT = "\\import [subfilter{$:/core/config/GlobalImportFilter}]\n";

function render(wiki, type, text, variables) {
	return wiki.renderText(type, "text/vnd.tiddlywiki", IMPORT + text, {variables: variables || {}});
}

// A tiddler through the story view template, as the browser shows it
function view(wiki, title) {
	return render(wiki, "text/html", "<$transclude $tiddler=\"$:/core/ui/ViewTemplate\" mode=\"block\"/>", {currentTiddler: title, storyTiddler: title});
}

// The body of a tiddler as text
function body(wiki, title) {
	return render(wiki, "text/plain", "<$transclude $tiddler=\"" + title + "\" mode=\"block\"/>", {currentTiddler: title});
}

function filter(wiki, text, variables) {
	return wiki.filterTiddlers(text, $tw.rootWidget.makeFakeWidgetWithVariables(variables || {}));
}

// Former hard-wired Harptos arithmetic (dndwiki-core 1.4.1, macros/library.js) as reference
var reference = (function() {
	function daysInMonth(year, month) {
		var months = [31, 30, 30, 31, 30, 30, 31, 30, 31, 30, 31, 30],
			days = months[month - 1];
		if((year % 4 == 0) && (month - 1 == 6)) {
			days += 1;
		}
		return days;
	}
	function dayNumber(year, month, day) {
		var number = year * 365 + Math.ceil(year / 4);
		for(var m = 1; m < month; ++m) {
			number += daysInMonth(year, m);
		}
		return number + day;
	}
	return {daysInMonth: daysInMonth, dayNumber: dayNumber};
})();

function testEngine(wiki) {
	var calendar = $tw.modules.execute("$:/plugins/dndwiki-core/modules/calendar.js"),
		cal = calendar.active(wiki);
	check("Harptos is the active calendar", cal && cal.id === "Harptos", cal && cal.id);
	if(!cal) {
		return;
	}
	var mismatches = [];
	for(var year = -41; year <= 41; year++) {
		for(var month = 1; month <= 12; month++) {
			var length = reference.daysInMonth(year, month);
			if(calendar.monthLength(cal, year, month) !== length) {
				mismatches.push(["length", year, month]);
			}
			for(var day = 1; day <= length; day++) {
				var number = calendar.dayNumber(cal, year, month, day),
					back = calendar.dateFromNumber(cal, number);
				if(number !== reference.dayNumber(year, month, day)) {
					mismatches.push(["number", year, month, day]);
				}
				if(back.year !== year || back.month !== month || back.day !== day) {
					mismatches.push(["inverse", year, month, day, back]);
				}
			}
		}
	}
	check("engine matches the former Harptos arithmetic, years -41..41", mismatches.length === 0, mismatches.slice(0, 5));

	// Leap rule with start != 0 against a year-by-year count
	var title = "$:/test/calendar/Odd";
	wiki.addTiddler(new $tw.Tiddler({title: title, type: "application/json", text: JSON.stringify({
		id: "Odd",
		leap: {every: 4, start: 2},
		months: [
			{id: "A", days: 10, festivals: [{id: "Feast"}]},
			{id: "B", days: 12},
			{id: "C", days: 9, festivals: [{id: "Leapday", leap: true}]}
		]
	})}));
	wiki.addTiddler(new $tw.Tiddler({title: "$:/config/dndwiki/calendar", text: title}));
	var odd = calendar.active(wiki),
		oddMismatches = [],
		leapYears = [];
	for(var y = -30; y <= 30; y++) {
		if(calendar.isLeap(odd, y)) {
			leapYears.push(y);
		}
		// days from day 0 of year 0 to day 0 of year y, counted year by year
		var expected = 0;
		if(y > 0) {
			for(var k = 0; k < y; k++) {
				expected += 32 + (calendar.isLeap(odd, k) ? 1 : 0);
			}
		} else {
			for(var k2 = y; k2 < 0; k2++) {
				expected -= 32 + (calendar.isLeap(odd, k2) ? 1 : 0);
			}
		}
		if(calendar.dayNumber(odd, y, 1, 0) !== expected) {
			oddMismatches.push([y, calendar.dayNumber(odd, y, 1, 0), expected]);
		}
		var lastDay = calendar.monthLength(odd, y, 3),
			n = calendar.dayNumber(odd, y, 3, lastDay),
			b = calendar.dateFromNumber(odd, n);
		if(b.year !== y || b.month !== 3 || b.day !== lastDay) {
			oddMismatches.push(["inverse", y, b]);
		}
	}
	check("leap years with start 2 are ..., -2, 2, 6, ...", leapYears.join(",") === "-30,-26,-22,-18,-14,-10,-6,-2,2,6,10,14,18,22,26,30", leapYears);
	check("day numbers with start 2 match a year-by-year count", oddMismatches.length === 0, oddMismatches.slice(0, 5));
	check("leap festival only in leap years", filter(wiki, "[[2-03-10]datecalc[1]]").join() === "3-01-01" &&
		calendar.monthLength(odd, 3, 3) === 9, calendar.monthLength(odd, 3, 3));
	check("difference across a leap year is one day longer",
		filter(wiki, "[[2-01-01]datediff[3-01-01]]").join() === "33" && filter(wiki, "[[3-01-01]datediff[4-01-01]]").join() === "32" &&
		filter(wiki, "[[6-01-01]datediff[7-01-01]]").join() === "33");
	check("table of an own calendar without language keys shows the ids",
		filter(wiki, "[calendar[table]]").join().indexOf("|A|") !== -1 && filter(wiki, "[calendar[title]]").join() === "Odd");
	wiki.deleteTiddler("$:/config/dndwiki/calendar");
	wiki.deleteTiddler(title);
}

function testGerman(wiki) {
	setLanguage(wiki, "de-DE");
	check("datelong: festival in German", filter(wiki, "[[1351-01-31]datelong[]]").join() === "//1351 DR//<br>//Mittwinter (01/02)//",
		filter(wiki, "[[1351-01-31]datelong[]]"));
	check("datelong: day, month, time", filter(wiki, "[[1351-07-01-10:00]datelong[]]").join() === "//1351 DR//<br>//01. Flamerule (07) 10:00 Uhr//",
		filter(wiki, "[[1351-07-01-10:00]datelong[]]"));
	check("datelong: range", filter(wiki, "[[1351-07-01.1351-11-20]datelong[]]").join() === "//1351 DR//<br>//01. Flamerule (07) - 20. Uktar (11)//",
		filter(wiki, "[[1351-07-01.1351-11-20]datelong[]]"));
	check("datelong: year only", filter(wiki, "[[1200.1351-04-14]datelong[true]]").join() === "//1200 - 1351 DR//<br>",
		filter(wiki, "[[1200.1351-04-14]datelong[true]]"));
	check("datecalc across Midsummer", filter(wiki, "[[1351-07-30]datecalc[2]]").join() === "1351-08-01", filter(wiki, "[[1351-07-30]datecalc[2]]"));
	check("datecalc to Shieldmeet", filter(wiki, "[[1352-07-30]datecalc[2]]").join() === "1352-07-32", filter(wiki, "[[1352-07-30]datecalc[2]]"));
	check("datecalc keeps the time", filter(wiki, "[[1351-12-30-10:00]datecalc[1]]").join() === "1352-01-01-10:00", filter(wiki, "[[1351-12-30-10:00]datecalc[1]]"));
	check("datediff", filter(wiki, "[[1351-01-01]datediff[1352-01-01]]").join() === "365" && filter(wiki, "[[1352-01-01]datediff[1353-01-01]]").join() === "366");

	check("dndtitle hub", filter(wiki, "[[Location]dndtitle[]]").join() === "Ort");
	check("dndtitle sub-tiddler", filter(wiki, "[[Insel Avalon/BattleMap]dndtitle[]]").join() === "Insel Avalon/Kampfkarte");
	check("dndtitle without existing parent", filter(wiki, "[[Foo/Map]dndtitle[]]").join() === "Foo/Map");
	check("dndtitle TBC/Adventure", filter(wiki, "[[TBC/Adventure]dndtitle[]]").join() === "TBC/Abenteuer");

	var location = view(wiki, "Location");
	check("hub heading translated", /<h2 class="tc-title">\s*Ort\s*<\/h2>/.test(location), location.substr(0, 600));

	var avalon = view(wiki, "Insel Avalon");
	check("tag pill translated", avalon.indexOf(">Ort</span>") !== -1);
	check("map tabs: Karte and Kampfkarte", avalon.indexOf(">Karte<") !== -1 && avalon.indexOf(">Kampfkarte<") !== -1);
	check("map tab: text of the overview map as block wikitext", /<h4[^>]*>Kantine<\/h4>/.test(avalon), avalon.substr(avalon.indexOf("Kantine") - 200, 300));
	var battlemap = render(wiki, "text/html", "<$transclude $tiddler=\"$:/plugins/dndwiki-core/viewtemplates/location/sub\" mode=\"block\"/>", {currentTiddler: "Insel Avalon", currentTab: "Insel Avalon/BattleMap"});
	check("battle map tab links to the file", battlemap.indexOf('href="images/battlemap/Insel%20Avalon.jpg"') !== -1, battlemap);
	check("history header with era", avalon.indexOf("Zeitpunkt (DR)") !== -1);
	check("history flags", avalon.indexOf("(Start)") !== -1 && avalon.indexOf("(Ende)") !== -1);
	check("tabs: Karte before Kampfkarte", avalon.indexOf(">Karte<") < avalon.indexOf(">Kampfkarte<"));
	check("map block before history", avalon.indexOf("Kantine") < avalon.indexOf(">Zeitstrahl<"));
	var colour = function(title) {
		return wiki.filterTiddlers("[[" + title + "]] :cascade[all[shadows+tiddlers]tag[$:/tags/TiddlerColourFilter]!is[draft]get[text]]").join();
	};
	check("type colour: Event wins over Adventure whatever the tag order", colour("Der dunkle Turm") === "#48a4ff", colour("Der dunkle Turm"));
	check("type colour: other types unchanged", colour("Grum") === "#00a600", colour("Grum"));
	check("events locked for the player are left out of the event list", avalon.indexOf("Friggs Traum") === -1);
	wiki.addTiddler(new $tw.Tiddler({title: "$:/state/dndwiki/player", text: "Frigg"}));
	var avalonFrigg = view(wiki, "Insel Avalon");
	wiki.deleteTiddler("$:/state/dndwiki/player");
	check("... but shown to that player", avalonFrigg.indexOf("Friggs Traum") !== -1);
	var adventure = view(wiki, "Adventure");
	check("Adventure hub: events shown once (no event list of its own)", (adventure.match(/>Zeitstrahl</g) || []).length === 1, (adventure.match(/>Zeitstrahl</g) || []).length);
	var timeline = render(wiki, "text/html", "<$dnd-timeline filter=\"[tag[Event]]\"/>");
	check("timeline: one card per event", (timeline.match(/class="dnd-tl-card/g) || []).length === 4, timeline.substr(0, 600));
	check("timeline: adventure solid bar, other event dashed point", timeline.indexOf("dnd-tl-bar dnd-tl-adventure") !== -1 && timeline.indexOf("dnd-tl-point dnd-tl-other") !== -1);
	var cardTop = function(title) {
		var cards = timeline.split('<div class="dnd-tl-card').slice(1);
		for(var i = 0; i < cards.length; i++) {
			if(cards[i].indexOf(">" + title + "<") !== -1) {
				return parseFloat(/top:\s*([-\d.]+)px/.exec(cards[i])[1]);
			}
		}
		return NaN;
	};
	check("timeline: details for the selected card (points in time)", timeline.indexOf("dnd-tl-details") !== -1 && /class="dnd-tl-point-date"[^>]*>1\. Flamerule 1351</.test(timeline));
	// Seven overlapping spans: more than five lanes merge into one beam
	var many = [];
	for(var n = 1; n <= 7; n++) {
		many.push("[[Beam " + n + "]]");
		wiki.addTiddler(new $tw.Tiddler({title: "Beam " + n, tags: "Event", date: "1351-0" + n + "-01.1351-12-01"}));
	}
	var beams = render(wiki, "text/html", "<$dnd-timeline filter=\"" + many.join(" ") + "\"/>");
	check("timeline: more than five spans merge into a beam", beams.indexOf("dnd-tl-beam") !== -1 && (beams.match(/class="dnd-tl-thread"/g) || []).length === 7);
	check("timeline: at most five lanes wide", (function() {
		var xs = {};
		(beams.match(/class="dnd-tl-stroke" d="M([\d.]+) /g) || []).forEach(function(m) { xs[m] = true; });
		return Object.keys(xs).length <= 5;
	})());
	for(n = 1; n <= 7; n++) {
		wiki.deleteTiddler("Beam " + n);
	}
	check("timeline: newest at the top", cardTop("Hafenfest") < cardTop("Der dunkle Turm"), [cardTop("Hafenfest"), cardTop("Der dunkle Turm")]);
	check("timeline: undated at the very bottom as ????", cardTop("Sage") > cardTop("Der dunkle Turm") && timeline.indexOf(">????<") !== -1, cardTop("Sage"));
	check("timeline: Harptos label", timeline.indexOf("1. Flamerule 1351") !== -1, timeline.match(/dnd-tl-date">[^<]*/g));

	var baile = view(wiki, "Baile");
	check("location with map only: one tab", baile.indexOf(">Karte<") !== -1 && baile.indexOf("Kampfkarte") === -1);
	check("map image from images/map", baile.indexOf('src="images/map/Baile.png"') !== -1);
	check("location without maps: no map block", view(wiki, "Nowhere").indexOf(">Karte<") === -1);

	var grum = view(wiki, "Grum");
	check("relation list heading", grum.indexOf("Ort") !== -1);
	check("dead class", render(wiki, "text/html", "<$transclude $tiddler=\"$:/core/ui/StoryTiddlerTemplate\" mode=\"block\"/>", {currentTiddler: "Grum", storyTiddler: "Grum"}).indexOf("dnd-dead") !== -1);
	check("activity line year", grum.indexOf("???? - 1350 DR") !== -1);

	var event = view(wiki, "Der dunkle Turm");
	check("event template labels", event.indexOf("Jahr:") !== -1 && event.indexOf("Ort:") !== -1);
	check("macrocall of datelong in content", event.indexOf("11. Flamerule (07)") !== -1);

	var index = body(wiki, "Index");
	var order = ["Gegenstände", "Götter", "Informationen", "Organisationen", "Orte", "Personen", "Offene Punkte"].map(function(s) { return index.indexOf(s); });
	check("index: six types in German order plus open items", order.every(function(p, i) { return p !== -1 && (i === 0 || p > order[i - 1]); }), index);
	// Pragmas must not leak as text (a lost backslash turns \define into visible text)
	["Index", "Information", "Player", "Calendar", "Item", "Event", "TBC", "Adventure", "Location", "Map", "BattleMap"].forEach(function(title) {
		var text = body(wiki, title);
		check("no pragma text in " + title, !/(^|\n)\s*(define|procedure|function|whitespace|import) /.test(text), text.substr(0, 200));
	});

	var information = body(wiki, "Information");
	check("information lists Kalender and Spielerstufe", information.indexOf("Kalender") !== -1 && information.indexOf("Spielerstufe") !== -1, information);

	var player = body(wiki, "Player");
	check("player hub: level", player.indexOf("Spielerstufe") !== -1 && player.indexOf("100000 EXP") !== -1, player);

	var calendarHub = body(wiki, "Calendar");
	check("calendar hub: name, epithet, leap festival", calendarHub.indexOf("Kalender von Harptos") !== -1 &&
		calendarHub.indexOf("Tiefwinter") !== -1 && calendarHub.indexOf("Schildtreff (alle 4 Jahre)") !== -1, calendarHub);

	var adventure = body(wiki, "Adventure");
	check("adventure hub: open tasks, no current date", adventure.indexOf("Offene Aufgaben") !== -1 && adventure.indexOf("Aktuelles Datum") === -1);

	var hooked = $tw.hooks.invokeHook("th-saving-tiddler", new $tw.Tiddler({title: "New", tags: ["Ort", "Haus Kemri"]}));
	check("tag hook: Ort -> Location", hooked.fields.tags.join("|") === "Location|Haus Kemri", hooked.fields.tags);

	check("edges.typed override wins over tw5-graph (plugin-priority)",
		(wiki.getTiddlerText("$:/plugins/flibbles/graph/macros/edges.typed") || "").indexOf("dndtranslate") !== -1);
	check("translated edge label filter", filter(wiki, "[[$:/config/flibbles/graph/edges/fields/leader]getindex[label]!is[blank]then[leader]addprefix[Field/]dndtranslate[]]").join() === "Anführer" &&
		filter(wiki, "[[$:/config/flibbles/graph/edges/fields/location]getindex[label]!is[blank]then[location]addprefix[Field/]dndtranslate[]]").join() === "");

	var search = wiki.getTiddler("$:/core/ui/DefaultSearchResultList").fields["first-search-filter"];
	check("search: translated hub name finds the hub", filter(wiki, search, {userInput: "Ort"}).indexOf("Location") !== -1);

	["Location", "Insel Avalon", "Index", "Player", "Calendar", "Grum", "Der dunkle Turm", "TBC", "Item", "Event"].forEach(function(title) {
		var html = view(wiki, title);
		check("no raw <<dnd. in " + title, html.indexOf("&lt;&lt;dnd.") === -1 && html.indexOf("<<dnd.") === -1);
	});
}

function testEnglish(wiki) {
	setLanguage(wiki, "en-GB");
	check("en datelong festival", filter(wiki, "[[1351-01-31]datelong[]]").join() === "//1351 DR//<br>//Midwinter (01/02)//");
	check("en datelong time", filter(wiki, "[[1351-07-01-10:00]datelong[]]").join() === "//1351 DR//<br>//01 Flamerule (07) 10:00//",
		filter(wiki, "[[1351-07-01-10:00]datelong[]]"));
	var avalon = view(wiki, "Insel Avalon");
	check("en tabs", avalon.indexOf(">Map<") !== -1 && avalon.indexOf(">Battle Map<") !== -1);
	check("en history header", avalon.indexOf("Date (DR)") !== -1);
	var index = body(wiki, "Index");
	check("en index", index.indexOf("Deities") !== -1 && index.indexOf("Open Items") !== -1, index);
	check("en hub heading uses the default template", /<h2 class="tc-title">\s*Location\s*<\/h2>/.test(view(wiki, "Location")));
	check("en battle map heading", /Battle Map/.test(view(wiki, "Insel Avalon/BattleMap")));
	check("de tag still mapped while en is active", $tw.hooks.invokeHook("th-saving-tiddler", new $tw.Tiddler({title: "N", tags: ["Ort"]})).fields.tags.join() === "Location");
}

function testWithoutCalendar(wiki) {
	setLanguage(wiki, "de-DE");
	wiki.addTiddler(new $tw.Tiddler({title: "$:/config/dndwiki/calendar", text: ""}));
	check("raw date", filter(wiki, "[[1351-01-31]datelong[]]").join() === "//1351-01-31//", filter(wiki, "[[1351-01-31]datelong[]]"));
	check("raw range", filter(wiki, "[[1200.1351-04-14]datelong[]]").join() === "//1200 - 1351-04-14//");
	check("raw year only", filter(wiki, "[[1200.1351-04-14]datelong[yes]]").join() === "//1200 - 1351//");
	check("no calculation without calendar", filter(wiki, "[[1351-01-01]datecalc[1]]").join() === "" && filter(wiki, "[[1351-01-01]datediff[1351-01-02]]").join() === "");
	var information = body(wiki, "Information");
	check("information without Kalender", information.indexOf("Kalender") === -1, information);
	var avalon = view(wiki, "Insel Avalon");
	check("history header without era", avalon.indexOf("Zeitpunkt") !== -1 && avalon.indexOf("(DR)") === -1);
	check("raw month and day in the history", avalon.indexOf(">07<") !== -1 && avalon.indexOf(">01<") !== -1);
	wiki.deleteTiddler("$:/config/dndwiki/calendar");
}

function testRefresh(wiki) {
	setLanguage(wiki, "de-DE");
	var text = "\\import [subfilter{$:/core/config/GlobalImportFilter}]\n<<datelong date:\"1351-01-31\">>",
		parser = wiki.parseText("text/vnd.tiddlywiki", text),
		widget = wiki.makeWidget(parser, {document: $tw.fakeDocument}),
		container = $tw.fakeDocument.createElement("div");
	widget.render(container, null);
	var before = container.textContent;
	setLanguage(wiki, "en-GB");
	widget.refresh({"$:/language": {modified: true}});
	var after = container.textContent;
	check("datelong refreshes on a language change", before.indexOf("Mittwinter") !== -1 && after.indexOf("Midwinter") !== -1, [before, after]);
	// Calendar data change: rename a festival in the language keys
	wiki.addTiddler(new $tw.Tiddler({title: "$:/dndwiki/language/en-GB/Calendar/Harptos/Festival/Midwinter", text: "Deep Midwinter"}));
	widget.refresh({"$:/dndwiki/language/en-GB/Calendar/Harptos/Festival/Midwinter": {modified: true}});
	check("datelong refreshes on a change of the calendar texts", container.textContent.indexOf("Deep Midwinter") !== -1, container.textContent);
	wiki.deleteTiddler("$:/dndwiki/language/en-GB/Calendar/Harptos/Festival/Midwinter");
	setLanguage(wiki, "de-DE");
}

$tw.boot.boot(function() {
	var wiki = $tw.wiki;
	fixtures(wiki);
	[testEngine, testGerman, testEnglish, testWithoutCalendar, testRefresh].forEach(function(group) {
		try {
			group(wiki);
		} catch(e) {
			failures++;
			console.log("ERROR in " + group.name + ": " + (e && e.stack || e));
		}
	});
	console.log(checks + " checks, " + failures + " failed");
	process.exit(failures ? 1 : 0);
});
