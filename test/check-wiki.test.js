/*
 * scripts/check-wiki.js against a small wiki folder (written to the temp folder): the report
 * (messages with the ids of their rules, errors and hints, exit code), the themes, --github, the
 * fields trpg-noerror and trpg-noinfo, and what it checks beyond dates: the config of the plugin
 * types ruleset and setting, the tiddlyrpg-core version a plugin needs, the reference coin of
 * the currency, unknown macros and rules macros not understood, the field link, images and maps
 * on disk, the plugins of the packages in the wiki's node_modules and the phases of a non-event,
 * the messages on quest names.
 * The checks of dates and sections before and after the 1.x migration: migrate.test.js.
 */
var test = require("node:test"),
	assert = require("node:assert/strict"),
	fs = require("fs"),
	os = require("os"),
	path = require("path"),
	childProcess = require("child_process");

var root = path.join(__dirname, ".."),
	fixtures = path.join(root, "test", "fixtures", "plugins"),
	dir;

function write(file, text) {
	fs.mkdirSync(path.dirname(path.join(dir, file)), {recursive: true});
	fs.writeFileSync(path.join(dir, file), text);
}

function info(plugins) {
	write("tiddlywiki.info", JSON.stringify({plugins: plugins, languages: ["de-DE"]}));
}

// A plugin folder with plugin.info (fields) and no tiddlers
function plugin(folder, fields) {
	write(path.join(folder, "plugin.info"), JSON.stringify(Object.assign({version: "0.0.0", "core-version": ">=5.4.0"}, fields)));
}

function check(extra) {
	var env = Object.assign({}, process.env, {TIDDLYWIKI_PLUGIN_PATH: fixtures}),
		result = childProcess.spawnSync(process.execPath, [path.join(root, "scripts", "check-wiki.js"), dir].concat(extra || []), {encoding: "utf8", env: env});
	return {status: result.status, out: result.stdout + result.stderr};
}

test.before(function() {
	dir = fs.mkdtempSync(path.join(os.tmpdir(), "tiddlyrpg-check-"));
	info(["tiddlyrpg-core", "fixture-setting-harptos", "fixture-ruleset-5e-mini"]);
	write("tiddlers/Turm.tid", "title: Turm\ntags: Event\ndate: 1351-07-01\n\n<<date>>\n\nA.\n");
});

test.after(function() {
	fs.rmSync(dir, {recursive: true, force: true});
});

test("a clean wiki: no finding, the calendar of the setting applies", function() {
	var result = check();
	assert.equal(result.status, 0, result.out);
	assert.match(result.out, /\(calendar Harptos\)/);
	assert.match(result.out, /0 errors, 0 hints/);
});

test("an unknown macro and a rules macro the ruleset does not understand: errors", function() {
	write("tiddlers/Notiz.tid", "title: Notiz\n\nA <<nope>> B, <<term wis bogus>>, <<term wis save>>, <<unit \"5 gp\">>.\n");
	try {
		var result = check();
		assert.equal(result.status, 1, result.out);
		assert.match(result.out, /Notiz\n {2}error {2}Check the text: <<term wis>> has no variant "bogus" {2}\[macros\/rules\]\n {2}error {2}Check the text: <<nope>> is no known macro {2}\[macros\/unknown\]\n/);
		assert.match(result.out, /2 errors, 0 hints/);
	} finally {
		fs.rmSync(path.join(dir, "tiddlers/Notiz.tid"), {force: true});
	}
});

test("phases of a non-event: a death before the return is fine, a phase without an end a hint", function() {
	write("tiddlers/Hati.tid", "title: Hati\ntags: Person\ndate: ./1351-08-04, 1355\n\nA wolf.\n");
	write("tiddlers/Twice.tid", "title: Twice\ntags: Person\ndate: 1300, 1310/1320\n\nTwo starts.\n");
	try {
		var result = check();
		assert.equal(result.status, 0, result.out);
		assert.doesNotMatch(result.out, /^Hati$/m);
		assert.match(result.out, /Twice\n {2}hint {2}Check the date: the phase 1300 has no end, but a later one follows {2}\[dates\/phases\]\n/);
		assert.match(result.out, /0 errors, 1 hints/);
	} finally {
		fs.rmSync(path.join(dir, "tiddlers/Hati.tid"), {force: true});
		fs.rmSync(path.join(dir, "tiddlers/Twice.tid"), {force: true});
	}
});

