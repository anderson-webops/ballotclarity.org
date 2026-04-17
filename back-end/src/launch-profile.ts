import type { CoverageResponse, ExternalLink, LaunchTargetProfile, OfficialResource } from "./types/civic.js";

const officialResources: OfficialResource[] = [
	{
		label: "Fulton County Registration and Elections",
		url: "https://fultoncountyga.gov/inside-fulton-county/fulton-county-departments/registration-and-elections",
		sourceLabel: "Fulton County official election office",
		authority: "official-government",
		sourceSystem: "Fulton County Registration and Elections",
		note: "Primary county source for office contacts, voter education, absentee voting, and election notices."
	},
	{
		label: "Fulton County elections contacts",
		url: "https://fultoncountyga.gov/inside-fulton-county/fulton-county-departments/registration-and-elections/elections-contacts",
		sourceLabel: "Fulton County official contacts page",
		authority: "official-government",
		sourceSystem: "Fulton County Registration and Elections",
		note: "Use this for the current main line, absentee desk, voter-registration desk, and office addresses."
	},
	{
		label: "Georgia My Voter Page",
		url: "https://mvp.sos.ga.gov/s/",
		sourceLabel: "Georgia Secretary of State official voter portal",
		authority: "official-government",
		sourceSystem: "Georgia My Voter Page",
		note: "Official statewide portal for voter registration status, precinct, sample ballot, absentee status, and election-day details."
	},
	{
		label: "Georgia election calendar and events",
		url: "https://sos.ga.gov/index.php/page/election-calendar-and-events",
		sourceLabel: "Georgia Secretary of State Elections Division",
		authority: "official-government",
		sourceSystem: "Georgia elections calendar",
		note: "Official statewide election calendar. The current 2026 calendar includes May 19, 2026 and November 3, 2026 election dates."
	},
	{
		label: "Georgia 2026 elections calendar summary",
		url: "https://sos.ga.gov/2026-elections-calendar-summary",
		sourceLabel: "Georgia Secretary of State Elections Division",
		authority: "official-government",
		sourceSystem: "Georgia elections calendar summary",
		note: "Official statewide highlights for qualifying windows, voter-registration deadlines, and advance-voting periods."
	}
];

const referenceLinks: ExternalLink[] = [
	{
		label: "Georgia Ethics Commission",
		url: "https://ethics.ga.gov",
		note: "State campaign-finance and ethics filing system for Georgia state and many local records."
	},
	{
		label: "Georgia General Assembly",
		url: "https://www.legis.ga.gov",
		note: "Official member, bill, and vote context for Georgia legislative offices."
	},
	{
		label: "Georgia Reapportionment Office",
		url: "https://www.legis.ga.gov/joint-office/reapportionment",
		note: "Official district maps and boundary references for state legislative geography."
	},
	{
		label: "U.S. Census Geocoder API",
		url: "https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html",
		note: "Official address normalization and geography lookup layer."
	},
	{
		label: "OpenFEC developer docs",
		url: "https://api.open.fec.gov/developers/",
		note: "Official federal campaign-finance API for committees, candidates, and filings."
	},
	{
		label: "Congress.gov API",
		url: "https://api.congress.gov/",
		note: "Official federal legislative activity API for congressional vote and bill context."
	},
	{
		label: "LDA.gov",
		url: "https://lda.senate.gov/system/public/",
		note: "Official federal lobbying disclosure system."
	},
	{
		label: "Open States",
		url: "https://openstates.org",
		note: "Practical reference layer for state-legislative normalization when official state feeds are incomplete."
	}
];

export const launchTargetProfile: LaunchTargetProfile = {
	slug: "fulton-county-georgia",
	name: "Fulton County",
	displayName: "Fulton County, Georgia",
	state: "Georgia",
	phase: "launching",
	phaseLabel: "Launch jurisdiction",
	summary: "Ballot Clarity's first real production jurisdiction is Fulton County, Georgia. The platform will launch there with official logistics, auditable source links, and a Postgres-backed editorial workflow before expanding to additional counties.",
	currentElectionName: "2026 General Primary Election and Nonpartisan Election",
	currentElectionDate: "2026-05-19",
	nextElectionName: "2026 General Election and Special Election",
	nextElectionDate: "2026-11-03",
	officialResources,
	referenceLinks
};

