# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Plugin bundle for the `TiddlyRPG` repo family. Contents and how wikis use it: see `README.md`.

## Documentation - who covers what

- **CLAUDE.md** (here): development support - rules, conventions, editing and release workflow.
- **README.md**: what the project is and how it is used in `TiddlyRPG` and other wikis, including
  languages and calendar.

Sort new content accordingly instead of duplicating it. (Same split in the wiki repos,
maintained canonically in `TiddlyRPG`.)

## Visibility - check with every change

Whatever the plugin shows must leave out what the active view does not see (rule and tools:
"Views", "Sections"). Every plan and every change that adds or changes output answers these
questions, before it is built:

1. **What does it show?** Titles, text, dates, names of spots, tooltips (`title` attributes,
   node tooltips), pills, edges, counts, colours, order.
2. **Where does it come from?** A field, a tag, the body, another tiddler, an index of the core.
   Titles go through `trpg.visible` (wikitext: `:filter[trpg.visible[]]`; JS:
   `visibility.visible`). The link and tag indexes of the core (`links[]`, `backlinks[]`,
   `tagging[]`, `listed[]`) know no lock in the text: `visiblelinks`, `sectionbacklinks`, the
   sections model. Text from a body only through `trpg-body` or the sections model, never as raw
   text or a cut-out substring. JS that depends on the view refreshes on `visibility.watched`.
3. **What does the rest tell when an entry is left out?** A path above it, a parent, the span of
   a date line, an edge between two visible nodes, a count, a position on a map. Leave out the
   whole unit (the line, the section, the edge), not only the step that is locked.
4. **Tests:** a test for the new output in the public view and in the view of the DM; the sweep
   in `test/views.test.js` renders everything a reader can reach and looks for the word `Qx7` of
   its fixtures. New output outside the view template, the search and the sidebar goes into the
   sweep; a new kind of secret (a new section kind, a new field pointing to a tiddler) gets a
   fixture there. The sweep finds names, not what the rest tells (question 3).

Lock only with `Secret`, `<<secret>>` and `<$secret>`. Asking the view itself (`trpgview`,
`$:/state/tiddlyrpg/view`) is for the frame of the page only: the page control, the page class,
the sidebar.

## Editing the format layer

`tiddlyrpg-core` and `staticfiles` are **folder plugins** under `plugins/` (no build step - the
folder *is* the plugin, edit the tiddlers there directly). Content for D&D 5e and the Forgotten
Realms (setting and ruleset plugins) lives in the repo `TiddlyRPG-DnD`; it uses only what core
offers. The tests here need none of it: they use fixture plugins (`test/fixtures/plugins`).

```bash
npm install
npm run smoke       # boot/load check with all plugins and de-DE (no wiki checkout needed)
npm test            # all tests in test/
npm run test-lang   # only test/lang/: language packs and translation mechanics
```

- `npm run smoke` boots the minimal edition `editions/smoke` (only `tiddlywiki.info` with the
  plugin list and `"languages": ["de-DE"]`, **no content**) and aborts on module/load errors.
  A plugin from the list that is not found is only a warning (`Cannot find plugin`) and the
  boot exits 0 - locally read the output; the CI step fails on it. JS modules only run when
  used, so this does not replace the tests.
- `npm test` runs `test/**/*.test.js` with Node's built-in test runner (`node:test`); every file
  runs in its own process. `test/helpers.js` boots the test edition `editions/test` in-process
  (the plugins of the smoke edition plus the fixture plugins of `test/fixtures/plugins`, e.g.
  `fixture-setting-harptos` with a calendar in the style of Harptos), adds the fixture
  tiddlers and offers `render`/`view`/`body`/`filter`, and `graph` (see below). One file per topic:
  - `calendar-engine` - the engine against the former hard-wired Harptos arithmetic and an own
    leap rule
  - `dates` - syntax of the date field, `dateformat`/`dateadd`/`datediff`/`dateended`/
    `datecheck` in de-DE and en-GB, and without a calendar; `datesection`
  - `sections` - event head, dated sections `<<date>>` (counting, captions, rule, hints),
    locations per section, subtitle without modifier, event table (rows and title cells),
    jump marks and the wrapper `trpg-jump`
  - `migrate` - `scripts/migrate-dates.js` and `scripts/check-wiki.js` against fixtures in a
    temp folder
  - `location` - parents and places within (`filters/location.js`), occupants (items too), the
    checks of `locationcheck` (artifacts too), the path below the title, the relation list of a
    location, the events of the places within, map tabs (map and battle maps, labels and order),
    map buttons, event history, the lock, person view
  - `views` - the rule of `trpg.visible` in every view (public, a player, the DM; active and
    former characters), the default view, the choices, campaign events through player
    characters, the page control, the page class, the marker of a secret, the `Player` hub, and
    every place that lists titles (hubs, search, tag pills, sidebar, relation list, graphs,
    open items), a secret presence; the sweep (see "Visibility - check with every change").
    `h.setView`/`h.inView` set the view; without them the tests run in the view of the DM (no
    `$:/status/IsReadOnly`)
  - `items` - base type and categories (`filters/item.js`), the hints of `itemcheck`, the hub
    lists of `Item` and of a category, a category of the campaign, the file of a book (field
    `data`), colour and image folder through the base type
  - `spots` - spots of a location (`modules/spots.js`): plain names with links, joined
    tiddlers, the body without the spots, the text of a spot for the tooltip, headings and jump
    marks in the map tab, spots in notes of the DM; `<<spotlink>>`: link, pill, missing spot or
    location, the events referencing a place
  - `text-sections` - the sections of a body (`modules/sections.js`, `widgets/sections.js`):
    short and block forms, numbering over both, nesting (with a kind registered in the test),
    the hints; locks in the text (`<<secret>>`, `<$secret>`) and what they hide: body, table,
    timeline, span, pills, `datesection`, spots and map tab, search, backlinks
  - `timeline` - cards, bars, beams, order, details, sections (only spans are bars), arrows,
    the band of the tiddler itself, the section lines as links
  - `hubs` - hub and index tiddlers, type colours, no leaked pragmas or `<<trpg.`
  - `relations` - the relation filters (`filters/relations.js`: targets, the way back,
    label), the relation list forward and back, included types, symmetric types, family,
    who leads a location as present there
  - `graph` - through the nodes and edges of the real templates (`h.graph`): the
    `edges.typed` override (`tiddlyrpg-exclude`, symmetric edges, style from the edge type
    config and its axis, included types, every type its own edge, the types of a view), the function edges `rules`, `spots` and `links`, the ego graph (type colours, the dead, a location as centre,
    folding), the map (pins, spots, positions, editing, hidden nodes, image and fit), the view
    template `trpg-graph`; the map view outside `$:/graph/`, the fit of the map image
    (`graph/map-fit.js`, with a mock of vis-network), the pins of the map (`graph/map-pin.js`)
  - `plugin-types` - the plugin types `ruleset` and `setting` against the fixture plugins: the
    active plugin unpacked, the other not, the default without config (none created), switching
    and `none` at runtime (the switch is asynchronous, the tests wait), the shadow tiddlers
    reported as changed, a config naming a missing, disabled or foreign plugin, the tabs under
    ControlPanel -> Plugins
  - `plugin-versions` - the core version equals `package.json`; `tiddlyrpg-core-version` met,
    not met, wrong form
  - `check-wiki` - `scripts/check-wiki.js` beyond dates: the config of the plugin types, the
    core version a plugin needs, plugins from the packages in the wiki's `node_modules`
  - `naming` - no old prefix (`dndwiki`, `dnd-`, `dnd.`, `dnd` before a name) in the files
    or file names below `plugins/`; new names use `tiddlyrpg-`, `trpg-`, `trpg.`
  - `lang/packs` - every language complete against en-GB (keys only in `en-GB/names.multids`
    may be missing)
  - `lang/i18n` - display names, tag hook, search, edge labels of the real edges, refresh after
    a language change

  Language mechanics go to `lang/`; plain expected output in one language stays with its topic.
  New check -> the file of its topic; new topic -> new file. A test that changes the wiki
  restores it afterwards (the files do not share state, the tests within a file do).
  `h.graph(wiki, text, variables)` renders a graph without a browser: `<$graph>` (it needs a
  window) is replaced by a widget that only renders its children, and the node and edge widgets
  are collected by id as tw5-graph does - the last one wins, edges whose ends are no nodes are
  left out. It returns the raw properties of each object (type config, enclosing `$properties`,
  own attributes) and those of the graph, plus `refresh`. What vis-network draws from them -
  position, curves, tooltip - only shows in a browser. The timeline
  renders in Node; what depends on measured sizes - the placement of the vertical labels, the
  widening of a selected card, the lines to its points - only shows in a browser. Extend the
  tests with every change.