test("images and maps: a missing file, images at a joined spot; battlemap is no longer looked at", function() {
	write("images/map/Hafen.jpg", "");
	write("images/location/Steg.jpg", "");
	write("tiddlers/Hafen.tid", "title: Hafen\ntags: Location\nmap: Hafen.jpg, Kampf.jpg\nimage: Ufer.jpg\nbattlemap: Alt.jpg\n\n" +
		"<<spot \"Steg\" image:\"Steg.jpg, Boot.jpg\" map:\"Plan.jpg\">>\n\nWooden.\n\n<<spot \"Kneipe\" image:\"Kneipe.jpg\">>\n\nA tavern.\n\n<<spot \"Alt\" battlemap:\"X.jpg\">>\n\nOld.\n");
	write("tiddlers/Kneipe.tid", "title: Kneipe\ntags: Location\n\nThe tavern.\n");
	write("tiddlers/Ankunft.tid", "title: Ankunft\ntags: Event\ndate: 1351-07-02\n\n<<date>>\n\n<<image \"Fehlt.png\">> <<image \"Hafen.jpg\" folder:\"map\">>\n");
	write("tiddlers/Lose Notiz.tid", "title: Lose Notiz\n\n<<image \"Bild.png\">>\n");
	try {
		var result = check();
		assert.equal(result.status, 1, result.out);
		[
			"error  Check the map: images/map/Kampf.jpg does not exist  [images/files]",
			"error  Check the image: images/location/Ufer.jpg does not exist  [images/files]",
			"error  Check the spot Steg: its image images/location/Boot.jpg does not exist  [images/files]",
			"error  Check the spot Steg: its map images/map/Plan.jpg does not exist  [images/files]",
			"hint  Check the spot: Kneipe is joined to Kneipe - its images and maps show there, set them in that tiddler  [images/joined]",
			"error  Check the text: <<image>> shows images/event/Fehlt.png, which does not exist  [images/files]",
			"error  Check the text: <<image \"Bild.png\">> in a tiddler without type - name the folder, e.g. folder:\"event\"  [images/folder]"
		].forEach(function(line) {
			assert.ok(result.out.indexOf(line) !== -1, line + "\n" + result.out);
		});
		assert.doesNotMatch(result.out, /Hafen\.jpg does not exist|Steg\.jpg does not exist|battlemap/);
	} finally {
		["images/map/Hafen.jpg", "images/location/Steg.jpg", "tiddlers/Hafen.tid", "tiddlers/Kneipe.tid", "tiddlers/Ankunft.tid", "tiddlers/Lose Notiz.tid"].forEach(function(file) {
			fs.rmSync(path.join(dir, file), {force: true});
		});
	}
});

test("the field link: a hint, it is shown no more", function() {
	write("tiddlers/Baile.tid", "title: Baile\ntags: Location\nlink: https://example.org/baile\n\nTown.\n");
	try {
		var result = check();
		assert.equal(result.status, 0, result.out);
		assert.match(result.out, /Baile\n {2}hint {2}Check the fields: the field link is shown no more - where the images come from goes into the field source {2}\[legacy\/link\]\n/);
	} finally {
		fs.rmSync(path.join(dir, "tiddlers/Baile.tid"), {force: true});
	}
});