export function buildCoverageResponse(coverageMode: "seed" | "snapshot", coverageUpdatedAt: string): CoverageResponse {
	return {
		updatedAt: "2026-04-16T00:00:00.000Z",
		coverageMode,
		coverageUpdatedAt,
		launchTarget: launchTargetProfile,
		scopeNote: "The production launch target is Fulton County, Georgia. The current public archive remains available as a reference corpus while live county integrations, district matching, and verified contest packaging are completed.",
		currentState: coverageMode === "snapshot"
			? "A vetted imported coverage snapshot is active for the public API, while the Fulton County launch pipeline and editorial verification continue."
			: "The public site is still serving the reference archive while the Fulton County, Georgia live data stack is being connected and verified.",
		supportedContentTypes: [
			{
				id: "logistics",
				label: "Election logistics and official links",
				status: "in-build",
				summary: "County office links, statewide voter tools, election calendar, and polling-flow verification for Fulton County."
			},
			{
				id: "contest-packages",
				label: "Canonical contest pages",
				status: "live-now",
				summary: "Election, contest, candidate, measure, and source surfaces are now separate canonical page types in the product."
			},
			{
				id: "editorial-ops",
				label: "Editorial review and publish controls",
				status: "live-now",
				summary: "Postgres-backed publishing, corrections, source monitoring, and admin workflows are supported on the code path."
			},
			{
				id: "district-lookup",
				label: "Address-to-district matching",
				status: "planned",
				summary: "County launch depends on Census-based geocoding plus Georgia district geography before personalized Fulton ballots can be considered live."
			},
			{
				id: "fulton-contest-data",
				label: "Verified Fulton candidate and measure records",
				status: "in-build",
				summary: "Official filing lists, ballot text, and county or statewide records are being mapped so the launch does not rely on placeholder roster data."
			}
		],
		limitations: [
			{
				id: "no-fulton-ballot-live",
				title: "Fulton personalized ballots are not yet live",
				summary: "The current public archive remains readable, but it should not be mistaken for a certified Fulton County ballot service."
			},
			{
				id: "district-crosswalk-pending",
				title: "District matching still needs official geography crosswalks",
				summary: "A defensible Fulton launch requires benchmarked geocoding, statewide district layers, and auditable address-to-ballot joins."
			},
			{
				id: "local-format-variation",
				title: "Local candidate and ballot-text ingestion still needs connector hardening",
				summary: "County and statewide filing formats vary enough that the launch needs parser monitoring, source snapshots, and manual fallback procedures."
			}
		],
		nextSteps: [
			"Stand up the managed Postgres environment and move the admin and editorial store off local SQLite.",
			"Implement Fulton County logistics connectors first: county office notices, Georgia My Voter Page verification, and statewide election-calendar sync.",
			"Add district lookup using Census geocoding plus Georgia district geography before enabling live address-to-ballot matching.",
			"Load verified Fulton contest packages from official filing lists and certified ballot text before promoting the jurisdiction to live voter-facing coverage."
		],
		collections: [
			{
				id: "coverage",
				label: "Coverage and launch profile",
				status: "canonical",
				summary: "Public explanation of where Ballot Clarity is going live first, what is already built, and what still needs verification.",
				href: "/coverage"
			},
			{
				id: "status",
				label: "Public status and source health",
				status: "canonical",
				summary: "Operational view of source checks, incidents, review windows, and current coverage mode.",
				href: "/status"
			},
			{
				id: "corrections",
				label: "Public corrections log",
				status: "canonical",
				summary: "Sanitized public log for substantive corrections, open review items, and resolved public updates.",
				href: "/corrections"
			},
			{
				id: "archive",
				label: "Current public reference archive",
				status: "reference",
				summary: "The existing public ballot, candidate, measure, and source surfaces remain available as a reference corpus while Fulton County launch data is connected.",
				href: "/ballot"
			}
		]
	};
}
