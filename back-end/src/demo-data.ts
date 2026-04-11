import type {
	Candidate,
	CandidateComparisonProfile,
	CandidateLink,
	ComparableStatement,
	Contest,
	DataSourcesResponse,
	Election,
	ElectionSummary,
	FreshnessMeta,
	Jurisdiction,
	JurisdictionSummary,
	LocationSelection,
	Measure,
	OfficialResource,
	QuestionnaireResponse,
	Source,
	SourceAuthority,
	TrustBullet
} from "./types/civic.js";

const demoSourceNote = "Demo source file included with the MVP. Review the original public record before relying on it for a real election.";

function source(
	id: string,
	title: string,
	publisher: string,
	type: Source["type"],
	date: string,
	file: string,
	options?: {
		authority?: SourceAuthority;
		note?: string;
		sourceSystem?: string;
	}
): Source {
	return {
		authority: options?.authority ?? "ballot-clarity-demo",
		date,
		id,
		note: options?.note ?? demoSourceNote,
		publisher,
		sourceSystem: options?.sourceSystem ?? publisher,
		title,
		type,
		url: `/demo-sources/${file}`
	};
}

function uniqueSources(...groups: Source[][]) {
	return Array.from(new Map(groups.flat().map(item => [item.id, item])).values());
}

function officialResource(
	label: string,
	sourceLabel: string,
	file: string,
	options?: {
		authority?: SourceAuthority;
		note?: string;
		sourceSystem?: string;
	}
): OfficialResource {
	return {
		authority: options?.authority ?? "official-government",
		label,
		note: options?.note,
		sourceLabel,
		sourceSystem: options?.sourceSystem ?? sourceLabel,
		url: `/demo-sources/${file}`
	};
}

function candidateSubmitted(detail: string, capturedAt: string) {
	return {
		capturedAt,
		detail,
		label: "Candidate-submitted",
		status: "candidate-submitted" as const
	};
}

function verifiedOfficial(detail: string, capturedAt: string) {
	return {
		capturedAt,
		detail,
		label: "Verified (official)",
		status: "verified-official" as const
	};
}

function unclear(detail: string, capturedAt: string) {
	return {
		capturedAt,
		detail,
		label: "Not clearly stated",
		status: "unclear" as const
	};
}

function link(label: string, url: string, note?: string): CandidateLink {
	return {
		label,
		note,
		url
	};
}

function comparableStatement(id: string, text: string | null, sources: Source[], provenance: ComparableStatement["provenance"]): ComparableStatement {
	return {
		id,
		provenance,
		sources,
		text
	};
}

function questionnaireResponse(input: QuestionnaireResponse): QuestionnaireResponse {
	return input;
}

function comparisonProfile(input: CandidateComparisonProfile): CandidateComparisonProfile {
	return input;
}

function freshnessMeta(input: FreshnessMeta): FreshnessMeta {
	return input;
}

function trustBullet(id: string, text: string, sources: Source[], note?: string): TrustBullet {
	return {
		id,
		note,
		sources,
		text
	};
}

const metroGuide = source("metro-guide-2026", "Metro County 2026 General Election Demo Guide", "Ballot Clarity Demo Archive", "voter guide", "2026-03-30", "metro-county-voter-guide.txt", {
	authority: "ballot-clarity-demo",
	sourceSystem: "Ballot Clarity demo archive"
});
const methodologyBrief = source("methodology-brief", "Ballot Clarity Demo Methodology Notes", "Ballot Clarity Demo Archive", "research brief", "2026-03-30", "methodology-demo-notes.txt", {
	authority: "ballot-clarity-demo",
	sourceSystem: "Ballot Clarity demo archive"
});

const torresFec = source("torres-fec-q1", "Elena Torres Q1 2026 FEC Filing", "Federal Election Commission Demo File", "campaign filing", "2026-03-28", "federal-d7-fec-torres-q1-2026.txt", {
	authority: "official-government",
	sourceSystem: "OpenFEC-style filing archive (demo)"
});
const brooksFec = source("brooks-fec-q1", "Daniel Brooks Q1 2026 FEC Filing", "Federal Election Commission Demo File", "campaign filing", "2026-03-28", "federal-d7-fec-brooks-q1-2026.txt", {
	authority: "official-government",
	sourceSystem: "OpenFEC-style filing archive (demo)"
});
const brooksVotes = source("brooks-house-votes", "Selected House Votes for District 7 Incumbent", "Congressional Record Demo Extract", "official record", "2026-03-22", "federal-d7-house-votes-brooks.txt", {
	authority: "official-government",
	sourceSystem: "Congressional record extract (demo)"
});
const torresPolicy = source("torres-port-clinic-plan", "Torres Port and Clinic Access Platform Summary", "Campaign Policy Demo File", "policy memo", "2026-03-24", "federal-d7-port-clinic-plan-torres.txt", {
	authority: "candidate-campaign",
	sourceSystem: "Candidate campaign policy memo (demo)"
});

const bellWaterBill = source("bell-water-bill", "State Senate District 12 Water Reliability Bill Summary", "Franklin Legislature Demo File", "official record", "2026-03-19", "state-senate-d12-bell-water-bill.txt", {
	authority: "official-government",
	sourceSystem: "Franklin Legislature record archive (demo)"
});
const parkHousing = source("park-housing-hearing", "Naomi Park Rental Stability Hearing Notes", "Franklin Legislature Demo File", "hearing transcript", "2026-03-21", "state-senate-d12-park-housing-hearing.txt", {
	authority: "official-government",
	sourceSystem: "Franklin Legislature hearing archive (demo)"
});
const districtEthics = source("district-ethics", "District 12 Lobbying and Ethics Disclosure Summary", "Franklin Ethics Commission Demo File", "ethics filing", "2026-03-20", "state-senate-d12-ethics-disclosures.txt", {
	authority: "official-government",
	sourceSystem: "Franklin Ethics Commission disclosure archive (demo)"
});

const schoolBudgetMinutes = source("school-budget-minutes", "Metro County School Board Budget Workshop Minutes", "Metro County Schools Demo File", "official record", "2026-03-18", "school-board-budget-minutes.txt", {
	authority: "official-government",
	sourceSystem: "Metro County Schools public meeting archive (demo)"
});
const schoolLiteracyReport = source("school-literacy-report", "Metro County K-3 Literacy and Attendance Report", "Metro County Schools Demo File", "research brief", "2026-03-17", "school-board-literacy-report.txt", {
	authority: "official-government",
	sourceSystem: "Metro County Schools reporting archive (demo)"
});
const schoolQuestionnaire = source("school-questionnaire", "School Board Candidate Questionnaire Responses", "League of Metro Voters Demo File", "questionnaire", "2026-03-23", "school-board-candidate-questionnaire.txt", {
	authority: "nonprofit-provider",
	sourceSystem: "League of Metro Voters questionnaire archive (demo)"
});

const transitFiscal = source("transit-fiscal-note", "Measure 4 Fiscal Note and Debt Service Estimate", "Metro County Budget Office Demo File", "official record", "2026-03-29", "measure-4-fiscal-note.txt", {
	authority: "official-government",
	sourceSystem: "Metro County Budget Office archive (demo)"
});
const transitCapital = source("transit-capital-plan", "Measure 4 Capital Improvement Plan Summary", "Metro County Transit Authority Demo File", "policy memo", "2026-03-27", "measure-4-capital-plan.txt", {
	authority: "official-government",
	sourceSystem: "Metro County Transit Authority memo archive (demo)"
});
const charterAudit = source("charter-audit", "Public Records Response Time Audit", "Metro County Auditor Demo File", "research brief", "2026-03-25", "amendment-a-audit-report.txt", {
	authority: "official-government",
	sourceSystem: "Metro County Auditor archive (demo)"
});
const charterSummary = source("charter-summary", "Charter Amendment A Plain-Language Summary", "Metro County Clerk Demo File", "official record", "2026-03-26", "amendment-a-charter-summary.txt", {
	authority: "official-government",
	sourceSystem: "Metro County Clerk archive (demo)"
});
const officialCandidateList = source("official-candidate-list", "Metro County 2026 Official Candidate List", "Metro County Elections Office Demo File", "official record", "2026-03-31", "metro-county-official-candidate-list.txt", {
	authority: "official-government",
	sourceSystem: "Metro County Elections Office candidate filing list (demo)"
});
const federalQuestionnaire = source("federal-questionnaire", "District 7 Candidate Questionnaire Responses", "League of Metro Voters Demo File", "questionnaire", "2026-03-27", "federal-d7-candidate-questionnaire.txt", {
	authority: "nonprofit-provider",
	sourceSystem: "League of Metro Voters questionnaire archive (demo)"
});
const stateQuestionnaire = source("state-questionnaire", "State Senate District 12 Candidate Questionnaire Responses", "League of Metro Voters Demo File", "questionnaire", "2026-03-26", "state-senate-d12-candidate-questionnaire.txt", {
	authority: "nonprofit-provider",
	sourceSystem: "League of Metro Voters questionnaire archive (demo)"
});

export const demoLocation: LocationSelection = {
	coverageLabel: "Demo coverage: Metro County, Franklin",
	displayName: "Metro County, Franklin",
	slug: "metro-county-franklin",
	state: "Franklin"
};

const federalDistrict7Questions = {
	clinicAccess: {
		answerType: "yes-no-explanation" as const,
		category: "Infrastructure and access",
		questionId: "clinic-access-grants",
		questionPrompt: "Would you support expanding federal transportation and clinic-access grants in District 7?"
	},
	floodFunding: {
		answerType: "short-text" as const,
		category: "Flood resilience",
		questionId: "flood-funding-priority",
		questionPrompt: "How should federal flood-mitigation money be prioritized in District 7?"
	},
	housingAid: {
		answerType: "short-text" as const,
		category: "Housing",
		questionId: "housing-aid-approach",
		questionPrompt: "What is your approach to housing and redevelopment aid in flood-prone areas?"
	}
};

const stateSenateDistrict12Questions = {
	groundwaterReporting: {
		answerType: "yes-no-explanation" as const,
		category: "Water oversight",
		questionId: "groundwater-reporting",
		questionPrompt: "Would you support annual groundwater reporting by basin in District 12?"
	},
	housingRegulation: {
		answerType: "short-text" as const,
		category: "Housing",
		questionId: "housing-regulation",
		questionPrompt: "What is your preferred approach to housing regulation and development timelines?"
	},
	schoolStaffing: {
		answerType: "short-text" as const,
		category: "Education",
		questionId: "school-staffing-role",
		questionPrompt: "What role should the state play in school staffing pressures in fast-growing districts?"
	}
};

const schoolBoardQuestions = {
	facilitiesTiming: {
		answerType: "short-text" as const,
		category: "Budget and facilities",
		questionId: "facilities-and-budget",
		questionPrompt: "How should the board balance facilities spending with recurring classroom costs?"
	},
	literacyRollout: {
		answerType: "short-text" as const,
		category: "Literacy",
		questionId: "literacy-rollout-pace",
		questionPrompt: "What is your preferred pace for literacy intervention expansion?"
	},
	tutoringTransparency: {
		answerType: "yes-no-explanation" as const,
		category: "Transparency",
		questionId: "tutoring-transparency",
		questionPrompt: "Should the district publish campus-by-campus tutoring access and attendance data?"
	}
};

const elenaTorresComparison = comparisonProfile({
	ballotName: "Elena Torres",
	displayName: "Elena Torres",
	ballotOrder: 1,
	partyOnBallot: "Democratic Party",
	campaignWebsiteUrl: "https://torresfordistrict7.example",
	contactChannels: [
		link("Campaign website", "https://torresfordistrict7.example"),
		link("Issue platform", "https://torresfordistrict7.example/issues")
	],
	ballotStatus: {
		asOf: "2026-03-31T10:00:00.000Z",
		label: "On ballot (verified)",
		provenance: verifiedOfficial("Confirmed from the Metro County official candidate list.", "2026-03-31T10:00:00.000Z"),
		sources: [officialCandidateList],
		status: "on-ballot-verified"
	},
	whyRunning: comparableStatement(
		"torres-why-running",
		"I am running to shorten daily commute burdens, improve clinic access, and direct federal project money toward neighborhoods that have waited longest for basic infrastructure fixes.",
		[federalQuestionnaire, torresPolicy],
		candidateSubmitted("Submitted through the District 7 comparison questionnaire.", "2026-03-27T14:00:00.000Z")
	),
	topPriorities: [
		comparableStatement(
			"torres-priority-1",
			"Expand district transportation and clinic-access grants.",
			[federalQuestionnaire, torresPolicy],
			candidateSubmitted("Priority list supplied through the District 7 comparison questionnaire.", "2026-03-27T14:00:00.000Z")
		),
		comparableStatement(
			"torres-priority-2",
			"Prioritize flood-resilient infrastructure in rental and clinic corridors.",
			[federalQuestionnaire, torresPolicy],
			candidateSubmitted("Priority list supplied through the District 7 comparison questionnaire.", "2026-03-27T14:00:00.000Z")
		),
		comparableStatement(
			"torres-priority-3",
			"Pair capital projects with transparent local matching plans.",
			[federalQuestionnaire, torresPolicy],
			candidateSubmitted("Priority list supplied through the District 7 comparison questionnaire.", "2026-03-27T14:00:00.000Z")
		)
	],
	questionnaireResponses: [
		questionnaireResponse({
			...federalDistrict7Questions.clinicAccess,
			answerReceivedAt: "2026-03-27T14:00:00.000Z",
			answerText: "Yes. District 7 should compete for transportation and clinic-access grants together because missed appointments and unreliable commutes are often the same access problem.",
			provenance: candidateSubmitted("Submitted through the District 7 comparison questionnaire.", "2026-03-27T14:00:00.000Z"),
			responseStatus: "answered",
			sources: [federalQuestionnaire, torresPolicy]
		}),
		questionnaireResponse({
			...federalDistrict7Questions.floodFunding,
			answerReceivedAt: "2026-03-27T14:00:00.000Z",
			answerText: "Flood-mitigation money should first protect rental areas, clinic routes, and bus corridors where recurring flooding interrupts housing stability and access to care.",
			provenance: candidateSubmitted("Submitted through the District 7 comparison questionnaire.", "2026-03-27T14:00:00.000Z"),
			responseStatus: "answered",
			sources: [federalQuestionnaire, torresPolicy]
		}),
		questionnaireResponse({
			...federalDistrict7Questions.housingAid,
			answerReceivedAt: "2026-03-27T14:00:00.000Z",
			answerText: "Redevelopment aid should not outrank flood-prone rental preservation. I would favor assistance that stabilizes existing neighborhoods before subsidizing market-rate replacement projects.",
			provenance: candidateSubmitted("Submitted through the District 7 comparison questionnaire.", "2026-03-27T14:00:00.000Z"),
			responseStatus: "answered",
			sources: [federalQuestionnaire, torresPolicy]
		})
	]
});

