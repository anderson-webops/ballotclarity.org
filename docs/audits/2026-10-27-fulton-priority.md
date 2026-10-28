# Fulton-first collection

The shared candidate worker previously ran every configured cycle family before
standalone sources. Fulton could therefore wait behind unrelated national work,
even when its current source did not have a cycle catalog. Both collection modes
now prioritize the Fulton family and its discovered future elections. Other
sources retain their relative order. The optional priority configuration changes
neither source eligibility nor public presentation order.

The existing Fulton collector covers candidate and raw question records from
county publications, including municipal and district-specific entries. Those
records retain their actual scope. Current commissioners, profiles, finance and
reference collection have separate source and scheduling contracts; changing the
shared candidate queue does not claim those systems have run or been imported.

## Additional official-source review

Native requests on October 28 UTC retained response metadata, hashes and source
bodies locally. These are research holds, not newly imported datasets:

- The [county commission layer](https://gismaps.fultoncountyga.gov/arcgispub/rest/services/BOC/Fulton_County_Commission_Districts/MapServer/1?f=pjson)
  returned HTTP 200 with an ArcGIS JSON error code 500 and an initialization
  failure. No geometry was accepted. Successful HTTP transport alone does not
  establish usable geography.
- The services1.arcgis.com robots request returned HTTP 403. That host remains
  held; portal proxies and cached copies do not provide acquisition permission.
- The [official school-board roster](https://www.fultonschools.org/fcs-board-of-education)
  was accessible and identified six occupied district seats and a vacant
  District 3. Its [linked privacy policy](https://www.fultonschools.org/privacy-policy)
  returned HTTP 406 with both supported native document and text requests.
  Publisher-policy review remains incomplete, so no school-board collector or
  profiles were enabled. A former member's name remains in the vacant district's
  URL; URL text is not evidence of current officeholding.

Commission-district and school-board applicability remain unassigned without
trusted geography. Fulton County Schools and Atlanta Public Schools are not
interchangeable, and neither a ZIP centroid nor a postal city supplies that
boundary. Existing policy, provenance, review, last-good retention and publication
gates remain in force. Priority is not a claim of complete county coverage.
