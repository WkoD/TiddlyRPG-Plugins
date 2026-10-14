/*
 * scripts/check-wiki.js against a small wiki folder (written to the temp folder) on what it
 * checks beyond dates: the config of the plugin types ruleset and setting, the tiddlyrpg-core
 * version a plugin needs, the reference coin of the currency, unknown macros and rules macros
 * not understood, the field link, the plugins of the packages in the wiki's node_modules and the
 * phases of a non-event.
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

function check() {
	var env = Object.assign({}, process.env, {TIDDLYWIKI_PLUGIN_PATH: fixtures}),
		result = childProcess.spawnSync(process.execPath, [path.join(root, "scripts", "check-wiki.js"), dir], {encoding: "utf8", env: env});
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
	assert.match(result.out, /0 errors, 0 warnings, 0 hints/);
});

test("an unknown macro and a rules macro the ruleset does not understand: warnings", function() {
	write("tiddlers/Notiz.tid", "title: Notiz\n\nA <<nope>> B, <<term wis bogus>>, <<term wis save>>, <<unit \"5 gp\">>.\n");
	try {
		var result = check();
		assert.equal(result.status, 0, result.out);
		assert.match(result.out, /Notiz\n {2}warning {2}Check the text: <<nope>> is no known macro\n {2}warning {2}Check the text: <<term wis>> has no variant "bogus"\n/);
		assert.match(result.out, /0 errors, 2 warnings, 0 hints/);
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
		assert.match(result.out, /Twice\n {2}hint {2}a phase without an end before a later one: 1300\n/);
		assert.match(result.out, /0 errors, 0 warnings, 1 hints/);
	} finally {
		fs.rmSync(path.join(dir, "tiddlers/Hati.tid"), {force: true});
		fs.rmSync(path.join(dir, "tiddlers/Twice.tid"), {force: true});
	}
});

test("images and maps: a missing file, battlemap left over, images at a joined spot", function() {
	write("images/map/Hafen.jpg", "");
	write("images/location/Steg.jpg", "");
	write("tiddlers/Hafen.tid", "title: Hafen\ntags: Location\nmap: Hafen.jpg, Kampf.jpg\nimage: Ufer.jpg\nbattlemap: Alt.jpg\n\n" +
		"<<spot \"Steg\" image:\"Steg.jpg, Boot.jpg\" map:\"Plan.jpg\">>\n\nWooden.\n\n<<spot \"Kneipe\" image:\"Kneipe.jpg\">>\n\nA tavern.\n\n<<spot \"Alt\" battlemap:\"X.jpg\">>\n\nOld.\n");
	write("tiddlers/Kneipe.tid", "title: Kneipe\ntags: Location\n\nThe tavern.\n");
	write("tiddlers/Ankunft.tid", "title: Ankunft\ntags: Event\ndate: 1351-07-02\n\n<<date>>\n\n<<image \"Fehlt.png\">> <<image \"Hafen.jpg\" folder:\"map\">>\n");
	write("tiddlers/Lose Notiz.tid", "title: Lose Notiz\n\n<<image \"Bild.png\">>\n");
	try {
		var result = check();
		assert.equal(result.status, 0, result.out);
		[
			"warning  map: images/map/Kampf.jpg does not exist",
			"warning  image: images/location/Ufer.jpg does not exist",
			"warning  the field battlemap is no longer shown - battle maps go into the field map",
			"warning  the parameter battlemap of a spot is no longer shown - battle maps go into map",
			"warning  image of spot Steg: images/location/Boot.jpg does not exist",
			"warning  map of spot Steg: images/map/Plan.jpg does not exist",
			"hint  spot Kneipe is joined to Kneipe - its images and maps show there, set them in that tiddler",
			"warning  <<image>>: images/event/Fehlt.png does not exist",
			"warning  <<image \"Bild.png\">> in a tiddler without type: name the folder (folder:\"event\")"
		].forEach(function(line) {
			assert.ok(result.out.indexOf(line) !== -1, line + "\n" + result.out);
		});
		assert.doesNotMatch(result.out, /Hafen\.jpg does not exist|Steg\.jpg does not exist/);
	} finally {
		["images/map/Hafen.jpg", "images/location/Steg.jpg", "tiddlers/Hafen.tid", "tiddlers/Kneipe.tid", "tiddlers/Ankunft.tid", "tiddlers/Lose Notiz.tid"].forEach(function(file) {
			fs.rmSync(path.join(dir, file), {force: true});
		});
	}
});

test("the field link: a warning, it is shown no more", function() {
	write("tiddlers/Baile.tid", "title: Baile\ntags: Location\nlink: https://example.org/baile\n\nTown.\n");
	try {
		var result = check();
		assert.equal(result.status, 0, result.out);
		assert.match(result.out, /Baile\n {2}warning {2}the field link is no longer shown - where the images come from goes into the field source\n/);
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
		assert.match(result.out, /\$:\/config\/tiddlyrpg\/setting\n\s+error\s+\$:\/plugins\/missing is not installed - active is \$:\/plugins\/fixture-setting-harptos/);
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
		assert.match(result.out, /\$:\/plugins\/needs-new\n\s+error\s+needs tiddlyrpg-core >=9\.0\.0, the wiki has \d+\.\d+\.\d+/);
	});

	test("a version without >= is an error", function() {
		plugin("plugins/needs-form", {title: "$:/plugins/needs-form", "plugin-type": "plugin", "tiddlyrpg-core-version": "2.0.0"});
		var result = check();
		assert.equal(result.status, 1, result.out);
		assert.match(result.out, /tiddlyrpg-core-version 2\.0\.0 - use the form >=x\.y\.z/);
	});
});

test("a currency whose reference is none of its coins is an error", function() {
	write("tiddlers/Own Coins.json", JSON.stringify({id: "Own", reference: "gp", currencies: [{id: "a", value: 1}, {id: "b", value: 10}]}));
	write("tiddlers/Own Coins.json.meta", "title: Own Coins\ntype: application/json\n");
	write("tiddlers/$__config_tiddlyrpg_currency.tid", "title: $:/config/tiddlyrpg/currency\n\nOwn Coins");
	try {
		var result = check();
		assert.equal(result.status, 1, result.out);
		assert.match(result.out, /Own Coins\n\s+error\s+reference gp is no coin of the currency \(a, b\)/);
	} finally {
		["Own Coins.json", "Own Coins.json.meta", "$__config_tiddlyrpg_currency.tid"].forEach(function(file) {
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
