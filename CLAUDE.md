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
npm test            # all tests in test/
npm run test-lang   # only test/lang/: language packs and translation mechanics
```

- `npm run smoke` boots the minimal edition `editions/smoke` (only `tiddlywiki.info` with the
  plugin list and `"languages": ["de-DE"]`, **no content**) and aborts on module/load errors.
  A plugin from the list that is not found is only a warning (`Cannot find plugin`) and the
  boot exits 0 - locally read the output; the CI step fails on it. JS modules only run when
  used, so this does not replace the tests.
- `npm test` runs `test/**/*.test.js` with Node's built-in test runner (`node:test`); every file
  runs in its own process. `test/helpers.js` boots the smoke edition in-process, adds the fixture
  tiddlers and offers `render`/`view`/`body`/`filter`, and `graph` (see below). One file per topic:
  - `calendar-engine` - the engine against the former hard-wired Harptos arithmetic and an own
    leap rule
  - `dates` - syntax of the date field, `dateformat`/`dateadd`/`datediff`/`dateended`/
    `datecheck` in de-DE and en-GB, and without a calendar; `datesection`
  - `sections` - event head, dated sections `<<date>>` (counting, captions, rule, hints),
    locations per section, subtitle without modifier, event table (rows and title cells),
    jump marks and the wrapper `dnd-jump`
  - `migrate` - `scripts/migrate-dates.js` and `scripts/check-dates.js` against fixtures in a
    temp folder
  - `location` - parents and places within (`filters/location.js`), occupants (items too), the
    checks of `locationcheck` (artifacts too), the path below the title, the relation list of a
    location, the events of the places within, map tabs (map and battle maps, labels and order),
    map buttons, event history, player lock, person view
  - `items` - base type and categories (`filters/item.js`), the hints of `itemcheck`, the hub
    lists of `Item` and of a category, a category of the campaign, the file of a book (field
    `data`), colour and image folder through the base type
  - `spots` - spots of a location (`modules/spots.js`): plain names with links, joined
    tiddlers, intro in the body, headings and jump marks in the map tab, spots in notes of the
    DM; `<<spotlink>>`: link, pill, missing spot or location, the events referencing a place
  - `timeline` - cards, bars, beams, order, details, sections (only spans are bars), arrows,
    the band of the tiddler itself, the section lines as links
  - `hubs` - hub and index tiddlers, type colours, no leaked pragmas or `<<dnd.`
  - `graph` - through the nodes and edges of the real templates (`h.graph`): the
    `edges.typed` override (`dndwiki-exclude`, style from the edge type config), the function
    edges `rules` and `spots`, the ego graph (type colours, the dead, a location as centre,
    folding), the map (pins, spots, positions, editing, hidden nodes, image and fit), the view
    template `dnd-graph`; the map view outside `$:/graph/`, the fit of the map image
    (`graph/map-fit.js`, with a mock of vis-network), the pins of the map (`graph/map-pin.js`)
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
  `scripts/plugin-path.js`: `./plugins` plus the pinned `node_modules/tw5-*/plugins`. A
  **content preview** deliberately does not exist here - use the IDE loop in a real wiki (below).

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
the `de-DE` language packs and the expected output in `test/`.

## Contents (`$:/plugins/dndwiki-core/...`) - inventory

So that it is clear what already exists before adding something. All format tiddlers live
plugin-scoped under `$:/plugins/dndwiki-core/<category>/<name>` (files in subfolders of the same
name, `kebab-case`). Macros are called by their `exports.name` (e.g. `<<image>>`), independent of
the tiddler title:

- **Functions and procedures** (`functions`, tag `$:/tags/Global`): `dnd.visible`, `dnd.dead`
  (see "Functions & cascades"), `dnd.t`, `dnd.title`, `dnd.plural` (language system), the
  procedures `dateformat`, `dateadd`, `datediff` (calendar), `date` (dated section in a body,
  with `widgets/date.js`), `dnd.places` (location pills of a section, with the pills of
  `<<spotlink>>` via `dnd.spotpill`), `dnd.dateline` (date line below the tags: span of an
  event, years of existence of the other types), `dnd.datecheck` (hint on a date that cannot
  be read, not in the published copy), `spot` (heading of a spot with its jump mark),
  `spotlink` (reference to a spot, with `dnd.spotjump` and the hint `dnd.spotcheck`) and
  `dnd.locationpath` (path of parent locations below the title, see "Locations").
- **Library modules** (`modules/*`): `language.js` (key lookup with fallback, display names,
  `$name$` patterns), `calendar.js` (calendar engine, see "Calendar engine"), `dates.js` (see
  "Dates": parser of the `date` field, calendar check, short form, the dated sections of a body
  from its parse tree - the one place of these rules, used by the date filters, `eventrows`, the
  timeline, `dnd-date` and `deadlink`), `spots.js` (see "Locations": spots and `<<spotlink>>`
  from the parse tree, plain names, the index of owners and references), `anchor-jump.js`
  (see "Jump marks").
- **Widgets** (`widgets/*`): `dnd-timeline` (`timeline.js`, attributes `filter`, `self`):
  vertical, interactive timeline of the events, newest at the top, undated ones at the bottom as
  `????`. Positions from `calendar.dayNumber`, long gaps collapsed; an event with more than one
  point gets a lane (at most 5, more merge into one beam), in it only spans are bars, points are
  dots, the dashed track shows while highlighted; `..` ends in an arrow. Card: span and tag dots,
  then the title; tap/click selects (below the title the card shows the tags and one line per
  section with its caption, lines to each section; a section line opens the event at that
  section). `self`: the own dates of that tiddler as a band behind the
  lanes. Campaign events solid, other events dashed. Details in the module header.
  `dnd-date` (`date.js`): finds which section a `<<date>>` placeholder stands for, by the
  position of the call in the parse tree.
  `dnd-jump` (`jump.js`, attributes `anchor`, `tabstate`, `tab`): wrapper around ordinary
  links that jumps to a mark in the opened tiddler, selecting a tab first if given (see "Jump
  marks"). `action-dnd-jump` (`action-jump.js`): the same as an action, for the spot dots of a
  map; scrolls at once if the tiddler already shows the mark.
- **Macros** (`macros/*`): `image` (resolves the `image` field against `images/<folder>/`, folder
  from the type tag, several images comma separated; battle maps as a link to the file),
  `subtiddler` (renders `<title>/<sub>` sub-tiddlers), `deadlink`.
- **Filters** (`filters/*`): `eventrows` (event table, the "List" tab: one row per point in time, an event in one title cell across its rows, the title jumps to its earliest section), `multitag`
  (input with at least one of the tags, grouped in tag order, no duplicates), `translate.js`
  (`dndtranslate`, `dndtitle`, `dndtitlesearch`), `date.js` (`dateformat`, `dateadd`, `datediff`,
  `dateended`, `datecheck`, `sectionlinks`, `sectionspots`, `datesection`, `calendar[...]`),
  `location.js` (`locationparent`, `locationpath`, `sublocations`, `occupants`,
  `locationcheck`), `item.js` (`itemcheck`, see "Items"), `spots.js` (`spots`, `spottargets`, `spottext`, `spotintro`, `spotplain`,
  `spotanchor`, `spottarget`, `spotref`, `spotowner`, `spotlinked`, `maptabs`).
- **Startup** (`startup/tag-names.js`): hook `th-saving-tiddler`, stores translated tag names
  ("Ort") under the internal name (`Location`).
- **ViewTemplates** (`viewtemplates/*`): `activity`, `image`, `event`, `event-list` (tab list
  "Timeline"/"List" in `event-list/tabs`, also used by the `Event` hub; the caller sets the filter
  variable `dnd-events`; for a location the events of all places within and the `<<spotlink>>`
  references; contents `event-list/timeline` + `event-list/list`), `item`, `link`,
  `location` (map block: tab "Map" if there is a map image, a spot or a place within, with
  `location/map` - map graph, buttons, spots -, one tab
  per battle map with `location/battlemap`; tab state per location, see "Locations"),
  `location-path` (path below the title, with the hints of `locationcheck` and `itemcheck`),
  `book` (the file of a book, field `data`, below the body), `relations` (tab list "Graph"/"List" via
  `$:/plugins/flibbles/graph/ui/grouped-tabs`, tab contents `relations/graph` + `relations/list`;
  one type scope filter for both tabs), `player`. Order via `list-after`. Plus `body-filter`
  and `body-filter-spots` (cascade, see below).
- **Snippets** (`snippets/*`, tag `$:/tags/TextEditor/Snippet`): `open-items`, `player-spoiler`,
  `date-section`.
- **Styles** (`styles/*`): `border` (border per type, generated from the hubs), `item` (book
  rules, battle map width), `dead`, `pinned`, `readonly`, `timeline`, `event` (event head,
  dated sections, location pills) and `location` (path, spot pills, spots, map buttons; static
  CSS, `type: text/css`).
  **Templates** `templates/image`, `templates/body-locked`, `templates/body-intro` (body of a
  location with spots: the text before the first spot), `templates/title-translated`,
  `templates/subtitle`.
- **Configuration** (`config/*`): `type-colour`, `class-dead`, `class-pinned`, `class-readonly`,
  `title-translated`, `subtitle` - see below.
- **Search** (override of `$:/core/ui/DefaultSearchResultList` plus `search/item`): core search
  plus hubs whose translated name matches, hits shown with translated names.
- **Language packs** (`language/<code>/*.multids`): `titles` (`Title/<hub>`), `plurals`
  (`Plural/<hub>`), `fields` (`Field/<field>`, relation fields), `texts` (template texts).
- **Index/hub tiddlers** (Person, Location, Organisation, Deity, Player, Artifact, Item,
  Material, Book, Consumable, Equipment, Event, Campaign, Calendar, Information, Index, TBC,
  TBC/Campaign; titles without prefix, tag `Index`; the item categories also tagged
  `$:/tags/dndwiki/ItemKind`, see "Items"): type tags carry the `color` field from which graph nodes,
  tiddler borders and tag pills take their colour; `caption` is `<<dnd.title ...>>`.
- **tw5-graph schema + graph templates**: field edge types (`$:/config/flibbles/graph/edges/fields/*`)
  + relink field types; the function edge types `rules` (leader -> location, "Controls") and
  `spots` (a location -> its spots that are locations, dashed); relink of the macro parameters
  of `spot` and `spotlink`; the graph templates
  `$:/plugins/dndwiki-core/graph/templates/dnd-graph` (type colours from the tag `color`,
  `shape=box`, no saved positions), `.../dnd-ego` and `.../dnd-map` (map of a location, see
  "Locations"); the views `$:/plugins/dndwiki-core/graph/ego` and `.../graph/map` (outside
  `$:/graph/`, so not in the dropdown of the graph sidebar); the vis-network extensions
  `graph/map-fit.js` (`module-type: vis-property`, graph property `dndMapFit`),
  `graph/map-pin.js` (`vis-property`, node property `dndPin`),
  `graph/ego-toggle.js` (`vis-property`, node property `dndToggle`: fold and unfold a place in
  the ego graph of a location with a single click) and
  `graph/map-fit-message.js` (`vis-message`, `dnd-map-fit`). The thin view definitions
  (`$:/graph/Default`/`Cosmogram`/`Atlas`/`Items`) live in each wiki on purpose, not here.

`dndwiki-forgottenrealms` contains no code: `$:/dndwiki/calendar/Harptos` (data),
`$:/config/dndwiki/calendar` (activates it) and `language/<code>/` with `Calendar/Harptos/...`.

## Language system

- Keys are tiddlers `$:/dndwiki/language/<code>/<key>`, delivered as `.multids` (one line per
  key) or `.tid` (multi-line texts such as `Calendar/Harptos/Description`). en-GB is the base;
  every other language has the same keys. Keys only in `en-GB/names.multids` are proper names that
  may fall back on purpose (`test/lang/packs.test.js` does not report them).
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
  (`<$text text={{{ [<date>dateformat:era[]] }}}/>`).
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

Without a calendar, `dateformat` shows the date as entered, `eventrows` the raw month/day
numbers, `dateadd`/`datediff` return nothing, `datecheck` only checks the syntax and the
`Calendar` hub is hidden from `Information`.

## Dates

`modules/dates.js` holds the rules of the `date` field and of the dated sections - nothing else
splits a date. Syntax and meaning: module header and `README.md` ("Dates"). Points to keep in
mind when changing it:

- `parse()` results are cached per string and shared; callers must not change them. `dnd.dead`
  runs through ClassFilters and graph templates for every visible tiddler on every refresh.
- A single point means a point in time for events and a start with an open end for every other
  type; the timeline band and `dnd.dead` rely on that.
- `sections()` reads the placeholders, links and `<<spotlink>>` calls (`spotlinks`, through
  `modules/spots.js`) from the **parse tree** (cached per tiddler),
  not with a regex: a `<<date>>` in code is not parsed and so not counted. Links are assigned to
  sections by their `start` offset; subtrees with the class `tc-tiddler-frame` (DM notes) are
  skipped. TW 5.4 sets `start`/`end` on block and inline nodes (`wikiparser.js`); check that when
  raising the engine version.
- `widgets/date.js` matches its own call by `start` and `end` of the transclude node of
  `<<date>>`. Called from another text (a transcluded snippet) there is no match: then only an
  explicit number works, otherwise a visible hint. The edit preview works because the draft has
  the same text and date.
- Known limit: a `<<date>>` inside a block hidden from players still gives its caption and
  locations to timeline and table - the walk does not evaluate `$list`/`<%if%>`/`$reveal`.
  `check-dates.js` warns; the real fix belongs to the login per player.
- `sectionAt()` (operator `datesection`) finds the section a date falls into by overlap of
  their days: of several the narrowest wins, on a tie the first; "."/".." are open sides. It
  never falls back to "the section before" - a jump to the whole event is better than one to
  the wrong section.
- `scripts/migrate-dates.js` converts the 1.x notation (dots), `scripts/check-dates.js` checks a
  wiki (boots it with the plugins of this repo, so its calendar applies). Both are tested in
  `test/migrate.test.js`.

## Jump marks

TiddlyWiki has no anchors inside a tiddler: a link opens the tiddler, and a `tm-scroll` sent
from wikitext right after `$action-navigate` comes before the refresh that shows it. So:

- A **jump mark** is any element with `data-dnd-anchor="<name>"` inside a tiddler, name in
  kebab-case. The section headings of the procedure `date` carry one (`date-<n>`) - not a
  section at the very start of the body, where a jump would only hide the title - and the
  headings of spots (`spot-<plain name>`, `spots.anchor()`).
- `<$dnd-jump anchor="...">` (`widgets/jump.js`) wraps ordinary links. It sees their
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
  the jump sets the tab state first (`dnd-jump` attributes `tabstate`/`tab`). That needs an
  `explicitState` the caller can compute - the map tabs of a location use
  `$:/state/dndwiki-core/location-tab/<title>`.
- `action-dnd-jump` serves places without a link (a node of a graph). tw5-graph hands a node
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
- Spots: `<<spot "Name">>` begins a section that runs to the next spot. The name may hold
  wikitext; its plain text (links replaced by their visible text) is the anchor, the node label
  and the target of `<<spotlink>>`. Joined to a tiddler: the second parameter, or a tiddler
  with the plain name. `<<spotlink "Place" "[[Text|Spot]]">>`: here the target of the link
  counts. Both are read from the parse tree like `<<date>>` (same limit: a spot in a block
  hidden from players is still found). They are no TiddlyWiki links: no backlinks, not in
  "Missing"; renaming works through the relink configuration of the macro parameters.
- `spots.index()` (global cache): which locations have a tiddler as spot (`spotowner`), which
  tiddlers reference a place with `<<spotlink>>` (`spotlinked`, used by the event list).
- The body of a location with spots shows only the intro (`body-filter-spots`); the spots show
  in the tab "Map" below the map graph, each as written (`spots:section`).
- Map (`graph/templates/dnd-map`): background `images/map/<field map>`, drawn by
  `graph/map-fit.js` always 600 units wide (graph property `dndMapImage`, not the `background`
  of tw5-vis-network, which draws in image pixels and shrinks nodes and labels on a large
  image); without the field an empty canvas. Fixed nodes are the places lying in the location
  (all depths, not the location itself) and its spots (a spot without tiddler is a node
  `<location>#<plain name>`); only places, no occupants. Each node is a pin
  (`graph/map-pin.js`, vis-network `custom` shape): a dot at the position and the name in a
  pill below it, filled for a tiddler, white and dashed for a spot; drawn at the same size on
  screen whatever the zoom.
  Positions: field `map-positions` of the location, JSON `{"<node id>": "x,y"}` in these map
  units with the origin in the middle, written by the `free` action while
  `$:/state/dndwiki-core/map-edit/<title>` is `yes` (never in the published copy); a node
  without one gets a slot in a grid (node property `dndUnplaced`). No edges on the map. The fit
  takes the image plus every node outside it, so a pin placed beside or below the image stays
  visible. Buttons:
  "Fit map", "Hide nodes" (`$:/state/dndwiki-core/map-nodes/<title>` = `hide`, only the image),
  "Edit positions" (off while the nodes are hidden).
  `$properties.persistent` of tw5-graph cannot be used: it writes by `$index` and would turn
  the wikitext body into JSON. `graph/map-fit.js` (`dndMapFit` = `image` or `nodes`) fits the
  image to the width and sizes the container by its aspect ratio, or without an image fits the
  view to the nodes (height from the stylesheet); in both cases it switches off the improved
  layout of vis-network (it would shift placed nodes). The tab renders the graph only in a
  browser (`$:/info/browser`): the tests check the tab through its buttons and spot texts, and
  the map itself through `h.graph`.
- Leading a location: `leader` pointing to a `Location` is drawn by the function edge `rules`,
  not by the field edge `leader` (its config has `dndwiki-exclude: [tag[Location]]`, applied by
  the override of `$edges.typed`). The relation list shows it as the group "Controls".

## Items

The rules of items live **once** in `filters/item.js` (base type and categories) and
`filters/location.js` (owner and location of an artifact). Meaning and examples: `README.md`
("Items").

- Base types `Artifact` (unique), `Item` (several), `Material`; one per item. Everything that
  tells the item types apart (colour in the graph templates, `multitag` lists of `activity` and
  `relations`, the image folder in `macros/image.js`) names only these three - a category never
  stands alone.
- Categories are hubs tagged `$:/tags/dndwiki/ItemKind` (`Book`, `Consumable`, `Equipment` from
  here, more from a campaign). They need no code: the hub `Item` reads them from the tag, and
  a category hub is `{{ || Item }}`, which then lists only its own items. Behaviour of one
  category hangs on its tag (`viewtemplates/book`, `styles/item`).
- The hints of `itemcheck` stand below the title (`viewtemplates/location-path`), next to
  those of `locationcheck`.

## Functions & cascades

Shared checks live **once** in `functions.tid` and are called as filter operators on their
input (`[<currentTiddler>dnd.dead[]]`). So they behave the same in ViewTemplates, cascades,
ClassFilters and graph templates - `currentTiddler` is something different in each (in
ClassFilters e.g. the filter tiddler; the story tiddler is `storyTiddler` there).

- **`dnd.visible`** - player lock: yields a result if the tiddler is visible for the logged-in
  player (`$:/state/dndwiki/player`). All ViewTemplates check
  `<%if [<currentTiddler>dnd.visible[]] %>`. With an empty input it still yields a result
  while nobody is logged in - after a step that may leave nothing, filter with
  `:filter[dnd.visible[]]` instead of chaining it
  (`[<currentTiddler>tag[Book]] :filter[dnd.visible[]]`). The body is locked by `viewtemplates/body-filter`
  (`$:/tags/ViewTemplateBodyFilter`, empty `list-before` = first entry of the cascade), which
  assigns `templates/body-locked` to locked tiddlers. The map tabs of a location drop
  sub-tiddlers locked for the player, the event tabs (timeline and list) drop locked events. A change of the lock logic (e.g. login per player) happens
  only in the function.
- **`dnd.dead`** - deceased/destroyed: the `date` field ends (last section a span whose end is
  not `..`, operator `dateended`), **events excluded**. Used by `config/class-dead` (class
  `dnd-dead`, stylesheet `styles/dead`), the graph templates and the atlas views of the
  wikis; `deadlink.js` reads the same rule from `modules/dates.js`.

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
- `config/subtitle` (`$:/tags/ViewTemplateSubtitleFilter`, before `default`): every tiddler gets
  `templates/subtitle`, the core default without the modifier (always the same person here; git
  keeps the history). Other entries tagged `$:/tags/ViewTemplate/Subtitle` still show.

Palette colours in static CSS through the core variables `--tpc-<palette entry>` (since 5.4.0,
generated by `$:/core/stylesheets/custom-properties`; the release note wrongly says
`--tp-color-*`). Create such stylesheets as `type: text/css` - in wikitext `--` would become a
dash.

## Graph configuration - what lives where

tw5-graph separates configuration by scope; dndwiki-core follows that strictly and adds a
namespace of its own where tw5-graph has none:

- **Per edge type** (label, colour, stroke, arrows, curves, ...): one JSON tiddler per
  field/function under `$:/config/flibbles/graph/edges/fields/<field>` or `.../functions/<name>` -
  namespace given by tw5-graph, values from us. Our own extra field on a field config:
  `dndwiki-exclude` (a filter of targets this field type does not draw, see "Locations"). Resolved by `<$edges.typed>` automatically by
  name. Values are plain hex/literal values, no live binding to e.g. tag `color` fields (the JSON
  is read with `JSON.parse`, no wikitext context) - update by hand when the source changes. The
  JSON `label` is English and only used in the tw5-graph settings: **the visible edge label comes
  from `Field/<field>`**, set by the override of `$edges.typed` (see "Core overrides") - only for
  field types whose JSON has a label (`location` stays unlabelled). This covers the edges of our
  graph templates and those `$nodes.neighbors` creates in the ego graph, for field and function
  types alike. The
  type hub tiddlers themselves are shadow defaults in `dndwiki-core` (files without prefix in the
  plugin root, e.g. `Organisation.tid`), not in the campaign repo.
- **Global per object type** (node/edge/graph defaults such as physics): own namespace
  `$:/config/dndwiki/graph/<category>`. **No** automatic name match - every new default must be
  included explicitly with `<$properties $for=<type> $tiddler="..." />` in both graph templates.
- **Per view** (Cosmogram/Atlas/Items/Live/...): override directly as a JSON field on the view
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
| `dndwiki-core/$__plugins_flibbles_graph_macros_edges.typed.tid` | `$:/plugins/flibbles/graph/macros/edges.typed` (tw5-graph) | `dndwiki-core` | Edge labels come from the JSON edge type config, read by `$properties $tiddler=...` inside `$edges.typed` - nearest wins, so nothing outside can translate them, and `$nodes.neighbors` creates its edges through its own call. Changes: an inner `$properties $for=edges label=...` with the translation of `Field/<field>` resp. `Field/<function>` (only for types whose JSON has a label), in the field and in the function branch; in the field branch the targets are cleaned by the filter in the field `dndwiki-exclude` of the field config (leader -> location is drawn by the function edge `rules`). Needs `"plugin-priority": "2"` in `plugin.info`: with equal priority the plugin `flibbles/graph` would win (titles sorted alphabetically). |

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
5. Check whether the core navigation knows anchors by now (TiddlyWiki PR #7744 or a
   successor). If so, switch `modules/anchor-jump.js` to it or remove it (see "Jump marks").
6. `npm test`.

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
5. `npm run smoke`, `npm test`.
6. Commit and push; once the CI run is green, **tag == version** and create the release:
   ```bash
   git tag 2.0.0 && git push origin master 2.0.0
   gh release create 2.0.0 --generate-notes
   ```
   Breaking format changes (e.g. renamed relation fields) belong in the release notes explicitly -
   consumer wikis otherwise silently lose graph edges. A new language belongs there too (the wikis
   list the supported languages in their README).
7. Consumers (DnDWiki repo family) raise their pin themselves (`#1.4.1` -> `#2.0.0`), run
   `npm install` and bump their own `package.json` `version`.
