import type { Election, Jurisdiction } from "./types/civic.js";
import { usStates } from "./us-states.js";

export type PublicBallotElection = Election & { includedStatewideElectionSlugs?: string[] };

function stateCode(value: string) {
	const normalized = value.trim().toLowerCase();
	return usStates.find(state => state[0].toLowerCase() === normalized || state[1].toLowerCase() === normalized)?.[0] ?? null;
}

export function includeStatewideMeasures(election: Election, jurisdictions: Jurisdiction[], publishedElections: Election[]): PublicBallotElection {
	const baseElection: PublicBallotElection = { ...election };
	delete baseElection.includedStatewideElectionSlugs;
	const jurisdiction = jurisdictions.find(item => item.slug === election.jurisdictionSlug);
	const localKinds = ["county", "parish", "borough", "city", "town", "township", "village", "school-district", "intermediate-school-district", "special-district", "municipality", "independent-city"];
	const code = jurisdiction ? stateCode(jurisdiction.state) : null;
	if (!jurisdiction || !code || !localKinds.includes(jurisdiction.jurisdictionType.trim().toLowerCase()) || !election.contests.length
		|| !/^\d{4}-\d{2}-\d{2}$/u.test(election.date) || !Number.isFinite(Date.parse(election.date)) || new Date(election.date).toISOString().slice(0, 10) !== election.date) {
		return baseElection;
	}
	const contestSlugs = new Set(election.contests.map(contest => contest.slug));
	const measureSlugs = new Set(election.contests.flatMap(contest => (contest.measures ?? []).map(measure => measure.slug)));
	const included: string[] = [];
	const statewideContests = publishedElections.flatMap((parent) => {
		const parentJurisdiction = jurisdictions.find(item => item.slug === parent.jurisdictionSlug);
		if (parent.slug === election.slug || parent.date !== election.date || parentJurisdiction?.jurisdictionType.trim().toLowerCase() !== "state" || stateCode(parentJurisdiction.state) !== code || parent.contests.some(contest => contest.type !== "measure"))
			return [];
		const contests = parent.contests.filter(contest => contest.type === "measure" && contest.measures?.length).map((contest) => {
			if (contestSlugs.has(contest.slug) || contest.measures!.some(measure => measureSlugs.has(measure.slug)))
				throw new Error("Published guide composition contains conflicting contest or measure identities.");
			contestSlugs.add(contest.slug);
			for (const measure of contest.measures!) measureSlugs.add(measure.slug);
			return { ...contest, measures: contest.measures!.map(measure => ({ ...measure, electionDate: parent.date, electionSlug: parent.slug })) };
		});
		if (contests.length) included.push(parent.slug);
		return contests;
	});
	if (!statewideContests.length) return baseElection;
	return { ...baseElection, contests: [...statewideContests, ...election.contests], includedStatewideElectionSlugs: included };
}

export function hasStatewideMeasureRollup(election: PublicBallotElection | null | undefined) {
	return Boolean(election?.includedStatewideElectionSlugs?.length);
}
