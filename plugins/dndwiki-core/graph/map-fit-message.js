/*\
title: $:/plugins/dndwiki-core/graph/map-fit-message.js
type: application/javascript
module-type: vis-message
created: 20261006064449000
modified: 20261006064449000

Message dnd-map-fit for the map of a location: shows the whole map image across the width
again after zooming or dragging, without an image all nodes (graph/map-fit.js). Sent by the button "Fit map" in
viewtemplates/location/map through a messagerelay into the graph.

\*/

"use strict";

var mapFit = require("$:/plugins/dndwiki-core/graph/map-fit.js");

exports.name = "dnd-map-fit";

exports.parameters = {};

exports.handle = function() {
	mapFit.fit(this,true);
};
