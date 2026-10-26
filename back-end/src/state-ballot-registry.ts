import type { StateBallotSource } from "./state-ballot-sources.js";
import { stateBallotSources } from "./state-ballot-sources.js";

export const additionalStateBallotSources: readonly StateBallotSource[] = [
	{
		stateCode: "NC",
		id: "nc-brunswick-samples-2026",
		label: "Brunswick County general-election samples",
		electionDate: "2026-11-03",
		url: "https://brunswickcountync.gov/DocumentCenter/View/7771/House-District-17-PDF?bidId=",
		pageUrl: "https://brunswickcountync.gov/1053/2026-Elections",
		format: "reviewed-pdf",
		retrievalPolicy: "manual-snapshot",
		snapshotStorage: "external",
		documentUrls: [
			"https://brunswickcountync.gov/DocumentCenter/View/7771/House-District-17-PDF?bidId=",
			"https://brunswickcountync.gov/DocumentCenter/View/7772/House-District-19-PDF?bidId=",
		],
		documentLinks: [
			{ label: "House District 17 sample", url: "https://brunswickcountync.gov/DocumentCenter/View/7771/House-District-17-PDF?bidId=" },
			{ label: "House District 19 sample", url: "https://brunswickcountync.gov/DocumentCenter/View/7772/House-District-19-PDF?bidId=" },
		],
		withheldDistrictScopes: ["congressional", "state-senate", "state-house"],
		scopeNotice: "Brunswick County samples only; other North Carolina races may be missing. District-based ballot matching is not verified.",
	},
	{
		stateCode: "NM",
		id: "nm-santa-fe-samples-2026",
		label: "Santa Fe County general-election publications",
		electionDate: "2026-11-03",
		url: "https://www.santafecountynm.gov/uploads/documents/GENERAL_2026-Master_Ballot_List.pdf",
		pageUrl: "https://www.santafecountynm.gov/clerk/elections/sample-ballots",
		format: "reviewed-pdf",
		retrievalPolicy: "manual-snapshot",
		snapshotStorage: "external",
		documentUrls: [
			"https://www.santafecountynm.gov/uploads/documents/GENERAL_2026-Master_Ballot_List.pdf",
			"https://www.santafecountynm.gov/uploads/documents/Sample-SANT_PCT001.pdf",
		],
		documentLinks: [
			{ label: "County master ballot", url: "https://www.santafecountynm.gov/uploads/documents/GENERAL_2026-Master_Ballot_List.pdf" },
			{ label: "Ballot style 1", url: "https://www.santafecountynm.gov/uploads/documents/Sample-SANT_PCT001.pdf" },
		],
		withheldDistrictScopes: ["congressional", "state-senate", "state-house"],
		scopeNotice: "Santa Fe County publications only; other New Mexico races may be missing. District-based ballot matching is not verified.",
	},
	{
		stateCode: "LA",
		id: "la-st-charles-sample-2026",
		label: "St. Charles Parish unofficial November sample",
		electionDate: "2026-11-03",
		url: "https://www.stcharlesparish.gov/home/showpublisheddocument/13854/639254309447270000",
		pageUrl: "https://www.stcharlesparish.gov/Home/Components/FacilityDirectory/FacilityDirectory/26/183",
		format: "reviewed-pdf",
		retrievalPolicy: "manual-snapshot",
		snapshotStorage: "external",
		documentUrls: ["https://www.stcharlesparish.gov/home/showpublisheddocument/13854/639254309447270000"],
		documentLinks: [{ label: "November unofficial sample ballot", url: "https://www.stcharlesparish.gov/home/showpublisheddocument/13854/639254309447270000" }],
		withheldDistrictScopes: ["congressional", "state-senate", "state-house"],
		withheldStatewideOffices: ["Member, Louisiana Public Service Commission District 1"],
		scopeNotice: "Unofficial St. Charles Parish sample only. Senate general and U.S. House primary; district-based ballot matching is unverified.",
	},
	{
		stateCode: "MI",
		id: "mi-tuscola-candidates-2026",
		label: "Tuscola County official candidate listing",
		electionDate: "2026-11-03",
		url: "https://www.tuscolacounty.org/elections/2026/11/Official%20Candidate%20List%20-%20November%202026.pdf",
		pageUrl: "https://www.tuscolacounty.org/elections/",
		format: "reviewed-pdf",
		retrievalPolicy: "manual-snapshot",
		snapshotStorage: "external",
		documentUrls: [
			"https://www.tuscolacounty.org/elections/2026/11/Official%20Candidate%20List%20-%20November%202026.pdf",
			"https://www.tuscolacounty.org/elections/2026/11/Sample%20Ballots%20-%20November%203%202026.pdf",
		],
		documentLinks: [
			{ label: "Official November candidate listing", url: "https://www.tuscolacounty.org/elections/2026/11/Official%20Candidate%20List%20-%20November%202026.pdf" },
			{ label: "November sample ballot styles", url: "https://www.tuscolacounty.org/elections/2026/11/Sample%20Ballots%20-%20November%203%202026.pdf" },
		],
		withheldDistrictScopes: ["congressional", "state-senate", "state-house"],
		scopeNotice: "Tuscola County's November candidate listing only; other Michigan local races may be missing. Township, village, school, library and judicial districts vary by voter; personal ballot matching is not verified.",
	},
	{
		stateCode: "KY",
		id: "ky-warren-candidates-2026",
		label: "Warren County local candidate sample",
		electionDate: "2026-11-03",
		url: "https://warrencountyclerk.ky.gov/wp-content/uploads/2026/09/Warren-2026G.pdf",
		pageUrl: "https://warrencountyclerk.ky.gov/services/elections/2026-general-election-info/",
		format: "reviewed-pdf",
		retrievalPolicy: "manual-snapshot",
		snapshotStorage: "external",
		documentUrls: ["https://warrencountyclerk.ky.gov/wp-content/uploads/2026/09/Warren-2026G.pdf"],
		documentLinks: [{ label: "County general-election sample", url: "https://warrencountyclerk.ky.gov/wp-content/uploads/2026/09/Warren-2026G.pdf" }],
		withheldDistrictScopes: ["congressional", "state-senate", "state-house"],
		scopeNotice: "Warren County local races only; voter-specific eligibility is unverified.",
	},
	{
		stateCode: "AR",
		id: "ar-pulaski-candidates-2026",
		label: "Pulaski County election notice",
		electionDate: "2026-11-03",
		url: "https://votepulaskiar.gov/wp-content/uploads/11032026_Notice-of-Election_v1.pdf",
		pageUrl: "https://votepulaskiar.gov/",
		format: "reviewed-pdf",
		retrievalPolicy: "manual-snapshot",
		snapshotStorage: "external",
		documentUrls: ["https://votepulaskiar.gov/wp-content/uploads/11032026_Notice-of-Election_v1.pdf"],
		documentLinks: [{ label: "County general-election notice", url: "https://votepulaskiar.gov/wp-content/uploads/11032026_Notice-of-Election_v1.pdf" }],
		withheldDistrictScopes: ["congressional", "state-senate", "state-house"],
		scopeNotice: "Local coverage: Pulaski County.",
	},
	{
		stateCode: "FL",
		id: "fl-doe-local-2026",
		label: "Florida local candidate filings",
		electionDate: "2026-11-03",
		url: "https://dos.elections.myflorida.com/candidates/extractCanList.asp",
		pageUrl: "https://dos.elections.myflorida.com/candidates/downloadcanlist.asp",
		format: "florida-local-tsv",
		delimiter: "\t",
		postBody: "elecID=20261103-GEN&office=All&status=All&cantype=LOC&FormSubmit=Download+Candidate+List",
		snapshotStorage: "external",
		scopeNotice: "Local filings are not a complete ballot. Reported county and district labels do not establish voter eligibility; some county labels are missing.",
	},
	{
		stateCode: "MD",
		id: "md-sbe-local-2026",
		label: "Maryland local candidates",
		electionDate: "2026-11-03",
		url: "https://elections.maryland.gov/elections/2026/general_candidates/2026_GG_all_counties_candidatelist.csv",
		pageUrl: "https://elections.maryland.gov/elections/2026/general_candidates/2026_GG_all_counties_candidatelist.html",
		format: "maryland-local-csv",
		snapshotStorage: "external",
		scopeNotice: "County labels group source records; they are not voter-specific ballot matches.",
	},
	{
		stateCode: "KY",
		id: "ky-courts-2026",
		label: "Kentucky courts and prosecutors",
		electionDate: "2026-11-03",
		url: "https://web.sos.ky.gov/CandidateFilings/",
		pageUrl: "https://web.sos.ky.gov/CandidateFilings/",
		format: "kentucky-courts-html",
		snapshotStorage: "external",
		scopeNotice: "Regional districts are source labels, not voter-specific ballot matches.",
	},
	{
		stateCode: "VA",
		id: "va-elect-2026-local",
		label: "Virginia local and regional candidates",
		electionDate: "2026-11-03",
		url: "https://www.elections.virginia.gov/casting-a-ballot/candidate-list/november-3-2026-gen-elect-local-offices/",
		pageUrl: "https://www.elections.virginia.gov/casting-a-ballot/candidate-list/november-3-2026-gen-elect-local-offices/",
		format: "virginia-local-html",
		snapshotStorage: "external",
		documentUrls: [
			"https://www.elections.virginia.gov/casting-a-ballot/candidate-list/november-3-2026-gen-elect-local-offices/",
			"https://www.elections.virginia.gov/casting-a-ballot/candidate-list/november-3-2026-gen-elect-all-offices/",
		],
		withheldDistrictScopes: ["state-house"],
		scopeNotice: "Reported seats are vacancies, not voting instructions.",
	},
	{
		stateCode: "VT",
		id: "vt-sos-2026",
		label: "Vermont Secretary of State",
		electionDate: "2026-11-03",
		url: "https://outside.vermont.gov/dept/sos/Elections_Division/election_info_resources/candidates/2026_general_election_qualified_candidates.xlsx",
		pageUrl: "https://sos.vermont.gov/elections/election-info-resources/candidates",
		format: "vermont-xlsx",
		defaultPriority: 1,
		snapshotStorage: "external",
		documentUrls: [
			"https://outside.vermont.gov/dept/sos/Elections_Division/election_info_resources/candidates/2026_general_election_qualified_candidates.xlsx"
		],
		withheldDistrictScopes: ["state-senate", "state-house"],
		scopeNotice:
			"State-filed candidates; town and school races may be missing. District and local eligibility is unverified."
	},
	{
		stateCode: "NV",
		id: "nv-washoe-2026",
		countyName: "Washoe County",
		label: "Washoe County general-election contests",
		electionDate: "2026-11-03",
		url: "https://www.washoecounty.gov/voters/information/",
		pageUrl: "https://www.washoecounty.gov/voters/information/",
		format: "washoe-html",
		snapshotStorage: "external",
		documentUrls: ["https://www.washoecounty.gov/voters/information/"],
		scopeNotice: "Other Nevada counties are not included.",
	},
	{
		stateCode: "IA",
		id: "ia-johnson-2026",
		countyName: "Johnson County",
		label: "Johnson County general-election candidates",
		electionDate: "2026-11-03",
		url: "https://johnsoncountyiowa.gov/november-3-2026-general-election",
		pageUrl: "https://johnsoncountyiowa.gov/november-3-2026-general-election",
		format: "iowa-johnson-html",
		snapshotStorage: "external",
		documentUrls: ["https://johnsoncountyiowa.gov/november-3-2026-general-election"],
		scopeNotice: "Johnson County publication only. Other Iowa races may be missing.",
	},
];

