/*\
title: $:/plugins/tiddlyrpg-core/server/content-route.js
type: application/javascript
module-type: route
created: 20261022165310491
modified: 20261022165310491

GET /tiddlyrpg/content/index.json?ruleset=<plugin>    the content packages of the ruleset, their
                                                      entries without texts
GET /tiddlyrpg/content/entry.json?ruleset=<plugin>&id=<id>   one entry with its text and package

Content packages: modules/content-server.js. Only for who may write (a reader of the published
copy takes nothing); 404 for an id no package of the ruleset has. The id is only looked up.

\*/

"use strict";

exports.methods = ["GET"];

exports.path = /^\/tiddlyrpg\/content\/(index|entry)\.json$/;

exports.info = {
	priority: 100
};

exports.handler = function(request,response,state) {
	var content = require("$:/plugins/tiddlyrpg-core/modules/content-server.js"),
		send = function(status,data) {
			state.sendResponse(status,{"Content-Type": "application/json"},JSON.stringify(data),"utf8");
		};
	if(!state.server.isAuthorized("writers",state.authenticatedUsername)) {
		return send(403,{error: "forbidden"});
	}
	var wikiPath = state.boot.wikiPath,
		ruleset = (state.queryParameters.ruleset || "").toString();
	if(state.params[0] === "index") {
		return send(200,{packages: content.index(wikiPath,ruleset)});
	}
	var found = content.entry(wikiPath,ruleset,(state.queryParameters.id || "").toString());
	return found ? send(200,found) : send(404,{error: "not found"});
};
