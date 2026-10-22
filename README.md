# TiddlyRPG-Plugins

Plugin bundle for the **TiddlyRPG** repo family: the **own plugins** (`tiddlyrpg-core`,
`staticfiles`) live here, the **flibbles graph stack** separately
(see "Third-party plugins" below). Wikis use the official `tiddlywiki` from npm and get the
plugins from here.

## Contents (`plugins/`)

| Plugin | Folder | Purpose | Origin |
|---|---|---|---|
| `$:/plugins/tiddlyrpg-core` | `plugins/tiddlyrpg-core` | **format layer**: type hubs, view templates, macros, filters, styles, language packs, calendar, currency and rules engines, values of the rules, content packages, graph schema, event timeline | own, versioned |
| `$:/plugins/staticfiles` | `plugins/staticfiles` | serves `images/` + `data/` in the dev server (server only) | own |

<!-- wiki -->
`tiddlyrpg-core` is the format layer of a campaign wiki for tabletop role-playing games: hubs for
persons, locations, organisations, events and items, relations with their graphs, in-world dates
with a timeline, maps of locations, views for the DM and the players with secrets, and language
packs (en-GB, de-DE). Its engines for calendar, currency, rules terms and the values of the rules
read their data from data plugins of the types `ruleset` and `setting` (see "Rulesets and
campaign settings"); content packages of a ruleset bring items, spells and creatures to take
into the wiki.
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
independently (`path.delimiter`) from the `plugins` folders of the packages it lists and finds
installed; `tiddlywiki.info` lists the plugins by folder name (`tiddlyrpg-core`, `staticfiles`,
`graph`, `vis-network`, `relink`, and optionally plugins of other packages, e.g. a ruleset and a
campaign setting).

<!-- wiki -->
## Using the wiki

A tour for the DM and the players. The sections after it hold the details.

**Getting around.**

- The start page `Campaign` always stands at the end of the page. It shows the hub `Index`
  with every hub, the player characters, the quests and rumours, and the events as timeline and
  table.
- A **hub** is the page of a type and lists its tiddlers. The hubs are `Person`,
  `Organisation`, `Deity`, `Location`, `Event`, `Item` (base types and categories, see "Items"),
  `Spell`, `Creature` (kinds of creatures - a person names its kind in `creature`),
  `Information`, `Player` and `Quest`. `Event` shows every event as timeline and table, `Player`
  shows the player characters as cards with the level of the party (the tiddler `PlayerLevel`).
  `Information` also leads to `Calendar`, `Currency`, `Ruleset`, `CampaignSetting` and `Content`
  while they have something to show. The type of a tiddler is its tag, and its colour is the colour of
  that hub.
- A **tiddler** shows the path of the locations where it is below its title, and its years or
  its span right-aligned below the tags. Below the text of a person, player character,
  organisation, deity, location or item come its relations (graph or list, see "Relations") and
  the events that link it or carry it as a tag (timeline or table, see "Dates").
- The **search** shows the names in the wiki language; switches above the hits choose the
  kinds.
- The sidebar tab **Graph** (from tw5-graph) shows the graph views of the wiki: tiddlers
  `$:/graph/<name>` with the template `$:/plugins/tiddlyrpg-core/graph/templates/trpg-graph`.
  It colours nodes by type, names edges in the wiki language and leaves out what the view does
  not see. `$:/graph/Default` shows the tiddlers that are open.
- A link in a tiddler opens its target above that tiddler, a link in the sidebar at the top.
  Only `[[...]]` links; a word in CamelCase stays a word.

**Writing** (in the editable wiki, `npm start`):

- A new tiddler: "+" beside edit and close on the hub of its type. The form below the text
  offers the fields of the type; the buttons of the editor toolbar set dates, quest markers,
  spots and locks (see "Editing").
- Links: `[[Title]]`, or `[[shown text|Title]]`.
- Who belongs to whom: relation fields on the dependent - the member names its organisation,
  the child its parent (see "Relations").
- Where something is: the field `location`, spots in the body of a location and its maps (see
  "Locations").
- What happened: an event with its dates in the field `date` and a `<<date>>` where each
  section begins. The player characters who were there are its tags (see "Dates", "Player
  characters, views and secrets").
- Quests and rumours: marked in the text of events with `<<quest>>` (see "Quests").
- Images: the field `image`, `<<image>>` in a text, the field `source` for where they come from
  (see "Images and sources").
- Rules terms such as `<<unit "30 ft">>` and `<<term hp>>` show in the language the wiki
  chose (see "Rules terms in the text").
- Values of the rules - the damage of a weapon, the level of a spell, the hit points of a
  creature: the form offers the fields the ruleset defines for the type, the tiddler shows them
  as a block like a stat block (see "Values of the rules").
- From a content package of the ruleset (such as the SRD 5.1 of `TiddlyRPG-DnD`): items, spells
  and creatures taken into the wiki one by one, where they become ordinary tiddlers (see
  "Content packages").
- Secrets: the tag `Secret` for a whole tiddler, `<<secret>>` and `<$secret>` for part of a
  text (see "Player characters, views and secrets").
- Below the title stand errors and hints; `npm run check` reports them for the whole wiki (see
  "Checks").

**Seeing what a player sees.** The page control "View" switches between the public view, the
view of one player and the view of the DM. The published copy opens in the public view and is
read-only: it has no buttons to edit, create, delete or import, no "+" and no messages below
the titles.

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
| `ruleset` | rules terms: units, dice, damage types, abilities and other terms; the price unit of the system; the fields of the types with what the rules derive (see "Values of the rules") |
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
`modules/rules.js`; its fields go into JSON data tiddlers tagged `$:/tags/tiddlyrpg/RulesFields`
(one tiddler of definitions, one schema per type: header of `modules/fields.js`). The fixture
plugins in `test/fixtures/plugins/` are examples. `scripts/check-wiki.js` reports a plugin whose
core version is not met.

**Terms of the campaign:** a wiki adds terms to a domain of the ruleset without changing it - a
domain tiddler of its own with `"extends": true`, the `domain` it extends and its `entries`, plus
the language keys of the new terms in the wiki:

```json
{"domain": "ItemCategory", "extends": true, "entries": [{"id": "tattoo", "for": ["wondrous-item"]}]}
```

Only domains of terms (type `label`) can be extended; an id the domain has already is reported.

**Main entries and traits:** a domain of terms may hold main entries (`"main": true`) and traits
of them (`"for": ["weapon"]`), also traits of traits. A field lists them in any order -
`category: weapon, martial, melee, versatile` - and `<<term "armor medium">>` names a main entry
with its traits ("medium armor"). A trait never stands alone: `<<term medium>>` is the size.

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

## Values of the rules

The ruleset says which values a type has - an item its category, rarity, damage, armour class,
weight; a spell its level, school, casting time, range, duration; a creature its size, armour
class, hit points, abilities, challenge; a person height and weight. The core knows no name of a
field: it reads, shows and checks what the ruleset defines.

**The block** stands between the image and the text, like the stat block of a rulebook: a header
line in italics ("martial weapon (melee, versatile), rare (requires attunement)", "3rd-level
evocation", "Medium beast, unaligned"), then the values in groups - the abilities as a table -
separated by lines in the colour of the type, the price with them. The labels and the values
follow the rules language: `range: 60 ft` shows "60 ft" or "18 m", `category: weapon, martial`
"martial weapon" or "Kriegswaffe". A value is read in every language, as in the macros.

**What the rules derive is not written:** the modifier beside an ability ("16 (+3)"), the average
beside dice ("7 (2d6)"), a total ("19 (18 + 1)" with a bonus), and values from other values -
in D&D the proficiency bonus and XP from the challenge rating, saving throws and skills from the
abilities, passive Perception. A value written in the field wins. Nothing derived is stored, and
a derived value reads only fields of its own tiddler.

**Fields that need another value:** the damage of a weapon is offered and shown only while the
category says weapon; a value written without it gets a hint below the title.

**In the editor** the form offers these fields: a choice for a term, a checkbox for yes and no,
small lists as pills, below each the reading of what is written. Choosing a base item copies its
values once (see "Relations").

**Locked values:** `secret-fields` (see "Player characters, views and secrets").

**Of the campaign:** a schema of the wiki for a type adds fields to those of the ruleset - its
own definitions, never one of the ruleset changed; terms of the campaign extend a domain (see
"Rulesets and campaign settings"). Values the format does not read, fields defined twice and the
rest are reported (see "Checks", `fields/...`).

## Content packages

A ruleset may come with content - the items, spells and creatures of a rulebook - in an npm
package beside the wiki (in `node_modules`, its `package.json` naming its manifests under
`"tiddlyrpg": {"content": [...]}`; format in the header of `modules/content-server.js`). The
entries are no tiddlers: the wiki offers them, and the DM takes one at a time. A taken entry is
an ordinary tiddler of the wiki - its type and tags, its values, its text, the price in the coins
of the setting, `source`, and the tag of its package (e.g. `SRD 5.1 English`). Nothing stays
linked to the package.

**Where the entries are offered** (only in the editable wiki on the Node server, `npm start`,
and only those of the active ruleset):

- a link to a tiddler that does not exist: a box "SRD 5.1 (English) has this as Spell" with
  "Take";
- the button "Content" of the editor toolbar: search, take, and the link into the text;
- every relation in the form: the entries of its types beside the tiddlers (dashed);
- the search: a group of its own below the hits;
- the hub `Content` (under `Information`): per type, with filters by value and pages, a preview
  of each entry and "Take".

**Titles:** what is in the wiki always wins. An entry whose title exists with the same type
counts as taken; with another type it is offered as "Title (Type)" ("Balor (Creature)" beside
the person Balor). What a taken entry names in `base` or `spells` and the wiki lacks is offered
in the message - nothing comes by itself.

**The text** stays in the language of the package. Without a package, in the published copy and
for who may not write, nothing of this shows.

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
In the views that see it, a locked part stands in a frame in the alert colour of the palette,
with a bar on top naming whom it is for ("Secret: Theren", "DM only"); a secret tiddler stands
in such a frame as a whole, outside the frame of its type, with the bar above its title.
**Locked values.** The values of the rules of a tiddler everyone sees can be locked on their own:
the field `secret-fields` lists the fields to lock (`secret-fields: rarity cursed`); `all`, or the
field left empty, locks the whole block of values and the price. They are visible like a secret
- to the DM and to the players of the player characters the tiddler is tagged with. What derives
from a locked value is locked with it: a locked strength shows no modifier and no saving throw,
a locked challenge rating no proficiency bonus and no XP, a locked part of the header line falls
away. In the views that see them they are marked in the alert colour. The editor offers the lock
with the values: "all" and a pill per value written.

Lock only with `Secret`, `<<secret>>`, `<$secret>` and `secret-fields`: a `$list` or `<%if%>` of
your own on the view hides the text, but not the dates, locations and spots in it, and a
transcluded secret tiddler shows wherever it is transcluded (both are errors below the title,
see "Checks").

## Sections in the text

Dated sections (`<<date>>`), spots (`<<spot>>`), locks (`<<secret>>`) and quest markers
(`<<quest>>`, see "Quests") are kinds of sections with the same rules. Each has a short form,
which runs to the next marker on the same level (a quest marker: to the end of its paragraph),
and a block form with an end of its own:

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
- A date counts only in an event, a spot only in a location, a quest marker only in a dated
  section of an event.
- A blank line after the opening tag of a block makes its text paragraphs; without it the text
  stays inline (TiddlyWiki).

The hints stand below the title of the tiddler, not in the published copy.

## Quests

A quest is a name. The DM marks the places in events that belong to it - the marked text *is*
the story, nothing is written twice, and every marker has the date of the section it stands in:

```
<<date>>
The party reached the laboratory.

<<quest "Find Tyria's laboratories">>They found hints of a second one near [[Kattegat]].

<<quest "The dark tower" status:"complete">>Behind the waterfall lay the tower.

* <<quest "Silmeria in the ice crystal">>A list item counts like a paragraph.

<$quest name="Stop Azurna's ritual">

Several paragraphs ...

</$quest>
```

- **Short form** at the start of a paragraph or list item: it marks that paragraph or item, and
  ends no other section - one dated section can hold markers of several quests, with ordinary
  text in between. Later in a paragraph it marks the rest of it, tinted. The **block form**
  marks what it encloses: several paragraphs (blank line after the opening tag), or part of a
  line.
- **Status** only by name: `status:"complete"`, `status:"failed"`, `status:"open"` (the same as
  none). The status of a quest is the status of its newest marker the view sees; a newer marker
  without status opens it again.
- **Quest or rumour:** a tiddler of that name tagged `Quest` makes it a quest - its body is the
  text for the planning. Without a tiddler the name is a rumour, a collection of hints. A quest
  for a few characters only gets `Secret` and their tags like any tiddler; a rumour has no
  tiddler, so it is locked in the event (`<<secret>>`, `<$secret>`).
- **Linked quests:** a marker directly inside a marker of another quest links the two, both ways
  (`<<quest "A">><<quest "B">>Text`: the paragraph belongs to both). There is no parent and no
  child; with three layers only the neighbours are linked.
- **In the event** a marker stands framed: a line in gold (a quest) or silver (a rumour), a
  light tint and a head with its name and, where it sets one, the status. A paragraph of a quest
  and a rumour together is striped in both colours.
- **The hub `Quest`** (in the hub `Campaign` as well) lists quests and rumours apart, as
  cards, newest marker first: the date and who takes part, the start of the newest marker, its
  event. Switches
  "open", "complete", "failed" - each only when there is something with that status, "open" on
  at first; complete and failed cards are grey.
- **The page of a quest** shows the planning, the quests linked with it and the history: every
  marker, newest first, with its date, its event (a jump to the section) and its text. A rumour
  opens the same page without a tiddler; in the editable wiki it offers "Create quest" and
  "Rename" (rewrites every marker; a name that exists already merges both, with a warning).
  Renaming a quest tiddler rewrites its markers too (Relink).
- Quests also show in the relations of what their markers link, in a graph of their own and on
  the maps of locations (see "Relations" and "Locations").
- `scripts/check-wiki.js` hints at a quest tiddler without a marker and at two names one letter
  apart (one quest written two ways).

## Relations

Relations are fields holding titles. **The field lives on the dependent, the arrow points to
what it depends on:** the member to its organisation, the child to its parent, the work to its
creator, the potion to its ingredient, the part to the whole. So the long lists never pile up on
a place or an organisation, and a new person is entered in one tiddler only. The graph and the
relation list show the way back by themselves.

| Axis | Field | On the dependent, e.g. | Edge | List forward / back |
|---|---|---|---|---|
| place | `leader` (on a location) | `leader: Baile` (organisation) | controls | Controls / Control (on the location) |
| | `location` | `location: Baile` | in | Location / Influence (organisations), Present (the rest), Creatures (kinds living there, several places each), Locations (places) |
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
| | `creature` | `creature: Fukuro` (a person, player character or form of a creature: its kind) | is a | Creature / Individuals |
| attitude | `alliance`, `enmity`, `bond` | both ends | Alliance, Enmity, Bond | the same |
| guidance | `mentor` | `mentor: Agin` (the student) | student of | Mentor / Students |
| | `patron` | `patron: Sola` | worships | Patron / Followers |
| things | `creator` | `creator: Corelei` (the item) | made by | Creator / Created |
| | `owner` | `owner: Balseth` | owned by | Owner / Possessions |
| | `component` | `component: Löwengras` (the potion) | contains | Components / Part of |
| | `base` | `base: Warhammer` (an item on a mundane one) | based on | Base item / Variants |
| | `spells` | `spells: Fireball` (an item, person, player character or creature) | spell | Spells / Known by |

- **Symmetric relations** (`spouse`, `sibling`, `family`, `alliance`, `enmity`, `bond`) are entered on both
  ends - deleting one tiddler loses nothing of the other. If both ends carry it, the graph draws
  one edge with two arrows.
- **One includes another:** a leader is an officer and a member as well, controlling a place
  means being present there, a parent is an ancestor. Only the highest is entered; a lower one
  next to it is not drawn and not listed (a `location` next to a `leader` on the same place
  gets a hint).
- **Give an item:** the editor of a person, player character, deity or organisation has a row
  "Possessions": the items chosen there get its title in `owner` when it is saved (an artifact
  has one owner - the old one goes). The field stays where it belongs, on the item.
- **From a content package:** every relation offers the entries of the content packages of its
  types beside the tiddlers of the wiki (dashed); one chosen is taken into the wiki at once,
  cancelling the editor takes it back.
- **Values from the base item:** choosing `base` in the editor copies the values of the rules of
  the base item into the empty fields, once ("Take the values" does it again later); nothing
  stays linked - a change of the base item changes nothing here, the price never comes along,
  a locked value comes with its lock.
- **Every relation its own edge:** two different relations between the same tiddlers are two
  edges (`under` and `mentor`: "answers to" and "student of").
- The colour of an edge comes from its axis; `alliance`, `enmity`, `bond`, `former` and `patron`
  keep their own.
- **Links** in the text are an edge of their own in grey ("references"), only in views that
  show them (`$:/graph/Default`); two tiddlers linking each other give one edge with two arrows.
- A spot that is a location points to the location it is part of (dashed), like a field
  `location`.
- **Quests** in the graph and the list of a tiddler: the open quests and rumours whose markers
  link it (`[[…]]`, `<<spotlink>>` for a location) - in gold or silver, with an edge to what
  else of the graph they mention and to the quests linked with them. No field: they come from
  the markers in the text. A quest (or rumour) itself shows its events instead: each with the
  date of its section (the newest one stressed), what its markers there mention, and the quests
  linked with it at the event where their markers stand together - as a graph and as a list.
- **Switches on top of graph and list:** one per kind they show (players, people with deities,
  organisations, locations, items, quests with rumours), in the colour of the kind - split at
  45° where a switch holds two colours; all on at first, a click leaves that kind out of the
  graph and the list of this tiddler (not saved). The tiddler itself always stays.
- **The list** shows every relation as a small heading with the number of its entries, the
  entries as pills in the colour of their type (like the tag pills and the nodes of the
  graph), the deceased and destroyed striped. Each tiddler keeps its own choice of graph or
  list (and of timeline or list for its events); a tiddler opened the first time shows the
  graph.

## Locations

Where something is, and which place lies in which, comes from fields and from the body of a
location - tags carry no meaning for places.

| Where | Field / syntax | Meaning |
|---|---|---|
| Person, player, deity | `location: Baile` | where they are most likely found - the most precise place that is still true; someone who moves around gets the region (one entry) |
| Organisation | `location: [[Cair Di]] Baile` | the places where it sits or is present (several, all equal); below the title one line per parent path: `… ▸ Königreich von Vandalia ▸ Cair Di Baile` |
| Location | `location: [[Königreich von Vandalia]]` | lies in ("liegt in"): a place of its own within a larger one |
| Location | `<<spot "Tavern">>` in the body of Baile | part of ("Teil von"): the tavern is a part of Baile - who is in the tavern is found in Baile |
| Organisation, person | `leader: Baile` | leads or controls the location ("Controls") and is present there - no `location` to the same place needed |
| Artifact | `location: [[Leuchtturm von Cair Di]]` | where it lies - instead of an owner: an artifact is unique and has one owner **or** one location; when it passes from a person to a place, the person moves to `former` |
| Item, material | `location: Briarwood Riganwald` | where it lies or is found (several, all equal); an item may have several owners as well |

A location has one parent: the location that has it as a spot, otherwise its field `location`.
Below the title every tiddler shows the path of its parents as small pills in the colour of
their type, with an arrow between them ("Andu Falas ▸ Königreich von Vandalia ▸ Baile"); the
places of one line stand side by side. A hint appears for a cycle, a spot of two locations, a person with
two locations, an artifact with an owner and a location and the like (not in the published
copy). The event list of a location also contains the events of every place within it. Its
graph shows the places within it. Its list shows who is there in four groups - "Control" (who
leads it), "Influence" (the other organisations there), "Present" (people, deities and items)
and "Locations" (the places within) - each one only with entries, everyone in one of them; the
places within form a tree with the same groups inside, folded, with the number of their
entries.

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

- Every location has the tabs "Map" (further maps beside it) and "Quests and rumours": the
  open quests and rumours that lead to it, each with the reason - what its newest marker links
  (a location, a spot, someone or something there - only what stands in that marker itself)
  and the place of the map it leads to, as pills (a spot as "Spot (Location)", it jumps to the
  spot on the map).
- The map (also of a location without a map image, spots or places within) shows a graph: the
  spots and the places within at fixed positions, each a dot with its name in a pill below it
  (filled for a tiddler, white and dashed for a spot without a tiddler of its own); they keep
  their size on screen when zooming. Hovering shows the text of a spot, a double click scrolls
  to it. The open quests and rumours whose newest marker leads to a place of the map stand on
  it as pills in gold or silver, with an edge to those places (a person or organisation it
  mentions leads to where it is); those about the location as a whole stand below the map.
  Above the map the same switches by kind as on the relations block (locations,
  organisations, quests, ... - whatever the map shows), all on at first; below them the
  buttons "Fit map" and "Edit positions" (drag a node to place it; the position is saved in
  the field `map-positions` of the location - not in the published copy).
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
below the title. A **range** is two prices with a dash or "to" between them (`price: 50-100 cr`,
`50 to 100 cr`, German `bis`; the coin behind the upper bound counts for both, `5 sh - 2 cr` works
too), shown as "50–100 Kr"; the lower bound must not be above the upper one. The converter of
the hub Currency takes ranges too.

**The file of a book:** `data: Runen I - IV.pdf` - a file from `data/book/`, embedded below the
body (PDF), not for a secret the active view does not see.

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

Each section stands out by a line on the left in the colour of events (a rule between two
sections), with a heading of the date of its section, the caption and the locations linked in
that section (a spot likewise in the colour of locations, with its name). Every event starts
with `<<date>>`, also
one with a single date; without any date in the field the heading reads `????` (with the
era). Below its tags, right-aligned, every tiddler with dates shows a date line: an
event the span of its whole field, every other type its years of existence. An event also
lists there the locations linked before its first placeholder. The timeline shows each section, a
span as a bar; the event table one row per point in time (a span: its start and end), with an
event in one title cell across all its rows as long as no other event lies in between, and the
caption next to the title. Links inside DM notes (`@@.tc-tiddler-frame`) are not counted as
locations. The block form `<$date>…</$date>` (with `section` and `label`) is a section with an
end of its own; see "Sections in the text".

**Timeline and table.** The hub `Event` shows every event, a person, player character,
organisation, deity, location or item the events that link it or carry it as a tag - a
location also those of every place within it and those that reference one of its spots. Two
tabs, kept per tiddler:

- **Timeline:** time runs upwards, the newest at the top, events without a date at the very
  bottom as `????`. An event on a single point in time is a dot on the axis; one with several
  sections or a span gets a lane of its own, where only spans are bars. Campaign events are
  drawn solid in the colour of the hub `Campaign`, all others dashed. Years without events
  fold into a break; a click opens it. Hovering highlights an event, a click selects it: its
  card grows by its tags and one line per section with its caption, each a jump to that section.
  The timeline of a tiddler draws its own years as a pale band behind the events.
- **Table:** one row per point in time, a span with its start and end; the title of an event
  spans its rows as long as no other event lies in between. Campaign events are underlined.

**Dates in a text.** `<<dateformat "1351-07-11">>` writes a date with the month and the era of
the calendar, as headings and date lines do; `<<dateformat date={{!!date}} section:2>>` writes
section 2 of the date field of the tiddler.
`<<dateadd "1351-07-11" 30>>` gives the date 30 days later, `<<datediff "1351-07-11"
"1351-08-20">>` the days in between - the same as the calculator of the hub `Calendar`.

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

## Calendar

The calendar engine of `tiddlyrpg-core` calculates with the calendar of the wiki: a JSON data
tiddler named in `$:/config/tiddlyrpg/calendar`, usually brought by the campaign setting or
written in the wiki. Without one, dates are shown as entered (`1350-03-12`), and the calculator
on the `Calendar` hub is hidden. With one, the hub shows the description of the calendar, a
calculator (a date plus a number of days, also written out), the days between two dates and the
table of months and festivals.

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

## Checks

Below the title of a tiddler stand its messages - in the editable wiki only, not in the
published copy, not for system tiddlers and not for a tiddler the view does not see:

- **errors** (a bar in the alert colour): something is broken or does not work as meant;
- **hints** (muted): fine, but better with what the hint names.

Hovering a message shows the id of its rule. A message that would name a tiddler the view does
not see, or repeat text of a section it does not see, is left out for that view. In the editor
the messages of the draft stand below the form, with a button where the fix is clear (see
"Editing").

**The whole wiki at once:** `node scripts/check-wiki.js <wiki folder>` in this repo, or in a wiki
that has this package in `node_modules` the npm script `"check": "node
node_modules/tiddlyrpg-plugins/scripts/check-wiki.js ."` (`npm run check`). It reports the same
messages for every tiddler in the view of the DM, plus the files in `images/` the wiki names,
each with the id of its rule, and ends with exit code 1 if there is an error. Names of themes
after the folder run only their rules (`npm run check -- relations links`); `--github` also
writes each message as an annotation for GitHub Actions.

**Switching off at a tiddler:** the field `trpg-noerror` (errors) or `trpg-noinfo` (hints) holds
the ids of the rules whose messages are left out there, e.g. `trpg-noinfo: relations/leaders` for
an organisation led by a council. Present but empty (`trpg-noinfo:` without a value), it leaves
out every message of its level. An id that is no rule is a hint.

| Id | Level | Message |
|---|---|---|
| `checks/switches` | hint | `trpg-noerror` or `trpg-noinfo` names an id that is no rule |
| `dates/format` | error | a part of the date field that cannot be read, a day or month the calendar does not have, start after end, sections out of order |
| `dates/field` | hint | an empty side or section in the date field |
| `dates/phases` | hint | a phase of a non-event without an end before a later one, `..` as start |
| `dates/event` | hint | an event without date, without `<<date>>` at the start, sections without heading, text before the first `<<date>>` |
| `dates/placeholders` | error, hint | `<<date n>>` beyond the sections of the field (error); two `<<date>>` for one section, `---` right before one (hints) |
| `expected/image` | hint | a person, player character or location without image |
| `expected/map` | hint | a location without map |
| `expected/player` | hint | a player character without the field `player` |
| `expected/text` | hint | a tiddler without text (not a quest, a tiddler with a file in `data`, a hub) |
| `fields/schema` | error | a field of the rules with a name the core or a relation uses, a field defined twice, a schema that lists a field without definition, a field the field list of the editor still shows (only `check-wiki.js`) |
| `fields/value` | error, hint | a value of a field of the rules its format does not read (error); a trait that fits two main entries (hint) |
| `fields/when` | hint | a value of a field that counts only with another value, by itself or by its group (damage on a potion) |
| `fields/tag` | hint | a value names the category of the wiki it belongs to (a potion: Consumable) and the tiddler lacks the tag; fix: set the tag |
| `images/files` | error | a file in `image`, `map`, a spot or `<<image>>` that is not in `images/` (only `check-wiki.js`) |
| `images/folder` | error | `<<image "...">>` in a tiddler without type and without `folder:` |
| `images/unused` | hint | a file in the image folder of a type or in `images/map/` that no tiddler names (only `check-wiki.js`, the path of the file as title) |
| `images/joined` | hint | images or maps at a spot joined to a tiddler - they show in that tiddler |
| `items/base` | error | a category without base type, two base types |
| `items/price` | error | a price that does not fit the currency |
| `links/missing` | hint | a link to a tiddler that does not exist; from how many tiddlers it is linked; for the name of a spot its location and `<<spotlink>>` |
| `locations/structure` | error | a location in two places or in a cycle, naming no location, with a parent hidden from someone who sees it; a person in two places; an artifact in two places, with two owners, or with owner and location |
| `locations/led` | hint | `location` names a location `leader` already holds |
| `locations/tag` | error | a location as tag |
| `macros/rules` | error | a rules macro with a text the ruleset does not understand |
| `macros/unknown` | error | a macro nothing defines |
| `plugins/choice`, `plugins/version`, `plugins/currency` | error | the chosen ruleset or setting is missing, disabled or of another type; a plugin needs a newer core; the reference coin is none of the currency (only `check-wiki.js`; in the wiki under ControlPanel -> Settings and in the hub Currency) |
| `plugins/domains` | error | an extension of a rules domain without base domain, of a domain that holds no terms, or with an id the domain has; a trait whose parent is no entry of its domain or that is its own ancestor (only `check-wiki.js`) |
| `quests/marker` | hint | a quest without a marker |
| `quests/similar` | hint | two names of quests or rumours that look like one written two ways: the same apart from case, spaces and punctuation, or - from five letters on - one letter or two swapped |
| `relations/missing` | error | a relation field names a tiddler that does not exist (for `location` with the spot of that name) |
| `relations/included` | hint | an entry another field to the same target includes (`member` next to `leader`, `ancestor` next to `parent`) |
| `relations/former` | error | `former` and `member` (or what includes it: `officer`, `leader`) or `owner` name the same target |
| `relations/symmetric` | hint | a symmetric relation (`spouse`, `sibling`, `family`, `alliance`, `bond`, `enmity`) only on the other side |
| `relations/siblings` | hint | two children of a parent without `sibling` between them |
| `relations/family` | hint | `family` next to another family relation of the same two |
| `relations/ancestor` | hint | an `ancestor` the line of parents already reaches |
| `relations/leaders` | hint | an organisation led by several living tiddlers |
| `relations/deadleader` | hint | a dead tiddler leads something a living one leads as well: there is a successor, the dead one is a member now (of a location: no entry). A dead leader without successor stays leader - death ends no membership |
| `secrets/view` | error | a tiddler asks the view itself (`$:/state/tiddlyrpg/view`, `trpgview`) instead of locking; a list filtered with `trpg.visible` is fine |
| `secrets/transclusion` | error | a secret tiddler is transcluded where someone sees it who may not see the secret (fine inside a tiddler or section locked for the same players or fewer) |
| `sections/structure` | error | a short form inside another block, sections of a kind nested, `<<secret>>` in the middle of a section, a kind in the wrong tiddler, a caption by position, a lock naming no player character, the problems of a quest marker |
| `spots/spotlink` | error | a `<<spotlink>>` whose location does not exist or does not have the spot |
| `spots/joinedtext` | hint | a spot joined to another location has a text of its own - it shows only here, not where the spot leads; move it into that location (a spot joined to an organisation or a person keeps its text) |
| `spots/similar` | hint | a spot without tiddler whose name looks like a title written another way (as `quests/similar`) |
| `types/missing` | hint | a tiddler without type tag (not the start page `Campaign`) |

## Editing

In the editable wiki the editor of a tiddler knows the formats of this plugin. Everything below
changes the draft only - cancelling takes it back - with the exceptions that save a tiddler at
once: a new location ("Sub-location") and an entry taken from a content package (in a relation,
"Possessions" or the button "Content"); cancelling takes that tiddler back as well, unless it was
changed or opened in the editor since.

**Buttons of the toolbar** (in the accent colour, each with a dropdown):

| Button | In | What it does |
|---|---|---|
| Date section | events | `<<date>>` before the paragraph or `<$date>` around the selection, its date in the field `date` at the right place; at a date: change or remove both |
| Quest marker | events | `<<quest>>` at the start of the paragraph or list item, `<$quest>` around a selection; the names of quests and rumours to pick, a new name and names written almost alike in yellow; at a marker: another name, a further quest linked, remove one |
| Quest status | events | at the marker of the paragraph: open -> complete -> failed -> open |
| Party | events, quests | the player characters who were there (their tags), one by one or the whole party |
| Lock | all | `<<secret>>` before the marker of the section, else `<$secret>` around the paragraph or the selection; for chosen player characters or the DM only |
| Spot | locations | `<<spot>>` before the paragraph (it holds the text up to the next marker) or `<$spot>` around the selection; at a spot: remove |
| Link to a spot | all | `<<spotlink>>`: a location, then one of its spots; a selection becomes the text of the link |
| Sub-location | locations | a new location inside this one, saved and opened at once - a selected text moves into it; with the cursor in a spot without tiddler: the spot as a location of its own, with its text, images and lock, the marker stays |
| Rules | all | `<<term>>` by id or term, `<<unit>>` with the units of the ruleset that fit the number |
| Content | all | an entry of a content package by its title: taken into the wiki and linked in the text (see "Content packages") |

With the cursor on a line of its own behind the last paragraph, a marker goes there - for the
paragraph the DM writes next - and the cursor behind it; a lock there is an empty `<$secret>`
with the cursor inside. Where a marker of the button already stands, the button changes it
instead of setting a second one. Ctrl+Z undoes the text, not the field `date`. The buttons are switched on and off under
ControlPanel -> Appearance -> Toolbars -> Editor Toolbar; keyboard shortcuts (none by default)
under ControlPanel -> Keyboard Shortcuts.

**The form** below the text shows the fields of the type: those whose absence a check reports
(the image of a person, the player of a player character, the map of a location, the date of an
event) also while empty, every other field of the type under "More fields". A relation field
picks from what it may name, as pills with ×, a location with its path; a person, a location
and an artifact have one `location`, an artifact one `owner`. The date shows the reading of
each section, an event also how many `<<date>>` its text has; a price its output and the coin;
images and maps a preview. An item gets one category. The values of the rules follow the fields
of the type (see "Values of the rules"); the lock of values and "Take the values" of a base item
stand with them. A draft without type gets the types to
choose; a change of type takes out the fields the new type does not have. Below the fields the
messages of the draft, with a button where the fix is clear, "Create" for a missing tiddler and
"Do not report" (the rule into `trpg-noinfo` or `trpg-noerror`). What the pickers offer is what
the active view sees.

**Symmetric relations** (`spouse`, `sibling`, `family`, `alliance`, `bond`, `enmity`): saving
in the editor writes the other end too, takes it out there too and follows a rename. Switched
off under ControlPanel -> Settings -> TiddlyRPG -> Editor. Files written by hand still need
both ends.

**New tiddlers:** "+" beside edit and close on the hub of a type opens a draft of that type; an
event asks for its date first, an item or a category for the base type. A name that another
tiddler has, in any case, is refused with a red line where it is typed (sub-location, rumour).

**Search:** switches of the kinds above the hits choose what to show - none chosen is all; the
link button of the editor shows them too.

**Rumours:** "Create quest" opens a draft tagged `Quest` with the player characters of its
events chosen; "Rename" offers the names that contain what is typed and those written almost
alike.

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