function automaticReviewedSource(source: StateBallotSource): StateBallotSource {
	if (source.id === "nv-clark-2026") return { ...source, format: "clark-pdf", url: source.pageUrl, retrievalPolicy: undefined, documentUrls: undefined, documentLinks: undefined, snapshotStorage: "external" };
	if (source.id === "ct-sots-2026") return { ...source, format: "connecticut-pdf", retrievalPolicy: undefined, documentUrls: undefined, snapshotStorage: "external", scopeNotice: "Town samples may omit races or district identifiers; personal ballot matching is unverified." };
	return { ...source, format: source.id === "or-sos-multnomah-2026" ? "oregon-pdf" : source.id === "tx-sos-2026" ? "texas-certified-pdf" : source.id === "ga-fulton-2026" ? "fulton-pdf" : "certified-pdf", retrievalPolicy: undefined, ...(source.id === "tx-sos-2026" ? { withheldDistrictScopes: ["congressional"] as const } : {}), ...(source.id === "or-sos-multnomah-2026" ? { scopeNotice: "County-filed contests outside Multnomah County are not included." } : {}) };
}

export function legacyReviewedStateBallotSource(source: StateBallotSource) {
	const legacy = stateBallotSources.find(item => ["nv-clark-2026", "ct-sots-2026", "ga-fulton-2026", "mo-sos-2026", "nj-doe-2026-federal", "tx-sos-2026", "or-sos-multnomah-2026"].includes(item.id) && item.id === source.id);
	return legacy && JSON.stringify(source) === JSON.stringify(automaticReviewedSource(legacy)) ? legacy : null;
}

export function legacyFultonReviewedSource(source: StateBallotSource) {
	return source.id === "ga-fulton-2026" ? legacyReviewedStateBallotSource(source) : null;
}

export const configuredStateBallotSources: readonly StateBallotSource[] = [...stateBallotSources.map(source => ["nv-clark-2026", "ct-sots-2026", "ga-fulton-2026", "mo-sos-2026", "nj-doe-2026-federal", "tx-sos-2026", "or-sos-multnomah-2026"].includes(source.id) ? automaticReviewedSource(source) : source), ...additionalStateBallotSources];