const danielBrooksComparison = comparisonProfile({
	ballotName: "Daniel Brooks",
	displayName: "Daniel Brooks",
	ballotOrder: 2,
	partyOnBallot: "Republican Party",
	campaignWebsiteUrl: "https://brooksforcongress.example",
	contactChannels: [
		link("Campaign website", "https://brooksforcongress.example"),
		link("Constituent priorities", "https://brooksforcongress.example/priorities")
	],
	ballotStatus: {
		asOf: "2026-03-31T10:00:00.000Z",
		label: "On ballot (verified)",
		provenance: verifiedOfficial("Confirmed from the Metro County official candidate list.", "2026-03-31T10:00:00.000Z"),
		sources: [officialCandidateList],
		status: "on-ballot-verified"
	},
	whyRunning: comparableStatement(
		"brooks-why-running",
		"I am seeking another term to keep federal freight, flood-control, and small-business programs moving through committees where District 7 already has active projects.",
		[federalQuestionnaire, brooksVotes],
		candidateSubmitted("Submitted through the District 7 comparison questionnaire.", "2026-03-27T13:20:00.000Z")
	),
	topPriorities: [
		comparableStatement(
			"brooks-priority-1",
			"Protect freight and port modernization funding.",
			[federalQuestionnaire, brooksVotes],
			candidateSubmitted("Priority list supplied through the District 7 comparison questionnaire.", "2026-03-27T13:20:00.000Z")
		),
		comparableStatement(
			"brooks-priority-2",
			"Expand hard-infrastructure flood projects.",
			[federalQuestionnaire, brooksVotes],
			candidateSubmitted("Priority list supplied through the District 7 comparison questionnaire.", "2026-03-27T13:20:00.000Z")
		),
		comparableStatement(
			"brooks-priority-3",
			"Maintain committee access for district grant pipelines.",
			[federalQuestionnaire, brooksVotes],
			candidateSubmitted("Priority list supplied through the District 7 comparison questionnaire.", "2026-03-27T13:20:00.000Z")
		)
	],
	questionnaireResponses: [
		questionnaireResponse({
			...federalDistrict7Questions.clinicAccess,
			answerReceivedAt: "2026-03-27T13:20:00.000Z",
			answerText: "I support grant applications that combine port and road access with essential services, but they should be tied to district infrastructure readiness rather than new local tax commitments.",
			provenance: candidateSubmitted("Submitted through the District 7 comparison questionnaire.", "2026-03-27T13:20:00.000Z"),
			responseStatus: "answered",
			sources: [federalQuestionnaire, brooksVotes]
		}),
		questionnaireResponse({
			...federalDistrict7Questions.floodFunding,
			answerReceivedAt: "2026-03-27T13:20:00.000Z",
			answerText: "Federal flood money should favor levees, drainage upgrades, and port-adjacent protections first, with relocation or redevelopment aid handled separately.",
			provenance: candidateSubmitted("Submitted through the District 7 comparison questionnaire.", "2026-03-27T13:20:00.000Z"),
			responseStatus: "answered",
			sources: [federalQuestionnaire, brooksVotes]
		}),
		questionnaireResponse({
			...federalDistrict7Questions.housingAid,
			answerText: null,
			provenance: unclear("Question sent to all District 7 candidates. No response was received on this item as of 2026-03-31.", "2026-03-31T10:00:00.000Z"),
			responseStatus: "no-response",
			sources: [federalQuestionnaire]
		})
	]
});

const naomiParkComparison = comparisonProfile({
	ballotName: "Naomi Park",
	displayName: "Naomi Park",
	ballotOrder: 1,
	partyOnBallot: "Democratic Party",
	campaignWebsiteUrl: "https://parkfordistrict12.example",
	contactChannels: [
		link("Campaign website", "https://parkfordistrict12.example"),
		link("Housing and water agenda", "https://parkfordistrict12.example/issues")
	],
	ballotStatus: {
		asOf: "2026-03-31T10:00:00.000Z",
		label: "On ballot (verified)",
		provenance: verifiedOfficial("Confirmed from the Metro County official candidate list.", "2026-03-31T10:00:00.000Z"),
		sources: [officialCandidateList],
		status: "on-ballot-verified"
	},
	whyRunning: comparableStatement(
		"park-why-running",
		"I am running because fast district growth has outpaced housing stability, groundwater transparency, and school staffing, and residents need a senator who will publish clearer tradeoffs.",
		[stateQuestionnaire, parkHousing],
		candidateSubmitted("Submitted through the District 12 comparison questionnaire.", "2026-03-26T16:10:00.000Z")
	),
	topPriorities: [
		comparableStatement(
			"park-priority-1",
			"Annual groundwater reporting by basin.",
			[stateQuestionnaire, parkHousing],
			candidateSubmitted("Priority list supplied through the District 12 comparison questionnaire.", "2026-03-26T16:10:00.000Z")
		),
		comparableStatement(
			"park-priority-2",
			"Tenant stability and repair enforcement before new incentives.",
			[stateQuestionnaire, parkHousing],
			candidateSubmitted("Priority list supplied through the District 12 comparison questionnaire.", "2026-03-26T16:10:00.000Z")
		),
		comparableStatement(
			"park-priority-3",
			"State support for local school staffing pressures.",
			[stateQuestionnaire, schoolQuestionnaire],
			candidateSubmitted("Priority list supplied through the District 12 comparison questionnaire.", "2026-03-26T16:10:00.000Z")
		)
	],
	questionnaireResponses: [
		questionnaireResponse({
			...stateSenateDistrict12Questions.groundwaterReporting,
			answerReceivedAt: "2026-03-26T16:10:00.000Z",
			answerText: "Yes. Residents should be able to see annual groundwater use, recharge estimates, and high-volume permit activity by basin before new permits are extended.",
			provenance: candidateSubmitted("Submitted through the District 12 comparison questionnaire.", "2026-03-26T16:10:00.000Z"),
			responseStatus: "answered",
			sources: [stateQuestionnaire, parkHousing]
		}),
		questionnaireResponse({
			...stateSenateDistrict12Questions.housingRegulation,
			answerReceivedAt: "2026-03-26T16:10:00.000Z",
			answerText: "I would start with repair enforcement, vacancy transparency, and tenant stability measures, then target new housing approvals around locations that can absorb growth responsibly.",
			provenance: candidateSubmitted("Submitted through the District 12 comparison questionnaire.", "2026-03-26T16:10:00.000Z"),
			responseStatus: "answered",
			sources: [stateQuestionnaire, parkHousing]
		}),
		questionnaireResponse({
			...stateSenateDistrict12Questions.schoolStaffing,
			answerReceivedAt: "2026-03-26T16:10:00.000Z",
			answerText: "The state should give fast-growing districts more flexibility on staffing grants and vacancy support so local school systems are not forced to shift one-time funds into recurring gaps.",
			provenance: candidateSubmitted("Submitted through the District 12 comparison questionnaire.", "2026-03-26T16:10:00.000Z"),
			responseStatus: "answered",
			sources: [stateQuestionnaire, schoolQuestionnaire]
		})
	]
});

const thomasBellComparison = comparisonProfile({
	ballotName: "Thomas Bell",
	displayName: "Thomas Bell",
	ballotOrder: 2,
	partyOnBallot: "Republican Party",
	campaignWebsiteUrl: "https://bellfordistrict12.example",
	contactChannels: [
		link("Campaign website", "https://bellfordistrict12.example"),
		link("Legislative priorities", "https://bellfordistrict12.example/priorities")
	],
	ballotStatus: {
		asOf: "2026-03-31T10:00:00.000Z",
		label: "On ballot (verified)",
		provenance: verifiedOfficial("Confirmed from the Metro County official candidate list.", "2026-03-31T10:00:00.000Z"),
		sources: [officialCandidateList],
		status: "on-ballot-verified"
	},
	whyRunning: comparableStatement(
		"bell-why-running",
		"I am running for another term to keep water-reliability, road-capacity, and apprenticeship funding moving for a district that is still managing rapid growth.",
		[stateQuestionnaire, bellWaterBill],
		candidateSubmitted("Submitted through the District 12 comparison questionnaire.", "2026-03-26T15:30:00.000Z")
	),
	topPriorities: [
		comparableStatement(
			"bell-priority-1",
			"Expand water storage and leak-loss accountability.",
			[stateQuestionnaire, bellWaterBill],
			candidateSubmitted("Priority list supplied through the District 12 comparison questionnaire.", "2026-03-26T15:30:00.000Z")
		),
		comparableStatement(
			"bell-priority-2",
			"Keep district road-capacity projects moving.",
			[stateQuestionnaire, bellWaterBill],
			candidateSubmitted("Priority list supplied through the District 12 comparison questionnaire.", "2026-03-26T15:30:00.000Z")
		),
		comparableStatement(
			"bell-priority-3",
			"Link infrastructure projects to apprenticeship seats.",
			[stateQuestionnaire, bellWaterBill],
			candidateSubmitted("Priority list supplied through the District 12 comparison questionnaire.", "2026-03-26T15:30:00.000Z")
		)
	],
	questionnaireResponses: [
		questionnaireResponse({
			...stateSenateDistrict12Questions.groundwaterReporting,
			answerReceivedAt: "2026-03-26T15:30:00.000Z",
			answerText: "Yes, if reporting is paired with utility leak-loss disclosure and does not delay urgent capacity work that districts already know they need.",
			provenance: candidateSubmitted("Submitted through the District 12 comparison questionnaire.", "2026-03-26T15:30:00.000Z"),
			responseStatus: "answered",
			sources: [stateQuestionnaire, bellWaterBill]
		}),
		questionnaireResponse({
			...stateSenateDistrict12Questions.housingRegulation,
			answerReceivedAt: "2026-03-26T15:30:00.000Z",
			answerText: "The state should shorten permitting timelines before layering on new tenant mandates, while still requiring local governments to publish basic project and utility-capacity information.",
			provenance: candidateSubmitted("Submitted through the District 12 comparison questionnaire.", "2026-03-26T15:30:00.000Z"),
			responseStatus: "answered",
			sources: [stateQuestionnaire, districtEthics]
		}),
		questionnaireResponse({
			...stateSenateDistrict12Questions.schoolStaffing,
			answerText: null,
			provenance: unclear("Question sent to all District 12 candidates. No response was received on this item as of 2026-03-31.", "2026-03-31T10:00:00.000Z"),
			responseStatus: "no-response",
			sources: [stateQuestionnaire]
		})
	]
});

const aliciaGreeneComparison = comparisonProfile({
	ballotName: "Alicia Greene",
	displayName: "Alicia Greene",
	ballotOrder: 1,
	partyOnBallot: "Nonpartisan",
	campaignWebsiteUrl: "https://greeneforschools.example",
	contactChannels: [
		link("Campaign website", "https://greeneforschools.example"),
		link("Board priorities", "https://greeneforschools.example/priorities")
	],
	ballotStatus: {
		asOf: "2026-03-31T10:00:00.000Z",
		label: "On ballot (verified)",
		provenance: verifiedOfficial("Confirmed from the Metro County official candidate list.", "2026-03-31T10:00:00.000Z"),
		sources: [officialCandidateList],
		status: "on-ballot-verified"
	},
	whyRunning: comparableStatement(
		"greene-why-running",
		"I am running to keep literacy recovery and attendance work on a steady track while protecting the district from budget decisions that move faster than staffing capacity.",
		[schoolQuestionnaire, schoolLiteracyReport],
		candidateSubmitted("Submitted through the school board comparison questionnaire.", "2026-03-23T11:45:00.000Z")
	),
	topPriorities: [
		comparableStatement(
			"greene-priority-1",
			"Continue literacy recovery with campus capacity checks.",
			[schoolQuestionnaire, schoolLiteracyReport],
			candidateSubmitted("Priority list supplied through the school board comparison questionnaire.", "2026-03-23T11:45:00.000Z")
		),
		comparableStatement(
			"greene-priority-2",
			"Support attendance recovery before new districtwide launches.",
			[schoolQuestionnaire, schoolLiteracyReport],
			candidateSubmitted("Priority list supplied through the school board comparison questionnaire.", "2026-03-23T11:45:00.000Z")
		),
		comparableStatement(
			"greene-priority-3",
			"Keep long-term budgeting tied to updated projections.",
			[schoolQuestionnaire, schoolBudgetMinutes],
			candidateSubmitted("Priority list supplied through the school board comparison questionnaire.", "2026-03-23T11:45:00.000Z")
		)
	],
	questionnaireResponses: [
		questionnaireResponse({
			...schoolBoardQuestions.tutoringTransparency,
			answerReceivedAt: "2026-03-23T11:45:00.000Z",
			answerText: "Yes, if the dashboard is paired with context on staffing, reading growth, and attendance so campuses are not reduced to a single tutoring number.",
			provenance: candidateSubmitted("Submitted through the school board comparison questionnaire.", "2026-03-23T11:45:00.000Z"),
			responseStatus: "answered",
			sources: [schoolQuestionnaire, schoolLiteracyReport]
		}),
		questionnaireResponse({
			...schoolBoardQuestions.facilitiesTiming,
			answerReceivedAt: "2026-03-23T11:45:00.000Z",
			answerText: "Facilities work should be phased behind updated enrollment and maintenance projections so the board does not crowd out recurring staffing costs with one-time project timelines.",
			provenance: candidateSubmitted("Submitted through the school board comparison questionnaire.", "2026-03-23T11:45:00.000Z"),
			responseStatus: "answered",
			sources: [schoolQuestionnaire, schoolBudgetMinutes]
		}),
		questionnaireResponse({
			...schoolBoardQuestions.literacyRollout,
			answerReceivedAt: "2026-03-23T11:45:00.000Z",
			answerText: "Expand literacy interventions in phases, starting where staffing and attendance supports are strong enough to make the program sustainable.",
			provenance: candidateSubmitted("Submitted through the school board comparison questionnaire.", "2026-03-23T11:45:00.000Z"),
			responseStatus: "answered",
			sources: [schoolQuestionnaire, schoolLiteracyReport]
		})
	]
});

