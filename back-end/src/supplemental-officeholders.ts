import type {
	LocationDistrictMatch,
	LocationRepresentativeMatch,
	Source,
} from "./types/civic.js";

export interface SupplementalOfficeholderRecord {
	biographySummary: string;
	districtLabel: string;
	districtSlug: string;
	districtType: string;
	jurisdiction: "Local" | "State";
	location: string;
	name: string;
	officeSought: string;
	officeTitle: string;
	officialWebsiteUrl?: string;
	openstatesUrl?: string;
	party: string;
	provenanceLabel: string;
	provenanceNote: string;
	slug: string;
	sourceSystem: string;
	sources: Source[];
	stateCode: string;
	stateName: string;
	summary: string;
	updatedAt: string;
}

const reviewedAt = "2026-04-18T20:30:00.000Z";

function toLookupSlug(value: string) {
	return value
		.toLowerCase()
		.trim()
		.replace(/[\s_]+/g, "-")
		.replace(/[^a-z0-9-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

function uniqueById<T extends { id: string }>(items: T[]) {
	return Array.from(new Map(items.map(item => [item.id, item])).values());
}

function buildDistrictSlug(match: Pick<LocationDistrictMatch, "districtCode" | "districtType" | "label">) {
	const normalizedType = toLookupSlug(match.districtType);

	if (normalizedType.includes("congress"))
		return `congressional-${Number.parseInt(match.districtCode, 10)}`;

	if (normalizedType.includes("state-senate"))
		return `state-senate-${Number.parseInt(match.districtCode, 10)}`;

	if (normalizedType.includes("state-house") || normalizedType.includes("state-assembly"))
		return `state-house-${Number.parseInt(match.districtCode, 10)}`;

	return toLookupSlug(match.label);
}

const supplementalOfficeholders: SupplementalOfficeholderRecord[] = [
	{
		biographySummary: "Rep. Tyler Clancy is the current Utah House officeholder for District 60 in the reviewed statewide officeholder record Ballot Clarity keeps available when live provider lookup is rate-limited or otherwise unavailable.",
		districtLabel: "State House District 60",
		districtSlug: "state-house-60",
		districtType: "state-house",
		jurisdiction: "State",
		location: "Utah",
		name: "Tyler Clancy",
		officeSought: "State House District 60",
		officeTitle: "Representative",
		openstatesUrl: "https://openstates.org/person/tyler-clancy-3W6jbbmt1WAFbxzzxWeza9/",
		party: "Republican",
		provenanceLabel: "Reviewed Open States officeholder snapshot",
		provenanceNote: "This route is backed by a reviewed state officeholder record Ballot Clarity keeps available as a stable public snapshot when live provider lookups are unavailable or incomplete.",
		slug: "tyler-clancy",
		sourceSystem: "Open States officeholder snapshot",
		sources: [
			{
				authority: "nonprofit-provider",
				date: reviewedAt,
				id: "supplemental:tyler-clancy:openstates",
				note: "Reviewed state officeholder snapshot retained so this public route can stay provider-backed even when live Open States route lookup is unavailable.",
				publisher: "Open States",
				sourceSystem: "Open States officeholder snapshot",
				title: "Tyler Clancy current officeholder record",
				type: "official record",
				url: "https://openstates.org/person/tyler-clancy-3W6jbbmt1WAFbxzzxWeza9/",
			},
		],
		stateCode: "UT",
		stateName: "Utah",
		summary: "Tyler Clancy is the current Republican officeholder Ballot Clarity can attach to Utah House District 60 from a reviewed provider-backed state officeholder snapshot.",
		updatedAt: reviewedAt,
	},
	{
		biographySummary: "Sen. Keven Stratton is the current Utah Senate officeholder for District 24 in the reviewed statewide officeholder record Ballot Clarity keeps available when live provider lookup is rate-limited or otherwise unavailable.",
		districtLabel: "State Senate District 24",
		districtSlug: "state-senate-24",
		districtType: "state-senate",
		jurisdiction: "State",
		location: "Utah",
		name: "Keven Stratton",
		officeSought: "State Senate District 24",
		officeTitle: "Senator",
		openstatesUrl: "https://openstates.org/person/keven-stratton/",
		party: "Republican",
		provenanceLabel: "Reviewed Open States officeholder snapshot",
		provenanceNote: "This route is backed by a reviewed state officeholder record Ballot Clarity keeps available as a stable public snapshot when live provider lookups are unavailable or incomplete.",
		slug: "keven-stratton",
		sourceSystem: "Open States officeholder snapshot",
		sources: [
			{
				authority: "nonprofit-provider",
				date: reviewedAt,
				id: "supplemental:keven-stratton:openstates",
				note: "Reviewed state officeholder snapshot retained so this public route can stay provider-backed even when live Open States route lookup is unavailable.",
				publisher: "Open States",
				sourceSystem: "Open States officeholder snapshot",
				title: "Keven Stratton current officeholder record",
				type: "official record",
				url: "https://openstates.org/person/keven-stratton/",
			},
		],
		stateCode: "UT",
		stateName: "Utah",
		summary: "Keven Stratton is the current Republican officeholder Ballot Clarity can attach to Utah Senate District 24 from a reviewed provider-backed state officeholder snapshot.",
		updatedAt: reviewedAt,
	},
	{
		biographySummary: "Sen. Shawn Still serves Georgia Senate District 48, which the Georgia General Assembly bio identifies as covering portions of Fulton, Forsyth, and Gwinnett counties.",
		districtLabel: "State Senate District 48",
		districtSlug: "state-senate-48",
		districtType: "state-senate",
		jurisdiction: "State",
		location: "Georgia",
		name: "Shawn Still",
		officeSought: "State Senate District 48",
		officeTitle: "Senator",
		party: "Republican",
		provenanceLabel: "Georgia General Assembly member bio",
		provenanceNote: "This route is backed by a reviewed Georgia General Assembly member bio retained as a stable public state-officeholder record.",
		slug: "shawn-still",
		sourceSystem: "Georgia General Assembly member bio",
		sources: [
			{
				authority: "official-government",
				date: reviewedAt,
				id: "supplemental:shawn-still:bio",
				note: "Reviewed Georgia Senate member bio retained so this public route can stay source-backed even when live provider lookup is unavailable.",
				publisher: "Georgia General Assembly",
				sourceSystem: "Georgia General Assembly member bio",
				title: "Senator Shawn Still bio",
				type: "official record",
				url: "https://www.legis.ga.gov/api/document/docs/default-source/bios/still-shawn-5016.pdf",
			},
		],
		stateCode: "GA",
		stateName: "Georgia",
		summary: "Shawn Still is the current Republican officeholder Ballot Clarity can attach to Georgia Senate District 48 from a reviewed official state-legislature member bio.",
		updatedAt: reviewedAt,
	},
	{
		biographySummary: "Rep. Scott Hilton serves Georgia House District 48 in the reviewed Georgia House member bio Ballot Clarity keeps available as a stable public state-officeholder record.",
		districtLabel: "State House District 48",
		districtSlug: "state-house-48",
		districtType: "state-house",
		jurisdiction: "State",
		location: "Georgia",
		name: "Scott Hilton",
		officeSought: "State House District 48",
		officeTitle: "Representative",
		party: "Republican",
		provenanceLabel: "Georgia House member bio",
		provenanceNote: "This route is backed by a reviewed Georgia House member bio retained as a stable public state-officeholder record.",
		slug: "scott-hilton",
		sourceSystem: "Georgia House member bio",
		sources: [
			{
				authority: "official-government",
				date: reviewedAt,
				id: "supplemental:scott-hilton:bio",
				note: "Reviewed Georgia House member bio retained so this public route can stay source-backed even when live provider lookup is unavailable.",
				publisher: "Georgia General Assembly",
				sourceSystem: "Georgia House member bio",
				title: "Rep. Scott Hilton bio",
				type: "official record",
				url: "https://www.legis.ga.gov/api/document/docs/default-source/bios/hilton-scott-4899.pdf",
			},
		],
		stateCode: "GA",
		stateName: "Georgia",
		summary: "Scott Hilton is the current Republican officeholder Ballot Clarity can attach to Georgia House District 48 from a reviewed official state-legislature member bio.",
		updatedAt: reviewedAt,
	},
	{
		biographySummary: "Robb Pitts is the Chairman of the Fulton County Board of Commissioners in the official county commissioner directory reviewed for Ballot Clarity's local officeholder layer.",
		districtLabel: "Fulton County",
		districtSlug: "fulton-county",
		districtType: "county",
		jurisdiction: "Local",
		location: "Fulton County, Georgia",
		name: "Robb Pitts",
		officeSought: "County Commission Chair",
		officeTitle: "County Commission Chair",
		officialWebsiteUrl: "https://www.fultoncountyga.gov/commissioners",
		party: "Nonpartisan",
		provenanceLabel: "Official county commissioner directory",
		provenanceNote: "This route is backed by the official county commissioner directory rather than a generalized provider snapshot.",
		slug: "robb-pitts",
		sourceSystem: "Official county commissioner directory",
		sources: [
			{
				authority: "official-government",
				date: reviewedAt,
				id: "supplemental:robb-pitts:fulton",
				note: "Official Fulton County Board of Commissioners page reviewed for the current county chair record.",
				publisher: "Fulton County Government",
				sourceSystem: "Fulton County Board of Commissioners",
				title: "Robb Pitts commissioner profile",
				type: "official record",
				url: "https://www.fultoncountyga.gov/commissioners",
			},
		],
		stateCode: "GA",
		stateName: "Georgia",
		summary: "Robb Pitts is the current Fulton County Board of Commissioners chair Ballot Clarity can attach from the official county government directory.",
		updatedAt: reviewedAt,
	},
	{
		biographySummary: "Mayor John Bradberry is the current Johns Creek mayor in the official city mayor page reviewed for Ballot Clarity's local officeholder layer.",
		districtLabel: "Johns Creek city",
		districtSlug: "johns-creek-city",
		districtType: "city",
		jurisdiction: "Local",
		location: "Johns Creek, Georgia",
		name: "John Bradberry",
		officeSought: "Mayor",
		officeTitle: "Mayor",
		officialWebsiteUrl: "https://johnscreekga.gov/government/city-council/mayor-john-bradberry/",
		party: "Nonpartisan",
		provenanceLabel: "Official city mayor page",
		provenanceNote: "This route is backed by the official mayor page Ballot Clarity reviewed for the current city officeholder record.",
		slug: "john-bradberry",
		sourceSystem: "Official city mayor page",
		sources: [
			{
				authority: "official-government",
				date: reviewedAt,
				id: "supplemental:john-bradberry:johns-creek",
				note: "Official Johns Creek mayor page reviewed for the current city officeholder record.",
				publisher: "City of Johns Creek",
				sourceSystem: "Johns Creek mayor page",
				title: "Mayor John Bradberry",
				type: "official record",
				url: "https://johnscreekga.gov/government/city-council/mayor-john-bradberry/",
			},
		],
		stateCode: "GA",
		stateName: "Georgia",
		summary: "John Bradberry is the current Johns Creek mayor Ballot Clarity can attach from the official city government page.",
		updatedAt: reviewedAt,
	},
	{
		biographySummary: "Skyler Beltran is the current Utah County Commission Chair in the official county commission page reviewed for Ballot Clarity's local officeholder layer.",
		districtLabel: "Utah County",
		districtSlug: "utah-county",
		districtType: "county",
		jurisdiction: "Local",
		location: "Utah County, Utah",
		name: "Skyler Beltran",
		officeSought: "County Commission Chair",
		officeTitle: "County Commission Chair",
		officialWebsiteUrl: "https://commission.utahcounty.gov/",
		party: "Nonpartisan",
		provenanceLabel: "Official county commission page",
		provenanceNote: "This route is backed by the official county commission page Ballot Clarity reviewed for the current county chair record.",
		slug: "skyler-beltran",
		sourceSystem: "Official county commission page",
		sources: [
			{
				authority: "official-government",
				date: reviewedAt,
				id: "supplemental:skyler-beltran:utah-county",
				note: "Official Utah County commission page reviewed for the current county commission chair record.",
				publisher: "Utah County Government",
				sourceSystem: "Utah County Commission",
				title: "Skyler Beltran commission profile",
				type: "official record",
				url: "https://commission.utahcounty.gov/",
			},
		],
		stateCode: "UT",
		stateName: "Utah",
		summary: "Skyler Beltran is the current Utah County Commission chair Ballot Clarity can attach from the official county government page.",
		updatedAt: reviewedAt,
	},
	{
		biographySummary: "Mayor Marsha Judkins is the current Provo mayor in the official mayor's office page reviewed for Ballot Clarity's local officeholder layer.",
		districtLabel: "Provo city",
		districtSlug: "provo-city",
		districtType: "city",
		jurisdiction: "Local",
		location: "Provo, Utah",
		name: "Marsha Judkins",
		officeSought: "Mayor",
		officeTitle: "Mayor",
		officialWebsiteUrl: "https://www.provo.gov/433/Mayors-Office",
		party: "Nonpartisan",
		provenanceLabel: "Official mayor's office page",
		provenanceNote: "This route is backed by the official mayor's office page Ballot Clarity reviewed for the current city officeholder record.",
		slug: "marsha-judkins",
		sourceSystem: "Official mayor's office page",
		sources: [
			{
				authority: "official-government",
				date: reviewedAt,
				id: "supplemental:marsha-judkins:provo",
				note: "Official Provo mayor's office page reviewed for the current city officeholder record.",
				publisher: "City of Provo",
				sourceSystem: "Provo mayor's office",
				title: "Mayor Marsha Judkins",
				type: "official record",
				url: "https://www.provo.gov/433/Mayors-Office",
			},
		],
		stateCode: "UT",
		stateName: "Utah",
		summary: "Marsha Judkins is the current Provo mayor Ballot Clarity can attach from the official city government page.",
		updatedAt: reviewedAt,
	},
];

export function buildSupplementalRepresentativeMatch(record: SupplementalOfficeholderRecord): LocationRepresentativeMatch {
	return {
		districtLabel: record.districtLabel,
		id: `supplemental:${record.slug}`,
		name: record.name,
		officeTitle: record.officeTitle,
		openstatesUrl: record.openstatesUrl,
		party: record.party,
		sourceSystem: record.sourceSystem,
	};
}

export function findSupplementalOfficeholderByRepresentativeSlug(slug: string) {
	const normalizedSlug = toLookupSlug(slug);
	return supplementalOfficeholders.find(record => record.slug === normalizedSlug) ?? null;
}

export function findSupplementalOfficeholdersByDistrictSlug(slug: string) {
	const normalizedSlug = toLookupSlug(slug);
	return supplementalOfficeholders.filter(record => record.districtSlug === normalizedSlug);
}

export function listSupplementalOfficeholdersForDistrictMatches(districtMatches: LocationDistrictMatch[]) {
	const districtSlugs = new Set(districtMatches.map(buildDistrictSlug));
	return supplementalOfficeholders.filter(record => districtSlugs.has(record.districtSlug));
}

export function mergeRepresentativeMatchesWithSupplementalRecords(
	representativeMatches: LocationRepresentativeMatch[],
	districtMatches: LocationDistrictMatch[],
) {
	const supplementalMatches = listSupplementalOfficeholdersForDistrictMatches(districtMatches)
		.map(buildSupplementalRepresentativeMatch);

	return uniqueById([
		...representativeMatches,
		...supplementalMatches.filter((supplementalMatch) => {
			const normalizedSlug = toLookupSlug(supplementalMatch.name);
			return !representativeMatches.some(match => toLookupSlug(match.name) === normalizedSlug);
		}),
	]);
}

export function listSupplementalOfficeholders() {
	return [...supplementalOfficeholders];
}
