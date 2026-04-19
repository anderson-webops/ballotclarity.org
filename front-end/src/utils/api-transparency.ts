export interface PublicApiTransparencyItem {
	id: string;
	label: string;
	docsUrl: string;
	category: "finance" | "geography" | "influence" | "lookup" | "representatives";
	note: string;
	routeFamilies: string[];
	usedFor: string;
}

export const publicApiTransparencyItems: PublicApiTransparencyItem[] = [
	{
		category: "geography",
		docsUrl: "https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html",
		id: "census-geocoder",
		label: "U.S. Census Geocoder API",
		note: "Primary district-geography layer for address and ZIP-centroid enrichment.",
		routeFamilies: ["/results", "/districts", "/representatives"],
		usedFor: "District matches, geography-backed lookup notes, and canonical district routing."
	},
	{
		category: "lookup",
		docsUrl: "https://docs.zippopotam.us/docs/v1/",
		id: "zippopotam-us",
		label: "Zippopotam.us",
		note: "ZIP locality and centroid support used to seed nationwide ZIP lookups before district enrichment runs.",
		routeFamilies: ["/results"],
		usedFor: "ZIP-to-locality normalization and ZIP centroid lookup support."
	},
	{
		category: "representatives",
		docsUrl: "https://openstates.org/",
		id: "open-states",
		label: "Open States API",
		note: "Current officeholder records and representative identity/provider links.",
		routeFamilies: ["/results", "/districts", "/representatives"],
		usedFor: "Representative matches, public representative pages, and provider-backed person identity."
	},
	{
		category: "lookup",
		docsUrl: "https://developers.google.com/civic-information",
		id: "google-civic",
		label: "Google Civic Information API",
		note: "Supplemental election-info and official-tool lookup path when the provider returns usable election context.",
		routeFamilies: ["/results"],
		usedFor: "Official election information links, voter tools, and election-context fallback notes."
	},
	{
		category: "finance",
		docsUrl: "https://api.open.fec.gov/developers/",
		id: "openfec",
		label: "OpenFEC",
		note: "Federal campaign-finance attachment for matched people when Ballot Clarity has a reliable crosswalk.",
		routeFamilies: ["/representatives", "/candidate"],
		usedFor: "Funding pages, committee totals, coverage windows, and finance provenance."
	},
	{
		category: "influence",
		docsUrl: "https://lda.senate.gov/api/",
		id: "lda-gov",
		label: "LDA.gov API",
		note: "Federal lobbying and LD-203 contribution disclosure layer when a person-level linkage is reliable.",
		routeFamilies: ["/representatives", "/candidate"],
		usedFor: "Influence pages, lobbying/disclosure summaries, and provenance notes."
	},
	{
		category: "representatives",
		docsUrl: "https://github.com/LibraryOfCongress/api.congress.gov",
		id: "congress-gov",
		label: "Congress.gov API",
		note: "Federal office context and legislative identity enrichment for congressional routes where the match is stable.",
		routeFamilies: ["/representatives"],
		usedFor: "Congressional office context and related federal identity enrichment."
	}
];
