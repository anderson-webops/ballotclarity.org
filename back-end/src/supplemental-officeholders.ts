import type {
	EvidenceBlock,
	FundingLineItem,
	IssueTag,
	LocationDistrictMatch,
	LocationRepresentativeMatch,
	PersonProfileFunding,
	PersonProfileInfluence,
	PersonProfileOfficeContext,
	ProfileImage,
	Source,
	VoteRecordSummary,
} from "./types/civic.js";
import { classifyRepresentative } from "./representative-classification.js";

export interface SupplementalOfficeholderEnrichment {
	funding?: PersonProfileFunding | null;
	influence?: PersonProfileInfluence | null;
	keyActions?: VoteRecordSummary[];
	lobbyingContext?: EvidenceBlock[];
	methodologyNotes?: string[];
	officeContext?: PersonProfileOfficeContext;
	publicStatements?: EvidenceBlock[];
	topIssues?: IssueTag[];
}

export interface SupplementalOfficeholderRecord {
	biographySummary: string;
	districtLabel: string;
	districtSlug: string;
	districtType: string;
	enrichment?: SupplementalOfficeholderEnrichment;
	jurisdiction: "Local" | "State";
	location: string;
	name: string;
	officeSought: string;
	officeTitle: string;
	officialWebsiteUrl?: string;
	openstatesUrl?: string;
	party: string;
	profileImages?: ProfileImage[];
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
const shawnStillAbsenteeismReportDate = "2025-11-20T16:10:43.000-05:00";
const shawnStillAiReportDate = "2025-12-10T08:37:39.000-05:00";
const shawnStillCommitteeListDate = "2025-02-26T12:26:14.000-05:00";
const shawnStillOfficeAssignmentsDate = "2025-12-16T13:52:29.000-05:00";
const scottHiltonHouseDirectoryDate = "2026-03-27T15:55:33.000-04:00";
const scottHiltonHb376Date = "2025-03-03T23:59:49.000-05:00";
const scottHiltonHb340Date = "2025-03-04T21:47:50.000-05:00";
const scottHiltonEndOfSessionDate = "2025-05-15T11:19:27.000-04:00";
const scottHiltonLobbyistReportDate = "2017-03-02T16:21:00.000-05:00";
const robbPittsHiringDate = "2025-03-05T00:00:00.000Z";
const robbPittsRenewDistrictDate = "2026-03-02T00:00:00.000Z";
const johnBradberryMedleyDate = "2025-01-17T00:00:00.000Z";
const johnBradberryRoadDate = "2025-03-11T00:00:00.000Z";
const johnBradberryBioReadyDate = "2023-11-01T00:00:00.000Z";
const marshaJudkinsElectionResultsDate = "2025-11-18T00:00:00.000Z";
const marshaJudkinsFinanceDate = "2025-12-04T00:00:00.000Z";
const marshaJudkinsTransparencyDate = "2026-02-03T00:00:00.000Z";
const shawnStillPortraitUrl = "https://www.legis.ga.gov/api/images/default-source/portraits/still-shawn-5016.jpg";
const scottHiltonPortraitUrl = "https://www.legis.ga.gov/api/images/default-source/portraits/hilton-scott-4899.jpg";

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

function buildIssue(slug: string, label: string): IssueTag {
	return { label, slug };
}

function buildAction(
	id: string,
	title: string,
	date: string,
	summary: string,
	significance: string,
	sources: Source[],
): VoteRecordSummary {
	return {
		date,
		id,
		significance,
		sources,
		summary,
		title,
	};
}

function buildEvidence(id: string, title: string, summary: string, sources: Source[]): EvidenceBlock {
	return {
		id,
		sources,
		summary,
		title,
	};
}

function buildExternalLink(label: string, url: string, note: string) {
	return {
		label,
		note,
		url,
	};
}

function buildFundingLineItem(name: string, amount: number, category: string): FundingLineItem {
	return {
		amount,
		category,
		name,
	};
}

const tylerClancyOpenStatesSource: Source = {
	authority: "nonprofit-provider",
	date: reviewedAt,
	id: "supplemental:tyler-clancy:openstates",
	note: "Reviewed state officeholder snapshot retained so this public route can stay available even when live Open States route lookup is unavailable.",
	publisher: "Open States",
	sourceSystem: "Open States officeholder snapshot",
	title: "Tyler Clancy current officeholder record",
	type: "official record",
	url: "https://openstates.org/person/tyler-clancy-3W6jbbmt1WAFbxzzxWeza9/",
};

const kevenStrattonOpenStatesSource: Source = {
	authority: "nonprofit-provider",
	date: reviewedAt,
	id: "supplemental:keven-stratton:openstates",
	note: "Reviewed state officeholder snapshot retained so this public route can stay available even when live Open States route lookup is unavailable.",
	publisher: "Open States",
	sourceSystem: "Open States officeholder snapshot",
	title: "Keven Stratton current officeholder record",
	type: "official record",
	url: "https://openstates.org/person/keven-stratton/",
};

const shawnStillBioSource: Source = {
	authority: "official-government",
	date: reviewedAt,
	id: "supplemental:shawn-still:bio",
	note: "Reviewed Georgia Senate member bio retained so this public route can stay source-backed even when live provider lookup is unavailable.",
	publisher: "Georgia General Assembly",
	sourceSystem: "Georgia General Assembly member bio",
	title: "Senator Shawn Still bio",
	type: "official record",
	url: "https://www.legis.ga.gov/api/document/docs/default-source/bios/still-shawn-5016.pdf",
};

const shawnStillOfficeAssignmentsSource: Source = {
	authority: "official-government",
	date: shawnStillOfficeAssignmentsDate,
	id: "supplemental:shawn-still:office-assignments",
	note: "Current Georgia Senate office assignments document reviewed for Still's district office location and phone.",
	publisher: "Georgia General Assembly",
	sourceSystem: "Georgia Senate office assignments",
	title: "2025-2026 Georgia Senate office assignments",
	type: "official record",
	url: "https://www.legis.ga.gov/api/document/docs/default-source/secretary-of-the-senate-document-library/2025-senate-office-assignments.pdf?sfvrsn=fc17cede_8",
};

const shawnStillCommitteeSource: Source = {
	authority: "official-government",
	date: shawnStillCommitteeListDate,
	id: "supplemental:shawn-still:committee-list",
	note: "Current Georgia Senate committee list reviewed for committee membership context on this route.",
	publisher: "Georgia General Assembly",
	sourceSystem: "Georgia Senate committee list",
	title: "2025 Georgia Senate committee list",
	type: "official record",
	url: "https://www.legis.ga.gov/api/document/docs/default-source/secretary-of-the-senate-document-library/2025-committee-long-list.pdf?sfvrsn=6ae05da0_4",
};

const shawnStillAiReportSource: Source = {
	authority: "official-government",
	date: shawnStillAiReportDate,
	id: "supplemental:shawn-still:ai-study",
	note: "Official Georgia Senate study-committee report reviewed for Still's co-chair role and recommendations around child online safety and platform privacy.",
	publisher: "Georgia General Assembly",
	sourceSystem: "Georgia Senate study committee report",
	title: "Final report of the Senate Impact of Social Media and Artificial Intelligence on Children and Platform Privacy Protection Study Committee",
	type: "policy memo",
	url: "https://www.legis.ga.gov/api/document/docs/default-source/senate-study-committees-document-library/2025-sr-431-ai-social-media-final-report.pdf?sfvrsn=3c14bc19_2",
};

const shawnStillAbsenteeismSource: Source = {
	authority: "official-government",
	date: shawnStillAbsenteeismReportDate,
	id: "supplemental:shawn-still:absenteeism-study",
	note: "Official Georgia Senate study-committee report reviewed for Still's legislative-action context on chronic absenteeism in schools.",
	publisher: "Georgia General Assembly",
	sourceSystem: "Georgia Senate study committee report",
	title: "Final report of the Senate Study Committee on Combatting Chronic Absenteeism in Schools",
	type: "policy memo",
	url: "https://www.legis.ga.gov/api/document/docs/default-source/senate-study-committees-document-library/2025-sr-217-absenteeism-final-report.pdf?sfvrsn=807f1dd6_2",
};

const scottHiltonBioSource: Source = {
	authority: "official-government",
	date: reviewedAt,
	id: "supplemental:scott-hilton:bio",
	note: "Reviewed Georgia House member bio retained so this public route can stay source-backed even when live provider lookup is unavailable.",
	publisher: "Georgia General Assembly",
	sourceSystem: "Georgia House member bio",
	title: "Rep. Scott Hilton bio",
	type: "official record",
	url: "https://www.legis.ga.gov/api/document/docs/default-source/bios/hilton-scott-4899.pdf",
};

const scottHiltonDirectorySource: Source = {
	authority: "official-government",
	date: scottHiltonHouseDirectoryDate,
	id: "supplemental:scott-hilton:house-directory",
	note: "Current Georgia House member directory reviewed for Hilton's office location, phone, email, and committee assignments.",
	publisher: "Georgia General Assembly",
	sourceSystem: "Georgia House member directory",
	title: "2026 Georgia House member directory",
	type: "official record",
	url: "https://www.legis.ga.gov/api/document/docs/default-source/house-document-library/house-member-directory.pdf?sfvrsn=1f476975_106",
};

const scottHiltonHb340Source: Source = {
	authority: "official-government",
	date: scottHiltonHb340Date,
	id: "supplemental:scott-hilton:hb340",
	note: "Georgia House daily report reviewed for Hilton's authorship and floor movement on the Distraction-Free Education Act.",
	publisher: "Georgia General Assembly",
	sourceSystem: "Georgia House daily report",
	title: "HB 340 Distraction-Free Education Act daily report entry",
	type: "official record",
	url: "https://www.legis.ga.gov/api/document/docs/default-source/house-budget-and-research-office-document-library/daily-report-2025/ld27_tues_mar_4_2025.pdf?sfvrsn=7a94066e_2",
};

const scottHiltonHb376Source: Source = {
	authority: "official-government",
	date: scottHiltonHb376Date,
	id: "supplemental:scott-hilton:hb376",
	note: "Georgia House daily report reviewed for Hilton's tax-credit legislation and committee action.",
	publisher: "Georgia General Assembly",
	sourceSystem: "Georgia House daily report",
	title: "HB 376 historic-structure tax credit daily report entry",
	type: "official record",
	url: "https://www.legis.ga.gov/api/document/docs/default-source/house-budget-and-research-office-document-library/daily-report-2025/ld26_mon_mar_3_2025.pdf?sfvrsn=574bd02_2",
};

const scottHiltonEndOfSessionSource: Source = {
	authority: "official-government",
	date: scottHiltonEndOfSessionDate,
	id: "supplemental:scott-hilton:end-of-session",
	note: "Official Georgia House end-of-session report reviewed for final public summary language on Hilton's enacted education bill.",
	publisher: "Georgia General Assembly",
	sourceSystem: "Georgia House end-of-session report",
	title: "2025 Georgia House end-of-session report",
	type: "official record",
	url: "https://www.legis.ga.gov/api/document/docs/default-source/house-budget-and-research-office-document-library/session-reports/2025_end_of_session_report_by_committee-with-vetoes.pdf?sfvrsn=8fe305e6_2",
};

const scottHiltonLobbyingSource: Source = {
	authority: "official-government",
	date: scottHiltonLobbyistReportDate,
	id: "supplemental:scott-hilton:lobbyist-report",
	note: "Georgia Government Transparency and Campaign Finance Commission lobbyist expenditure report reviewed for Hilton's state disclosure context.",
	publisher: "Georgia Government Transparency and Campaign Finance Commission",
	sourceSystem: "Georgia lobbyist expenditure report",
	title: "Kevin F. Curtin lobbyist expenditure report naming Scott Hilton",
	type: "ethics filing",
	url: "https://media.ethics.ga.gov/search/Lobbyist/radWin.aspx?pdfID=L20050502205305&rwndrnd=0.24873096914961934",
};

const robbPittsProfileSource: Source = {
	authority: "official-government",
	date: reviewedAt,
	id: "supplemental:robb-pitts:fulton",
	note: "Official Fulton County Board of Commissioners page reviewed for the current county chair record.",
	publisher: "Fulton County Government",
	sourceSystem: "Fulton County Board of Commissioners",
	title: "Robb Pitts commissioner profile",
	type: "official record",
	url: "https://www.fultoncountyga.gov/commissioners/robb-pitts",
};

const robbPittsRenewDistrictSource: Source = {
	authority: "official-government",
	date: robbPittsRenewDistrictDate,
	id: "supplemental:robb-pitts:renew-district",
	note: "Official Fulton County news release reviewed for Pitts' Renew the District redevelopment milestone and public statements about economic revitalization.",
	publisher: "Fulton County Government",
	sourceSystem: "Fulton County news release",
	title: "Fulton County celebrates major Renew the District milestone",
	type: "official record",
	url: "https://fultoncountyga.gov/News/2026/03/02/Fulton-County-Celebrates-Major-Renew-the-District-Milestone",
};

const robbPittsHiringSource: Source = {
	authority: "official-government",
	date: robbPittsHiringDate,
	id: "supplemental:robb-pitts:hiring-priority",
	note: "Official Fulton County news release reviewed for Pitts' employment and workforce action after federal layoffs.",
	publisher: "Fulton County Government",
	sourceSystem: "Fulton County news release",
	title: "Chairman Pitts urges employers to hire displaced federal workers",
	type: "official record",
	url: "https://fultoncountyga.gov/news/2025/03/05/chairman-pitts-urges-public-and-private-employers-to-hire-doge-displaced-federal-workers",
};

const johnBradberryProfileSource: Source = {
	authority: "official-government",
	date: reviewedAt,
	id: "supplemental:john-bradberry:johns-creek",
	note: "Official Johns Creek mayor page reviewed for the current city officeholder record.",
	publisher: "City of Johns Creek",
	sourceSystem: "Johns Creek mayor page",
	title: "Mayor John Bradberry",
	type: "official record",
	url: "https://johnscreekga.gov/government/city-council/mayor-john-bradberry/",
};

const johnBradberryMedleySource: Source = {
	authority: "official-government",
	date: johnBradberryMedleyDate,
	id: "supplemental:john-bradberry:medley",
	note: "Official Johns Creek news release reviewed for Bradberry's town-center redevelopment context.",
	publisher: "City of Johns Creek",
	sourceSystem: "Johns Creek news release",
	title: "Medley breaks ground in the Johns Creek Town Center",
	type: "official record",
	url: "https://johnscreekga.gov/news/2025/01/medley-breaks-ground-in-the-johns-creek-town-center/",
};

const johnBradberryRoadSource: Source = {
	authority: "official-government",
	date: johnBradberryRoadDate,
	id: "supplemental:john-bradberry:mcginnis-ferry",
	note: "Official Johns Creek news release reviewed for Bradberry's transportation-infrastructure context.",
	publisher: "City of Johns Creek",
	sourceSystem: "Johns Creek news release",
	title: "Groundbreaking ceremony held for McGinnis Ferry Road widening project",
	type: "official record",
	url: "https://johnscreekga.gov/news/2025/03/groundbreaking-ceremony-held-for-mcginnis-ferry-road-widening-project/",
};

const johnBradberryBioReadySource: Source = {
	authority: "official-government",
	date: johnBradberryBioReadyDate,
	id: "supplemental:john-bradberry:bioready",
	note: "Official Johns Creek news release reviewed for Bradberry's public statement on life-sciences and innovation strategy.",
	publisher: "City of Johns Creek",
	sourceSystem: "Johns Creek news release",
	title: "Johns Creek designated as Georgia's first BioReady community",
	type: "official record",
	url: "https://johnscreekga.gov/news/2023/11/johns-creek-designated-as-georgias-first-ever-bioready-community/",
};

const skylerBeltranSource: Source = {
	authority: "official-government",
	date: reviewedAt,
	id: "supplemental:skyler-beltran:utah-county",
	note: "Official Utah County commission page reviewed for the current county commission chair record.",
	publisher: "Utah County Government",
	sourceSystem: "Utah County Commission",
	title: "Skyler Beltran commission profile",
	type: "official record",
	url: "https://commission.utahcounty.gov/",
};

const marshaJudkinsMayorSource: Source = {
	authority: "official-government",
	date: reviewedAt,
	id: "supplemental:marsha-judkins:provo",
	note: "Official Provo mayor's office page reviewed for the current city officeholder record.",
	publisher: "City of Provo",
	sourceSystem: "Provo mayor's office",
	title: "Mayor Marsha Judkins",
	type: "official record",
	url: "https://www.provo.gov/433/Mayors-Office",
};

const marshaJudkinsTransparencySource: Source = {
	authority: "official-government",
	date: marshaJudkinsTransparencyDate,
	id: "supplemental:marsha-judkins:transparency-portal",
	note: "Official Provo transparency portal launch article reviewed for Judkins' transparency and public-information context.",
	publisher: "City of Provo",
	sourceSystem: "Provo transparency portal launch",
	title: "City launches new Transparency Portal to make public information easier to find",
	type: "official record",
	url: "https://www.provo.gov/CivicAlerts.aspx?AID=224",
};

const marshaJudkinsElectionSource: Source = {
	authority: "official-government",
	date: marshaJudkinsElectionResultsDate,
	id: "supplemental:marsha-judkins:election-results",
	note: "Official Provo election results page reviewed for the certified 2025 mayoral result and current term start.",
	publisher: "City of Provo",
	sourceSystem: "Provo election results",
	title: "2025 Provo election results",
	type: "official record",
	url: "https://www.provo.gov/861/2025-Election-Results",
};

const marshaJudkinsFinanceSource: Source = {
	authority: "official-government",
	date: marshaJudkinsFinanceDate,
	id: "supplemental:marsha-judkins:campaign-finance",
	note: "Official Provo campaign finance disclosure form reviewed for Judkins' 2025 mayoral fundraising and spending totals.",
	publisher: "City of Provo",
	sourceSystem: "Provo campaign finance disclosure form",
	title: "Marsha Judkins campaign finance disclosure form",
	type: "campaign filing",
	url: "https://www.provo.gov/DocumentCenter/View/5990/Marsha-Judkins-PDF?bidId=",
};

const supplementalOfficeholders: SupplementalOfficeholderRecord[] = [
	{
		biographySummary: "Rep. Tyler Clancy is the current Utah House officeholder for District 60 in the reviewed statewide officeholder record Ballot Clarity keeps available when live provider lookup is rate-limited or otherwise unavailable.",
		districtLabel: "State House District 60",
		districtSlug: "state-house-60",
		districtType: "state-house",
		enrichment: {
			methodologyNotes: [
				"Ballot Clarity is still relying on a reviewed Open States officeholder snapshot for this route, so legislative-action, finance, and disclosure depth remains limited until a reviewed Utah-specific source is attached.",
			],
			officeContext: {
				chamberLabel: "State House",
				districtLabel: "State House District 60",
				jurisdictionLabel: "Utah",
				referenceLinks: [
					buildExternalLink("Open States officeholder record", tylerClancyOpenStatesSource.url, "Provider-backed public officeholder record retained for route stability."),
				],
			},
		},
		jurisdiction: "State",
		location: "Utah",
		name: "Tyler Clancy",
		officeSought: "State House District 60",
		officeTitle: "Representative",
		openstatesUrl: "https://openstates.org/person/tyler-clancy-3W6jbbmt1WAFbxzzxWeza9/",
		party: "Republican",
		provenanceLabel: "Reviewed Open States officeholder snapshot",
		provenanceNote: "This page uses a reviewed state officeholder record Ballot Clarity keeps available as a stable public snapshot when live Open States lookups are unavailable or incomplete.",
		slug: "tyler-clancy",
		sourceSystem: "Open States officeholder snapshot",
		sources: [tylerClancyOpenStatesSource],
		stateCode: "UT",
		stateName: "Utah",
		summary: "Tyler Clancy is the current Republican officeholder for Utah House District 60 in a reviewed Open States officeholder snapshot.",
		updatedAt: reviewedAt,
	},
	{
		biographySummary: "Sen. Keven Stratton is the current Utah Senate officeholder for District 24 in the reviewed statewide officeholder record Ballot Clarity keeps available when live provider lookup is rate-limited or otherwise unavailable.",
		districtLabel: "State Senate District 24",
		districtSlug: "state-senate-24",
		districtType: "state-senate",
		enrichment: {
			methodologyNotes: [
				"Ballot Clarity is still relying on a reviewed Open States officeholder snapshot for this route, so legislative-action, finance, and disclosure depth remains limited until a reviewed Utah-specific source is attached.",
			],
			officeContext: {
				chamberLabel: "State Senate",
				districtLabel: "State Senate District 24",
				jurisdictionLabel: "Utah",
				referenceLinks: [
					buildExternalLink("Open States officeholder record", kevenStrattonOpenStatesSource.url, "Provider-backed public officeholder record retained for route stability."),
				],
			},
		},
		jurisdiction: "State",
		location: "Utah",
		name: "Keven Stratton",
		officeSought: "State Senate District 24",
		officeTitle: "Senator",
		openstatesUrl: "https://openstates.org/person/keven-stratton/",
		party: "Republican",
		provenanceLabel: "Reviewed Open States officeholder snapshot",
		provenanceNote: "This page uses a reviewed state officeholder record Ballot Clarity keeps available as a stable public snapshot when live Open States lookups are unavailable or incomplete.",
		slug: "keven-stratton",
		sourceSystem: "Open States officeholder snapshot",
		sources: [kevenStrattonOpenStatesSource],
		stateCode: "UT",
		stateName: "Utah",
		summary: "Keven Stratton is the current Republican officeholder for Utah Senate District 24 in a reviewed Open States officeholder snapshot.",
		updatedAt: reviewedAt,
	},
	{
		biographySummary: "Sen. Shawn Still serves Georgia Senate District 48, which the Georgia General Assembly bio identifies as covering portions of Fulton, Forsyth, and Gwinnett counties.",
		districtLabel: "State Senate District 48",
		districtSlug: "state-senate-48",
		districtType: "state-senate",
		enrichment: {
			keyActions: [
				buildAction(
					"supplemental:shawn-still:action:ai-study",
					"Co-chaired Senate study on child online safety and AI privacy",
					shawnStillAiReportDate,
					"An official Georgia Senate study-committee report lists Shawn Still as co-chair of the committee that reviewed social media, artificial intelligence, child privacy protections, and recommendations for safer platform access.",
					"Reviewed Georgia Senate study-committee report shows Still carrying legislative-action context on child online safety and platform privacy.",
					[shawnStillAiReportSource],
				),
				buildAction(
					"supplemental:shawn-still:action:absenteeism-study",
					"Served on Senate absenteeism study committee",
					shawnStillAbsenteeismReportDate,
					"An official Georgia Senate study-committee report lists Shawn Still as a member of the committee on combatting chronic absenteeism in schools, attaching education and attendance-policy context to this route.",
					"Reviewed Georgia Senate report attaches school-attendance policy work to Still's public person page.",
					[shawnStillAbsenteeismSource],
				),
			],
			methodologyNotes: [
				"Georgia Senate office assignments, committee lists, and study-committee reports are attached on this route when Ballot Clarity has reviewed them as stable official state-legislative sources.",
			],
			officeContext: {
				chamberLabel: "State Senate",
				committeeMemberships: [
					"Interstate Cooperation (ex officio)",
					"Judiciary",
				],
				currentTermLabel: "2025-2026 Georgia General Assembly",
				currentTermStartLabel: "2025",
				currentTermEndLabel: "2026",
				districtLabel: "State Senate District 48",
				jurisdictionLabel: "Georgia",
				officialOfficeAddress: "421-D CAP, Atlanta, GA 30334",
				officialPhone: "(404) 656-7127",
				referenceLinks: [
					buildExternalLink("Georgia Senate member bio", shawnStillBioSource.url, "Official Georgia General Assembly biography retained for this public route."),
					buildExternalLink("Georgia Senate office assignments", shawnStillOfficeAssignmentsSource.url, "Current office location and phone for the Georgia Senate member route."),
					buildExternalLink("Georgia Senate committee list", shawnStillCommitteeSource.url, "Current committee membership list for the Georgia Senate."),
					buildExternalLink("AI and child online safety study report", shawnStillAiReportSource.url, "Official study-committee report listing Shawn Still as co-chair."),
					buildExternalLink("Absenteeism study report", shawnStillAbsenteeismSource.url, "Official study-committee report listing Shawn Still as a member."),
				],
			},
			topIssues: [
				buildIssue("child-online-safety-ai", "Child online safety and AI privacy"),
				buildIssue("school-attendance", "School attendance and absenteeism"),
				buildIssue("judiciary-interstate", "Judiciary and interstate policy"),
			],
		},
		jurisdiction: "State",
		location: "Georgia",
		name: "Shawn Still",
		officeSought: "State Senate District 48",
		officeTitle: "Senator",
		party: "Republican",
		profileImages: [
			{
				alt: "Portrait of Shawn Still",
				capturedAt: reviewedAt,
				priority: 10,
				sourceKind: "official",
				sourceLabel: "Georgia General Assembly portrait",
				sourceSystem: "Georgia General Assembly",
				sourceUrl: shawnStillBioSource.url,
				url: shawnStillPortraitUrl,
			},
		],
		provenanceLabel: "Georgia General Assembly member bio",
		provenanceNote: "This route is backed by a reviewed Georgia General Assembly member bio retained as a stable public state-officeholder record.",
		slug: "shawn-still",
		sourceSystem: "Georgia General Assembly member bio",
		sources: [
			shawnStillBioSource,
			shawnStillOfficeAssignmentsSource,
			shawnStillCommitteeSource,
			shawnStillAiReportSource,
			shawnStillAbsenteeismSource,
		],
		stateCode: "GA",
		stateName: "Georgia",
		summary: "Shawn Still is the current Republican officeholder Ballot Clarity can attach to Georgia Senate District 48 from reviewed official Georgia Senate records, office assignments, and legislative reports.",
		updatedAt: reviewedAt,
	},
	{
		biographySummary: "Rep. Scott Hilton serves Georgia House District 48 in the reviewed Georgia House member bio Ballot Clarity keeps available as a stable public state-officeholder record.",
		districtLabel: "State House District 48",
		districtSlug: "state-house-48",
		districtType: "state-house",
		enrichment: {
			influence: {
				contributionCount: 1,
				coverageLabel: "Reviewed 2017 Georgia lobbyist expenditure reports",
				filingYear: 2017,
				reportCount: 1,
				topRegistrants: [
					{
						amount: 7.52,
						name: "AT&T",
					},
				],
				totalMatched: 7.52,
			},
			keyActions: [
				buildAction(
					"supplemental:scott-hilton:action:hb340",
					"Advanced the Distraction-Free Education Act",
					scottHiltonHb340Date,
					"Georgia House daily reporting shows Scott Hilton as the author of HB 340, the Distraction-Free Education Act, which advanced with Education Committee action and a House floor vote in 2025.",
					"Official Georgia House legislative reporting attaches current education-policy action to Hilton's public route.",
					[scottHiltonHb340Source, scottHiltonEndOfSessionSource],
				),
				buildAction(
					"supplemental:scott-hilton:action:hb376",
					"Moved a historic-structure tax credit bill through committee",
					scottHiltonHb376Date,
					"Georgia House daily reporting lists Scott Hilton as the author of HB 376, a tax-credit bill on rehabilitation of certified structures that received committee action in 2025.",
					"Official Georgia House legislative reporting attaches fiscal and tax-policy work to Hilton's public route.",
					[scottHiltonHb376Source],
				),
			],
			lobbyingContext: [
				buildEvidence(
					"supplemental:scott-hilton:lobbying:att",
					"Georgia lobbyist expenditure report naming Scott Hilton",
					"A reviewed Georgia Government Transparency and Campaign Finance Commission lobbyist expenditure report shows AT&T reporting a $7.52 dinner expenditure for Scott Hilton on February 28, 2017. Ballot Clarity treats this as historical state disclosure context, not proof of current influence.",
					[scottHiltonLobbyingSource],
				),
			],
			methodologyNotes: [
				"Georgia House member directories and legislative daily reports are attached on this route where Ballot Clarity has reviewed stable official legislative records.",
				"Georgia state lobbying and disclosure context is attached only when Ballot Clarity can tie a reviewed public filing directly to the officeholder identity record.",
			],
			officeContext: {
				chamberLabel: "State House",
				committeeMemberships: [
					"Chairman, Information & Audits",
					"Banks & Banking",
					"Budget & Fiscal Affairs Oversight",
					"Game, Fish & Parks",
					"Retirement",
				],
				currentTermLabel: "2025-2026 Georgia General Assembly",
				currentTermStartLabel: "2025",
				currentTermEndLabel: "2026",
				districtLabel: "State House District 48",
				jurisdictionLabel: "Georgia",
				officialOfficeAddress: "504-A CLOB, 18 Capitol Square, Atlanta, GA 30334",
				officialPhone: "(404) 656-0188",
				referenceLinks: [
					buildExternalLink("Georgia House member bio", scottHiltonBioSource.url, "Official Georgia General Assembly biography retained for this public route."),
					buildExternalLink("Georgia House member directory", scottHiltonDirectorySource.url, "Current office, phone, email, and committee assignments for the Georgia House member route."),
					buildExternalLink("HB 340 daily report", scottHiltonHb340Source.url, "Official Georgia House daily report for Hilton's education bill."),
					buildExternalLink("HB 376 daily report", scottHiltonHb376Source.url, "Official Georgia House daily report for Hilton's tax-credit legislation."),
					buildExternalLink("Georgia lobbyist expenditure filing", scottHiltonLobbyingSource.url, "Reviewed state disclosure record naming Scott Hilton."),
				],
			},
			topIssues: [
				buildIssue("student-device-policy", "Student device policy"),
				buildIssue("historic-tax-credit", "Historic rehabilitation tax credits"),
				buildIssue("budget-oversight", "Budget and fiscal oversight"),
			],
		},
		jurisdiction: "State",
		location: "Georgia",
		name: "Scott Hilton",
		officeSought: "State House District 48",
		officeTitle: "Representative",
		party: "Republican",
		profileImages: [
			{
				alt: "Portrait of Scott Hilton",
				capturedAt: reviewedAt,
				priority: 10,
				sourceKind: "official",
				sourceLabel: "Georgia General Assembly portrait",
				sourceSystem: "Georgia General Assembly",
				sourceUrl: scottHiltonBioSource.url,
				url: scottHiltonPortraitUrl,
			},
		],
		provenanceLabel: "Georgia House member bio",
		provenanceNote: "This route is backed by a reviewed Georgia House member bio retained as a stable public state-officeholder record.",
		slug: "scott-hilton",
		sourceSystem: "Georgia House member bio",
		sources: [
			scottHiltonBioSource,
			scottHiltonDirectorySource,
			scottHiltonHb340Source,
			scottHiltonHb376Source,
			scottHiltonEndOfSessionSource,
			scottHiltonLobbyingSource,
		],
		stateCode: "GA",
		stateName: "Georgia",
		summary: "Scott Hilton is the current Republican officeholder Ballot Clarity can attach to Georgia House District 48 from reviewed official Georgia House records, legislative reports, and a reviewed public lobbying disclosure filing.",
		updatedAt: reviewedAt,
	},
	{
		biographySummary: "Robb Pitts is the Chairman of the Fulton County Board of Commissioners in the official county commissioner directory reviewed for Ballot Clarity's local officeholder layer.",
		districtLabel: "Fulton County",
		districtSlug: "fulton-county",
		districtType: "county",
		enrichment: {
			keyActions: [
				buildAction(
					"supplemental:robb-pitts:action:renew-district",
					"Marked a major Renew the District redevelopment milestone",
					robbPittsRenewDistrictDate,
					"An official Fulton County news release says Chairman Robb Pitts joined county leaders to mark a major milestone in the $180 million-plus Renew the District initiative, framing the work around safety, redevelopment, airport modernization, and long-term economic growth.",
					"Official county reporting attaches redevelopment and economic-growth action context to Pitts' public route.",
					[robbPittsRenewDistrictSource],
				),
				buildAction(
					"supplemental:robb-pitts:action:hiring-priority",
					"Directed county hiring priority for displaced federal workers",
					robbPittsHiringDate,
					"An official Fulton County news release says Pitts directed the county to prioritize interviews for federal workers affected by job cuts and urged local governments and employers to do the same.",
					"Official county reporting attaches workforce and public-employment action context to Pitts' public route.",
					[robbPittsHiringSource],
				),
			],
			methodologyNotes: [
				"County officeholder routes can attach reviewed official county news and profile pages when Ballot Clarity has verified them as stable public records.",
			],
			officeContext: {
				chamberLabel: "County commission",
				currentTermLabel: "Jan. 1, 2023 to Dec. 31, 2026",
				currentTermStartLabel: "Jan. 1, 2023",
				currentTermEndLabel: "Dec. 31, 2026",
				districtLabel: "Fulton County",
				jurisdictionLabel: "Fulton County, Georgia",
				officialOfficeAddress: "141 Pryor Street, 10th Floor, Atlanta, GA 30303",
				officialPhone: "404-613-2330",
				referenceLinks: [
					buildExternalLink("Fulton County chairman profile", robbPittsProfileSource.url, "Official county profile for the commission chair."),
					buildExternalLink("Renew the District milestone", robbPittsRenewDistrictSource.url, "Official county redevelopment milestone article."),
					buildExternalLink("Hiring priority announcement", robbPittsHiringSource.url, "Official county workforce announcement from Chairman Pitts."),
				],
			},
			topIssues: [
				buildIssue("elections-administration", "Elections system and voter administration"),
				buildIssue("economic-development", "Economic development and redevelopment"),
				buildIssue("minority-owned-finance", "Minority-owned financial institutions"),
			],
		},
		jurisdiction: "Local",
		location: "Fulton County, Georgia",
		name: "Robb Pitts",
		officeSought: "County Commission Chair",
		officeTitle: "County Commission Chair",
		officialWebsiteUrl: "https://www.fultoncountyga.gov/commissioners/robb-pitts",
		party: "Nonpartisan",
		provenanceLabel: "Official county commissioner directory",
		provenanceNote: "This route is backed by the official county commissioner directory rather than a generalized provider snapshot.",
		slug: "robb-pitts",
		sourceSystem: "Official county commissioner directory",
		sources: [
			robbPittsProfileSource,
			robbPittsRenewDistrictSource,
			robbPittsHiringSource,
		],
		stateCode: "GA",
		stateName: "Georgia",
		summary: "Robb Pitts is the current Fulton County Board of Commissioners chair Ballot Clarity can attach from official county profile and news records, with reviewed local action context on redevelopment and workforce policy.",
		updatedAt: reviewedAt,
	},
	{
		biographySummary: "Mayor John Bradberry is the current Johns Creek mayor in the official city mayor page reviewed for Ballot Clarity's local officeholder layer.",
		districtLabel: "Johns Creek city",
		districtSlug: "johns-creek-city",
		districtType: "city",
		enrichment: {
			keyActions: [
				buildAction(
					"supplemental:john-bradberry:action:medley",
					"Backed Johns Creek Town Center redevelopment at Medley groundbreaking",
					johnBradberryMedleyDate,
					"An official Johns Creek news release quotes Mayor John Bradberry describing the Medley groundbreaking as a major step toward delivering the city's long-planned town center vision.",
					"Official city reporting attaches redevelopment and town-center action context to Bradberry's public route.",
					[johnBradberryMedleySource],
				),
				buildAction(
					"supplemental:john-bradberry:action:mcginnis-ferry",
					"Joined groundbreaking for McGinnis Ferry Road widening",
					johnBradberryRoadDate,
					"An official Johns Creek news release quotes Bradberry on the McGinnis Ferry Road widening project and the city partnership behind the transportation build-out.",
					"Official city reporting attaches transportation and intergovernmental project context to Bradberry's public route.",
					[johnBradberryRoadSource],
				),
			],
			methodologyNotes: [
				"City officeholder routes can attach reviewed official city profile pages and city news updates when Ballot Clarity has verified them as stable public records.",
			],
			officeContext: {
				chamberLabel: "City government",
				districtLabel: "Johns Creek city",
				jurisdictionLabel: "Johns Creek, Georgia",
				officialOfficeAddress: "11360 Lakefield Drive, Johns Creek, GA 30097",
				officialPhone: "678-512-3313",
				referenceLinks: [
					buildExternalLink("Johns Creek mayor page", johnBradberryProfileSource.url, "Official city mayor page and contact block."),
					buildExternalLink("Town Center groundbreaking", johnBradberryMedleySource.url, "Official Johns Creek redevelopment article."),
					buildExternalLink("McGinnis Ferry widening project", johnBradberryRoadSource.url, "Official Johns Creek transportation project article."),
					buildExternalLink("BioReady community designation", johnBradberryBioReadySource.url, "Official Johns Creek innovation and life-sciences announcement."),
				],
			},
			topIssues: [
				buildIssue("town-center-redevelopment", "Town center redevelopment"),
				buildIssue("transportation-projects", "Transportation and road projects"),
				buildIssue("innovation-economy", "Innovation and life-sciences growth"),
			],
		},
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
			johnBradberryProfileSource,
			johnBradberryMedleySource,
			johnBradberryRoadSource,
			johnBradberryBioReadySource,
		],
		stateCode: "GA",
		stateName: "Georgia",
		summary: "John Bradberry is the current Johns Creek mayor Ballot Clarity can attach from official city profile and news records, with reviewed action context on redevelopment, transportation, and innovation-focused projects.",
		updatedAt: reviewedAt,
	},
	{
		biographySummary: "Skyler Beltran is the current Utah County Commission Chair in the official county commission page reviewed for Ballot Clarity's local officeholder layer.",
		districtLabel: "Utah County",
		districtSlug: "utah-county",
		districtType: "county",
		enrichment: {
			methodologyNotes: [
				"Ballot Clarity currently has reviewed county identity and office context for this route, but not a reviewed Utah County finance, disclosure, or issue feed yet.",
			],
			officeContext: {
				chamberLabel: "County commission",
				districtLabel: "Utah County",
				jurisdictionLabel: "Utah County, Utah",
				referenceLinks: [
					buildExternalLink("Utah County Commission", skylerBeltranSource.url, "Official county commission page reviewed for this officeholder route."),
				],
			},
		},
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
		sources: [skylerBeltranSource],
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
		enrichment: {
			funding: {
				cashOnHand: 954.76,
				committeeName: "Marsha Judkins 2025 mayoral campaign disclosures",
				coverageLabel: "2025 mayoral reporting periods through December 4, 2025",
				provenanceLabel: "Official Provo City campaign disclosure form",
				smallDonorShare: 0,
				sources: [
					marshaJudkinsFinanceSource,
					marshaJudkinsElectionSource,
				],
				summary: "The official Provo City campaign disclosure form for Marsha Judkins reports $63,522.39 in donations, $62,567.63 in expenditures, and $954.76 cash on hand across the 2025 mayoral reporting periods.",
				topFunders: [
					buildFundingLineItem("The Kristin Danielle Collard Trust", 5000, "Disclosed donor"),
					buildFundingLineItem("Collard, Grant", 5000, "Disclosed donor"),
					buildFundingLineItem("Judkins, Randy", 5000, "Disclosed donor"),
					buildFundingLineItem("Broadway Outdoor Media", 4000, "Disclosed donor"),
				],
				totalRaised: 63522.39,
				totalSpent: 62567.63,
			},
			keyActions: [
				buildAction(
					"supplemental:marsha-judkins:action:transparency-portal",
					"Launched Provo's new Transparency Portal",
					marshaJudkinsTransparencyDate,
					"An official Provo City article says the new Transparency Portal was launched under Mayor Judkins to make commonly requested public information easier for residents and businesses to access in one place.",
					"Official city reporting attaches transparency and public-information action context to Judkins' public route.",
					[marshaJudkinsTransparencySource],
				),
			],
			methodologyNotes: [
				"City officeholder routes can attach reviewed official city finance disclosures when Ballot Clarity can tie the filing directly to the current officeholder record.",
			],
			officeContext: {
				chamberLabel: "City government",
				currentTermLabel: "4-year term beginning January 2026",
				currentTermStartLabel: "January 2026",
				districtLabel: "Provo city",
				jurisdictionLabel: "Provo, Utah",
				officialOfficeAddress: "445 W Center Street, Suite 500, Provo, UT 84601",
				officialPhone: "(801) 852-6105",
				referenceLinks: [
					buildExternalLink("Provo mayor's office", marshaJudkinsMayorSource.url, "Official mayor's office page and contact block."),
					buildExternalLink("Transparency Portal launch", marshaJudkinsTransparencySource.url, "Official Provo transparency portal launch article."),
					buildExternalLink("2025 Provo election results", marshaJudkinsElectionSource.url, "Official Provo election results and current term certification."),
					buildExternalLink("Campaign finance disclosure form", marshaJudkinsFinanceSource.url, "Official Provo mayoral campaign finance disclosure PDF."),
				],
			},
			topIssues: [
				buildIssue("transparent-governance", "Transparent governance"),
				buildIssue("fiscal-responsibility", "Fiscal responsibility"),
				buildIssue("city-services", "Accessible city services"),
			],
		},
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
			marshaJudkinsMayorSource,
			marshaJudkinsTransparencySource,
			marshaJudkinsElectionSource,
			marshaJudkinsFinanceSource,
		],
		stateCode: "UT",
		stateName: "Utah",
		summary: "Marsha Judkins is the current Provo mayor Ballot Clarity can attach from official city records, with reviewed transparency and local campaign-finance disclosure context.",
		updatedAt: reviewedAt,
	},
];

export function buildSupplementalRepresentativeMatch(record: SupplementalOfficeholderRecord): LocationRepresentativeMatch {
	const classification = classifyRepresentative({
		districtLabel: record.districtLabel,
		districtType: record.districtType,
		officeSought: record.officeSought,
		officeTitle: record.officeTitle,
		stateCode: record.stateCode,
		stateName: record.stateName,
	});

	return {
		districtLabel: record.districtLabel,
		governmentLevel: classification.governmentLevel,
		id: `supplemental:${record.slug}`,
		name: record.name,
		officeDisplayLabel: classification.officeDisplayLabel,
		officeType: classification.officeType,
		officeTitle: record.officeTitle,
		openstatesUrl: record.openstatesUrl,
		party: record.party,
		profileImages: record.profileImages,
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
