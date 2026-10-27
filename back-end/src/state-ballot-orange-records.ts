import type { readOrangeCandidateProof } from "./state-ballot-orange-proof.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { rejectOrange as reject, validateOrangeSource } from "./state-ballot-orange-discovery.js";

const statewideOffices = new Set(["Governor", "Lieutenant Governor", "Secretary of State", "Controller", "Treasurer", "Attorney General", "Insurance Commissioner"]);
export function orangeOfficeGeography(office: string, heading: string) {
	if ((statewideOffices.has(office) && heading === `Voter Nominated STATE ${office}`) || (office === "Superintendent of, Public Instruction" && heading === "Nonpartisan SCHOOL Superintendent of Public Instruction")) return { scope: "statewide" as const, district: "" };
	for (const [pattern, prefix, scope] of [
		[/^US Representative, ([1-9]\d?)(st|nd|rd|th) District$/u, "Voter Nominated UNITED STATES REPRESENTATIVE UNITED STATES REPRESENTATIVE", "congressional"],
		[/^State Senator, ([1-9]\d?)(st|nd|rd|th) District$/u, "Voter Nominated STATE SENATOR STATE SENATOR", "state-senate"],
		[/^State Assembly, ([1-9]\d?)(st|nd|rd|th) District$/u, "Voter Nominated MEMBER OF THE STATE ASSEMBLY MEMBER OF THE STATE ASSEMBLY", "state-house"],
	] as const) {
		const match = pattern.exec(office);
		if (match) {
			if (heading !== `${prefix} ${match[1]}${match[2]} District`) return reject();
			return { scope, district: match[1]! };
		}
	}
	if (!heading.startsWith("Nonpartisan ") && !/^Voter Nominated STATE Member, State Board of Equalization [1-9]\d?(?:st|nd|rd|th) District$/u.test(heading)) return reject();
	return { scope: "local" as const, district: "" };
}
export function orangeCandidateRecords(source: StateBallotSource, result: ReturnType<typeof readOrangeCandidateProof>, factory: typeof import("./state-ballot-records.js").createStateCandidateRecord) {
	validateOrangeSource(source);
	if (result.electionDate !== source.electionDate) return reject();
	const contests = new Map(result.contests.map(contest => [contest.id, contest]));
	const records = result.candidates.map((candidate) => {
		const contest = contests.get(candidate.contestId);
		const clock = result.printedClocks.find(clock => clock.page === candidate.page);
		if (!contest || contest.heading.length > 300 || !clock || candidate.qualifiedDate > clock.date || clock.date > source.electionDate) return reject();
		const record = factory(source, { name: candidate.name, party: candidate.party ?? "", office: contest.office, ...orangeOfficeGeography(contest.office, contest.heading), status: "Qualified", sourceCandidateId: `${contest.id}:${candidate.sourceCandidateId}`, sourceAreaLabel: contest.heading });
		if (!record) return reject();
		record.ballotDesignation = candidate.ballotDesignation;
		record.voteLimit = contest.voteFor;
		return record;
	});
	if (new Set(records.map(record => record.id)).size !== result.candidates.length) return reject();
	return records;
}
export function orangePublicationKey(value: string) {
	if (!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/u.test(value) || !Number.isFinite(Date.parse(`${value}Z`)) || new Date(`${value}Z`).toISOString() !== `${value}.000Z`) return reject();
	return value;
}
