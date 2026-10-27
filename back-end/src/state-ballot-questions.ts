export interface StateBallotQuestion {
	id: string;
	audience: string;
	title: string;
	officialText: string;
	choices: [string, string];
	pages: number[];
	explicitlyAdvisory: boolean;
	voterApplicabilityVerified: false;
}
