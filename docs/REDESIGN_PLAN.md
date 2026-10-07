# Visual redesign plan

Status: **waiting for your go-ahead; implementation not started.** Covers the
web app (`web/`): race picker `/` and replay `/replay/[year]/[round]`. The
Arcade desktop app is out of scope.

## Decisions (from you)

| Decision | Choice |
|----------|--------|
| Mode | **Overhaul**: a new visual language on the same features, routes and content |
| UI font | **Titillium Web** (kept), with Geist Mono for numbers |
| Theme | **Dark + light**, following the system setting |
| Process | **Implement directly**, screenshots after each page, no Figma step |

## 1. Design read and dials

> **Reading this as:** an overhaul of a live-sports replay app for F1 fans and
> recruiters reviewing a portfolio, in an "F1 pit wall" language (broadcast
> graphics, slanted timing chips, the track as the stage), light and dark,
> built on the existing Tailwind v4 + Motion stack.

`design-taste-frontend` targets landing pages, not real-time dashboards (its
Section 13), so its rules apply in full to the race picker and only in part
(colour, type, shape, states, a11y, dashes, icons, motion discipline) to the
replay.

| Page | VARIANCE | MOTION | DENSITY | Why |
|------|----------|--------|---------|-----|
| Race picker `/` | 8 | 7 | 4 | Overhaul (+2 on a landing-style page) |
| Replay | 5 | 6 | 8 | Cockpit: dense data, mono numbers; motion only for state changes |

## 2. Audit of the current UI

Severity **H** = visible quality or a11y problem, **M** = generic or
inconsistent, **L** = polish. All of these are fixed by the overhaul.

| # | Where | Finding | Sev |
|---|-------|---------|-----|
| G1 | All | No visible focus style (`focus-visible`) anywhere | H |
| G2 | All | No pressed feedback (`active:`) on buttons | M |
| G3 | All | Hand-drawn SVG icons (`icons.tsx`) and text glyphs `✕`, `●` | M |
| G4 | All | Corner radii mixed with no rule | M |
| G5 | All | Accent `#e10600` at 100% saturation, used for unrelated jobs (buttons, Insights header, OUT, progress, selected season) | M |
| G6 | Replay | En-dashes in visible text ("laps 8–20", "10:06–16:51") | M |
| G7 | All | Default Next.js favicon, no OG image, no 404 page, no skip link | M |
| G8 | All | Loading states are plain text, not skeletons | M |
| G9 | All | Dark only, no light theme | M |
| P1 | Picker | Hero is text only, no visual | H |
| P2 | Picker | 24 identical cards in a 3-column grid; the 3 watchable races are buried | H |
| P3 | Picker | All-caps title with a red side bar; template look | M |
| P4 | Picker | Race states (ready, preparing, unavailable, upcoming) barely differ | M |
| P5 | Picker | Season `tablist` without arrow-key navigation | M |
| R1 | Replay | Not responsive: fixed `grid-cols-[1fr_20rem]` + `h-screen`; on a phone the track column would be ~70 px (inferred from code, to confirm with a 390 px screenshot first) | H |
| R2 | Replay | Insights header is a solid red block: the loudest thing on screen is a menu | M |
| R3 | Replay | Many all-caps tracked panel labels | M |
| R4 | Replay | Leaderboard undersells the timing-tower look | M |
| R5 | Replay | Transport controls are identical grey boxes | M |
| R6 | Replay | Thin 4 px timeline, no hover preview | M |
| R7 | Replay | Legend is a fixed panel with a text "✕" | L |
| R8 | Replay | Lost connection only shown by a small corner badge | M |
| R9 | Replay | Weather line uses three middle dots | L |
| R10 | Replay | Canvas and chart colours hard-coded, so no theme can reach them | M |

**Kept (logic and behaviour):** every feature and shortcut, the data-viz rules
from phase 7, safety car glow/fade, overtake-vs-jump animation rule,
reduced-motion handling, routes and page structure.

## 3. The new visual language: "pit wall"

**Concept.** The track is the stage. UI sits around and over it like F1 TV
graphics: a timing tower, a lap/clock bug, slanted chips for flags and
positions. Engineering-precise, not decorative.

**Theme tokens (CSS variables, swapped by `prefers-color-scheme`):**

