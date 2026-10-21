export interface StateBallotSource {
	stateCode: string;
	id: string;
	label: string;
	electionDate: string;
	url: string;
	pageUrl: string;
	format: "csv" | "delaware-html" | "michigan-html" | "new-mexico-html" | "virginia-html" | "colorado-html" | "kentucky-html" | "north-dakota-html";
	delimiter?: string;
	postBody?: string;
	documentUrls?: readonly string[];
}

export const stateBallotSources: readonly StateBallotSource[] = [
	{
		stateCode: "CO",
		id: "co-sos-2026",
		label: "Colorado Secretary of State",
		electionDate: "2026-11-03",
		url: "https://www.sos.state.co.us/pubs/elections/vote/generalCandidates.html",
		pageUrl: "https://www.sos.state.co.us/pubs/elections/vote/generalCandidates.html",
		format: "colorado-html",
	},
	{
		stateCode: "KY",
		id: "ky-sos-2026",
		label: "Kentucky Secretary of State",
		electionDate: "2026-11-03",
		url: "https://web.sos.ky.gov/CandidateFilings/",
		pageUrl: "https://web.sos.ky.gov/CandidateFilings/",
		format: "kentucky-html",
		documentUrls: [
			"https://web.sos.ky.gov/CandidateFilings/Default.aspx?id=3",
			"https://web.sos.ky.gov/CandidateFilings/Default.aspx?id=4",
			"https://web.sos.ky.gov/CandidateFilings/Default.aspx?id=11",
			"https://web.sos.ky.gov/CandidateFilings/Default.aspx?id=12",
			"https://web.sos.ky.gov/CandidateFilings/Default.aspx?withdrawn=1",
		],
	},
	{
		stateCode: "ND",
		id: "nd-sos-2026",
		label: "North Dakota Secretary of State",
		electionDate: "2026-11-03",
		url: "https://vip.sos.nd.gov/candidatelist.aspx?eid=348",
		pageUrl: "https://vip.sos.nd.gov/candidatelist.aspx?eid=348",
		format: "north-dakota-html",
	},
	{
		stateCode: "NM",
		id: "nm-sos-2026",
		label: "New Mexico Secretary of State",
		electionDate: "2026-11-03",
		url: "https://candidateportal.servis.sos.state.nm.us/CandidateList.aspx?cty=99",
		pageUrl: "https://candidateportal.servis.sos.state.nm.us/CandidateList.aspx?cty=99",
		format: "new-mexico-html",
	},
	{
		stateCode: "VA",
		id: "va-elect-2026-federal",
		label: "Virginia Department of Elections",
		electionDate: "2026-11-03",
		url: "https://www.elections.virginia.gov/casting-a-ballot/candidate-list/november-3-2026-gen-elect-federal-offices/",
		pageUrl: "https://www.elections.virginia.gov/casting-a-ballot/candidate-list/november-3-2026-gen-elect-federal-offices/",
		format: "virginia-html",
	},
	{
		stateCode: "MI",
		id: "mi-dos-2026",
		label: "Michigan Department of State",
		electionDate: "2026-11-03",
		url: "https://mi-boe.entellitrak.com/etk-mi-boe-prod/page.request.do?page=page.miboePublicReport&electionType=GEN&electionYear=2026",
		pageUrl: "https://mi-boe.entellitrak.com/etk-mi-boe-prod/page.request.do?page=page.miboePublicReport&electionType=GEN&electionYear=2026",
		format: "michigan-html",
	},
	{
		stateCode: "NC",
		id: "nc-sbe-2026",
		label: "North Carolina State Board of Elections",
		electionDate: "2026-11-03",
		url: "https://s3.amazonaws.com/dl.ncsbe.gov/Elections/2026/Candidate%20Filing/Candidate_Listing_2026.csv",
		pageUrl: "https://www.ncsbe.gov/results-data/candidate-lists",
		format: "csv",
	},
	{
		stateCode: "WY",
		id: "wy-sos-2026",
		label: "Wyoming Secretary of State",
		electionDate: "2026-11-03",
		url: "https://sos.wyo.gov/Elections/Docs/2026/2026_WY_General_Election_Candidates.csv",
		pageUrl: "https://sos.wyo.gov/Elections/2026ElectionInformation.aspx",
		format: "csv",
	},
	{
		stateCode: "MD",
		id: "md-sbe-2026",
		label: "Maryland State Board of Elections",
		electionDate: "2026-11-03",
		url: "https://elections.maryland.gov/elections/2026/general_candidates/2026_GG_statewide_candidatelist.csv",
		pageUrl: "https://elections.maryland.gov/elections/2026/general_candidates/2026_GG_statewide_candidatelist.html",
		format: "csv",
	},
	{
		stateCode: "FL",
		id: "fl-doe-2026",
		label: "Florida Division of Elections",
		electionDate: "2026-11-03",
		url: "https://dos.elections.myflorida.com/candidates/extractCanList.asp",
		pageUrl: "https://dos.elections.myflorida.com/candidates/downloadcanlist.asp",
		format: "csv",
		delimiter: "\t",
		postBody: "elecID=20261103-GEN&office=All&status=All&cantype=STA&FormSubmit=Download+Candidate+List",
	},
	{
		stateCode: "DE",
		id: "de-doe-2026",
		label: "Delaware Department of Elections",
		electionDate: "2026-11-03",
		url: "https://elections.delaware.gov/candidates/candidatelist/genl_fcddt_2026.html",
		pageUrl: "https://elections.delaware.gov/candidates/candidatelist/genl_fcddt_2026.html",
		format: "delaware-html",
	},
];