const marcusHillComparison = comparisonProfile({
	ballotName: "Marcus Hill",
	displayName: "Marcus Hill",
	ballotOrder: 2,
	partyOnBallot: "Nonpartisan",
	campaignWebsiteUrl: "https://hillforschools.example",
	contactChannels: [
		link("Campaign website", "https://hillforschools.example"),
		link("Family support plan", "https://hillforschools.example/families")
	],
	ballotStatus: {
		asOf: "2026-03-31T10:00:00.000Z",
		label: "On ballot (verified)",
		provenance: verifiedOfficial("Confirmed from the Metro County official candidate list.", "2026-03-31T10:00:00.000Z"),
		sources: [officialCandidateList],
		status: "on-ballot-verified"
	},
	whyRunning: comparableStatement(
		"hill-why-running",
		"I am running because families should be able to see whether tutoring, communication, and student-support systems are reaching the campuses that need them most.",
		[schoolQuestionnaire, schoolLiteracyReport],
		candidateSubmitted("Submitted through the school board comparison questionnaire.", "2026-03-23T10:20:00.000Z")
	),
	topPriorities: [
		comparableStatement(
			"hill-priority-1",
			"Publish family-facing tutoring and attendance dashboards.",
			[schoolQuestionnaire, schoolLiteracyReport],
			candidateSubmitted("Priority list supplied through the school board comparison questionnaire.", "2026-03-23T10:20:00.000Z")
		),
		comparableStatement(
			"hill-priority-2",
			"Expand campus tutoring access where gaps are widest.",
			[schoolQuestionnaire, schoolLiteracyReport],
			candidateSubmitted("Priority list supplied through the school board comparison questionnaire.", "2026-03-23T10:20:00.000Z")
		),
		comparableStatement(
			"hill-priority-3",
			"Improve school-to-family response timelines.",
			[schoolQuestionnaire, methodologyBrief],
			candidateSubmitted("Priority list supplied through the school board comparison questionnaire.", "2026-03-23T10:20:00.000Z")
		)
	],
	questionnaireResponses: [
		questionnaireResponse({
			...schoolBoardQuestions.tutoringTransparency,
			answerReceivedAt: "2026-03-23T10:20:00.000Z",
			answerText: "Yes. Families should be able to see tutoring seats, attendance recovery, and response times by campus in a format that does not require reading board packets.",
			provenance: candidateSubmitted("Submitted through the school board comparison questionnaire.", "2026-03-23T10:20:00.000Z"),
			responseStatus: "answered",
			sources: [schoolQuestionnaire, schoolLiteracyReport]
		}),
		questionnaireResponse({
			...schoolBoardQuestions.facilitiesTiming,
			answerReceivedAt: "2026-03-23T10:20:00.000Z",
			answerText: "The board should publish clearer tradeoffs when one-time facilities work competes with recurring program costs, and it should explain which projects can wait and which cannot.",
			provenance: candidateSubmitted("Submitted through the school board comparison questionnaire.", "2026-03-23T10:20:00.000Z"),
			responseStatus: "answered",
			sources: [schoolQuestionnaire, methodologyBrief]
		}),
		questionnaireResponse({
			...schoolBoardQuestions.literacyRollout,
			answerReceivedAt: "2026-03-23T10:20:00.000Z",
			answerText: "Expand literacy help where tutoring and family navigation can reinforce it quickly, then publish what is working before scaling districtwide.",
			provenance: candidateSubmitted("Submitted through the school board comparison questionnaire.", "2026-03-23T10:20:00.000Z"),
			responseStatus: "answered",
			sources: [schoolQuestionnaire, schoolLiteracyReport]
		})
	]
});

const sandraPatelComparison = comparisonProfile({
	ballotName: "Sandra Patel",
	displayName: "Sandra Patel",
	ballotOrder: 3,
	partyOnBallot: "Nonpartisan",
	campaignWebsiteUrl: "https://patelforschools.example",
	contactChannels: [
		link("Campaign website", "https://patelforschools.example"),
		link("Budget oversight memo", "https://patelforschools.example/budget")
	],
	ballotStatus: {
		asOf: "2026-03-31T10:00:00.000Z",
		label: "On ballot (verified)",
		provenance: verifiedOfficial("Confirmed from the Metro County official candidate list.", "2026-03-31T10:00:00.000Z"),
		sources: [officialCandidateList],
		status: "on-ballot-verified"
	},
	whyRunning: comparableStatement(
		"patel-why-running",
		"I am running because district budget documents should make it easier for families to see how reserve policy, facilities timing, and recurring classroom costs fit together.",
		[schoolQuestionnaire, schoolBudgetMinutes],
		candidateSubmitted("Submitted through the school board comparison questionnaire.", "2026-03-23T09:35:00.000Z")
	),
	topPriorities: [
		comparableStatement(
			"patel-priority-1",
			"Clarify reserve policy and one-time spending rules.",
			[schoolQuestionnaire, schoolBudgetMinutes],
			candidateSubmitted("Priority list supplied through the school board comparison questionnaire.", "2026-03-23T09:35:00.000Z")
		),
		comparableStatement(
			"patel-priority-2",
			"Publish long-range facilities sequencing more clearly.",
			[schoolQuestionnaire, schoolBudgetMinutes],
			candidateSubmitted("Priority list supplied through the school board comparison questionnaire.", "2026-03-23T09:35:00.000Z")
		),
		comparableStatement(
			"patel-priority-3",
			"Improve procurement and budget presentation transparency.",
			[schoolQuestionnaire, schoolBudgetMinutes],
			candidateSubmitted("Priority list supplied through the school board comparison questionnaire.", "2026-03-23T09:35:00.000Z")
		)
	],
	questionnaireResponses: [
		questionnaireResponse({
			...schoolBoardQuestions.tutoringTransparency,
			answerText: null,
			provenance: unclear("Question sent to all school board candidates. No response was received on this item as of 2026-03-31.", "2026-03-31T10:00:00.000Z"),
			responseStatus: "no-response",
			sources: [schoolQuestionnaire]
		}),
		questionnaireResponse({
			...schoolBoardQuestions.facilitiesTiming,
			answerReceivedAt: "2026-03-23T09:35:00.000Z",
			answerText: "The board should publish a clearer reserve trigger before approving facilities packages that could pressure recurring staffing or classroom lines in later budgets.",
			provenance: candidateSubmitted("Submitted through the school board comparison questionnaire.", "2026-03-23T09:35:00.000Z"),
			responseStatus: "answered",
			sources: [schoolQuestionnaire, schoolBudgetMinutes]
		}),
		questionnaireResponse({
			...schoolBoardQuestions.literacyRollout,
			answerReceivedAt: "2026-03-23T09:35:00.000Z",
			answerText: "Literacy expansion should move forward alongside a budget plan that distinguishes recurring classroom commitments from one-time implementation expenses.",
			provenance: candidateSubmitted("Submitted through the school board comparison questionnaire.", "2026-03-23T09:35:00.000Z"),
			responseStatus: "answered",
			sources: [schoolQuestionnaire, schoolBudgetMinutes]
		})
	]
});

