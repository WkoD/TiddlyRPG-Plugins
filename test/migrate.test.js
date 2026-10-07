/*
 * scripts/migrate-dates.js and scripts/check-dates.js against a small wiki folder of fixtures
 * (written to the temp folder): conversion rules per type, bodies, rules, snippets, filters,
 * <<date>> at the start of every event,
 * idempotence; the checker before and after.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	fs = require("fs"),
	os = require("os"),
	path = require("path"),
	childProcess = require("child_process");

var root = path.join(__dirname, ".."),
	dir;

function tid(name, fields, text) {
	var head = Object.keys(fields).map(function(key) { return key + ": " + fields[key]; }).join("\n");
	fs.writeFileSync(path.join(dir, "tiddlers", name + ".tid"), head + "\n\n" + (text || ""));
}

function read(name) {
	return fs.readFileSync(path.join(dir, "tiddlers", name + ".tid"), "utf8");
}

function run(script, args) {
	var result = childProcess.spawnSync(process.execPath, [path.join(root, "scripts", script)].concat(args), {encoding: "utf8"});
	return {status: result.status, out: result.stdout + result.stderr};
}

test.before(function() {
	dir = fs.mkdtempSync(path.join(os.tmpdir(), "dndwiki-dates-"));
	fs.mkdirSync(path.join(dir, "tiddlers"));
	fs.writeFileSync(path.join(dir, "tiddlywiki.info"), JSON.stringify({plugins: ["dndwiki-core", "dndwiki-forgottenrealms"], languages: ["de-DE"]}));
	tid("Turm", {title: "Turm", tags: "Campaign Event", date: "1351-07-01.1351-07-11.1351-11-10."},
		"<b>Jahr:</b> <$macrocall $name=\"datelong\" date=\"1351-07-01\"/>\n\nA.\n\n---\n\n<b>Jahr:</b> <$macrocall $name=\"datelong\" date=\"1351-07-11\"/>\n\nB.\n\n---\n\n<b>Jahr:</b> <$macrocall $name=\"datelong\" date=\"1351-08-09\"/>\n\nC.\n\n---\n\nD.\n");
	tid("Intro", {title: "Intro", tags: "Event", date: "1351-08-15.1351-11-12"},
		"Zuerst.\n\n---\n\n<b>Jahr:</b> <$macrocall $name=\"datelong\" date=\"1351-11-12\"/>\n\nDann.\n");
	tid("Offen", {title: "Offen", tags: "Event", date: "1351-07-11."});
	tid("Actia", {title: "Actia", tags: "Player", date: "1200.1351-04-14"});
	tid("Bobanis", {title: "Bobanis", tags: "Person", date: ".1339"});
	tid("Balor", {title: "Balor", tags: "Person", date: "."});
	tid("Aideen", {title: "Aideen", tags: "Person", date: "1322"});
	tid("Snippet", {title: "Datumsangabe", tags: "$:/tags/TextEditor/Snippet"}, "<b>Jahr:</b> <$macrocall $name=\"datelong\" date=\"yyyy-mm-dd\"/>");
	tid("WorldMap", {title: "$:/graph/WorldMap", filter: "[tag[Location]] [multitag[Person]] -[search:date[.]]"});
});

test.after(function() {
	fs.rmSync(dir, {recursive: true, force: true});
});

test("dry run writes nothing", function() {
	var before = read("Turm"),
		result = run("migrate-dates.js", [dir]);
	assert.equal(result.status, 0, result.out);
	assert.equal(read("Turm"), before);
	assert.match(result.out, /Dry run/);
});

test.describe("after --write", function() {
	test.before(function() {
		var result = run("migrate-dates.js", [dir, "--write"]);
		assert.equal(result.status, 0, result.out);
	});

	test("events: points separated by commas, open end", function() {
		assert.match(read("Turm"), /^date: 1351-07-01, 1351-07-11, 1351-11-10, \.\.$/m);
		assert.match(read("Offen"), /^date: 1351-07-11\/\.\.$/m);
	});

	test("other types: start/end, unknown sides", function() {
		assert.match(read("Actia"), /^date: 1200\/1351-04-14$/m);
		assert.match(read("Bobanis"), /^date: \.\/1339$/m);
		assert.match(read("Balor"), /^date: \.\/\.$/m);
		assert.match(read("Aideen"), /^date: 1322$/m);
	});

	test("body: placeholders, rules removed, unknown dates kept", function() {
		var body = read("Turm").split("\n\n").slice(1).join("\n\n");
		assert.equal(body, "<<date>>\n\nA.\n\n<<date>>\n\nB.\n\n---\n\n<<dateformat \"1351-08-09\">>\n\nC.\n\n---\n\nD.\n");
	});

	test("body with an intro: explicit number", function() {
		assert.match(read("Intro"), /Zuerst\.\n\n<<date 2>>\n\nDann\./);
	});

	test("snippet and filter", function() {
		assert.match(read("Snippet"), /\n\n<<date>>$/);
		assert.match(read("WorldMap"), /-\[dnd\.dead\[\]\]/);
	});

	test("a second run changes nothing", function() {
		var before = read("Turm") + read("Actia"),
			result = run("migrate-dates.js", [dir, "--write"]);
		assert.equal(result.status, 0);
		assert.equal(read("Turm") + read("Actia"), before);
		assert.match(result.out, /Field date converted \(0\)/);
	});

	test("checker: the date left in the body is an error, the intro a hint", function() {
		var result = run("check-dates.js", [dir]);
		assert.equal(result.status, 1, result.out);
		assert.match(result.out, /Turm\n(.*\n)*\s+error  date in the body instead of the field: <<dateformat "1351-08-09">>/);
		assert.match(result.out, /Intro\n(.*\n)*\s+hint  sections without heading: 1/);
		assert.doesNotMatch(result.out, /old format/);
	});

	test("checker: clean after fixing by hand", function() {
		tid("Turm", {title: "Turm", tags: "Campaign Event", date: "1351-07-01, 1351-07-11, 1351-08-09/.."},
			"<<date>>\n\nA.\n\n<<date \"Zweiter\">>\n\nB.\n\n<<date>>\n\nC.\n");
		tid("Intro", {title: "Intro", tags: "Event", date: "1351-08-15, 1351-11-12"}, "<<date>>\n\nZuerst.\n\n<<date>>\n\nDann.\n");
		var result = run("check-dates.js", [dir]);
		assert.equal(result.status, 0, result.out);
		assert.match(result.out, /0 errors, 0 warnings/);
	});

	test("checker: locks - asking the view, a transcluded secret, the hints on sections", function() {
		tid("Geheim", {title: "Geheim", tags: "Event Secret", date: "1351"}, "<<date>>\n\nNur DM.\n");
		tid("Nutzer", {title: "Nutzer", tags: "Person"}, "{{Geheim}}\n\n<$list filter=\"[{$:/state/dndwiki/view}]\">x</$list>\n");
		tid("Mitte", {title: "Mitte", tags: "Event", date: "1351"}, "<<date>>\n\nA <<secret>> B.\n");
		var result = run("check-dates.js", [dir]);
		assert.match(result.out, /Nutzer\n(.*\n)*\s+warning  asks the view itself/);
		assert.match(result.out, /Nutzer\n(.*\n)*\s+warning  transcludes the secret tiddler Geheim/);
		assert.match(result.out, /Mitte\n(.*\n)*\s+warning  .*<<secret>>/);
	});
});

test("every event starts with <<date>>: inserted where there is no placeholder", function() {
	assert.match(read("Offen"), /\n\n<<date>>\n$/);
	assert.match(read("Intro"), /^Zuerst\./m);
});
