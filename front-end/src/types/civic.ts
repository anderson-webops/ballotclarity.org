export type SourceType
	= | "campaign filing"
		| "ethics filing"
		| "hearing transcript"
		| "official record"
		| "policy memo"
		| "questionnaire"
		| "research brief"
		| "voter guide";

export interface Source {
	id: string;
	title: string;
	publisher: string;
	type: SourceType;
	date: string;
	url: string;
	note?: string;
}

export interface IssueTag {
	slug: string;
	label: string;
}

export interface FundingLineItem {
	name: string;
	amount: number;
	category: string;
}

export interface FundingSummary {
	totalRaised: number;
	cashOnHand: number;
	smallDonorShare: number;
	summary: string;
	topFunders: FundingLineItem[];
	sources: Source[];
}

export interface VoteRecordSummary {
	id: string;
	title: string;
	date: string;
	summary: string;
	significance: string;
	sources: Source[];
}

export interface EvidenceBlock {
	id: string;
	title: string;
	summary: string;
	sources: Source[];
}

export interface AlignmentModule {
	status: "not-live";
	summary: string;
	considerations: string[];
}

export interface Candidate {
	slug: string;
	name: string;
	officeSought: string;
	contestSlug: string;
	party: string;
	incumbent: boolean;
	location: string;
	summary: string;
	ballotSummary: string;
	topIssues: IssueTag[];
	biography: EvidenceBlock[];
	keyActions: VoteRecordSummary[];
	funding: FundingSummary;
	lobbyingContext: EvidenceBlock[];
	publicStatements: EvidenceBlock[];
	alignmentModule: AlignmentModule;
	whatWeKnow: string[];
	whatWeDoNotKnow: string[];
	methodologyNotes: string[];
	sources: Source[];
	updatedAt: string;
}

export interface Measure {
	slug: string;
	title: string;
	contestSlug: string;
	location: string;
	summary: string;
	ballotSummary: string;
	plainLanguageExplanation: string;
	yesMeaning: string;
	noMeaning: string;
	fiscalContextNote: string;
	potentialImpacts: EvidenceBlock[];
	argumentsAndConsiderations: EvidenceBlock[];
	sources: Source[];
	updatedAt: string;
}

export interface Contest {
	slug: string;
	title: string;
	office: string;
	jurisdiction: "Federal" | "State" | "Local" | "Ballot measure";
	type: "candidate" | "measure";
	description: string;
	candidates?: Candidate[];
	measures?: Measure[];
}

export interface ElectionSummary {
	slug: string;
	name: string;
	date: string;
	locationName: string;
	updatedAt: string;
}

export interface Election extends ElectionSummary {
	description: string;
	contests: Contest[];
}

export interface LocationSelection {
	slug: string;
	displayName: string;
	state: string;
	coverageLabel: string;
	lookupInput?: string;
}

export interface LocationLookupResponse {
	location: LocationSelection;
	electionSlug: string;
	note: string;
}

export interface ElectionsResponse {
	elections: ElectionSummary[];
}

export interface BallotResponse {
	demo: true;
	location: LocationSelection;
	election: Election;
	updatedAt: string;
	note: string;
}

export interface CompareResponse {
	requestedSlugs: string[];
	office: string | null;
	candidates: Candidate[];
	note: string;
}