const candidates: Candidate[] = [
	{
		slug: "elena-torres",
		name: "Elena Torres",
		officeSought: "U.S. House, District 7",
		contestSlug: "us-house-district-7",
		party: "Democratic Party",
		incumbent: false,
		location: "Metro County, Franklin",
		summary: "Elena Torres is a first-time federal candidate running on transportation reliability, clinic access, and neighborhood infrastructure. The demo record shows a policy-heavy campaign style with detailed platform documents and a mid-sized professional donor base.",
		ballotSummary: "Former transit authority counsel and city housing commission chair. Emphasizes commuter reliability, flood resilience, and neighborhood clinics.",
		topIssues: [
			{ slug: "transit", label: "Transit reliability" },
			{ slug: "flood-resilience", label: "Flood resilience" },
			{ slug: "health-access", label: "Clinic access" }
		],
		biography: [
			{
				id: "torres-bio-1",
				title: "Transit and housing background",
				summary: "Torres served as general counsel for the region's transit authority and later chaired the Harbor City Housing Commission. Her public resume emphasizes procurement oversight and affordable housing compliance work.",
				sources: [torresPolicy, metroGuide]
			},
			{
				id: "torres-bio-2",
				title: "Public-facing biography",
				summary: "In civic questionnaires and campaign materials, she describes herself as a coalition builder with experience across city departments and neighborhood associations.",
				sources: [schoolQuestionnaire, methodologyBrief]
			}
		],
		keyActions: [
			{
				id: "torres-action-1",
				title: "Published district infrastructure outline",
				date: "2026-02-14",
				summary: "Released a district outline proposing sidewalk repairs near three bus corridors and a clinic-access permitting track for two rural towns.",
				significance: "Shows the policy areas she has chosen to foreground before holding office.",
				sources: [torresPolicy, metroGuide]
			},
			{
				id: "torres-action-2",
				title: "Detailed funding approach for local projects",
				date: "2026-03-05",
				summary: "Outlined a pay-for plan pairing grant applications with phased local matching funds and said she would oppose a district-only sales tax for the transit package.",
				significance: "Provides a source-backed statement on fiscal approach rather than a campaign slogan.",
				sources: [torresPolicy, methodologyBrief]
			}
		],
		funding: {
			totalRaised: 1285000,
			cashOnHand: 742000,
			smallDonorShare: 0.39,
			summary: "Most reported money came from legal, transportation, and health-sector contributors, with a moderate small-donor share for a first-time federal candidate.",
			topFunders: [
				{ name: "Regional Transit Workers PAC", amount: 54000, category: "Labor and transit advocacy" },
				{ name: "Clinic Access Fund", amount: 32000, category: "Health policy donors" },
				{ name: "Harbor Legal Network", amount: 26000, category: "Individual attorneys" }
			],
			sources: [torresFec, methodologyBrief]
		},
		lobbyingContext: [
			{
				id: "torres-lobby-1",
				title: "Donor-sector overlap",
				summary: "No registered lobbyist employer appears in the current filing. Several donors work in transportation consulting and land-use law, which are sectors with exposure to federal grants and permitting.",
				sources: [torresFec, districtEthics]
			}
		],
		publicStatements: [
			{
				id: "torres-statement-1",
				title: "Transportation and access framing",
				summary: "Torres says commute time and clinic access are linked because unreliable transportation makes it harder to keep appointments and reach shift-based work.",
				sources: [torresPolicy, metroGuide]
			},
			{
				id: "torres-statement-2",
				title: "Housing position in questionnaire",
				summary: "On housing, she has said federal aid should prioritize flood-prone rental areas before expanding tax incentives for market-rate redevelopment.",
				sources: [schoolQuestionnaire, methodologyBrief]
			}
		],
		alignmentModule: {
			status: "not-live",
			summary: "A constituent-alignment view is planned but not yet live in this MVP. The future version would compare district concerns with public records without turning that into a score.",
			considerations: [
				"A future alignment module would compare district-level issue priorities with vote records and stated positions.",
				"It would not rank candidates or recommend a vote.",
				"It would need district survey data and transparent weighting rules before publication."
			]
		},
		freshness: freshnessMeta({
			contentLastVerifiedAt: "2026-03-30T14:00:00.000Z",
			dataLastUpdatedAt: "2026-03-30T14:00:00.000Z",
			nextReviewAt: "2026-04-13T14:00:00.000Z",
			status: "up-to-date",
			statusLabel: "Up to date",
			statusNote: "Campaign filing, questionnaire, and policy memo records in the demo archive were reviewed together for this profile."
		}),
		whatWeKnow: [
			trustBullet("torres-know-1", "Her public platform is unusually detailed for a first-time congressional candidate in this mock race.", [torresPolicy, federalQuestionnaire]),
			trustBullet("torres-know-2", "The available filing shows a donor base that is broader than one employer or single industry.", [torresFec, methodologyBrief])
		],
		whatWeDoNotKnow: [
			trustBullet("torres-unknown-1", "No independent expenditure activity is included in this demo beyond the candidate committee filing.", [torresFec, methodologyBrief], "Outside spending can change quickly and should be checked in the original filing systems."),
			trustBullet("torres-unknown-2", "The demo record does not include internal polling or unpublished district outreach plans.", [methodologyBrief], "This page only uses published or source-linked records in the demo archive.")
		],
		methodologyNotes: [
			"Federal race summaries use campaign filings, questionnaires, and public policy memos included in the demo dataset.",
			"This profile does not include tax returns, private meetings, or unpublished donor communications."
		],
		comparison: elenaTorresComparison,
		sources: uniqueSources([officialCandidateList, federalQuestionnaire, torresFec, torresPolicy, metroGuide, methodologyBrief, districtEthics]),
		updatedAt: "2026-03-30T14:00:00.000Z"
	},
	{
		slug: "daniel-brooks",
		name: "Daniel Brooks",
		officeSought: "U.S. House, District 7",
		contestSlug: "us-house-district-7",
		party: "Republican Party",
		incumbent: true,
		location: "Metro County, Franklin",
		summary: "Daniel Brooks is the incumbent representative for District 7. The demo record shows a campaign centered on infrastructure continuity and access to federal logistics funding, alongside the broader donor support typical of an incumbent.",
		ballotSummary: "Two-term incumbent focused on port logistics, flood-control grants, and small-business lending. Campaign emphasizes committee access and constituent casework.",
		topIssues: [
			{ slug: "jobs-logistics", label: "Port logistics" },
			{ slug: "flood-resilience", label: "Flood control" },
			{ slug: "small-business", label: "Small-business credit" }
		],
		biography: [
			{
				id: "brooks-bio-1",
				title: "Local-to-federal career path",
				summary: "Brooks previously served on the Metro County Board of Supervisors before winning this congressional seat in 2022. His public profile highlights constituent services and federal grant navigation.",
				sources: [metroGuide, brooksVotes]
			},
			{
				id: "brooks-bio-2",
				title: "Campaign positioning",
				summary: "Current campaign materials present him as a continuity candidate with existing committee relationships and an emphasis on logistics and port jobs.",
				sources: [brooksFec, methodologyBrief]
			}
		],
		keyActions: [
			{
				id: "brooks-action-1",
				title: "Supported freight corridor package",
				date: "2025-11-18",
				summary: "Voted for a freight corridor package that included port-access road grants and warehouse electrification funds for midsize shipping hubs.",
				significance: "Illustrates a substantive vote connected to district freight and infrastructure priorities.",
				sources: [brooksVotes, metroGuide]
			},
			{
				id: "brooks-action-2",
				title: "Opposed stopgap budget measure",
				date: "2026-01-22",
				summary: "Opposed a short-term continuing resolution after saying it underfunded flood-mitigation programs and relied too heavily on temporary extensions.",
				significance: "Shows a notable vote where local officials argued the district would lose short-term support.",
				sources: [brooksVotes, methodologyBrief]
			}
		],
		funding: {
			totalRaised: 1935000,
			cashOnHand: 1180000,
			smallDonorShare: 0.22,
			summary: "Brooks reports a larger war chest than his challenger, with a donor mix tilted toward trade, shipping, finance, and incumbent-support committees.",
			topFunders: [
				{ name: "Atlantic Port Growth PAC", amount: 78000, category: "Trade and logistics" },
				{ name: "District Business Roundtable", amount: 51000, category: "Financial services" },
				{ name: "House Leadership Action Fund", amount: 34000, category: "Incumbent support committee" }
			],
			sources: [brooksFec, methodologyBrief]
		},
		lobbyingContext: [
			{
				id: "brooks-lobby-1",
				title: "Sector concentration in donations",
				summary: "Shipping, insurance, and business-association donors appear frequently in reported contributions. That pattern is common for incumbents with committee relevance to freight and coastal resilience.",
				sources: [brooksFec, districtEthics]
			}
		],
		publicStatements: [
			{
				id: "brooks-statement-1",
				title: "Port modernization emphasis",
				summary: "Brooks says port modernization is the district's strongest route to wage growth and has argued that environmental standards should be phased in around equipment replacement cycles.",
				sources: [metroGuide, brooksVotes]
			},
			{
				id: "brooks-statement-2",
				title: "Flood-mitigation priority",
				summary: "He has said flood-mitigation money should favor hard infrastructure before relocation assistance, arguing that homeowners want faster project delivery.",
				sources: [brooksVotes, methodologyBrief]
			}
		],
		alignmentModule: {
			status: "not-live",
			summary: "Future alignment work would compare Brooks' record with district concerns and explain the tradeoffs in the bills he supported or opposed.",
			considerations: [
				"A future alignment model would need a transparent method for weighing committee work, final votes, and district priorities.",
				"Incumbents require more historical data than challengers, which may make comparisons uneven if not explained well."
			]
		},
		freshness: freshnessMeta({
			contentLastVerifiedAt: "2026-03-30T14:00:00.000Z",
			dataLastUpdatedAt: "2026-03-30T14:00:00.000Z",
			nextReviewAt: "2026-04-13T14:00:00.000Z",
			status: "up-to-date",
			statusLabel: "Up to date",
			statusNote: "The incumbent record combines the latest demo filing, questionnaire, and congressional-record extract attached to this page."
		}),
		whatWeKnow: [
			trustBullet("brooks-know-1", "The available record shows larger fundraising capacity and a clearer incumbent advantage in committee-linked donor networks.", [brooksFec, methodologyBrief]),
			trustBullet("brooks-know-2", "He has a vote record that can be inspected directly in ways challenger campaigns cannot match.", [brooksVotes, metroGuide])
		],
		whatWeDoNotKnow: [
			trustBullet("brooks-unknown-1", "The demo does not include private constituent casework records or confidential committee negotiations.", [brooksVotes, methodologyBrief], "This profile is limited to public-facing records and selected official actions."),
			trustBullet("brooks-unknown-2", "Outside group advertising is not tracked beyond the simplified filing summary.", [brooksFec, methodologyBrief], "Independent expenditures should be checked directly in original campaign-finance systems.")
		],
		methodologyNotes: [
			"Incumbent vote summaries are drawn from the demo congressional record extract and limited to items selected for district relevance.",
			"Committee negotiations and informal amendments are not fully visible in this MVP."
		],
		comparison: danielBrooksComparison,
		sources: uniqueSources([officialCandidateList, federalQuestionnaire, brooksFec, brooksVotes, metroGuide, methodologyBrief, districtEthics]),
		updatedAt: "2026-03-30T14:00:00.000Z"
	},
	{
		slug: "naomi-park",
		name: "Naomi Park",
		officeSought: "State Senate, District 12",
		contestSlug: "state-senate-district-12",
		party: "Democratic Party",
		incumbent: false,
		location: "Metro County, Franklin",
		summary: "Naomi Park is a challenger in the District 12 state senate race. The demo record shows a platform focused on housing stability and groundwater reporting, with more of her public record coming from local office actions than statewide legislative votes.",
		ballotSummary: "Former county public defender and current town councilmember. Campaign centers on housing affordability, groundwater oversight, and school staffing.",
		topIssues: [
			{ slug: "housing", label: "Housing affordability" },
			{ slug: "water", label: "Groundwater oversight" },
			{ slug: "education", label: "School staffing" }
		],
		biography: [
			{
				id: "park-bio-1",
				title: "Legal aid and local government background",
				summary: "Park is a current town councilmember and former public defender. Her public bio emphasizes legal aid, eviction prevention clinics, and local land-use work.",
				sources: [parkHousing, metroGuide]
			},
			{
				id: "park-bio-2",
				title: "Reason for running",
				summary: "In civic questionnaires she describes district growth management as her main reason for running for the state senate seat.",
				sources: [schoolQuestionnaire, methodologyBrief]
			}
		],
		keyActions: [
			{
				id: "park-action-1",
				title: "Advanced rental notice ordinance at council level",
				date: "2026-02-02",
				summary: "Led a council work session that expanded legal-notice requirements for large apartment rent increases and asked staff for a landlord-repair compliance dashboard.",
				significance: "Shows local-government action tied to her housing message.",
				sources: [parkHousing, metroGuide]
			},
			{
				id: "park-action-2",
				title: "Outlined groundwater reporting proposal",
				date: "2026-03-08",
				summary: "Released a proposal calling for annual groundwater reporting by basin and a pause on new high-volume permits until the district publishes recharge estimates.",
				significance: "Provides a sourced example of how she frames water policy in a growth district.",
				sources: [parkHousing, methodologyBrief]
			}
		],
		funding: {
			totalRaised: 512000,
			cashOnHand: 318000,
			smallDonorShare: 0.44,
			summary: "Park reports a smaller overall fundraising total than the incumbent, with more small-dollar participation and several housing-advocacy donors.",
			topFunders: [
				{ name: "Homes First Network", amount: 18000, category: "Housing advocacy" },
				{ name: "Teachers for Franklin", amount: 14500, category: "Education donors" },
				{ name: "District 12 Civic Donors", amount: 12000, category: "Local professionals" }
			],
			sources: [districtEthics, methodologyBrief]
		},
		lobbyingContext: [
			{
				id: "park-lobby-1",
				title: "Support base in current disclosures",
				summary: "The disclosure record shows support from tenant advocates, teachers, and legal-aid donors. No major utility or extraction-industry PAC appears in the current mock filing.",
				sources: [districtEthics, methodologyBrief]
			}
		],
		publicStatements: [
			{
				id: "park-statement-1",
				title: "Housing position",
				summary: "Park says housing policy should focus first on vacancy, repair, and tenant stability before large tax incentives for new market-rate development.",
				sources: [parkHousing, schoolQuestionnaire]
			},
			{
				id: "park-statement-2",
				title: "Water transparency position",
				summary: "She describes groundwater data as a basic transparency issue and says permit decisions should be easier for residents to review.",
				sources: [parkHousing, methodologyBrief]
			}
		],
		alignmentModule: {
			status: "not-live",
			summary: "Any future constituent-alignment module would compare Park's public proposals with district concerns like rent pressure, groundwater management, and school staffing.",
			considerations: [
				"A future alignment model would need district survey data on water rates, housing costs, and school access to avoid oversimplifying a state race."
			]
		},
		freshness: freshnessMeta({
			contentLastVerifiedAt: "2026-03-29T17:15:00.000Z",
			dataLastUpdatedAt: "2026-03-29T17:15:00.000Z",
			nextReviewAt: "2026-04-12T17:15:00.000Z",
			status: "up-to-date",
			statusLabel: "Up to date",
			statusNote: "This challenger profile was reviewed against the latest local hearing notes, ethics digest, and candidate questionnaire in the demo archive."
		}),
		whatWeKnow: [
			trustBullet("park-know-1", "Her most visible public record comes from town-council work and legal aid advocacy.", [parkHousing, metroGuide]),
			trustBullet("park-know-2", "Her campaign is less funded than the incumbent but shows a higher share of small-dollar giving.", [districtEthics, methodologyBrief])
		],
		whatWeDoNotKnow: [
			trustBullet("park-unknown-1", "There is no statewide legislative record because Park is not currently in the senate.", [parkHousing, methodologyBrief], "This makes direct incumbent-style vote comparisons more limited."),
			trustBullet("park-unknown-2", "The demo does not include internal coalition agreements or draft bill language beyond the published summaries.", [stateQuestionnaire, methodologyBrief], "Only published hearing notes, disclosures, and questionnaire responses are attached here.")
		],
		methodologyNotes: [
			"State race summaries combine local office actions, hearing testimony, and ethics disclosures included in the demo archive.",
			"No closed-door caucus negotiations or unreleased fiscal estimates are reflected here."
		],
		comparison: naomiParkComparison,
		sources: uniqueSources([officialCandidateList, stateQuestionnaire, parkHousing, districtEthics, metroGuide, schoolQuestionnaire, methodologyBrief]),
		updatedAt: "2026-03-29T17:15:00.000Z"
	},
	{
		slug: "thomas-bell",
		name: "Thomas Bell",
		officeSought: "State Senate, District 12",
		contestSlug: "state-senate-district-12",
		party: "Republican Party",
		incumbent: true,
		location: "Metro County, Franklin",
		summary: "Thomas Bell is the incumbent state senator for District 12. In this demo record, his campaign relies on a visible legislative history in water and infrastructure policy, alongside fundraising tied more heavily to utilities and development interests.",
		ballotSummary: "Incumbent state senator focused on water reliability, road capacity, and apprenticeship programs. Campaign stresses committee experience and budget negotiations.",
		topIssues: [
			{ slug: "water", label: "Water reliability" },
			{ slug: "transportation", label: "Road capacity" },
			{ slug: "workforce", label: "Workforce training" }
		],
		biography: [
			{
				id: "bell-bio-1",
				title: "Planning and legislative background",
				summary: "Bell previously served on the county planning commission and has represented District 12 in the state senate since 2020.",
				sources: [bellWaterBill, metroGuide]
			},
			{
				id: "bell-bio-2",
				title: "Current campaign framing",
				summary: "His campaign messaging presents him as a manager of growth pressures who can negotiate statewide budget items for a fast-growing district.",
				sources: [districtEthics, methodologyBrief]
			}
		],
		keyActions: [
			{
				id: "bell-action-1",
				title: "Sponsored water reliability bill",
				date: "2025-09-09",
				summary: "Sponsored a water reliability bill that expanded regional storage grants and required annual leak-loss reporting by local utilities.",
				significance: "Reflects a core policy area he points to in campaign material.",
				sources: [bellWaterBill, metroGuide]
			},
			{
				id: "bell-action-2",
				title: "Negotiated apprenticeship funding amendment",
				date: "2026-02-18",
				summary: "Helped negotiate a budget amendment creating additional apprenticeship seats tied to road and water infrastructure projects.",
				significance: "Shows his approach to workforce policy and capital budgeting.",
				sources: [bellWaterBill, methodologyBrief]
			}
		],
		funding: {
			totalRaised: 948000,
			cashOnHand: 604000,
			smallDonorShare: 0.18,
			summary: "Bell reports more overall money than his challenger, with donor support concentrated in utilities, real estate, and statewide business committees.",
			topFunders: [
				{ name: "Franklin Water and Power PAC", amount: 30000, category: "Utilities" },
				{ name: "District Growth Coalition", amount: 24000, category: "Real estate" },
				{ name: "Franklin Jobs Committee", amount: 18000, category: "Business association" }
			],
			sources: [districtEthics, methodologyBrief]
		},
		lobbyingContext: [
			{
				id: "bell-lobby-1",
				title: "Donor sectors linked to growth policy",
				summary: "Utility, real-estate, and business donors are prominent in the disclosure file. That pattern overlaps with committees affected by district growth and infrastructure policy.",
				sources: [districtEthics, bellWaterBill]
			}
		],
		publicStatements: [
			{
				id: "bell-statement-1",
				title: "Water capacity framing",
				summary: "Bell says the district needs faster water-infrastructure financing before it adds new statewide permit layers, arguing that shortages are mostly a capacity problem.",
				sources: [bellWaterBill, metroGuide]
			},
			{
				id: "bell-statement-2",
				title: "Housing regulation position",
				summary: "On housing, he has said the state should reduce permitting timelines before expanding tenant-protection mandates.",
				sources: [districtEthics, methodologyBrief]
			}
		],
		alignmentModule: {
			status: "not-live",
			summary: "Future alignment analysis would compare Bell's legislative record with district preferences on growth, water costs, and school construction.",
			considerations: [
				"A future alignment module would need to explain when a legislator voted for compromise language rather than a first-choice bill."
			]
		},
		freshness: freshnessMeta({
			contentLastVerifiedAt: "2026-03-29T17:15:00.000Z",
			dataLastUpdatedAt: "2026-03-29T17:15:00.000Z",
			nextReviewAt: "2026-04-12T17:15:00.000Z",
			status: "up-to-date",
			statusLabel: "Up to date",
			statusNote: "This legislative profile reflects the latest demo senate-bill summary, disclosure digest, and questionnaire submission attached here."
		}),
		whatWeKnow: [
			trustBullet("bell-know-1", "Bell has a documented legislative record on water and workforce policy.", [bellWaterBill, metroGuide]),
			trustBullet("bell-know-2", "His funding profile shows stronger support from utility and development sectors than his challenger.", [districtEthics, methodologyBrief])
		],
		whatWeDoNotKnow: [
			trustBullet("bell-unknown-1", "The demo record does not include caucus-level strategy discussions or constituent emails.", [bellWaterBill, methodologyBrief], "Only public-facing legislative and filing records are modeled."),
			trustBullet("bell-unknown-2", "Independent expenditures and dark-money spending are not fully modeled in this MVP.", [districtEthics, methodologyBrief], "Use original state and federal filing systems for broader spending context.")
		],
		methodologyNotes: [
			"Legislative summaries rely on the demo senate bill summary, ethics disclosure digest, and a simplified election guide.",
			"This record does not show constituent service requests or unpublished amendment drafts."
		],
		comparison: thomasBellComparison,
		sources: uniqueSources([officialCandidateList, stateQuestionnaire, bellWaterBill, districtEthics, metroGuide, methodologyBrief]),
		updatedAt: "2026-03-29T17:15:00.000Z"
	},
	{
		slug: "alicia-greene",
		name: "Alicia Greene",
		officeSought: "Metro County School Board At-Large",
		contestSlug: "county-school-board-at-large",
		party: "Nonpartisan",
		incumbent: true,
		location: "Metro County, Franklin",
		summary: "Alicia Greene is the current board president and is running on continuity in literacy recovery, attendance improvement, and budget pacing. The demo record includes a visible board voting history and a local donor base.",
		ballotSummary: "Current board president. Focuses on literacy recovery, attendance, and stable long-term budgeting.",
		topIssues: [
			{ slug: "education", label: "Reading recovery" },
			{ slug: "attendance", label: "Attendance" },
			{ slug: "budget", label: "Budget stability" }
		],
		biography: [
			{
				id: "greene-bio-1",
				title: "School administration background",
				summary: "Greene is the current board president and a former elementary principal. Her public record in the demo centers on curriculum rollouts, attendance recovery, and budget sequencing.",
				sources: [schoolBudgetMinutes, schoolLiteracyReport]
			}
		],
		keyActions: [
			{
				id: "greene-action-1",
				title: "Supported phased literacy rollout",
				date: "2025-12-10",
				summary: "Backed a phased reading-intervention expansion rather than a districtwide one-year rollout, citing staffing constraints and uneven campus readiness.",
				significance: "Shows how the incumbent has approached board governance and budget timing.",
				sources: [schoolBudgetMinutes, schoolLiteracyReport]
			},
			{
				id: "greene-action-2",
				title: "Delayed facilities package pending updated projections",
				date: "2026-02-11",
				summary: "Voted to delay a non-urgent facilities package until the district published updated enrollment and maintenance projections.",
				significance: "Provides a concrete example of board-level budget decision-making.",
				sources: [schoolBudgetMinutes, methodologyBrief]
			}
		],
		funding: {
			totalRaised: 46800,
			cashOnHand: 28000,
			smallDonorShare: 0.61,
			summary: "Greene reports a small, mostly local donor base with support from educators, PTA leaders, and former district staff.",
			topFunders: [
				{ name: "Metro Educators Circle", amount: 2500, category: "Education professionals" },
				{ name: "Northside Parent Committee", amount: 1800, category: "PTA leaders" },
				{ name: "Local classroom supporters", amount: 1400, category: "Individual donors" }
			],
			sources: [schoolQuestionnaire, methodologyBrief]
		},
		lobbyingContext: [
			{
				id: "greene-lobby-1",
				title: "Small local donor base",
				summary: "The demo filing shows mostly individual and local civic-group support. No major vendor donations appear in the simplified record.",
				sources: [schoolQuestionnaire, methodologyBrief]
			}
		],
		publicStatements: [
			{
				id: "greene-statement-1",
				title: "Literacy implementation approach",
				summary: "Greene says the board should evaluate literacy investments by campus staffing stability and year-over-year reading growth, not only by adoption speed.",
				sources: [schoolQuestionnaire, schoolLiteracyReport]
			}
		],
		alignmentModule: {
			status: "not-live",
			summary: "Future alignment work would compare school board candidates against district parent concerns like literacy growth, staffing, and campus climate without producing a score.",
			considerations: [
				"A future alignment view would need student outcome and family survey data before drawing any district-level comparison."
			]
		},
		freshness: freshnessMeta({
			contentLastVerifiedAt: "2026-03-28T18:00:00.000Z",
			dataLastUpdatedAt: "2026-03-28T18:00:00.000Z",
			nextReviewAt: "2026-04-11T18:00:00.000Z",
			status: "up-to-date",
			statusLabel: "Up to date",
			statusNote: "This local profile was reviewed against the latest board minutes, district report, and questionnaire response in the demo archive."
		}),
		whatWeKnow: [
			trustBullet("greene-know-1", "Greene has the clearest public vote history in this local race.", [schoolBudgetMinutes, schoolQuestionnaire]),
			trustBullet("greene-know-2", "Her campaign materials focus on slower, capacity-aware implementation rather than large one-year changes.", [schoolQuestionnaire, schoolLiteracyReport])
		],
		whatWeDoNotKnow: [
			trustBullet("greene-unknown-1", "Closed-session personnel discussions are not public and are not reflected here.", [schoolBudgetMinutes, methodologyBrief], "This is a common limit in local school-board records."),
			trustBullet("greene-unknown-2", "The demo does not include teacher-union endorsements beyond the simplified questionnaire record.", [schoolQuestionnaire, methodologyBrief], "Only the published demo questionnaire and public records are attached.")
		],
		methodologyNotes: [
			"Local race summaries use meeting minutes, district reports, and candidate questionnaires included in the public demo files.",
			"This record does not include closed-session personnel matters or student-level data."
		],
		comparison: aliciaGreeneComparison,
		sources: uniqueSources([officialCandidateList, schoolBudgetMinutes, schoolLiteracyReport, schoolQuestionnaire, methodologyBrief]),
		updatedAt: "2026-03-28T18:00:00.000Z"
	},
	{
		slug: "marcus-hill",
		name: "Marcus Hill",
		officeSought: "Metro County School Board At-Large",
		contestSlug: "county-school-board-at-large",
		party: "Nonpartisan",
		incumbent: false,
		location: "Metro County, Franklin",
		summary: "Marcus Hill is a non-incumbent school board candidate focused on tutoring access and parent-facing transparency. The demo record for him relies more on proposals and questionnaires than governing votes.",
		ballotSummary: "Former parent advisory council chair. Focuses on tutoring access, district dashboards, and school-to-family communication.",
		topIssues: [
			{ slug: "education", label: "Tutoring access" },
			{ slug: "family-support", label: "Family communication" },
			{ slug: "transparency", label: "Transparency dashboards" }
		],
		biography: [
			{
				id: "hill-bio-1",
				title: "Parent advisory and mentoring background",
				summary: "Hill led the districtwide parent advisory council for two years and has worked in nonprofit youth mentoring. His public materials emphasize family navigation and after-school supports.",
				sources: [schoolQuestionnaire, metroGuide]
			}
		],
		keyActions: [
			{
				id: "hill-action-1",
				title: "Proposed public-facing district dashboard",
				date: "2026-01-16",
				summary: "Published a mock district dashboard that would track tutoring seats, attendance recovery, and family-response times by campus.",
				significance: "Shows a concrete proposal rather than campaign language alone.",
				sources: [schoolQuestionnaire, schoolLiteracyReport]
			}
		],
		funding: {
			totalRaised: 29100,
			cashOnHand: 17300,
			smallDonorShare: 0.72,
			summary: "Hill reports the smallest fundraising total in the race, with a highly local donor base and a strong small-dollar share.",
			topFunders: [
				{ name: "Eastside Family Network", amount: 1200, category: "Parent supporters" },
				{ name: "After-School Access Circle", amount: 1100, category: "Youth mentoring supporters" },
				{ name: "Parent small donors", amount: 900, category: "Individual donors" }
			],
			sources: [schoolQuestionnaire, methodologyBrief]
		},
		lobbyingContext: [
			{
				id: "hill-lobby-1",
				title: "Minimal institutional donor footprint",
				summary: "The demo filings show mostly individual donors and no notable vendor or labor committee presence.",
				sources: [schoolQuestionnaire, methodologyBrief]
			}
		],
		publicStatements: [
			{
				id: "hill-statement-1",
				title: "Transparency and tutoring focus",
				summary: "Hill says families should be able to see whether tutoring slots are reaching the campuses with the largest reading gaps and attendance declines.",
				sources: [schoolQuestionnaire, schoolLiteracyReport]
			}
		],
		alignmentModule: {
			status: "not-live",
			summary: "Future alignment work would compare Hill's student-services proposals with district concerns around attendance, tutoring, and transparency without producing a score.",
			considerations: [
				"A future alignment module would need district family survey data and campus-level performance data before drawing a district-level comparison."
			]
		},
		freshness: freshnessMeta({
			contentLastVerifiedAt: "2026-03-28T18:00:00.000Z",
			dataLastUpdatedAt: "2026-03-28T18:00:00.000Z",
			nextReviewAt: "2026-04-11T18:00:00.000Z",
			status: "up-to-date",
			statusLabel: "Up to date",
			statusNote: "This challenger profile is based on the latest local questionnaire response and district literacy report in the demo archive."
		}),
		whatWeKnow: [
			trustBullet("hill-know-1", "His campaign message is focused on family-facing transparency tools and tutoring access.", [schoolQuestionnaire, schoolLiteracyReport]),
			trustBullet("hill-know-2", "His fundraising is modest and local compared with the rest of the field.", [schoolQuestionnaire, methodologyBrief])
		],
		whatWeDoNotKnow: [
			trustBullet("hill-unknown-1", "There is no school-board voting record because Hill has not held this office.", [schoolQuestionnaire, methodologyBrief], "This profile leans more heavily on published proposals than on governing record."),
			trustBullet("hill-unknown-2", "The demo does not include detailed position papers on facilities or procurement.", [schoolQuestionnaire, methodologyBrief], "Only source-linked questionnaire responses and public-facing statements are attached.")
		],
		methodologyNotes: [
			"Because Hill has not served on the board, this profile relies more heavily on published proposals and questionnaires than vote records."
		],
		comparison: marcusHillComparison,
		sources: uniqueSources([officialCandidateList, schoolQuestionnaire, schoolLiteracyReport, metroGuide, methodologyBrief]),
		updatedAt: "2026-03-28T18:00:00.000Z"
	},
	{
		slug: "sandra-patel",
		name: "Sandra Patel",
		officeSought: "Metro County School Board At-Large",
		contestSlug: "county-school-board-at-large",
		party: "Nonpartisan",
		incumbent: false,
		location: "Metro County, Franklin",
		summary: "Sandra Patel is a nonpartisan school board candidate emphasizing budget clarity, reserve policy, and long-range facilities planning. The demo record is strongest on fiscal process and lighter on classroom policy detail.",
		ballotSummary: "Former district budget analyst. Focuses on reserve policy, procurement clarity, and long-term facilities planning.",
		topIssues: [
			{ slug: "budget", label: "Budget oversight" },
			{ slug: "facilities", label: "Facilities planning" },
			{ slug: "transparency", label: "Procurement clarity" }
		],
		biography: [
			{
				id: "patel-bio-1",
				title: "Budget and oversight background",
				summary: "Patel previously worked as a district budget analyst and later served on the county library board. Her campaign emphasizes fiscal controls and project sequencing.",
				sources: [schoolBudgetMinutes, schoolQuestionnaire]
			}
		],
		keyActions: [
			{
				id: "patel-action-1",
				title: "Published reserve-policy memo",
				date: "2026-02-06",
				summary: "Released a reserve-policy memo recommending that the district publish a clearer trigger for using one-time funds on recurring staffing costs.",
				significance: "Illustrates her emphasis on financial process and reserve planning.",
				sources: [schoolBudgetMinutes, schoolQuestionnaire]
			}
		],
		funding: {
			totalRaised: 38200,
			cashOnHand: 25400,
			smallDonorShare: 0.47,
			summary: "Patel reports a mid-range fundraising total with support from local professionals, retired district staff, and civic donors focused on fiscal oversight.",
			topFunders: [
				{ name: "Metro Accountability Circle", amount: 1600, category: "Civic donors" },
				{ name: "Former Schools Finance Group", amount: 1400, category: "Retired district staff" },
				{ name: "Library board supporters", amount: 1200, category: "Individual donors" }
			],
			sources: [schoolQuestionnaire, methodologyBrief]
		},
		lobbyingContext: [
			{
				id: "patel-lobby-1",
				title: "Local professional donor profile",
				summary: "The simplified disclosure record shows local civic and professional donors. No major vendor contributions appear in the demo set.",
				sources: [schoolQuestionnaire, methodologyBrief]
			}
		],
		publicStatements: [
			{
				id: "patel-statement-1",
				title: "Budget clarity position",
				summary: "Patel says the district should separate one-time facilities commitments from recurring classroom spending more clearly in public presentations.",
				sources: [schoolQuestionnaire, schoolBudgetMinutes]
			}
		],
		alignmentModule: {
			status: "not-live",
			summary: "Future alignment analysis would compare Patel's budget-first approach with parent concerns about staffing, class size, and program stability.",
			considerations: [
				"Any future alignment work would need to account for Patel's district-budget expertise without implying that financial experience alone predicts policy outcomes."
			]
		},
		freshness: freshnessMeta({
			contentLastVerifiedAt: "2026-03-28T18:00:00.000Z",
			dataLastUpdatedAt: "2026-03-28T18:00:00.000Z",
			nextReviewAt: "2026-04-11T18:00:00.000Z",
			status: "up-to-date",
			statusLabel: "Up to date",
			statusNote: "This local candidate page was reviewed against the latest budget materials and questionnaire response in the demo archive."
		}),
		whatWeKnow: [
			trustBullet("patel-know-1", "Her public-facing material is the most budget-specific in the local field.", [schoolBudgetMinutes, schoolQuestionnaire]),
			trustBullet("patel-know-2", "Her donor base looks local and professional rather than institutional in the current demo file.", [schoolQuestionnaire, methodologyBrief])
		],
		whatWeDoNotKnow: [
			trustBullet("patel-unknown-1", "The demo does not include extensive public comments from teachers or principals responding to Patel's budget proposals.", [schoolBudgetMinutes, methodologyBrief], "This page reflects published budget documents, not private stakeholder feedback."),
			trustBullet("patel-unknown-2", "There is no school-board voting record because Patel is not an incumbent.", [schoolQuestionnaire, methodologyBrief], "Direct governing-record comparisons are limited for non-incumbents in this race.")
		],
		methodologyNotes: [
			"Patel's profile relies on questionnaire responses, public budget materials, and stated management proposals rather than elected-office votes."
		],
		comparison: sandraPatelComparison,
		sources: uniqueSources([officialCandidateList, schoolBudgetMinutes, schoolQuestionnaire, methodologyBrief]),
		updatedAt: "2026-03-28T18:00:00.000Z"
	}
];

