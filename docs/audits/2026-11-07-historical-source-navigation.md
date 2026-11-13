# Historical election selection and stable question citations

The directory previously hid its publication selector when a state had only
one source. After that election expired, default requests correctly returned no
current records, while the historical source was accessible only through an
explicit URL. The directory now offers a dated Election selection in that case.
Current election remains the default; selecting a historical publication is an
explicit action. A sole current publication keeps the simpler existing layout.

Availability comes from the server's current-election metadata, retaining the
exact expiry boundary and avoiding a second browser clock. Search, office
filters, pagination, back navigation and unavailable-source recovery keep their
existing explicit source context. The API contract and snapshot schema remain
unchanged.

Johnson County question identities include their cited sample URL and PDF page.
The recurring reader previously selected the first matching sample in each new
capture, which could change existing question links when an earlier style was
added. It now retains the accepted identity and citation while that exact
question occurrence remains in the validated publication set. Missing or altered
accepted occurrences require review; repeated wording on a different sample
does not silently replace an accepted citation.

Regression checks cover an added earlier style, reordered styles, removed
citations and altered identities. Retained-data checks use all 155 Alaska
records, 102 Johnson County candidates and the 93 original Johnson sample
documents. Historical access preserves election dates and establishes neither
election outcomes nor personal ballot eligibility. Existing publisher holds and
production import/publication/scheduling boundaries remain unchanged.
