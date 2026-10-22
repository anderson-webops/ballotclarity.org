export interface ElectionReferenceSource {
	id: string;
	stateCode: string;
	electionDate: string;
	documents: readonly {
		url: string;
		pageUrl?: string;
		title: string;
		publisher: string;
		kind: "candidate-statement" | "news-report" | "official-biography";
		publishedDate?: string;
	}[];
}

export const electionReferenceSources: readonly ElectionReferenceSource[] = [
	{
		id: "az-statewide-profiles-2026",
		stateCode: "AZ",
		electionDate: "2026-11-03",
		documents: [
			{ url: "https://azgovernor.gov/governor/meet-governor-katie-hobbs", title: "Katie Hobbs biography", publisher: "Office of the Arizona Governor", kind: "official-biography" },
			{ url: "https://biggs.house.gov/about/biography", title: "Andy Biggs biography", publisher: "Office of Congressman Andy Biggs", kind: "official-biography" },
			{ url: "https://risalombardo.com/about/", title: "Risa Lombardo candidate statement", publisher: "Lombardo for AZ", kind: "candidate-statement" },
			{ url: "https://teriann4azgov.org/about", title: "Teri Ann Hourihan candidate statement", publisher: "Teri Ann Hourihan for Arizona Governor", kind: "candidate-statement" },
			{ url: "https://teriann4azgov.org/teri-anns-lieutenant-governor", title: "Angela Harrolle Mohan candidate statement", publisher: "Teri Ann Hourihan for Arizona Governor", kind: "candidate-statement" },
		],
	},
	{
		id: "nv-executive-biographies-2026",
		stateCode: "NV",
		electionDate: "2026-11-03",
		documents: [
			{ url: "https://ag.nv.gov/About/AG_Aaron_Ford/", title: "Aaron D. Ford biography", publisher: "Nevada Office of the Attorney General", kind: "official-biography" },
			{ url: "https://www.gov.nv.gov/about/governor-joe-lombardo/", title: "Joe Lombardo biography", publisher: "Office of the Nevada Governor", kind: "official-biography" },
			{ url: "https://ltgov.nv.gov/AboutUs/BiographyStavrosAnthony/", title: "Stavros Anthony biography", publisher: "Office of the Nevada Lieutenant Governor", kind: "official-biography" },
		],
	},
	{
		id: "ut-congressional-statements-2026",
		stateCode: "UT",
		electionDate: "2026-11-03",
		documents: [{
			url: "https://vote.utah.gov/wp-content/uploads/2026/09/2026-Voter-Information-Pamphlet.pdf",
			pageUrl: "https://vote.utah.gov/wp-content/uploads/2026/09/2026-Voter-Information-Pamphlet.pdf#page=6",
			title: "2026 congressional candidate submissions",
			publisher: "Utah Office of the Lieutenant Governor",
			kind: "candidate-statement",
		}],
	},
	{
		id: "ak-statewide-statements-2026",
		stateCode: "AK",
		electionDate: "2026-11-03",
		documents: ([
			["Dave Bronson", "https://elections.alaska.gov/doc/oep/2026/Bronson,%20Dave_Governor_Eng_v3.pdf"],
			["Josh Church", "https://elections.alaska.gov/doc/oep/2026/Church,%20Josh%20J_Lt.%20Governor_Eng_v2.pdf"],
			["Jonathan S. Kreiss-Tomkins", "https://elections.alaska.gov/doc/oep/2026/KREISS-TOMKINS,%20JONATHAN%20S.%20JKT_Gov_Eng_v4.pdf"],
			["Zac Johnson", "https://elections.alaska.gov/doc/oep/2026/JOHNSON,%20ZAC_Lt%20Gov_Eng_v2.pdf"],
			["Treg Taylor", "https://elections.alaska.gov/doc/oep/2026/TAYLOR,%20TREG_Gov_Eng_v1.pdf"],
			["Candi English", "https://elections.alaska.gov/doc/oep/2026/CANDI,%20ENGLISH_%20Lt%20Governor_%20Eng_v2.pdf"],
			["Bernadette M. Wilson", "https://elections.alaska.gov/doc/oep/2026/WILSON,%20BERNADETTE_Gov_Eng_v2.pdf"],
			["Michael K. Shower", "https://elections.alaska.gov/doc/oep/2026/SHOWER%20,%20MICHAEL%20K_%20Lt%20Governor_%20Eng_v1.pdf"],
			["Mary Peltola", "https://elections.alaska.gov/doc/oep/2026/PELTOLA,MARY_US%20Sen_Eng_v1.pdf"],
			["Dan S. Sullivan", "https://elections.alaska.gov/doc/oep/2026/SULLIVAN,%20DAN%20S_US%20Sen_Eng_v2.pdf"],
			["Daniel J. Sullivan Jr.", "https://elections.alaska.gov/doc/oep/2026/SULLIVAN,%20DANIEL%20J.%20JR%20_US%20Sen_Eng_v1.pdf"],
			["Nick Begich", "https://elections.alaska.gov/doc/oep/2026/BEGICH,%20NICK_US%20Rep_Eng_v1.pdf"],
			["Eric Hafner", "https://elections.alaska.gov/doc/oep/2026/HAFNER,%20ERIC_US%20Rep_Eng_v1.pdf"],
			["Bill Hill", "https://elections.alaska.gov/doc/oep/2026/HILL,%20BILL_US%20Rep_Eng_v2.pdf"],
			["James C. McDermott", "https://elections.alaska.gov/doc/oep/2026/Mcdermott,%20James%20C_%20USRep_Eng_v2.pdf"],
		] as const).map(([name, url]) => ({ url, title: `${name} candidate statement`, publisher: "Alaska Division of Elections", kind: "candidate-statement" as const })),
	},
	{
		id: "or-eastern-statements-2026",
		stateCode: "OR",
		electionDate: "2026-11-03",
		documents: [{
			url: "https://sos.oregon.gov/elections/Voters-Pamphlet/Documents/VP_G26-Book19_web.pdf",
			pageUrl: "https://sos.oregon.gov/elections/Voters-Pamphlet/Documents/VP_G26-Book19_web.pdf#page=29",
			title: "2026 candidate statements: Baker, Grant, Harney, Lake and Malheur",
			publisher: "Oregon Secretary of State",
			kind: "candidate-statement",
		}],
	},
	{
		id: "nc-judicial-statements-2026",
		stateCode: "NC",
		electionDate: "2026-11-03",
		documents: [{
			url: "https://www.ncsbe.gov/voting/upcoming-election/judicial-voter-guide-2026-general-election",
			title: "2026 judicial candidate submissions",
			publisher: "North Carolina State Board of Elections",
			kind: "candidate-statement",
		}],
	},
	{
		id: "nm-supreme-biographies-2026",
		stateCode: "NM",
		electionDate: "2026-11-03",
		documents: [{
			url: "https://supremecourt.nmcourts.gov/about-this-court/supreme-court-justices/",
			title: "New Mexico Supreme Court biographies",
			publisher: "New Mexico Judicial Branch",
			kind: "official-biography",
		}],
	},
	{
		id: "la-senate-reporting-2026",
		stateCode: "LA",
		electionDate: "2026-11-03",
		documents: [{
			url: "https://louisianaradionetwork.com/2026/09/17/48229/",
			title: "Bill Cassidy does not plan to endorse Julia Letlow in upcoming U.S. Senate election",
			publisher: "Louisiana Radio Network",
			kind: "news-report",
			publishedDate: "2026-09-17",
		}],
	},
	{
		id: "me-orono-statements-2026",
		stateCode: "ME",
		electionDate: "2026-11-03",
		documents: [
			{ url: "https://www.orono.org/DocumentCenter/View/14007/Devon-Biggie---Candidate-Bio?bidId=", title: "Devon Biggie candidate statement", publisher: "Town of Orono", kind: "candidate-statement" },
			{ url: "https://www.orono.org/DocumentCenter/View/14063/Dan-Council-Bio-2026?bidId=", title: "Daniel Demeritt candidate statement", publisher: "Town of Orono", kind: "candidate-statement" },
			{ url: "https://www.orono.org/DocumentCenter/View/14048/Matt-Biddle---Candidate-Bio?bidId=", title: "Matt Biddle candidate statement", publisher: "Town of Orono", kind: "candidate-statement" },
		],
	},
	{
		id: "wa-congressional-statements-2026",
		stateCode: "WA",
		electionDate: "2026-11-03",
		documents: [186947, 186948, 186949, 186950, 186951, 186952, 186953, 186954, 186955, 186956].map((race, index) => ({
			url: `https://voter.votewa.gov/elections/candidate.ashx?e=899&r=${race}&b=0&la=en&c=`,
			pageUrl: `https://voter.votewa.gov/genericvoterguide.aspx?e=899&c=#/candidates/${race}`,
			title: `Congressional District ${index + 1} candidate statements`,
			publisher: "Washington Secretary of State / VoteWA",
			kind: "candidate-statement" as const,
		})),
	},
];
