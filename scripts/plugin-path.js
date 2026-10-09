/*
 * Plugin search path for TiddlyWiki in this repo (used by scripts/tw.js, scripts/check-wiki.js and
 * test/helpers.js).
 *
 * Assembles TIDDLYWIKI_PLUGIN_PATH from this repo's own `plugins` folder
 * (wkod first-party: tiddlyrpg-core, staticfiles) plus the individually pinned flibbles
 * graph-stack packages in node_modules (each ships under <pkg>/plugins), then the folders given
 * as argument, then whatever TIDDLYWIKI_PLUGIN_PATH held before (the tests put their fixture
 * plugins there). Joined with the OS-specific path delimiter (";" Windows, ":" elsewhere) -
 * which is what TiddlyWiki's boot splits on. Earlier folders win for a plugin found twice.
 *
 * Also suppresses Node's DEP0169 (url.parse) deprecation warning that TiddlyWiki's core server
 * still triggers (cross-platform equivalent of NODE_OPTIONS=--no-deprecation).
 */
var path = require("path"),
	fs = require("fs");

module.exports = function(extraPaths) {
	process.noDeprecation = true;
	var root = path.join(__dirname, ".."),
		nodeModules = path.join(root, "node_modules"),
		pluginPaths = [path.join(root, "plugins")],
		before = (process.env.TIDDLYWIKI_PLUGIN_PATH || "").split(path.delimiter);
	["tw5-graph", "tw5-vis-network", "tw5-relink"].forEach(function(pkg) {
		pluginPaths.push(path.join(nodeModules, pkg, "plugins"));
	});
	pluginPaths = pluginPaths.concat(extraPaths || [], before).filter(function(p, index, all) {
		return p && all.indexOf(p) === index && fs.existsSync(p);
	});
	process.env.TIDDLYWIKI_PLUGIN_PATH = pluginPaths.join(path.delimiter);
};
