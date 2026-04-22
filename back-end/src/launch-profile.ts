import type {
	CoverageResponse,
	CoverageSnapshotProvenance,
	ExternalLink,
	GuideContentSummary,
	LaunchTargetProfile,
	LocationGuessCapability,
	OfficialResource
} from "./types/civic.js";

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
	summary: "Ballot Clarity's first production jurisdiction is Fulton County, Georgia. Official election links and the election overview can publish first, while verified contest pages wait for local review before wider guide promotion.",
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
	launchTarget?: LaunchTargetProfile,
	guideContent?: GuideContentSummary | null,
	snapshotProvenance?: CoverageSnapshotProvenance
): CoverageResponse {
	if (!launchTarget || coverageMode === "empty") {
		const snapshotScopeNote = snapshotProvenance?.configuredSnapshotMissing
			? "The configured live coverage snapshot is missing, so Ballot Clarity is serving lookup results without a published local guide snapshot."
			: "Snapshot provenance remains unavailable until an imported reviewed or approved local snapshot is loaded.";

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
			snapshotProvenance,
			guideContent: null,
			currentState: "No local guide is active in this environment right now.",
			routeFamilies: [
				{
					activeSources: [
						"U.S. Census Geocoder district matches",
						"Open States representative matches when provider linkage succeeds",
						"Official state and county election tools returned by the active lookup"
					],
					id: "nationwide-results",
					label: "Lookup and results routes",
					note: "District, representative, and person pages stay useful here even when a local guide is not active.",
					routes: ["/results", "/districts", "/districts/<slug>", "/representatives", "/representatives/<slug>"],
					status: "live-now",
					summary: "These routes are the main public product in an empty-coverage environment and run from the saved lookup in the browser."
				},
				{
					activeSources: [
						"Published local coverage snapshot only when one is verified and active"
					],
					id: "published-guides",
					label: "Published local guide routes",
					note: "These routes stay secondary until a verified local guide is active.",
					routes: ["/ballot", "/contest", "/candidate", "/measure", "/plan"],
					status: "guide-dependent",
					summary: "Ballot guide, contest, candidate, measure, and plan routes remain optional deeper layers rather than the default experience."
				},
				{
					activeSources: [
						"Source-backed local person records where Ballot Clarity has publishable finance or influence data",
						"Provider-backed representative fallback records when only lookup context is available"
					],
					id: "person-modules",
					label: "Person, funding, and influence routes",
					note: "Funding and influence modules remain conditional on reliable person-level linkage and should not be presented as universal coverage yet.",
					routes: ["/representatives/<slug>", "/representatives/<slug>/funding", "/representatives/<slug>/influence", "/candidate/<slug>", "/candidate/<slug>/funding", "/candidate/<slug>/influence"],
					status: "limited",
					summary: "Person pages are live, but richer finance and influence coverage still depends on the underlying person or entity record."
				},
				{
					activeSources: [
						"Published coverage profile",
						"Public source-monitor and status payloads for the current environment",
						"Public data-source roadmap and methodology pages"
					],
					id: "public-reference",
					label: "Public reference and operations routes",
					routes: ["/coverage", "/status", "/data-sources", "/corrections", "/help", "/methodology"],
					status: "live-now",
					summary: "These pages explain what is available and which public source layers are active."
				}
			],
			limitations: [
				{
					id: "no-published-coverage",
					summary: "Ballot Clarity does not currently have a local guide loaded here.",
					title: "No published local coverage is available"
				}
			],
			nextSteps: [
				"Use lookup results and official election tools when they are available for a location.",
				"Publish a verified local guide before exposing ballot, candidate, measure, or election routes as current coverage."
			],
			scopeNote: `Until a verified local guide is published, Ballot Clarity should present missing local coverage honestly instead of falling back to fixture or archive content. ${snapshotScopeNote}`.trim(),
			supportedContentTypes: [],
			updatedAt: new Date().toISOString()
		};
	}

	const hasPublishedGuideShell = Boolean(guideContent?.publishedGuideShell);
	const hasVerifiedContestPackage = Boolean(guideContent?.verifiedContestPackage);
	const publishedGuideSummary = hasVerifiedContestPackage
		? "A verified local contest package is published for the current launch area."
		: hasPublishedGuideShell
			? "An election overview with official links is published for the current launch area, but verified contest pages are still under local review."
			: "No verified local guide package is published for the current launch area yet.";

	return {
		updatedAt: new Date().toISOString(),
		coverageMode,
		coverageUpdatedAt,
		locationGuess,
		launchTarget,
		guideContent: guideContent ?? null,
		snapshotProvenance,
		scopeNote: `${launchTarget.displayName} is the current published election area in this environment. Active snapshot status: ${(snapshotProvenance?.status || "unknown").replaceAll("_", " ")}${snapshotProvenance?.sourceLabel ? ` (${snapshotProvenance.sourceLabel})` : ""}. Official election tools should remain the final authority for deadlines, precincts, polling places, and ballot confirmation.`,
		currentState: publishedGuideSummary,
		routeFamilies: [
			{
				activeSources: [
					"U.S. Census Geocoder district matches",
					"Open States representative matches where provider linkage succeeds",
					"Official state and county election tools returned by the active lookup"
				],
				id: "nationwide-results",
				label: "Lookup and results routes",
				note: "These routes should remain useful even outside the current published guide area.",
				routes: ["/results", "/districts", "/districts/<slug>", "/representatives", "/representatives/<slug>"],
				status: "live-now",
				summary: "Lookup results remain the cross-page context layer for district matches, representative records, and official tools."
			},
			{
				activeSources: [
					`Published local coverage snapshot for ${launchTarget.displayName}`,
					...(hasVerifiedContestPackage
						? ["Verified local contest, candidate, and measure records"]
						: ["Official local election links and election overview pages"]),
					"Official local election links tied to the active published guide"
				],
				id: "published-guides",
				label: "Published local guide routes",
				note: hasVerifiedContestPackage
					? "Guide routes are deeper reading layers when a verified local snapshot is active."
					: "Election overview and location hub routes are active now. Contest, candidate, measure, compare, and plan routes wait for verified local packaging.",
				routes: hasVerifiedContestPackage
					? ["/ballot", "/contest", "/candidate", "/measure", "/plan", "/compare"]
					: ["/elections", "/locations", "/ballot"],
				status: hasVerifiedContestPackage ? "live-now" : "limited",
				summary: hasVerifiedContestPackage
					? "Ballot guide, contest, candidate, measure, compare, and plan routes are active here because this environment has a verified local package."
					: "Election overview and location pages are active here because this environment has a published guide shell with official links, but verified contest pages are still pending."
			},
			{
				activeSources: [
					"Source-backed local person records",
					"Published finance summaries and influence context where Ballot Clarity has reliable linkage",
					"Provider-backed fallback records when no local person page exists"
				],
				id: "person-modules",
				label: "Person, funding, and influence routes",
				note: "Richer funding and influence coverage still depends on the underlying person/entity linkage rather than existing for every official automatically.",
				routes: ["/representatives/<slug>", "/representatives/<slug>/funding", "/representatives/<slug>/influence", "/candidate/<slug>", "/candidate/<slug>/funding", "/candidate/<slug>/influence"],
				status: "limited",
				summary: "Person pages are first-class public routes, but module depth varies by what finance, influence, and officeholder data is actually attached."
			},
			{
				activeSources: [
					"Published coverage profile",
					"Public source-monitor payloads for the active launch environment",
					"Public data-source roadmap and methodology pages"
				],
				id: "public-reference",
				label: "Public reference and operations routes",
				routes: ["/coverage", "/status", "/data-sources", "/corrections", "/help", "/methodology"],
				status: "live-now",
				summary: "These routes explain the active launch profile, public source health, and the broader data-source roadmap."
			}
		],
		supportedContentTypes: [
			{
				id: "logistics",
				label: "Election logistics and official links",
				status: hasPublishedGuideShell ? "live-now" : "in-build",
				summary: hasPublishedGuideShell
					? `Official election-office links, statewide voter tools, and logistics notes are published now for ${launchTarget.displayName}.`
					: `Official election-office links, statewide voter tools, and logistics notes are still being prepared for ${launchTarget.displayName}.`
			},
			{
				id: "contest-packages",
				label: "Canonical contest pages",
				status: hasVerifiedContestPackage ? "live-now" : "in-build",
				summary: hasVerifiedContestPackage
					? "Election, contest, candidate, measure, compare, and source surfaces are live with a verified local package."
					: "Verified contest, candidate, and measure pages are still under local review before wider publication."
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
