# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Plugin bundle for the `DnDWiki` repo family. Contents and how wikis use it: see `README.md`.

## Documentation - who covers what

- **CLAUDE.md** (here): development support - rules, conventions, editing and release workflow.
- **README.md**: what the project is and how it is used in `DnDWiki` and other wikis, including
  languages and calendar.

Sort new content accordingly instead of duplicating it. (Same split in the wiki repos,
maintained canonically in `DnDWiki`.)

## Editing the format layer

`dndwiki-core` and `dndwiki-forgottenrealms` are **folder plugins** under `plugins/` (no build
step - the folder *is* the plugin, edit the tiddlers there directly).

```bash
npm install
npm run smoke       # boot/load check with all plugins and de-DE (no wiki checkout needed)
npm test            # functional test: calendar engine, rendering in de-DE/en-GB, refresh
npm run check-lang  # language packs complete against en-GB
```

- `npm run smoke` boots the minimal edition `editions/smoke` (only `tiddlywiki.info` with the
  plugin list and `"languages": ["de-DE"]`, **no content**) and aborts on module/load errors.
  JS modules only run when used, so this does not replace the test.
- `npm test` (`scripts/test.js`) boots the smoke edition in-process, adds fixture tiddlers and
  checks the calendar engine against the former hard-wired Harptos arithmetic, the rendered
  view templates in de-DE and en-GB, with and without an active calendar, the refresh of date
  output after a language change, the tag hook and the search. The graph widget needs a
  browser; the test renders the relations through the list tab. The timeline renders in Node
  (cards, bars, beams, order, details); what depends on measured sizes - the placement of the
  vertical labels, the widening of a selected card, the lines to its points - only shows in a
  browser. Extend it with every change.
- The launcher `scripts/tw.js` builds `TIDDLYWIKI_PLUGIN_PATH` from `./plugins` plus the pinned
  `node_modules/tw5-*/plugins`. A **content preview** deliberately does not exist here - use the
  IDE loop in a real wiki (below).

**Checking in a real wiki (IDE loop instead of WYSIWYG):** The format layer is edited here in
the IDE (versioned technical layer) and checked together with a real wiki - no saving back from
the browser. Point the plugin dependency of the wiki repo (`DnDWiki` or a campaign) **locally**
to this checkout instead of the release pin - with `npm link`:

```bash
# once in TiddlyDnD-Plugins:
npm link
# in the wiki repo (DnDWiki or a campaign):
npm link tiddlydnd-plugins
```

This creates `node_modules/tiddlydnd-plugins` as a symlink/junction to this checkout; the wiki
launcher then loads `plugins/*` **live**. Loop: change a tiddler in the IDE -> restart
`npm start` in the wiki -> change visible (folder plugins do not hot-reload). The link lives in
`node_modules` (gitignored) and `package.json` stays unchanged - as long as you only create the
link, there is nothing to commit.

**Two pitfalls when switching back to the release pin:**

- `npm unlink tiddlydnd-plugins` is an alias for `npm uninstall` and **removes the dependency
  from `package.json`**. Put the pin back by hand afterwards (or run
  `npm install "git+https://github.com/WkoD/TiddlyDnD-Plugins.git#<version>"`). Check
  `git diff package.json` after switching back.
- With an active link, `npm install` writes `file:../TiddlyDnD-Plugins` into
  `package-lock.json` instead of the release pin. In the wiki repos the lockfile is gitignored
  and stays local - in repos that check in their lockfile, this state must not be committed.

**Timestamps (`created`/`modified`):** Every plugin tiddler (`.tid`, `.multids` header, the
`.meta` sidecar of JS modules, or the `/*\ ... \*/` header of JS modules without sidecar) carries
these fields in TiddlyWiki format (UTC, `YYYYMMDDHHMMSSmmm`). When editing directly in the IDE
the same care applies as in the wiki repos - see their `CLAUDE.md` -> "Timestamps when editing
tiddlers" (new file: `created`=`modified`=now; content change: only `modified`; mechanical mass
renames/migrations excepted).

**Naming:** internal names are English - tags/hubs (`Location`, `Item`, ...), fields
(`location`, `owner`, ...), macros, functions, files (`kebab-case`). Everything a reader sees comes
from the language packs, never as a literal in a template.

**Language:** everything in this repo is English - code, comments, docs, commit messages, tags
and release notes (from 2.0.0 on; the history before is German). German appears only as data:
the `de-DE` language packs, the expected output in `scripts/test.js` and the name mapping in
`scripts/migrate-2.0.js`.

## Contents (`$:/plugins/dndwiki-core/...`) - inventory

