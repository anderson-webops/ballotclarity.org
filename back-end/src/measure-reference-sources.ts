export interface MeasureReferenceSource {
	id: string;
	stateCode: string;
	electionDate: string;
	jurisdiction: string;
	argumentsNote: string;
	document: {
		url: string;
		pageUrl: string;
		title: string;
		publisher: string;
		publishedDate: string;
		pageCount: number;
	};
}

export const measureReferenceSources: readonly MeasureReferenceSource[] = [
	{
		id: "co-blue-book-2026",
		stateCode: "CO",
		electionDate: "2026-11-03",
		jurisdiction: "Colorado",
		argumentsNote: "Shortened from the arguments Colorado Legislative Council Staff wrote for each side.",
		document: {
			url: "https://content.leg.colorado.gov/sites/default/files/2026-blue-book-en-accessible.pdf",
			pageUrl: "https://content.leg.colorado.gov/publications/2026-blue-book",
			title: "2026 State Ballot Information Booklet (Blue Book)",
			publisher: "Colorado Legislative Council Staff",
			publishedDate: "2026-09-21",
			pageCount: 104,
		},
	},
];
