export interface StateBallotQuestion {
	id: string;
	audience: string;
	title: string;
	officialText: string;
	choices: [string, string, ...string[]];
	pages: number[];
	sourceUrl?: string;
	explicitlyAdvisory: boolean;
	voterApplicabilityVerified: false;
}
