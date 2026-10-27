import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { ChicagoQuestion } from "./state-ballot-chicago.js";
import type { GoffstownField } from "./state-ballot-goffstown-native.js";
import type { StateCandidateRecord, StateContestScope } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { createHash } from "node:crypto";
import { goffstownNativePages, inspectGoffstownVisual, validateGoffstownVisual } from "./state-ballot-goffstown-native.js";

type Factory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;
function reject(): never {
	throw new Error("The Goffstown ballot fields require review.");
}
function rows(fields: readonly GoffstownField[]) {
	const result: GoffstownField[][] = [];
	for (const field of [...fields].sort((first, second) => first.top - second.top || first.left - second.left)) {
		const previous = result.at(-1);
		if (previous && field.top - previous[0]!.top <= 2) previous.push(field);
		else result.push([field]);
	}
	return result.map(row => row.sort((first, second) => first.left - second.left).map(field => field.text).join(" "));
}
function officeType(label: string): { office: string; scope: StateContestScope; district: string; sourceDistrictLabel?: string } {
	if (label === "Governor" || label === "United States Senator") return { office: label, scope: "statewide", district: "" };
	if (label === "Representative in Congress") return { office: label, scope: "congressional", district: "" };
	if (label === "State Senator") return { office: label, scope: "state-senate", district: "" };
	const house = /^State Representatives Hillsborough District ([1-9]\d{0,2})$/u.exec(label);
	if (house) return { office: `State Representatives, Hillsborough District ${house[1]}`, scope: "state-house", district: `HILLSBOROUGH-${house[1]}`, sourceDistrictLabel: `Hillsborough District ${house[1]}` };
	if (["Executive Councilor", "Sheriff", "County Attorney", "County Treasurer", "Register of Deeds", "Register of Probate", "County Commissioner"].includes(label)) return { office: label, scope: "local", district: "" };
	return reject();
}
function printedText(field: GoffstownField) {
	return field.family === "Helvetica-Condensed" ? field.text.replaceAll("<", "“").replaceAll("=", "”") : field.text;
}
export function readGoffstownBallotDocument(source: StateBallotSource, xml: string, svgPages: readonly string[], factory: Factory) {
	if (source.stateCode !== "NH" || !/^20\d{2}-11-0[2-8]$/u.test(source.electionDate) || Number(source.electionDate.slice(0, 4)) % 2 || new Date(`${source.electionDate}T00:00:00Z`).getUTCDay() !== 2 || svgPages.length !== 2) return reject();
	const pages = goffstownNativePages(xml);
	const visual = svgPages.map((svg, index) => validateGoffstownVisual(xml, svg, index + 1));
	const inspected = svgPages.map((svg, index) => inspectGoffstownVisual(xml, svg, index + 1));
	return { ...readGoffstownBallotFields(source, pages, inspected, factory), visual };
}
export function readGoffstownBallotFields(source: StateBallotSource, pages: readonly (readonly GoffstownField[])[], inspected: readonly { marks: readonly { left: number; top: number }[]; horizontalRules: readonly number[] }[], factory: Factory) {
	if (pages.length !== 2 || inspected.length !== 2) return reject();
	const first = pages[0]!;
	for (const label of ["GOFFSTOWN", "GENERAL ELECTION", `NOVEMBER ${Number(source.electionDate.slice(8))}, ${source.electionDate.slice(0, 4)}`, "SAMPLE"]) {
		if (first.filter(field => field.top < 195 && field.text === label && field.color === "#000000").length !== 1) return reject();
	}
	const headings = rows(first.filter(field => field.color === "#ffffff"));
	if (headings.join(" ") !== "Other Republican Democratic Write-in Offices Candidates Candidates Candidates Candidates") return reject();
	const rules = inspected[0]!.horizontalRules;
	if (rules.length < 8 || rules.length > 30 || rules.some((value, index) => index > 0 && value <= rules[index - 1]!)) return reject();
	const records: StateCandidateRecord[] = [];
	const claims: { recordId: string; name: string; party: string; page: number; office: string; voteLimit: number }[] = [];
	let top = 242;
	const wordNumbers = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
	for (const bottom of rules) {
		const fields = first.filter(field => field.top >= top && field.top + field.height <= bottom + 1);
		if (!fields.length) return reject();
		const left = fields.filter(field => field.left < 193);
		const label = left.filter(field => field.family === "HelveticaNeueLTStd-BdCn" && field.size === 18).map(field => field.text).join(" ");
		const office = officeType(label);
		const instructions = rows(left).join(" ");
		const limit = /Vote for up to ([1-9]|10)\s*;\s*(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten) will be elected$/u.exec(instructions);
		const voteLimit = limit ? Number(limit[1]) : instructions.endsWith("Vote for not more than 1") ? 1 : 0;
		if (!voteLimit || (limit && wordNumbers[voteLimit] !== limit[2]) || (office.scope === "state-house" && !limit) || (office.scope !== "state-house" && voteLimit !== 1)) return reject();
		const marks = inspected[0]!.marks.filter(mark => mark.top >= top && mark.top <= bottom);
		const centers = [352.6875, 525.9375, 699.1875, 846.5625];
		if (marks.some(mark => !centers.some(center => Math.abs(center - mark.left) < 0.01)) || new Set(marks.map(mark => `${mark.left}:${mark.top}`)).size !== marks.length) return reject();
		const candidateFields = fields.filter(field => field.left >= 193 && field.left < 716 && field.family === "HelveticaNeueLTStd-BdCn" && field.size === 18 && field.color === "#000000");
		const groups = new Map<typeof marks[number], GoffstownField[]>();
		const usedPartyLabels = new Set<GoffstownField>();
		for (const field of candidateFields) {
			const column = field.left < 368 ? 0 : field.left < 542 ? 1 : 2;
			const available = marks.filter(mark => Math.abs(mark.left - centers[column]!) < 0.01).sort((first, second) => Math.abs(first.top - (field.top + field.height / 2)) - Math.abs(second.top - (field.top + field.height / 2)));
			const nearest = available[0];
			if (!nearest || Math.abs(nearest.top - (field.top + field.height / 2)) > 25 || (available[1] && Math.abs(available[1].top - (field.top + field.height / 2)) - Math.abs(nearest.top - (field.top + field.height / 2)) < 1)) return reject();
			groups.set(nearest, [...(groups.get(nearest) ?? []), field]);
		}
		if (marks.filter(mark => mark.left < 800).length !== groups.size || !groups.size) return reject();
		for (const [mark, fields] of [...groups].sort(([first], [second]) => first.left - second.left || first.top - second.top)) {
			const name = rows(fields).join(" ");
			if (!/^[\p{L}\p{M} .,'’&-]+$/u.test(name) || name.length > 200 || !/\p{L}/u.test(name)) return reject();
			let party = mark.left > 600 ? "Democratic" : "Republican";
			if (mark.left < 400) {
				const labels = first.filter(field => field.left >= 193 && field.left < 368 && field.top >= top && field.top <= bottom && field.family === "Helvetica-Condensed" && field.color === "#000000" && field.top < Math.min(...fields.map(field => field.top)) && Math.min(...fields.map(field => field.top)) - field.top < 25);
				if (labels.length !== 1 || !["Libertarian", "Constitution", "Independent", "Green", "Socialist", "Working Families"].includes(labels[0]!.text)) return reject();
				usedPartyLabels.add(labels[0]!);
				party = labels[0]!.text;
			}
			const existing = records.find(record => record.name === name && record.office === office.office && record.district === office.district);
			if (existing) {
				if (existing.party?.split(" / ").includes(party)) return reject();
				existing.party += ` / ${party}`;
				claims.push({ recordId: existing.id, name, party, page: 1, office: office.office, voteLimit });
				continue;
			}
			const record = factory(source, { ...office, name, party, status: "listed", sourceAreaLabel: "Goffstown sample ballot", ...(limit ? { seats: voteLimit } : {}) });
			if (!record) return reject();
			record.id = createHash("sha256").update(JSON.stringify([source.id, source.electionDate, office.office, office.district, name])).digest("hex").slice(0, 24);
			record.sourceStatus = undefined;
			records.push(record);
			claims.push({ recordId: record.id, name, party, page: 1, office: office.office, voteLimit });
		}
		if (fields.some(field => field.left >= 193 && field.left < 716 && !candidateFields.includes(field) && !usedPartyLabels.has(field))) return reject();
		const writeInMarks = marks.filter(mark => mark.left > 800);
		if (writeInMarks.length !== voteLimit) return reject();
		const writeInFields = fields.filter(field => field.left >= 716);
		const written = new Map<typeof marks[number], GoffstownField[]>();
		for (const field of writeInFields) {
			const nearest = [...writeInMarks].sort((first, second) => Math.abs(first.top - (field.top + field.height / 2)) - Math.abs(second.top - (field.top + field.height / 2)))[0];
			if (!nearest || Math.abs(nearest.top - (field.top + field.height / 2)) > 25 || field.family !== "Helvetica-Condensed" || field.color !== "#000000") return reject();
			written.set(nearest, [...(written.get(nearest) ?? []), field]);
		}
		if (written.size !== writeInMarks.length || [...written.values()].some(fields => rows(fields).join(" ") !== label)) return reject();
		top = bottom + 1;
	}
	if (records.length < 10 || records.length > 300 || first.some(field => field.top > 242 && field.top < rules.at(-1)! && field.family === "HelveticaNeueLTStd-BdCn" && field.size === 18 && field.color === "#000000" && field.left >= 716)) return reject();
	const questions: ChicagoQuestion[] = [];
	let question: { number: number; text: string; choices: string[] } | undefined;
	let lastBottom = 0;
	const questionMarks = inspected[1]!.marks;
	let choices = 0;
	let explicitlyAdvisory = false;
	for (const field of pages[1]!) {
		if (field.text === "GOFFSTOWN" && field.top > 1400) continue;
		if (field.family === "HelveticaNeueLTStd-BdCn" && field.color === "#000000" && /QUESTION/u.test(field.text) && /^[A-Z\d ,#-]+$/u.test(field.text)) {
			if (question) return reject();
			explicitlyAdvisory = /^ADVISORY QUESTIONS?\b/u.test(field.text);
			continue;
		}
		if (field.family === "Helvetica-Condensed" && field.color === "#000000") {
			const text = printedText(field);
			const start = /^([1-9]\d?)\. (.+)$/u.exec(text);
			if (start) {
				if (question || Number(start[1]) !== questions.length + 1) return reject();
				question = { number: Number(start[1]), text: start[2]!, choices: [] };
			}
			else {
				if (!question || field.top - lastBottom > 30) return reject();
				question.text += `${question.text.endsWith("-") ? "" : " "}${text}`;
			}
			lastBottom = field.top + field.height;
			continue;
		}
		if (["Yes", "No"].includes(field.text) && field.left >= 700 && question && field.color === "#000000") {
			if (field.text !== (question.choices.length ? "No" : "Yes") || field.top - lastBottom > 30) return reject();
			const matching = questionMarks.filter(mark => Math.abs(mark.top - (field.top + field.height / 2)) <= 10 && mark.left > field.left + field.width && mark.left - field.left - field.width < 40);
			if (matching.length !== 1) return reject();
			choices++;
			question.choices.push(field.text);
			if (question.choices.length === 2) {
				if (question.text.length < 30 || question.text.length > 5000) return reject();
				const audience = "Goffstown sample ballot";
				const id = createHash("sha256").update(JSON.stringify([source.id, source.electionDate, audience, question.number, question.text])).digest("hex").slice(0, 24);
				questions.push({ id, audience, title: `Question ${question.number}`, officialText: question.text, choices: ["Yes", "No"], pages: [2], explicitlyAdvisory, voterApplicabilityVerified: false });
				question = undefined;
			}
			continue;
		}
		return reject();
	}
	if (question || !questions.length || questions.length > 20 || choices !== questionMarks.length) return reject();
	return { records, claims, ballotQuestions: questions };
}