const measures: Measure[] = [
	{
		slug: "measure-4-transit-bond",
		title: "Measure 4: Transit and Sidewalk Bond",
		contestSlug: "measure-4-transit-bond",
		location: "Metro County, Franklin",
		summary: "Measure 4 is a county bond proposal tied to transit corridors, sidewalks, and weather-related stop improvements. The main tradeoff in this demo record is faster project delivery versus a longer debt obligation.",
		ballotSummary: "Would authorize up to $180 million in bonds for bus corridor upgrades, accessible sidewalks, and storm-safe transit stops.",
		plainLanguageExplanation: "Measure 4 would let Metro County borrow money for specific transportation projects, including bus-stop shelters, sidewalk repairs near schools and clinics, and drainage improvements at major stops. Borrowing would spread project costs over many years instead of paying for all construction from current revenue.",
		currentLawOverview: "Under current county practice, Metro County can fund transit-stop and sidewalk work through annual appropriations, grants, and smaller capital commitments, but it does not yet have authority for this proposed bond package.",
		currentPractice: [
			{
				id: "measure4-current-1",
				text: "Transit-stop upgrades, sidewalk repairs, and drainage work compete with other capital projects in the annual county budget.",
				sources: [transitCapital, metroGuide]
			},
			{
				id: "measure4-current-2",
				text: "The county can still pursue grant-funded or pay-as-you-go projects, but the full $180 million project package is not currently authorized.",
				sources: [transitFiscal, transitCapital]
			}
		],
		proposedChanges: [
			{
				id: "measure4-change-1",
				text: "Authorize up to $180 million in county bonds for the listed transit, sidewalk, and storm-safety projects.",
				sources: [transitCapital, metroGuide]
			},
			{
				id: "measure4-change-2",
				text: "Allow Metro County to phase design, acquisition, and construction over multiple budget cycles while repaying the borrowing over time.",
				sources: [transitFiscal, transitCapital]
			},
			{
				id: "measure4-change-3",
				text: "Add recurring debt-service commitments to future county budgets once bonds are issued.",
				sources: [transitFiscal, metroGuide]
			}
		],
		yesMeaning: "A YES vote would allow Metro County to issue the proposed bonds and begin the listed capital projects, with repayment spread over future budgets.",
		noMeaning: "A NO vote would keep current funding rules in place. The county could still pursue smaller projects with existing revenue or grants, but the bond-backed project list would not move forward as proposed.",
		yesHighlights: [
			"The county could issue the proposed bonds and move forward with the named project list in the capital plan.",
			"Design, land acquisition, and phased construction could begin sooner than under pay-as-you-go budgeting alone.",
			"Future county budgets would carry recurring debt-service costs while projects are repaid."
		],
		noHighlights: [
			"The specific bond program would not be authorized, so the listed project package would not advance as written.",
			"The county could still pursue smaller transit and sidewalk work using existing revenue, grants, or a later proposal.",
			"Long-term debt service tied to this proposal would not be added to future county budgets."
		],
		fiscalContextNote: "The county budget office estimates annual debt service between $12 million and $15 million once all bonds are issued. The transit authority says projects would be phased over eight years.",
		implementationOverview: "Approval would authorize the borrowing, but actual delivery would still unfold in phases through design, land acquisition, contracting, and later board budgeting decisions.",
		implementationTimeline: [
			{
				id: "measure4-timeline-1",
				label: "If approved",
				timing: "Immediately after certification",
				summary: "The county would gain authority to prepare bond issuance documents and move the listed projects into the next capital-program cycle.",
				sources: [transitCapital, metroGuide]
			},
			{
				id: "measure4-timeline-2",
				label: "Early implementation",
				timing: "First 12 to 24 months",
				summary: "Design, permitting, and right-of-way work could begin on the first tranche of bus-stop, sidewalk, and drainage projects.",
				sources: [transitCapital, transitFiscal]
			},
			{
				id: "measure4-timeline-3",
				label: "Full project window",
				timing: "Roughly eight years",
				summary: "Construction would be phased over several budget cycles, and later county boards would still decide sequencing and maintenance priorities.",
				sources: [transitFiscal, metroGuide]
			}
		],
		fiscalSummary: [
			{
				id: "measure4-fiscal-1",
				label: "Borrowing authority",
				value: "Up to $180 million",
				scope: "County capital program",
				horizon: "Authorization at passage",
				note: "This is the maximum bond amount named in the measure, not the total future cost of repayment.",
				sources: [transitCapital, metroGuide]
			},
			{
				id: "measure4-fiscal-2",
				label: "Estimated debt service",
				value: "$12M to $15M annually",
				scope: "County budget",
				horizon: "After bonds are issued",
				note: "The budget office says repayment would become a recurring obligation in later county budgets.",
				sources: [transitFiscal]
			},
			{
				id: "measure4-fiscal-3",
				label: "Key uncertainty",
				value: "Grant and construction-cost dependent",
				scope: "Project sequencing",
				horizon: "Multi-year buildout",
				note: "Final timing and scope can change if grant awards, bid prices, or later board priorities shift.",
				sources: [transitFiscal, methodologyBrief]
			}
		],
		potentialImpacts: [
			{
				id: "measure4-impact-1",
				title: "Project delivery could start sooner",
				summary: "If approved, the county could start design and land acquisition earlier for a shortlist of sidewalk and transit-stop projects already identified in the capital plan.",
				sources: [transitCapital, transitFiscal]
			},
			{
				id: "measure4-impact-2",
				title: "Future budgets would carry debt service",
				summary: "Annual debt payments would become a recurring budget commitment. Future boards would still decide exactly how to phase construction and maintenance.",
				sources: [transitFiscal, metroGuide]
			}
		],
		supportArguments: [
			{
				id: "measure4-support-1",
				title: "Supporters emphasize faster delivery of delayed capital work",
				attribution: "Supporters, as reflected in the county guide and capital-plan materials",
				summary: "The pro-bond case in this demo record is that borrowing would move a backlog of stop, sidewalk, and drainage work into an earlier construction window instead of waiting for many years of annual appropriations.",
				sources: [transitCapital, metroGuide]
			},
			{
				id: "measure4-support-2",
				title: "Supporters frame borrowing as a way to spread costs over project life",
				attribution: "Supporters, as reflected in the fiscal note and capital-plan summary",
				summary: "Supporters say long-lived infrastructure can be financed over time so the cost is not concentrated in one budget cycle, especially when the project list is already identified publicly.",
				sources: [transitFiscal, transitCapital]
			}
		],
		opposeArguments: [
			{
				id: "measure4-oppose-1",
				title: "Opponents focus on debt-service pressure",
				attribution: "Opponents, as reflected in skeptical commentary summarized in the demo guide materials",
				summary: "The main skeptical argument in the attached record is that annual debt service would reduce flexibility in later budgets if tax growth or grant support slows.",
				sources: [transitFiscal, metroGuide]
			},
			{
				id: "measure4-oppose-2",
				title: "Opponents question uneven geographic benefit",
				attribution: "Opponents, as reflected in project-distribution criticism in the demo archive",
				summary: "Some critics argue that residents outside the busiest transit corridors may see fewer direct benefits unless later construction phases broaden the project map.",
				sources: [transitCapital, metroGuide]
			}
		],
		argumentsDisclaimer: "Support and opposition arguments are shown as attributed positions in the attached demo record. They are not Ballot Clarity endorsements or verified official findings.",
		argumentsAndConsiderations: [
			{
				id: "measure4-consideration-1",
				title: "Debt timing and budget flexibility",
				summary: "Supporters say the bond would front-load long-delayed sidewalk and bus-stop improvements and spread costs over time. Critics note that long-term debt service would reduce budget flexibility if sales tax growth slows.",
				sources: [transitFiscal, transitCapital]
			},
			{
				id: "measure4-consideration-2",
				title: "Geographic distribution of benefits",
				summary: "The project list focuses on corridors with existing transit demand. Residents outside those routes may see fewer direct benefits unless later phases expand coverage.",
				sources: [transitCapital, metroGuide]
			}
		],
		freshness: freshnessMeta({
			contentLastVerifiedAt: "2026-03-30T11:00:00.000Z",
			dataLastUpdatedAt: "2026-03-30T11:00:00.000Z",
			nextReviewAt: "2026-04-13T11:00:00.000Z",
			status: "up-to-date",
			statusLabel: "Up to date",
			statusNote: "The measure explainer was reviewed against the latest fiscal note, capital plan summary, and county guide in the demo archive."
		}),
		whatWeKnow: [
			trustBullet("measure4-know-1", "The proposal would authorize borrowing for a named list of transit, sidewalk, and stop-improvement projects.", [transitCapital, metroGuide]),
			trustBullet("measure4-know-2", "The fiscal note in this demo estimates recurring debt service once bonds are issued.", [transitFiscal, methodologyBrief])
		],
		whatWeDoNotKnow: [
			trustBullet("measure4-unknown-1", "The final construction sequence would still depend on later county budgeting and project delivery decisions.", [transitCapital, transitFiscal], "A successful vote does not lock every project phase into a fixed calendar."),
			trustBullet("measure4-unknown-2", "The demo record does not include future grant awards or construction-cost changes that could alter timing.", [transitFiscal, methodologyBrief], "Later bid prices and grants can change the practical scope of a bond program.")
		],
		sources: uniqueSources([transitFiscal, transitCapital, metroGuide, methodologyBrief]),
		updatedAt: "2026-03-30T11:00:00.000Z"
	},
	{
		slug: "charter-amendment-a",
		title: "Charter Amendment A: Public Records Timeline",
		contestSlug: "charter-amendment-a-records",
		location: "Metro County, Franklin",
		summary: "Charter Amendment A would add timing and explanation rules for county public-records requests. The demo materials frame it as a process-transparency measure rather than a change to what records are legally exempt.",
		ballotSummary: "Would require the county to acknowledge public-records requests within five business days and explain most delays in writing.",
		plainLanguageExplanation: "Charter Amendment A would add basic response-timing rules to the county charter for public-records requests. Agencies would need to acknowledge requests within five business days and give a written explanation if records cannot be produced on time.",
		currentLawOverview: "Current county practice already operates within state public-records law, but the county charter does not currently set the proposed five-business-day acknowledgement rule or written-delay explanation requirement.",
		currentPractice: [
			{
				id: "amendment-a-current-1",
				text: "Departments respond under existing county practice and state public-records law without the proposed charter deadline.",
				sources: [charterSummary, metroGuide]
			},
			{
				id: "amendment-a-current-2",
				text: "Disputes over exemptions, redactions, and production timing are already governed by state law and agency workflow rather than a county-charter response clock.",
				sources: [charterSummary, charterAudit]
			}
		],
		proposedChanges: [
			{
				id: "amendment-a-change-1",
				text: "Add a five-business-day acknowledgement rule for county public-records requests.",
				sources: [charterSummary, metroGuide]
			},
			{
				id: "amendment-a-change-2",
				text: "Require agencies to give a written explanation when records cannot be produced on time.",
				sources: [charterSummary, charterAudit]
			},
			{
				id: "amendment-a-change-3",
				text: "Leave the underlying state-law exemption rules in place while changing county process expectations.",
				sources: [charterSummary, metroGuide]
			}
		],
		yesMeaning: "A YES vote would add the proposed response-timing language to the county charter and require agencies to explain delays in writing.",
		noMeaning: "A NO vote would leave the current records process in place under existing county practice and state public-records law.",
		yesHighlights: [
			"The county charter would add a five-business-day acknowledgement rule for records requests.",
			"Agencies would need to explain most delays in writing when records cannot be produced on time.",
			"Implementation would still depend on department workflow, staffing, and request volume."
		],
		noHighlights: [
			"The current county process would stay in place alongside existing state public-records law.",
			"Departments could continue using current response practices without the proposed charter deadline.",
			"Disputes over exemptions and production timing would still be governed by existing law and agency practice."
		],
		fiscalContextNote: "The county auditor's estimate says direct costs are modest if agencies can use shared request software, but staffing needs could rise during high-volume periods.",
		implementationOverview: "If approved, the amendment would change county process rules first. Departments would then need to adjust tracking, acknowledgement, and delay-notice workflows within existing state-law boundaries.",
		implementationTimeline: [
			{
				id: "amendment-a-timeline-1",
				label: "If approved",
				timing: "After certification",
				summary: "The charter language would take effect and the county would need to align department records procedures with the new acknowledgement standard.",
				sources: [charterSummary, metroGuide]
			},
			{
				id: "amendment-a-timeline-2",
				label: "Operational setup",
				timing: "Early implementation window",
				summary: "Departments may need to update request logs, templates, and shared software so they can track acknowledgement timing consistently.",
				sources: [charterAudit, methodologyBrief]
			},
			{
				id: "amendment-a-timeline-3",
				label: "Longer-term effect",
				timing: "Ongoing",
				summary: "The amendment would not settle later disputes over exemptions; it would mainly shape how quickly requesters receive acknowledgements and explanations.",
				sources: [charterSummary, charterAudit]
			}
		],
		fiscalSummary: [
			{
				id: "amendment-a-fiscal-1",
				label: "Direct cost estimate",
				value: "Modest",
				scope: "County departments",
				horizon: "Initial implementation",
				note: "The auditor says costs stay lower if agencies can rely on shared request software rather than new standalone systems.",
				sources: [charterAudit]
			},
			{
				id: "amendment-a-fiscal-2",
				label: "Operational pressure",
				value: "May increase during request surges",
				scope: "Staffing and workflow",
				horizon: "High-volume periods",
				note: "The clearest uncertainty is whether departments need added staff or can manage the timing rule with current teams.",
				sources: [charterAudit, methodologyBrief]
			},
			{
				id: "amendment-a-fiscal-3",
				label: "Scope of change",
				value: "Process rule, not exemption rewrite",
				scope: "County records administration",
				horizon: "Ongoing",
				note: "The amendment changes timing and written explanations, but it does not automatically release records or rewrite state-law exemptions.",
				sources: [charterSummary, metroGuide]
			}
		],
		potentialImpacts: [
			{
				id: "amendment-a-impact-1",
				title: "More predictable request updates",
				summary: "Requesters could get faster updates on the status of a records request, even when a full release takes longer.",
				sources: [charterAudit, charterSummary]
			},
			{
				id: "amendment-a-impact-2",
				title: "Operational changes inside departments",
				summary: "Departments may need to standardize tracking systems and request logs. That could improve oversight, but it may also create a short-term administrative burden.",
				sources: [charterAudit, methodologyBrief]
			}
		],
		supportArguments: [
			{
				id: "amendment-a-support-1",
				title: "Supporters emphasize predictable status updates",
				attribution: "Supporters, as reflected in the charter summary and audit commentary",
				summary: "The pro-amendment case in the demo archive is that residents and journalists would get faster acknowledgement and clearer explanations when a request cannot be filled immediately.",
				sources: [charterSummary, charterAudit]
			},
			{
				id: "amendment-a-support-2",
				title: "Supporters frame the change as a transparency process rule",
				attribution: "Supporters, as reflected in the county guide and charter summary",
				summary: "Supporters say the amendment is meant to make process expectations clearer, not to rewrite exemption rules or expand county secrecy.",
				sources: [charterSummary, metroGuide]
			}
		],
		opposeArguments: [
			{
				id: "amendment-a-oppose-1",
				title: "Opponents focus on staffing and workflow strain",
				attribution: "Opponents, as reflected in administrative concern summarized in the audit materials",
				summary: "The skeptical view in the attached record is that departments facing request surges may need more staff or may respond with more partial notices to meet the charter deadline.",
				sources: [charterAudit, methodologyBrief]
			},
			{
				id: "amendment-a-oppose-2",
				title: "Opponents note that exemption disputes would still remain",
				attribution: "Opponents, as reflected in the charter summary and county guide materials",
				summary: "Critics note that faster acknowledgement does not automatically resolve later disputes about which records remain exempt under state law.",
				sources: [charterSummary, metroGuide]
			}
		],
		argumentsDisclaimer: "Support and opposition arguments are shown as attributed positions in the attached demo record. They are not Ballot Clarity endorsements or verified official findings.",
		argumentsAndConsiderations: [
			{
				id: "amendment-a-consideration-1",
				title: "Predictability versus administrative burden",
				summary: "Supporters say a response deadline would make the records process more predictable for residents and journalists. Some administrators say strict timelines could increase denial notices or partial responses when staffing is thin.",
				sources: [charterAudit, charterSummary]
			},
			{
				id: "amendment-a-consideration-2",
				title: "Process change, not automatic disclosure",
				summary: "The amendment does not automatically release records; it creates timing and explanation rules. Disputes over exemptions would still exist under state law.",
				sources: [charterSummary, metroGuide]
			}
		],
		freshness: freshnessMeta({
			contentLastVerifiedAt: "2026-03-30T11:00:00.000Z",
			dataLastUpdatedAt: "2026-03-30T11:00:00.000Z",
			nextReviewAt: "2026-04-13T11:00:00.000Z",
			status: "up-to-date",
			statusLabel: "Up to date",
			statusNote: "The measure explainer was reviewed against the latest charter summary, audit note, and county guide in the demo archive."
		}),
		whatWeKnow: [
			trustBullet("amendment-a-know-1", "The amendment changes response timing and written-explanation rules for records requests, not the underlying exemption rules.", [charterSummary, metroGuide]),
			trustBullet("amendment-a-know-2", "The demo fiscal context suggests direct costs are modest if agencies can rely on shared request software.", [charterAudit, methodologyBrief])
		],
		whatWeDoNotKnow: [
			trustBullet("amendment-a-unknown-1", "Future staffing pressure would still depend on how many requests departments receive after the rule change.", [charterAudit, methodologyBrief], "Operational effects can vary by department and request volume."),
			trustBullet("amendment-a-unknown-2", "The amendment would not resolve later disputes over which records remain exempt under state law.", [charterSummary, methodologyBrief], "Users should still read original legal language and county practice notes.")
		],
		sources: uniqueSources([charterAudit, charterSummary, metroGuide, methodologyBrief]),
		updatedAt: "2026-03-30T11:00:00.000Z"
	}
];