So that it is clear what already exists before adding something. All format tiddlers live
plugin-scoped under `$:/plugins/dndwiki-core/<category>/<name>` (files in subfolders of the same
name, `kebab-case`). Macros are called by their `exports.name` (e.g. `<<image>>`), independent of
the tiddler title:

- **Functions and procedures** (`functions`, tag `$:/tags/Global`): `dnd.visible`, `dnd.dead`
  (see "Functions & cascades"), `dnd.t`, `dnd.title`, `dnd.plural` (language system), the
  procedures `datelong`, `datecalc`, `datediff` (calendar).
- **Library modules** (`modules/*`): `language.js` (key lookup with fallback, display names,
  `$name$` patterns), `calendar.js` (calendar engine, see "Calendar engine"), `events.js` (splits
  the `date` field of an event into its points in time - several points, open start/end; shared
  by `eventlist` and the timeline so both read dates by the same rules).
- **Widgets** (`widgets/*`): `dnd-timeline` (`timeline.js`, attribute `filter`): vertical,
  interactive timeline of the events, newest at the top, undated ones at the bottom as `????`.
  Positions from `calendar.dayNumber`, long gaps collapsed; spans as bars in at most 5 lanes,
  more merge into one beam; tap/click selects (card grows, lines to each point in time), the
  title in the selected card opens the tiddler. Campaign events solid, other events dashed. Details
  in the module header.
- **Macros** (`macros/*`): `image` (resolves the `image` field against `images/<folder>/`, folder
  from the type tag, several images comma separated; battle maps as a link to the file),
  `subtiddler` (renders `<title>/<sub>` sub-tiddlers), `deadlink`, `library` (calendar
  independent date parser and comparison).
- **Filters** (`filters/*`): `eventlist` (event table, the "List" tab), `multitag` (input with at least one of the
  tags, grouped in tag order, no duplicates), `translate.js` (`dndtranslate`, `dndtitle`,
  `dndtitlesearch`), `date.js` (`datelong`, `datecalc`, `datediff`, `calendar[...]`).
- **Startup** (`startup/tag-names.js`): hook `th-saving-tiddler`, stores translated tag names
  ("Ort") under the internal name (`Location`).
- **ViewTemplates** (`viewtemplates/*`): `activity`, `image`, `event`, `event-list` (tab list
  "Timeline"/"List" in `event-list/tabs`, also used by the `Event` hub; the caller sets the filter
  variable `dnd-events`, contents `event-list/timeline` + `event-list/list`), `item`, `link`,
  `location` (map block: one tab per existing sub-tiddler `<location>/Map`, `<location>/BattleMap`,
  tab content `location/sub`), `relations` (tab list "Graph"/"List" via
  `$:/plugins/flibbles/graph/ui/grouped-tabs`, tab contents `relations/graph` + `relations/list`;
  one type scope filter for both tabs), `player`. Order via `list-after`. Plus `body-filter`
  (cascade, see below).
- **Snippets** (`snippets/*`, tag `$:/tags/TextEditor/Snippet`): `open-items`, `player-spoiler`.
- **Styles** (`styles/*`): `border` (border per type, generated from the hubs), `item` (book
  rules, battle map width), `dead`, `pinned`, `readonly` and `timeline` (static CSS,
  `type: text/css`).
  **Templates** `templates/image`, `templates/body-locked`, `templates/title-translated`.
- **Configuration** (`config/*`): `type-colour`, `class-dead`, `class-pinned`, `class-readonly`,
  `title-translated` - see below.
- **Search** (override of `$:/core/ui/DefaultSearchResultList` plus `search/item`): core search
  plus hubs whose translated name matches, hits shown with translated names.
- **Language packs** (`language/<code>/*.multids`): `titles` (`Title/<hub>`), `plurals`
  (`Plural/<hub>`), `fields` (`Field/<field>`, relation fields), `texts` (template texts).
- **Index/hub tiddlers** (Person, Location, Organisation, Deity, Player, Artifact, Book, Item,
  Material, Map, BattleMap, Event, Campaign, Calendar, Information, Index, TBC, TBC/Campaign;
  titles without prefix, tag `Index`): type tags carry the `color` field from which graph nodes,
  tiddler borders and tag pills take their colour; `caption` is `<<dnd.title ...>>`.
- **tw5-graph schema + graph templates**: field edge types (`$:/config/flibbles/graph/edges/fields/*`)
  + relink field types; the graph templates `$:/plugins/dndwiki-core/graph/templates/dnd-graph`
  (type colours from the tag `color`, `shape=box`, no saved positions) and `.../dnd-ego`; the ego
  view `$:/plugins/dndwiki-core/graph/ego`. The thin view definitions (`$:/graph/Default`/
  `Cosmogram`/`WorldMap`/`Items`) live in each wiki on purpose, not here.

