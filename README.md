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
destroyed (function `dnd.dead`: struck-through links, the class `dnd-dead`, the world map).

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
