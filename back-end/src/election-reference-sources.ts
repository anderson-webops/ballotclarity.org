export interface ElectionReferenceSource {
	id: string;
	stateCode: string;
	electionDate: string;
	documents: readonly {
		url: string;
		pageUrl?: string;
		title: string;
		publisher: string;
		kind: "candidate-statement" | "news-report";
		publishedDate?: string;
	}[];
}

export const electionReferenceSources: readonly ElectionReferenceSource[] = [
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
