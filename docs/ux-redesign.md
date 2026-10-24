# Ballot Clarity UX redesign proposal

Status: proposal, with Phase 1 implemented on the `claude/ux-redesign` branch.
Audit date: 2026-10-20, run against the local preview (`npm run start:local`) with the bundled
reviewed Fulton County official-logistics-only snapshot, at 1440×900 and 375×812.

## 1. What a voter comes here to do

Almost every visit is one of four questions, in roughly this order of urgency:

1. **When and how do I vote?** Election date, the next deadline, where to vote, how to check registration.
2. **What is on my ballot?** Contests, candidates, measures, in plain language.
3. **Who represents me now?** Districts and current officials.
4. **Can I trust this?** Sources, method, neutrality, corrections.

The current site answers all four, but it presents them with roughly equal weight and wraps every answer in
verification metadata. The redesign keeps the site's strong trust posture and reorders the experience around
those four questions, so the most urgent answer is always the first thing a voter reads.

## 2. Audit findings

### 2.1 Navigation and information architecture

- **Abstract, click-gated navigation.** The desktop header has three dropdowns: "Explore", "Learn and verify",
  and "Project and help". No destination is visible until a group is opened, so every trip takes two clicks
  and the labels don't say what is inside them.
- **The full nav appears only at 1280px and wider.** Between 768 and 1279px (most laptops with a sidebar, and
  tablets) visitors get a hamburger menu even though there is room for the main destinations.
- **The header hides when you scroll down.** For a reference site that people scan up and down, a header
  that disappears and comes back moves the page under the reader's eye and hides the way to change location.
- **Fourteen peer destinations.** Sources, Coverage, Data sources, Methodology, and Neutrality sit at the same
  level as "Ballot guide" and "Representatives". Trust pages matter, but they are reference material, not
  primary tasks.
- **Location context is easy to lose.** The saved location chip shows only at 1536px and wider. Opening
  `/districts` directly after a lookup showed "No saved location", so the voter has to look up their address
  again.

### 2.2 Readability

- **Wide-tracked all-caps labels everywhere.** About 270 labels use `tracking-[0.18em]`–`[0.24em]` uppercase
  at 11–12px ("RESULTS FOR", "OPEN LOGISTICS →"). Text that small, spaced that widely, and set in capitals is
  among the slowest type to read, and the site uses it for actions, not only for decoration.