test.describe("the config of the plugin types", function() {
	var CONFIG = "tiddlers/$__config_tiddlyrpg_setting.tid";

	test.afterEach(function() {
		fs.rmSync(path.join(dir, CONFIG), {force: true});
	});

	test("naming a plugin that is not installed is an error", function() {
		write(CONFIG, "title: $:/config/tiddlyrpg/setting\n\n$:/plugins/missing");
		var result = check();
		assert.equal(result.status, 1, result.out);
		assert.match(result.out, /\$:\/config\/tiddlyrpg\/setting\n\s+error\s+Check the choice: \$:\/plugins\/missing is not installed - active is \$:\/plugins\/fixture-setting-harptos {2}\[plugins\/choice\]/);
	});

	test("naming a plugin of the other type is an error", function() {
		write(CONFIG, "title: $:/config/tiddlyrpg/setting\n\n$:/plugins/fixture-ruleset-5e-mini");
		var result = check();
		assert.equal(result.status, 1, result.out);
		assert.match(result.out, /fixture-ruleset-5e-mini is no plugin of this type/);
	});

	test("none and an installed plugin are fine", function() {
		write(CONFIG, "title: $:/config/tiddlyrpg/setting\n\nnone");
		var result = check();
		assert.equal(result.status, 0, result.out);
		assert.match(result.out, /\(no calendar\)/);
		write(CONFIG, "title: $:/config/tiddlyrpg/setting\n\n$:/plugins/fixture-setting-harptos");
		assert.equal(check().status, 0);
	});
});

test.describe("the version a plugin needs", function() {
	test.afterEach(function() {
		fs.rmSync(path.join(dir, "plugins"), {recursive: true, force: true});
	});

	test("a plugin that needs a newer tiddlyrpg-core is an error", function() {
		plugin("plugins/needs-new", {title: "$:/plugins/needs-new", "plugin-type": "plugin", "tiddlyrpg-core-version": ">=9.0.0"});
		var result = check();
		assert.equal(result.status, 1, result.out);
		assert.match(result.out, /\$:\/plugins\/needs-new\n\s+error\s+\$:\/plugins\/needs-new needs tiddlyrpg-core >=9\.0\.0, this wiki has \d+\.\d+\.\d+ {2}\[plugins\/version\]/);
	});

	test("a version without >= is an error", function() {
		plugin("plugins/needs-form", {title: "$:/plugins/needs-form", "plugin-type": "plugin", "tiddlyrpg-core-version": "2.0.0"});
		var result = check();
		assert.equal(result.status, 1, result.out);
		assert.match(result.out, /tiddlyrpg-core-version 2\.0\.0 - write it as >=x\.y\.z/);
	});
});

test("a currency whose reference is none of its coins is an error", function() {
	write("tiddlers/Own Coins.json", JSON.stringify({id: "Own", reference: "gp", currencies: [{id: "a", value: 1}, {id: "b", value: 10}]}));
	write("tiddlers/Own Coins.json.meta", "title: Own Coins\ntype: application/json\n");
	write("tiddlers/$__config_tiddlyrpg_currency.tid", "title: $:/config/tiddlyrpg/currency\n\nOwn Coins");
	try {
		var result = check();
		assert.equal(result.status, 1, result.out);
		assert.match(result.out, /Own Coins\n\s+error\s+Check the currency: the coin of the prices of the ruleset is gp, which is none of its coins \(a, b\)/);
	} finally {
		["Own Coins.json", "Own Coins.json.meta", "$__config_tiddlyrpg_currency.tid"].forEach(function(file) {
			fs.rmSync(path.join(dir, "tiddlers", file), {force: true});
		});
	}
});

test("quests: a quest tiddler without marker, names one letter apart", function() {
	write("tiddlers/Labore.tid", "title: Labore\ntags: Event\ndate: 1351-07-02\n\n<<date>>\n\n<<quest \"Tyrias Labore finden\">>A.\n\n<<quest \"Tyrias labore finden!\">>B.\n\n<<quest \"Die Schamanin Eoria\">>C.\n\n<<quest \"Die Schamanin Tyria\">>D.\n\n<<quest \"Rettung von Biale\">>E.\n");
	write("tiddlers/Rettung von Baile.tid", "title: Rettung von Baile\ntags: Quest\n\nPlanning.\n");
	write("tiddlers/Leerer Quest.tid", "title: Leerer Quest\ntags: Quest\n\nPlanning.\n");
	try {
		var result = check();
		assert.equal(result.status, 0, result.out);
		assert.match(result.out, /Leerer Quest\n\s+hint\s+Check the quest: it has no marker yet - mark it in an event: <<quest "Leerer Quest">> {2}\[quests\/marker\]/);
		assert.match(result.out, /Tyrias Labore finden\n\s+hint\s+Check the name: it is close to the rumour Tyrias labore finden! - one quest written two ways\? {2}\[quests\/similar\]/);
		assert.match(result.out, /Tyrias labore finden!\n\s+hint\s+Check the name: it is close to the rumour Tyrias Labore finden/);
		assert.match(result.out, /Rettung von Baile\n\s+hint\s+Check the quest: it has no marker yet.*\n\s+hint\s+Check the name: it is close to the rumour Rettung von Biale/);
		assert.doesNotMatch(result.out, /Schamanin/);
	} finally {
		["Labore.tid", "Rettung von Baile.tid", "Leerer Quest.tid"].forEach(function(file) {
			fs.rmSync(path.join(dir, "tiddlers", file), {force: true});
		});
	}
});

