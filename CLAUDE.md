# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Plugin bundle for the `TiddlyRPG` repo family. Contents and how wikis use it: see `README.md`.

## Documentation - who covers what

- **CLAUDE.md** (here): development support - rules, conventions, editing and release workflow.
- **README.md**: what the project is and how it is used in `TiddlyRPG` and other wikis, including
  languages and calendar. It describes what this repo is and offers - not what it is not, and
  not what other repos contain.

Sort new content accordingly instead of duplicating it. (Same split in the wiki repos,
maintained canonically in `TiddlyRPG`.) The marked part of the README.md is also the tab
"readme" of `tiddlyrpg-core` in the wiki, and `LICENSE` its tab "license" - see "Readme and
license of a plugin".

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

Lock only with `Secret`, `<<secret>>`, `<$secret>` and - for the values of the rules - the field
`secret-fields` (`modules/visibility.js` `fieldVisible()`; the block reads a tiddler without the
values the view may not see, so nothing derived from them shows either, `filters/fields.js`). A
section of a kind of the ruleset with `"lock"` follows that field (a curse with `cursed`, see
"Sections"). Asking the view itself (`trpgview`, `$:/state/tiddlyrpg/view`) is for the frame of the page only:
the page control, the page class, the sidebar.

## New features - what else to check

Beside the four questions of "Visibility", every plan of a new feature or of a change to an
existing one goes through this list. A point that does not apply is left out with a word why.

- **Messages:** does the feature need a new check message, or does it change one (its condition,
  its text, its level)? Rule, keys, README table, tests: see "Checks". A message that reports a
  missing field names it in `missing`. The messages of the editor (`Editor/Error/*`, the
  notifications) count too.
- **Translation:** every text a reader sees in every language pack (`test/lang/packs.test.js`),
  see "Language system".
- **README:** what the DM and the players need to know of it, and the rows of its tables
  ("Checks", fields, settings). See "Documentation - who covers what".
- **Creating a tiddler:** what "+" on the hub of the type asks first (`ui/new-procedures`,
  `ui/new-event`) and what the form shows (`$:/config/tiddlyrpg/form/<type>`): a field whose
  absence a check reports goes into `list`, so the form shows it on a new tiddler; another field
  of the type goes into `more`. Fixes that create a tiddler (`create`, see "Checks").
- **Type colour:** a feature for a type shows in the colour of its hub (field `color`; pills
  through `trpg.pill`, CSS through the variable the template sets, like `--trpg-location`),
  never a literal.
- **Published copy** (`$:/status/IsReadOnly`): no button that changes something, inputs
  disabled, no messages below the title; `styles/readonly` for core buttons. A test in both.
- **Relink:** a new field or macro parameter that names a title gets its relink configuration,
  or renaming the title breaks it (see "Contents", "Relations", "Dates", "Locations").
- **Relations and graph:** a new relation field gets its type (`tiddlyrpg-targets`, axis,
  symmetric or not), its edge type and its place in the form; see "Relations" and "Graph
  configuration - what lives where".
- **Refresh:** the output follows a change of the wiki language, the view
  (`visibility.watched`) and the rules settings; texts through filtered attributes, not JS
  macros (see "Language system").
- **`check-wiki.js`:** a new rule shows in the report too - a theme, a rule that needs the files
  of the wiki (`checks.setFolder()`), new switches; `test/check-wiki.test.js`.
- **Settings and toolbars:** a switch belongs under ControlPanel -> Settings -> TiddlyRPG (tag
  `$:/tags/tiddlyrpg/SettingsTab`) with a default that works without it; a button of a toolbar
  gets `caption` and `description`, so ControlPanel -> Appearance -> Toolbars lists it.
- **This file:** the inventory ("Contents") and the list of test topics ("Editing the format
  layer") name the new files and tests; the header comment of a file says what it does.
- **Version, release notes, migration:** a feature raises minor, a fix patch; what
  breaks an existing wiki (a field, tag, macro or format renamed or gone) is a major change, a
  line of its own in the release notes (see "Publishing a new version") and, from 2.2.0 on, a
  migration script that brings a wiki to the new form - planned with the feature, not after it
  (2.1.0 counts as not released: what changed up to 2.2.0 needs neither).
  None exists yet; where they live and how they run is decided with the first.

## Mistakes that came back - check with every change

A review of everything since 2.0.0 found most problems in a few patterns. Where a test catches
one mechanically, it is named.

- **What stands around an entry:** a heading from a category name, the label of a group, a
  count, the relations of a group of the block, the order of sections come from what the view
  sees, not only the entry itself (question 3 of "Visibility"). A group or heading without a
  visible entry goes with its label.
- **Values through `fields.seen()` / `valuesOf()`:** a check, a derived value or a header line
  that reads `tiddler.fields` reads past `secret-fields`.
- **The sweep sees only its fixtures:** a new hub, relation field, kind of section or output
  channel gets a `Qx7` fixture; output only the browser renders runs through `h.inBrowser`
  (`views` names a hub or relation field without a secret).
- **A template for several hubs reads `currentTiddler`** and never names one (`hubs` checks
  every hub against its `trpghubentries`).
- **Assertions that cannot fail:** a negative check on markup that no longer exists; an order as
  two `indexOf` (`hygiene`, use `h.inOrder`); a pattern in the wrong language or number form
  (`2700` where de-DE writes `2.700`, an unescaped `.` in a regexp); a count where the texts can
  be compared; a message names a name once, so "known inside, unknown outside" needs another
  name outside.
- **Fixtures that cannot tell the alternatives apart:** a precedence is tested with values that
  differ (axis and type of different colours, a first type that lacks a field of the draft, a
  spot and a field `location` at once). Break the code once: the new test must fail.
- **State between tests:** a block that relies on a language sets it in its `before`; clean up
  in `finally` or `afterEach`; arrays from the wiki are of another realm, `Array.from()` before
  `deepEqual`.
- **What is removed goes everywhere:** a name, class or behaviour taken out is searched in
  comments, this file, the README and the tests (`inventory` finds new names missing here, not
  old ones left over).
- **A comma has three meanings:** decimal comma, list separator, thousands separator (`1,5 m`
  in a list, `1,320 lb`, `0,500`). A reader of numbers or lists says which it takes and is
  tested with the other two.

A second review, of the fixes themselves, found these on top:

- **A fix moves the problem to its neighbour:** a later field of a combine shown alone while the
  first is locked; a hidden branch of a tree that takes an entry with another, visible parent;
  a merged `when` that hides the fields of the ruleset. After a fix, test the case beside it -
  the same rule with the alternative locked, missing or in the other order.
- **What depends on the view is built anew when the view changes:** a transformed tree, a
  cached order (`trpg-body` and `arrange()`), not only the text of a widget. Test it by
  rendering, switching the view and refreshing, against a fresh render.
- **Nothing that reads all entries inside a loop over entries:** the hub `Content` read every
  entry of the type per entry (10 s with the SRD package). Compute what the loop needs before
  it; a test counts the calls (`content` counts the values read), it does not time them.
- **A tolerant reader for the form is no reader for the output:** the form keeps what a field
  holds ("Fighter 1,5"), the block and the card show only what reads.
- **Numbers beyond a double:** `Number()` gives `Infinity`, `BigInt(Infinity)` throws - a reader
  rejects what it cannot hold.

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
  - `calendar-engine` - the engine against Harptos arithmetic written out by hand and an own
    leap rule
  - `dates` - syntax of the date field, `dateformat`/`dateadd`/`datediff`/`dateended`/
    `datecheck` in de-DE and en-GB, and without a calendar; `datesection`; the order month
    before day; the last phase of a non-event (flag `last`)
  - `sections` - event head, dated sections `<<date>>` (counting, captions as wikitext with
    relink, rule, hints),
    locations per section, subtitle without modifier, event table (rows and title cells),
    jump marks and the wrapper `trpg-jump`
  - `location` - parents and places within (`filters/location.js`), occupants (items too), the
    messages of `checks/locations.js` (artifacts too, a location as tag), the path below the
    title (small pills, arrows, the places of a line side by side), the relation list of a
    location (the tree: a place within as a branch with its number or as a leaf, a spot dashed),
    the tab states per tiddler, the events of the places within, the maps (one without tabs, several as tabs named
    after their files, the first with the graph), the spots below them with their images and
    maps (not for a joined spot, not in the tooltip), the field image (tabs from two images on,
    folder by type), map buttons, event history, the lock, person view
  - `views` - the rule of `trpg.visible` in every view (public, a player, the DM; active and
    former characters), the default view, the choices, campaign events through player
    characters, the page control, the page class, the marker of a secret, the `Player` hub, and
    every place that lists titles (hubs, search, tag pills, sidebar, relation list, graphs), a
    secret presence, the groups of a location without what the view does not see (no pill, no
    number, no empty group, no arrow); the sweep (see "Visibility - check with every change"; it
    runs as in a browser, `h.inBrowser`, so the map renders; it also renders ControlPanel ->
    License, the list of the picker as typed and the dropdown of every tag pill; in the public
    view and the views of two players; every channel shows a secret to the DM; its fixtures
    hold a secret on every hub and behind every relation field, a test names what is missing); a tiddler the
    view does not see, opened anyway, looks like an empty locked one but for its title.
    `h.setView`/`h.inView` set the view; without them the tests run in the view of the DM (no
    `$:/status/IsReadOnly`). `h.view` opens the tabs of `h.tabs` for the tiddler it renders (the
    tab states are per tiddler, `h.openTabs`): the list of the relations block and of the events,
    since the graph widget needs a browser; the sweep renders both tabs of each
  - `items` - the base type and its message (`checks/items.js`), the price with the currency
    of the fixture setting, the hub `Item` (A to Z, the bar of `Artifact`, `Material` and the
    categories with their numbers, what the view sees of it) and the hubs below it, a category of the
    campaign (also under the tag before 2.2.0), the file of a book (field `data`), colour and
    image folder through the base type
  - `categories` - the categories of the base types (`modules/categories.js`): the item
    categories and `Folk` under `Information`, one of the campaign with and without
    `tiddlyrpg-bases` and under the tag before 2.2.0, the rule `categories/base` with its
    fix, the hub `Information` with its categories in the bar (only with an entry the view
    sees, a locked category not at all) and the hub of a category, a category of `Person`
    (`{{ || Person }}`), the pills of the form, "+" on `Folk`, the relation
    `folk` (targets, way back by kind, several, list, ego graph), a folk at a location
    (`location` in the form, the group "Völker" of the place in the public view and the view of
    the DM); the trees `classes` and `folk` (`tiddlyrpg-tree`): `relationtree`, the lines of a tree
    (`relations.lines()`) with a locked entry taking its branch along, a cycle, the rule `relations/parent` with its fix (also
    for a package entry not taken), the way back by kind, the label per type (`relationfield`),
    the lines of the player card, `content.wanting()` offering the parent
  - `currency` - the currency engine against the fixture settings (Faerûn-like, Krynn with
    steel): parse, format, convert, check, base and reference, without currency, without
    ruleset, `<<unit>>` with coins (km stays a length), unusable data
  - `currency-hub` - the hub `Currency`: listed only with a currency, table, converter, the
    reference coin and its hint
  - `ruleset-hub` - the hubs `Ruleset` and `CampaignSetting`: each listed only with its plugin,
    a table per domain of its group in its display language (en-GB for a missing key), variants,
    phrases, units with pairs and kinds, tokens, a table with its columns; calendar and currency
    pointing to their hubs
  - `spots` - spots of a location (`modules/spots.js`): plain names with links, joined
    tiddlers, the body without the spots, the text of a spot for the tooltip, headings and jump
    marks below the maps, spots in notes of the DM; `<<spotlink>>`: link, pill, the messages on a
    missing spot or location (`checks/spots.js`), the events referencing a place; a spot one letter
    off a title, a joined spot with a text of its own
  - `text-sections` - the sections of a body (`modules/sections.js`, `widgets/sections.js`):
    short and block forms, numbering over both, nesting (with a kind registered in the test),
    the hints; locks in the text (`<<secret>>`, `<$secret>`) and what they hide: body, table,
    timeline, span, pills, `datesection`, spots and the map, search, backlinks
  - `sections-rules` - the kinds of sections of the ruleset (fixture 5e-mini: effect, curse with
    `cursed`, trait, action with a heading, legendary with heading and intro): both forms, a short
    form to the next marker, the order of the domain with headings and intro, `<<secret>>` before
    a section and a heading over locked sections, the name before the text, the procedures, the
    lock by a field in the views, the checks of a section, of an intro and of the domain, the hub
  - `timeline` - cards, bars, beams, order, details, sections (only spans are bars), arrows,
    the band of the tiddler itself (one per phase, apart), the section lines as links, captions
    with macros, refresh
    on the rules and plugin configs
  - `hubs` - hub and index tiddlers, type colours, no leaked pragmas or `<<trpg.` in any hub;
    every type hub lists exactly its `trpghubentries` (a template of several hubs); `trpg.link`
    and `trpg.pill` (type colour, rumour gold with class `trpg-pill-rumour`, dead striped, spot dashed, a text behind); the
    hubs in their colour (`styles/hubs`, class `trpg-hub`, the rule, not `Index`; `Campaign`
    and `Index` grey), the list sorted by the display name with a letter per group, the number
    in the heading and in `Index` in the public view and the view of the DM, `Campaign` with
    the list of the hubs below its first heading
  - `tag-pill` - the tag pill defined again in `functions` instead of an override of
    `$:/core/macros/tag`: its translated name and colours wherever the core renders it, the
    colours in the tag picker (see "Core overrides")
  - `inputs` - every `$edit-text` of the plugins keeps its widget while typing (`h.typeInto`):
    a case per input, and a scan of the wikitext of `tiddlyrpg-core` and `staticfiles` that
    fails for an input without its case (see "Inputs keep their focus")
  - `editor`, `editor-form`, `editor-ui` - the editor: see "Editor" -> "Tests"
  - `quests` - the quest markers in an event (short form, block, stacked) and that they split
    no dated section; their jump marks (none at the very start of the body); their hints,
    status, order, quest or rumour, the links between quests; the hub `Quest` with its switches
    and cards, the page of a quest and of a rumour; what the views see; renaming through Relink
    (see "Quests")
  - `relations` - the relation filters (`filters/relations.js`: targets, the way back,
    label), the relation list forward and back (headings with their number, pills), included
    types, symmetric types, family, the groups of a location (Control, Influence, Present,
    Locations; everyone once, in every opened place too), the messages of `checks/relations.js`
  - `graph` - through the nodes and edges of the real templates (`h.graph`): the
    `edges.typed` override (`tiddlyrpg-exclude`, symmetric edges, style from the edge type
    config and its axis, included types, every type its own edge, the types of a view), the function edges `rules`, `spots` and `links`, the ego graph (type colours, the dead, a location as centre
    with its spots, the places within as plain nodes), the map (pins, spots, positions, editing,
    image and fit, a hidden tab waits), the view
    template `trpg-graph` (its switches, no tag left over as text); the map view outside `$:/graph/`, the fit of the map image
    (`graph/map-fit.js`, with a mock of vis-network), the pins of the map (`graph/map-pin.js`)
  - `plugin-types` - the plugin types `ruleset` and `setting` against the fixture plugins: the
    active plugin unpacked, the other not, the default without config (none created), switching
    and `none` at runtime (the switch is asynchronous, the tests wait), the shadow tiddlers
    reported as changed, a config naming a missing, disabled or foreign plugin, the tabs under
    ControlPanel -> Plugins
  - `plugin-versions` - the core version equals `package.json`; `tiddlyrpg-core-version` met,
    not met, wrong form
  - `checks` - the registry of the checks (`modules/checks.js`): ids and themes, level, key and
    text in the wiki language, the messages below the title (`viewtemplates/checks`; not in the
    published copy, not for system tiddlers or tiddlers the view does not see), `trpg-noerror`
    and `trpg-noinfo`, the rules of scope wiki at the titles they name, what a message leaves
    out for a view, and the rules without a topic of their own (links, types, expected fields)
  - `check-wiki` - `scripts/check-wiki.js`: the report (ids, levels, exit code), themes,
    `--github`, the switches; the config of the plugin types, the core version a plugin needs,
    unknown macros and rules macros not understood, images and maps on disk,
    plugins from the packages in the wiki's `node_modules`, the phases of a non-event, quest names,
    the dated sections of an event, the locks in the text
  - `markdown` - the content type `text/x-tiddlyrpg-markdown` (`modules/markdown.js`): the
    markers, what of Markdown it reads, that nothing becomes wikitext, the real `README.md` as
    the tab "readme"
  - `licenses` - the tabs "readme" and "license" of the plugins of this repo, ControlPanel ->
    License (the wiki, every plugin, both views, de-DE), the line of the field `source`
  - `macros-check` - unknown macros: the forms of a call, global and local definitions, the
    variables of the page and view template, wildcards, code and definitions left out, locked
    sections, data tiddlers and snippets, the message below the title in the wiki language
  - `units`, `dice`, `damage`, `terms` - the domain types `unit`, `tokens`, `damage`, `label` of
    the rules engine against `fixture-ruleset-5e-mini`: parsing in every language, pairs, kinds,
    display rules, the damage grammar, variants, what is not understood (a number without unit,
    also with a kind); two values of a kind that reads pairs (`20/60 ft`), fractions (`1/4 lb`,
    `½`), measures (`10 x 10 x 1 ft`), `ft³` as a volume, `0` in the unit of its pair, a domain
    without conversion (durations) with plural labels
  - `formula` - formulas (`modules/formula.js`) in the value of `<<term>>`, in `<<dice>>` and in
    the calculation of `<<damage>>` (damage words stay damage words):
    each piece in the rules language (de-DE, en-GB), the spaces around operators, `*` and `x` as
    `×`, the decimal comma (no list, no thousands), the parts with their links and jump marks, one
    span, unknown words and open brackets as problems, dice alone as before, a change of the
    rules language
  - `rule-names` - `<<rule>>` and the names of formulas (`glossary.ref()`): entry, section, table
    heading in this order, `entry:`, two hits, an entry that is none, a package entry not taken
    with the names of its index (and `content-server.index()` writing them), the jump marks of
    sections and table headings, a locked class, section or column that tells nothing, the
    messages, relink of `entry:`
  - `ruleset-generic` - `fixture-ruleset-probe` (in the style of Pathfinder 2E) as active ruleset:
    values, qualifiers, another tokens domain, fields of its own (a group, a header line, a
    formula of its own), kinds of sections of its own in the button Section of the editor -
    without code changes
  - `fields` - the values of fields by format (`rules.value()`, `modules/labels.js`): number,
    boolean, dice of a domain, unit with words and its domain, label, labels (a list, entries
    with a value, main entries with their properties and their tag, a property without parent or
    fitting twice), text
  - `rules-extension` - a label domain extended by a domain tiddler of the wiki
    (`"extends": true`): read, keys of the wiki, group of the base; the rule `plugins/domains`
    (no base, another type, an id twice, a `for` to nowhere, a cycle)
  - `content` - content packages: found in node_modules (scoped too), a package for a newer core
    left out, the route (index without texts, entry, 403, 404, the ruleset as filter, an id that
    names a path); in the browser the titles (taken, another type, a shadow, a locked tiddler),
    the fields to take (with the tag of the package), what an entry names that the wiki lacks, the offer on a missing tiddler,
    the preview, the hub Content (types, filters, search, pages, taken as link), nothing without
    a package
  - `fields-schema` - the fields of the rules (`modules/fields.js`): schemas per type, merged
    with those of the wiki, labels, derived values (modifier, average, total, lookup, band - the
    level of a player character by its XP from a table domain -, sum over the entries of a list,
    computed entries), a field only derived (`"edit": false`: not in the form, no lock of its
    own), a whole number (`"integer"`: thousands separated when read and shown - `Number/Group` -, a
    fraction a problem), the XP of a
    person, kept when a player character becomes one, the card of a player character (`card`,
    `trpgcardlines`, a former one and a locked XP), the header line, `when`, `copyFrom()` with the
    lock; patterns with parts in braces (`fill()`), a label in a variant and in the variant
    another field names (`$size.@creature-type$`, a locked field names none), combined lines; the rule `fields/schema` (a
    reserved name, a field defined twice, without definition); the block of values
    (`viewtemplates/fields`: header line, sections, a row, an inline group with the price, a
    field only for the editor, type colour, hidden from a view that does not see the tiddler);
    the rules `fields/value`, `fields/when` (a condition on a field the schema lacks does not
    count; the condition of a group) and `fields/tag` with its fix
  - `settings-tab` - the tab TiddlyRPG under ControlPanel -> Settings: the choice of ruleset and
    campaign setting with its hints, the whole row as click target, the note on an own calendar
    or currency (and that it wins over the setting); "Ruleset options" (rules language of the
    ruleset, its table with the system of the unit domains, shown with a ruleset); "Campaign
    setting options" (shown in only, its domains, the order of dates, shown with a setting or
    an own calendar); disabled inputs in the published copy, version hints
  - `rules-check` - the messages on rules macros below the title: wiki language, not in the
    published copy, not for a section the view does not see, not for computed parameters
  - `naming` - no old prefix (`dndwiki`, `dnd-`, `dnd.`, `dnd` before a name, in any case) in
    the files or file names below `plugins/`, `scripts/` and `editions/`; new names use
    `tiddlyrpg-`, `trpg-`, `trpg.`
  - `inventory` - this file against the plugin: every filter operator named in the header of
    its module and here (`editor.js`: in its header), every file of the folders of the plugin
    named here
  - `hygiene` - the tests themselves: no order compared as two `indexOf` (it holds when the
    first is missing); `h.inOrder(text, strings)` fails then
  - `lang/packs` - every language complete against en-GB (keys only in `en-GB/names.multids`
    may be missing; keys ending in `/Parse` are words read in one language only), no empty value
  - `lang/i18n` - display names, tag hook, search, edge labels of the real edges, refresh after
    a language change
  - `lang/rules-lang` - the rules language: both settings in the three modes, independent,
    values kept on a mode change, fallback to en-GB, calendar names follow the domain while the
    texts of the calendar stay in the wiki language, refresh, an own calendar without domain
    tiddler, the groups ruleset and setting with settings of their own, the languages with keys

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

