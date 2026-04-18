import type { CoverageResponse, ExternalLink, LaunchTargetProfile, LocationGuessCapability, OfficialResource } from "./types/civic.js";

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

export function buildCoverageResponse(
	coverageMode: "empty" | "snapshot",
	coverageUpdatedAt: string,
	locationGuess: LocationGuessCapability,
	launchTarget?: LaunchTargetProfile
): CoverageResponse {
	if (!launchTarget || coverageMode === "empty") {
		return {
			collections: [
				{
					href: "/coverage",
					id: "coverage",
					label: "Coverage profile",
					status: "canonical",
					summary: "Read the current public note about Ballot Clarity's published local coverage state."
				},
				{
					href: "/status",
					id: "status",
					label: "Public status",
					status: "canonical",
					summary: "Check whether any public source monitors or imported coverage snapshots are active."
				},
				{
					href: "/data-sources",
					id: "data-sources",
					label: "Data sources",
					status: "canonical",
					summary: "Review the published data-source roadmap when one is available."
				}
			],
			coverageMode,
			coverageUpdatedAt,
			locationGuess,
			currentState: "No published local coverage snapshot or launch jurisdiction is active in this environment right now.",
			limitations: [
				{
					id: "no-published-coverage",
					summary: "Ballot Clarity does not currently have a published local guide, launch profile, or imported coverage snapshot loaded here.",
					title: "No published local coverage is available"
				}
			],
			nextSteps: [
				"Use nationwide civic lookup results and official election tools when they are available for a location.",
				"Publish a verified local coverage snapshot before exposing local guide, candidate, measure, or election routes as current coverage."
			],
			scopeNote: "Until a verified local coverage snapshot is published, Ballot Clarity should present missing local coverage honestly instead of falling back to fixture or archive content.",
			supportedContentTypes: [],
			updatedAt: new Date().toISOString()
		};
	}

	return {
		updatedAt: new Date().toISOString(),
		coverageMode,
		coverageUpdatedAt,
		locationGuess,
		launchTarget,
		scopeNote: `${launchTarget.displayName} is the current published local coverage target in this environment. Official election tools should remain the final authority for deadlines, precincts, polling places, and ballot confirmation.`,
		currentState: "A vetted imported coverage snapshot is active for the public API.",
		supportedContentTypes: [
			{
				id: "logistics",
				label: "Election logistics and official links",
				status: "in-build",
				summary: `Official election-office links, statewide voter tools, and logistics notes for ${launchTarget.displayName}.`
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
				summary: `Published local coverage depends on defensible geocoding and district geography before personalized ballots for ${launchTarget.displayName} can be considered live.`
			},
			{
				id: "local-contest-data",
				label: "Verified local candidate and measure records",
				status: "in-build",
				summary: "Official filing lists, ballot text, and jurisdiction records should replace placeholder or unpublished local contest data before guide promotion."
			}
		],
		limitations: [
			{
				id: "no-certified-personalized-ballot",
				title: "Personalized ballots should remain verification-first",
				summary: "Published local guides should not be mistaken for an official ballot service. Final ballot confirmation still belongs to official election tools."
			},
			{
				id: "district-crosswalk-pending",
				title: "District matching still needs official geography crosswalks",
				summary: `A defensible local launch for ${launchTarget.displayName} still requires benchmarked geocoding, district layers, and auditable address-to-ballot joins.`
			},
			{
				id: "local-format-variation",
				title: "Local candidate and ballot-text ingestion still needs connector hardening",
				summary: "Local and statewide filing formats vary enough that the launch needs parser monitoring, source snapshots, and manual fallback procedures."
			}
		],
		nextSteps: [
			"Stand up the managed Postgres environment and move the admin and editorial store off local SQLite.",
			`Implement local logistics connectors first for ${launchTarget.displayName}: election office notices, statewide voter-tool verification, and election-calendar sync.`,
			"Add district lookup using geocoding and official geography before enabling live address-to-ballot matching.",
			"Load verified local contest packages from official filing lists and certified ballot text before promoting the jurisdiction to live voter-facing coverage."
		],
		collections: [
			{
				id: "coverage",
				label: "Coverage and launch profile",
				status: "canonical",
				summary: "Public explanation of the currently published local coverage target, what is built, and what still needs verification.",
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
				label: "Current public guide collection",
				status: "reference",
				summary: "Published guide surfaces remain readable here only where Ballot Clarity has a verified local coverage snapshot.",
				href: "/ballot"
			}
		]
	};
}
