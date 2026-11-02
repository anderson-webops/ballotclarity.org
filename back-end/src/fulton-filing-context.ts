import type { ElectionDocumentSource } from "./election-document-sources.js";
import type { ElectionReferenceSource } from "./election-reference-sources.js";
import type { ElectionReferenceSnapshot } from "./election-references.js";
import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { containsControlCharacters } from "./text-validation.js";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const fultonFilingIndex = "https://fultoncountyga.gov/Inside-Fulton-County/Fulton-County-Departments/Registration-and-Elections/Candidate-Information";
export const fultonFilingDocuments = [
	{ url: "https://fultoncountyga.gov/-/media/2026-Election/List-of-Qualified-Candidates--GA-Soil--Water--November-3-2026-6292026.pdf", publishedDate: "2026-03-07", office: "Fulton Soil & Water Conservation District Supervisor", kind: "soil-water" },
	{ url: "https://fultoncountyga.gov/-/media/2026-Election/May-19-Election/List-of-Qualified-Candidates--Fulton-County-Commisson-District-4---Nov-3-2026--Special-Election--522.pdf", publishedDate: "2026-05-02", office: "County Commissioner – District 4 (Unexpired Term)", kind: "district-4" },
] as const;

export const fultonFilingReferenceSource: ElectionReferenceSource = {
	id: "ga-fulton-filing-context-2026",
	stateCode: "GA",
	electionDate: "2026-11-03",
	optional: true,
	allowOfficialCandidateBindings: true,
	documents: fultonFilingDocuments.map(document => ({ url: document.url, pageUrl: `${document.url}#page=1`, title: document.kind === "soil-water" ? "Soil and water candidate filings" : "District 4 candidate filings", publisher: "Fulton County Registration and Elections", kind: "public-dataset", publishedDate: document.publishedDate })),
};

export const fultonFilingDocumentSource: ElectionDocumentSource = {
	id: "ga-fulton-filing-documents-2026",
	stateCode: "GA",
	electionDate: "2026-11-03",
	host: "fultoncountyga.gov",
	indexUrl: fultonFilingIndex,
	dateMarkers: ["Candidate Information", "November 3, 2026"],
	policies: [{ id: "robots", url: "https://fultoncountyga.gov/robots.txt", format: "robots" }, { id: "privacy", url: "https://fultoncountyga.gov/Privacy-Statement", format: "main" }],
	documentPatterns: fultonFilingDocuments.map(document => `^${new URL(document.url).pathname.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}$`),
	minimumDocuments: 2,
	maximumDocuments: 2,
};

function date(value: string) {
	const match = /^(\d{1,2})[/.](\d{1,2})[/.](20\d{2})$/u.exec(value);
	if (!match) throw new Error("Fulton filing date is invalid.");
	const result = `${match[3]}-${match[1]!.padStart(2, "0")}-${match[2]!.padStart(2, "0")}`;
	if (new Date(`${result}T00:00:00Z`).toISOString().slice(0, 10) !== result) throw new Error("Fulton filing date is invalid.");
	return result;
}

