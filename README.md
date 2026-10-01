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

Missing keys fall back to en-GB, so a partial translation works. `npm run check-lang` reports
missing and extra keys per language. If TiddlyWiki has no interface pack for the language, set
only `$:/language`; the TiddlyWiki interface then stays English, the D&D texts follow.

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

## Upgrading from 1.x

2.0.0 renames all internal names to English (fields, tags, hubs, macros, image folders). A
campaign wiki is migrated with

```bash
node <path to TiddlyDnD-Plugins>/scripts/migrate-2.0.js <wiki folder>          # dry run, report
node <path to TiddlyDnD-Plugins>/scripts/migrate-2.0.js <wiki folder> --write  # apply
```

The release notes of 2.0.0 list every rename.

New in 2.0.0 without migration: the event table (on the `Event` hub and under every tiddler
with events) becomes a tab list "Timeline"/"List" - an interactive timeline next to the
unchanged table. Both leave out events locked for the logged-in player.

Editing and release process of this repo: see `CLAUDE.md`.
