/*\
title: $:/plugins/staticfiles/route
type: application/javascript
module-type: route

GET /images/:filepath and /data/:filepath - modelled on the core route get-file (5.4):
streams the file, answers HTTP range requests (206/416) and sets Content-Length.
\*/
"use strict";

exports.methods = ["GET"];

exports.path = /^\/(images|data)\/(.+)$/;

exports.info = {
	priority: 100
};

exports.handler = function(request,response,state) {
	var path = require("path"),
		fs = require("fs"),
		suppliedFilename = state.params[0] + "/" + $tw.utils.decodeURIComponentSafe(state.params[1]),
		baseFilename = path.resolve(state.boot.wikiPath,state.params[0]),
		filename = path.resolve(baseFilename,$tw.utils.decodeURIComponentSafe(state.params[1])),
		relative = path.relative(baseFilename,filename),
		extension = path.extname(filename);
	// Make sure the file lies inside images/ or data/ respectively
	if(relative.indexOf("..") === 0 || path.isAbsolute(relative)) {
		return state.sendResponse(404,{"Content-Type": "text/plain"},"File '" + suppliedFilename + "' not found");
	}
	fs.stat(filename,function(err,stats) {
		if(err || !stats.isFile()) {
			return state.sendResponse(404,{"Content-Type": "text/plain"},"File '" + suppliedFilename + "' not found");
		}
		var type = ($tw.config.fileExtensionInfo[extension] ? $tw.config.fileExtensionInfo[extension].type : "application/octet-stream"),
			responseHeaders = {
				"Content-Type": type,
				"Accept-Ranges": "bytes"
			},
			rangeHeader = request.headers.range,
			stream;
		if(rangeHeader) {
			var parts = rangeHeader.replace(/bytes=/,"").split("-"),
				start = parseInt(parts[0],10),
				end = parts[1] ? parseInt(parts[1],10) : stats.size - 1;
			if(isNaN(start) || isNaN(end) || start < 0 || end < start || end >= stats.size) {
				responseHeaders["Content-Range"] = "bytes */" + stats.size;
				return response.writeHead(416,responseHeaders).end();
			}
			responseHeaders["Content-Range"] = "bytes " + start + "-" + end + "/" + stats.size;
			responseHeaders["Content-Length"] = (end - start) + 1;
			response.writeHead(206,responseHeaders);
			stream = fs.createReadStream(filename,{start: start, end: end});
		} else {
			responseHeaders["Content-Length"] = stats.size;
			response.writeHead(200,responseHeaders);
			stream = fs.createReadStream(filename);
		}
		stream.on("error",function() {
			if(!response.headersSent) {
				response.writeHead(500,{"Content-Type": "text/plain"});
				response.end("Read error");
			} else {
				response.destroy();
			}
		});
		stream.pipe(response);
	});
};
