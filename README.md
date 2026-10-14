# TiddlyRPG-Plugins

Plugin bundle for the **TiddlyRPG** repo family: the **own plugins** (`tiddlyrpg-core`,
`staticfiles`) live here, the **flibbles graph stack** separately
(see "Third-party plugins" below). Wikis use the official `tiddlywiki` from npm and get the
plugins from here.

## Contents (`plugins/`)

| Plugin | Folder | Purpose | Origin |
|---|---|---|---|
| `$:/plugins/tiddlyrpg-core` | `plugins/tiddlyrpg-core` | **format layer**: type hubs, view templates, macros, filters, styles, language packs, calendar, currency and rules engines, graph schema, event timeline | own, versioned |
| `$:/plugins/staticfiles` | `plugins/staticfiles` | serves `images/` + `data/` in the dev server (server only) | own |

<!-- wiki -->
`tiddlyrpg-core` is the format layer of a campaign wiki for tabletop role-playing games: hubs for
persons, locations, organisations, events and items, relations with their graphs, in-world dates
with a timeline, maps of locations, views for the DM and the players with secrets, and language
packs (en-GB, de-DE). Its engines for calendar, currency and rules terms read their data from
data plugins of the types `ruleset` and `setting` (see "Rulesets and campaign settings").
<!-- /wiki -->

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
  "tiddlyrpg-plugins": "git+https://github.com/WkoD/TiddlyRPG-Plugins.git#2.0.0",
  "tw5-graph": "git+https://github.com/flibbles/tw5-graph.git#v1.7.1",
  "tw5-vis-network": "git+https://github.com/flibbles/tw5-vis-network.git#v10.6.3",
  "tw5-relink": "git+https://github.com/flibbles/tw5-relink.git#v2.6.1"
}
```

A small launcher (`scripts/tw.js`) in the wiki builds `TIDDLYWIKI_PLUGIN_PATH` platform
independently (`path.delimiter`) from all `node_modules/*/plugins`; `tiddlywiki.info` lists the
plugins by folder name (`tiddlyrpg-core`, `staticfiles`, `graph`, `vis-network`, `relink`, and
optionally plugins of other packages, e.g. a ruleset and a campaign setting).

<!-- wiki -->
## Languages

Everything `tiddlyrpg-core` displays comes from language packs. The internal names (tags, fields,
tiddler titles, macros) are English; the active language follows `$:/language`, so one switch
covers the TiddlyWiki interface and the texts of the plugin.

| Language | Code | tiddlyrpg-core | Official TiddlyWiki interface pack |
|---|---|---|---|
| English (British) | `en-GB` | base and fallback | built into the core |
| German | `de-DE` | complete | yes |

To set the language of a wiki:

1. `tiddlywiki.info`: `"languages": ["de-DE"]` loads the TiddlyWiki pack (not needed for en-GB).
2. `tiddlers/$__language.tid` with title `$:/language` and text `$:/languages/de-DE` activates it.

Type names are translated on display: the hub `Location` reads "Ort" in German, in headings, tag
pills, lists and search results. A tag typed as "Ort" is stored as `Location`.

### Adding a language

Keys are tiddlers `$:/tiddlyrpg/language/<code>/<key>`. A language can come as

- a folder `plugins/tiddlyrpg-core/language/<code>/` (pull request), with the same files as
  `en-GB/` (`titles.multids`, `plurals.multids`, `fields.multids`, `texts.multids`),
- a small plugin of its own, or
- tiddlers directly in a wiki.

Missing keys fall back to en-GB, so a partial translation works. `npm run test-lang` reports
missing and extra keys per language. If TiddlyWiki has no interface pack for the language, set
only `$:/language`; the TiddlyWiki interface then stays English, the texts of the plugin follow.

## Rulesets and campaign settings

Content of a game system or a world comes in data plugins of two types (`plugin-type` in
`plugin.info`):

| Type | Brings |
|---|---|
| `ruleset` | rules terms: units, dice, damage types, abilities and other terms; the price unit of the system |
| `setting` | the world: calendar, currency, their names |

A wiki may install several of each; one of each type is active. ControlPanel -> Settings ->
TiddlyRPG -> "Ruleset and campaign setting" chooses it (stored in `$:/config/tiddlyrpg/ruleset`
and `$:/config/tiddlyrpg/setting`, "none" is a choice). Without a choice the only one installed,
or the first by title, is active. The other plugins of the type are switched off at once, without
a reload. ControlPanel -> Plugins lists them in the tabs "Rulesets" and "Campaign settings".

**Building another one** needs no code: a folder plugin with `plugin-type`, the dependency on
`$:/plugins/tiddlyrpg-core` and the core version it needs (`"tiddlyrpg-core-version": ">=2.0.0"`).
Its terms go into rules domains - JSON data tiddlers tagged `$:/tags/tiddlyrpg/RulesDomain` -
and language keys `$:/tiddlyrpg/language/<code>/...`. The domain types (`unit`, `label`, `tokens`,
`damage`, `calendar`, `currency`) and their data formats are described in the header of
`modules/rules.js`; the fixture plugins in `test/fixtures/plugins/` are examples. `scripts/check-wiki.js` reports a plugin whose core
version is not met.

## Rules terms in the text

Macros write rules terms once and show them in the language the wiki chose (see "Rules
language"):

```
                                shown in English          shown in German
<<unit "228 cm">>               7 ft 7 in                 228 cm
<<unit "25 ft" kind:"range">>          25 ft                     7,5 m      (kinds: range, distance, size)
<<dice "4d6">>                  4d6                       4W6
<<damage "2d6 fire">>           2d6 fire damage           2W6 Feuerschaden
<<term hp>>                     HP                        LP
<<unit "3 cr 5 sh">>            3 cr 5 sh                 3 Kr 5 Sch  (coins of the currency)
```

(With the data of a ruleset and a campaign setting that name these terms in English and
German.) What a macro does not understand shows unchanged, with a hint below the title. The
words of every language are read: `<<damage "2W6 Feuer">>` works as well. A number always carries its unit
(`<<unit 60>>` is not read, also not with a kind): what a text means never depends on a setting.
A kind only chooses how a value is shown, e.g. a range in whole feet.

**In headings.** The caption of a dated section is wikitext: `<<date label:"Fight at <<unit '30
ft'>>">>` - use the other kind of quotes inside. Links in a caption stay links.

**Unknown macros.** A macro that nothing defines renders nothing, so a typo disappears silently.
Below the title a hint names it (not in the published copy); `scripts/check-wiki.js` reports it
as well.

## Rules language

A German wiki may want "HP" and "ft" from an English rulebook, or "LP" and "m". The ruleset
and the campaign setting each have their own setting for the language rules terms are shown in:
ControlPanel -> Settings -> TiddlyRPG -> "Ruleset options" for units, dice, damage and terms,
"Campaign setting options" for the names of months and coins - English rules with German month
names are two settings. Texts are read in every language, whatever is set.

Each has three modes: the wiki language, one language for all its domains, or per domain in a
table (for the ruleset Length, Weight, Dice, Damage, Ability, Terms; for the setting Calendar
and Currency - whatever the active plugins bring). The table shows an example per domain.
Lengths and weights are converted between the systems with the factors of the ruleset; dice,
damage, terms, months and coins are only named differently. For a length or weight the language
chooses the system - the table names it ("metric", "imperial"): weights in English and lengths in
German give pounds and metres. The hubs "Ruleset" and "CampaignSetting" (both under
`Information`, each only while its plugin is active) show every term and name in the language it
is shown in; the settings tabs link to them.

The settings are tiddlers of the wiki: `$:/config/tiddlyrpg/rules/<ruleset|setting>/` with
`mode` (`wiki`, `all`, `domain`), `language` and `domain/<name>`.

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
view of the DM only if the wiki ships `$:/config/tiddlyrpg/view/dm-published` with the text
`yes`.

What a view does not see does not show anywhere: not in hubs, lists, search results, tag pills
and their dropdowns, the sidebar (outside the view of the DM only "Open" and "Recent"), relation
lists, graphs, maps, event lists, timeline and table. A secret tiddler opened by its link shows
only its title. This is no access control - the repository and the published HTML hold
everything.

**Secrets in the text.** Part of a body is locked the same way, for one or more characters
(none: the DM only):

```
<<secret "Theren">><<date>>             the whole dated section (or spot) that starts here
<<date>>
<<secret "Theren" "Actia">>             the same, right after the marker
<$secret for="Theren Actia">…</$secret> exactly what it encloses, anywhere, also within a line
```

`<<secret>>` counts only at the start of a section (directly before or after its marker, or at
the very start of the body for the text before the first marker); in the middle of a section a
hint asks for the block form. A locked dated section is missing entirely in the views that do
not see it - heading, text, locations, its row in the table, its part of the timeline and of the
span in the date line; a locked spot is missing on the map, among the spots and in the paths.
A spot joined to a secret tiddler is locked as well. The search finds no word of a locked part.
Lock only with `Secret`, `<<secret>>` and `<$secret>`: a `$list` or `<%if%>` of your own on the
view hides the text, but not the dates, locations and spots in it, and a transcluded secret
tiddler shows wherever it is transcluded (`scripts/check-wiki.js` warns about both).

## Sections in the text

Dated sections (`<<date>>`), spots (`<<spot>>`) and locks (`<<secret>>`) are kinds of sections
with the same rules. Each has a short form, which runs to the next marker on the same level, and
a block form with an end of its own:

```
<$date section="3" label="The ritual">

Text of the section.

</$date>
```

- Blocks nest in any order (a date inside a lock, a lock inside a spot); a section inside one of
  its own kind does not count (no number) and gets a hint.
- Short forms only split the body and the content of a block. Inside an HTML element, a table or
  a `$list` they cannot end - a hint asks for the block form there.
- Dates count on over both forms in document order: `<<date>>`, `<$date>`, `<<date>>` are 1, 2,
  3.
- A date counts only in an event, a spot only in a location.
- A blank line after the opening tag of a block makes its text paragraphs; without it the text
  stays inline (TiddlyWiki).

The hints stand below the title of the tiddler, not in the published copy.

## Relations

Relations are fields holding titles. **The field lives on the dependent, the arrow points to
what it depends on:** the member to its organisation, the child to its parent, the work to its
creator, the potion to its ingredient, the part to the whole. So the long lists never pile up on
a place or an organisation, and a new person is entered in one tiddler only. The graph and the
relation list show the way back by themselves.

| Axis | Field | On the dependent, e.g. | Edge | List forward / back |
|---|---|---|---|---|
| place | `leader` (on a location) | `leader: Baile` (organisation) | controls | Controls / - |
| | `location` | `location: Baile` | in | Location / Present |
| power | `leader` | `leader: [[Haus Eiree]]` (person) | leads | Leads / Leaders |
| | `officer` | `officer: Guild` | officer of | Officer of / Officers |
| | `member` | `member: Guild` | member of | Member of / Members |
| | `under` | `under: Tyria`, `under: [[Haus Kemri]]` | answers to | Answers to / Subordinates |
| | `former` | `former: Guild` (person), `former: Grum` (item) | formerly with | Formerly with / Former |
| family | `parent` | `parent: [[Sven Sigra]]` (the child) | child of | Parents / Children |
| | `ancestor` | `ancestor: Ulfgar` (over several generations) | descendant of | Ancestors / Descendants |
| | `spouse` | `spouse: Ragna` (both ends) | Spouse | Spouse |
| | `sibling` | `sibling: Bjorn` (both ends) | Sibling | Siblings |
| | `family` | any other kin, or where the text does not say (both ends) | Family | Family |
| attitude | `alliance`, `enmity`, `bond` | both ends | Alliance, Enmity, Bond | the same |
| guidance | `mentor` | `mentor: Agin` (the student) | student of | Mentor / Students |
| | `patron` | `patron: Sola` | worships | Patron / Followers |
| things | `creator` | `creator: Corelei` (the item) | made by | Creator / Created |
| | `owner` | `owner: Balseth` | owned by | Owner / Possessions |
| | `component` | `component: Löwengras` (the potion) | contains | Components / Part of |

- **Symmetric relations** (`spouse`, `sibling`, `family`, `alliance`, `enmity`, `bond`) are entered on both
  ends - deleting one tiddler loses nothing of the other. If both ends carry it, the graph draws
  one edge with two arrows.
- **One includes another:** a leader is an officer and a member as well, controlling a place
  means being present there, a parent is an ancestor. Only the highest is entered; a lower one
  next to it is not drawn and not listed (a `location` next to a `leader` on the same place
  gets a hint).
- **Every relation its own edge:** two different relations between the same tiddlers are two
  edges (`under` and `mentor`: "answers to" and "student of").
- The colour of an edge comes from its axis; `alliance`, `enmity`, `bond`, `former` and `patron`
  keep their own.
- **Links** in the text are an edge of their own in grey ("references"), only in views that
  show them (`$:/graph/Default`); two tiddlers linking each other give one edge with two arrows.
- A spot that is a location points to the location it is part of (dashed), like a field
  `location`.

## Locations

Where something is, and which place lies in which, comes from fields and from the body of a
location - tags carry no meaning for places.

| Where | Field / syntax | Meaning |
|---|---|---|
| Person, player, deity | `location: Baile` | where they are most likely found - the most precise place that is still true; someone who moves around gets the region (one entry) |
| Organisation | `location: [[Cair Di]] Baile` | the places where it sits or is present (several, all equal) |
| Location | `location: [[Königreich von Vandalia]]` | lies in ("liegt in"): a place of its own within a larger one |
| Location | `<<spot "Tavern">>` in the body of Baile | part of ("Teil von"): the tavern is a part of Baile - who is in the tavern is found in Baile |
| Organisation, person | `leader: Baile` | leads or controls the location ("Controls") and is present there - no `location` to the same place needed |
| Artifact | `location: [[Leuchtturm von Cair Di]]` | where it lies - instead of an owner: an artifact is unique and has one owner **or** one location; when it passes from a person to a place, the person moves to `former` |
| Item, material | `location: Briarwood Riganwald` | where it lies or is found (several, all equal); an item may have several owners as well |

A location has one parent: the location that has it as a spot, otherwise its field `location`.
Below the title every tiddler shows the path of its parents ("Andu Falas › Königreich von
Vandalia › Baile"); a hint appears for a cycle, a spot of two locations, a person with
two locations, an artifact with an owner and a location and the like (not in the published
copy). The event list of a location also contains the events of every place within it. Its
graph shows the places within it; one with people, items or a leader starts folded ("▸ Baile")
and opens with a click, its list shows them as a tree (people and items alike).

**Secret presence.** An organisation (or anyone else) that is somewhere in secret needs no
tiddler of its own for that: one entry of its `location` points to a location tagged `Secret`
(`location: Baile [[Unterschlupf]]`, Unterschlupf `Secret` and within Baile). A view that does not
see that location sees neither the entry nor its line in the path, nor the organisation among
those at the places above. If the place itself may be known and only where it lies is secret,
join it to a locked spot instead (`<<secret>><<spot "Versteck">>` in the body of the location):
the place and who is there stay visible, but it has no parent and is missing among the spots.

**Spots** - places of interest, written at the end of the body of a location:

```
<<spot "Schloss Baile">>
Text of the spot, up to the next spot.

<<spot "Tempel von [[Sola]]">>                  links in the name stay links
<<spot "Anwesen" tiddler:"Haus Kemri">>                  joined to another tiddler than the name says
<<spot "Lagerhaus" image:"a.jpg, b.jpg" map:"c.jpg">>   with images and maps
```

A spot whose plain name (the name without link brackets) is a tiddler is joined to it; if that
tiddler is a location, it is a part of this location. The body shows the text without the
spots; the spots appear below the maps of the location, each with its heading, then its
images and maps (`image` from `images/location/`, `map` from `images/map/`; one on its own,
two or more as tabs named after the files), then its text. A spot joined to a tiddler shows no
images there: that tiddler shows its own. The block form
`<$spot name="…" tiddler="…" image="…" map="…">…</$spot>` is a spot with an end of its own; see
"Sections in the text".

**Referencing a spot** from an event or any other text:

```
<<spotlink "Baile" "Schloss Baile">>
<<spotlink "Miehall" "[[Grauen Esel|Zum Grauen Esel]]">>   text|spot
```

The link opens the location and scrolls to the spot (a spot joined to a tiddler
opens that tiddler); in a dated section of an event it is also a pill "Schloss Baile (Baile)",
and the event appears in the event list of Baile and every place above. A missing spot or
location gives a hint for the editor.

**Maps** of a location (no sub-tiddlers):

- The map (a location with a map image, spots or places within) shows a graph: the
  spots and the places within at fixed positions, each a dot with its name in a pill below it
  (filled for a tiddler, white and dashed for a spot without a tiddler of its own); they keep
  their size on screen when zooming. Hovering shows the text of a spot, a double click scrolls
  to it. Buttons: "Fit map", "Hide nodes"/"Show nodes", "Edit positions" (drag a node to place
  it; the position is saved in the field `map-positions` of the location - not in the
  published copy).
- `map: Baile.png, Hafen.jpg` - the maps from `images/map/`, battle maps among them. The first
  is drawn behind the graph across the full width; without one the graph stands on an empty
  canvas. With two maps or more each is a tab named after its file (`[Baile] [Hafen]`), the
  further ones show the image only; a click opens the file.
- Below the maps the spots (see above).

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

**An own category** of a campaign: a tiddler (e.g. `Rune`) tagged `$:/tags/tiddlyrpg/ItemKind`,
used as a tag next to the base type. Its heading in the hub is its display name.

**Price:** `price: 50 cr` or `price: 3 cr 5 sh` - numbers with coins of the currency (see
"Currency"), shown as written with the coin labels of the language shown ("50 Kr" in German).
Without a currency a price is a plain number (`price: 50`). A price that does not fit gets a hint
below the title.

**The file of a book:** `data: Runen I - IV.pdf` - a file from `data/book/`, embedded below the
body (PDF), not for a secret the active view does not see.

**Upgrading from 1.x.** `Book` was a type of its own and is now a category: every book needs
`Artifact` (unique) or `Item` (several copies) as well. A book whose body ends in
`<embed ... src="data/book/<file>">` gets the field `data` instead.

## Images and sources

`image: Baile.jpg` shows an image from `images/<folder>/` (the folder of the type, e.g.
`location`, `information` for the type `Information`) above the body; several are separated by
commas and show as tabs named after the files (`image: Vogel.png, Hirsch.jpg` gives
`[Vogel] [Hirsch]`). Maps of a location and images of a spot: see "Locations".

**Images in a text:** `<<image "Aufbruch.png">>` shows a file from the image folder of the
tiddler's type, `<<image "a.png, b.png">>` several as tabs, `folder:"event"` takes another
folder of `images/`. Not as `<img src="images/...">`: `scripts/check-wiki.js` finds a missing
file only in `<<image>>`.

**Source:** `source` is free text (wikitext) shown below a tiddler as "Source: …" - where its
images come from: a link, the author, a license, several of them. It is shown to the views that
see the tiddler; a link in it to another tiddler shows to them as well, whatever that tiddler is.

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
| `./1351, 1355` | person who died 1351 and is back since 1355 (alive) |
| `./1351, ./1380` | back at an unknown time, dead again since 1380 |

A non-event whose last section is a span with an end other than `..` counts as dead or
destroyed (function `trpg.dead`: struck-through links, the class `trpg-dead`, the atlas).
Several sections of a non-event are its phases: each but the last has to end (a death before
the return), `scripts/check-wiki.js` gives a hint otherwise. The date line below the tags shows
the last phase only, the timeline a band per phase with a gap between them.

**Dated sections in the body of an event.** The dates stay in the field; the body only marks
where each section begins:

```
<<date>>                  the next section (the first is section 1)
<<date 3>>                section 3; the following ones count on from there
<<date label:"The ritual">>     with a caption (also <<date 3 label:"The ritual">>, <<date label:"1351">>)
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
"open items" snippet) are not counted as locations. The block form `<$date>…</$date>` (with
`section` and `label`) is a section with an end of its own; see "Sections in the text".

**Jumping to a section.** A click on an event in the table, or on a section line of the
selected card in the timeline, opens the event at that section. A section at the very start of
the body has no jump: the event simply opens at its top. Templates do the same with a wrapper
around an ordinary link, and find the section a date falls into with `datesection` (the
narrowest matching section, nothing without a match):

```
<$trpg-jump anchor="date-2">[[Der dunkle Turm]]</$trpg-jump>
<$trpg-jump anchor={{{ [[Der dunkle Turm]datesection[1351-11-12]addprefix[date-]] }}}>[[Der dunkle Turm]]</$trpg-jump>
```

A jump target is any element with `data-trpg-anchor` inside the opened tiddler; so far only the
section headings (`date-<n>`) carry one. Without a target (edit mode, folded, a section the
view does not see) the link opens the tiddler as usual.

**Upgrading from 1.x.** `node scripts/migrate-dates.js <wiki>` converts the former `.`
notation mechanically (dry run first, `--write` applies); `node scripts/check-wiki.js <wiki>`
then reports what is left to decide or fix by hand. Both have a header with the details.

## Calendar

The calendar engine of `tiddlyrpg-core` calculates with the calendar of the wiki: a JSON data
tiddler named in `$:/config/tiddlyrpg/calendar`, usually brought by the campaign setting or
written in the wiki. Without one, dates are shown as entered (`1350-03-12`), and the calculator
on the `Calendar` hub is hidden.

**Own calendar:** a data tiddler under a title of its own with `id`, months, days, festivals and
leap rule, and `$:/config/tiddlyrpg/calendar` pointing to it (it wins over the calendar of a
campaign setting). Display names go into `$:/tiddlyrpg/language/<code>/Calendar/<id>/...`
(`Name`, `Era`, `Month/<month>`, `Epithet/<month>`, `Festival/<festival>`, `Description`);
without them the ids are shown.

```json
{
  "id": "Example",
  "leap": { "every": 4, "start": 0 },
  "months": [
    { "id": "Frost", "days": 30, "festivals": [ { "id": "Longnight" } ] },
    { "id": "Bloom", "days": 30, "festivals": [ { "id": "Highsun" }, { "id": "Starfall", "leap": true } ] }
  ]
}
```

Festival days lie between two months and count as day `days + 1`, `days + 2`, ... of the
preceding month (Longnight = `1351-01-31`). A leap festival exists only in leap years, i.e. years
with `(year - start) mod every == 0`, and comes after the regular festivals of its month.

The names of months and festivals follow the rules language (domain `Calendar`); description,
calculator and date patterns stay in the wiki language.

**Order of day and month.** Control Panel -> Settings -> TiddlyRPG -> "Campaign setting
options": as in the wiki
language ("5 Bloom 1351" in English, "5. Bloom 1351" in German), day before month, or month
before day ("Bloom 5, 1351", a span in one month "Bloom 5 – 24, 1351"). It applies
to headings, date lines, the timeline and the calculator; the event table keeps its columns.

## Currency

Like the calendar, the coins are data: the active currency is a JSON data tiddler named in
`$:/config/tiddlyrpg/currency`, usually brought by the campaign setting or written in the wiki.
Without one, prices are plain numbers and the hub "Currency" is hidden.

```json
{
  "id": "Example",
  "base": "cr",
  "reference": "cr",
  "currencies": [
    { "id": "p", "value": 1 },
    { "id": "sh", "value": 12 },
    { "id": "cr", "value": 240 }
  ]
}
```

`value` is the worth in the smallest coin; `base` leads the table of the hub; `reference` is the
coin that matches the prices of the ruleset (`currency-reference` of the ruleset) - the hub says
so, and warns if the currency has no such coin. Display names go into
`$:/tiddlyrpg/language/<code>/Currency/<id>/...` (`Name`, `Unit/<coin>` "cr" / "Kr",
`Coin/<coin>` "crown" / "Krone", `Description`). The hub "Currency" shows the
description, a converter (a price in coins, in any language) and the table of the coins.

## Licenses in the wiki

ControlPanel -> License shows the license of the content of the wiki and lists every plugin with
its license. The wiki repo provides its part as files (see the `CLAUDE.md` of `TiddlyRPG`): its
`LICENSE` and the part of its `README.md` between the lines `<!-- wiki -->` and `<!-- /wiki -->`,
e.g. a notice that the content is fan content. The tabs "readme" and "license" of the plugins come
from the files of their repos in the same way.
<!-- /wiki -->

## License

MIT, see `LICENSE`.

Editing and release process of this repo: see `CLAUDE.md`.
