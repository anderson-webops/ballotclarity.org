import type {
	BallotPlanSelection,
	BallotViewMode,
	ElectionSummary,
	LocationSelection,
	PlannedMeasureDecision
} from "~/types/civic";

const civicStorageKey = "ballot-clarity:civic-store";

interface CivicStoreSnapshot {
	ballotPlan: Record<string, BallotPlanSelection>;
	ballotViewMode: BallotViewMode;
	compareList: string[];
	selectedElection: ElectionSummary | null;
	selectedIssues: string[];
	selectedLocation: LocationSelection | null;
}

function defaultSnapshot(): CivicStoreSnapshot {
	return {
		ballotPlan: {},
		ballotViewMode: "quick",
		compareList: [],
		selectedElection: null,
		selectedIssues: [],
		selectedLocation: null
	};
}

function sanitizeLocationSelection(location: LocationSelection | null) {
	if (!location)
		return null;

	const { lookupInput: _lookupInput, ...safeLocation } = location;

	return safeLocation;
}

function readSnapshot(): CivicStoreSnapshot {
	if (!import.meta.client)
		return defaultSnapshot();

	try {
		const raw = window.localStorage.getItem(civicStorageKey);

		if (!raw)
			return defaultSnapshot();

		const parsed = JSON.parse(raw) as Partial<CivicStoreSnapshot>;

		return {
			...defaultSnapshot(),
			...parsed,
			ballotPlan: parsed.ballotPlan ?? {}
		};
	}
	catch {
		return defaultSnapshot();
	}
}

export const useCivicStore = defineStore("civic", {
	state: () => ({
		ballotPlan: {} as Record<string, BallotPlanSelection>,
		ballotViewMode: "quick" as BallotViewMode,
		compareList: [] as string[],
		selectedElection: null as ElectionSummary | null,
		selectedIssues: [] as string[],
		selectedLocation: null as LocationSelection | null,
	}),
	getters: {
		ballotPlanCount: state => Object.keys(state.ballotPlan).length,
		compareCount: state => state.compareList.length,
	},
	actions: {
		clearBallotPlan() {
			this.ballotPlan = {};
			this.persist();
		},
		clearCompare() {
			this.compareList = [];
			this.persist();
		},
		clearIssues() {
			this.selectedIssues = [];
			this.persist();
		},
		clearPlannedContest(contestSlug: string) {
			const nextPlan = { ...this.ballotPlan };
			delete nextPlan[contestSlug];
			this.ballotPlan = nextPlan;
			this.persist();
		},
		hydrateFromStorage() {
			const snapshot = readSnapshot();
			this.ballotPlan = snapshot.ballotPlan;
			this.ballotViewMode = snapshot.ballotViewMode;
			this.compareList = snapshot.compareList;
			this.selectedElection = snapshot.selectedElection;
			this.selectedIssues = snapshot.selectedIssues;
			this.selectedLocation = sanitizeLocationSelection(snapshot.selectedLocation);
		},
		persist() {
			if (!import.meta.client)
				return;

			window.localStorage.setItem(civicStorageKey, JSON.stringify({
				ballotPlan: this.ballotPlan,
				ballotViewMode: this.ballotViewMode,
				compareList: this.compareList,
				selectedElection: this.selectedElection,
				selectedIssues: this.selectedIssues,
				selectedLocation: sanitizeLocationSelection(this.selectedLocation)
			} satisfies CivicStoreSnapshot));
		},
		removeFromCompare(slug: string) {
			this.compareList = this.compareList.filter(item => item !== slug);
			this.persist();
		},
		replaceCompare(slugs: string[]) {
			this.compareList = Array.from(new Set(slugs)).slice(0, 3);
			this.persist();
		},
		selectCandidateForPlan(contestSlug: string, candidateSlug: string) {
			this.ballotPlan = {
				...this.ballotPlan,
				[contestSlug]: {
					candidateSlug,
					contestSlug,
					savedAt: new Date().toISOString(),
					type: "candidate"
				}
			};
			this.persist();
		},
		selectMeasureForPlan(contestSlug: string, measureSlug: string, decision: PlannedMeasureDecision) {
			this.ballotPlan = {
				...this.ballotPlan,
				[contestSlug]: {
					contestSlug,
					decision,
					measureSlug,
					savedAt: new Date().toISOString(),
					type: "measure"
				}
			};
			this.persist();
		},
		setElection(election: ElectionSummary | null) {
			this.selectedElection = election;
			this.persist();
		},
		setLocation(location: LocationSelection | null) {
			this.selectedLocation = location;
			this.persist();
		},
		setBallotViewMode(mode: BallotViewMode) {
			this.ballotViewMode = mode;
			this.persist();
		},
		toggleCompare(slug: string) {
			if (this.compareList.includes(slug)) {
				this.compareList = this.compareList.filter(item => item !== slug);
				this.persist();
				return;
			}

			if (this.compareList.length < 3)
				this.compareList = [...this.compareList, slug];

			this.persist();
		},
		toggleIssue(issue: string) {
			if (this.selectedIssues.includes(issue)) {
				this.selectedIssues = this.selectedIssues.filter(item => item !== issue);
				this.persist();
				return;
			}

			this.selectedIssues = [...this.selectedIssues, issue];
			this.persist();
		},
	},
});