| Token | Dark | Light |
|-------|------|-------|
| `--bg` page | `#0c0d11` carbon | `#eef0f3` cool grey-white (not warm cream) |
| `--surface` panel | `#15171d` | `#ffffff` |
| `--surface-2` raised | `#1e2129` | `#f6f7f9` |
| `--line` hairline | `#2a2e38` | `#d9dde3` |
| `--ink` text | `#eceef2` | `#14161b` |
| `--ink-2` secondary | `#9aa0ad` | `#555c68` |
| `--accent` F1 red | `#e3261e` | `#d21f17` (darker for contrast on white) |
| `--sc` safety car | `#ffb000` | `#c98a00` text / `#ffb000` fills |
| `--ok` green flag, DRS | `#1fb35c` | `#13874a` |
| `--track` | `#6e7282` outline / `#464a58` surface | `#9aa1ad` outline / `#c9ced6` surface |

All text pairs checked to WCAG AA in both modes before shipping. Team colours
and tyre colours are data and stay as they are; tyre letters keep their
measured-contrast rule.

**Type.** Titillium Web throughout UI: 900 for the page title, **700 italic as
the signature display style** (the forward lean of F1 graphics), 600 for
labels, 400 for body. Geist Mono with tabular figures for every number.
Sentence-case labels, no wide tracking. Italic display lines get
`leading-[1.1]` and bottom padding for descenders.

