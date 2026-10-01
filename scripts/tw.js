#!/usr/bin/env node
/*
 * Cross-platform TiddlyWiki launcher for the plugin bundle (editions/smoke boot-check).
 *
 * The plugin search path and the deprecation switch come from scripts/plugin-path.js, shared
 * with the tests.
 */
require("./plugin-path")();

var $tw = require("tiddlywiki").TiddlyWiki();
$tw.boot.argv = Array.prototype.slice.call(process.argv, 2);
$tw.boot.boot();