**Inputs keep their focus:** nothing around an `$edit-text` may read what it edits - no `$let`,
`$set`, `$vars`, `%if`, `$list` or filtered attribute that depends on the edited tiddler or
field. A change of such a variable renders everything inside anew, the input too, and in the
browser it loses the focus after every key. What follows the input (a result, a button, a hint)
reads the value itself, beside or after the input, as in `Calendar`, `Currency` and
`templates/quest-body`. A new input gets its case in `test/inputs.test.js`; the test fails
without it.

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

- **Functions and procedures** (`functions`, tag `$:/tags/Global`): `trpg.visible`, `trpg.dead`,
  `trpg.link`, `trpg.pill` (see "Functions & cascades"), `trpg.hub`, `trpg.hub.entries`,
  `trpg.hub.page`, `trpg.hub.list`, `trpg.hub.entry` (the type hubs, see "Index/hub tiddlers"), `trpg.t`, `trpg.title`, `trpg.plural` (language
  system), the procedures `dateformat`, `dateadd`, `datediff` (calendar), `unit`, `dice`, `damage`, `term`
  (rules engine), `date` (dated section in a body,
  with `widgets/date.js`), `trpg.places` (location pills of a section, with the pills of
  `<<spotlink>>` via `trpg.spotpill`), `trpg.dateline` (date line below the tags: span of an
  event, years of existence of the other types), `spot` (heading of a spot with its jump mark),
  `spotlink` (reference to a spot, with `trpg.spotjump`),
  `secret` (a lock, draws nothing itself, see "Sections"), `image` (images in a text or of a
  tiddler, with `trpg.images` and `trpg.image`, see "Locations"), `trpg.locationpath` (where
  a tiddler is, below its title, as small pills, see "Locations") and the tag pill macros `tag-pill-styles`
  (with `trpg.pillcolour`, `trpg.pillbase`, `trpg.pilltext`), `tag-pill-stripes` and
  `tag-pill-inner` (see "Core overrides"). The controls of the editor in `editor/procedures`
  (`trpg.picker`, `trpg.choicepill`, `trpg.charpills`, `trpg.pickname`, `trpg.pickpill`,
  `trpg.pillstyle`, see "Editor") and the "+" of the hubs in `ui/new-procedures`
  (`trpg.newbutton`, `trpg.neweventbutton`), both tagged `$:/tags/Global` too.
