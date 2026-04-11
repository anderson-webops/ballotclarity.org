import type {
	Candidate,
	Contest,
	Election,
	ElectionSummary,
	LocationSelection,
	Measure,
	Source
} from "./types/civic.js";

const demoSourceNote = "Demo source file included with the MVP. Review the original public record before relying on it for a real election.";

function source(id: string, title: string, publisher: string, type: Source["type"], date: string, file: string, note = demoSourceNote): Source {
	return {
		date,
		id,
		note,
		publisher,
		title,
		type,
		url: `/demo-sources/${file}`
	};
}

function uniqueSources(...groups: Source[][]) {
	return Array.from(new Map(groups.flat().map(item => [item.id, item])).values());
}

const metroGuide = source("metro-guide-2026", "Metro County 2026 General Election Demo Guide", "Ballot Clarity Demo Archive", "voter guide", "2026-03-30", "metro-county-voter-guide.txt");
const methodologyBrief = source("methodology-brief", "Ballot Clarity Demo Methodology Notes", "Ballot Clarity Demo Archive", "research brief", "2026-03-30", "methodology-demo-notes.txt");

const torresFec = source("torres-fec-q1", "Elena Torres Q1 2026 FEC Filing", "Federal Election Commission Demo File", "campaign filing", "2026-03-28", "federal-d7-fec-torres-q1-2026.txt");
const brooksFec = source("brooks-fec-q1", "Daniel Brooks Q1 2026 FEC Filing", "Federal Election Commission Demo File", "campaign filing", "2026-03-28", "federal-d7-fec-brooks-q1-2026.txt");
const brooksVotes = source("brooks-house-votes", "Selected House Votes for District 7 Incumbent", "Congressional Record Demo Extract", "official record", "2026-03-22", "federal-d7-house-votes-brooks.txt");
const torresPolicy = source("torres-port-clinic-plan", "Torres Port and Clinic Access Platform Summary", "Campaign Policy Demo File", "policy memo", "2026-03-24", "federal-d7-port-clinic-plan-torres.txt");

const bellWaterBill = source("bell-water-bill", "State Senate District 12 Water Reliability Bill Summary", "Franklin Legislature Demo File", "official record", "2026-03-19", "state-senate-d12-bell-water-bill.txt");
const parkHousing = source("park-housing-hearing", "Naomi Park Rental Stability Hearing Notes", "Franklin Legislature Demo File", "hearing transcript", "2026-03-21", "state-senate-d12-park-housing-hearing.txt");
const districtEthics = source("district-ethics", "District 12 Lobbying and Ethics Disclosure Summary", "Franklin Ethics Commission Demo File", "ethics filing", "2026-03-20", "state-senate-d12-ethics-disclosures.txt");

const schoolBudgetMinutes = source("school-budget-minutes", "Metro County School Board Budget Workshop Minutes", "Metro County Schools Demo File", "official record", "2026-03-18", "school-board-budget-minutes.txt");
const schoolLiteracyReport = source("school-literacy-report", "Metro County K-3 Literacy and Attendance Report", "Metro County Schools Demo File", "research brief", "2026-03-17", "school-board-literacy-report.txt");
const schoolQuestionnaire = source("school-questionnaire", "School Board Candidate Questionnaire Responses", "League of Metro Voters Demo File", "questionnaire", "2026-03-23", "school-board-candidate-questionnaire.txt");

const transitFiscal = source("transit-fiscal-note", "Measure 4 Fiscal Note and Debt Service Estimate", "Metro County Budget Office Demo File", "official record", "2026-03-29", "measure-4-fiscal-note.txt");
const transitCapital = source("transit-capital-plan", "Measure 4 Capital Improvement Plan Summary", "Metro County Transit Authority Demo File", "policy memo", "2026-03-27", "measure-4-capital-plan.txt");
const charterAudit = source("charter-audit", "Public Records Response Time Audit", "Metro County Auditor Demo File", "research brief", "2026-03-25", "amendment-a-audit-report.txt");
const charterSummary = source("charter-summary", "Charter Amendment A Plain-Language Summary", "Metro County Clerk Demo File", "official record", "2026-03-26", "amendment-a-charter-summary.txt");

