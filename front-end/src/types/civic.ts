export type SourceType
	= | "campaign filing"
		| "ethics filing"
		| "hearing transcript"
		| "official record"
		| "policy memo"
		| "questionnaire"
		| "research brief"
		| "voter guide";

export type SourceAuthority
	= | "ballot-clarity-archive"
		| "candidate-campaign"
		| "commercial-provider"
		| "nonprofit-provider"
		| "official-government"
		| "open-data";

export interface Source {
	id: string;
	title: string;
	publisher: string;
	type: SourceType;
	authority: SourceAuthority;
	sourceSystem: string;
	date: string;
	url: string;
	note?: string;
}

export interface SourceCitationTarget {
	id: string;
	label: string;
	href: string;
	type: "candidate" | "contest" | "election" | "jurisdiction" | "measure";
}

export interface SourceDirectoryItem extends Source {
	citationCount: number;
	citedBy: SourceCitationTarget[];
}

export interface SourcesDirectoryResponse {
	sources: SourceDirectoryItem[];
	updatedAt: string;
}

export interface SourceRecordResponse {
	source: SourceDirectoryItem;
	updatedAt: string;
}

export interface OfficialResource {
	label: string;
	url: string;
	sourceLabel: string;
	authority: SourceAuthority;
	sourceSystem: string;
	note?: string;
}

export interface ExternalLink {
	label: string;
	url: string;
	note?: string;
}

export interface ElectionKeyDate {
	label: string;
	date: string;
	note?: string;
}

export interface ChangeLogEntry {
	id: string;
	date: string;
	summary: string;
}

export interface ElectionOffice {
	name: string;
	address: string;
	phone: string;
	email: string;
	website: string;
	hours: string;
}

export interface VotingMethod {
	slug: string;
	title: string;
	summary: string;
	details: string[];
	officialResource?: OfficialResource;
}

