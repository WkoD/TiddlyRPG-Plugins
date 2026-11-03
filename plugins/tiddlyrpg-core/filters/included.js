/*\
title: $:/plugins/tiddlyrpg-core/filters/included.js
type: application/javascript
module-type: allfilteroperator
created: 20261103173828774
modified: 20261103173828774

[all[included]]: the entries of the content packages included in the wiki without an own
version (modules/content.js included(), modules/content-include.js) - with tiddlers
([all[tiddlers+included]]) where an included entry counts like a tiddler of the wiki.

\*/

"use strict";

exports.included = function(source,prefix,options) {
	return require("$:/plugins/tiddlyrpg-core/modules/content.js").included(options.wiki);
};