export const demoLocation: LocationSelection = {
	coverageLabel: "Demo coverage: Metro County, Franklin",
	displayName: "Metro County, Franklin",
	slug: "metro-county-franklin",
	state: "Franklin"
};

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
		whatWeKnow: [
			"Her public platform is unusually detailed for a first-time congressional candidate in this mock race.",
			"The available filing shows a donor base that is broader than one employer or single industry."
		],
		whatWeDoNotKnow: [
			"No independent expenditure activity is included in this demo beyond the candidate committee filing.",
			"The demo record does not include internal polling or unpublished district outreach plans."
		],
		methodologyNotes: [
			"Federal race summaries use campaign filings, questionnaires, and public policy memos included in the demo dataset.",
			"This profile does not include tax returns, private meetings, or unpublished donor communications."
		],
		sources: uniqueSources([torresFec, torresPolicy, metroGuide, schoolQuestionnaire, methodologyBrief, districtEthics]),
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
		whatWeKnow: [
			"The available record shows larger fundraising capacity and a clearer incumbent advantage in committee-linked donor networks.",
			"He has a vote record that can be inspected directly in ways challenger campaigns cannot match."
		],
		whatWeDoNotKnow: [
			"The demo does not include private constituent casework records or confidential committee negotiations.",
			"Outside group advertising is not tracked beyond the simplified filing summary."
		],
		methodologyNotes: [
			"Incumbent vote summaries are drawn from the demo congressional record extract and limited to items selected for district relevance.",
			"Committee negotiations and informal amendments are not fully visible in this MVP."
		],
		sources: uniqueSources([brooksFec, brooksVotes, metroGuide, methodologyBrief, districtEthics]),
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
		whatWeKnow: [
			"Her most visible public record comes from town-council work and legal aid advocacy.",
			"Her campaign is less funded than the incumbent but shows a higher share of small-dollar giving."
		],
		whatWeDoNotKnow: [
			"There is no statewide legislative record because Park is not currently in the senate.",
			"The demo does not include internal coalition agreements or draft bill language beyond the published summaries."
		],
		methodologyNotes: [
			"State race summaries combine local office actions, hearing testimony, and ethics disclosures included in the demo archive.",
			"No closed-door caucus negotiations or unreleased fiscal estimates are reflected here."
		],
		sources: uniqueSources([parkHousing, districtEthics, metroGuide, schoolQuestionnaire, methodologyBrief]),
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
		whatWeKnow: [
			"Bell has a documented legislative record on water and workforce policy.",
			"His funding profile shows stronger support from utility and development sectors than his challenger."
		],
		whatWeDoNotKnow: [
			"The demo record does not include caucus-level strategy discussions or constituent emails.",
			"Independent expenditures and dark-money spending are not fully modeled in this MVP."
		],
		methodologyNotes: [
			"Legislative summaries rely on the demo senate bill summary, ethics disclosure digest, and a simplified election guide.",
			"This record does not show constituent service requests or unpublished amendment drafts."
		],
		sources: uniqueSources([bellWaterBill, districtEthics, metroGuide, methodologyBrief]),
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
		whatWeKnow: [
			"Greene has the clearest public vote history in this local race.",
			"Her campaign materials focus on slower, capacity-aware implementation rather than large one-year changes."
		],
		whatWeDoNotKnow: [
			"Closed-session personnel discussions are not public and are not reflected here.",
			"The demo does not include teacher-union endorsements beyond the simplified questionnaire record."
		],
		methodologyNotes: [
			"Local race summaries use meeting minutes, district reports, and candidate questionnaires included in the public demo files.",
			"This record does not include closed-session personnel matters or student-level data."
		],
		sources: uniqueSources([schoolBudgetMinutes, schoolLiteracyReport, schoolQuestionnaire, methodologyBrief]),
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
		whatWeKnow: [
			"His campaign message is focused on family-facing transparency tools and tutoring access.",
			"His fundraising is modest and local compared with the rest of the field."
		],
		whatWeDoNotKnow: [
			"There is no school-board voting record because Hill has not held this office.",
			"The demo does not include detailed position papers on facilities or procurement."
		],
		methodologyNotes: [
			"Because Hill has not served on the board, this profile relies more heavily on published proposals and questionnaires than vote records."
		],
		sources: uniqueSources([schoolQuestionnaire, schoolLiteracyReport, metroGuide, methodologyBrief]),
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
		whatWeKnow: [
			"Her public-facing material is the most budget-specific in the local field.",
			"Her donor base looks local and professional rather than institutional in the current demo file."
		],
		whatWeDoNotKnow: [
			"The demo does not include extensive public comments from teachers or principals responding to Patel's budget proposals.",
			"There is no school-board voting record because Patel is not an incumbent."
		],
		methodologyNotes: [
			"Patel's profile relies on questionnaire responses, public budget materials, and stated management proposals rather than elected-office votes."
		],
		sources: uniqueSources([schoolBudgetMinutes, schoolQuestionnaire, methodologyBrief]),
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
		yesMeaning: "A YES vote would allow Metro County to issue the proposed bonds and begin the listed capital projects, with repayment spread over future budgets.",
		noMeaning: "A NO vote would keep current funding rules in place. The county could still pursue smaller projects with existing revenue or grants, but the bond-backed project list would not move forward as proposed.",
		fiscalContextNote: "The county budget office estimates annual debt service between $12 million and $15 million once all bonds are issued. The transit authority says projects would be phased over eight years.",
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
		yesMeaning: "A YES vote would add the proposed response-timing language to the county charter and require agencies to explain delays in writing.",
		noMeaning: "A NO vote would leave the current records process in place under existing county practice and state public-records law.",
		fiscalContextNote: "The county auditor's estimate says direct costs are modest if agencies can use shared request software, but staffing needs could rise during high-volume periods.",
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
		candidates: candidates.filter(candidate => candidate.contestSlug === "us-house-district-7")
	},
	{
		slug: "state-senate-district-12",
		title: "State Legislative Race",
		office: "State Senate, District 12",
		jurisdiction: "State",
		type: "candidate",
		description: "State legislative race covering growth management, housing, and water policy in District 12.",
		candidates: candidates.filter(candidate => candidate.contestSlug === "state-senate-district-12")
	},
	{
		slug: "county-school-board-at-large",
		title: "Local Race",
		office: "Metro County School Board At-Large",
		jurisdiction: "Local",
		type: "candidate",
		description: "Nonpartisan local contest for an at-large seat on the Metro County School Board.",
		candidates: candidates.filter(candidate => candidate.contestSlug === "county-school-board-at-large")
	},
	{
		slug: "measure-4-transit-bond",
		title: "Ballot Measure",
		office: "County Ballot Measure",
		jurisdiction: "Ballot measure",
		type: "measure",
		description: "Countywide measure about transit capital borrowing and sidewalk work.",
		measures: measures.filter(measure => measure.slug === "measure-4-transit-bond")
	},
	{
		slug: "charter-amendment-a-records",
		title: "Ballot Measure",
		office: "County Ballot Measure",
		jurisdiction: "Ballot measure",
		type: "measure",
		description: "County charter change related to public-records response timing.",
		measures: measures.filter(measure => measure.slug === "charter-amendment-a")
	}
];

export const demoElection: Election = {
	slug: "2026-metro-county-general",
	name: "2026 Metro County General Election",
	date: "2026-11-03",
	locationName: demoLocation.displayName,
	updatedAt: "2026-03-30T18:00:00.000Z",
	description: "Demo ballot for Metro County voters featuring one federal race, one state legislative race, one local school-board race, and two county ballot measures.",
	contests
};

export const demoElectionSummaries: ElectionSummary[] = [
	{
		slug: demoElection.slug,
		name: demoElection.name,
		date: demoElection.date,
		locationName: demoElection.locationName,
		updatedAt: demoElection.updatedAt
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