export function parseFultonFilingOccupations(text: string, document: { kind: "soil-water" | "district-4"; publishedDate: string }, electionDate: string) {
	if (Buffer.byteLength(text) > 256 * 1024 || containsControlCharacters(text.replace(/[\n\r\t\f]/gu, "")) || text.split("\f").filter(page => page.trim()).length !== 1 || !/^20\d{2}-11-0[2-8]$/u.test(electionDate)) throw new Error("Fulton filing text exceeds its reviewed layout.");
	const compact = text.replace(/\s+/gu, " ").trim();
	const election = new Date(`${electionDate}T00:00:00Z`);
	if (!Number.isFinite(election.valueOf()) || election.getUTCDay() !== 2 || !compact.includes(`NOVEMBER ${election.getUTCDate()}, ${election.getUTCFullYear()}`) || /PRIMARY|MAY 19/iu.test(compact) || !compact.includes("LIST OF QUALIFIED CANDIDATES") || !/CANDIDATE\s+PARTY\s+OCCUPATION\s+INCUMBENT\s+QUALIFIED BY/u.test(compact) || !compact.endsWith("Page 1 of 1")) throw new Error("Fulton filing election or table headings changed.");
	const publication = /LIST OF QUALIFIED CANDIDATES\s+(\d{1,2}\/\d{1,2}\/20\d{2})/u.exec(compact);
	if (!publication || date(publication[1]!) !== document.publishedDate || document.publishedDate > electionDate) throw new Error("Fulton filing publication date changed.");
	if (!(document.kind === "soil-water" ? compact.includes("Georgia Soil & Water Conservation District Supervisor") && compact.includes("GENERAL/SPECIAL ELECTION") : compact.includes("FULTON COUNTY BOARD OF COMMISSIONER DISTRICT 4 SPECIAL ELECTION"))) throw new Error("Fulton filing office changed.");
	const records: { name: string; occupation: string }[] = [];
	let ended = false;
	for (const line of text.split(/\r?\n/u)) {
		const fields = line.trim().split(/\s{2,}/u);
		if (fields.length === 6 && fields[0]!.length <= 250 && /^(?:Nonpartisan|Democratic|Republican)$/u.test(fields[1]!) && /^\p{L}[\p{L}\p{N} &/'().,-]{0,149}$/u.test(fields[2]!) && /^(?:Yes|No)$/u.test(fields[3]!) && fields[4] === "Fulton County") {
			if (ended || date(fields[5]!) > document.publishedDate || /[@\d]/u.test(fields[0]!) || records.some(record => record.name === fields[0])) throw new Error("Fulton filing rows are ambiguous.");
			records.push({ name: fields[0]!, occupation: fields[2]! });
		}
		else if (/Nonpartisan|Democratic|Republican/u.test(line) || (records.length && line.trim() && !/^(?:Page 1 of 1|\f)$/u.test(line.trim()))) {
			throw new Error("Fulton filing row layout changed.");
		}
		if (/Page 1 of 1/u.test(line)) ended = true;
	}
	if (!records.length || records.length > 25 || !ended) throw new Error("Fulton filing rows are missing or unbounded.");
	return records;
}

export interface FultonFilingBinding { documentIndex: number; name: string; recordId: string }

export function prepareFultonFilingContext(input: { candidates: StateBallotSnapshot; documents: { text: string; sha256: string; capturedAt: string }[]; bindings: FultonFilingBinding[]; now?: number }) {
	const source = fultonFilingReferenceSource;
	const now = input.now ?? Date.now();
	if (input.candidates.source.id !== "ga-fulton-2026" || input.candidates.source.stateCode !== source.stateCode || input.candidates.source.electionDate !== source.electionDate || input.documents.length !== source.documents.length || !input.bindings.length || input.bindings.length > 25) throw new Error("Fulton filing inputs must match the current reviewed election.");
	const identities = new Set<string>();
	const usedRows = new Set<string>();
	const aliases: Record<string, string> = { "Karen Rene": "Karen Rene'", "Aaron A. Sampson Jr": "Aaron A. Sampson, Jr." };
	const documents = input.documents.map((document, index) => {
		if (!/^[a-f\d]{64}$/u.test(document.sha256) || !Number.isFinite(Date.parse(document.capturedAt)) || Date.parse(document.capturedAt) > now || Date.parse(document.capturedAt) < Date.parse(fultonFilingDocuments[index]!.publishedDate)) throw new Error("Fulton filing capture provenance is invalid.");
		return { url: source.documents[index]!.url, sha256: document.sha256, capturedAt: document.capturedAt, includedRecordCount: 0 };
	});
	const rows = input.documents.map((document, index) => parseFultonFilingOccupations(document.text, fultonFilingDocuments[index]!, source.electionDate));
	if (rows.reduce((total, group) => total + group.length, 0) !== input.bindings.length) throw new Error("Review every filing row before preparing context.");
	const records = input.bindings.map((binding) => {
		if (!Number.isSafeInteger(binding.documentIndex) || binding.documentIndex < 0 || binding.documentIndex >= rows.length || !/^[a-f\d]{24}$/u.test(binding.recordId) || identities.has(binding.recordId)) throw new Error("Fulton filing bindings must be exact and distinct.");
		const row = rows[binding.documentIndex]!.filter(row => row.name === binding.name);
		const candidates = input.candidates.records.filter(candidate => candidate.id === binding.recordId && candidate.scope === "local" && candidate.office === fultonFilingDocuments[binding.documentIndex]!.office && ["listed", "filed", "qualified", "unopposed"].includes(candidate.status));
		const rowIdentity = `${binding.documentIndex}:${binding.name}`;
		if (row.length !== 1 || candidates.length !== 1 || usedRows.has(rowIdentity) || (candidates[0]!.name !== binding.name && aliases[candidates[0]!.name] !== binding.name) || input.candidates.records.filter(candidate => candidate.name === candidates[0]!.name && candidate.office === candidates[0]!.office).length !== 1) throw new Error("Fulton filing candidate or office is ambiguous.");
		identities.add(binding.recordId);
		usedRows.add(rowIdentity);
		const candidate = candidates[0]!;
		documents[binding.documentIndex]!.includedRecordCount++;
		return { id: digest(`${source.id}:${binding.recordId}`).slice(0, 24), name: candidate.name, office: candidate.office, scope: candidate.scope, ...(candidate.jurisdiction ? { jurisdiction: candidate.jurisdiction } : {}), officialCandidate: { sourceId: input.candidates.source.id, recordId: candidate.id }, facts: [`Reported occupation: ${row[0]!.occupation} (${fultonFilingDocuments[binding.documentIndex]!.publishedDate} filing list).`], sourceDocumentIndex: binding.documentIndex };
	});
	if (documents.some(document => !document.includedRecordCount)) throw new Error("Fulton filing contributions must cover both reviewed documents.");
	const snapshot: ElectionReferenceSnapshot = { schemaVersion: 1, type: "election-references", stateCode: source.stateCode, sourceId: source.id, electionDate: source.electionDate, retrievedAt: new Date(Math.min(...documents.map(document => Date.parse(document.capturedAt)))).toISOString(), sourceSha256: digest(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), recordCount: records.length, documents, records };
	return snapshot;
}
