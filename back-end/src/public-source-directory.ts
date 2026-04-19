import type {
	SourceAuthority,
	SourceCitationTarget,
	SourceDirectoryItem,
	SourcePublisherType,
} from "./types/civic.js";

interface CuratedSourceDefinition {
	authority: SourceAuthority;
	geographicScope: string;
	id: string;
	limitations: string[];
	note: string;
	publisher: string;
	publisherType: Extract<SourcePublisherType, "official" | "nonprofit" | "public-interest" | "third-party civic infrastructure">;
	primarySourceLabel: string;
	reviewNote: string;
	routeCitations: SourceCitationTarget[];
	sourceSystem: string;
	summary: string;
	title: string;
	type: "official record" | "research brief";
	url: string;
	usedFor: string;
}

const curatedSourceDefinitions: CuratedSourceDefinition[] = [
	{
		authority: "official-government",
		geographicScope: "United States",
		id: "census-geocoder",
		limitations: [
			"ZIP-centroid lookups can be broader than a full address lookup.",
			"The geocoder returns geography and district boundaries, not candidate or officeholder data.",
		],
		note: "Official federal geography service used to anchor nationwide district matching.",
		publisher: "U.S. Census Bureau",
		publisherType: "official",
		primarySourceLabel: "Open Census Geocoder",
		reviewNote: "Ballot Clarity reviews this provider description when district-matching logic or published geography coverage changes.",
		routeCitations: [
			{ href: "/results", id: "results", label: "Nationwide results", type: "page" },
			{ href: "/districts", id: "districts", label: "District pages", type: "page" },
			{ href: "/representatives", id: "representatives", label: "Representative pages", type: "page" },
		],
		sourceSystem: "U.S. Census Geocoder",
		summary: "Official federal geography and district boundary service used to translate addresses and ZIP areas into canonical civic geography.",
		title: "U.S. Census Geocoder",
		type: "official record",
		url: "https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html",
		usedFor: "Nationwide district matches, canonical district routing, and geography-backed lookup context."
	},
	{
		authority: "nonprofit-provider",
		geographicScope: "United States",
		id: "open-states",
		limitations: [
			"Coverage depth varies by state and chamber.",
			"Officeholding records can support identity and office context without guaranteeing finance or disclosure depth.",
		],
		note: "Primary nationwide provider for current federal, state, and some local officeholder identity records.",
		publisher: "Open States / Plural",
		publisherType: "public-interest",
		primarySourceLabel: "Open Open States",
		reviewNote: "Ballot Clarity reviews provider matching and public route attachment when representative identity or district crosswalk logic changes.",
		routeCitations: [
			{ href: "/results", id: "results", label: "Nationwide results", type: "page" },
			{ href: "/districts", id: "districts", label: "District pages", type: "page" },
			{ href: "/representatives", id: "representatives", label: "Representative pages", type: "page" },
		],
		sourceSystem: "Open States",
		summary: "Public-interest civic data service used for current officeholder identity, officeholding, and district-linked representative records.",
		title: "Open States",
		type: "research brief",
		url: "https://openstates.org/",
		usedFor: "Representative identity pages, current officeholder matching, office and chamber context, and provider record links."
	},
	{
		authority: "official-government",
		geographicScope: "United States federal offices",
		id: "congress-gov",
		limitations: [
			"Applies only to federal congressional routes.",
			"Congress context does not replace official election authorities for ballot verification.",
		],
		note: "Official federal legislative metadata used when a congressional route can be matched confidently.",
		publisher: "Library of Congress",
		publisherType: "official",
		primarySourceLabel: "Open Congress.gov API",
		reviewNote: "Ballot Clarity reviews this federal enrichment layer when Congress member matching or committee context attachment changes.",
		routeCitations: [
			{ href: "/representatives", id: "representatives", label: "Representative pages", type: "page" },
		],
		sourceSystem: "Congress.gov API",
		summary: "Official congressional member and legislative metadata service maintained by the Library of Congress.",
		title: "Congress.gov API",
		type: "official record",
		url: "https://github.com/LibraryOfCongress/api.congress.gov",
		usedFor: "Federal office context, committee membership, and legislative activity summaries on congressional representative pages."
	},
	{
		authority: "official-government",
		geographicScope: "United States federal campaigns",
		id: "openfec",
		limitations: [
			"Federal campaign-finance coverage does not extend to every state or local officeholder.",
			"Finance attachment still depends on a reliable person-to-candidate crosswalk.",
		],
		note: "Official FEC campaign-finance service used for federal funding attachment where Ballot Clarity has a reliable person match.",
		publisher: "Federal Election Commission",
		publisherType: "official",
		primarySourceLabel: "Open OpenFEC",
		reviewNote: "Ballot Clarity reviews finance attachment rules when campaign crosswalk logic or FEC coverage windows change.",
		routeCitations: [
			{ href: "/representatives", id: "representatives", label: "Representative pages", type: "page" },
		],
		sourceSystem: "OpenFEC",
		summary: "Official federal campaign-finance API that exposes candidate, committee, receipts, spending, and cash-on-hand records.",
		title: "OpenFEC",
		type: "official record",
		url: "https://api.open.fec.gov/developers/",
		usedFor: "Federal funding summaries, committee totals, coverage windows, and finance provenance on person pages."
	},
	{
		authority: "official-government",
		geographicScope: "United States federal lobbying disclosures",
		id: "lda-gov",
		limitations: [
			"Influence attachment depends on reliable person or committee crosswalks.",
			"LDA coverage is federal disclosure data and does not imply complete state or local lobbying coverage.",
		],
		note: "Official federal lobbying-disclosure source used for person-level influence context where Ballot Clarity can attach it reliably.",
		publisher: "U.S. Senate Office of Public Records",
		publisherType: "official",
		primarySourceLabel: "Open LDA.gov",
		reviewNote: "Ballot Clarity reviews influence attachment rules when lobbying crosswalk logic or disclosure windows change.",
		routeCitations: [
			{ href: "/representatives", id: "representatives", label: "Representative pages", type: "page" },
		],
		sourceSystem: "LDA.gov API",
		summary: "Official federal lobbying and LD-203 disclosure service for registrant, client, issue-area, and contribution records.",
		title: "LDA.gov",
		type: "official record",
		url: "https://lda.senate.gov/api/",
		usedFor: "Federal influence pages, disclosure summaries, contribution totals, and person-level lobbying provenance."
	},
	{
		authority: "commercial-provider",
		geographicScope: "United States",
		id: "google-civic",
		limitations: [
			"Official election data availability varies by place and election.",
			"Ballot Clarity does not treat Google Civic as a replacement for the official election office links shown on the page.",
		],
		note: "Supplemental nationwide election-info provider used when it returns useful official-tool context.",
		publisher: "Google",
		publisherType: "third-party civic infrastructure",
		primarySourceLabel: "Open Google Civic API docs",
		reviewNote: "Ballot Clarity reviews this lookup layer when official-tool attachment or election-context fallback behavior changes.",
		routeCitations: [
			{ href: "/results", id: "results", label: "Nationwide results", type: "page" },
		],
		sourceSystem: "Google Civic Information API",
		summary: "Third-party civic infrastructure API that can return official election information and voter-tool context for matched locations.",
		title: "Google Civic Information API",
		type: "research brief",
		url: "https://developers.google.com/civic-information",
		usedFor: "Supplemental official election tool links, voter-information fallback context, and election verification notes."
	},
	{
		authority: "official-government",
		geographicScope: "Statewide official voter portals across the United States",
		id: "official-state-voter-portals",
		limitations: [
			"Each state controls its own portal and feature set.",
			"Ballot Clarity links users to the matched official portal but does not mirror the full state workflow.",
		],
		note: "Official state voter portals remain the authoritative place to confirm registration, sample ballot, precinct, absentee, and election-day details.",
		publisher: "State election authorities",
		publisherType: "official",
		primarySourceLabel: "Open state election authority directory",
		reviewNote: "Ballot Clarity reviews these official-tool links when state portal coverage or verification routing changes.",
		routeCitations: [
			{ href: "/results", id: "results", label: "Nationwide results", type: "page" },
			{ href: "/coverage", id: "coverage", label: "Coverage profile", type: "page" },
		],
		sourceSystem: "Official state voter portals",
		summary: "Official state-run voter portals used to verify registration status, sample ballot, absentee status, and polling-place details.",
		title: "Official state voter portals",
		type: "official record",
		url: "https://www.eac.gov/voters/register-and-vote-in-your-state",
		usedFor: "Official verification links and statewide voter-tool routing attached to lookup, district, and representative pages where relevant."
	},
	{
		authority: "official-government",
		geographicScope: "State and county election office layer",
		id: "official-election-verification",
		limitations: [
			"County-level office coverage varies by state and local publication practices.",
			"Ballot Clarity exposes the matched official links but does not replace the underlying election office site.",
		],
		note: "Official state and county election office links are the authoritative verification layer for deadlines, polling places, and local election administration.",
		publisher: "State and county election authorities",
		publisherType: "official",
		primarySourceLabel: "Open election office directory",
		reviewNote: "Ballot Clarity reviews this layer when official verification links or county-election-office routing changes.",
		routeCitations: [
			{ href: "/results", id: "results", label: "Nationwide results", type: "page" },
			{ href: "/districts", id: "districts", label: "District pages", type: "page" },
			{ href: "/representatives", id: "representatives", label: "Representative pages", type: "page" },
		],
		sourceSystem: "Official election verification layer",
		summary: "Ballot Clarity’s official verification layer points users back to the relevant state and county election authorities for critical election details.",
		title: "Official election verification layer",
		type: "official record",
		url: "https://www.usa.gov/state-election-office",
		usedFor: "Official tool panels, election verification routing, and place-specific authority links carried across nationwide results pages."
	},
	{
		authority: "ballot-clarity-archive",
		geographicScope: "Ballot Clarity public product layer",
		id: "ballot-clarity-methodology",
		limitations: [
			"This is Ballot Clarity’s own methodology layer, not an external official record.",
			"It explains how the product uses sources; it does not substitute for the primary record itself.",
		],
		note: "Ballot Clarity publishes its own methodology and verification rules so users can understand how source attachment, confidence, and limitations are handled.",
		publisher: "Ballot Clarity",
		publisherType: "public-interest",
		primarySourceLabel: "Open methodology",
		reviewNote: "This source record should be updated when public source attachment rules, confidence labels, or verification expectations materially change.",
		routeCitations: [
			{ href: "/coverage", id: "coverage", label: "Coverage profile", type: "page" },
			{ href: "/methodology", id: "methodology", label: "Methodology", type: "page" },
			{ href: "/sources", id: "sources", label: "Source directory", type: "page" },
		],
		sourceSystem: "Ballot Clarity methodology",
		summary: "Ballot Clarity’s public methodology and verification layer describing how official records, provider systems, and confidence labels are handled on the site.",
		title: "Ballot Clarity methodology and verification layer",
		type: "research brief",
		url: "/methodology",
		usedFor: "Explaining source attachment, confidence labels, verification expectations, and the limits of Ballot Clarity’s civic summaries."
	},
];