const contests: Contest[] = [
	{
		slug: "us-house-district-7",
		title: "Federal Race",
		office: "U.S. House, District 7",
		jurisdiction: "Federal",
		type: "candidate",
		description: "Federal race for the district's seat in the U.S. House of Representatives.",
		roleGuide: {
			summary: "This office writes and votes on federal law, helps shape the national budget, and handles district casework with federal agencies.",
			whyItMatters: "Voters in this district are choosing who speaks for them on national policy and constituent service.",
			decisionAreas: ["Budget and taxes", "Health and transportation funding", "Federal oversight and district casework"]
		},
		candidates: candidates.filter(candidate => candidate.contestSlug === "us-house-district-7")
	},
	{
		slug: "state-senate-district-12",
		title: "State Legislative Race",
		office: "State Senate, District 12",
		jurisdiction: "State",
		type: "candidate",
		description: "State legislative race covering growth management, housing, and water policy in District 12.",
		roleGuide: {
			summary: "This office helps write state law, approves the state budget, and votes on statewide rules affecting housing, utilities, schools, and transportation.",
			whyItMatters: "Many practical policy decisions that touch daily life are made at the state level, often with less media attention than federal races.",
			decisionAreas: ["Housing and land use", "Water and infrastructure policy", "State budget priorities"]
		},
		candidates: candidates.filter(candidate => candidate.contestSlug === "state-senate-district-12")
	},
	{
		slug: "county-school-board-at-large",
		title: "Local Race",
		office: "Metro County School Board At-Large",
		jurisdiction: "Local",
		type: "candidate",
		description: "Nonpartisan local contest for an at-large seat on the Metro County School Board.",
		roleGuide: {
			summary: "This office helps set district policy, approves budgets, hires and evaluates the superintendent, and makes governance decisions for county schools.",
			whyItMatters: "School-board races can shape classroom priorities, spending, facilities decisions, and family-facing district rules.",
			decisionAreas: ["District budget and facilities", "Curriculum and school governance", "Superintendent oversight"]
		},
		candidates: candidates.filter(candidate => candidate.contestSlug === "county-school-board-at-large")
	},
	{
		slug: "measure-4-transit-bond",
		title: "Ballot Measure",
		office: "County Ballot Measure",
		jurisdiction: "Ballot measure",
		type: "measure",
		description: "Countywide measure about transit capital borrowing and sidewalk work.",
		roleGuide: {
			summary: "Ballot measures ask voters to directly approve or reject a specific policy or financing change instead of choosing a candidate.",
			whyItMatters: "A YES or NO vote changes whether the proposed borrowing and infrastructure plan can move forward.",
			decisionAreas: ["Borrowing authority", "Transit capital projects", "Sidewalk and accessibility upgrades"]
		},
		measures: measures.filter(measure => measure.slug === "measure-4-transit-bond")
	},
	{
		slug: "charter-amendment-a-records",
		title: "Ballot Measure",
		office: "County Ballot Measure",
		jurisdiction: "Ballot measure",
		type: "measure",
		description: "County charter change related to public-records response timing.",
		roleGuide: {
			summary: "Ballot measures ask voters to directly approve or reject a rule change, charter amendment, tax, or borrowing proposal.",
			whyItMatters: "This measure would change the county charter rules that govern records-response timing and written explanations.",
			decisionAreas: ["Public-records response rules", "County administrative process", "Transparency deadlines"]
		},
		measures: measures.filter(measure => measure.slug === "charter-amendment-a")
	}
];

