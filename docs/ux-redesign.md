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

- `npm run start:local` crashes in dev mode: the root `overrides` pin `simple-git@4.0.2`, which no longer
  has a default export, and `@nuxt/devtools` imports it as `import Git from 'simple-git'`. The workaround is
  `NUXT_DEVTOOLS_ENABLED=false npm run start:local`. The fix belongs in a separate dependency change.

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
- Fixing the dev server (`simple-git` override and Nuxt devtools).

**Phase 3, proposed**
- Moderated usability sessions with 5–8 voters, including at least two who use screen readers or screen
  magnification and two on low-end Android phones.
- Measure: time to first official link, lookup-to-results completion, and use of "Change location".
