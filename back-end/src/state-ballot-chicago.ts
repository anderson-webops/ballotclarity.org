import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { createHash } from "node:crypto";
import { chicagoNativePages, chicagoNativeRows } from "./state-ballot-chicago-native.js";

type Factory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;
export interface ChicagoQuestion { id: string; audience: string; title: string; officialText: string; choices: ["Yes", "No"]; pages: number[]; explicitlyAdvisory: boolean; voterApplicabilityVerified: false }
function reject(detail: string): never {
	throw new Error(`The Chicago ${detail} requires review.`);
}
const nameValid = (value: string) => value.length >= 1 && value.length <= 200 && /\p{L}/u.test(value) && /^[\p{L}\p{M} .,'’\u0022&-]+$/u.test(value);
function geography(office: string): Pick<StateCandidateValues, "scope" | "district" | "jurisdiction" | "termYears"> {
	if (["United States Senator", "Governor & Lieutenant Governor", "Attorney General", "Secretary of State", "Comptroller", "Treasurer"].includes(office)) return { scope: "statewide", district: "" };
	const numbered = /^(U\.S\. Representative|State Senator|State Representative), ([1-9]\d{0,2})(?:st|nd|rd|th) District$/u.exec(office);
	if (numbered) return { scope: numbered[1] === "U.S. Representative" ? "congressional" : numbered[1] === "State Senator" ? "state-senate" : "state-house", district: numbered[2] };
	if (/^Metropolitan Water Reclamation District Commissioners (?:Full 6-Year Term|Unexpired 2-Year Term)$/u.test(office)) return { scope: "local", district: "", termYears: office.includes("Full") ? 6 : 2 };
	if (["President of County Board", "County Clerk", "County Sheriff", "County Treasurer", "County Assessor"].includes(office) || /^(?:County Commissioner|Board of Review), [1-9]\d?(?:st|nd|rd|th) District$/u.test(office)) return { scope: "local", district: "", jurisdiction: "Cook County, Illinois" };
	if (/^(?:Judge of the (?:Appellate|Circuit) Court|Judge, [1-9]\d?(?:st|nd|rd|th) Subcircuit) \((?:Vacancy of [\p{L} .’'-]+|Converted from Associate Judgeship of [\p{L} .’'-]+)\)$/u.test(office)) return { scope: "local", district: "" };
	if (office === "President of the Chicago Board of Education" || /^Member of the Chicago Board of Education, Subdistrict (?:[1-9]|10)[AB]$/u.test(office)) return { scope: "local", district: "", jurisdiction: "Chicago Public Schools District 299" };
	return reject("office vocabulary");
}

export function readChicagoBallotDocument(source: StateBallotSource, body: string, factory: Factory) {
	if (source.stateCode !== "IL" || !/^20\d{2}-11-0[2-8]$/u.test(source.electionDate) || new Date(`${source.electionDate}T00:00:00Z`).getUTCDay() !== 2) return reject("election identity");
	const dateLabel = `November ${Number(source.electionDate.slice(-2))}, ${source.electionDate.slice(0, 4)}`;
	const pages = chicagoNativePages(body);
	const records: StateCandidateRecord[] = [];
	const claims: { recordId: string; page: number; officeLabel: string; partyLabel: string; ballotNumbers: number[] }[] = [];
	const questions: ChicagoQuestion[] = [];
	let section: "candidates" | "retention" | "questions" = "candidates";
	let office = "";
	let voteLimit = 0;
	let officeRows = 0;
	let asOf = "";
	let asOfDate = "";
	let retention: { office: string; name: string; yes: number; page: number } | null = null;
	let audience = "";
	let title = "";
	let question = "";
	let choice = "";
	let questionPages: number[] = [];
	let audienceOpen = false;
	let headingSeen = false;
	const introduction = new Set<string>();
	const ballotNumbers = new Map<string, Set<number>>();
	const candidatePages: number[] = [];
	const retentionPages: number[] = [];
	const questionCounts: number[] = [];
	function rememberPage(page: number) {
		if (!questionPages.includes(page)) questionPages.push(page);
	}
	for (const [index, fields] of pages.entries()) {
		const page = index + 1;
		let candidateCount = 0;
		let retentionCount = 0;
		const beforeQuestions = questions.length;
		for (const row of chicagoNativeRows(fields)) {
			const text = row.map(field => field.text).join(" ");
			if (row.length === 1 && text === `Page ${page} of ${pages.length}`) continue;
			if (page === 1 && row.length === 1 && (text === `This Unofficial candidate list for the ${dateLabel} election includes only the offices and the names of candidates whose districts include all or` || text === "part of the City of Chicago. Please note: This list will be updated if filing change.")) {
				if (introduction.has(text)) return reject("repeated introduction");
				introduction.add(text);
				continue;
			}
			const status = /^Status as of (\d{1,2})\/(\d{1,2})\/(20\d{2}) (\d{1,2}:\d{2}:\d{2} [AP]M)$/u.exec(text);
			if (page === 1 && status && !asOf) {
				asOf = text.slice("Status as of ".length);
				asOfDate = `${status[3]}-${status[1]!.padStart(2, "0")}-${status[2]!.padStart(2, "0")}`;
				if (status[3] !== source.electionDate.slice(0, 4) || !Number.isFinite(Date.parse(asOfDate)) || new Date(asOfDate).toISOString().slice(0, 10) !== asOfDate || asOfDate > source.electionDate || !/^(?:[1-9]|1[0-2]):[0-5]\d:[0-5]\d [AP]M$/u.test(status[4]!)) return reject("printed source date");
				continue;
			}
			if (page === 1 && text === `Candidate Filings in Ballot Order, ${dateLabel}`) {
				if (headingSeen) return reject("repeated election heading");
				headingSeen = true;
				continue;
			}
			if (section === "candidates" && text === "Ballot No. Candidate Status" && row.length === 2 && row[0]!.left === 118 && row[1]!.left === 771) continue;
			if (text === `General Election Judicial Retention, ${dateLabel}` && section === "candidates") {
				if (!officeRows) return reject("empty preceding office");
				section = "retention";
				continue;
			}
			if (text === "Referenda and Local Options" && section === "retention") {
				if (retention) return reject("incomplete retention question");
				section = "questions";
				continue;
			}
			if (section === "candidates") {
				if (row.length === 1 && row[0]!.left === 89 && row[0]!.size === 19) {
					if (office && !officeRows) return reject("empty office");
					geography(text);
					office = text;
					voteLimit = 0;
					officeRows = 0;
					continue;
				}
				const selection = /^Vote for (?:not more than )?(One|Two|Three)$/u.exec(text);
				if (office && row.length === 1 && row[0]!.left === 106 && selection && !voteLimit) {
					voteLimit = ["One", "Two", "Three"].indexOf(selection[1]!) + 1;
					continue;
				}
				if (row.length === 2 && row[0]!.text === "Write-in" && row[0]!.left === 170 && row[1]!.text === "N/A" && office && voteLimit) continue;
				const ballot = row.length === 3 ? /^\(([1-9]\d{0,2})\)$/u.exec(row[0]!.text) : null;
				const person = row.length === 3 ? /^(.+) \(([^()]+)\)$/u.exec(row[1]!.text) : null;
				if (!office || !voteLimit || !ballot || !person || row[1]!.left !== 170 || row[2]!.left !== 735 || row[2]!.text !== "Candidate" || !nameValid(person[1]!) || person[2]!.length > 80 || !/^[\p{L}\p{M} .,'’&-]+$/u.test(person[2]!)) return reject(`candidate row on page ${page} at ${row[0]!.top}`);
				if ((office === "Governor & Lieutenant Governor") !== person[1]!.includes(" & ")) return reject("printed ticket pairing");
				const numbers = ballotNumbers.get(office) ?? new Set<number>();
				if (numbers.has(Number(ballot[1]))) return reject("repeated ballot position");
				numbers.add(Number(ballot[1]));
				ballotNumbers.set(office, numbers);
				const record = factory(source, { name: person[1]!, office, party: person[2]!, status: "listed", ...geography(office), sourceDistrictLabel: office });
				if (!record) return reject("candidate identity");
				record.sourceStatus = "Candidate";
				record.ballotDesignation = `Ballot number ${ballot[1]}`;
				record.voteLimit = voteLimit;
				records.push(record);
				officeRows++;
				candidateCount++;
				claims.push({ recordId: record.id, page, officeLabel: office, partyLabel: person[2]!, ballotNumbers: [Number(ballot[1])] });
			}
			else if (section === "retention") {
				if (row.length === 1 && /^Judge, (?:Appellate|Circuit) Court \(Retention\)$/u.test(text)) {
					if (retention) return reject("overlapping retention questions");
					retention = { office: text, name: "", yes: 0, page };
					continue;
				}
				if (retention && !retention.name && row.length === 1 && nameValid(text)) {
					retention.name = text;
					continue;
				}
				const number = row.length === 2 ? /^\(([1-9]\d{0,2})\)$/u.exec(row[0]!.text) : null;
				if (!retention?.name || !number || !["Yes", "No"].includes(row[1]!.text)) return reject(`retention choice on page ${page} at ${row[0]!.top}`);
				if (row[1]!.text === "Yes" && !retention.yes) {
					retention.yes = Number(number[1]);
					continue;
				}
				if (row[1]!.text !== "No" || Number(number[1]) !== retention.yes + 1 || !retention.yes) return reject("retention choice order");
				const record = factory(source, { name: retention.name, office: `${retention.office}: ${retention.name}`, party: "", status: "listed", scope: "local", sourceDistrictLabel: retention.office });
				if (!record) return reject("retention identity");
				record.sourceStatus = "Judicial retention";
				record.ballotDesignation = `Judicial retention; Yes ${retention.yes}; No ${number[1]}`;
				record.voteLimit = 1;
				records.push(record);
				retentionCount++;
				claims.push({ recordId: record.id, page: retention.page, officeLabel: retention.office, partyLabel: "", ballotNumbers: [retention.yes, Number(number[1])] });
				retention = null;
			}
			else {
				if (row.length !== 1) return reject("question text layout");
				if (text.startsWith("To the Voters of ")) {
					if (question || title || choice || audienceOpen) return reject("question audience transition");
					audience = text;
					audienceOpen = !text.endsWith(":");
					rememberPage(page);
					continue;
				}
				if (audienceOpen) {
					audience += ` ${text}`;
					audienceOpen = !text.endsWith(":");
					if (audience.length > 300) return reject("question audience");
					continue;
				}
				if (text === "Yes" || text === "No") {
					if (!question || !/["”]$/u.test(question) || !title || !audience.endsWith(":")) return reject("incomplete question");
					if (text === "Yes" && !choice) {
						choice = "Yes";
						continue;
					}
					if (text !== "No" || choice !== "Yes") return reject("question choice order");
					const officialText = question.slice(1, -1);
					const id = createHash("sha256").update(JSON.stringify([source.id, source.electionDate, audience, officialText])).digest("hex").slice(0, 24);
					questions.push({ id, audience, title, officialText, choices: ["Yes", "No"], pages: [...questionPages], explicitlyAdvisory: title.startsWith("ADVISORY QUESTION"), voterApplicabilityVerified: false });
					title = "";
					question = "";
					choice = "";
					questionPages = [];
					continue;
				}
				if (/^["“]/u.test(text)) {
					if (!audience.endsWith(":") || !title || question) return reject("question opening");
					question = text;
					rememberPage(page);
					continue;
				}
				if (question) {
					if (/["”]$/u.test(question)) return reject("unexpected text after question");
					question += ` ${text}`;
					rememberPage(page);
					if (question.length > 5000) return reject("question length");
					continue;
				}
				if (!audience || title.length > 300) return reject("question title");
				title += `${title ? " " : ""}${text}`;
				rememberPage(page);
			}
		}
		candidatePages.push(candidateCount);
		retentionPages.push(retentionCount);
		questionCounts.push(questions.length - beforeQuestions);
	}
	if (!asOf || !headingSeen || introduction.size !== 2 || !records.length || !questions.length || section !== "questions" || retention || question || title || choice || audienceOpen || new Set(records.map(record => record.id)).size !== records.length || new Set(questions.map(item => item.id)).size !== questions.length) return reject("complete document inventory");
	return { records, claims, questions, asOf, asOfDate, candidatePages, retentionPages, questionCounts, pageCount: pages.length };
}