const electionOfficialResources: OfficialResource[] = [
	officialResource("Official election calendar", "Metro County Elections Office", "metro-county-election-calendar.txt", {
		note: "Demo stand-in for an election calendar and notice page.",
		sourceSystem: "Metro County Elections Office notice archive (demo)"
	}),
	officialResource("Vote-by-mail guide", "Metro County Elections Office", "metro-county-vote-by-mail-guide.txt", {
		note: "Demo stand-in for absentee and ballot-return instructions.",
		sourceSystem: "Metro County Elections Office notice archive (demo)"
	}),
	officialResource("Early voting schedule", "Metro County Elections Office", "metro-county-early-voting-guide.txt", {
		note: "Demo stand-in for early voting sites, hours, and accessibility notes.",
		sourceSystem: "Metro County Elections Office notice archive (demo)"
	})
];

export const demoElection: Election = {
	slug: "2026-metro-county-general",
	name: "2026 Metro County General Election",
	date: "2026-11-03",
	jurisdictionSlug: demoLocation.slug,
	locationName: demoLocation.displayName,
	updatedAt: "2026-03-30T18:00:00.000Z",
	description: "Demo ballot for Metro County voters featuring one federal race, one state legislative race, one local school-board race, and two county ballot measures.",
	contests,
	freshness: freshnessMeta({
		contentLastVerifiedAt: "2026-03-30T18:00:00.000Z",
		dataLastUpdatedAt: "2026-03-30T18:00:00.000Z",
		nextReviewAt: "2026-04-14T18:00:00.000Z",
		status: "up-to-date",
		statusLabel: "Up to date",
		statusNote: "Election logistics and guide metadata were reviewed against the latest official-resource files linked in this demo."
	}),
	keyDates: [
		{
			label: "Registration deadline",
			date: "2026-10-06",
			note: "Demo deadline for new registrations and address changes."
		},
		{
			label: "Vote-by-mail request deadline",
			date: "2026-10-27",
			note: "Demo deadline for requesting a mailed ballot."
		},
		{
			label: "Early voting opens",
			date: "2026-10-19",
			note: "Demo date for county vote centers to open."
		},
		{
			label: "Election Day polls close",
			date: "2026-11-03T19:00:00.000Z",
			note: "Demo closing time shown to model time-sensitive election logistics."
		}
	],
	officialResources: electionOfficialResources,
	changeLog: [
		{
			id: "change-1",
			date: "2026-03-30T18:00:00.000Z",
			summary: "Added source-backed early voting and vote-by-mail resource links to the demo election guide."
		},
		{
			id: "change-2",
			date: "2026-03-28T15:20:00.000Z",
			summary: "Clarified the school-board contest description and attached the latest demo questionnaire file."
		}
	]
};

export const demoElectionSummaries: ElectionSummary[] = [
	{
		slug: demoElection.slug,
		name: demoElection.name,
		date: demoElection.date,
		jurisdictionSlug: demoElection.jurisdictionSlug,
		locationName: demoElection.locationName,
		updatedAt: demoElection.updatedAt
	}
];

export const demoJurisdiction: Jurisdiction = {
	slug: demoLocation.slug,
	name: "Metro County",
	displayName: demoLocation.displayName,
	state: demoLocation.state,
	jurisdictionType: "County",
	description: "Metro County is the demo jurisdiction for this MVP. The page models how a public-interest election hub can combine official election office contacts, upcoming elections, voting methods, and archive links without forcing users through a search-only flow.",
	nextElectionName: demoElection.name,
	nextElectionSlug: demoElection.slug,
	updatedAt: "2026-03-31T15:00:00.000Z",
	officialOffice: {
		name: "Metro County Elections Office",
		address: "120 Civic Square, Harbor City, Franklin 00412",
		phone: "(555) 014-2026",
		email: "elections@metrocounty-demo.gov",
		website: "/demo-sources/metro-county-election-office.txt",
		hours: "Monday-Friday, 8:30 a.m. to 5:00 p.m. Demo extended hours begin during early voting."
	},
	officialResources: [
		officialResource("Election office contact sheet", "Metro County Elections Office", "metro-county-election-office.txt", {
			sourceSystem: "Metro County Elections Office contact archive (demo)"
		}),
		...electionOfficialResources
	],
	votingMethods: [
		{
			slug: "in-person-election-day",
			title: "Vote in person on Election Day",
			summary: "Election Day voting in the demo county is assigned by precinct. The official county office publishes accessibility notes and final hours in the election office contact sheet.",
			details: [
				"Bring a sample ballot or notes if that helps you track contests.",
				"Review the official contact sheet for accessibility notes and replacement polling locations.",
				"Check the election calendar close to Election Day in case hours or precinct assignments change."
			],
			officialResource: officialResource("Election office contact sheet", "Metro County Elections Office", "metro-county-election-office.txt", {
				sourceSystem: "Metro County Elections Office contact archive (demo)"
			})
		},
		{
			slug: "early-voting",
			title: "Use an early voting site",
			summary: "Metro County publishes a countywide early voting schedule with vote centers, extended-weekend hours, and limited curbside details.",
			details: [
				"Early voting is designed as the highest-volume in-person option in this demo dataset.",
				"Use the schedule to confirm site hours because demo locations vary by weekday and weekend.",
				"The sample guide treats the county schedule as the primary source for early voting hours."
			],
			officialResource: officialResource("Early voting schedule", "Metro County Elections Office", "metro-county-early-voting-guide.txt", {
				sourceSystem: "Metro County Elections Office notice archive (demo)"
			})
		},
		{
			slug: "vote-by-mail",
			title: "Vote by mail",
			summary: "The vote-by-mail guide explains request deadlines, ballot tracking, and return options for this demo jurisdiction.",
			details: [
				"Users should review the official guide for request and return deadlines before relying on a ballot-by-mail plan.",
				"Drop-box and mail-return instructions can change, so the election guide highlights the most recent update date.",
				"Ballot Clarity treats mail-voting instructions as official-source content, not advisory copy."
			],
			officialResource: officialResource("Vote-by-mail guide", "Metro County Elections Office", "metro-county-vote-by-mail-guide.txt", {
				sourceSystem: "Metro County Elections Office notice archive (demo)"
			})
		}
	],
	upcomingElections: demoElectionSummaries,
	archivedGuides: [
		{
			id: "archive-2025-special",
			title: "2025 Metro County Special Election Guide",
			date: "2025-08-12",
			href: "/demo-sources/metro-county-voter-guide.txt"
		},
		{
			id: "archive-2024-general",
			title: "2024 Metro County General Election Guide",
			date: "2024-11-05",
			href: "/demo-sources/metro-county-voter-guide.txt"
		}
	],
	coverageNotes: [
		"This is not an official government site. Users should verify deadlines and locations with the Metro County Elections Office.",
		"The demo location hub is designed as an HTML-first reference page with printable guides as a companion, not a substitute for official notices.",
		"Coverage notes are visible here so a user can understand scope before opening contest-level pages."
	]
};