- **Library modules** (`modules/*`): `language.js` (key lookup with fallback, display names,
  `$name$` patterns, `internalTitle` - "Ort" -> `Location` over all language packs), `calendar.js` (calendar engine, see "Calendar engine"), `dates.js` (see
  "Dates": parser of the `date` field, calendar check, short form, the dated sections of a body
  from the model of `sections.js` - the one place of these rules, used by the date filters,
  `eventrows`, the timeline and `trpg-date`), `sections.js` (see "Sections": the
  sections of a body, their kinds, locks and rendering), `spots.js` (see "Locations": spots and
  `<<spotlink>>` from the model of `sections.js`, plain names, the index of owners and
  references), `relations.js` (see "Relations": the relation types, their axes, what a type
  shows and draws, labels), `quests.js` (see "Quests": the index of the markers, status,
  links, mentions, the ways to a map), `anchor-jump.js`
  (see "Jump marks"), `visibility.js` (see "Views": player characters, the active view, the
  lock, campaign events), `markdown.js` (Markdown of a README as wikitext, see "Readme and
  license of a plugin"; its parser `parsers/markdown.js`, type `text/x-tiddlyrpg-markdown`),
  `checks.js` (see "Checks": the registry and the run of the rules), `labels.js` (values made of
  the entries of label domains: one, a list, entries with a value, main entries and their
  properties; `<<term>>` with several ids; the data problems of label domains - see "Rules
  engine"), `fields.js` (the fields of the rules: definitions and schemas per type, labels,
  derived values, the header line, `when`, `copyFrom()` - see "Rules engine"), `types.js`
  (the type tags: the hubs and the categories, `of()` the types of a tiddler; `UNTYPED`: pages
  that need no type), `categories.js` (the categories of the base types, see "Items and
  categories"), `glossary.js` (what explains a term or the name of a section: the links of
  `<<term>>`, of the values of the rules and of section names; `ref()` the target of
  `<<rule>>` and of a name in a formula - an entry, a named section, a table heading - and
  `search()` for the button Rules), `formula.js` (a formula in the value of `<<term>>` and in
  `<<dice>>`, piece by piece: shown, never computed - see "Rules engine"),
  `relink-titles.js` (`module-type:
  relinkfieldtype`, the relink type `trpgtitles` of a field of the format titles),
  `editor.js`, `form.js`, `fixes.js`, `symmetric.js` (see "Editor"), `notice.js` (the notifications
  of the editor: each shown from a slot of its own, so two in a row keep their texts).
- **Check modules** (`checks/*`, `module-type: trpg-check`): one file per theme, see "Checks".
- **Content packages** (Node only): `modules/content-server.js` finds the packages in
  `<wiki>/node_modules` (`package.json` -> `"tiddlyrpg": {"content": [...]}`, their manifests
  and entry files: module header), `server/content-route.js` (`module-type: route`) serves
  `/tiddlyrpg/content/index.json` and `.../entry.json` - only to who may write; an id is only
  looked up, never a path. The key of an entry in the browser is its id, or "<package>/<id>" when
  two packages of the ruleset (a language each) share it; the entry is fetched by package and id
  (`content.entryUrl()`, on the host of the sync adaptor, `content.url()`). In the browser `startup/content.js` loads the index of the active
  ruleset into `$:/temp/tiddlyrpg-core/content/index` (empty without a server of the wiki or
  the right to write) and takes an entry on `tm-trpg-content-take`; `modules/content.js` (its
  header) decides the titles - what is in the wiki wins, another type gets "Title (Type)" in the
  language of the package - and turns an entry into fields (`currency.fromRules()` for the
  price; the `tag` of the manifest, if it has one, on every taken tiddler). Every part of the packages hangs on `trpg.content` (`trpgcontentready`): without a
  package nothing shows. `viewtemplates/content-missing`: the offer on a missing tiddler.
  `tm-trpg-content-preview` fetches an entry into `$:/temp/tiddlyrpg-core/content/preview`
  (its type in `trpg-type`, no tag - no hub lists it, `types.of()`), shown like the taken
  tiddler: heading and body through `config/title-preview` and `config/body-preview` before the
  system rules of the core, the box `viewtemplates/content-preview` on top. The hub `Content`
  (under `Information`, hidden without a package): per type a list of 50 a page with search,
  filters from the fields of the schema (one entry or a list of a domain, a number whose
  definition says `"filter": true`), header line, preview
  and take; what is taken as a link (`filters/content.js`). Every picker of a relation offers
  the entries of its types too (`relationcontent`, dashed): one chosen is named, not taken (no
  missing tiddler, `content.forRelation()`); a base from a package gives its values from there
  (`tm-trpg-content-copy`). "Possessions" takes the item it gives, as created by the draft - the
  item carries `owner`. The button "Content" of the editor toolbar (`editor/toolbar/content`) searches the
  offers, takes one the same way and sets its link at the cursor. The search of the wiki lists
  the offers whose title holds the text in a group of its own.
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
  `trpg-body`) and the block forms `date`, `spot`, `secret`, `quest` - see "Sections".
