import type { ElectionSummary, LocationSelection } from "~/types/civic";

export const useCivicStore = defineStore("civic", {
	state: () => ({
		compareList: [] as string[],
		selectedElection: null as ElectionSummary | null,
		selectedIssues: [] as string[],
		selectedLocation: null as LocationSelection | null,
	}),
	getters: {
		compareCount: state => state.compareList.length,
	},
	actions: {
		clearCompare() {
			this.compareList = [];
		},
		clearIssues() {
			this.selectedIssues = [];
		},
		removeFromCompare(slug: string) {
			this.compareList = this.compareList.filter(item => item !== slug);
		},
		replaceCompare(slugs: string[]) {
			this.compareList = Array.from(new Set(slugs)).slice(0, 3);
		},
		setElection(election: ElectionSummary | null) {
			this.selectedElection = election;
		},
		setLocation(location: LocationSelection | null) {
			this.selectedLocation = location;
		},
		toggleCompare(slug: string) {
			if (this.compareList.includes(slug)) {
				this.compareList = this.compareList.filter(item => item !== slug);
				return;
			}

			if (this.compareList.length < 3)
				this.compareList = [...this.compareList, slug];
		},
		toggleIssue(issue: string) {
			if (this.selectedIssues.includes(issue)) {
				this.selectedIssues = this.selectedIssues.filter(item => item !== issue);
				return;
			}

			this.selectedIssues = [...this.selectedIssues, issue];
		},
	},
});