export const demoDataSources: DataSourcesResponse = {
	updatedAt: "2026-04-10T18:30:00.000Z",
	principles: [
		"Use official sources where they are authoritative, especially for election logistics, campaign finance, lobbying, and district geography.",
		"Use a normalized election-data provider for national ballot and polling-place scale instead of scraping every county separately.",
		"Keep ballot lookup, geocoding, campaign finance, and lobbying connectors independent so a failure in one domain does not take down the others."
	],
	categories: [
		{
			slug: "address-and-districts",
			title: "Address and district lookup",
			summary: "A live Ballot Clarity build should treat district assignment as its own subsystem, with versioned geography and explicit as-of timestamps.",
			authoritativeRule: "District assignment should be grounded in official geography, not inferred from a vendor profile alone.",
			liveApproach: "Use Census geocoding plus versioned district boundaries, then cache address-to-jurisdiction matches with benchmark or vintage metadata.",
			options: [
				{
					id: "census-geocoder",
					name: "Census Geocoder with geoLookup",
					authority: "official-government",
					status: "planned-live",
					accessMethod: "API",
					coverage: "United States, Puerto Rico, and U.S. island areas",
					updatePattern: "Versioned by benchmark and vintage",
					summary: "Baseline address normalization and geography lookup for a defensible district-assignment pipeline.",
					bestUse: "Address-to-jurisdiction matching and cached district lookup.",
					notes: [
						"Keep benchmark and vintage in cache keys so district assignments remain auditable.",
						"Treat geocoding as a high-risk dependency and design a stale-cache fallback."
					]
				},
				{
					id: "tiger-line",
					name: "TIGER/Line shapefiles",
					authority: "official-government",
					status: "planned-live",
					accessMethod: "Bulk files",
					coverage: "National district and administrative boundaries",
					updatePattern: "Released by vintage year",
					summary: "Versioned geometry layer for districts, places, and other jurisdiction boundaries.",
					bestUse: "Offline district joins, reproducible geography snapshots, and geospatial audits.",
					notes: [
						"Useful when the product needs to explain which district model was in force on a given date.",
						"Should stay separate from election-office content and polling-place feeds."
					]
				},
				{
					id: "google-divisions",
					name: "Google Civic Divisions lookup",
					authority: "commercial-provider",
					status: "reference-pattern",
					accessMethod: "API",
					coverage: "Supported U.S. elections and OCD-ID lookup flows",
					updatePattern: "Provider-controlled",
					summary: "Useful as an OCD-ID bootstrap, but not a substitute for canonical district storage.",
					bestUse: "Supplemental division lookup after the Representatives API sunset.",
					notes: [
						"The Google Civic Representatives API ended on April 30, 2025.",
						"District lookup should stay decoupled from any provider-specific official lookup endpoint."
					]
				}
			]
		},
		{
			slug: "ballots-and-locations",
			title: "Ballots, deadlines, and polling places",
			summary: "Election logistics change faster than most civic records, so Ballot Clarity needs an official-source chain plus a normalized provider layer for national scale.",
			authoritativeRule: "Election-office notices remain the final authority for deadlines, polling-place changes, and ballot-return instructions.",
			liveApproach: "Store official notices as the verification layer, then use a provider-normalized ballot API for address-to-ballot lookup and contest packaging.",
			options: [
				{
					id: "official-election-office",
					name: "Official election office notices and VIP-style feeds",
					authority: "official-government",
					status: "planned-live",
					accessMethod: "Official notices or standardized feed publishing",
					coverage: "State and local election logistics",
					updatePattern: "High-frequency during election windows",
					summary: "Primary authority for deadlines, polling locations, drop boxes, and final ballot instructions.",
					bestUse: "User-facing verification links, change logs, and last-mile corrections.",
					notes: [
						"Polling-place changes should degrade to cached data with a visible may-be-stale warning if an upstream feed fails.",
						"The HTML location hub should always link back to the election office before a user prints or travels."
					]
				},
				{
					id: "democracy-works",
					name: "National elections provider (Democracy Works-style)",
					authority: "nonprofit-provider",
					status: "planned-live",
					accessMethod: "API",
					coverage: "Federal, state, county, municipal, and other local elections",
					updatePattern: "Continuously refreshed by provider pipeline",
					summary: "Fastest path to national ballot and polling-place coverage without bespoke county-by-county scraping.",
					bestUse: "Ballot packaging, election calendars, and personalized lookup at national scale.",
					notes: [
						"Provider data should not replace official links; it should normalize and distribute them.",
						"Keep provider-specific field mapping isolated behind an internal ballot service."
					]
				},
				{
					id: "ballotready",
					name: "Commercial ballot matching provider (BallotReady-style)",
					authority: "commercial-provider",
					status: "reference-pattern",
					accessMethod: "API or export",
					coverage: "Personalized ballots, contests, measures, and voting logistics",
					updatePattern: "Provider-controlled refresh",
					summary: "Useful when a faster turnkey ballot product matters more than owning the normalization layer internally.",
					bestUse: "High-velocity partnerships or embedded ballot widgets.",
					notes: [
						"Treat vendor provenance and licensing as product decisions, not just engineering details.",
						"Still keep official election-office links visible on every logistics surface."
					]
				}
			]
		},
		{
			slug: "candidate-and-measure-records",
			title: "Candidate lists, filings, and ballot text",
			summary: "Candidate and measure surfaces should combine official filing lists with clearly labeled candidate-supplied and nonprofit-context layers.",
			authoritativeRule: "Official filing lists and certified ballot text outrank campaign or nonprofit summaries.",
			liveApproach: "Store official candidate lists and ballot text as the base record, then layer questionnaires or explanatory summaries with explicit provenance labels.",
			options: [
				{
					id: "official-filing-lists",
					name: "Official candidate filing lists and certified ballot text",
					authority: "official-government",
					status: "planned-live",
					accessMethod: "Official notices, PDFs, HTML pages, or exports",
					coverage: "Federal, state, and local election records where available",
					updatePattern: "Election-window updates plus certification changes",
					summary: "Canonical ballot-status, office, and text layer for contests and measures.",
					bestUse: "On-ballot verification, official wording, and candidate roster checks.",
					notes: [
						"Local formats will vary widely, so connectors must tolerate PDFs, HTML tables, and manual corrections.",
						"Candidate status should surface an as-of timestamp and the source system used to verify it."
					]
				},
				{
					id: "nonprofit-questionnaires",
					name: "Nonprofit questionnaires and civic records",
					authority: "nonprofit-provider",
					status: "reference-pattern",
					accessMethod: "Questionnaire archive or civic data feed",
					coverage: "Selected races and issue areas",
					updatePattern: "Per questionnaire cycle",
					summary: "Useful for comparable issue statements when official records alone do not explain a candidate's stated priorities.",
					bestUse: "Side-by-side compare tables and clearly labeled candidate-submitted answers.",
					notes: [
						"Candidate-submitted material should never be mistaken for verified official text.",
						"Missing responses should be shown explicitly instead of omitted."
					]
				}
			]
		},
		{
			slug: "money-and-influence",
			title: "Campaign finance and lobbying",
			summary: "Money and influence modules should come from independent federal pipelines so failures there cannot block ballot lookup.",
			authoritativeRule: "Federal money and lobbying sections should resolve back to the official disclosure system, not a derivative summary alone.",
			liveApproach: "Ingest these domains separately from election lookup, then join them onto candidate pages through stable IDs and manual crosswalks where necessary.",
			options: [
				{
					id: "openfec",
					name: "FEC OpenFEC API and bulk files",
					authority: "official-government",
					status: "planned-live",
					accessMethod: "API and bulk files",
					coverage: "Federal campaign finance only",
					updatePattern: "Nightly refresh with cached responses",
					summary: "Authoritative federal finance layer for candidates, committees, filings, and contribution patterns.",
					bestUse: "Candidate funding overviews, committee context, and reproducible finance snapshots.",
					notes: [
						"Treat the FEC cache window as part of freshness logic rather than assuming continuous real time.",
						"Use bulk files for warehousing and API calls for interactive page queries."
					]
				},
				{
					id: "senate-lda",
					name: "Senate LDA and LDA.gov disclosures",
					authority: "official-government",
					status: "planned-live",
					accessMethod: "API and bulk files",
					coverage: "Federal lobbying disclosures",
					updatePattern: "Quarterly filings plus current-year reports",
					summary: "Authoritative federal lobbying layer for registrants, clients, and filed reports.",
					bestUse: "Lobbying context sections and independent influence pipelines.",
					notes: [
						"Keep the Senate LDA integration isolated so endpoint migrations do not affect ballot lookup.",
						"The older lda.senate.gov docs path is scheduled to retire after June 30, 2026."
					]
				}
			]
		},
		{
			slug: "historical-and-research",
			title: "Historical results and research archive",
			summary: "Historical datasets are useful for analysis and context, but they should stay out of the critical path for where-do-I-vote workflows.",
			authoritativeRule: "Research and historical context should be clearly labeled as archival or analytical, not as a live logistics source.",
			liveApproach: "Store these datasets in a separate analytics layer so archival work does not interfere with election-day reliability.",
			options: [
				{
					id: "openelections",
					name: "OpenElections",
					authority: "open-data",
					status: "research-layer",
					accessMethod: "Bulk repository files",
					coverage: "Historical election results by state and year",
					updatePattern: "Community-maintained",
					summary: "Useful for historical results warehousing and state-by-state archive work.",
					bestUse: "Election history, comparison context, and analytics backfills.",
					notes: [
						"Not a replacement for current polling-place or ballot lookup.",
						"Parser quality and completeness will vary by state and cycle."
					]
				},
				{
					id: "mit-election-lab",
					name: "MIT Election Data and Science Lab",
					authority: "open-data",
					status: "research-layer",
					accessMethod: "Bulk datasets",
					coverage: "Research-grade election history and related datasets",
					updatePattern: "Dataset-specific releases",
					summary: "High-value archive layer for benchmarking and public-interest analysis work.",
					bestUse: "Longitudinal research, modeling, and historical context pages.",
					notes: [
						"Keep these datasets behind an analytics boundary, not in the critical request path.",
						"Useful once Ballot Clarity adds post-election archive and results views."
					]
				}
			]
		}
	],
	architectureStages: [
		{
			id: "connector-layer",
			title: "Connector layer",
			summary: "Every upstream should be isolated behind a single connector contract with retries, rate-limit handling, and schema-aware parsing.",
			details: [
				"Keep election providers, geocoders, and federal disclosure APIs in separate workers.",
				"Persist raw responses or files before transforming them into canonical entities."
			]
		},
		{
			id: "canonical-storage",
			title: "Canonical storage",
			summary: "Normalize upstream data into stable entities with explicit identifiers, source systems, and as-of times.",
			details: [
				"Store source_system, source_url, retrieved_at, effective_date, and record_version for user-facing fields.",
				"Use OCD IDs, GEOIDs, FEC IDs, and LDA identifiers where they exist."
			]
		},
		{
			id: "cache-and-serve",
			title: "Cache and serve",
			summary: "Election workloads spike near deadlines, so geo lookup and ballot packages need coherent caching and stale-data fallbacks.",
			details: [
				"Cache address-to-district lookups separately from ballot packages.",
				"Show may-be-stale warnings instead of silently failing when a critical upstream is unavailable."
			]
		},
		{
			id: "audit-and-ops",
			title: "Audit and election-window ops",
			summary: "Freshness, migrations, and provider drift need operational playbooks, not just code comments.",
			details: [
				"Make update cadence and change logs visible on the public site.",
				"Maintain migration checklists for provider sunsets, field changes, and election-window sync frequency."
			]
		}
	],
	migrationWatch: [
		{
			id: "google-representatives-sunset",
			title: "Google Representatives API ended on April 30, 2025",
			summary: "District and OCD lookup can still be done through divisions-style endpoints, but who-represents-me should no longer be treated as a built-in civic primitive.",
			implication: "Ballot Clarity should separate address-to-division logic from official-contact or officeholder enrichment."
		},
		{
			id: "lda-gov-migration",
			title: "Senate LDA migration deadline: June 30, 2026",
			summary: "Older lda.senate.gov documentation paths are being retired in favor of LDA.gov.",
			implication: "The lobbying connector should be isolated so endpoint or documentation changes do not ripple through the rest of the platform."
		}
	],
	roadmap: [
		{
			id: "milestone-one",
			title: "Milestone one: address to jurisdiction foundation",
			summary: "Implement address normalization, geocoding, district lookup, and benchmark or vintage versioning."
		},
		{
			id: "milestone-two",
			title: "Milestone two: ballot lookup MVP",
			summary: "Expose a single internal ballot API that returns contests, measures, deadlines, and polling-place context."
		},
		{
			id: "milestone-three",
			title: "Milestone three: federal money and influence modules",
			summary: "Add FEC and Senate LDA pipelines without letting them block ballot or location lookup."
		},
		{
			id: "milestone-four",
			title: "Milestone four: normalization and crosswalk service",
			summary: "Join elections, divisions, money, and lobbying records through stable identifiers and auditable crosswalks."
		},
		{
			id: "milestone-five",
			title: "Milestone five: election-window hardening",
			summary: "Add caching policies, incident playbooks, and higher-frequency sync for deadlines and polling-place changes."
		},
		{
			id: "milestone-six",
			title: "Milestone six: historical results and analytics",
			summary: "Bring historical open-data archives into a separate research layer rather than the critical path."
		}
	]
};

export const demoJurisdictionSummaries: JurisdictionSummary[] = [
	{
		slug: demoJurisdiction.slug,
		name: demoJurisdiction.name,
		displayName: demoJurisdiction.displayName,
		state: demoJurisdiction.state,
		jurisdictionType: demoJurisdiction.jurisdictionType,
		description: demoJurisdiction.description,
		nextElectionName: demoJurisdiction.nextElectionName,
		nextElectionSlug: demoJurisdiction.nextElectionSlug,
		updatedAt: demoJurisdiction.updatedAt
	}
];

export function getCandidateBySlug(slug: string) {
	return candidates.find(candidate => candidate.slug === slug) ?? null;
}

export function getCandidatesBySlugs(slugs: string[]) {
	return slugs
		.map(slug => getCandidateBySlug(slug))
		.filter((candidate): candidate is Candidate => Boolean(candidate));
}

export function getMeasureBySlug(slug: string) {
	return measures.find(measure => measure.slug === slug) ?? null;
}

export function getElectionBySlug(slug: string) {
	if (slug === demoElection.slug)
		return demoElection;

	return null;
}

export function getJurisdictionBySlug(slug: string) {
	if (slug === demoJurisdiction.slug)
		return demoJurisdiction;

	return null;
}