test("the plugins of the packages in the wiki's node_modules are found", function() {
	plugin("node_modules/some-package/plugins/package-setting", {title: "$:/plugins/package-setting", "plugin-type": "setting"});
	info(["tiddlyrpg-core", "package-setting"]);
	write("tiddlers/$__config_tiddlyrpg_setting.tid", "title: $:/config/tiddlyrpg/setting\n\n$:/plugins/package-setting");
	try {
		var result = check();
		assert.equal(result.status, 0, result.out);
		assert.doesNotMatch(result.out, /Cannot find plugin/);
	} finally {
		fs.rmSync(path.join(dir, "node_modules"), {recursive: true, force: true});
		fs.rmSync(path.join(dir, "tiddlers", "$__config_tiddlyrpg_setting.tid"), {force: true});
		info(["tiddlyrpg-core", "fixture-setting-harptos", "fixture-ruleset-5e-mini"]);
	}
});

test.describe("themes, --github and the switches", function() {
	test.before(function() {
		write("tiddlers/Mix.tid", "title: Mix\ntags: Location\nlink: x\n\nA <<nope>> B.\n");
	});

	test.after(function() {
		fs.rmSync(path.join(dir, "tiddlers/Mix.tid"), {force: true});
	});

	test("a theme runs only its rules", function() {
		var result = check(["legacy"]);
		assert.equal(result.status, 0, result.out);
		assert.match(result.out, /- legacy/);
		assert.match(result.out, /\[legacy\/link\]/);
		assert.doesNotMatch(result.out, /macros\/unknown/);
	});

	test("an unknown theme: exit code 2 and the list of themes", function() {
		var result = check(["nonsense"]);
		assert.equal(result.status, 2, result.out);
		assert.match(result.out, /Unknown theme: nonsense - themes: .*legacy/);
	});

	test("--github: each message also as a workflow command", function() {
		var result = check(["--github"]);
		assert.match(result.out, /^::error title=Mix::Check the text: <<nope>> is no known macro \[macros\/unknown\]$/m);
		assert.match(result.out, /^::notice title=Mix::Check the fields: the field link is shown no more/m);
	});

	test("trpg-noerror and trpg-noinfo switch messages off, empty means all of a level", function() {
		write("tiddlers/Mix.tid", "title: Mix\ntags: Location\nlink: x\ntrpg-noerror: macros/unknown\ntrpg-noinfo: legacy/typo\n\nA <<nope>> B.\n");
		var result = check();
		assert.equal(result.status, 0, result.out);
		assert.doesNotMatch(result.out, /macros\/unknown/);
		assert.match(result.out, /\[legacy\/link\]/);
		assert.match(result.out, /Check the fields: trpg-noinfo names "legacy\/typo", which is no check {2}\[checks\/switches\]/);
		write("tiddlers/Mix.tid", "title: Mix\ntags: Location\nlink: x\ntrpg-noinfo: \n\nA <<nope>> B.\n");
		result = check();
		assert.equal(result.status, 1, result.out);
		assert.doesNotMatch(result.out, /legacy\/link/);
		assert.match(result.out, /\[macros\/unknown\]/);
	});
});