export interface ArchivedGuide {
	id: string;
	title: string;
	date: string;
	href: string;
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

export interface MeasureChangeItem {
	id: string;
	text: string;
	sources: Source[];
}

export interface MeasureTimelineItem {
	id: string;
	label: string;
	timing: string;
	summary: string;
	sources: Source[];
}

export interface MeasureFiscalItem {
	id: string;
	label: string;
	value: string;
	scope: string;
	horizon: string;
	note: string;
	sources: Source[];
}

export interface MeasureArgument {
	id: string;
	title: string;
	summary: string;
	attribution: string;
	sources: Source[];
}

export interface AlignmentModule {
	status: "not-live";
	summary: string;
	considerations: string[];
}

export type FreshnessStatus = "incomplete" | "out-of-date" | "up-to-date" | "updating";

export interface FreshnessMeta {
	contentLastVerifiedAt: string;
	dataLastUpdatedAt?: string;
	nextReviewAt: string;
	status: FreshnessStatus;
	statusLabel: string;
	statusNote: string;
}

export interface TrustBullet {
	id: string;
	text: string;
	note?: string;
	sources: Source[];
}

export type GraphicsTone = "accent" | "neutral" | "warning";
export type DataConfidence = "high" | "low" | "medium";
export type DataLinkageType = "crosswalked" | "direct" | "inferred";

export interface FactStat {
	label: string;
	value: number | string;
	detail: string;
}

export interface GraphicsBadge {
	label: string;
	title?: string;
	tone?: GraphicsTone;
}

export interface ProvenanceSummary {
	title: string;
	eyebrow?: string;
	note?: string;
	badges?: GraphicsBadge[];
	items: FactStat[];
	uncertainty?: string;
	sources: Source[];
}

export interface OfficeContext {
	title: string;
	summary: string;
	eyebrow?: string;
	officeLabel?: string;
	whyItMatters?: string;
	responsibilities: string[];
	badges?: GraphicsBadge[];
	stats?: FactStat[];
	sources?: Source[];
	sourceButtonLabel?: string;
	uncertainty?: string;
}

export type LookupAvailabilityStatus = "available" | "partial" | "unavailable";

export interface LookupAvailability {
	label: string;
	status: LookupAvailabilityStatus;
	detail: string;
	sources?: Source[];
	confidence?: DataConfidence;
	note?: string;
}

export interface RepresentativeCard {
	id: string;
	name: string;
	officeTitle: string;
	districtLabel: string;
	party?: string;
	summary?: string;
	href?: string;
	sourceLabel?: string;
	sourceSystem?: string;
	openstatesUrl?: string;
	updatedAt?: string;
	badges?: GraphicsBadge[];
	sources?: Source[];
	confidence?: DataConfidence;
	linkageType?: DataLinkageType;
	uncertainty?: string;
}

export interface TimelineEvent {
	id: string;
	date: string;
	title: string;
	summary: string;
	detail?: string;
	sources?: Source[];
	confidence?: DataConfidence;
	uncertainty?: string;
}

export interface ComparisonMatrixColumn {
	id: string;
	label: string;
	meta?: string;
	badges?: GraphicsBadge[];
	sources?: Source[];
}

export interface ComparisonMatrixCell {
	columnId: string;
	value: string;
	note?: string;
	sources?: Source[];
}

export interface ComparisonMatrixRow {
	id: string;
	label: string;
	note?: string;
	cells: ComparisonMatrixCell[];
}

export interface ComparisonMatrixData {
	title: string;
	eyebrow?: string;
	note?: string;
	columns: ComparisonMatrixColumn[];
	rows: ComparisonMatrixRow[];
	uncertainty?: string;
}

export interface EvidenceCompleteness {
	title?: string;
	note?: string;
	freshness: FreshnessMeta;
	known: TrustBullet[];
	unknown: TrustBullet[];
	sources?: Source[];
	uncertainty?: string;
}

export interface BeforeAfterItem {
	id: string;
	text: string;
	sources?: Source[];
}

export interface BeforeAfterData {
	title: string;
	eyebrow?: string;
	beforeLabel?: string;
	beforeSummary?: string;
	beforeItems: BeforeAfterItem[];
	afterLabel?: string;
	afterSummary?: string;
	afterItems: BeforeAfterItem[];
	sources?: Source[];
	sourceButtonLabel?: string;
	uncertainty?: string;
}

export interface MeasureImpactPathItem {
	id: string;
	text: string;
	sources?: Source[];
}

export interface MeasureImpactFiscalItem {
	id: string;
	label: string;
	value: string;
	detail: string;
	sources?: Source[];
}

export interface MeasureImpactPath {
	label: string;
	title: string;
	summary: string;
	items: MeasureImpactPathItem[];
	sources?: Source[];
}

export interface MeasureImpact {
	title: string;
	note: string;
	currentPath: MeasureImpactPath;
	yesPath: MeasureImpactPath;
	noPath: MeasureImpactPath;
	implementationSummary: string;
	implementationTimeline: TimelineEvent[];
	fiscalSummary: string;
	fiscalItems: MeasureImpactFiscalItem[];
	uncertainty?: string;
}

export interface FinanceCategoryAmount {
	label: string;
	amount: number;
	note?: string;
}

export interface FinanceCategoryBreakdown {
	cycleLabel: string;
	totalAmount: number;
	categories: FinanceCategoryAmount[];
	sourceLabel: string;
	coverageNote: string;
	confidence: DataConfidence;
	linkageType: DataLinkageType;
	disclaimer: string;
	sources?: Source[];
}

export interface InfluenceDisclosureSummary {
	lobbyingOrganizations: string[];
	issueAreas: string[];
	sourceCount: number;
	sourceLabel: string;
	coverageNote: string;
	confidence: DataConfidence;
	linkageType: DataLinkageType;
	disclaimer: string;
	sources?: Source[];
}

export interface SourceDensityEntity {
	id: string;
	label: string;
	count: number;
	detail: string;
	sources?: Source[];
	uncertainty?: string;
}

export type ComparisonProvenanceStatus
	= | "candidate-quoted"
		| "candidate-submitted"
		| "unclear"
		| "verified-official";

export interface ComparisonProvenance {
	status: ComparisonProvenanceStatus;
	label: string;
	detail: string;
	capturedAt?: string;
}

export interface CandidateLink {
	label: string;
	url: string;
	note?: string;
}

export interface ComparableStatement {
	id: string;
	text: string | null;
	provenance: ComparisonProvenance;
	sources: Source[];
}

export interface CandidateBallotStatus {
	status: "on-ballot-verified" | "unknown";
	asOf: string;
	label: string;
	provenance: ComparisonProvenance;
	sources: Source[];
}

export interface QuestionnaireResponse {
	questionId: string;
	category: string;
	questionPrompt: string;
	answerType: "short-text" | "yes-no-explanation";
	answerText: string | null;
	responseStatus: "answered" | "no-response" | "unclear";
	answerReceivedAt?: string;
	provenance: ComparisonProvenance;
	sources: Source[];
}

export interface CandidateComparisonProfile {
	ballotName: string;
	displayName: string;
	ballotOrder: number;
	partyOnBallot: string;
	campaignWebsiteUrl: string;
	contactChannels: CandidateLink[];
	ballotStatus: CandidateBallotStatus;
	whyRunning: ComparableStatement;
	topPriorities: ComparableStatement[];
	questionnaireResponses: QuestionnaireResponse[];
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
	freshness: FreshnessMeta;
	whatWeKnow: TrustBullet[];
	whatWeDoNotKnow: TrustBullet[];
	methodologyNotes: string[];
	comparison: CandidateComparisonProfile;
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
	currentLawOverview: string;
	currentPractice: MeasureChangeItem[];
	proposedChanges: MeasureChangeItem[];
	yesMeaning: string;
	noMeaning: string;
	yesHighlights: string[];
	noHighlights: string[];
	fiscalContextNote: string;
	implementationOverview: string;
	implementationTimeline: MeasureTimelineItem[];
	fiscalSummary: MeasureFiscalItem[];
	potentialImpacts: EvidenceBlock[];
	supportArguments: MeasureArgument[];
	opposeArguments: MeasureArgument[];
	argumentsDisclaimer: string;
	argumentsAndConsiderations: EvidenceBlock[];
	freshness: FreshnessMeta;
	whatWeKnow: TrustBullet[];
	whatWeDoNotKnow: TrustBullet[];
	sources: Source[];
	updatedAt: string;
}

export interface ContestRoleGuide {
	summary: string;
	whyItMatters: string;
	decisionAreas: string[];
}

export interface Contest {
	slug: string;
	title: string;
	office: string;
	jurisdiction: "Federal" | "State" | "Local" | "Ballot measure";
	type: "candidate" | "measure";
	description: string;
	roleGuide: ContestRoleGuide;
	candidates?: Candidate[];
	measures?: Measure[];
}

export interface ElectionSummary {
	slug: string;
	name: string;
	date: string;
	jurisdictionSlug: string;
	locationName: string;
	updatedAt: string;
}

export interface Election extends ElectionSummary {
	description: string;
	contests: Contest[];
	freshness: FreshnessMeta;
	keyDates: ElectionKeyDate[];
	officialResources: OfficialResource[];
	changeLog: ChangeLogEntry[];
}

export interface LocationSelection {
	slug: string;
	displayName: string;
	state: string;
	coverageLabel: string;
	lookupMode?: "address-submitted" | "address-verified" | "coverage-selection" | "zip-preview";
	requiresOfficialConfirmation?: boolean;
	lookupInput?: string;
}

export interface LocationDistrictMatch {
	id: string;
	label: string;
	districtType: string;
	districtCode: string;
	sourceSystem: string;
}

export interface LocationRepresentativeMatch extends RepresentativeCard {
	id: string;
	name: string;
	party?: string;
	officeTitle: string;
	districtLabel: string;
	sourceSystem: string;
	openstatesUrl?: string;
}

export type LocationLookupActionKind = "ballot-guide" | "official-verification";
export type LocationLookupInputKind = "address" | "zip";
export type LocationLookupResult = "resolved" | "unsupported";
export type LocationGuideAvailability = "published" | "not-published";
export type LocationDataAvailabilityStatus = LookupAvailabilityStatus;

export interface LocationDataAvailabilityItem extends LookupAvailability {}

export interface LocationDataAvailabilitySummary {
	nationwideCivicResults: LocationDataAvailabilityItem;
	representatives: LocationDataAvailabilityItem;
	ballotCandidates: LocationDataAvailabilityItem;
	financeInfluence: LocationDataAvailabilityItem;
	fullLocalGuide: LocationDataAvailabilityItem;
}

export interface LocationLookupAction {
	id: string;
	kind: LocationLookupActionKind;
	title: string;
	description: string;
	badge?: string;
	electionSlug?: string;
	location?: LocationSelection;
	url?: string;
}

export interface LocationLookupSelectionOption {
	id: string;
	label: string;
	description: string;
	guideAvailability: LocationGuideAvailability;
	districtMatches?: LocationDistrictMatch[];
	representativeMatches?: LocationRepresentativeMatch[];
}

export interface LocationLookupResponse {
	result: LocationLookupResult;
	inputKind: LocationLookupInputKind;
	note: string;
	lookupQuery?: string;
	detectedFromIp?: boolean;
	guideAvailability?: LocationGuideAvailability;
	availability?: LocationDataAvailabilitySummary;
	location?: LocationSelection;
	electionSlug?: string;
	actions?: LocationLookupAction[];
	selectionOptions?: LocationLookupSelectionOption[];
	normalizedAddress?: string;
	districtMatches?: LocationDistrictMatch[];
	representativeMatches?: LocationRepresentativeMatch[];
	fromCache?: boolean;
}

export interface NationwideLookupResultContext {
	result: LocationLookupResult;
	inputKind: LocationLookupInputKind;
	note: string;
	lookupQuery?: string;
	detectedFromIp?: boolean;
	guideAvailability?: LocationGuideAvailability;
	availability: LocationDataAvailabilitySummary | null;
	location: LocationSelection | null;
	election: ElectionSummary | null;
	electionSlug?: string;
	actions: LocationLookupAction[];
	selectionOptions: LocationLookupSelectionOption[];
	normalizedAddress: string;
	districtMatches: LocationDistrictMatch[];
	representativeMatches: LocationRepresentativeMatch[];
	fromCache: boolean;
}

export interface ElectionsResponse {
	elections: ElectionSummary[];
}

export interface JurisdictionSummary {
	slug: string;
	name: string;
	displayName: string;
	state: string;
	jurisdictionType: string;
	description: string;
	nextElectionName: string;
	nextElectionSlug: string;
	updatedAt: string;
}

export interface Jurisdiction extends JurisdictionSummary {
	officialOffice: ElectionOffice;
	officialResources: OfficialResource[];
	votingMethods: VotingMethod[];
	upcomingElections: ElectionSummary[];
	archivedGuides: ArchivedGuide[];
	coverageNotes: string[];
}

export interface JurisdictionsResponse {
	jurisdictions: JurisdictionSummary[];
}

export type DataSourceOptionStatus = "planned-live" | "reference-pattern" | "research-layer";

export interface DataSourceOption {
	id: string;
	name: string;
	authority: SourceAuthority;
	status: DataSourceOptionStatus;
	accessMethod: string;
	coverage: string;
	updatePattern: string;
	summary: string;
	bestUse: string;
	notes: string[];
	links?: ExternalLink[];
}

export interface DataSourceCategory {
	slug: string;
	title: string;
	summary: string;
	authoritativeRule: string;
	liveApproach: string;
	options: DataSourceOption[];
}

export interface DataArchitectureStage {
	id: string;
	title: string;
	summary: string;
	details: string[];
}

export interface DataMigrationWatchItem {
	id: string;
	title: string;
	summary: string;
	implication: string;
}

export interface DataRoadmapMilestone {
	id: string;
	title: string;
	summary: string;
}

export interface DataSourcesResponse {
	updatedAt: string;
	principles: string[];
	categories: DataSourceCategory[];
	architectureStages: DataArchitectureStage[];
	migrationWatch: DataMigrationWatchItem[];
	roadmap: DataRoadmapMilestone[];
	launchTarget?: LaunchTargetProfile;
}

export type LaunchTargetPhase = "launching" | "planning" | "public-archive";

export interface LaunchTargetProfile {
	slug: string;
	name: string;
	displayName: string;
	state: string;
	phase: LaunchTargetPhase;
	phaseLabel: string;
	summary: string;
	currentElectionName: string;
	currentElectionDate: string;
	nextElectionName?: string;
	nextElectionDate?: string;
	officialResources: OfficialResource[];
	referenceLinks: ExternalLink[];
}

export type CoverageCapabilityStatus = "in-build" | "live-now" | "planned";

export interface CoverageCapability {
	id: string;
	label: string;
	status: CoverageCapabilityStatus;
	summary: string;
}

export interface CoverageCollection {
	id: string;
	label: string;
	status: "canonical" | "reference";
	summary: string;
	href: string;
}

export interface CoverageLimitation {
	id: string;
	title: string;
	summary: string;
}

export interface CoverageResponse {
	updatedAt: string;
	coverageMode: "empty" | "snapshot";
	coverageUpdatedAt: string;
	launchTarget?: LaunchTargetProfile;
	scopeNote: string;
	currentState: string;
	supportedContentTypes: CoverageCapability[];
	limitations: CoverageLimitation[];
	nextSteps: string[];
	collections: CoverageCollection[];
}

export type PublicOperationalStatus = "degraded" | "healthy" | "reviewing";

export interface PublicStatusSourceItem {
	id: string;
	label: string;
	authority: SourceAuthority;
	health: AdminSourceHealth;
	lastCheckedAt: string;
	nextCheckAt: string;
	note: string;
}

export interface PublicStatusNotice {
	id: string;
	title: string;
	summary: string;
}

export interface PublicStatusResponse {
	updatedAt: string;
	overallStatus: PublicOperationalStatus;
	coverageMode: "empty" | "snapshot";
	coverageUpdatedAt: string;
	sourceSummary: Record<AdminSourceHealth, number>;
	nextReviewAt?: string;
	nextPublishWindow?: string;
	notes: string[];
	incidents: PublicStatusNotice[];
	sources: PublicStatusSourceItem[];
}

export interface PublicCorrectionItem {
	id: string;
	subject: string;
	entityType: AdminEntityType;
	entityLabel: string;
	status: AdminCorrectionStatus;
	priority: AdminPriority;
	submittedAt: string;
	pageUrl?: string;
	pageLabel?: string;
	summary: string;
	outcome: string;
}

export interface PublicCorrectionsResponse {
	updatedAt: string;
	corrections: PublicCorrectionItem[];
}

export interface ContestLinkSummary {
	slug: string;
	title: string;
	office: string;
	jurisdiction: Contest["jurisdiction"];
	type: Contest["type"];
	href: string;
}

export interface ContestRecordResponse {
	contest: Contest;
	election: ElectionSummary;
	jurisdiction: JurisdictionSummary;
	updatedAt: string;
	note: string;
	sourceCount: number;
	sources: Source[];
	relatedContests: ContestLinkSummary[];
}

export interface DistrictSummary {
	slug: string;
	title: string;
	office: string;
	jurisdiction: Contest["jurisdiction"];
	summary: string;
	representativeCount: number;
	candidateCount: number;
	href: string;
	updatedAt: string;
}

export interface RepresentativeSummary extends RepresentativeCard {
	slug: string;
	name: string;
	party: string;
	officeSought: string;
	districtSlug: string;
	districtLabel: string;
	href: string;
	incumbent: boolean;
	summary: string;
	fundingSummary: string;
	influenceSummary: string;
	updatedAt: string;
	sourceCount: number;
}

export interface DistrictRecordResponse {
	district: DistrictSummary & {
		description: string;
		roleGuide: ContestRoleGuide;
		electionSlug: string;
	};
	election: ElectionSummary;
	updatedAt: string;
	note: string;
	candidates: Candidate[];
	representatives: RepresentativeSummary[];
	sources: Source[];
	relatedContests: ContestLinkSummary[];
}

export interface DistrictsResponse {
	updatedAt: string;
	note: string;
	districts: DistrictSummary[];
}

export interface RepresentativesResponse {
	updatedAt: string;
	note: string;
	representatives: RepresentativeSummary[];
	districts: DistrictSummary[];
}

export interface BallotResponse {
	location: LocationSelection;
	election: Election;
	updatedAt: string;
	note: string;
}

export interface CompareResponse {
	requestedSlugs: string[];
	contestSlug: string | null;
	office: string | null;
	sameContest: boolean;
	candidates: Candidate[];
	note: string;
}

export type SearchResultType = "candidate" | "contest" | "district" | "election" | "jurisdiction" | "measure" | "source";

export interface SearchResultItem {
	id: string;
	type: SearchResultType;
	title: string;
	summary: string;
	href: string;
	meta: string;
	updatedAt?: string;
	sourceCount?: number;
	authority?: SourceAuthority;
}

export interface SearchResultGroup {
	label: string;
	type: SearchResultType;
	items: SearchResultItem[];
}

export interface SearchResponse {
	query: string;
	total: number;
	groups: SearchResultGroup[];
	suggestions: string[];
}

export type AdminPriority = "high" | "medium" | "low";

export type AdminUserRole = "admin" | "editor";

export type AdminSignalTone = "attention" | "healthy" | "review";

export type AdminReviewStatus
	= | "draft"
		| "in-review"
		| "needs-sources"
		| "ready-to-publish"
		| "published";

export type AdminCorrectionStatus = "new" | "researching" | "resolved" | "triaged";

export type AdminSourceHealth = "healthy" | "incident" | "review-soon" | "stale";

export type AdminEntityType = "candidate" | "election" | "measure" | "policy";

export type AdminActivityType = "correction" | "publish" | "review" | "source-check";

export type AdminSubmissionType = "correction" | "feedback";

export interface AdminDashboardMetric {
	id: string;
	label: string;
	value: string;
	helpText: string;
	tone: AdminSignalTone;
}

export interface AdminCorrectionRequest {
	id: string;
	submissionType: AdminSubmissionType;
	subject: string;
	entityType: AdminEntityType;
	entityLabel: string;
	status: AdminCorrectionStatus;
	priority: AdminPriority;
	submittedAt: string;
	reportedBy: string;
	summary: string;
	nextStep: string;
	sourceCount: number;
	pageUrl?: string;
}

export interface AdminReviewItem {
	id: string;
	title: string;
	entityType: AdminEntityType;
	status: AdminReviewStatus;
	priority: AdminPriority;
	updatedAt: string;
	assignedTo: string;
	blocker?: string;
	summary: string;
	sourceCoverage: string;
}

export interface AdminContentItem {
	id: string;
	title: string;
	entityType: AdminEntityType;
	entitySlug: string;
	status: AdminReviewStatus;
	priority: AdminPriority;
	updatedAt: string;
	assignedTo: string;
	blocker?: string;
	summary: string;
	publicSummary: string;
	publicBallotSummary?: string;
	sourceCoverage: string;
	published: boolean;
	publishedAt?: string;
}

export interface AdminSourceMonitorItem {
	id: string;
	label: string;
	authority: SourceAuthority;
	health: AdminSourceHealth;
	lastCheckedAt: string;
	nextCheckAt: string;
	owner: string;
	note: string;
}

export interface AdminActivityItem {
	id: string;
	label: string;
	type: AdminActivityType;
	timestamp: string;
	summary: string;
}

export interface AdminUser {
	id: string;
	username: string;
	displayName: string;
	role: AdminUserRole;
	createdAt: string;
	lastLoginAt?: string;
}

export interface AdminOverviewResponse {
	metrics: AdminDashboardMetric[];
	needsAttention: string[];
	recentActivity: AdminActivityItem[];
}

export interface AdminCorrectionsResponse {
	corrections: AdminCorrectionRequest[];
}

export interface AdminReviewResponse {
	items: AdminReviewItem[];
}

export interface AdminContentResponse {
	items: AdminContentItem[];
}

export interface AdminSourceMonitorResponse {
	sources: AdminSourceMonitorItem[];
}

export interface AdminUsersResponse {
	users: AdminUser[];
}

export interface AdminSessionResponse {
	authenticated: boolean;
	configured: boolean;
	displayName: string | null;
	role: AdminUserRole | null;
	username: string | null;
}

export type BallotViewMode = "deep" | "quick";

export interface PlannedCandidateChoice {
	type: "candidate";
	contestSlug: string;
	candidateSlug: string;
	savedAt: string;
}

export type PlannedMeasureDecision = "no" | "review" | "yes";

export interface PlannedMeasureChoice {
	type: "measure";
	contestSlug: string;
	measureSlug: string;
	decision: PlannedMeasureDecision;
	savedAt: string;
}

export type BallotPlanSelection = PlannedCandidateChoice | PlannedMeasureChoice;
