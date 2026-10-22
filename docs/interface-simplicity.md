# Interface simplicity guidance

## Reusable coding instructions

Design for a quick, useful glance, not for displaying everything at once.

- Identify the current task and show the information needed to decide or act. Prefer three meaningful facts per summary unit, with four as this project's maximum, not as a universal research-derived limit.
- Lead with the identifying or deciding words. Make the title dominant and use at most one subdued supporting line. Do not shrink text, tighten spacing, or add badges to fit more information.
- Make a summary row or card one accessible link to its detail page when a detail destination exists. Put background, provenance, attributes and secondary actions there. Avoid nested links and rows of buttons. Do not turn a complex interactive widget into a link.
- Remove duplicate destinations, redundant summaries, decorative explanations and unnecessary controls. Keep a task in one canonical place, such as changing location on the home page. Preserve working links and old entry points where feasible.
- Use a disclosure only when it meaningfully reduces substantial optional content. Do not hide a sentence behind a sentence-sized toggle, or make users expand the essential answer. Do not reveal everything merely to eliminate toggles.
- Group secondary navigation in an existing detail page, a restrained footer, or a sidebar only when it reduces clutter. Every important page must remain discoverable. Do not add another navigation system by default.
- Retain consequential limitations, attribution, meaningful errors, accessibility labels, source access and required disclosures. Never make limited data appear complete or imply eligibility from a location guess.
- Give each view a clear primary task. Keep comparisons and other tasks that genuinely need simultaneous information usable; do not impose a numeric cap on their entire dataset.
- Review the whole flow at narrow and wide widths, in light and dark modes, by keyboard, and with real available data. Use a two-second glance as a design heuristic, then test task completion, comprehension and discoverability. Do not claim a timed user study was performed unless it was.
- Before retaining text, ask: “Is this content visitors came to consume, or would removing it materially impair correct, accessible use or omit a required disclosure?” If neither, remove it. Keep implementation and design commentary out of the interface.

## Research boundaries

Cowan's 2001 review finds a roughly four-chunk short-term-memory capacity under specified experimental conditions, often three to five. It does not establish a maximum number of visible facts, links or cards on a web page. The older seven-plus-or-minus-two result describes different memory conditions; calling it simply disproven or universally replacing it with four would overstate the evidence. [Cowan, 2001](https://pubmed.ncbi.nlm.nih.gov/11515286/).

Visible menus rely heavily on recognition, not memorizing all their entries. Meaningful grouping matters more than imposing a universal menu count. [NN/g, Chunking](https://www.nngroup.com/articles/chunking/).

Web readers often scan. Older observational results and reading-time estimates support concise, front-loaded content, but neither a fixed two-word reading span nor a universal 20–28 percent reading rate is established for every user and task. [NN/g, How Users Read](https://www.nngroup.com/articles/how-users-read-on-the-web/), [NN/g, How Little Do Users Read?](https://www.nngroup.com/articles/how-little-do-users-read/).

Progressive disclosure prioritizes common needs and makes secondary content easy to find. Accordions add interaction cost and can conceal important content; they are most useful for substantial optional material, not short essential answers. [NN/g, Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/), [NN/g, Accordions on Desktop](https://www.nngroup.com/articles/accordions-on-desktop/).

The three-preferred/four-maximum summary budget and two-second review are deliberate product heuristics here. They are not validated attention thresholds or a substitute for usability testing.

## Deep research prompt

Investigate how much information a person can effectively scan, understand and act on in web and app interfaces. Distinguish short-term-memory experiments, visual attention and search, recognition versus recall, choice complexity, reading behavior, and actual task performance. Evaluate Miller, Cowan and subsequent replications or competing models, plus primary HCI and usability studies on information density, grouping, front-loading, progressive disclosure, accordions, cards and detail pages. Do not translate memory capacity into a universal maximum number of visible items, or treat old scanning percentages or a two-second test as universal laws.

Compare novices and experts; mobile and desktop; older adults; low literacy; assistive technology; stress and time pressure; and tasks requiring simultaneous comparison. Report methods, samples, dates, effect sizes where available, limitations and conflicting findings. Use primary papers and original research reports with working links. Separate experimental evidence, observational findings, interpretation and design heuristics.

Deliver a concise evidence table, an actionable decision framework for what stays visible versus moves to a detail page, examples for civic-information directories and candidate profiles, and a reusable coding-instruction block. Propose a realistic test plan measuring task success, comprehension, findability, errors and completion time, not just click count. Recommend numeric budgets only where the evidence supports the exact unit and context; otherwise label proposed defaults as hypotheses to test.