`dndwiki-forgottenrealms` contains no code: `$:/dndwiki/calendar/Harptos` (data),
`$:/config/dndwiki/calendar` (activates it) and `language/<code>/` with `Calendar/Harptos/...`.

## Language system

- Keys are tiddlers `$:/dndwiki/language/<code>/<key>`, delivered as `.multids` (one line per
  key) or `.tid` (multi-line texts such as `Calendar/Harptos/Description`). en-GB is the base;
  every other language has the same keys. Keys only in `en-GB/names.multids` are proper names that
  may fall back on purpose (`check-lang` does not report them).
- Lookup in `modules/language.js`: active language (`$:/language`) -> en-GB -> null. The
  wikitext functions `dnd.t`, `dnd.title`, `dnd.plural` wrap the filter operators, so the fallback
  rule exists only once. **Functions with parameters take their argument from the operand, not
  from the input:** in filters use the operators directly (`[<title>dndtitle[]]`,
  `[<type>addprefix[Plural/]dndtranslate[]]`), in wikitext the functions as macros
  (`<<dnd.t Event/Year>>` - plain text, wrapped in `<p>` in block mode).
- Display names of titles: `Title/<title>`; a sub-tiddler `<parent>/<leaf>` whose parent exists
  shows the translated leaf (`Insel Avalon/Map` -> "Insel Avalon/Karte"). Used by the title
  cascade (`config/title-translated`), the tag pill override, the search and the hub lists.
- **Texts that need refreshing go through filtered attributes, not JS macros.** A JS macro call
  only re-renders when its parameters change; a filtered attribute is recomputed on every
  refresh. That is why the date output is filter operators plus procedures
  (`<$let t={{{ [<date>datelong[]] }}}><<t>></$let>`).
- Places that show `caption` only as plain text (`$view`) cannot be translated: the graph
  settings of tw5-graph (template and view captions). Graph view captions belong to the wiki.
- Known limits: the tag dropdown does not suggest "Ort" (filter hard-wired in
  `$:/core/macros/tag-picker`); sidebar "Open" and link texts without alias show the English
  title; field names in edit mode stay English.

## Calendar engine

`modules/calendar.js` knows no particular calendar. `active(wiki)` reads the data tiddler named
in `$:/config/dndwiki/calendar` (cached per tiddler via `getCacheForTiddler`), or returns null.
Data model and leap rule: see the module header and `README.md`. Day numbers are summed from the
data with a closed form for the leap years before a year (`floor((year-1-start)/every) -
floor((-1-start)/every)`); for Harptos this equals the former `year*365 + ceil(year/4)`, which
`npm test` checks over several leap cycles in both directions.

Without a calendar, `datelong` shows the date as entered, `eventlist` the raw month/day numbers,
`datecalc`/`datediff` return nothing and the `Calendar` hub is hidden from `Information`.

## Functions & cascades

Shared checks live **once** in `functions.tid` and are called as filter operators on their
input (`[<currentTiddler>dnd.dead[]]`). So they behave the same in ViewTemplates, cascades,
ClassFilters and graph templates - `currentTiddler` is something different in each (in
ClassFilters e.g. the filter tiddler; the story tiddler is `storyTiddler` there).

- **`dnd.visible`** - player lock: yields a result if the tiddler is visible for the logged-in
  player (`$:/state/dndwiki/player`). All ViewTemplates check
  `<%if [<currentTiddler>dnd.visible[]] %>`; the body is locked by `viewtemplates/body-filter`
  (`$:/tags/ViewTemplateBodyFilter`, empty `list-before` = first entry of the cascade), which
  assigns `templates/body-locked` to locked tiddlers. The map tabs of a location drop
  sub-tiddlers locked for the player, the event tabs (timeline and list) drop locked events. A change of the lock logic (e.g. login per player) happens
  only in the function.
- **`dnd.dead`** - deceased/destroyed: a dot in the `date` field, **events excluded** (there the
  dot separates several points in time). Used by `config/class-dead` (class `dnd-dead`,
  stylesheet `styles/dead`) and the graph templates; `deadlink.js` checks the same in JS.

More cascade entries instead of core overrides:

- `config/type-colour` (`$:/tags/TiddlerColourFilter`, after `color-field`): tiddlers without
  their own `color` inherit the colour of their type hub. `Campaign` counts last: a campaign
  event is always also an `Event` and keeps its colour, whatever the order of the tags.