- CI (`.github/workflows/test.yml`) runs `npm run smoke` and `npm test` on every push and pull
  request.
- The launcher `scripts/tw.js` and the tests take `TIDDLYWIKI_PLUGIN_PATH` from
  `scripts/plugin-path.js`: `./plugins` plus the pinned `node_modules/tw5-*/plugins`, then
  the folders a caller adds (the tests `test/fixtures/plugins`, `check-wiki.js` the `plugins`
  folders of the packages of the checked wiki), then a `TIDDLYWIKI_PLUGIN_PATH` set before. A
  **content preview** deliberately does not exist here - use the IDE loop in a real wiki (below).

**Checking in a real wiki (IDE loop instead of WYSIWYG):** The format layer is edited here in
the IDE (versioned technical layer) and checked together with a real wiki - no saving back from
the browser. Point the plugin dependency of the wiki repo (`TiddlyRPG` or a campaign) **locally**
to this checkout instead of the release pin - with `npm link`:

```bash
# once in TiddlyRPG-Plugins:
npm link
# in the wiki repo (TiddlyRPG or a campaign):
npm link tiddlyrpg-plugins
```

This creates `node_modules/tiddlyrpg-plugins` as a symlink/junction to this checkout; the wiki
launcher then loads `plugins/*` **live**. Loop: change a tiddler in the IDE -> restart
`npm start` in the wiki -> change visible (folder plugins do not hot-reload). The link lives in
`node_modules` (gitignored) and `package.json` stays unchanged - as long as you only create the
link, there is nothing to commit.

**Two pitfalls when switching back to the release pin:**

- `npm unlink tiddlyrpg-plugins` is an alias for `npm uninstall` and **removes the dependency
  from `package.json`**. Put the pin back by hand afterwards (or run
  `npm install "git+https://github.com/WkoD/TiddlyRPG-Plugins.git#<version>"`). Check
  `git diff package.json` after switching back.
- With an active link, `npm install` writes `file:../TiddlyRPG-Plugins` into
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
the `de-DE` language packs and the expected output in `test/`.

## Contents (`$:/plugins/tiddlyrpg-core/...`) - inventory

So that it is clear what already exists before adding something. All format tiddlers live
plugin-scoped under `$:/plugins/tiddlyrpg-core/<category>/<name>` (files in subfolders of the same
name, `kebab-case`). Macros are called by their `exports.name` (e.g. `<<image>>`), independent of
the tiddler title:

- **Functions and procedures** (`functions`, tag `$:/tags/Global`): `trpg.visible`, `trpg.dead`
  (see "Functions & cascades"), `trpg.t`, `trpg.title`, `trpg.plural` (language system), the
  procedures `dateformat`, `dateadd`, `datediff` (calendar), `date` (dated section in a body,
  with `widgets/date.js`), `trpg.places` (location pills of a section, with the pills of
  `<<spotlink>>` via `trpg.spotpill`), `trpg.dateline` (date line below the tags: span of an
  event, years of existence of the other types), `trpg.datecheck` (hint on a date that cannot
  be read, not in the published copy), `spot` (heading of a spot with its jump mark),
  `spotlink` (reference to a spot, with `trpg.spotjump` and the hint `trpg.spotcheck`),
  `secret` (a lock, draws nothing itself, see "Sections") and `trpg.locationpath` (path of
  parent locations below the title, see "Locations").
- **Library modules** (`modules/*`): `language.js` (key lookup with fallback, display names,
  `$name$` patterns), `calendar.js` (calendar engine, see "Calendar engine"), `dates.js` (see
  "Dates": parser of the `date` field, calendar check, short form, the dated sections of a body
  from the model of `sections.js` - the one place of these rules, used by the date filters,
  `eventrows`, the timeline, `trpg-date` and `deadlink`), `sections.js` (see "Sections": the
  sections of a body, their kinds, locks and rendering), `spots.js` (see "Locations": spots and
  `<<spotlink>>` from the model of `sections.js`, plain names, the index of owners and
  references), `relations.js` (see "Relations": the relation types, their axes, what a type
  shows and draws, labels), `anchor-jump.js`
  (see "Jump marks"), `visibility.js` (see "Views": player characters, the active view, the
  lock, campaign events).