export function mapAuthorityToPublisherType(authority: SourceAuthority): SourcePublisherType {
	switch (authority) {
		case "official-government":
			return "official";
		case "nonprofit-provider":
			return "nonprofit";
		case "commercial-provider":
			return "third-party civic infrastructure";
		case "candidate-campaign":
			return "campaign";
		case "ballot-clarity-archive":
			return "ballot-clarity archive";
		case "open-data":
		default:
			return "public-interest";
	}
}

export function buildCuratedPublicSourceRecords(updatedAt: string): SourceDirectoryItem[] {
	return curatedSourceDefinitions.map(source => ({
		authority: source.authority,
		citationCount: source.routeCitations.length,
		citedBy: source.routeCitations,
		date: updatedAt,
		geographicScope: source.geographicScope,
		id: source.id,
		limitations: source.limitations,
		note: source.note,
		primarySourceLabel: source.primarySourceLabel,
		publicationKind: "curated-global",
		publisher: source.publisher,
		publisherType: source.publisherType,
		reviewNote: source.reviewNote,
		routeFamilies: source.routeCitations.map(citation => citation.label),
		sourceSystem: source.sourceSystem,
		summary: source.summary,
		title: source.title,
		type: source.type,
		url: source.url,
		usedFor: source.usedFor,
	}));
}