**Shape rule (documented in `globals.css`).** Panels and controls: 6 px.
**Slanted chips** (`skew -12°` container, unskewed text) for position numbers,
track status and the lap bug, the one signature motif. Tyre badges stay round
(they're tyres). Nothing else.

**Surfaces.** Hairline-separated panels. In dark mode, panels over the track
use a translucent surface with blur and a 1 px inner highlight (with a solid
fallback under `prefers-reduced-transparency`). In light mode they're solid
white with a cool tinted shadow. A faint fixed grain on the page background
only.

**Icons.** Phosphor (`@phosphor-icons/react`): `fill` for transport controls,
`regular` elsewhere. Replaces `icons.tsx`, `✕`, `●`.

**States.** 2 px accent focus ring with offset on everything interactive;
`active:scale-[0.97]`; 150-250 ms transitions on colour, opacity and transform
only; skeletons for loading; inline errors with a retry.

**Motion.** Only where it explains something: entry stagger on the picker,
panels sliding in, the timeline playhead, overtakes. Everything off under
reduced motion.

## 4. Page 1: race picker

1. **Top bar** (≤ 64 px, one line): mark + "F1 Race Replay" wordmark, GitHub
   link. The mark is a simple slanted geometric shape, also used as the
   favicon.
2. **Hero, asymmetric split** (left 5 / right 7 columns at `lg`):
   - Left: headline in 700 italic, "Every lap, replayed." (2 lines max); one
     sentence of subtext (≤ 20 words); one CTA, "Watch Saudi Arabia 2024",
     straight into a ready race.
   - Right: a **live mini replay** of that race (the real track canvas, cars
     moving, no controls) inside a slanted-corner screen frame. The product
     itself is the hero visual: no stock photo, no fake screenshot.
   - Under 768 px: one column, map under the text.
3. **Ready to watch (bento, exact cell count):** one large tile and the others
   smaller, each with the race's real track outline drawn from `/meta`, name,
   date and lap count. Tile backgrounds vary by a subtle tint per race. Only
   the ready races, so N races = N cells.
4. **Season calendar (a different layout family):** a big horizontally
   scrolling season strip (scroll-snap, arrow keys work), then rounds as a
   **month-grouped timeline**: large mono round number, event, country, date
   ("2 Mar"), and a status cell (Watch / Prepare / progress / Not in this demo
   / Not raced yet) styled so each state is distinct at a glance.
5. **Footer:** FastF1 credit, not-affiliated note, repo link.

**States:** skeleton tiles and rows; empty state if a season can't load
("Couldn't load the 2023 calendar. Is the API running?" + Retry).
**Motion:** hero and tiles enter with a short stagger; tiles lift 2 px on
hover; the mini replay is the only continuous motion.

## 5. Page 2: replay

**Desktop (≥ 1024 px): the track goes full-bleed** and the UI floats over it:

- **Lap/clock bug, top centre:** slanted chip "LAP 34 / 50" + race clock in
  mono, and the track-status chip next to it. Event title small at top left
  with a back link; speed and connection at top right.
- **Timing tower, left:** floating panel, slanted position chips, team edge,
  code, tyre badge, gap in mono. Selected rows: team-colour edge + fill.
  Overtakes slide, jumps snap (unchanged rule).
- **Insights dock, right:** collapsible panel; header is a quiet title +
  chevron (no red block); tools as switches; tool cards (telemetry, speed
  trace, strategy, race control) restyled to the new tokens.
- **Control dock, bottom centre:** floating panel with the timeline on top
  (8 px bar, 20 px hit area, hover tooltip with the time and lap you'd jump
  to, safety-car bands), then Phosphor transport buttons with a larger centred
  play/pause and a speed chip with - / +.
- **Shortcuts popover** replaces the legend panel (`kbd` chips), opened by L,
  ? or a button.
- **Connection-lost banner** over the track, plus a skeleton while loading
  (track outline appears as soon as `/meta` arrives).
- The canvas fits the track into the space between the tower, the dock and
  the controls (generalising today's `insetLeft`).

**Tablet and phone (< 1024 px):** track at the top, full width; below it a
segmented control switching **Tower / Insights**; control dock pinned at the
bottom; `100dvh` layout.

**Canvas and charts:** read colours from the theme tokens, so both modes work.

## 6. Not breaking anything

The tests define what must keep working: 67 Python, 22 web unit and 15
browser tests. The redesign keeps all accessible names, roles and texts they
use: `Race progress`, `Playback speed`, `Race timeline`, `Play` / `Pause`,
`Prepare race`, `Watch replay`, `Controls legend`, the `INSIGHTS` button,
`#insights-tools` controls, panel names, `<CODE> telemetry`, `meter`,
`svg[role=img]`, `role=status`, stint labels, `Live`, `SAFETY CAR`,
`LEADER`, `OUT`, `+N LAP`, `No flags yet`, and leaderboard `aside ol li`
rows with `aria-pressed`.

**Test updates that move together with the redesign** (same commit, and I'll
call them out):

- Insights checkboxes become switches: kept as `input[type=checkbox]` with
  `role="switch"`, so selectors survive.
- The Insights dock moves to the right and the tower floats on the left: the
  "track drawn beside the menu" test changes from "leftmost track pixel >
  336" to "no track pixel under any open panel".
- Track and safety-car pixel colours become theme tokens: test helpers read
  the token values instead of hard-coded hex.
- New: the browser suite runs **twice**, in dark and light colour schemes
  (Playwright `color_scheme`).

## 7. Execution order and checks

Each step is its own commit:

1. **Foundations:** theme tokens (dark + light), Phosphor, focus/active
   states, shape rule, grain, favicon/mark, 404, skip link, metadata, token-
   driven canvas and chart colours. Then: all tests, both themes.
2. **Race picker.** Then: all tests (both themes), screenshots at 1440 and
   390 px in both themes, and the **Taste pre-flight check** with every box
   reported.
3. **Replay.** Then: all tests (both themes), screenshots at 1440, 1024 and
   390 px in both themes, and the pre-flight boxes that apply (landing-only
   boxes marked N/A with the reason).
4. **Docs:** a "Design system" section in chapter 12, new README screenshots.

New dependency: `@phosphor-icons/react` only.

## Progress log

### Step 1: foundations (done)
Theme tokens (dark + light), contrast-checked; Phosphor icons; focus, press
and shape rules; mark/favicon, 404, skip link, OG metadata; canvas and charts
on tokens; browser suite runs in both schemes. Lesson: the dev server missed a
`globals.css` edit and served stale colours for a while, so a browser test now
reads the **live** tokens and checks every text pair against WCAG AA.

### Step 2: race picker (done): Taste pre-flight

Dials 8 / 7 / 4. ✅ pass, ➖ not applicable, with reasons.

| Check | Result |
|-------|--------|
| Design read, dials, system (Tailwind v4 + own tokens), redesign audit | ✅ sections 1-2 |
| Zero em/en dashes in visible text | ✅ `grep` finds 0 in `app/`, `components/`, `lib/` |
| One theme per page (auto light/dark), no inverted sections | ✅ |
| One accent (red); semantic colours only for state | ✅ |
| Shape rule (6 px; slanted underline; round tyres) | ✅ after fixing a pill-shaped progress bar |
| Button contrast (white on red 4.6:1 dark / 5.3:1 light) | ✅ checked by `e2e/test_design.py` |
| No CTA wraps at desktop (`whitespace-nowrap`, 2-word labels) | ✅ |
| Forms | ➖ none on the page |
| Serif / premium palette | ➖ sans only; not a premium-consumer brief |
| Italic descender clearance (`leading-[1.1]` + `pb-1`) | ✅ after fixing the large tile title and 404 heading |
| Hero fits viewport: 1-2 line headline, 19-word subtext, CTA visible at 1440 and 390 px | ✅ screenshots |
| Hero top padding ≤ `pt-24` (uses `md:pt-16`) | ✅ |
| Hero stack ≤ 4 elements (headline, subtext, CTA) | ✅ 3 |
| Eyebrows ≤ ceil(4 sections / 3) = 2 | ✅ 0 uppercase-tracked labels |
| No split headers, no zigzag runs | ✅ |
| One label per intent ("Watch replay", "Prepare race") | ✅ |
| Logo wall / quotes / testimonials | ➖ none |
| Bento: real visuals (track outlines), varied tints, exact cell count (3 races = 3 cells) | ✅ |
| Copy self-audit | ✅ every string re-read |
| Motion motivated: entry (hierarchy), tile reveal, hover lift (feedback), mini replay (the product) | ✅ |
| No marquee, no scroll listeners, no GSAP | ✅ |
| Nav one line, 64 px | ✅ |
| Distinct layout families (split hero, bento, grouped list) | ✅ 3 sections, 3 families |
| Long list (24 rounds) uses a better component: grouped by month, 2 columns, no per-row borders | ✅ |
| Real visuals: the hero is the real track canvas streaming a real race (a "real component preview"); tiles draw real circuits from data. No photos, no fake screenshots | ✅ (allowed alternative) |
| No overlay pills, photo credits, version footers, micro-meta, scroll cues, locale strips, section numbers, decorative dots (one middle dot in tile metadata) | ✅ |
| Reduced motion: Motion `reducedMotion="user"`, mini replay paused, skeletons and hover lift off | ✅ after fixing hover lift |
| Dark and light tested | ✅ screenshots + 34 browser tests in both |
| Mobile collapse explicit (hero, tiles, calendar, season strip scrolls) | ✅ |
| `min-h-[100dvh]`, never `h-screen` | ✅ |
| Effects clean up (mini replay disconnects) | ✅ |
| Loading (skeletons), empty and error states (retry) | ✅ |
| Icons: Phosphor only (+ one geometric brand mark) | ✅ |
| Core Web Vitals | ➖ not measured: no Lighthouse in this environment |

### Step 3: replay (done): Taste pre-flight

Dials 5 / 6 / 8. The replay is a real-time dashboard, outside the skill's
landing-page scope (its Section 13), so landing-only checks are ➖.

| Check | Result |
|-------|--------|
| Zero em/en dashes | ✅ `grep` finds 0 |
| One theme per page; tested in dark and light | ✅ screenshots at 1440 / 1024 / 390 px in both, 38 browser tests in both |
| One accent; status colours only for state (SC amber, green flag/DRS) | ✅ |
| Shape rule: 6 px panels and controls, slanted chips (lap bug, positions, status, banner), round tyres | ✅ after fixing a round play button |
| Button and text contrast (WCAG AA, live tokens) | ✅ `e2e/test_design.py` |
| No CTA wraps; icons Phosphor only | ✅ |
| Caps restraint: zero uppercase-tracked labels; data cells (LAP, LEADER, OUT) are content | ✅ |
| Middle dots: weather line replaced by a stat grid | ✅ |
| Motion motivated: overtakes slide, jumps snap, banner enters, SC glows (state); off under reduced motion | ✅ |
| No `window` scroll listeners; effects clean up | ✅ |
| `100dvh`, never `h-screen` | ✅ |
| Mobile collapse explicit: column layout, Tower / Insights tabs, pinned controls | ✅ audit item R1 fixed |
| Loading skeleton in the real layout's shape; error page; connection-lost banner | ✅ |
| Glass panels: surface, border, inner highlight; **no backdrop blur** (measured 60 → ~27 fps with it over the live canvas) | ✅ guarded by a browser test |
| All 20 drivers fit in the tower at 900 px | ✅ guarded by a browser test |
| Hero, bento, eyebrow count, logo wall, quotes, zigzag, marquee | ➖ landing-page checks |

Lessons from this step:

- **Lightning CSS and `backdrop-filter`:** given both the standard and the
  `-webkit-` property, it kept only the prefixed one, which Chrome ignores.
  Write only the standard property.
- **The dev server can miss `globals.css` edits** (it happened twice), so
  restart it after changing that file. A browser test now checks the live
  tokens.
- **Measure effects on a live canvas.** The blur looked nice and cost half
  the frame rate.
