# TiddlyDnD-Plugins

Plugin bundle for the **DnDWiki** repo family: the **own plugins** (`dndwiki-core`,
`dndwiki-forgottenrealms`, `staticfiles`) live here, the **flibbles graph stack** separately
(see "Third-party plugins" below). Wikis use the official `tiddlywiki` from npm and get the
plugins from here.

## Contents (`plugins/`)

| Plugin | Folder | Purpose | Origin |
|---|---|---|---|
| `$:/plugins/dndwiki-core` | `plugins/dndwiki-core` | **D&D format layer**: type hubs, view templates, macros, filters, styles, language packs, calendar engine, graph schema, event timeline | own, versioned |
| `$:/plugins/dndwiki-forgottenrealms` | `plugins/dndwiki-forgottenrealms` | **optional**: Calendar of Harptos (Forgotten Realms) as calendar data with language keys | own, versioned with the core |
| `$:/plugins/staticfiles` | `plugins/staticfiles` | serves `images/` + `data/` in the dev server (server only) | own |

## Third-party plugins

Each wiki pins them individually by release tag as Git dependencies:

- `flibbles/graph` ([tw5-graph](https://github.com/flibbles/tw5-graph))
- `flibbles/vis-network` ([tw5-vis-network](https://github.com/flibbles/tw5-vis-network))
- `flibbles/relink` ([tw5-relink](https://github.com/flibbles/tw5-relink))

## Using it in TiddlyWiki

The wiki's `package.json` pins the bundle **and** the graph stack by release tag:

```json
"devDependencies": {
  "tiddlywiki": "5.4.1",
  "tiddlydnd-plugins": "git+https://github.com/WkoD/TiddlyDnD-Plugins.git#2.0.0",
  "tw5-graph": "git+https://github.com/flibbles/tw5-graph.git#v1.7.1",
  "tw5-vis-network": "git+https://github.com/flibbles/tw5-vis-network.git#v10.6.3",
  "tw5-relink": "git+https://github.com/flibbles/tw5-relink.git#v2.6.1"
}
```

A small launcher (`scripts/tw.js`) in the wiki builds `TIDDLYWIKI_PLUGIN_PATH` platform
independently (`path.delimiter`) from all `node_modules/*/plugins`; `tiddlywiki.info` lists the
plugins by folder name (`dndwiki-core`, `staticfiles`, `graph`, `vis-network`, `relink`, and
optionally `dndwiki-forgottenrealms`).

## Languages

Everything `dndwiki-core` displays comes from language packs. The internal names (tags, fields,
tiddler titles, macros) are English; the active language follows `$:/language`, so one switch
covers the TiddlyWiki interface and the D&D texts.

| Language | Code | dndwiki-core | Official TiddlyWiki interface pack |
|---|---|---|---|
| English (British) | `en-GB` | base and fallback | built into the core |
| German | `de-DE` | complete | yes |

To set the language of a wiki:

1. `tiddlywiki.info`: `"languages": ["de-DE"]` loads the TiddlyWiki pack (not needed for en-GB).
2. `tiddlers/$__language.tid` with title `$:/language` and text `$:/languages/de-DE` activates it.

Type names are translated on display: the hub `Location` reads "Ort" in German, in headings, tag
pills, lists and search results. A tag typed as "Ort" is stored as `Location`.

### Adding a language

Keys are tiddlers `$:/dndwiki/language/<code>/<key>`. A language can come as

- a folder `plugins/dndwiki-core/language/<code>/` (pull request), with the same files as
  `en-GB/` (`titles.multids`, `plurals.multids`, `fields.multids`, `texts.multids`),
- a small plugin of its own, or
- tiddlers directly in a wiki.

Missing keys fall back to en-GB, so a partial translation works. `npm run test-lang` reports
missing and extra keys per language. If TiddlyWiki has no interface pack for the language, set
only `$:/language`; the TiddlyWiki interface then stays English, the D&D texts follow.

## Player characters, views and secrets

**Player characters.** A tiddler tagged `Player` is an active player character; its field
`player` names the real player (`player: Tom`). A figure someone played before stays a `Person`
(or any other type) and keeps the field `player` - a former character. The hub `Player` shows
both as cards.

**Taking part.** The tag of a player character on an event means: that character was there.
An event with at least one player character, active or former, belongs to the campaign: the
event table underlines it, the timeline draws it solid in the colour of the hub `Campaign`.

**Secrets.** A tiddler tagged `Secret` is visible to the DM and to the players of the player
characters it is tagged with: `Theren` + `Secret` is for Theren's player, `Secret` alone for the
DM only. Every other tiddler is visible to everyone.

**Views.** The page control "View" (sidebar) chooses whose view the wiki shows:

| View | Sees |
|---|---|
| Public | everything not tagged `Secret` |
| a player, e.g. "Tom (Theren)" | that, plus the secrets of their characters, active and former |
| DM | everything; a secret tiddler is marked with whom it is for |

Outside the public view a coloured bar at the top of the window shows that the view is not the
public one. The view is not saved: after a reload the editable wiki (`npm start`) opens in the
view of the DM, the published read-only copy in the public view. The published copy offers the
view of the DM only if the wiki ships `$:/config/dndwiki/view/dm-published` with the text
`yes`.

What a view does not see does not show anywhere: not in hubs, lists, search results, tag pills
and their dropdowns, the sidebar (outside the view of the DM only "Open" and "Recent"), relation
lists, graphs, maps, event lists, timeline and table. A secret tiddler opened by its link shows
only its title. This is no access control - the repository and the published HTML hold
everything.

## Locations

Where something is, and which place lies in which, comes from fields and from the body of a
location - tags carry no meaning for places.

| Where | Field / syntax | Meaning |
|---|---|---|
| Person, player, deity | `location: Baile` | where they are most likely found - the most precise place that is still true; someone who moves around gets the region (one entry) |
| Organisation | `location: [[Cair Di]] Baile` | the places where it sits or is present (several, all equal) |
| Location | `location: [[Königreich von Vandalia]]` | lies in ("liegt in"): a place of its own within a larger one |
| Location | `<<spot "Tavern">>` in the body of Baile | part of ("Teil von"): the tavern is a part of Baile - who is in the tavern is found in Baile |
| Organisation, person | `leader: Baile` | leads or controls the location ("Controls") |
| Artifact | `location: [[Leuchtturm von Cair Di]]` | where it lies - instead of an owner: an artifact is unique and has one owner **or** one location; when it passes from a person to a place, the person moves to `former` |
| Item, material | `location: Briarwood Riganwald` | where it lies or is found (several, all equal); an item may have several owners as well |

A location has one parent: the location that has it as a spot, otherwise its field `location`.
Below the title every tiddler shows the path of its parents ("Materielle Ebene › Andu Falas ›
Königreich von Vandalia"); a hint appears for a cycle, a spot of two locations, a person with
two locations, an artifact with an owner and a location and the like (not in the published
copy). The event list of a location also contains the events of every place within it. Its
graph shows the places within it; one with people, items or a leader starts folded ("▸ Baile")
and opens with a click, its list shows them as a tree (people and items alike).

**Spots** - places of interest, written at the end of the body of a location:

```
<<spot "Schloss Baile">>
Text of the spot, up to the next spot.

<<spot "Tempel von [[Chauntea]]">>              links in the name stay links
<<spot "Anwesen" "Haus Kemri">>                  joined to another tiddler than the name says
<<spot "Lagerhaus" battlemap:"a.jpg, b.jpg">>    with battle maps
```

A spot whose plain name (the name without link brackets) is a tiddler is joined to it; if that
tiddler is a location, it is a part of this location. The body shows only the text before the
first spot; the spots and their texts appear in the tab "Map".

**Referencing a spot** from an event or any other text:

```
<<spotlink "Baile" "Schloss Baile">>
<<spotlink "Miehall" "[[Trunkenen Eulenbären|Zum Trunkenen Eulenbären]]">>   text|spot
```

The link opens the location at its map tab and scrolls to the spot (a spot joined to a tiddler
opens that tiddler); in a dated section of an event it is also a pill "Schloss Baile (Baile)",
and the event appears in the event list of Baile and every place above. A missing spot or
location gives a hint for the editor.

**Maps** of a location (no sub-tiddlers):

- The tab "Map" (a location with a map image, spots or places within) shows a graph: the
  spots and the places within at fixed positions, each a dot with its name in a pill below it
  (filled for a tiddler, white and dashed for a spot without a tiddler of its own); they keep
  their size on screen when zooming. Hovering shows the text of a spot, a double click scrolls
  to it. Buttons: "Fit map", "Hide nodes"/"Show nodes", "Edit positions" (drag a node to place
  it; the position is saved in the field `map-positions` of the location - not in the
  published copy).
- `map: Baile.png` - the map image from `images/map/`, drawn behind the graph across the full
  width; without it the graph stands on an empty canvas.
- `battlemap: a.jpg, b.jpg` - battle maps from `images/battlemap/`, one tab each; battle maps
  of a spot come from its parameter `battlemap` (or the field `battlemap` of the tiddler it is
  joined to). Tabs: `[Map] [Baile 1] [Baile 2] [Baile Taverne] [Baile Schloss 1] ...` - a
  number only if there is more than one.

## Items

Every item has **one base type** and any number of **categories**:

| Base type | Meaning | `owner` / `location` |
|---|---|---|
| `Artifact` | unique - there is only this one | one owner **or** one location |
| `Item` | several of it exist (a potion, a bag of holding, two snails) | several of each |
| `Material` | raw material, ingredient (`component`) | several of each; `location` = where it is found |

| Category | For |
|---|---|
| `Book` | books, letters, newspapers; a unique book is `Artifact` + `Book` |
| `Consumable` | potions, tinctures and everything used up |
| `Equipment` | everything one can equip: weapons, armour, a bag of holding |

Plenty of items need no category (`tags: Item`). A category never stands alone - a hint below
the title asks for the base type, as it does for two base types (not in the published copy).
The hub `Item` lists the base types, each first with the items without a category, then one
heading per category; a category hub lists only its own items. How many of an item exist is
told by the text - a list field carries every name once.

**An own category** of a campaign: a tiddler (e.g. `Rune`) tagged `$:/tags/dndwiki/ItemKind`,
used as a tag next to the base type. Its heading in the hub is its display name.

**The file of a book:** `data: Runen I - IV.pdf` - a file from `data/book/`, embedded below the
body (PDF), not for a secret the active view does not see.

**Upgrading from 1.x.** `Book` was a type of its own and is now a category: every book needs
`Artifact` (unique) or `Item` (several copies) as well. A book whose body ends in
`<embed ... src="data/book/<file>">` gets the field `data` instead.

## Dates

The field `date` holds the in-world dates of a tiddler, in one syntax for all types:

```
date    := section ( "," section )*      whitespace is ignored: "1351,1352" = "1351, 1352"
section := point | side "/" side
side    := point | "." | ".." | (empty)
point   := YYYY[-MM[-DD[-time]]]
```

| Side | as start | as end |
|---|---|---|
| a point | from this date | until this date |
| `.` | unknown (shown as `????`) | ended at an unknown time (`????`) |
| `..` | since time immemorial | ongoing (shown as `????`) |
| empty | ignored: `1351/` = `/1351` = `1351` | |

`.` or `..` as a section of its own, first or last, belongs to the whole field: the event began
before its first section or goes on after its last one, without turning that section into a
span. Elsewhere in the list it cannot be read.

| Example | Meaning |
|---|---|
| `1351-07-01, 1351-07-11` | event on two days |
| `1351/1371, 1381` | event from 1351 to 1371, once more in 1381 |
| `1351-07-11/..` | event that is still going on |
| `1351, 1352, ..` | event that goes on after 1352 (1352 itself stays a point) |
| `.., 1351` | event that began before 1351 |
| `1322` | person born 1322, alive (a single point of a non-event is the start) |
| `1300/1351`, `./1339`, `./.` | dead: dates known, birth unknown, both unknown |
| `../..` | a deity since time immemorial |

A non-event whose last section is a span with an end other than `..` counts as dead or
destroyed (function `dnd.dead`: struck-through links, the class `dnd-dead`, the atlas).

**Dated sections in the body of an event.** The dates stay in the field; the body only marks
where each section begins:

```
<<date>>                  the next section (the first is section 1)
<<date 3>>                section 3; the following ones count on from there
<<date "The ritual">>     with a caption (also <<date 3 "The ritual">>, <<date label:"1351">>)
```

Each placeholder shows a rule (not at the very start of the body), the date of its section,
the caption and the locations linked in that section. Every event starts with `<<date>>`, also
one with a single date; without any date in the field the heading reads `????` (with the
era). Below its tags, right-aligned, every tiddler with dates shows a date line: an
event the span of its whole field, every other type its years of existence. An event also
lists there the locations linked before its first placeholder. The timeline shows each section, a
span as a bar; the event table one row per point in time (a span: its start and end), with an
event in one title cell across all its rows as long as no other event lies in between, and the
caption next to the title. Links inside DM notes (`@@.tc-tiddler-frame`, the
"open items" snippet) are not counted as locations. Do not put `<<date>>` into a block that is
hidden from players: its caption and locations would still reach the timeline and the table.

**Jumping to a section.** A click on an event in the table, or on a section line of the
selected card in the timeline, opens the event at that section. A section at the very start of
the body has no jump: the event simply opens at its top. Templates do the same with a wrapper
around an ordinary link, and find the section a date falls into with `datesection` (the
narrowest matching section, nothing without a match):

```
<$dnd-jump anchor="date-2">[[Der dunkle Turm]]</$dnd-jump>
<$dnd-jump anchor={{{ [[Der dunkle Turm]datesection[1351-11-12]addprefix[date-]] }}}>[[Der dunkle Turm]]</$dnd-jump>
```

A jump target is any element with `data-dnd-anchor` inside the opened tiddler; so far only the
section headings (`date-<n>`) carry one. Without a target (edit mode, folded, locked for the
player) the link opens the tiddler as usual.

**Upgrading from 1.x.** `node scripts/migrate-dates.js <wiki>` converts the former `.`
notation mechanically (dry run first, `--write` applies); `node scripts/check-dates.js <wiki>`
then reports what is left to decide or fix by hand. Both have a header with the details.

## Calendar

`dndwiki-core` contains a calendar engine but no calendar. The active calendar is a JSON data
tiddler named in `$:/config/dndwiki/calendar`. Without one, dates are shown as entered
(`1350-03-12`), and the calculator on the `Calendar` hub is hidden.

**Forgotten Realms:** add `"dndwiki-forgottenrealms"` to the plugins in `tiddlywiki.info`. It
brings the Calendar of Harptos (`$:/dndwiki/calendar/Harptos`), activates it and adds the names
in en-GB and de-DE (month names and DR only in en-GB, they are proper names).

**Own calendar:** copy `$:/dndwiki/calendar/Harptos` into the wiki under a new title, change
`id`, months, days, festivals and leap rule, and point `$:/config/dndwiki/calendar` to it.
Display names go into `$:/dndwiki/language/<code>/Calendar/<id>/...` (`Name`, `Era`,
`Month/<month>`, `Epithet/<month>`, `Festival/<festival>`, `Description`); without them the ids
are shown.

```json
{
  "id": "Harptos",
  "leap": { "every": 4, "start": 0 },
  "months": [
    { "id": "Hammer", "days": 30, "festivals": [ { "id": "Midwinter" } ] },
    { "id": "Flamerule", "days": 30, "festivals": [ { "id": "Midsummer" }, { "id": "Shieldmeet", "leap": true } ] }
  ]
}
```

Festival days lie between two months and count as day `days + 1`, `days + 2`, ... of the
preceding month (Midwinter = `1351-01-31`). A leap festival exists only in leap years, i.e. years
with `(year - start) mod every == 0`, and comes after the regular festivals of its month.

Editing and release process of this repo: see `CLAUDE.md`.