- **Status chips pile up.** The results page shows six status pills before the first real content ("Current
  results", "Official tools visible", "Election overview available", "ZIP lookup", "Election overview
  available" again, "1 representative match"). They repeat each other and push the answer below the fold on
  a phone.
- **Duplicated copy.** On `/results` the sentence "This local guide includes verified official election
  links…" appears twice within one screen. The "Georgia My Voter Page" tool is listed twice with two slightly
  different descriptions.
- **Low-emphasis body text by default.** Most paragraphs use the muted text color, so the page has little
  contrast between primary and secondary content. The default light-scheme muted color (#657080 on #f4f5f8)
  is about 4.6:1, which passes AA but leaves no margin.
- **Decoration over structure.** Large radii (1.35–2rem), drop shadows, translucent panels with background
  blur, and a radial background glow make every block look like a separate card. Few cues show which block
  matters most.

### 2.3 Flow

- **The home page never mentions the election.** Two weeks before a general election, the first screen says
  "Look up your area." with no date, no countdown, and no next deadline. The election data is already loaded
  on that page.
- **Results don't lead anywhere obvious.** After a lookup, the voter gets three equal-weight cards
  ("Official logistics", "Representative data", "Local guide coverage") with all-caps links, then official
  tools, then a collapsed details drawer. There is no single "do this next".
- **Key dates read like a database dump.** The election overview lists deadlines in source order
  (Oct 5, Oct 23, Oct 13, Oct 30, Nov 3), not by date, and doesn't say which ones have passed or which one is
  next.
- **Data bug:** "Election Day polls close" shows **2:00 PM** on the election overview. The note beside it says
  7:00 p.m. The stored timestamp is `2026-11-03T19:00:00.000Z` (19:00 UTC, which is 2:00 PM Eastern). It
  should be `2026-11-04T00:00:00.000Z` because daylight saving time ends on November 1, 2026.

### 2.4 Development experience (found during the audit)

- `npm run start:local` crashed in dev mode: the root `overrides` pin `simple-git@4.0.2`, which has no default
  export, and `@nuxt/devtools` 3.4.2 imported it as `import Git from 'simple-git'`. **Fixed** by
  `claude/fix-devtools-simple-git` (lockfile moves to `@nuxt/devtools` 3.4.4, which no longer uses
  `simple-git`), merged into `claude/ux-redesign-graphics`. `NUXT_DEVTOOLS_ENABLED=false` is no longer needed.
- If the API keeps logging "Restarting 'src/server.ts'" under `start:local`, check whether the checkout lives in
  a cloud-synced folder (for example iCloud Drive's Desktop & Documents). Sync activity touches files that
  `node --watch` tracks. The same stack run from a local, non-synced disk did not restart.

## 3. Design principles

1. **Answer first, then show the evidence.** Each page opens with the plain answer: a date, a name, an action.
   Provenance stays one tap away and is never removed.
2. **One primary action per screen.** Every page has exactly one filled button. Everything else is secondary
   or a text link.
3. **Write labels the way people talk.** Use sentence case, verbs, and words a first-time voter would use
   ("Where to vote", not "Official logistics").
4. **Status appears once.** A single status line replaces stacks of pills. A pill is used only when it
   changes what the reader should do (for example, "Needs official verification").
5. **Structure comes from typography.** Use fewer cards, smaller radii, and no blur or glow. Hierarchy comes
   from size, weight, and spacing.
6. **Keep the reader's place.** The header stays put, and the saved location is always visible and
   changeable.

## 4. Proposed information architecture

```
Header (always visible, sticky, never auto-hides)
├── Your ballot      → context-aware: Lookup → Results → Election overview → Ballot guide / My plan
├── Districts
├── Representatives
├── Search
├── About ▾          → How it works: Methodology · Neutrality · Data sources · Coverage · Sources
│                      Help & project: Voting help · Corrections · About · Contact
└── [📍 Fulton County · Change]  [theme]
```

- Four task links are visible from 1024px up. Trust and project pages move into one clearly labeled
  "About" menu with descriptions.
- On mobile, the menu leads with the saved location and the four task links in a single column. Trust pages
  follow under their own heading.
- The footer mirrors the same groups so the two navigations teach one model.

## 5. Page-by-page proposals

### Home
- **Next-election banner**: the election name, the date, "in N days", and the next upcoming deadline, linked
  to the election overview. It shows only when an upcoming election is loaded.
- Hero: "Find your ballot, districts, and officials." The eyebrow keeps the vetted identity line
  "Nonpartisan public-interest project". The address field comes first, with the privacy disclosure kept
  beside the input as required.
- "How it works" in three steps (Enter your address → See your districts and officials → Check official
  voting details) replaces the trust-row fragments.
- The FAQ stays (it feeds FAQPage JSON-LD), with larger tap targets.

### Results (`/results`)
- Heading: "Your area: Fulton County, Georgia", with a "Change" link beside it.
- **One status sentence** in place of six pills: lookup type and guide coverage.
- **"Your next steps"**: an ordered list of the available destinations (voting dates and official links →
  representatives → districts), each with a sentence-case verb ("See voting dates and official links").
- Official tools are de-duplicated by tool name, keeping the first (live) entry. The same tool currently
  arrives twice: once as the live portal and once as its mirrored summary.
- The verification details stay in the existing disclosure, unchanged.

### Election overview (`/elections/[slug]`)
- The **next deadline** is the hero callout: "Next: Early voting ends · Fri, Oct 30 · in 10 days".
- Key dates are sorted by date, and each one is marked **Passed**, **Today**, or **In N days**. Passed dates
  are visually de-emphasized but stay in the list.
- The primary action depends on what is published: the ballot guide if it is verified, otherwise the
  location hub. (The polling-place resource in the current snapshot is a mirrored text summary, not the
  live tool, so it shouldn't be promoted to the primary button until the live URL is attached.)
- Passed dates are de-emphasized with the muted text color, not opacity, so they keep AA contrast.
  The axe smoke caught an earlier opacity-based version.

### Ballot guide, contest, candidate, and measure pages (Phase 2)
- A sticky contest index on desktop and a "Jump to contest" select on mobile.
- Candidate cards lead with name, party, and incumbent status. Funding and influence move behind
  "Money and influence" tabs instead of separate pages.
- Measure pages lead with a plain-language summary and "A YES vote means / A NO vote means" before the legal
  text.

### District and representative directories (Phase 2)
- Group by level (Federal → State → County → Local) with sticky level headings.
- Show the saved location on the page itself, read from the stored lookup when the URL has no `?lookup=`
  query, so direct navigation keeps the voter's context.

### Trust pages (Phase 2)
- Merge Methodology, Neutrality, and Data sources into one "How Ballot Clarity works" page with an in-page
  table of contents. Keep the old URLs as redirects or anchors.

## 6. Visual system changes (implemented)

| Token / pattern | Before | After |
| --- | --- | --- |
| Panel radius | 1.35–2rem | 0.75–1rem |
| Panel effect | drop shadow + backdrop blur, 90% opacity | flat, 1px border, solid surface |
| Page background | radial glow + gradient | solid `--app-bg` |
| Eyebrow labels | 11–12px, uppercase, 0.18–0.24em tracking | 12–13px, uppercase, 0.06–0.08em tracking (`eyebrow` shortcut) |
| Action links | uppercase tracked | sentence case, underlined on hover |
| Status pills | dot + pill, many per screen | fewer, quieter, square-cornered tags |
| Light muted text (Ledger) | #657080 (≈4.6:1) | #566173 (≈5.8:1) |

## 7. Phasing

**Phase 1, implemented on this branch**
- Visual foundation: shortcuts, flat surfaces, readable labels, quieter badges, stronger muted contrast.
- Header: flat task navigation, a persistent location chip, no auto-hide, an "About" menu with
  descriptions, and a reworked mobile menu.
- Footer: regrouped to mirror the header.
- Home: next-election banner and a "How it works" section.
- Results: one status line, "Your next steps", de-duplicated official tools.
- Election overview: chronological key dates with relative status and a next-deadline callout.
- Data fix: Election Day poll-close timestamp (in its own commit, for editorial sign-off).

**Phase 2, proposed**
- Ballot guide navigation, candidate tabs, and the measure YES/NO summary.
- Keeping saved location on directly opened directory pages.
- Consolidating the trust pages.
- ~~Fixing the dev server (`simple-git` override and Nuxt devtools)~~: done, see section 2.4.

**Phase 3, proposed**
- Moderated usability sessions with 5–8 voters, including at least two who use screen readers or screen
  magnification and two on low-end Android phones.
- Measure: time to first official link, lookup-to-results completion, and use of "Change location".

## 8. Merging the `codex/graphics` branch

`codex/graphics` (April 2026) added about 24 data-graphic components plus some infrastructure changes. By
October it was 316 commits behind `main`. Its own "merge main" commits had also revived content that `main`
deliberately removed (for example, "Download JSON" buttons and evidence rails that 5dc2c0b took out), and it
predates `main`'s June copy rules that ban internal jargon such as "evidence", "archive", "surface" and "layer".
The combined branch `claude/ux-redesign-graphics` is a real merge, so codex's history is preserved, but each
file was resolved on its merits.

**Kept, adapted to this design and to `main`'s copy rules**

| Graphic | Where | Why |
| --- | --- | --- |
| Representative grid | Results | Names your officials on the page, grouped federal → local, each linking to their profile. Uses `main`'s level classifier instead of codex's regex. |
| District ladder | Results | Lists your districts from largest to most local, each linking to its district page. Fixes a codex bug that labeled "State Senate" districts as Federal (now `utils/district-level.ts`, with tests). |
| Source provenance strip | Results → "How this result was matched" | Verification detail, so it sits inside the disclosure, below the answer. |
| Timeline | Candidate → actions | Replaces the plain action list. Codex had shown both, so the same actions appeared twice. |
| Finance breakdown chart | Candidate → funding | Shows money by funder category. The hard-coded "medium confidence" and "direct" badges were removed because they were constants, not data. |
| Comparison matrix | Contest | Side-by-side comparison of candidates or measures. Shown only when there are at least 2 to compare. |
| Ballot structure overview | Ballot guide | The contest index proposed for Phase 2. |
| Source health bar | Status | Replaces 4 number tiles. Shown only when source metrics exist, as `main` intended. |
| Theme picker hydration fix | Footer | Avoids a light/dark label mismatch on first render. |

**Left out**

- **Home fact cards and "what the lookup answers" panel:** they overlap the election banner and the "How it works" steps, and they reverse `main`'s later simplification of the home page.
- **Measure before/after diff and impact diagram:** they repeat the "current vs. proposed" cards and the sections below them.
- **Candidate evidence-completeness panel, office context card and per-candidate issue matrix:** they repeat the "what we know / don't know" lists and the issues section.
- **Representatives directory overhaul** ("How the representative layer is organized", directory lifecycle timeline, average source depth): self-referential copy that `main`'s rules exclude, and it would undo `main`'s tidier cards.
- **Compare-page matrix:** it duplicates the full compare table, which already has a "show only differences" filter.
- **Funding and influence "confidence/linkage" callouts:** they printed constants as if they were measurements.
- **Infrastructure:** the silent Postgres→SQLite fallback in the API, the package rename, the `.env` generator and npm script changes, and analytics constants for a tracker `main` no longer has. `main`'s `start:local` and security hardening supersede these.
- **Unused code:** the 7 components that were never rendered on that branch, plus the schema builders and types that only the dropped graphics used.

`codex/graphics` itself is unchanged, so anything left out can still be revisited there.

## 9. Merging the `claude/ux-readability-redesign` branch

A parallel session audited the **reading pages** (ballot, candidate, measure, representative detail), which
sections 1–8 left for Phase 2. Its full audit, with before/after screenshots, is in
[`docs/audits/2026-10-20-ux-readability-redesign.md`](audits/2026-10-20-ux-readability-redesign.md). The
branch was based on current `main` but had never been built. On this branch it lints, type-checks, and
passes the unit, e2e and a11y suites.

**Kept**

- **Ballot page, contests first:** a compact hero with one status callout, a sticky "On this ballot"
  contents list beside the races from 1280px, collapsed issue filters, and key dates and official links moved
  below the contests. Measure titles replace the generic "County Ballot Measure". This replaces codex's
  ballot-structure overview, which did the same job but pushed the contests further down.
- **Detail-page navigation fix:** candidate, measure and representative pages switched to two columns at
  1536px while their sidebar expected 1280px. Below 1536px, which includes most laptops and every phone, the
  section navigation rendered after the whole page. It is now a sticky sidebar from 1280px and a chip row at the
  top on smaller screens, titled "On this page".
- **Darker secondary text:** about 6.7–6.9:1 in all three light themes. It replaces the 5.7:1 values from
  section 6.
- **Reading-size floors** (12→14px and 14→15.6px for explanatory text) and a 72-character line limit inside
  panels.
- **Success callout tone**, so a verified guide no longer shows its status in amber.
- **Back-end regression test** for the Election Day poll-close time (`back-end/test/election-key-dates.test.ts`).
  Both branches made the identical data fix.

**Not kept**

- **Global 0.08em letter-spacing override:** labels already use 0.06em from the codemod in section 6, so this
  would have mixed two values.
- **Nested-card radius rule:** it set nested panels back to 1rem after the flattening in section 6. Its new
  hero and contents-list radii were also brought down to match (1rem and 0.75rem).
- **Header changes:** that branch only proposed them. Section 4's header is already implemented here.

## 10. Information density limits

These limits come from an October 2026 research review: working-memory studies
(Cowan's three-to-five chunks, and visual-memory work showing capacity drops as
items get more complex), glanceable-display and dashboard experiments, NN/g
eye-tracking, and NIST ballot usability research. They are conservative design
limits, not laws of cognition. A visible page acts as external memory, so lists
can be longer than cards.

| Object | Limit |
| --- | --- |
| Card, initial view | One identity line (name or title) plus two to three facts. A fifth fact means part of the card belongs on a detail page. |
| Actions per card | One primary and at most one secondary. |
| Group of cards | About four to seven on mobile and six to ten on desktop before another heading. |
| Critical information | Within the first two screens; never only below the third. |
| Measure card | Title, one-sentence summary, what Yes does, what No does. |
| Comparison views | Every candidate shows the same fields, side by side, with nothing hidden. |
| Ballot overview | Every contest is listed from the start; no "show more" to discover contests. |

**Disclosure.** The review found accordions acceptable for genuinely secondary
detail. This site deliberately goes further and uses no collapsible sections
except FAQs: content is either shown, moved to its own page, or removed. A test
(`front-end/test/no-toggle-sections.test.ts`) enforces this. Detail pages hold
long material such as full measure text, funding records and source lists.
