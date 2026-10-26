# East Greenwich reusable collection

## Official publications

The [town election index](https://www.eastgreenwichri.gov/192/Voter-Registration-Elections)
offers five precinct samples beneath its dated general-election heading. Current
normal pinned requests verify the index, robots and linked accessibility,
copyright and privacy content before requesting PDFs. All five original document
hashes and all 33 existing candidate fields/IDs remain unchanged. The ten pages
reconcile 160 repeated candidate claims, including the distinct House 24 sample
and House 30 samples. Questions remain separate from candidate records.

The collector uses offered dates and links, not an annual URL generator or a
guessed election date. It requires the five reviewed precinct controls, accepts
additional explicitly offered 09xx styles within its bounds and holds incomplete
sets pending. A changed precinct inventory requires review. Four offered election
sections, twenty styles per section and a 32 MiB combined capture bound prevent
unbounded collection. Unsupported elections or layouts remain review exceptions.

## Visual completeness

Text extraction is checked against bounded SVG output from the same PDF. Every
visible glyph must match an extracted word, and every extracted word must have a
rendered glyph. Only the reviewed line, rectangle and selection-oval primitives
are accepted. Selection marks reconcile with candidate and blank write-in rows;
the reverse-side marks reconcile with the printed Approve/Reject labels. Opaque
rectangles covering previously drawn text require review, with a 0.02-point
quantization tolerance at shared cell edges. These checks accept changing text
and row counts without pinning the whole drawing to one election's layout.

The two header images are separately checked by dimensions, placement and decoded
RGB pixel hashes. PNG checksums, lengths, dimensions, filter methods and bounded
inflation are validated. Equivalent PNG filtering or compression preserves the
fingerprint; a new image or changed illustration requires review. Raster content,
unmatched glyphs and unsupported vector drawings are not silently omitted or
converted into unattended OCR publications. The conversion contract remains the
existing bounded Poppler text/SVG worker. Stored facts need neither converter.

The decoder follows the [PNG filter specification](https://www.w3.org/TR/png-3/#9Filters)
and uses the supported Node zlib CRC32/inflation APIs. Original illustrations and
PDFs stay outside Git, runtime artifacts and public record payloads.

## Policy and reuse

Both wildcard and the named AI/search robots restrictions remain enforced with
the existing identity. The exact reviewed robots content, complete footer and
linked legal content remain pinned. The two exact published copyright year ranges
may advance to the current year without an annual code edit; changed owners,
terms, rights language, links or future-dated copyright years still require
review. This normalization grants no republication license and changes no source
or capture dates. Other Rhode Island publisher restrictions remain independent.

## Import and recovery

The family retains `ri-east-greenwich-2026`; compatible future sources use
`ri-east-greenwich-general-YYYY-MM-DD`. Literal parties, terms, seat limits and
the printed Micholas spelling remain intact. Shared statewide/town claims must
agree across styles. Single-name offices are not inferred unopposed, and no
precinct, school or personal voter assignment is inferred.

Changed same-URL hashes invalidate imports. Cached and restarted reads retain
capture clocks. Disappearing unexpired publications or accepted candidate
identities require review. The first automatic replacement preserves the exact
reviewed envelope, and failed backup leaves accepted data intact. Expired offered
elections remain expired; no next ballot is extrapolated. Synthetic 2030 tests
verify compatible future handling, not an actual future publication.

Runtime source approval, collection scheduling, reference receipt, durable import
and public activation retain distinct acceptance evidence. The prepared reader,
policy checks and active collector form one release boundary; source publication
alone does not establish receiving-host acceptance or complete statewide coverage.