- `config/class-pinned` (`$:/tags/ClassFilters/TiddlerTemplate`): class `dnd-pinned` for
  `$:/tags/Pinned`; `styles/pinned` hides the close button there.
- `config/class-readonly` (`$:/tags/ClassFilters/PageTemplate`): class `dnd-readonly` on the page
  container as soon as `$:/status/IsReadOnly` is `yes` - the CI of the wikis sets that only in the
  published copy. `styles/readonly` then hides edit/clone/delete/new-*/import/manager and the save
  button: the same list as `$:/plugins/tiddlywiki/tiddlyweb/readonly`, which is missing from the
  offline build. Check the list against that original when raising the engine version.
- `config/title-translated` (`$:/tags/ViewTemplateTitleFilter`, before `default`): tiddlers whose
  display name differs from the title get the heading `templates/title-translated`.

Palette colours in static CSS through the core variables `--tpc-<palette entry>` (since 5.4.0,
generated by `$:/core/stylesheets/custom-properties`; the release note wrongly says
`--tp-color-*`). Create such stylesheets as `type: text/css` - in wikitext `--` would become a
dash.

## Graph configuration - what lives where

tw5-graph separates configuration by scope; dndwiki-core follows that strictly and adds a
namespace of its own where tw5-graph has none:

- **Per edge type** (label, colour, stroke, arrows, curves, ...): one JSON tiddler per
  field/function under `$:/config/flibbles/graph/edges/fields/<field>` or `.../functions/<name>` -
  namespace given by tw5-graph, values from us. Resolved by `<$edges.typed>` automatically by
  name. Values are plain hex/literal values, no live binding to e.g. tag `color` fields (the JSON
  is read with `JSON.parse`, no wikitext context) - update by hand when the source changes. The
  JSON `label` is English and only used in the tw5-graph settings: **the visible edge label comes
  from `Field/<field>`**, set by the override of `$edges.typed` (see "Core overrides") - only for
  field types whose JSON has a label (`location` stays unlabelled). This covers the edges of our
  graph templates and those `$nodes.neighbors` creates in the ego graph. The
  type hub tiddlers themselves are shadow defaults in `dndwiki-core` (files without prefix in the
  plugin root, e.g. `Organisation.tid`), not in the campaign repo.
- **Global per object type** (node/edge/graph defaults such as physics): own namespace
  `$:/config/dndwiki/graph/<category>`. **No** automatic name match - every new default must be
  included explicitly with `<$properties $for=<type> $tiddler="..." />` in both graph templates.
- **Per view** (Cosmogram/WorldMap/Items/Live/...): override directly as a JSON field on the view
  tiddler (`edges.fields`, `edges.functions`, `graph.nodes`, `graph.edges`, `graph.graph`) -
  reserved names of tw5-graph, evaluated by its `$properties.settings` block (included by
  `dnd-graph.tid`). Only for views through `dnd-graph.tid`; `dnd-ego` has no per-view layer.
- **Override reach differs by object type**: `$for=nodes`/`$for=edges` cascade through the widget
  ancestry (closer to the object wins - an attribute on the `$edge` itself beats the edge type
  config). `$for=graph` (one graph object per `<$graph>`) instead searches the whole `<$graph>`
  subtree; on a collision whatever comes later wins. Put own `$for=graph` defaults early.
- **Gotcha:** JSON values in these config tiddlers must be **strings**, also for numbers
  (`"width": "3.5"`) - the extraction checks `typeof datum === "string"` and silently drops
  anything else. An empty string (`""`) also counts as "not set" and is ignored.

## `staticfiles` - implementation

`module-type: route` module (field `platform: server`) that serves the folders `images/` and
`data/` under `/images/...` and `/data/...` in the `--listen` Node server - the standard server
only serves `/files/`. The handler follows the core route `get-file` (5.4): streamed, with HTTP
range (206/416) and `Content-Length`; the traversal guard checks against the respective subfolder,
not only the wiki folder. Reusing the core handler directly is not possible because it has the
folder `files/` hard-wired - follow changes to `get-file.js` in the core here. Through
`platform: server`, TiddlyWiki's offline save filter **excludes the plugin from the build**: the
built/deployed page is unchanged (there `images/` lies next to `index.html` anyway). Dev aid only.

## Core overrides - list & update procedure

Some plugin tiddlers **override** a TiddlyWiki core shadow (1:1 copy of the core original +
targeted change), because there is no hook/extension point for it. That is deliberately the
**last resort** - always check first whether an official extension point is enough: cascades
(`$:/tags/ViewTemplateBodyFilter`, `$:/tags/ViewTemplateTitleFilter`,
`$:/tags/TiddlerColourFilter`, ...), `$:/tags/ClassFilters/TiddlerTemplate` plus CSS,
hooks such as `th-saving-tiddler`, tags such as `$:/tags/AboveStory`.