- **Widgets** (`widgets/*`): `trpg-timeline` (`timeline.js`, attributes `filter`, `self`):
  vertical, interactive timeline of the events, newest at the top, undated ones at the bottom as
  `????`. Positions from `calendar.dayNumber`, long gaps collapsed; an event with more than one
  point gets a lane (at most 5, more merge into one beam), in it only spans are bars, points are
  dots, the dashed track shows while highlighted; `..` ends in an arrow. Card: span and tag dots,
  then the title; tap/click selects (below the title the card shows the tags and one line per
  section with its caption, lines to each section; a section line opens the event at that
  section). `self`: the own dates of that tiddler as a band behind the
  lanes. Campaign events (a player character tagged) solid, other events dashed. Details in
  the module header.
  `trpg-date` (`date.js`): finds which section a `<<date>>` placeholder stands for, by the
  position of the call in the parse tree.
  `trpg-jump` (`jump.js`, attributes `anchor`, `tabstate`, `tab`): wrapper around ordinary
  links that jumps to a mark in the opened tiddler, selecting a tab first if given (see "Jump
  marks"). `action-trpg-jump` (`action-jump.js`): the same as an action, for the spot dots of a
  map; scrolls at once if the tiddler already shows the mark.
  `sections.js`: `trpg-body` (the transclude widget with the parse tree prepared section by
  section; `$only`, `$omit`, `$name`, `$marker`), `trpg-section` (one short section, made by
  `trpg-body`) and the block forms `date`, `spot`, `secret` - see "Sections".
- **Macros** (`macros/*`): `image` (resolves the `image` field against `images/<folder>/`, folder
  from the type tag, several images comma separated; battle maps as a link to the file),
  `subtiddler` (renders `<title>/<sub>` sub-tiddlers), `deadlink`.
- **Filters** (`filters/*`): `eventrows` (event table, the "List" tab: one row per point in time, an event in one title cell across its rows, the title jumps to its earliest section), `multitag`
  (input with at least one of the tags, grouped in tag order, no duplicates), `translate.js`
  (`trpgtranslate`, `trpgtitle`, `trpgtitlesearch`), `date.js` (`dateformat`, `dateadd`, `datediff`,
  `dateended`, `datecheck`, `sectionlinks`, `sectionspots`, `datesection`, `visibledate`,
  `calendar[...]`), `sections.js` (`hassections`, `sectioncheck`, `sectionbacklinks`,
  `visiblelinks`, `trpgsearch`),
  `location.js` (`locationparent`, `locationpath`, `sublocations`, `occupants`,
  `locationcheck`), `item.js` (`itemcheck`, see "Items"), `spots.js` (`spots`, `spottargets`, `spotplain`,
  `spotanchor`, `spottarget`, `spotref`, `spotowner`, `spotlinked`, `maptabs`),
  `relations.js` (`relationtargets`, `relationsources`, `relationlabel`, `relationaxis`,
  `relationsymmetric`, `relationtypes`, see "Relations"),
  `visibility.js` (`trpgvisible`, `trpgview`, `trpgcharacter`, `trpgcharacters`, `trpgplayer`,
  `trpgplayedby`, see "Views").
- **Page parts** (`ui/*`): `view-switcher` (page control "View", `$:/tags/PageControls`),
  `sidebar` (the sidebar tabs per view, `$:/tags/SideBarSegment`) and `sidebar-recent` (its
  tab "Recent"), see "Views".
- **Startup** (`startup/tag-names.js`): hook `th-saving-tiddler`, stores translated tag names
  ("Ort") under the internal name (`Location`). `startup/plugin-types.js`: the switchers of the
  plugin types `ruleset` and `setting` (see "Plugin types ruleset and setting").
- **Plugin types** (`modules/plugin-types.js`, `filters/plugin-types.js`: `trpgplugins`,
  `trpgplugin`), the tabs `ui/controlpanel-rulesets` and `ui/controlpanel-settings` under
  ControlPanel -> Plugins.
- **ViewTemplates** (`viewtemplates/*`): `activity`, `image`, `event`, `event-list` (tab list
  "Timeline"/"List" in `event-list/tabs`, also used by the `Event` hub; the caller sets the filter
  variable `trpg-events`; for a location the events of all places within and the `<<spotlink>>`
  references; contents `event-list/timeline` + `event-list/list`), `item`, `link`,
  `location` (map block: tab "Map" if there is a map image, a spot or a place within, with
  `location/map` - map graph, buttons, spots -, one tab
  per battle map with `location/battlemap`; tab state per location, see "Locations"),
  `location-path` (path below the title, with the hints of `locationcheck` and `itemcheck`),
  `book` (the file of a book, field `data`, below the body), `relations` (tab list "Graph"/"List" via
  `$:/plugins/flibbles/graph/ui/grouped-tabs`, tab contents `relations/graph` + `relations/list`;
  one type scope filter for both tabs), `secret` (marker of a secret: whom it is for), `player`
  (the field `player` of any figure). Order via `list-after`/`list-before`. Plus `body-filter`
  and `body-filter-sections` (cascade, see below).
- **Snippets** (`snippets/*`, tag `$:/tags/TextEditor/Snippet`): `open-items`, `date-section`.
- **Styles** (`styles/*`): `border` (border per type, generated from the hubs), `item` (book
  rules, battle map width), `dead`, `pinned`, `readonly`, `timeline`, `event` (event head,
  dated sections, location pills), `location` (path, spot pills, spots, map buttons; static
  CSS, `type: text/css`) and `view` (bar of the view, page control, marker of a secret, cards
  of the `Player` hub; wikitext for the colour of `Player`).
  **Templates** `templates/image`, `templates/body-locked`, `templates/body-sections` (body of
  a tiddler with sections through `trpg-body`; a location without its spots),
  `templates/title-translated`,
  `templates/subtitle`, `templates/tags` and `templates/tag` (tag area and tag pill, see
  "Views").
- **Configuration** (`config/*`): `type-colour`, `class-dead`, `class-pinned`, `class-readonly`,
  `class-view`, `title-translated`, `subtitle`, `view-tags` - see below; `dm-published`
  (`$:/config/tiddlyrpg/view/dm-published`, default `no`) and `sidebar-tabs` (hides the core
  sidebar tabs, see "Views").
- **Search** (override of `$:/core/ui/DefaultSearchResultList` plus `search/item`): core search
  plus hubs whose translated name matches, hits shown with translated names.
- **Language packs** (`language/<code>/*.multids`): `titles` (`Title/<hub>`), `plurals`
  (`Plural/<hub>`), `fields` (`Field/<type>`, a relation in the relation list, forward),
  `fieldinverse` (`FieldInverse/<type>`, the way back), `edges` (`Edge/<type>`, edge label),
  `texts` (template texts).
- **Index/hub tiddlers** (Person, Location, Organisation, Deity, Player, Artifact, Item,
  Material, Book, Consumable, Equipment, Event, Campaign, Calendar, Information, Index, TBC,
  TBC/Campaign; titles without prefix, tag `Index`; the item categories also tagged
  `$:/tags/tiddlyrpg/ItemKind`, see "Items"): type tags carry the `color` field from which graph nodes,
  tiddler borders and tag pills take their colour; `caption` is `<<trpg.title ...>>`. The hub
  `Secret` (the tag of the lock) has neither tag `Index` nor `color`: it must not colour or frame
  what it locks.
- **tw5-graph schema + graph templates**: field edge types (`$:/config/flibbles/graph/edges/fields/*`)
  + relink field types; the function edge types `rules` (leader -> location, "controls"),
  `spots` (a spot that is a location -> the location it is part of, dashed) and a copy of
  `links` of tw5-graph (grey, symmetric); the axes
  `$:/config/tiddlyrpg/graph/axes[/<axis>]` (see "Relations"); relink of the macro parameters
  of `spot` and `spotlink`; the graph templates
  `$:/plugins/tiddlyrpg-core/graph/templates/trpg-graph` (type colours from the tag `color`,
  `shape=box`, no saved positions), `.../trpg-ego` and `.../trpg-map` (map of a location, see
  "Locations"); the views `$:/plugins/tiddlyrpg-core/graph/ego` and `.../graph/map` (outside
  `$:/graph/`, so not in the dropdown of the graph sidebar); the vis-network extensions
  `graph/map-fit.js` (`module-type: vis-property`, graph property `trpgMapFit`),
  `graph/map-pin.js` (`vis-property`, node property `trpgPin`),
  `graph/ego-toggle.js` (`vis-property`, node property `trpgToggle`: fold and unfold a place in
  the ego graph of a location with a single click) and
  `graph/map-fit-message.js` (`vis-message`, `trpg-map-fit`). The thin view definitions
  (`$:/graph/Default`/`Cosmogram`/`Atlas`/`Items`) live in each wiki on purpose, not here.

The fixture plugin `fixture-setting-harptos` (`test/fixtures/plugins`) contains no code:
`$:/tiddlyrpg/calendar/Harptos` (data), `$:/config/tiddlyrpg/calendar` (activates it) and
`language/<code>/` with `Calendar/Harptos/...` - a copy of the data of
`tiddlyrpg-setting-forgottenrealms` in the repo `TiddlyRPG-DnD`, so the engine tests need no
other repo.

## Plugin types ruleset and setting

Data plugins of other repos (`TiddlyRPG-DnD`) are a `ruleset` (rules system) or a `setting`
(campaign setting: calendar, later currency). Of each type one is active, chosen in
`$:/config/tiddlyrpg/ruleset` and `.../setting`; the rule lives **once** in
`modules/plugin-types.js` (`state()`):

- `none`: none. A config naming an installed, not disabled plugin of the type: that one.
  Otherwise the first installed one by title; a config naming something else is a problem
  (`missing`, `disabled`, `type`), reported by `check-wiki.js`. No config is written until the DM
  switches.
- `startup/plugin-types.js` subclasses `$tw.PluginSwitcher` (required directly: startup modules
  load before `load-modules` sets the globals). The core switcher would read `none` as "not
  found" and take its fixed defaults. The subclass also switches when a plugin of the type or
  its `$:/config/Plugins/Disabled/...` changes, and queues change events for the shadow tiddlers
  that come and go, like `$:/core/modules/startup/plugins.js` - without them nothing that shows
  them refreshes. Change events are dispatched asynchronously: a switch takes effect after the
  dispatch, tests wait for it.
- Data plugins name the core version they need: `"tiddlyrpg-core-version": ">=x.y.z"` in
  `plugin.info`, only this form (`$tw.utils.checkVersions` reads plain `x.y.z`, so `>=` is cut
  off first). `versionProblems()` lists what is not met; `check-wiki.js` reports it.
- They declare `"dependents": ["$:/plugins/tiddlyrpg-core"]`; `registerPluginTiddlers` takes
  only plugins of the type, so the core is not registered twice.

## Language system

- Keys are tiddlers `$:/tiddlyrpg/language/<code>/<key>`, delivered as `.multids` (one line per
  key) or `.tid` (multi-line texts such as `Calendar/Harptos/Description`). en-GB is the base;
  every other language has the same keys. Keys only in `en-GB/names.multids` are proper names that
  may fall back on purpose (`test/lang/packs.test.js` does not report them).
- Lookup in `modules/language.js`: active language (`$:/language`) -> en-GB -> null. The
  wikitext functions `trpg.t`, `trpg.title`, `trpg.plural` wrap the filter operators, so the fallback
  rule exists only once. **Functions with parameters take their argument from the operand, not
  from the input:** in filters use the operators directly (`[<title>trpgtitle[]]`,
  `[<type>addprefix[Plural/]trpgtranslate[]]`), in wikitext the functions as macros
  (`<<trpg.t Event/Year>>` - plain text, wrapped in `<p>` in block mode).
- Display names of titles: `Title/<title>`; a sub-tiddler `<parent>/<leaf>` whose parent exists
  shows the translated leaf (`Insel Avalon/Map` -> "Insel Avalon/Karte"). Used by the title
  cascade (`config/title-translated`), the tag pill override, the search and the hub lists.
- **Texts that need refreshing go through filtered attributes, not JS macros.** A JS macro call
  only re-renders when its parameters change; a filtered attribute is recomputed on every
  refresh. That is why the date output is filter operators plus procedures
  (`<$text text={{{ [<date>dateformat:era[]] }}}/>`).
- Places that show `caption` only as plain text (`$view`) cannot be translated: the graph
  settings of tw5-graph (template and view captions). Graph view captions belong to the wiki.
- Known limits: the tag dropdown does not suggest "Ort" (filter hard-wired in
  `$:/core/macros/tag-picker`); sidebar "Open" and link texts without alias show the English
  title; field names in edit mode stay English.

## Calendar engine

`modules/calendar.js` knows no particular calendar. `active(wiki)` reads the data tiddler named
in `$:/config/tiddlyrpg/calendar` (cached per tiddler via `getCacheForTiddler`), or returns null.
Data model and leap rule: see the module header and `README.md`. Day numbers are summed from the
data with a closed form for the leap years before a year (`floor((year-1-start)/every) -
floor((-1-start)/every)`); for Harptos this equals the former `year*365 + ceil(year/4)`, which
`npm test` checks over several leap cycles in both directions.

Without a calendar, `dateformat` shows the date as entered, `eventrows` the raw month/day
numbers, `dateadd`/`datediff` return nothing, `datecheck` only checks the syntax and the
`Calendar` hub is hidden from `Information`.

## Dates

`modules/dates.js` holds the rules of the `date` field and of the dated sections - nothing else
splits a date. Syntax and meaning: module header and `README.md` ("Dates"). Points to keep in
mind when changing it:

- `parse()` results are cached per string and shared; callers must not change them. `trpg.dead`
  runs through ClassFilters and graph templates for every visible tiddler on every refresh.
- A single point means a point in time for events and a start with an open end for every other
  type; the timeline band and `trpg.dead` rely on that.
- `sections()` takes the dated sections, the links and the `<<spotlink>>` calls of each from
  the model of the body (`modules/sections.js`, see "Sections"; cached per tiddler); a link
  keeps the id of its innermost section, so `sectionlinks`/`sectionspots` leave out what the
  view does not see. `hidden()` gives the numbers of the dated sections the view does not see,
  `visibleField()` the date field without them - the timeline, the table, `datesection` and the
  date line (`visibledate`) use them.
- `widgets/date.js` matches its own call by `start` and `end` of the transclude node of
  `<<date>>`; the heading of a block `<$date>` carries the position of the block. Called from
  another text (a transcluded snippet) there is no match: then only an explicit number works,
  otherwise a visible hint. The edit preview works because the draft has the same text and
  date.
- `sectionAt()` (operator `datesection`) finds the section a date falls into by overlap of
  their days: of several the narrowest wins, on a tie the first; "."/".." are open sides. It
  never falls back to "the section before" - a jump to the whole event is better than one to
  the wrong section.
- `scripts/migrate-dates.js` converts the 1.x notation (dots), `scripts/check-wiki.js` checks a
  wiki (boots it with the plugins of this repo and of the packages in its `node_modules`, so its
  calendar applies). Both are tested in
  `test/migrate.test.js`.

## Jump marks

TiddlyWiki has no anchors inside a tiddler: a link opens the tiddler, and a `tm-scroll` sent
from wikitext right after `$action-navigate` comes before the refresh that shows it. So:

- A **jump mark** is any element with `data-trpg-anchor="<name>"` inside a tiddler, name in
  kebab-case. The section headings of the procedure `date` carry one (`date-<n>`) - not a
  section at the very start of the body, where a jump would only hide the title - and the
  headings of spots (`spot-<plain name>`, `spots.anchor()`).
- `<$trpg-jump anchor="...">` (`widgets/jump.js`) wraps ordinary links. It sees their
  `tm-navigate` on its way to the navigator, passes it on unchanged and calls
  `modules/anchor-jump.js`, which waits for the next change event (the main refresh runs before)
  plus one frame, finds the mark in the frame of the tiddler in the story river and sends
  `tm-scroll`. No mark: nothing more happens. Ctrl/Cmd or middle click: no jump. The timeline
  calls the module directly.
- No link syntax (`[[Title#2]]`): to TiddlyWiki that is a link to a missing tiddler, invisible to
  backlinks, `sectionlinks` and Relink, and stored numbers shift when a section is inserted.
  Callers compute the mark when rendering (`eventrows`, the timeline, `datesection`).
- A new mark: set the attribute in the template that draws the target, test it in the topic of
  that template. A mark inside a tab of `grouped-tabs` only exists while that tab is active:
  the jump sets the tab state first (`trpg-jump` attributes `tabstate`/`tab`). That needs an
  `explicitState` the caller can compute - the map tabs of a location use
  `$:/state/tiddlyrpg-core/location-tab/<title>`.
- `action-trpg-jump` serves places without a link (a node of a graph). tw5-graph hands a node
  event to every enclosing `$properties` too, so an enclosing default action (open the node)
  must leave out nodes that are no tiddlers.
- `anchor-jump.js` stays thin on purpose: should the core navigation learn anchors (PR #7744,
  `[[Title^id]]`, or a successor), only this module is replaced.

## Locations

The rules of locations live **once** in `filters/location.js` and `modules/spots.js`; templates
only call their operators.

- A location lies in another one in two ways: its field `location` ("liegt in", first entry),
  or as a spot of the other one joined to it ("Teil von": `<<spot "Tavern">>` in Baile and a
  tiddler "Tavern" tagged `Location`). The spot wins. Only tiddlers tagged `Location` count as
  parents; a cycle stops the path at the first repetition.
- Occupants (`occupants`) are persons, players, organisations, deities and items whose
  `location` points to the location or, through spots only, to a part of it. Organisations,
  items and materials may have several locations; persons one, artifacts one owner or one
  location (`locationcheck` reports more, or both). Items are occupants like everyone else:
  in the tree of the relation list and for the folding in the ego graph.
- Secret presence: an entry of `location` that points to a `Secret` location is missing in the
  views that do not see it - its whole line of `trpg.locationpath` (the path above it would tell
  where it lies), and the occupant among the places above, since the walk of `occupants` only
  goes through spots and the lists filter with `trpg.visible`. A locked spot joined to a location
  hides only where it lies (`spots.ownsVisibly`: no parent, not among the children). Test:
  `views.test.js` ("secret presence").
- Spots: `<<spot "Name">>` begins a section that runs to the next marker, `<$spot name="…">`
  is the block form (see "Sections"). The name may hold wikitext; its plain text (links
  replaced by their visible text) is the anchor, the node label and the target of
  `<<spotlink>>`. Joined to a tiddler: the second parameter, or a tiddler with the plain name.
  `<<spotlink "Place" "[[Text|Spot]]">>`: here the target of the link counts. Both come from
  the model of the body. They are no TiddlyWiki links: no backlinks, not in "Missing"; renaming
  works through the relink configuration of the macro parameters.
- A spot the view does not see (locked, or joined to a tiddler it does not see) is left out by
  `spots.visibleSpots()`: the operators `spots`, `spottargets`, `maptabs`, the children and the
  parent of a location (`filters/location.js`), `spotowner` and `spotlinked`.
- `spots.index()` (global cache, whatever the view): which locations have a tiddler as spot
  (`spotowner`), which tiddlers reference a place with `<<spotlink>>` (`spotlinked`, used by the
  event list); the operators filter it by the view.
- The body of a location shows its text without the spots (`templates/body-sections`,
  `$omit="spot"`); the spots show in the tab "Map" below the map graph (`trpg-body`
  `$only="spot"`), the text of one in the tooltip of its dot (`$name`, `$marker="no"`).
- Map (`graph/templates/trpg-map`): background `images/map/<field map>`, drawn by
  `graph/map-fit.js` always 600 units wide (graph property `trpgMapImage`, not the `background`
  of tw5-vis-network, which draws in image pixels and shrinks nodes and labels on a large
  image); without the field an empty canvas. Fixed nodes are the places lying in the location
  (all depths, not the location itself) and its spots (a spot without tiddler is a node
  `<location>#<plain name>`); only places, no occupants. Each node is a pin
  (`graph/map-pin.js`, vis-network `custom` shape): a dot at the position and the name in a
  pill below it, filled for a tiddler, white and dashed for a spot; drawn at the same size on
  screen whatever the zoom.
  Positions: field `map-positions` of the location, JSON `{"<node id>": "x,y"}` in these map
  units with the origin in the middle, written by the `free` action while
  `$:/state/tiddlyrpg-core/map-edit/<title>` is `yes` (never in the published copy); a node
  without one gets a slot in a grid (node property `trpgUnplaced`). No edges on the map. The fit
  takes the image plus every node outside it, so a pin placed beside or below the image stays
  visible. Buttons:
  "Fit map", "Hide nodes" (`$:/state/tiddlyrpg-core/map-nodes/<title>` = `hide`, only the image),
  "Edit positions" (off while the nodes are hidden).
  `$properties.persistent` of tw5-graph cannot be used: it writes by `$index` and would turn
  the wikitext body into JSON. `graph/map-fit.js` (`trpgMapFit` = `image` or `nodes`) fits the
  image to the width and sizes the container by its aspect ratio, or without an image fits the
  view to the nodes (height from the stylesheet); in both cases it switches off the improved
  layout of vis-network (it would shift placed nodes). The tab renders the graph only in a
  browser (`$:/info/browser`): the tests check the tab through its buttons and spot texts, and
  the map itself through `h.graph`.
- Leading a location: `leader` pointing to a `Location` is drawn by the function edge `rules`,
  not by the field edge `leader` (its config has `tiddlyrpg-exclude: [tag[Location]]`, applied by
  `modules/relations.js`). Who leads a location is present there: `occupants` reads `leader`
  like `location`, the tree of the relation list marks them ("kontrolliert"); `rules` includes
  `location` (see "Relations"), and `locationcheck` hints at a `location` to a place the field
  `leader` already holds (`Location/Check/LedAndLocation`). The relation list shows the places
  led as the group "Controls".

## Items

The rules of items live **once** in `filters/item.js` (base type and categories) and
`filters/location.js` (owner and location of an artifact). Meaning and examples: `README.md`
("Items").

- Base types `Artifact` (unique), `Item` (several), `Material`; one per item. Everything that
  tells the item types apart (colour in the graph templates, `multitag` lists of `activity` and
  `relations`, the image folder in `macros/image.js`) names only these three - a category never
  stands alone.
- Categories are hubs tagged `$:/tags/tiddlyrpg/ItemKind` (`Book`, `Consumable`, `Equipment` from
  here, more from a campaign). They need no code: the hub `Item` reads them from the tag, and
  a category hub is `{{ || Item }}`, which then lists only its own items. Behaviour of one
  category hangs on its tag (`viewtemplates/book`, `styles/item`).
- The hints of `itemcheck` stand below the title (`viewtemplates/location-path`), next to
  those of `locationcheck`.

## Relations

The rules of the relation types live **once** in `modules/relations.js`; the override of
`$edges.typed` and the relation list only call `filters/relations.js`. Meaning and examples:
`README.md` ("Relations").

- A relation type is an edge type of tw5-graph, field or function, read from its config. The
  field lives on the dependent; the arrow points to what it depends on. A new type follows that
  rule.
- Axes: `$:/config/tiddlyrpg/graph/axes` (field `list`: the axes in order), each axis
  `.../axes/<axis>` an edge style (JSON) whose field `list` names its types in order. The order
  of all types (`relationtypes`) is axis by axis; types without an axis come last. Every type
  except `links`, `spots`, `transcludes` is on an axis (`graph.test.js` checks it).
- Included types (`tiddlyrpg-implies` on the config, every included type named, no chains:
  `leader: officer member`): where A -> B has both, the included one is neither drawn nor
  listed (`shown()`, `sources()`).
- Every type draws its own edges; two types between the same tiddlers are two edges (decided
  2026-10-08 against merging them into one labelled edge).
- The types in play: a graph view draws only some types (`edges.fields`/`edges.functions`);
  the override passes them on (`trpgTypes`), so a type left out does not hide another one. The
  relation list uses all.
- Function types run their filter in `targets()` with the tiddler as input and
  `currentTiddler`, cached per change of the wiki; `$nodes.neighbors` of tw5-graph runs the
  same filters itself to find neighbours, so a function filter must not depend on other
  variables. The way back of a function type needs the field its candidates come from
  (`tiddlyrpg-via`, `rules`: `leader`).
- Relation list (`viewtemplates/relations/list`): per type in order a group forward
  (`Field/<type>`) and back (`FieldInverse/<type>`, falls back to `Field/<type>`), one group
  for a symmetric type; on a location the way back of `location` is the tree, `rules` has no
  way back there (the tree marks who leads).

## Sections

The rules of the sections of a body live **once** in `modules/sections.js`; meaning and
examples: `README.md` ("Sections in the text", "Secrets in the text").

- Kinds: `date`, `spot`, `secret`, each with a short form (`<<kind>>`, a transclude node with a
  position) and a block form (`<$kind>`, a JS widget of that name in `widgets/sections.js` - no
  core or plugin widget has these names; a wikitext `\widget` would need a dot). `register()`
  adds a kind (e.g. a quest): found, locked, nested and rendered without code of its own; the
  block widget is one `makeBlock()` line.
- One walk over the parse tree per tiddler (`read()`, cached) gives the records (kind, form,
  key = start offset of marker or block, parent, locks, text range), the links and `<<spotlink>>`
  calls with their innermost section, and the problems. `group()` splits one level into
  sections; the walk and the rendering (`transform()`) use the same function, so a rendered
  section finds its record by key. Pragma nodes at the start (`set`, `importvariables`,
  `parameters`) wrap all sections and are kept.
- Visibility is decided when asked (`visible()`: the locks of a record and its parents, and the
  `visible` condition of its kind - a spot joined to a tiddler the view does not see), never
  cached. `lockOf()` gives whom a section's own lock is for (the marker).
- Rendering: `templates/body-sections` (chosen by `viewtemplates/body-filter-sections` for
  every tiddler with sections, `hassections`) renders the body through `trpg-body`, a subclass of
  the core transclude widget that only prepares the parse tree: each short section becomes a
  `trpg-section` widget, blocks render themselves. Both draw a `div.trpg-section
  .trpg-section-<kind>` (`.trpg-section-locked`, marker first) or nothing for a view that does
  not see them, and refresh on the view (`visibility.watched`). The heading of a block is a
  transclude of the procedure of its kind with the position of the block.
- Problems (`check()`, operator `sectioncheck`): below the title (`viewtemplates/location-path`)
  in the editable wiki and in `scripts/check-wiki.js`; none for editor snippets.
- Not seen: markers that only exist when rendering (transclusions, `$list`, macros that write
  `<<date>>`) - the walk reads the text of the tiddler itself.

## Views

The rules of who sees what live **once** in `modules/visibility.js`; meaning and examples:
`README.md` ("Player characters, views and secrets").

- Player characters: tag `Player` (active) or a field `player` (former, any type). The view is
  `$:/state/tiddlyrpg/view` (`public`, `player:<name>`, `dm`), not saved; empty: `dm` unless
  `$:/status/IsReadOnly` is `yes`, then `public`; `dm` in the read-only copy only with
  `$:/config/tiddlyrpg/view/dm-published` = `yes`. The choices (`trpgview:choices`) are the
  players of active characters.
- Lock: tag `Secret`, visible to the DM and to the players of the player characters tagged on
  it. A player character tagged without `Secret` means "took part" and makes an event a
  campaign event (`visibility.campaign`, used by `eventrows` and the timeline).
- Every place that lists titles filters with `:filter[trpg.visible[]]` (hubs, relation list,
  ego graph through `$whitelist` of `$nodes.neighbors`, `trpg-graph`, `trpg-map`, open items,
  search, event lists). A new list does the same. JS widgets that depend on the view refresh on
  `visibility.watched`. What comes from the link index of the core (`links[]`, `backlinks[]`)
  knows no lock in the text: use `visiblelinks` and `sectionbacklinks` instead (the edge type
  `links`, the event list).
- Tag pills and the sidebar without core overrides: the tag area comes from the cascade
  `$:/tags/ViewTemplateTagsFilter` (`config/view-tags` -> `templates/tags`, pills
  `templates/tag` = `$:/core/ui/TagTemplate` with `subFilter="trpg.visible[]"` for
  `list-tagged-draggable`); the core segment `$:/core/ui/SideBarSegments/tabs` is hidden by its
  visibility config (`config/sidebar-tabs`), `ui/sidebar` shows it in the view of the DM and
  otherwise only "Open" and `ui/sidebar-recent`. Check both copies against
  `$:/core/ui/TagTemplate` and `$:/core/ui/SideBarSegments/tabs` when raising the engine
  version.
- `filters/location.js` compares the audience of a location and its parent
  (`visibility.audience`) for the hint `LockedParent`.

## Functions & cascades

Shared checks live **once** in `functions.tid` and are called as filter operators on their
input (`[<currentTiddler>trpg.dead[]]`). So they behave the same in ViewTemplates, cascades,
ClassFilters and graph templates - `currentTiddler` is something different in each (in
ClassFilters e.g. the filter tiddler; the story tiddler is `storyTiddler` there).

- **`trpg.visible`** - the lock: the input titles the active view sees (operator `trpgvisible`,
  rule in `modules/visibility.js`, see "Views"). All ViewTemplates check
  `<%if [<currentTiddler>trpg.visible[]] %>`; lists filter with `:filter[trpg.visible[]]`. The
  body is locked by `viewtemplates/body-filter` (`$:/tags/ViewTemplateBodyFilter`, empty
  `list-before` = first entry of the cascade), which assigns `templates/body-locked` to
  tiddlers the view does not see. A change of the rule happens only in the module.
- **`trpg.dead`** - deceased/destroyed: the `date` field ends (last section a span whose end is
  not `..`, operator `dateended`), **events excluded**. Used by `config/class-dead` (class
  `trpg-dead`, stylesheet `styles/dead`), the graph templates and the atlas views of the
  wikis; `deadlink.js` reads the same rule from `modules/dates.js`.

More cascade entries instead of core overrides:

- `config/type-colour` (`$:/tags/TiddlerColourFilter`, after `color-field`): tiddlers without
  their own `color` inherit the colour of their type hub.
- `config/class-view` (`$:/tags/ClassFilters/PageTemplate`): class `trpg-view-<mode>` on the
  page container (`public`, `player`, `dm`); `styles/view` draws the bar of the view from it.
- `config/view-tags` (`$:/tags/ViewTemplateTagsFilter`, before the core default): the tag area
  `templates/tags`, see "Views".
- `config/class-pinned` (`$:/tags/ClassFilters/TiddlerTemplate`): class `trpg-pinned` for
  `$:/tags/Pinned`; `styles/pinned` hides the close button there.
- `config/class-readonly` (`$:/tags/ClassFilters/PageTemplate`): class `trpg-readonly` on the page
  container as soon as `$:/status/IsReadOnly` is `yes` - the CI of the wikis sets that only in the
  published copy. `styles/readonly` then hides edit/clone/delete/new-*/import/manager and the save
  button: the same list as `$:/plugins/tiddlywiki/tiddlyweb/readonly`, which is missing from the
  offline build. Check the list against that original when raising the engine version.
- `config/title-translated` (`$:/tags/ViewTemplateTitleFilter`, before `default`): tiddlers whose
  display name differs from the title get the heading `templates/title-translated`.
- `config/subtitle` (`$:/tags/ViewTemplateSubtitleFilter`, before `default`): every tiddler gets
  `templates/subtitle`, the core default without the modifier (always the same person here; git
  keeps the history). Other entries tagged `$:/tags/ViewTemplate/Subtitle` still show.

Palette colours in static CSS through the core variables `--tpc-<palette entry>` (since 5.4.0,
generated by `$:/core/stylesheets/custom-properties`; the release note wrongly says
`--tp-color-*`). Create such stylesheets as `type: text/css` - in wikitext `--` would become a
dash.

## Graph configuration - what lives where

tw5-graph separates configuration by scope; tiddlyrpg-core follows that strictly and adds a
namespace of its own where tw5-graph has none:

- **Per edge type** (label, colour, stroke, arrows, curves, ...): one JSON tiddler per
  field/function under `$:/config/flibbles/graph/edges/fields/<field>` or `.../functions/<name>` -
  namespace given by tw5-graph, values from us. Our own extra fields on a config (see
  "Relations"): `tiddlyrpg-exclude` (a filter of targets this type does not draw, see
  "Locations"), `tiddlyrpg-symmetric: yes` (`spouse`, `sibling`, `family`, `alliance`, `bond`,
  `enmity`, `links`: if both ends point to each other, the graph draws one edge with arrows on
  both ends, one end alone a plain arrow), `tiddlyrpg-implies` (types this one includes) and
  `tiddlyrpg-via` (function types: the field of the way back). Resolved by `<$edges.typed>`
  automatically by name. Values are plain hex/literal values, no live binding to e.g. tag
  `color` fields (the JSON is read with `JSON.parse`, no wikitext context) - update by hand when
  the source changes (the axis `place` has the colour of the hub `Location`). The JSON `label` is
  English and only used in the tw5-graph settings: **the visible edge label comes from
  `Edge/<type>`**, set by the override of `$edges.typed` (see "Core overrides") for every type
  the language has a key for (`spots` has none). This covers the edges of our graph templates
  and those `$nodes.neighbors` creates in the ego graph, for field and function types alike.
- **Per axis** (colour): `$:/config/tiddlyrpg/graph/axes/<axis>`, a JSON edge style like an edge
  type config; the override puts it outside the type config, so the type wins. The
  type hub tiddlers themselves are shadow defaults in `tiddlyrpg-core` (files without prefix in the
  plugin root, e.g. `Organisation.tid`), not in the campaign repo.
- **Global per object type** (node/edge/graph defaults such as physics): own namespace
  `$:/config/tiddlyrpg/graph/<category>`. **No** automatic name match - every new default must be
  included explicitly with `<$properties $for=<type> $tiddler="..." />` in both graph templates.
- **Per view** (Cosmogram/Atlas/Items/Live/...): override directly as a JSON field on the view
  tiddler (`edges.fields`, `edges.functions`, `graph.nodes`, `graph.edges`, `graph.graph`) -
  reserved names of tw5-graph, evaluated by its `$properties.settings` block (included by
  `trpg-graph.tid`). Only for views through `trpg-graph.tid`; `trpg-ego` has no per-view layer.
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
| `tiddlyrpg-core/$__core_ui_PageTemplate_story.tid` | `$:/core/ui/PageTemplate/story` | `tiddlyrpg-core` | `handleCloseAllTiddlersEvent` in core JS (`navigator.js`) empties `$:/StoryList` without a hook. The only way the `Campaign` hub (tag `$:/tags/Pinned`) survives it: the story river filter itself shows it independently of `$:/StoryList`. |
| `tiddlyrpg-core/$__core_macros_tag.tid` | `$:/core/macros/tag` | `tiddlyrpg-core` | The tag pill text is a hard-wired `$view field="title"` in `tag-pill-inner`; no cascade covers it. Only change: `<$text text={{{ [<__tag__>trpgtitle[]] }}}/>` for the translated display name. |
| `tiddlyrpg-core/$__core_ui_DefaultSearchResultList.tid` | `$:/core/ui/DefaultSearchResultList` | `tiddlyrpg-core` | A second list tagged `$:/tags/SearchResults` would add a second tab with the same caption ("List"/"Liste") next to the core one, which cannot be hidden. Changes: the first filter also matches hubs by their translated name (`trpgtitlesearch`) and keeps only what the view sees (`trpg.visible`), the second searches with `trpgsearch` (only the text the view sees), hits use `search/item` (translated name). |
| `tiddlyrpg-core/$__plugins_flibbles_graph_macros_edges.typed.tid` | `$:/plugins/flibbles/graph/macros/edges.typed` (tw5-graph) | `tiddlyrpg-core` | Edge labels come from the JSON edge type config, read by `$properties $tiddler=...` inside `$edges.typed` - nearest wins, so nothing outside can translate them, and `$nodes.neighbors` creates its edges through its own call. Changes (field and function branch alike): the targets come from `relationtargets` (`modules/relations.js`: `tiddlyrpg-exclude` and included types; function filters run there too), with the types of the call passed as `trpgTypes`; an outer `$properties $for=edges` with the style of the axis of the type; an inner `$properties $for=edges label=...` from `relationlabel` (`Edge/<type>`); for a type whose config has `tiddlyrpg-symmetric: yes`, an edge whose other end points back gets an id made of the ordered pair and the type - both ends give the same id, tw5-graph keeps one object per id - and `arrows="to from"`. Known limit: the merged edge of a symmetric type has either end as `from`, so an edge action that reads `fromTiddler` (the `delete` of `$editable`, unused here) would only touch one end. Needs `"plugin-priority": "2"` in `plugin.info`: with equal priority the plugin `flibbles/graph` would win (titles sorted alphabetically). |

| `tiddlyrpg-core/$__config_flibbles_graph_edges_functions_links.tid` | `$:/config/flibbles/graph/edges/functions/links` (tw5-graph) | `tiddlyrpg-core` | The edge type config of tw5-graph has no colour and no `tiddlyrpg-symmetric`; an edge type config is found by name only. Changes: `color` grey, `tiddlyrpg-symmetric: yes` (mutual links as one edge), filter `[visiblelinks[]]` instead of `[links[]]` (the core link index knows no lock: a link that stands only in a section the view does not see draws no edge, see "Sections"); label as in the original. |

**Naming convention:** files that override a core title are named
`$__core_<path>_<name>.tid` (dots/slashes in the title -> underscores) - signals "this file
overrides core" at first sight, regardless of the plugin folder.

**Procedure on every raise of the `tiddlywiki` engine version** (in `package.json` here, later
also in the wikis when they raise their own `tiddlywiki` version):

1. `npm install` (fetch the new engine).
2. For every row of the table above: diff the overriding file against the new original in
   `node_modules/tiddlywiki/core/...` (`ui/PageTemplate/story.tid`, `wiki/macros/tag.tid`,
   `ui/DefaultSearchResultList.tid`). Also compare `templates/tag.tid` with `ui/TagTemplate.tid`,
   `templates/tags.tid` with `ui/ViewTemplate/tags/default.tid` and `ui/sidebar.tid` with
   `ui/SideBarSegments/tabs.tid` (copies, no overrides), and
   compare the button list in `styles/readonly.tid` with
   `node_modules/tiddlywiki/plugins/tiddlywiki/tiddlyweb/readonly-styles.tid`. Compare
   `startup/plugin-types.js` with `core/modules/pluginswitcher.js` (the subclass replaces
   `switchPlugins`) and `core/modules/startup/plugins.js` (the change events). The tw5-graph
   override (`edges.typed`) is checked against `node_modules/tw5-graph/plugins/graph/macros/`
   and the copy of `links` against `.../graph/edges/functions/links.tid` whenever the tw5-graph
   pin is raised.
3. On differences: check whether the own change still fits (take it over, verify again in a wiki)
   or whether the core change brings a hook that makes the override unnecessary.
4. Update this table if needed.
5. Check whether the core navigation knows anchors by now (TiddlyWiki PR #7744 or a
   successor). If so, switch `modules/anchor-jump.js` to it or remove it (see "Jump marks").
6. `npm test`.

(Same diff procedure as the template update for `TiddlyRPG`, see "Versioning -> Template update" in
its `CLAUDE.md`.)

## Publishing a new version

1. Change the format -> raise `version` in `plugins/tiddlyrpg-core/plugin.info` (semver:
   patch=fix, minor=new features, major=breaking change). The plugins of `TiddlyRPG-DnD` have a
   version of their own.
2. Raise `version` in `package.json` to the same value.
3. Run `npm install` -> brings `package-lock.json` to the same version. Do not skip it: otherwise
   the lockfile version drifts permanently.
4. Pin example in `README.md` ("Using it in TiddlyWiki") to the new version.
5. `npm run smoke`, `npm test`.
6. Commit and push; once the CI run is green, **tag == version** and create the release:
   ```bash
   git tag 2.0.0 && git push origin master 2.0.0
   gh release create 2.0.0 --generate-notes
   ```
   Breaking format changes (e.g. renamed relation fields) belong in the release notes explicitly -
   consumer wikis otherwise silently lose graph edges. A new language belongs there too (the wikis
   list the supported languages in their README).
7. Consumers (TiddlyRPG repo family) raise their pin themselves (`#1.4.1` -> `#2.0.0`), run
   `npm install` and bump their own `package.json` `version`.
