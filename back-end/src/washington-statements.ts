import type { ElectionReferenceSource } from "./election-reference-sources.js";
import type { ElectionReferenceSnapshot } from "./election-references.js";
import type { StateHtmlNode } from "./state-ballot-html.js";
import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { parseStateHtml, stateHtmlAttribute, stateHtmlText } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

export const washingtonStatementFields = ["Elected Experience", "Legal/Judicial Experience", "Other Professional Experience", "Education", "Community Service"] as const;
export type WashingtonStatementField = typeof washingtonStatementFields[number];

export interface ReviewedWashingtonFact {
	sourceCandidateId: string;
	statementSha256: string;
	field: WashingtonStatementField;
	evidence: string;
	text: string;
}

export interface WashingtonStatementCapture {
	url: string;
	body: string;
	capturedAt: string;
	sha256: string;
}

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const headingName = (value: string) => clean(value).replace(/:$/u, "").toLowerCase();
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function parseWashingtonStatementSections(html: string) {
	if (typeof html !== "string" || Buffer.byteLength(html) > 128 * 1024)
		throw new Error("The Washington statement exceeds its reviewed size limit.");
	const chunks = new Map<WashingtonStatementField, string[]>();
	let active: WashingtonStatementField | undefined;
	let finished = false;
	const tree = parseStateHtml(html);
	const pending = [{ node: tree, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const { node, depth } = pending.pop()!;
		if (++visited > 20_000 || depth > 64) throw new Error("The Washington statement exceeds its structural bounds.");
		for (const child of node.childNodes ?? []) pending.push({ node: child, depth: depth + 1 });
	}
	function visit(node: StateHtmlNode) {
		if (finished || ["script", "style", "noscript", "template", "form", "button", "input", "textarea", "svg", "img"].includes(node.nodeName) || node.attrs?.some(attribute => attribute.name === "hidden") || stateHtmlAttribute(node, "aria-hidden") === "true") return;
		if (["b", "strong", "h1", "h2", "h3", "h4", "h5", "h6"].includes(node.nodeName)) {
			const heading = headingName(stateHtmlText(node));
			if (heading === "statement") {
				finished = true;
				return;
			}
			active = washingtonStatementFields.find(field => headingName(field) === heading);
			if (active) {
				if (chunks.has(active)) throw new Error("A Washington statement repeats a factual section heading.");
				chunks.set(active, []);
			}
			return;
		}
		if (active && node.nodeName === "#text") chunks.get(active)!.push(node.value ?? "");
		if (active && ["br", "p", "div", "li"].includes(node.nodeName)) chunks.get(active)!.push(" ");
		for (const child of node.childNodes ?? []) visit(child);
		if (active && ["p", "div", "li"].includes(node.nodeName)) chunks.get(active)!.push(" ");
	}
	visit(tree);
	const result: Partial<Record<WashingtonStatementField, string>> = {};
	for (const [field, parts] of chunks) {
		const text = clean(parts.join(""));
		if (text.length > 8_000 || containsControlCharacters(text)) throw new Error("A Washington factual section has invalid text.");
		if (text) result[field] = text;
	}
	return result;
}

function documentIdentity(address: string) {
	const url = new URL(address);
	if (url.origin !== "https://voter.votewa.gov" || url.username || url.password || url.pathname !== "/elections/candidate.ashx" || url.hash || [...url.searchParams.keys()].sort().join(",") !== "b,c,e,la,r" || url.searchParams.get("b") !== "0" || url.searchParams.get("c") !== "" || url.searchParams.get("la") !== "en" || !/^\d{1,10}$/u.test(url.searchParams.get("e") ?? "") || !/^\d{1,10}$/u.test(url.searchParams.get("r") ?? ""))
		throw new Error("Washington preparation requires a configured normal public statement URL.");
	return { electionId: url.searchParams.get("e")!, raceId: url.searchParams.get("r")! };
}

export function prepareWashingtonStatements(options: { source: ElectionReferenceSource; candidates: StateBallotSnapshot; previous: readonly ElectionReferenceSnapshot[]; documents: readonly WashingtonStatementCapture[]; facts: readonly ReviewedWashingtonFact[]; now?: number }) {
	const { source, candidates } = options;
	const locality = source.washingtonLocality;
	const now = options.now ?? Date.now();
	const officialElectionId = new URL(candidates.source.url).searchParams.get("e");
	if (source.stateCode !== "WA" || candidates.source.stateCode !== "WA" || candidates.source.electionDate !== source.electionDate || source.documents.some(document => document.kind !== "candidate-statement") || !source.documents.length || source.documents.length > 500 || options.documents.length !== source.documents.length || !Number.isFinite(Date.parse(candidates.retrievedAt)) || Date.parse(candidates.retrievedAt) > now)
		throw new Error("Washington preparation inputs do not match their configured election.");
	if (locality !== undefined && (!isObject(locality) || Object.keys(locality).sort().join(",") !== "countyDisplay,rosterJurisdiction,statementJurisdiction,statementJurisdictionType" || typeof locality.countyDisplay !== "string" || !locality.countyDisplay || locality.countyDisplay.length > 100 || clean(locality.countyDisplay) !== locality.countyDisplay || containsControlCharacters(locality.countyDisplay) || locality.rosterJurisdiction !== "County" || locality.statementJurisdiction !== "Countywide" || locality.statementJurisdictionType !== "CTY"))
		throw new Error("Washington local preparation requires an explicit reviewed county context.");
	if (!/^\d{1,10}$/u.test(officialElectionId ?? "") || new Set(candidates.records.map(candidate => candidate.sourceCandidateId)).size !== candidates.records.length)
		throw new Error("Washington preparation requires unique official candidate identities and an explicit election.");
	if (options.documents.reduce((total, document) => total + Buffer.byteLength(document.body), 0) > 128 * 1024 * 1024)
		throw new Error("Washington statement captures exceed their combined size limit.");
	if (!Array.isArray(options.facts as unknown) || !options.facts.length || options.facts.length > 10_000)
		throw new Error("Provide explicitly reviewed Washington factual paraphrases.");
	const factsByCandidate = new Map<string, ReviewedWashingtonFact[]>();
	for (const fact of options.facts) {
		if (!isObject(fact) || Object.keys(fact).sort().join(",") !== "evidence,field,sourceCandidateId,statementSha256,text" || typeof fact.sourceCandidateId !== "string" || !/^\d{1,10}\/\d{1,10}$/u.test(fact.sourceCandidateId) || typeof fact.statementSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(fact.statementSha256) || !washingtonStatementFields.includes(fact.field) || typeof fact.evidence !== "string" || fact.evidence.length < 5 || fact.evidence.length > 8_000 || clean(fact.evidence) !== fact.evidence || typeof fact.text !== "string" || !fact.text || fact.text.length > 600 || clean(fact.text) !== fact.text || containsControlCharacters(fact.text) || /<[^>]*>/u.test(fact.text))
			throw new Error("A Washington factual review is invalid.");
		const reviewed = factsByCandidate.get(fact.sourceCandidateId) ?? [];
		if (reviewed.length >= 6 || reviewed.some(item => item.text === fact.text)) throw new Error("Washington factual reviews repeat or exceed their per-person limit.");
		reviewed.push(fact);
		factsByCandidate.set(fact.sourceCandidateId, reviewed);
	}
	const records: ElectionReferenceSnapshot["records"] = [];
	const identities: { sourceCandidateId: string; officialRecordId: string; statementSha256: string; reviewedFacts: number; countyDisplay?: string; officialJurisdiction?: string; publishedRaceJurisdictionName?: string; publishedRaceJurisdictionTypeId?: string }[] = [];
	const documents: ElectionReferenceSnapshot["documents"] = [];
	const matched = new Set<string>();
	const races = new Set<string>();
	const holds: { sourceCandidateId: string; reason: string }[] = [];
	let electionId: string | undefined;
	for (const [index, capture] of options.documents.entries()) {
		if (capture.url !== source.documents[index]!.url || !/^[a-f0-9]{64}$/u.test(capture.sha256) || digest(capture.body) !== capture.sha256 || Buffer.byteLength(capture.body) > 6 * 1024 * 1024 || !Number.isFinite(Date.parse(capture.capturedAt)) || Date.parse(capture.capturedAt) > now)
			throw new Error("Washington statement capture provenance is invalid.");
		const identity = documentIdentity(capture.url);
		if (identity.electionId !== officialElectionId) throw new Error("Washington statement and official roster election IDs differ.");
		if (races.has(identity.raceId) || (electionId !== undefined && identity.electionId !== electionId)) throw new Error("Washington statement documents repeat a race or mix elections.");
		races.add(identity.raceId);
		electionId = identity.electionId;
		const entries: unknown = JSON.parse(capture.body);
		if (!Array.isArray(entries) || entries.length > 100 || entries.some(entry => !isObject(entry) || !isObject(entry.statement))) throw new Error("The normal public Washington response has an invalid statement set.");
		const statements = entries.map(entry => entry.statement as Record<string, unknown>);
		if (new Set(statements.map(statement => String(statement.BallotID))).size !== statements.length) throw new Error("The normal public Washington response repeats an identity.");
		const eligible = candidates.records.filter(candidate => candidate.sourceCandidateId?.startsWith(`${identity.raceId}/`));
		if (!eligible.length) throw new Error("A configured Washington statement race has no matching official candidates.");
		if (locality && (eligible.some(candidate => candidate.scope !== "local" || candidate.sourceDistrictLabel !== locality.rosterJurisdiction) || statements.some(statement => statement.CountyDisplay !== locality.countyDisplay || statement.CountyCode !== "" || statement.RaceJurisdictionName !== locality.statementJurisdiction || statement.RaceJurisdictionTypeID !== locality.statementJurisdictionType || String(statement.ElectionID) !== identity.electionId || String(statement.RaceID) !== identity.raceId)))
			throw new Error("A local Washington race does not match its explicit county and jurisdiction context.");
		for (const statement of statements) {
			if (!/^\d{1,10}$/u.test(String(statement.BallotID))) throw new Error("The normal public Washington response has an invalid identity.");
			const sourceCandidateId = `${identity.raceId}/${statement.BallotID}`;
			if (!eligible.some(candidate => candidate.sourceCandidateId === sourceCandidateId)) holds.push({ sourceCandidateId, reason: "Public response identity is absent from the supplied official race." });
		}
		let includedRecordCount = 0;
		for (const candidate of eligible) {
			const candidateId = candidate.sourceCandidateId!;
			const reviewed = factsByCandidate.get(candidateId);
			const statement = statements.find(item => String(item.BallotID) === candidateId.split("/")[1]);
			if (!reviewed) {
				holds.push({ sourceCandidateId: candidateId, reason: "No factual paraphrases were explicitly reviewed." });
				continue;
			}
			if (!statement || typeof statement.Statement !== "string" || !statement.Statement.trim() || String(statement.ElectionID) !== identity.electionId || String(statement.RaceID) !== identity.raceId || statement.BallotName !== candidate.name || statement.CountyCode !== "" || typeof statement.RaceJurisdictionName !== "string" || (candidate.scope === "local" ? !locality : Boolean(locality) || statement.RaceJurisdictionName.toUpperCase() !== candidate.sourceDistrictLabel?.toUpperCase()) || !["listed", "filed", "qualified", "write-in", "unopposed"].includes(candidate.status))
				throw new Error("A reviewed Washington statement does not match its exact official identity.");
			const office = candidate.scope === "statewide" ? `${candidate.sourceDistrictLabel} - ${statement.RaceName}` : statement.RaceName;
			if (office !== candidate.office.replace(/ \((?:Short & Full|Unexpired|Initial Full)\)$/u, "")) throw new Error("A reviewed Washington statement does not match its official office.");
			const jurisdiction = locality ? `${locality.countyDisplay} County` : candidate.scope === "statewide" ? undefined : candidate.sourceDistrictLabel;
			if (options.previous.some(snapshot => snapshot.stateCode === "WA" && snapshot.electionDate === source.electionDate && snapshot.records.some(record => record.name === candidate.name && record.office === candidate.office && record.jurisdiction?.toUpperCase() === jurisdiction?.toUpperCase())))
				throw new Error("A reviewed Washington profile is already present in a preceding collection.");
			const statementHash = digest(statement.Statement);
			const sections = parseWashingtonStatementSections(statement.Statement);
			if (reviewed.some(fact => fact.statementSha256 !== statementHash || !sections[fact.field]?.includes(fact.evidence))) throw new Error("A reviewed Washington fact is not anchored to its captured factual section.");
			records.push({ id: digest(`${source.id}/${candidate.id}`).slice(0, 24), name: candidate.name, office: candidate.office, scope: candidate.scope, ...(jurisdiction ? { jurisdiction } : {}), facts: reviewed.map(fact => fact.text), sourceDocumentIndex: index });
			identities.push({ sourceCandidateId: candidateId, officialRecordId: candidate.id, statementSha256: statementHash, reviewedFacts: reviewed.length, ...(locality ? { countyDisplay: locality.countyDisplay, officialJurisdiction: candidate.sourceDistrictLabel, publishedRaceJurisdictionName: statement.RaceJurisdictionName, publishedRaceJurisdictionTypeId: locality.statementJurisdictionType } : {}) });
			matched.add(candidateId);
			includedRecordCount++;
		}
		documents.push({ url: capture.url, sha256: capture.sha256, capturedAt: new Date(capture.capturedAt).toISOString(), includedRecordCount });
	}
	if (!records.length || [...factsByCandidate.keys()].some(candidateId => !matched.has(candidateId))) throw new Error("Some reviewed Washington facts have no unique accepted identity.");
	const snapshot: ElectionReferenceSnapshot = { schemaVersion: 1, type: "election-references", stateCode: "WA", sourceId: source.id, electionDate: source.electionDate, retrievedAt: new Date(Math.min(...documents.map(document => Date.parse(document.capturedAt)))).toISOString(), sourceSha256: digest(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), recordCount: records.length, documents, records };
	return { snapshot, identities, holds };
}