Current list:

| File | Overrides | Plugin | Why no hook is enough |
|---|---|---|---|
| `dndwiki-core/$__core_ui_PageTemplate_story.tid` | `$:/core/ui/PageTemplate/story` | `dndwiki-core` | `handleCloseAllTiddlersEvent` in core JS (`navigator.js`) empties `$:/StoryList` without a hook. The only way the `Campaign` hub (tag `$:/tags/Pinned`) survives it: the story river filter itself shows it independently of `$:/StoryList`. |
| `dndwiki-core/$__core_macros_tag.tid` | `$:/core/macros/tag` | `dndwiki-core` | The tag pill text is a hard-wired `$view field="title"` in `tag-pill-inner`; no cascade covers it. Only change: `<$text text={{{ [<__tag__>dndtitle[]] }}}/>` for the translated display name. |
| `dndwiki-core/$__core_ui_DefaultSearchResultList.tid` | `$:/core/ui/DefaultSearchResultList` | `dndwiki-core` | A second list tagged `$:/tags/SearchResults` would add a second tab with the same caption ("List"/"Liste") next to the core one, which cannot be hidden. Changes: the first filter also matches hubs by their translated name (`dndtitlesearch`), hits use `search/item` (translated name). |
| `dndwiki-core/$__plugins_flibbles_graph_macros_edges.typed.tid` | `$:/plugins/flibbles/graph/macros/edges.typed` (tw5-graph) | `dndwiki-core` | Edge labels come from the JSON edge type config, read by `$properties $tiddler=...` inside `$edges.typed` - nearest wins, so nothing outside can translate them, and `$nodes.neighbors` creates its edges through its own call. Only change: one inner `$properties $for=edges label=...` with the translation of `Field/<field>` (only for types whose JSON has a label). Needs `"plugin-priority": "2"` in `plugin.info`: with equal priority the plugin `flibbles/graph` would win (titles sorted alphabetically). |

**Naming convention:** files that override a core title are named
`$__core_<path>_<name>.tid` (dots/slashes in the title -> underscores) - signals "this file
overrides core" at first sight, regardless of the plugin folder.

**Procedure on every raise of the `tiddlywiki` engine version** (in `package.json` here, later
also in the wikis when they raise their own `tiddlywiki` version):

1. `npm install` (fetch the new engine).
2. For every row of the table above: diff the overriding file against the new original in
   `node_modules/tiddlywiki/core/...` (`ui/PageTemplate/story.tid`, `wiki/macros/tag.tid`,
   `ui/DefaultSearchResultList.tid`). Also
   compare the button list in `styles/readonly.tid` with
   `node_modules/tiddlywiki/plugins/tiddlywiki/tiddlyweb/readonly-styles.tid`. The tw5-graph
   override (`edges.typed`) is checked against `node_modules/tw5-graph/plugins/graph/macros/`
   whenever the tw5-graph pin is raised.
3. On differences: check whether the own change still fits (take it over, verify again in a wiki)
   or whether the core change brings a hook that makes the override unnecessary.
4. Update this table if needed.
5. `npm test`.

(Same diff procedure as the template update for `DnDWiki`, see "Versioning -> Template update" in
its `CLAUDE.md`.)

## Publishing a new version

1. Change the format -> raise `version` in `plugins/dndwiki-core/plugin.info` **and**
   `plugins/dndwiki-forgottenrealms/plugin.info` (same version; semver: patch=fix, minor=new
   features, major=breaking change).
2. Raise `version` in `package.json` to the same value.
3. Run `npm install` -> brings `package-lock.json` to the same version. Do not skip it: otherwise
   the lockfile version drifts permanently.
4. Pin example in `README.md` ("Using it in TiddlyWiki") to the new version.
5. `npm run smoke`, `npm test`, `npm run check-lang`.
6. Commit, then **tag == version** and create the release:
   ```bash
   git tag 2.0.0 && git push origin master 2.0.0
   gh release create 2.0.0 --generate-notes
   ```
   Breaking format changes (e.g. renamed relation fields) belong in the release notes explicitly -
   consumer wikis otherwise silently lose graph edges. A new language belongs there too (the wikis
   list the supported languages in their README).
7. Consumers (DnDWiki repo family) raise their pin themselves (`#1.4.1` -> `#2.0.0`), run
   `npm install` and bump their own `package.json` `version`.