- **Filters** (`filters/*`): `eventrows` (event table, the "List" tab: one row per point in time, an event in one title cell across its rows, the title jumps to its earliest section), `multitag`
  (input with at least one of the tags, grouped in tag order, no duplicates), `translate.js`
  (`trpgtranslate`, `trpgtitle`, `trpgtitlesearch`), `date.js` (`dateformat`, `dateadd`, `datediff`,
  `dateended`, `datecheck`, `sectionlinks`, `sectionspots`, `datesection`, `visibledate`,
  `calendar[...]`), `currency.js` (`priceformat`, `priceconvert`, `pricecheck`, `currency[...]`,
  `currencyunit`, `currencycoin`, see "Currency engine"), `sections.js` (`hassections`,
  `sectionbacklinks`, `visiblelinks`, `trpgsearch`),
  `location.js` (`locationparent`, `locationpath`, `locationgroups`, `sublocations`, `occupants`),
  `categories.js` (`trpgcategories`, `trpgcategorybases`, `trpgglossary`, `trpgnamed`, see "Items
  and categories"),
  `hubs.js` (`trpghubentries`, `trpghubsubs`, `trpgsortname`, `trpginitial`, see "Index/hub tiddlers"),
  `spots.js` (`spots`, `spottargets`, `spotplain`,
  `spotanchor`, `spottarget`, `spotref`, `spotowner`, `spotlinked`), `images.js` (`imagetabs`,
  `maptabs`, `imagelist`: images and maps as entries `{id, label, path}`, see "Locations";
  `imagefolder`: the folder of a type),
  `content.js` (`trpgcontentready`, `trpgcontentfor`, `trpgcontentids`, `trpgcontentsearch`,
  `trpgwikilink`, `relationcontent`, `trpgcontentoffer`; for the hub `Content`
  `trpgcontenttypes`, `trpgcontentlist`, `trpgcontentfilters`, `trpgcontentvalues`; see
  "Content packages"),
  `fields.js` (`trpgfieldsummary`, `trpgfieldsections`, `trpgfieldlines`, `trpgfieldsection`,
  `trpgfieldshow`, `trpgfieldparts`, `trpgfieldlabel`, `trpgfieldcolor`, `trpgfieldlocked`,
  `trpgtreerows`: the block of values; `trpgcardlines`: the card of a player character;
  `trpgfieldreading`, `trpglockfields`, `trpglevelentries`, `trpglevel`, `trpglevelset`,
  `trpgfieldinput`, `trpgfieldchoices`, `trpgfieldchoice`, `trpgfieldchosen`,
  `trpgfieldtoggle`, `trpglockon`, `trpglocktoggle`: the form; see "Rules engine"),
  `relations.js` (`relationtargets`, `relationsources`, `relationlabel`, `relationaxis`,
  `relationsymmetric`, `relationtypes`, `relationneighbours`, `relationkind`, `relationtree`,
  `relationfield`, `relationgroups`, `relationgroup`, see "Relations"),
  `quests.js` (`questnames`, `questreal`, `queststatus`, `questmarks`, `questlast`,
  `questplayers`, `questlinks`, `questmarked`, `questmentions`, `questevents`, `questlinkat`,
  `questpins`, `questroutes`, `questsabout`, `questmark`, see "Quests"),
  `visibility.js` (`trpgvisible`, `trpgview`, `trpgcharacter`, `trpgcharacters`, `trpgplayer`,
  `trpgplayedby`, see "Views"), `rules.js` (`trpgruleslang`, `trpgruleslangs`, `trpgruleslabel`, `trpgunit`,
  `trpgdice`, `trpgdamage`, `trpgterm`, `trpgtermparts`, `trpgdiceparts`, `trpgdamageparts`, `trpgruleparts`, see
  "Language system" -> "Rules language" and "Rules engine"), `checks.js` (`trpgcheck`, `trpgdraftcheck`, see "Checks"), `editor.js` (the
  filters of the editor, listed in its header, see "Editor").
- **Page parts** (`ui/*`): `view-switcher` (page control "View", `$:/tags/PageControls`),
  `sidebar` (the sidebar tabs per view, `$:/tags/SideBarSegment`) and `sidebar-recent` (its
  tab "Recent"), see "Views"; `hub-new` ("+" in the toolbar of a hub, `$:/tags/ViewToolbar`),
  `new-procedures` and `new-event` (what it does) and
  `settings-editor` (a tab of the settings), see "Editor".
- **Startup** (`startup/tag-names.js`): hook `th-saving-tiddler`, stores translated tag names
  ("Ort") under the internal name (`Location`). `startup/symmetric.js`,
  `startup/editor-messages.js`, `startup/editor-states.js`: see "Editor". `startup/plugin-types.js`: the switchers of the
  plugin types `ruleset` and `setting` (see "Plugin types ruleset and setting"). `startup/sections.js`:
  the procedures and block widgets of the kinds of sections of the ruleset (see "Sections").
- **Licenses**: `ui/controlpanel-license` (ControlPanel -> License, `$:/tags/ControlPanel`)
  and `config/licenses` (`$:/config/tiddlyrpg/licenses`), see "Readme and license of a plugin";
  `files/tiddlywiki.files` loads `README.md` and `LICENSE` of the repo as the tabs.
- **Plugin types** (`modules/plugin-types.js`, `filters/plugin-types.js`: `trpgplugins`,
  `trpgplugin` with the suffixes `configured` and `problem`, `trpgversionhints`), the tabs
  `ui/controlpanel-rulesets` and `ui/controlpanel-settings` under ControlPanel -> Plugins.
- **Settings tab** `ui/controlpanel-tiddlyrpg` (ControlPanel -> Settings -> TiddlyRPG): its tabs
  are tagged `$:/tags/tiddlyrpg/SettingsTab` and show when their field `condition` (a filter)
  gives anything - `ui/settings-ruleset` (the choice of ruleset and campaign setting, like the
  theme switcher, the button filling the row; a note when the wiki has its own calendar or
  currency, whose real config tiddler wins over the shadow of a setting),
  `ui/settings-ruleset-options` (with a ruleset: the rules language of the group `ruleset` and the
  highlight of the rules macros, `$:/config/tiddlyrpg/rules/highlight`) and
  `ui/settings-setting-options` (with a setting or an own calendar or currency: the rules
  language of the group `setting` and the order of day and month, see "Calendar engine"). Both take their procedures from
  `ui/settings-rules` (`\import`; operators `trpgrulesdomains` with a group, `trpgrulesdomain`,
  `trpgrulesexample`; a unit domain names the system of its language, `trpgrulessystem`, keys
  `Settings/Rules/System/<system>`). In the published copy the inputs are disabled; no button,
  no page of its own.
- **ViewTemplates** (`viewtemplates/*`): `activity`, `image`, `event`, `event-list` (tab list
  "Timeline"/"List" in `event-list/tabs`, also used by the `Event` hub; the caller sets the filter
  variable `trpg-events`; for a location the events of all places within and the `<<spotlink>>`
  references; contents `event-list/timeline` + `event-list/list`), `fields` (the block of
  values below the image, before the body, like the stat block of a rulebook: header line,
  sections parted by rules - the fields of no group with the price, then the groups as lines,
  a row or one inline line -, the relations a group names; rules in the colour of the type),
  `source` (the
  field `source`: where the images come from, "Source: …" below the body),
  `location` (map block of every location, as tabs: "Map" - the first map with `location/map`,
  map graph, switches, buttons -, every further map, "Quests and rumours" (`location/quests`:
  the open quests that lead here and why, `questroutes`, as pills); tab state per location; below it the
  spots, see "Locations"), `image` (the
  field `image` through `trpg.images`: one image on its own, several as tabs),
  `location-path` (path below the title), `checks` (the messages below it, see "Checks"),
  `hub-rule` (the rule below title and tags of a type hub),
  `book` (the file of a book, field `data`, below the body), `relations` (tab list "Graph"/"List" via
  `$:/plugins/flibbles/graph/ui/grouped-tabs`, tab contents `relations/graph` + `relations/list`;
  one type scope filter for both tabs; a tab state per tiddler, like "Timeline"/"List" of
  `event-list/tabs` - `$:/state/` is neither synced nor saved), `secret` (marker of a secret above the title: whom it is
  for), `player`
  (the field `player` of any figure). Order via
  `list-after`/`list-before`. Plus `body-filter`
  and `body-filter-sections` (cascade, see below), `body-filter-quest` (a quest or rumour, see
  "Quests").
- **Styles** (`styles/*`): `border` (border per type and a light tint inside, 9 % of its colour; generated from the hubs, the dead keep their grey; the colour as `--trpg-type` on the frame, which colours every rule in the tiddler as a line fading out), `item` (book
  rules, images and maps of `trpg.images` scaled to the width), `fields` (the block of values:
  rules above and below and between sections, header line, labels; static CSS, the colour of
  the type from `--trpg-type`), `dead`, `pinned`, `readonly`, `timeline`, `event` (event head,
  heading of a dated section, location pills), `location` (the pill of `trpg.pill`, the path,
  spot pills, spots, map buttons, the tab "Quests and rumours", the relation list: group
  headings, the tree with its arrow and line; static CSS, `type: text/css`), `path` (the font
  size of the path below the title from the theme; wikitext), `quest` (the frame of a marker in gold, a rumour dashed and striped
  at 45°, a quest and a rumour together gold, none on a card and in the history; `--trpg-rumour`,
  `--trpg-rumour-stripes` for the pills of the editor; wikitext),
  `checks` (the messages below the title: a bar on the left, an error in the alert colour, a
  hint muted; static CSS), `sections` (the frames of the sections - a line on the left in the
  colour of `Event` or `Location`, a lock framed in the alert colour with its marker as a bar -
  and the frame of a locked tiddler outside the frame of its type; wikitext for the colours),
  `view` (bar of the view, page control, cards of the `Player` hub; wikitext for the colour of
  `Player`), `hubs` (the hubs and `Campaign` in their colour, their lists, the list of the hubs
  of `Index`; see "Index/hub tiddlers"), `content` (the offer of a missing tiddler, the hub
  `Content`, a hit of a package in the search and in a picker; static CSS), `rules` (the tables
  of the hubs `Ruleset` and `CampaignSetting` and of the rules language, the choice of ruleset
  and setting, the converter of `Currency`, the highlight of the rules macros; static CSS) and
  `editor` (the controls of the editor, see "Editor").
  **Templates** `templates/body-locked`, `templates/body-sections` (body of
  a tiddler with sections through `trpg-body`; a location without its spots),
  `templates/quest-body`, `templates/quest-card`, `templates/quest-list` (see "Quests"),
  `templates/title-translated`, `templates/title-hub`, `templates/title-preview` (the heading
  of the preview of a package entry, see "Content packages"),
  `templates/subtitle`, `templates/tags` and `templates/tag` (tag area and tag pill, see
  "Views").
- **Configuration** (`config/*`): `type-colour`, `class-dead`, `class-secret` (class
  `trpg-secret-tiddler` for a locked tiddler the view sees), `class-rumour` (class
  `trpg-rumour-tiddler` for the page of a rumour the view sees: dashed and striped in gold, styles/quest),
  `class-pinned`, `class-readonly`, `class-rules-highlight` with `rules-highlight`,
  `class-view`, `class-hub`, `title-translated`, `title-hub`, `subtitle`, `view-tags` - see
  below; `dm-published`
  (`$:/config/tiddlyrpg/view/dm-published`, default `no`) and `sidebar-tabs` (hides the core
  sidebar tabs, see "Views"); for the editor `form/<type>`, `form-fields-hidden`,
  `field-editors`, `shortcut-info` and `symmetric` (see "Editor").
- **Search** (override of `$:/core/ui/DefaultSearchResultList` plus `search/item`): core search
  plus hubs whose translated name matches, hits shown with translated names; switches of the
  kinds above the hits (`trpg.kindswitches` in mode `select`, filter `kindselected`, state
  `$:/state/tiddlyrpg-core/search-kinds`): none chosen is all. The link dropdown of the editor
  uses the same list.
- **Language packs** (`language/<code>/*.multids`): `titles` (`Title/<hub>`), `plurals`
  (`Plural/<hub>`), `fields` (`Field/<type>`, a relation in the relation list, forward;
  `Field/<type>/<hub>` its label on a tiddler of that hub, `relations.fieldLabel()`),
  `fieldinverse` (`FieldInverse/<type>`, the way back), `edges` (`Edge/<type>`, edge label;
  `Edge/<type>/<hub>` for an edge from a tiddler of that hub),
  `texts` (template texts).
- **Editor** (`editor/*`): the toolbar buttons `editor/toolbar/<name>` with their dropdowns
  `editor/toolbar/<name>-dropdown`, the icons `editor/icons/spot` and `editor/icons/section`, the text operations
  `editor/operation.js`, the form `editor/form` with the field editors `editor/fields/*`, the
  config of the picker `editor/picker` - see "Editor".
- **Index/hub tiddlers** (Person, Location, Organisation, Deity, Player, Artifact, Item,
  Material, Book, Consumable, Equipment, Event, Information, Folk, Class, Trait, Feat, Language,
  Glossary, Index, Quest, Spell,
  Creature: titles without prefix,
  tag `Index`; the categories also tagged `$:/tags/tiddlyrpg/Category`, see "Items and
  categories"; plus
  Campaign, Calendar, Currency, Ruleset, CampaignSetting): the hubs tagged `Index` are the types
  (`modules/types.js`) - their `color` field gives graph nodes, tiddler borders, the rules in a
  tiddler and tag pills their colour; `caption` is `<<trpg.title ...>>`. `Campaign` is the pinned start page and no
  type: tag `$:/tags/Pinned` only, its colour (the grey of `Information`) is the one of campaign
  events in the timeline. `Index` has that grey too, for its tag pill only: it is tagged `Index`
  itself, so every reader of the colours of the types leaves it out (`modules/types.js`,
  `styles/border`, `config/type-colour`, `trpg.pillstyle`, `trpg.hub`). The
  hub `Secret` (the tag of the lock) has neither tag `Index` nor `color`: it must not colour or
  frame what it locks.
  - **A hub in its colour** (`trpg.hub`: tagged `Index` with a colour, not `Index`):
    `config/class-hub` gives its frame and the one of `Campaign` the class `trpg-hub`;
    `styles/hubs` sets `--trpg-hub` per title and frames, tints and colours the title from it
    (the frame comes from the title, not from a tag: a hub is tagged `Index` only);
    `viewtemplates/hub-rule` draws the rule below the tags (not on `Campaign`);
    `config/title-hub` puts the number of the entries behind the title
    (`templates/title-hub`; not on `Quest`, `Player`, `Event`, which show their own numbers or
    none).
  - **What a hub lists** - one source for its list, the number in its title and in `Index`:
    `trpg.hub.entries` (`trpghubentries` with the lock): the filter in the field
    `tiddlyrpg-entries` (`Item`: the three base types; `Information`: what it lists, the hubs
    `Calendar` ... only while they have something to show; `Quest`: the open quests and
    rumours), for a category its tiddlers with one of its base types, else the tiddlers tagged
    with the hub. A new hub with a list of another kind gets the field.
  - **The page** of every hub with a list is `<<trpg.hub.page>>` (`functions`; decided
    2026-10-25: one form for all, no headings per category): the hubs below it (`trpghubsubs`,
    rule `categories.subsOf()`: `Artifact`, `Material` and the categories of the items on
    `Item`, the categories of another hub, none on a category) that the view sees and that hold
    an entry it sees, as bars with their numbers, sorted by the name they show
    (`trpgsortname[plural]`) in the columns of the list, then its list. It reads `currentTiddler`, so a
    category hub of a campaign may be `{{ || Item }}` as well - a template for several hubs
    never names one (`test/hubs.test.js` checks every hub against its `trpghubentries`).
  - **The list** `trpg.hub.list(filter)` (`functions`): what the view sees of the filter, sorted
    by the display name in the collation of the wiki language (`trpgsortname`; `sort` of the
    core compares code units, an umlaut would follow "Z"), in columns, a heading per first
    letter (`trpginitial`: without accent, `#` for the rest), taken from the entries the view
    sees.
  - **`Index`** lists the hubs, `Quest` and `Player` by their plural with their numbers; `Campaign`
    sets the heading of the player characters itself and floats `Index` beside the cards below
    it, `Player` leaves that heading out while `trpg-player-heading` is `no`.
- **tw5-graph schema + graph templates**: field edge types (`$:/config/flibbles/graph/edges/fields/*`,
  with `tiddlyrpg-targets`: what the field may name, see "Relations") + relink field types; the function edge types `rules` (leader -> location, "controls"),
  `spots` (a spot that is a location -> the location it is part of, dashed) and a copy of
  `links` of tw5-graph (grey, symmetric); the axes
  `$:/config/tiddlyrpg/graph/axes[/<axis>]` (see "Relations"); relink of the macro parameters
  of `spot` and `spotlink` and of `entry` of `rule` (its `name` is no title; a name inside a
  formula is not relinked); the graph templates
  `$:/plugins/tiddlyrpg-core/graph/templates/trpg-graph` (type colours from the tag `color`,
  `shape=box`, no saved positions, the switches by kind above it, state
  `$:/state/tiddlyrpg-core/graph-filter/<view>`), `.../trpg-ego`, `.../trpg-quest` (graph of a quest, see
  "Relations") and `.../trpg-map` (map of a location, see "Locations"); the views
  `$:/plugins/tiddlyrpg-core/graph/ego`, `.../graph/quest` and `.../graph/map` (outside
  `$:/graph/`, so not in the dropdown of the graph sidebar); the vis-network extensions
  `graph/map-fit.js` (`module-type: vis-property`, graph property `trpgMapFit`),
  `graph/map-pin.js` (`vis-property`, node property `trpgPin`),
  `graph/pill.js` (`vis-property`, node properties `trpgPill` and `trpgDead`: a node like a tag pill - its colour
  as the border, light inside, the label in the font colour of the graph; set by all three graph
  templates) and
  `graph/map-fit-message.js` (`vis-message`, `trpg-map-fit`). The thin view definitions
  (`$:/graph/Default`/`Cosmogram`/`Atlas`/`Items`) live in each wiki on purpose, not here.

The fixture plugin `fixture-setting-harptos` (`test/fixtures/plugins`) contains no code:
`$:/tiddlyrpg/calendar/Harptos` (data), `$:/config/tiddlyrpg/calendar` (activates it) and
`language/<code>/` with `Calendar/Harptos/...` - a copy of the data of
`tiddlyrpg-setting-forgottenrealms` in the repo `TiddlyRPG-DnD`, so the engine tests need no
other repo.

## Readme and license of a plugin

The texts of a plugin's tabs "readme" and "license" live **once**, in the files of its repo -
never copied into the plugin folder. Every plugin (here and in other repos of the family, e.g.
`TiddlyRPG-DnD`) is built the same way:

- `plugins/<name>/files/tiddlywiki.files` loads files of the repo root (paths
  `../../../README.md`, `../../../LICENSE`; TiddlyWiki resolves them from the folder of the
  file, as its own plugins load their `LICENSE`):
  - `LICENSE` -> `$:/plugins/<name>/license`, `type: text/plain` - the tab itself, or for a
    plugin with a notice of its own (see below) `$:/plugins/<name>/license/text`;
  - `README.md` -> `$:/plugins/<name>/readme`, `type: text/x-tiddlyrpg-markdown`; one of several
    plugins of a repo adds `"prefix": "<!-- wiki-select <name> -->\n"` (example:
    `TiddlyRPG-DnD`, which also takes the notice of its license tab from the README).

  Tiddlers from files carry no `created`/`modified`.
- `plugin.info`: `"list": "readme license"` (`staticfiles`: `license` only).
- The parser (`modules/markdown.js`, `parsers/markdown.js`) shows only the marked part of the
  README: the lines `<!-- wiki -->` ... `<!-- /wiki -->` (several parts are joined), or for one
  plugin of several `<!-- wiki NAME -->` ... `<!-- /wiki -->` (a part for several:
  `<!-- wiki NAME1 NAME2 -->`), chosen by the prefix `wiki-select NAME`; without markers the
  whole file. Keep the setup of the repo (npm, CI)
  outside the markers. It reads the Markdown the READMEs use (header of the module) and makes
  nothing wikitext: no link to a tiddler, no macro, no transclusion - write the README in that
  Markdown only; `test/markdown.test.js` checks the README of this repo.
- A plugin with a notice of its own (an attribution, the Fan Content Policy) has `license.tid` in
  wikitext: the notice (`$:/plugins/<name>/license/notice`, a named README section loaded like
  the readme) and `{{$:/plugins/<name>/license/text}}`.
- ControlPanel -> License (`ui/controlpanel-license`) lists every plugin with its tab
  `<plugin>/license`; a plugin of TiddlyWiki without one points to `$:/core/copyright.txt`;
  another one without a tab needs an entry in `$:/config/tiddlyrpg/licenses` (JSON, plugin title
  -> license name; today `flibbles/graph`), otherwise it shows "not stated". Above the plugins
  the license of the wiki itself: `$:/tiddlyrpg/license` (its `LICENSE`) and
  `$:/tiddlyrpg/license/notice` (its README section), loaded by
  `tiddlers/license/tiddlywiki.files` of the wiki repo (see the `CLAUDE.md` of `TiddlyRPG`).
- The license of this repo: MIT (`LICENSE`, `"license"` in `package.json`).

## Plugin types ruleset and setting

Data plugins of other repos (`TiddlyRPG-DnD`) are a `ruleset` (rules system: rules domains,
`$:/tiddlyrpg/rules/system`) or a `setting` (campaign setting: calendar, currency).
Of each type one is active, chosen in
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
  dispatch, tests wait for it. When raising TiddlyWiki, compare the subclass with
  `$:/core/modules/pluginswitcher.js` and `$:/core/modules/startup/plugins.js` of the new
  version (`test/plugin-types.test.js` covers the behaviour, not the copy).
- The choice is made under ControlPanel -> Settings -> TiddlyRPG (`ui/settings-ruleset`); the
  tabs `ui/controlpanel-rulesets` and `ui/controlpanel-settings` list the plugins under
  ControlPanel -> Plugins ("Rulesets", "Campaign settings").
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
- Display names of titles: `Title/<title>`; a title `<parent>/<leaf>` whose parent exists
  shows the translated leaf (`Notes/Campaign` -> "Notes/Kampagne"). Used by the title
  cascade (`config/title-translated`), the tag pills (`tag-pill-inner`, see "Core overrides"),
  the search and the hub lists.
- **Texts that need refreshing go through filtered attributes, not JS macros.** A JS macro call
  only re-renders when its parameters change; a filtered attribute is recomputed on every
  refresh. That is why the date output is filter operators plus procedures
  (`<$text text={{{ [<date>dateformat:era[]] }}}/>`).
- Places that show `caption` only as plain text (`$view`) cannot be translated: the graph
  settings of tw5-graph (template and view captions). Graph view captions belong to the wiki.
- Known limits: the tag dropdown does not suggest "Ort" (filter hard-wired in
  `$:/core/macros/tag-picker`); sidebar "Open" and link texts without alias show the English
  title; field names in edit mode stay English.
- **Rules language** (rule in the header of `modules/language.js`, filters `trpgruleslang`,
  `trpgruleslangs` in `filters/rules.js`): the terms of a rules domain may follow another
  language than the wiki. Domains are JSON data tiddlers tagged `$:/tags/tiddlyrpg/RulesDomain`
  from the active ruleset or setting (`domain`, `type`, `keys` and what the type needs, in the
  JSON - the field `type` is the content type, `application/json`); the core knows the
  types (`calendar`, `unit`, `label`, `tokens`, `damage`, `currency`, `section`, `table`), never a
  domain name. A
  domain belongs to a group, `ruleset` or `setting` (`domainGroup()`, operator
  `trpgrulesgroup`: the type of its plugin; a domain without tiddler belongs to the setting),
  and each group has a setting of its own: the DM sets the language shown under
  `$:/config/tiddlyrpg/rules/<group>/...` (modes `wiki`, `all`, `domain`), so the ruleset in
  English does not turn the month names English. Nothing decides how a text is read: words of
  every language are read, and a number needs its unit (`<<unit 60 kind:"range">>` gives a hint; a kind
  only chooses the display). `lookupRules(wiki,domain,key)` looks a key
  up in the display language of the
  domain, then en-GB. Only terms go through it - the calendar names (`calendar.js`), not the
  texts of hubs, the calculator or the date patterns. A domain without tiddler (an own calendar
  without setting) follows the mode; in the mode `domain` it gets the wiki language. JS that
  shows terms refreshes on `$:/config/tiddlyrpg/rules/...` (the timeline does).
- **Rules engine** (`modules/rules.js`; the data formats of the domain types are in its header,
  the one place for them): the procedures `unit`, `dice`, `damage`, `term`, `rule` (`functions.tid`,
  filtered attributes) through the operator `trpgunit` and the parts of `trpgdiceparts`,
  `trpgdamageparts`, `trpgtermparts`, `trpgruleparts` - JSON `[{text, to, anchor}]` that
  `trpg.ruleparts` draws as one span `trpg-rule` with the links inside (a term to its entry of the
  glossary, a name to its target with the jump mark). A value of `<<term>>` that is no number, a
  text of `<<dice>>` with more than dice, numbers, + and -, and the calculation of a part of
  `<<damage>>` with a name, a term that is no damage word, `* /` or brackets are formulas
  (`modules/formula.js`, its header: the pieces, the spaces, the problems); `dice()` itself stays
  as it was, `damage` and the fields use it. `<<rule "Name" entry:"Entry">>` and a name in a formula
  (`'Name|Entry'`) resolve through `glossary.ref()` in the view (`check()` passes it on).
  It knows no word of a rules system - units, tokens, damage words and labels all come from the
  domains and the language keys of the active ruleset or setting; the die letters of a damage
  calculation are the tokens of the `tokens` domains. Parsing reads the words of every language,
  showing uses the display language of the domain. What is not understood shows unchanged;
  `check()` gives the problems for the rule `macros/rules` (see "Checks") and leaves out calls in sections the active view does not see (the hint would show their
  text, `sections.hiddenRanges()`). Numbers show with `Number/Decimal` of the wiki language.
  `value(wiki,spec,text)` reads the value of a field by its format (`unit`, `damage`, `dice`,
  `label`, `labels`, `number`, `boolean`, `text`; header of `value()`), for the fields of the
  schema. Label domains may hold main entries and properties and be extended by a campaign: the
  rules of reading, showing and uniqueness live in `modules/labels.js` (its header); the
  extensions are merged by `language.domains()`, their problems and those of the data are the
  rule `plugins/domains`. Which fields a type has comes from the ruleset too: JSON tiddlers
  tagged `$:/tags/tiddlyrpg/RulesFields`, the definitions once (`$:/tiddlyrpg/rules/fields`)
  and schemas that list them per type, merged with those of the wiki (`modules/fields.js`, its
  header; rule `fields/schema`). Derived values are data too (a modifier formula, a column of a
  domain entry, a sum of parts) and read only fields of the tiddler itself; nothing derived is
  stored, and no value is inherited - a base item gives its values once (`copyFrom()`). Labels
  `Rules/Field/<field>` follow the display language of the field's domain, else
  `language.lookupGroup()` of the ruleset.
- **Hubs `Ruleset` and `CampaignSetting`** (`Ruleset.tid`, `CampaignSetting.tid`, each hidden
  from `Information` without its plugin): the name (`Rules/System/Name`, `Setting/Name` of the
  plugin), then per domain of the group (`trpgrulesdomains[ruleset|setting]`) the HTML table of
  `rules.table()` (operator `trpgrulestable`) - the column of the display language of the domain
  (a key missing there in en-GB, like `lookupRules()`): the current state, not every language;
  calendar and currency point to their hubs. The
  settings tabs of the two groups link to them. They show terms and data of the plugins only,
  no wiki titles.

## Checks

The problems of a tiddler are rules in modules of type `trpg-check` (`checks/<theme>.js`), run
**once** by `modules/checks.js`; the list of the rules with their ids and levels is in
`README.md` ("Checks"). The same rules give the messages below the title
(`viewtemplates/checks`, filter `trpgcheck`, `styles/checks`) and the report of
`scripts/check-wiki.js`.

- A rule: `{id: "<theme>/<name>", scope, run}`. Scope `tiddler` (default):
  `run(wiki, title, view)` gives the messages of the tiddler; scope `wiki`: `run(wiki, view)` gives
  messages over the whole wiki, each with its `title` (quests, plugins; also a title that is no
  tiddler - a rumour - which only the script shows). A message is `{level, key, params}`: the
  level `error` (broken, does not work as meant) or `hint` (fine, but better with ...), a
  language key `Check/<Theme>/<Name>` (older keys such as `Section/Check/*`,
  `Location/Check/*` stay) with its `$name$` values. No text in a rule: `checks.text()`
  translates in the wiki language, for the view and the script alike.
- The view: every rule takes it and leaves out a whole message that names a title the view does
  not see or repeats text of a section it does not see (`visibility.visible`,
  `sections.visible`, `sections.hiddenRanges`). A message that tells there is something the view
  does not see (`LockedParent`) only for the DM. The script runs in the view of the DM. The sweep
  in `test/views.test.js` covers the messages (they render in the editable view template);
  a rule that names another tiddler gets a fixture there.
- Switching off: `trpg-noerror`/`trpg-noinfo` hold rule ids (`switchedOff()`); present but empty,
  every message of the level. `checks/checks.js` reports an id that is no rule. A new rule is a
  new id: keep ids stable, they stand in wikis.
- `forTiddler()` caches per view and title in the global cache (cleared on every change); the
  rules of scope `wiki` run once per view. `all()` is for the script: every tiddler that is no
  system tiddler (graph views aside) and no draft, plus the titles of the scope `wiki`.
- Files: `images/files` needs the folder of the wiki (`checks.setFolder()`, set by the script);
  in the browser it gives nothing. Everything else needs no file system.
- Fixes: a message may carry `fix` (its kinds in the header of `modules/checks.js`): what its
  button in the form of the editor changes in the draft (`modules/fixes.js`), or `create` (a new
  draft). Only where the change is clear; what needs a decision stays a message. `forDraft()`
  runs the rules on a draft; those that read what other tiddlers say about it (`SAVED`) run on
  the title it is the draft of and leave out what the draft has fixed already.
- Missing fields: a message that reports a field the tiddler lacks names it in `missing`
  (`expected/*` but the text, `dates/event`). The form of the editor shows `list` of its type
  (see "Editor"); `test/editor-form.test.js` holds `list` and `missing` in step.
- `types/missing` leaves out the pages in `types.UNTYPED` (`Campaign`, the start page).
- A new rule: a module (or an entry in the module of its theme) with the rules in its header, its
  keys in `language/<code>/checks.multids` of every language, its row in the table of the
  README, tests in the file of its topic (`checks.test.js` for one without a topic), for a
  missing field `missing` and `list` of the form. A new theme
  goes into the list of `test/checks.test.js`.

## Editor

The editor of a tiddler is where the DM changes things; the view gets no buttons that change
anything, except "+" on the hubs and the buttons of a rumour ("Create quest" opens a draft,
"Rename" - a rumour has no editor). What the buttons do to a text lives **once** in
`modules/editor.js` as plain functions on `{text, selStart, selEnd, tags, fields, title}`, so the
tests reach it without a browser; the wikitext only asks and passes values.

- **Toolbar** (`editor/toolbar/*`, `$:/tags/EditorToolbar`): `condition` on the type of the draft
  (`trpgtypes`, also a translated tag) and on wikitext (`trpgwikitext`). A button with a dropdown
  sends `tm-trpg-probe` (kind): `startup/editor-messages.js` finds the edit-text widget among
  the parents and runs `trpg-probe` of `editor/operation.js` on `engine.createTextOperation()` -
  not as a text operation, whose focus would close the dropdown just opened. The probe writes
  `$:/temp/tiddlyrpg-core/editor/probe/<draft>` (JSON: form `short`/`block`/`""`, params,
  date number, quest markers, the spot of a sub-location) and the values to edit into
  `$:/temp/tiddlyrpg-core/editor/input/<draft>`. The dropdown acts with
  `tm-edit-text-operation` `trpg-edit` (kind, op, values): `editor.apply()`, then the smallest
  replacement, so Ctrl+Z works (not in Firefox, whose engine has no undo). A result may change
  fields of the draft (the date field), create a tiddler (sub-location) and open it, or name a
  language key why nothing changed (a notification).
- **Rules of the buttons** (header of `editor.js`): without selection the short form before the
  unit at the cursor (a quest marker at the start of its paragraph or list item); behind the
  last unit of a level, on a line of its own, at the cursor, and the cursor behind it (a lock:
  an empty block with the cursor inside); with a selection the block form (lock and quest inline
  within one paragraph). A value with both quotes that no quoting holds is refused
  (`Editor/Error/Quotes`); a macro parameter falls back to `[[...]]`. At an existing marker
  the dropdown changes or removes it, never sets a second one. The quest status cycles open ->
  `complete` -> `failed` -> open and never removes the marker. A date keeps the field `date` in
  step (n-th marker = n-th section, explicit numbers count on). "Make a sub-location" saves
  the new tiddler at once with the text, images and lock of the spot and keeps the marker; a
  title another tiddler has in any case is refused (`editor.taken`, files would clash). The
  button "Section" sets the kinds of the ruleset (`trpgsectionkinds`, kind `section` of the probe
  and of `apply()`, the kind in `section`): a menu of the kinds, then the name (the kind chosen in
  `$:/temp/tiddlyrpg-core/editor/input/<draft>/section`, apart from the input, so the name keeps
  its focus; each probe clears it); the short form before the text of the paragraph - behind a
  lock, before a quest marker, behind a date or a spot the text a paragraph of its own (in the same
  paragraph it would not count), a line of markers standing for the paragraph after it; a marker
  found from the end of the head (a date behind an effect ends it); a name needed but for a kind with an intro; at a marker another
  kind (`retype`, with the name in the input), another name, remove. An entry
  of a content package chosen in a relation, the row "Possessions" or the button "Content" is
  taken (saved) at once as well (`tm-trpg-content-take` with `draft`). A tiddler
  saved at once is noted for the draft (`form.noteCreated`,
  `$:/temp/tiddlyrpg-core/editor/created/<draft>`): cancelling the draft deletes it again and takes it out of the story while it is unchanged and
  not open in the editor (`startup/editor-states.js`, `form.undoCreated`), saving the draft keeps
  it (hook `th-saving-tiddler`); a notification names what went and what stayed. A selection of
  whole lines takes the blank lines after it along.
- **Form** (`editor/form`, `$:/tags/EditTemplate` after the body; `modules/form.js`): per type
  `$:/config/tiddlyrpg/form/<type>` with `list` (the fields whose absence a check reports, the
  `missing` of its messages - `editor-form.test.js` keeps them in step) and `more` (the other
  fields of the type). It shows `list`, the fields added (`$:/state/tiddlyrpg-core/form-extra/
  <draft>`) and every field it knows that the draft has; the field list of the core hides those
  (`config/form-fields-hidden`, global). The field editors (`editor/fields/*`) come through the
  cascade `$:/config/FieldEditorFilters/tiddlyrpg` (`trpgfieldeditor`), so "add field" of the
  core gets them too. A relation field picks from `tiddlyrpg-targets` of its config
  (`relationcandidates`); `form.SINGLE` (one `location`, one `owner`) follows
  `locations/structure`. An item gets its categories as pills, one at most. The fields of the
  rules (`modules/fields.js`) come from the schema of the types of the draft: shown when
  written, offered when their `when` holds, after the general fields; their editor
  `editor/fields/rules` picks the input by format - a checkbox (boolean), a select (one entry), pills
  (a list without values: entries that stand alone, then the properties of those chosen), else text
  - with a reading below (the value as shown, the derived value of an empty field, the
  problem; `trpgfieldreading`). A ruleset hides its fields from the field list of the core
  itself (`config/form-fields-hidden` of the plugin; `fields/schema` reports one it does not).
  Below the fields
  the messages of the draft (`trpgdraftcheck`) with their fixes (`tm-trpg-fix`,
  `modules/fixes.js`) and "Do not report".
- **States** (`startup/editor-states.js`): the temp and state tiddlers of a draft go when it
  goes (saved, or cancelled and confirmed - a change listener, the hook of cancelling runs
  before the confirmation). A change of type (from one type to another, not the first type)
  takes out the known fields the new type has neither in `list` nor in `more`, with a
  notification of those that had a value.
- **Symmetric relations** (`startup/symmetric.js`, `modules/symmetric.js`): hook
  `th-saving-tiddler` compares with the tiddler the draft was of and writes the other ends
  (and their open drafts), also on a rename; switch `$:/config/tiddlyrpg/editor/symmetric`
  (`ui/settings-editor`). Ways past the navigator do not run it: they must not write symmetric
  fields.
- **Controls** (`editor/procedures`, `styles/editor`): choose - pills in the colour of the type,
  outlined when not chosen, yellow for a new name or one written almost alike; do - one button
  in the accent colour at the right; take out - × at a pill, "Remove" as a red outlined button
  at the left; menu - a row per entry across the dropdown, filled in the accent colour while
  hovered, the entry there checked and no button (`trpg-editor-menu`). Text in `--trpg-ink` (black, or the foreground of a dark palette). The picker
  (`trpg.picker`) is `keyboard-driven-input` with the config `editor/picker`; its list shows
  while the input has the focus and runs its actions on `mousedown`.
- **Focus**: anything that reads what an input holds is a procedure transcluded after the
  input, never a variable around it - that would render the input anew on every key.
- **Wikitext pitfalls met here**: `{{{ }}}` cannot nest (use `$let`); a regexp operand cannot
  hold `]` (put it into a procedure variable); `\whitespace trim` eats spaces between elements
  (`addprefix`/`addsuffix` in the filter); `:filter` sets `currentTiddler` to each item;
  `count[]` gives `0` on empty input; `jsonget` reads JSON null as `null`; the core styles every
  button in `.tc-editor-toolbar`, also those of its dropdowns.
- **Visibility**: every list of candidates goes through `trpg.visible` (the config of the
  picker, `trpgsimilar`, the "new name" pill); values that stand in the draft show as they are.
  The sweep in `test/views.test.js` renders the pickers and dropdowns with a draft.
- **Tests**: `editor.test.js` (the functions on text), `editor-form.test.js` (form, the fields
  of the rules in it, values from a base or without a relation - also the way in the browser:
  the actions of the templates against the listeners of `startup/editor-messages.js` and
  `startup/content.js`, the route as a stub -, symmetric, fixes, a created
  tiddler undone on cancelling, notifications), `editor-ui.test.js` (buttons, dropdowns - the menu of the button Section -, "+", rumour), `inputs.test.js` (focus of
  every new input).

## Unknown macros

`modules/macros-check.js` (rule `macros/unknown`, key `Text/Check/UnknownMacro`): a call
`<<name>>` that nothing defines renders nothing - a typo disappears silently. Reported below the
title (editable wiki only) and by `check-wiki.js`. Defined is a name that is global
(`GlobalImportFilter`, the view template import tags, JavaScript macros), set around the call
(pragmas, `$set`, `$let`, `$vars`, `$list`, `$range`, `$wikify`, `$parameters`) or a variable of the page and view template (the list
`CONTEXT`, measured with `[variables[]]` in the body of a tiddler in the story; `tv-*`). Inside
`$importvariables` and the widgets that hand variables to their actions every name counts.
Calls in code and in definitions are not looked at; calls in a section the active view does not
see are left out, like the hints of the rules macros. The check over the three wikis found
nothing to add to the lists.

## Currency engine

`modules/currency.js` knows no particular coins. `active(wiki)` reads the JSON data tiddler named
in `$:/config/tiddlyrpg/currency` (cached per tiddler), or returns null; the coins come from the
campaign setting or from the wiki, like the calendar. Data model, price syntax and the problems:
module header.

- A price is shown as written; the unit labels change to the display language of the rules
  domain of type `currency` (`Currency/<id>/Unit/<coin>`), a number shows like the converter does:
  thousands grouped and decimals marked as the wiki language does (`Number/Group`,
  `Number/Decimal`; "12000 gp" is "12.000 GM"). No coin is converted (150 cp stays 150 cp).
- A point, comma, space or apostrophe before groups of three digits, after a first group of one
  to three that is no 0, separates thousands ("12.000", "12,000", "12 000", "1.000,50") - the
  marks of the whole numbers of the rules; else a point or comma is the decimal mark ("1,5",
  "2.50", "0.500"). The groups first: "1.500" is 1500 - no price has three decimals, and the
  SRD writes "1,500 gp" for fifteen hundred (`numberValue()`). The converter groups its
  results the same way (`priceconvert`).
- Units are read in every language, case-insensitive. `<<unit>>` reads coins only when the text
  holds no length or weight: the German copper piece is "KM", the length "km".
- `reference` is the coin that matches the price unit of the ruleset (`currency-reference` of
  `$:/tiddlyrpg/rules/system`): read, checked (hub hint, `check-wiki.js`), shown, and used by
  `fromRules()` to write a price of the ruleset in the coins of the setting (the coin of
  reference, else one a power of ten below it - no electrum -, else the smallest).
- A range (`50-100 gp`, `50 to 100 gp`; words `Currency/Range/Parse` of the language packs of
  core, no word of a setting) is read, shown (`Currency/Range`), checked (`Item/Check/PriceRange`)
  and converted bound by bound.
- Without a currency a price is a plain number; with one it needs a coin (`items/price`, keys
  `Item/Check/PriceNoCurrency` and `Item/Check/PriceCurrency`). The hub `Currency` is hidden
  from `Information` without a currency.

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

The order of day and month in the text of a date (`dates.dateOrder()`):
`$:/config/tiddlyrpg/date/order` `dm` ("5. Flamerule 1351") or `md` ("Flamerule 5, 1351",
the comma only after a day; a range in one month "Flamerule 5 – 24, 1351"), otherwise `Date/Order`
of the wiki language. The patterns are language keys (`Date/DayMonth`, `Date/Day` for `dm`;
`Date/MonthDay`, `Date/MonthDay/Day`, `Date/MonthDay/Year` for `md`). Set in ControlPanel ->
Settings -> TiddlyRPG -> "Campaign setting options" (`ui/settings-setting-options`, with a
calendar); the timeline
refreshes on it. The event table keeps its columns.

## Dates

`modules/dates.js` holds the rules of the `date` field and of the dated sections - nothing else
splits a date. Syntax and meaning: module header and `README.md` ("Dates"). Points to keep in
mind when changing it:

- `parse()` results are cached per string and shared; callers must not change them. `trpg.dead`
  runs through ClassFilters and graph templates for every visible tiddler on every refresh.
- A single point means a point in time for events and a start with an open end for every other
  type; the timeline band and `trpg.dead` rely on that.
- Several sections of a non-event are its phases: each but the last ends (`openPhases()`,
  otherwise the hint `dates/phases`), a death before a return. The last phase decides
  `trpg.dead` and is the date line (`formatLast()`, flag `last` of `dateformat`); in the
  timeline each phase is a band of its own, and an unknown side only looks at the mentions
  between its neighbours (`collectBand`, `s.from`/`s.to`).
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
- The caption of a section is inline wikitext: `<<date label:"Fight at <<unit '30 ft'>>">>` (other
  quotes inside). The heading transcludes it (`functions.tid`), the event table puts it into
  its wikitext row, the timeline renders it as plain text for card and tooltip
  (`TimelineWidget.caption()`, only a caption with `<`, `[` or `{`; `$5$` stays as written).
  A link in a caption is no TiddlyWiki link (no backlink, not in `sectionlinks`), like a spot
  name; renaming works through the relink configuration of `date` - `label` - and the attribute
  `label` of `<$date>`. Search and jump marks keep the stored text. The caption is named only:
  a text by position (`<<date "Caption">>`) is no caption but a hint of `sections.check()`
  (`Section/Check/DateLabel`, only for a section the view sees - the hint repeats the text).
- Parameters of the macros of the wikis: the required ones by position, the optional ones
  named, each called after what it holds: `<<date 3 label:"…">>`, `<<spot "Name"
  tiddler:"…" image:"…" map:"…">>`, `<<image "a.png" folder:"…">>`, `<<unit "60 ft"
  kind:"range">>`, `<<term wis variant:"save">>`, `<<term frightened value:2>>`. Named by
  position, but with the names of what they hold: `date` `section`/`label`, `spotlink`
  `location`/`spot`. The block forms `<$date>` and `<$spot>` have the same names as attributes;
  Relink knows `spot` `name`/`tiddler` as macro parameters and as attributes of `<$spot>`, and
  `spotlink` `location`/`spot`.
- `sectionAt()` (operator `datesection`) finds the section a date falls into by overlap of
  their days: of several the narrowest wins, on a tie the first; "."/".." are open sides. It
  never falls back to "the section before" - a jump to the whole event is better than one to
  the wrong section.
- `scripts/check-wiki.js` checks a wiki with the rules of "Checks" (boots it with the plugins of
  this repo and of the packages in its `node_modules`, so its calendar applies). Its report and
  its checks are tested in `test/check-wiki.test.js`.

## Jump marks

TiddlyWiki has no anchors inside a tiddler: a link opens the tiddler, and a `tm-scroll` sent
from wikitext right after `$action-navigate` comes before the refresh that shows it. So:

- A **jump mark** is any element with `data-trpg-anchor="<name>"` inside a tiddler, name in
  kebab-case. The section headings of the procedure `date` carry one (`date-<n>`) - not a
  section at the very start of the body, where a jump would only hide the title -, the
  headings of spots (`spot-<plain name>`, `spots.anchor()`) and the frames of quest markers
  (`quest-<key>`, `anchor()` of the kind in `modules/sections.js`; none for a marker before any
  content of the body, `lead` of the model), the named sections of the kinds of the ruleset
  (`<kind>-<name>`, "feature-rage"; not at the very start either) and the heading cells of the
  tables of a body with sections (`column-<heading>`, `markColumns()` in `transform()` - the
  cached parse tree is copied on the way to a cell, never changed; `orderedAttributes` too, the
  element widget renders those). All names through `sections.slug()`. A kind of section gets its
  mark through `anchor()`, `widgets/sections.js` sets it.
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
  `$:/state/tiddlyrpg-core/location-tab/<title>`; the spots stand below the maps, outside any
  tab.
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
  location (`locations/structure` reports more, or both). Items are occupants like everyone else:
  in the tree of the relation list and in the ego graph of a location.
- The path below the title (`trpg.locationpath`, filter `locationgroups`): for a location its
  parents; for every other type the places of `location` and the locations of `leader`
  together, one line per parent path, the places of a line side by side ("Materielle Ebene ▸
  Andu Falas ▸ Königreich von Vandalia ▸ Cair Di Golwyn"). Every step a small pill
  (`trpg.pill`, class `trpg-pill-small`), between two steps the arrow of a folded place in the
  relation list (`span.trpg-arrow`); the places of a line one block that wraps in itself
  (`trpg-location-path-places`), its second row below its first pill. The font size comes from
  the body (`styles/path`): the path sits outside it. It says where a tiddler is, not how it is
  tied to a place - that stays in the relation list.
- Secret presence: an entry of `location` that points to a `Secret` location is missing in the
  views that do not see it - in `trpg.locationpath` the place, and its line if no other place
  is left in it (the path above it would tell where it lies), and the occupant among the places above, since the walk of `occupants` only
  goes through spots and the lists filter with `trpg.visible`. A locked spot joined to a location
  hides only where it lies (`spots.ownsVisibly`: no parent, not among the children). Test:
  `views.test.js` ("secret presence").
- Spots: `<<spot "Name">>` begins a section that runs to the next marker, `<$spot name="…">`
  is the block form (see "Sections"). The name may hold wikitext; its plain text (links
  replaced by their visible text) is the anchor, the node label and the target of
  `<<spotlink>>`. Joined to a tiddler: `tiddler:`, or a tiddler with the plain name.
  `<<spotlink "Place" "[[Text|Spot]]">>`: here the target of the link counts. Both come from
  the model of the body. They are no TiddlyWiki links: no backlinks, not in "Missing"; renaming
  works through the relink configuration of the macro parameters.
- A spot the view does not see (locked, or joined to a tiddler it does not see) is left out by
  `spots.visibleSpots()`: the operators `spots`, `spottargets`, the children and the
  parent of a location (`filters/location.js`), `spotowner` and `spotlinked`.
- `spots.index()` (global cache, whatever the view): which locations have a tiddler as spot
  (`spotowner`), which tiddlers reference a place with `<<spotlink>>` (`spotlinked`, used by the
  event list); the operators filter it by the view.
- The body of a location shows its text without the spots (`templates/body-sections`,
  `$omit="spot"`); the spots show below the maps (`trpg-body` `$only="spot"`), the text of one
  in the tooltip of its dot (`$name`, `$marker="no"`).
- Images and maps (`modules/images.js`, filters `imagetabs`, `maptabs`, `imagelist`, procedure
  `trpg.images`, procedure `image`): one entry shows on its own, two or more as tabs labelled
  with the file name without extension; a click opens the file only for a map. `<<image>>`
  shows the field `image` of the current tiddler (the view template `image` calls it),
  `<<image "a.png, b.png">>` files in a text, in the image folder of the tiddler's type,
  `folder:"event"` in another one; each call has a tab state of its own. The cards of the
  `Player` hub take the first image only, without tabs and link (`Player.tid`). The field `image` of every type (folder by type tag, `Information` in
  `images/information/`), the field `map` of a location (`images/map/`; the first one carries
  the graph, every further one is a tab with the image only; ids `map`, `map-<n>`), and a spot
  without a tiddler of its own: `<<spot "Name" image:"a.jpg" map:"b.jpg">>` (images in
  `images/location/`, maps in `images/map/`), tabs below its heading, its text below them. A
  spot joined to a tiddler shows nothing of it - that tiddler shows its own images; nor does the
  tooltip on the map (`trpg-spot-media="no"`). Tab states
  `$:/state/tiddlyrpg-core/image-tab/<title>` and `.../spot-tab/<location>/<spot>`. There are no
  battle maps of their own any more: they are maps. `checks/images.js` reports files that are
  not in `images/` (also of `<<image>>`; `scripts/check-wiki.js` only), `<<image "…">>` without
  `folder:` in a tiddler without type and images at a joined spot.
- Map (`graph/templates/trpg-map`): background the first file of the field `map`, drawn by
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
  visible. Above it the switches by kind (procedure `trpg.kindswitches`, the same as on the
  relations block; state `$:/state/tiddlyrpg-core/map-filter/<title>`, `trpg.kindshown`; a spot
  without a tiddler counts as a location), below them the buttons "Fit map" and "Edit
  positions". Quests: the open quests whose newest visible marker leads to a node of the map
  (`trpg.mapquests`, `questpins`, `modules/quests.js` `pins()`: the places it links, the spot of
  a `<<spotlink>>`, the field location of anyone else it links - only what stands in that
  marker, never the rest of its section -, each walked up its parents to the first node of the
  map) as pills with an edge to
  those nodes; one that only reaches the location itself stands in the grid below the map.
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
  like `location`, the relation list of the place has them under "Control"; `rules` includes
  `location` (see "Relations"), and `locations/led` hints at a `location` to a place the field
  `leader` already holds (`Location/Check/LedAndLocation`). The relation list shows the places
  led as the group "Controls".

## Items and categories

The rules of items live **once** in `checks/items.js` (base type), `modules/categories.js` with
`checks/categories.js` (the categories of every base type) and `filters/location.js` (owner and
location of an artifact). Meaning and examples: `README.md` ("Items", "Categories with a tree").

- Base types `Artifact` (unique), `Item` (several), `Material`; one per item. Everything that
  tells the item types apart (colour in the graph templates, `multitag` lists of `activity` and
  `relations`, the image folder in `modules/images.js`) names only these three - a category never
  stands alone.
- Categories are hubs tagged `$:/tags/tiddlyrpg/Category` with their base types in
  `tiddlyrpg-bases` (`Book`, `Consumable`, `Equipment` from here: `Artifact Item Material`;
  without the field the same; more from a campaign). The rule of them lives **once** in
  `modules/categories.js`; the tag before 2.2.0, `$:/tags/tiddlyrpg/ItemKind`, is read there as
  a category of the items. They need no code: a category hub is `<<trpg.hub.page>>` (or
  `{{ || Item }}`), which lists only its own items, and stands above the list of `Item`.
  Behaviour of one category hangs on its tag (`viewtemplates/book`, `styles/item`).
- The same for every base type: `Folk` is a category of `Information` (the colour of
  `Information`), one with `tiddlyrpg-bases: Person` a category of `Person`; the form offers the categories of the base types of a draft
  (`trpg.formkinds`), "+" on a category of one base type sets both tags at once
  (`ui/new-procedures`), `categories/base` (`checks/categories.js`) asks for the base type. A
  folk is named by the relation `folk` (axis family; several allowed, not in `form.SINGLE`) and
  shows the relations block (`viewtemplates/relations`) for its way back. Where it lives is its
  field `location` (`config/form/Folk`, several places; an occupant in `filters/location.js`, the
  group "Folks" of the place); the deities it worships its field `patron` (the same form; no
  `tiddlyrpg-sources`, so nothing else to change). `Class` is the same kind of category: classes, subclasses and
  lasting choices, named by the relation `classes` (axis family, several) from a figure, a spell,
  an item and from an entry of its own (`config/form/Class`: `classes spells`).
- **Trees** (`tiddlyrpg-tree` on the config of `classes` and `folk`, a filter of the holders):
  the same field says on a holder what it has and on an entry of the category what that belongs
  to. One place of the rules: `modules/relations.js` (`parents()` - also of a package entry not
  taken -, `holder()`, `lines()`); `relations/parent` in `checks/relations.js`; the way back by
  kind in `viewtemplates/relations/list` (order `trpg.kindhubs`); the lines of the player card in
  `Player.tid` (filter `trpgcardlines`: the class with its level in place of the line of the level,
  then the subfolk; the levels of `class-levels`; `tiddlyrpg-card: top` on
  `classes`: only the class, not its subclass and choices; `tiddlyrpg-card: leaf` on `folk`: the
  subfolk alone); the block of values shows the whole trees (a group of the schema names them in
  `relations`, filter `trpgtreerows`); `content.wanting()` offers the parents.
- `Trait`, `Feat`, `Language`, `Glossary` are categories of `Information` too; `feats` and
  `languages` relations (axis things). The glossary (`modules/glossary.js`, the one place): the
  field `term` of the core on an entry of `Glossary` names the term it explains; `<<term>>`
  (`functions.tid`), a value of the rules (`trpgfieldparts`, `viewtemplates/fields`) and the name
  of a section (`trpg.sectionname`, `trpgnamed`) link to it, a package entry not taken too.
- The format `titles` of a field of the rules (`modules/rules.js`: "Fighter 5, Rogue 8", options
  `titles`, `tree`, `sum`): the derive `else` and the part `values` (`modules/fields.js`), the rule
  `fields/levels`, the input `levels` of the form (`editor/fields/rules`, `trpglevelentries`,
  `trpglevelset`), the relink type `trpgtitles` (`modules/relink-titles.js`). A field of the format
  that names a tiddler the view does not see is left out of the block (`valuesOf` in
  `filters/fields.js`).
- **Term or tiddler** (decided 2026-10-25): a term of the ruleset (a domain) is what the rules
  compute with or check, a set the rules give, written short in a text (`<<term>>`); a tiddler (a
  category) is what a figure, spell or item has, with a text of its own, what a DM makes up -
  classes, folks, traits, feats, languages, the glossary. A tree when its entries belong to each
  other (`tiddlyrpg-tree`). A kind of item without effect on the rules is a category hub, an
  extension of a label domain (`"extends": true`) only for a kind the rules compute with. Domains
  stay: units, dice, damage, tables, sections, abilities, skills, senses, conditions, actions,
  item categories, kinds of languages.
- Their messages stand below the title (`items/base`, `items/price`: the price against the
  currency), see "Checks".
- The price (field `price`) shows as the first line of the block of values
  (`viewtemplates/fields`, before the body) through `priceformat` (see "Currency engine"), on
  any tiddler that has it, only for a tiddler the view sees.

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
- What a field type may name: `tiddlyrpg-targets` on its config, a filter of the candidates
  (measured against the campaigns, 2026-10-16), read by `relationcandidates` for the pickers of
  the editor. Without it every typed tiddler. `kindOf()` gives the kind of a title for the
  switches (relations block, map, graph views, search; the search adds `event`).
- Every type draws its own edges; two types between the same tiddlers are two edges (decided
  2026-10-08 against merging them into one labelled edge).
- `tiddlyrpg-inverse: yes` on a config (`owner`, with `tiddlyrpg-sources`): the form of a
  tiddler the type may name offers the way back ("Possessions": give an item), held in
  `trpg-inverse-<type>` of the draft and written to the other ends on saving
  (`modules/inverse.js`, `startup/inverse.js`).
- `tiddlyrpg-copy: yes` on a config (`base`): choosing the type in the editor copies the values
  of the rules of its target into the empty fields of the draft once (`form.copyFrom()`,
  `tm-trpg-copy`, the button "Take the values"); no value is inherited. The row "Take values
  from" of the form does the same from any source of the schema and sets the relation where
  it fits (`form.copySources()`/`copyValues()`/`relateCopy()`, `tm-trpg-copy` with `source`,
  `tm-trpg-content-copy` for an entry of a package, which is not taken). A relation to an
  entry not taken is no missing tiddler (`content.forRelation()`; `check-wiki.js` loads the
  index of the packages like the browser).
- The types in play: a graph view draws only some types (`edges.fields`/`edges.functions`);
  the override passes them on (`trpgTypes`), so a type left out does not hide another one. The
  relation list uses all.
- Function types run their filter in `targets()` with the tiddler as input and
  `currentTiddler`, cached per change of the wiki; `$nodes.neighbors` of tw5-graph runs the
  same filters itself to find neighbours, so a function filter must not depend on other
  variables. The way back of a function type needs the field its candidates come from
  (`tiddlyrpg-via`, `rules`: `leader`).
- Relation list (`viewtemplates/relations/list`): per type in order a group forward
  (`Field/<type>`, or `Field/<type>/<hub>` for the type of the tiddler: `relationfield`) and
  back (`FieldInverse/<type>`, falls back to `Field/<type>`), one group for a symmetric type, a
  tree its way back split by kind (`Plural/<hub>` in the order of `trpg.kindhubs`, the rest
  under `FieldInverse/<type>`); last the group "Quests". A group: a small heading with the number of
  its entries, the entries as pills (`trpg.pill`) side by side. On a location the way back of
  `location` gives the groups of the place (procedure `trpg.place`), in this order and only
  with entries, everyone in one of them: "Control" (`FieldInverse/rules`: who leads it),
  "Influence" (`Relations/Influence`: the other organisations there), "Present"
  (`FieldInverse/location`: everyone else), "Creatures" (`Plural/Creature`: the kinds living
  there, a creature may live in several places), "Folks" (`Plural/Folk`: the folks living
  there, several places alike), "Locations" (the places within as a tree - a
  branch with the number of its entries and the same groups inside, a leaf without; a spot
  dashed). `rules` has no way back anywhere else.
- The tree (`styles/location`): the arrow of a branch a CSS triangle in the colour of `Location`
  (`--trpg-location`, set by the template), pointing down when open, its tip on the line of the
  children; the measures in the comment there. Rows of pills are 4px apart everywhere (the pill
  22px high, a whole number); keep it when adding to the list.
- Quests are no relation type: the open quests whose visible markers link the tiddler
  (`questsabout`, `questmentions`, `modules/quests.js`) come into the ego graph as nodes of their
  own (`graph/templates/trpg-ego`) and into the list. Switches by kind above the block
  (`viewtemplates/relations`, filter `relationkind`, functions `trpg.egonodes`/`trpg.egoshown`
  in `functions.tid`, state `$:/state/tiddlyrpg-core/relations-filter/<title>`) leave a kind
  out of graph and list alike; the centre stays.
- A quest or rumour has the relations block too, with tabs of its own
  (`viewtemplates/relations/quest-graph`, `.../quest-list`, state
  `$:/state/tiddlyrpg-core/quest-relations-tab/<title>`): the events of its visible markers (edge with
  the date of the section, the newest with a thick border), what the markers there link
  (`questmentions<event>`), the quests linked with it at their event (`questlinkat`); the same
  switches, the events always shown (`graph/templates/trpg-quest`). In the list all of them
  pills: the event with its date, below it what its markers link, then "Connected"
  (`Relations/Quest/LinkedWith`) with the linked quests in gold, a rumour dashed and striped.

## Sections

The rules of the sections of a body live **once** in `modules/sections.js`; meaning and
examples: `README.md` ("Sections in the text", "Secrets in the text").

- Kinds: `date`, `spot`, `secret`, `quest`, each with a short form (`<<kind>>`, a transclude node with a
  position) and a block form (`<$kind>`, a JS widget of that name in `widgets/sections.js` - no
  core or plugin widget has these names; a wikitext `\widget` would need a dot). `register()`
  adds a kind: found, locked, nested and rendered without code of its own; the
  block widget is one `makeBlock()` line.
- Kinds of the ruleset (`rulesKinds()`): the entries of a domain of type `section` (D&D: effect,
  curse, trait, spellcasting, action ...) - short forms that run to the next marker like a date
  (so `<<secret>>` before one locks it), any tiddler, a name (`params.name`). On rendering
  `arrange()` collects the sections of these kinds of a level at the place of the first one the
  view sees (at a locked first one the others would stand before the text after it), in
  the order of the domain (`order`), a kind in the order of the text with its intro first; a kind
  with `heading` gets the widget `trpg-section-heading` before its first section, with the keys
  of its sections - it shows while one of them is visible. `intro`: one section without a name
  introduces the kind (checks `IntroMissing`, `IntroTwice`, `IntroAlone`, told at the first
  section concerned, counting what the view sees). In a short section of another kind (an effect
  in a dated section or a spot) such a section does not end it: `group()` keeps it in that
  section (`inner`), the walk and `transform()` read the rest as a level inside it - its
  sections are children of the dated section and locked with it. Reserved ids: the kinds of the
  core, `intro`, a widget, a global procedure or macro (`domainProblems()`).
  The core names none of them. They are known per wiki, so every function with a wiki first
  makes them the kinds of the model (`use()`), and the cached model carries their ids in its key.
  Their procedures (the name in bold, `trpg.sectionname`) are written by `startup/sections.js`
  into a temp tiddler tagged `$:/tags/Global`, their block widgets added to the widget classes
  (`registerBlocks()`, maker from `widgets/sections.js`) - both after `startup/plugin-types.js`
  has unpacked the ruleset, and anew when it changes. A block of such a kind runs its name into
  its first paragraph. `"lock": "<field>"` locks a section with a field of the rules
  (`fieldLock()`: as `secret-fields` locks the field - a curse with `cursed`); it counts in
  `visible()` and `lockOf()` like a lock of its own. Problems: no name, an empty lock field
  (hint); in the data an id of the core or of another widget, a lock field the rules do not
  define (`domainProblems()`, rule `plugins/domains`). The button "Section" of the editor sets
  them (see "Editor").
- One walk over the parse tree per tiddler (`read()`, cached) gives the records (kind, form,
  key = start offset of marker or block, parent, locks, text range), the links and `<<spotlink>>`
  calls with their innermost section, and the problems. `group()` splits one level into
  sections; the walk and the rendering (`transform()`) use the same function, so a rendered
  section finds its record by key. Pragma nodes at the start (`set`, `importvariables`,
  `parameters`) wrap all sections and are kept.
- Look (`styles/sections`): every kind a line on the left in its colour, the heading on top (a
  dated section after the start of the body with a rule above, `hr.trpg-date-rule`); a
  lock a frame in the alert colour of the palette with the marker as a bar. A locked section of
  another kind (`<<secret>><<date>>`) renders in a frame of its own
  (`div.trpg-section-lock.trpg-section-locked`) around the section, so it keeps its line.
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
- Problems (`check()`, as language keys): the rule `sections/structure` (`checks/sections.js`,
  see "Checks"); none for editor snippets.
- Not seen: markers that only exist when rendering (transclusions, `$list`, macros that write
  `<<date>>`) - the walk reads the text of the tiddler itself.

## Quests

Meaning and examples: `README.md` ("Quests"). The rules live **once** in `modules/quests.js`;
the marker is a kind of section (`register("quest", ...)` in `modules/sections.js`).

- Marker: kind `quest` with `nest` - its short form at the start of a paragraph or list item
  marks that block only and splits nothing (`group()` skips it); later in a block it holds the
  rest of it (a tinted span). Only in a dated section of an event; the problems (`check` of the
  kind, `sections/structure`; the wrong tiddler type is the general hint): no name, no dated section,
  a name that is a tiddler without tag `Quest`, an unknown status, a status by position. A quest
  marker directly inside one of another name links the two (`parent` of the mark); the same
  name inside itself is the usual hint.
- Index (`index()`, global cache, the same for every view): the marks in date order with their
  event, key, dated section, status, parent and links (`[[...]]`, `<<spotlink>>` with their
  innermost section). Everything else is computed when asked, for a view: status, newest
  marker, order, links, mentions, `about()` (open quests whose markers link a title), `routes()`
  and `pins()` (what the newest marker leads to on a map: a location up its path, a spot, a node
  of the map, the field `location` of what it links - nothing else of its dated section).
- Quest or rumour: a tiddler tagged `Quest` (`isQuest()`); a quest tiddler the view does not see
  hides its markers (`visible` of the kind). Classes `trpg-quest-real`/`trpg-quest-rumour` on the
  section, `trpg-rumour-tiddler` on the page of a rumour (`config/class-rumour`).
- Output: `viewtemplates/body-filter-quest` -> `templates/quest-body` (planning, buttons of a
  rumour - `tm-relink-tiddler` -, linked quests, history through `trpg-body` with `$only`/
  `$marker`); the hub `Quest` -> `templates/quest-list` -> `templates/quest-card`; relations,
  quest graph and maps (see "Relations", "Locations"). Relink: `macros/quest/name`,
  `attributes/$quest/name`.
- `checks/quests.js`: a quest tiddler without a marker, two names one step apart
  (`checks.distance()`, case, spaces and punctuation aside), at both names.

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
- Lock of values: `secret-fields` (empty or `all`: the whole block and the price, else the fields
  named), visible like `Secret` to the DM and the players of the tagged player characters
  (`visibility.taggedPlayers`, `fieldLocked`, `fieldVisible`). The block, the header line and
  every check of a value (`fields/*`, `items/price`) read a tiddler through `fields.seen()` -
  without what the view may not see, never `tiddler.fields` -, so a derived value of a locked
  field (a saving throw from `str`), a form that names it (the agreement
  `$size.@creature-type$`), a condition on it (`fields/when`) and a level by locked XP fall away
  with it; `all` takes the relations of the groups of the block too (the relation list shows
  them on its own). The reading in the editor shows every value (`trpgfieldreading`: the DM
  edits them); `copyFrom()` carries the lock along.
- Every place that lists titles filters with `:filter[trpg.visible[]]` (hubs, relation list,
  ego graph through `$whitelist` of `$nodes.neighbors`, `trpg-graph`, `trpg-map`,
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
  version. The pill itself: `tag-pill-inner` and `tag-pill-styles` in `functions` (see "Core
  overrides").
- `checks/locations.js` compares the audience of a location and its parent
  (`visibility.audience`) for the error `LockedParent` (`checks/locations.js`, view of the DM only).

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
  `trpg-dead`, stylesheet `styles/dead`), the graph templates, the atlas views of the
  wikis, `trpg.link` and `trpg.hub.list`.
- **`trpg.link`** - a link to a tiddler, struck through when `trpg.dead` holds (class
  `trpg-dead-link`, stylesheet `styles/dead`). The hub `Secret` lists its titles with it, the
  type hubs with `trpg.hub.list` (the same class, the display name).
- **`trpg.pill`** - a tiddler as a pill in the colour of its type, a link to it: the colour of
  the cascade `$:/tags/TiddlerColourFilter`, a rumour in gold, dashed and striped (class `trpg-pill-rumour`), else
  `tag-background`; striped when `trpg.dead` holds (class `trpg-pill-dead`, like its tag pill);
  extra classes (`trpg-pill-small`, `trpg-pill-spot`: dashed, tooltip "Spot") and a muted text
  behind it. The relation list, the list of a quest, the tab "Quests and rumours" and the path
  below the title list their titles with it (`styles/location`).

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
- `config/class-rules-highlight` (`$:/tags/ClassFilters/PageTemplate`): class
  `trpg-rules-underline` on the page container while `$:/config/tiddlyrpg/rules/highlight`
  (`config/rules-highlight`, default `underline`) is `underline`; `styles/rules` then underlines
  the span `trpg-rule` around what `unit`, `dice`, `damage` and `term` show (`functions`) dotted.
- `config/title-translated` (`$:/tags/ViewTemplateTitleFilter`, before `default`): tiddlers whose
  display name differs from the title get the heading `templates/title-translated`.
- `config/title-hub` (`$:/tags/ViewTemplateTitleFilter`, before `title-translated`): a type hub
  with a list gets `templates/title-hub`, the translated name and the number of its entries.
- `config/class-hub` (`$:/tags/ClassFilters/TiddlerTemplate`): class `trpg-hub` for a type hub
  and `Campaign` (`styles/hubs`).
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
| `tiddlyrpg-core/$__core_ui_DefaultSearchResultList.tid` | `$:/core/ui/DefaultSearchResultList` | `tiddlyrpg-core` | A second list tagged `$:/tags/SearchResults` would add a second tab with the same caption ("List"/"Liste") next to the core one, which cannot be hidden. Changes: the first filter also matches hubs by their translated name (`trpgtitlesearch`) and keeps only what the view sees (`trpg.visible`), the second searches with `trpgsearch` (only the text the view sees), both keep only the kinds switched on above the list (`kindselected` on `$:/state/tiddlyrpg-core/search-kinds`, procedure `trpg.kindswitches`; none chosen is all), hits use `search/item` (translated name); last a group of the offers of the content packages whose title holds the search (`trpgcontentsearch`, with preview and take; only with a package). |
| `tiddlyrpg-core/$__plugins_flibbles_graph_macros_edges.typed.tid` | `$:/plugins/flibbles/graph/macros/edges.typed` (tw5-graph) | `tiddlyrpg-core` | Edge labels come from the JSON edge type config, read by `$properties $tiddler=...` inside `$edges.typed` - nearest wins, so nothing outside can translate them, and `$nodes.neighbors` creates its edges through its own call. Changes (field and function branch alike): the targets come from `relationtargets` (`modules/relations.js`: `tiddlyrpg-exclude` and included types; function filters run there too), with the types of the call passed as `trpgTypes`; an outer `$properties $for=edges` with the style of the axis of the type; an inner `$properties $for=edges label=...` from `relationlabel` (`Edge/<type>`); for a type whose config has `tiddlyrpg-symmetric: yes`, an edge whose other end points back gets an id made of the ordered pair and the type - both ends give the same id, tw5-graph keeps one object per id - and `arrows="to from"`. Known limit: the merged edge of a symmetric type has either end as `from`, so an edge action that reads `fromTiddler` (the `delete` of `$editable`, unused here) would only touch one end. Needs `"plugin-priority": "2"` in `plugin.info`: with equal priority the plugin `flibbles/graph` would win (titles sorted alphabetically). |

| `tiddlyrpg-core/$__config_flibbles_graph_edges_functions_links.tid` | `$:/config/flibbles/graph/edges/functions/links` (tw5-graph) | `tiddlyrpg-core` | The edge type config of tw5-graph has no colour and no `tiddlyrpg-symmetric`; an edge type config is found by name only. Changes: `color` grey, `tiddlyrpg-symmetric: yes` (mutual links as one edge), filter `[visiblelinks[]]` instead of `[links[]]` (the core link index knows no lock: a link that stands only in a section the view does not see draws no edge, see "Sections"); label as in the original. |

**Naming convention:** files that override a core title are named
`$__core_<path>_<name>.tid` (dots/slashes in the title -> underscores) - signals "this file
overrides core" at first sight, regardless of the plugin folder.

**Core macros defined again instead of overridden - the tag pill:** the text of a tag pill is a
hard-wired `$view field="title"` in `tag-pill-inner` of `$:/core/macros/tag`, no cascade covers
it. `functions` (`$:/tags/Global`) defines `tag-pill-inner` and `tag-pill-styles` again; the
core tiddler stays untouched, `tag-pill-body`, `tag-pill` and `tag` are the core ones. This works
because every place that renders the core macros (page, modals, notifications, new windows,
static exports) imports through `$:/core/config/GlobalImportFilter` - `$:/tags/Macro` before
`$:/tags/Global`, and of two definitions the later one wins - and `tag-pill-body` looks up
`tag-pill-inner` only when it runs. A nested `\import` of `$:/tags/Macro` closer to a pill would
bring the core macros back there; none exists (core 5.4.1, tw5-graph, relink, the wikis).
Changes against the core:

- `tag-pill-inner` (a copy of the core macro): the translated name
  (`<$text text={{{ [<__tag__>trpgtitle[]] }}}/>`); the colours as variables `pillColour` (the
  colour of the tag, else `tag-background` of the palette), `pillBase` (background of the
  palette), `pillText` (its foreground) instead of `contrastcolour`; for a dead tag
  (`trpg.dead`) the variable `pillStripes` from `tag-pill-stripes`.
- `tag-pill-styles` (a function): an outline in the colour of the tag (inset shadow) around a
  light inside (18 % of it on the background), the text in the foreground colour, plus
  `pillStripes` (striped at 45° inside, grey and its colour). The tag picker
  (`$:/core/ui/TagPickerTagTemplate`) calls `<<tag-pill-styles>>` too, with variables of its own
  (`backgroundColor`, `colourA`, `colourB`, `fallbackTarget`); `trpg.pillcolour`,
  `trpg.pillbase` and `trpg.pilltext` take the variables of `tag-pill-inner` first, then those
  of the picker, so its pills look alike.
- Known limits: the picker stripes no dead tag (it sets no `pillStripes`) and shows `Secret` in
  `tag-background` (the colour of the lock in `styles/sections` needs `.tc-tag-list-item`); the
  tags of the edit template (`$:/core/ui/EditTemplate/tags`, styles of its own) keep the core
  look; a palette whose `tag-background` is a reference (`<<colour ...>>`, e.g. SolarFlare)
  gives a tag without a colour no valid colour.

**Procedure on every raise of the `tiddlywiki` engine version** (in `package.json` here, later
also in the wikis when they raise their own `tiddlywiki` version):

1. `npm install` (fetch the new engine).
2. For every row of the table above: diff the overriding file against the new original in
   `node_modules/tiddlywiki/core/...` (`ui/PageTemplate/story.tid`,
   `ui/DefaultSearchResultList.tid`). Also compare `templates/tag.tid` with `ui/TagTemplate.tid`,
   `templates/tags.tid` with `ui/ViewTemplate/tags/default.tid` and `ui/sidebar.tid` with
   `ui/SideBarSegments/tabs.tid` (copies, no overrides), `tag-pill-inner` in `functions.tid`
   with `wiki/macros/tag.tid` (the tag pill, see above: `tag-pill-body` still calls
   `tag-pill-inner`, `ui/TagPickerTagTemplate.tid` still calls `tag-pill-styles` with
   `backgroundColor`, `colourA`, `colourB` and `fallbackTarget`, no core template imports
   `$:/tags/Macro` on its own), and
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
   patch=fix, minor=new features, major=breaking change). For now all TiddlyRPG repos keep the
   same major and minor version to show they fit together; the patch level is each repo's own
   (a fix is released alone). For a minor or major release raise `TiddlyRPG-DnD` (its
   `package.json` and every `plugin.info`) to the same value and release it right after. A breaking change of a contract
   for data plugins (domain types, data formats, keys) also raises `tiddlyrpg-core-version` of
   the plugins there. `TiddlyRPG-DnD` raises its pin of this repo (`devDependencies`) to the new
   tag before its own release.
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
7. Consumers (TiddlyRPG repo family) raise their pin themselves (e.g. `#2.0.0` -> `#2.1.0`), run
   `npm install` and bump their own `package.json` `version`.
