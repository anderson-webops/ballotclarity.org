import type { ElectionReferenceSource } from "./election-reference-sources.js";
import type { ElectionReferenceSnapshot } from "./election-references.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { containsControlCharacters } from "./text-validation.js";

const directoryPublicationDate = "2026-02-20";

export const congressionalDirectory = {
	url: `https://www.govinfo.gov/content/pkg/CDIR-${directoryPublicationDate}/text/CDIR-${directoryPublicationDate}.txt`,
	pageUrl: `https://www.govinfo.gov/app/details/CDIR-${directoryPublicationDate}`,
	publishedDate: directoryPublicationDate,
	congress: 119,
	editionYears: "2025-2026",
	compilationCutoff: "2025-10-01",
	compilationNotice: "Closing date for compilation of the Congressional Directory was October 1, 2025.",
	electionDate: "2026-11-03",
};

export const congressionalBiographySources: readonly ElectionReferenceSource[] = ["AL", "AZ", "CA", "CO", "CT", "FL", "GA", "HI", "IA", "IL", "IN", "KS", "KY", "MA", "MD", "ME", "MI", "MN", "MO", "MS", "MT", "NC", "NE", "NH", "NJ", "NM", "NV", "NY", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "VA", "WI", "WV"].map(stateCode => ({
	id: `us-cdir-${stateCode.toLowerCase()}-${congressionalDirectory.electionDate.slice(0, 4)}`,
	stateCode,
	electionDate: congressionalDirectory.electionDate,
	documents: [{ url: congressionalDirectory.url, pageUrl: congressionalDirectory.pageUrl, title: `${congressionalDirectory.editionYears} Congressional Directory biographies`, publisher: "U.S. Government Publishing Office", kind: "official-biography" as const, publishedDate: congressionalDirectory.publishedDate }],
}));

export interface CongressionalBiography {
	name: string;
	stateCode: string;
	offset: number;
	education?: string;
	professionalHistory?: string;
}

const reviewedFieldHolds: readonly { edition: string; stateCode: string; name: string; field: "education" | "professionalHistory"; clause?: string; omitDate?: boolean }[] = [
	{ edition: "2026-02-20", stateCode: "MN", name: "KELLY MORRISON", field: "education" },
	{ edition: "2026-02-20", stateCode: "MI", name: "JOHN JAMES", field: "education" },
	{ edition: "2026-02-20", stateCode: "IN", name: "VICTORIA SPARTZ", field: "professionalHistory", clause: "adjunct professor, Indiana State University Kelley School of Business, 2013-20" },
	{ edition: "2026-02-20", stateCode: "SD", name: "MIKE ROUNDS", field: "professionalHistory", clause: "governor, South Dakota, 2002-10", omitDate: true },
	{ edition: "2026-02-20", stateCode: "SD", name: "MIKE ROUNDS", field: "professionalHistory", clause: "member, South Dakota State Senate, 1990-2000 (Minority Whip, 1993; Majority Leader, 1995)" },
	{ edition: "2026-02-20", stateCode: "NY", name: "JOSEPH D. MORELLE", field: "professionalHistory", clause: "member, New York State Assembly, 1990-2018 (Majority Leader, 2013-18)", omitDate: true },
];

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const fieldLabel = /; (?:education|professional history|military service|election history|committees|religion|spouse|children|family|married): /u;
const normalizeName = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").replace(/[.,'’"()]/gu, "").replace(/-/gu, " ").toUpperCase().replace(/\s+/gu, " ").trim();
const withoutInitials = (value: string) => normalizeName(value).replace(/\b[A-Z]\b/gu, "").replace(/\s+/gu, " ").trim();

export function parseCongressionalBiographies(body: string): CongressionalBiography[] {
	const header = body.slice(0, 4000).replace(/\s+/gu, " ");
	const congress = header.match(/Official Congressional Directory (\d+)(?:st|nd|rd|th) Congress/u)?.[1];
	if (Buffer.byteLength(body) > 8 * 1024 * 1024 || !header.includes(congressionalDirectory.editionYears) || Number(congress) !== congressionalDirectory.congress || !body.includes(congressionalDirectory.compilationNotice))
		throw new Error("The directory does not match the reviewed edition and compilation cutoff.");
	const text = body.replace(/\r\n/gu, "\n");
	const pattern = /^(\p{Lu}[\p{Lu} .,'’"()\-]+?), (?:Republican|Democrat|Independent), of [^;]+?\b([A-Z]{2});[\s\S]*?(?=\n[ \t]*\n)/gmu;
	const biographies = [...text.matchAll(pattern)].map((match) => {
		const paragraph = match[0].replace(/-\n\s*/gu, "-").replace(/\s+/gu, " ").trim();
		const field = (name: string) => {
			const prefix = `; ${name}: `;
			const start = paragraph.indexOf(prefix);
			if (start < 0) return undefined;
			const remaining = paragraph.slice(start + prefix.length);
			const end = remaining.search(fieldLabel);
			const value = (end < 0 ? remaining : remaining.slice(0, end)).trim();
			if (!value || value.length > 1100 || containsControlCharacters(value) || /\uFFFD|https?:|@/u.test(value)) return undefined;
			return value;
		};
		return { name: match[1]!, stateCode: match[2]!, offset: match.index, education: field("education"), professionalHistory: field("professional history") };
	});
	if (!biographies.length) throw new Error("The directory contains no recognized biographies.");
	return biographies;
}

function candidatePeople(record: StateCandidateRecord) {
	const parts = record.name.split(/\s+(?:and|\/|&)\s+/iu);
	const ticket = /governor/iu.test(record.office) && /lieutenant|lt\.?/iu.test(record.office);
	if (parts.length !== 1 && (!ticket || parts.length !== 2)) return [];
	return parts.map((part, index) => {
		const comma = part.split(",").map(value => value.trim());
		const name = comma.length === 2 && !/^(?:JR|SR|II|III|IV)\.?$/iu.test(comma[1]!) ? `${comma[1]} ${comma[0]}` : part;
		return { name, office: ticket && parts.length === 2 ? index === 0 ? "Governor" : "Lieutenant Governor" : record.office, slot: index };
	});
}

function splitClauses(value: string) {
	const clauses: string[] = [];
	let depth = 0;
	let start = 0;
	for (let index = 0; index < value.length; index++) {
		if (value[index] === "(") depth++;
		if (value[index] === ")") {
			if (!depth) return [];
			depth--;
		}
		if (value[index] === ";" && value[index + 1] === " " && !depth) {
			clauses.push(value.slice(start, index));
			start = index + 2;
		}
	}
	if (depth) return [];
	clauses.push(value.slice(start));
	return clauses;
}

function fieldFacts(label: string, value?: string) {
	if (!value) return [];
	const facts: string[] = [];
	let current = `${label}: `;
	const parts = splitClauses(value).filter(part => !/\bpresent\b|\bcurrent(?:ly)?\b|\b\d{4}[-–]\s*(?:$|[).,])/iu.test(part));
	if (!parts.length) return [];
	for (const part of parts) {
		if (part.length + label.length + 3 > 600) return [];
		if (current.length + part.length + 3 > 600) {
			facts.push(current.replace(/; $/u, ".").replace(/\.{2}$/u, "."));
			current = `${label}: `;
		}
		current += `${part}; `;
	}
	facts.push(current.replace(/; $/u, ".").replace(/\.{2}$/u, "."));
	return facts;
}

function reviewedField(biography: CongressionalBiography, field: "education" | "professionalHistory") {
	const holds = reviewedFieldHolds.filter(hold => hold.edition === congressionalDirectory.publishedDate && hold.stateCode === biography.stateCode && hold.name === biography.name && hold.field === field);
	if (holds.some(hold => !hold.clause)) return undefined;
	const value = biography[field];
	return value ? splitClauses(value).filter(clause => !holds.some(hold => hold.clause === clause && !hold.omitDate)).map(clause => holds.some(hold => hold.clause === clause && hold.omitDate) ? clause.replace(/, \d{4}-\d{2,4}(?: \([^)]*\))?$/u, "") : clause).join("; ") : undefined;
}

export function prepareCongressionalBiographies(options: { body: string; capturedAt: string; sha256: string; candidates: readonly StateBallotSnapshot[]; previous: readonly ElectionReferenceSnapshot[] }) {
	if (!Number.isFinite(Date.parse(options.capturedAt)) || Date.parse(options.capturedAt) > Date.now() || Date.parse(options.capturedAt) < Date.parse(congressionalDirectory.publishedDate) || options.sha256 !== digest(options.body))
		throw new Error("The directory capture provenance is invalid.");
	const biographies = parseCongressionalBiographies(options.body);
	const outputs = congressionalBiographySources.map(source => ({ source, records: [] as ElectionReferenceSnapshot["records"], identities: [] as { candidateId: string; candidateName: string; candidateSourceId: string; directoryName: string; biographyOffset: number; slot: number }[] }));
	for (const candidateSnapshot of options.candidates) {
		const source = candidateSnapshot.source;
		if (source.electionDate !== congressionalDirectory.electionDate || ["nc-sbe-2026", "nm-sos-2026"].includes(source.id) || !Number.isFinite(Date.parse(candidateSnapshot.retrievedAt)) || Date.parse(candidateSnapshot.retrievedAt) > Date.now()) throw new Error("The candidate source or capture time is not permitted for this preparation.");
		const output = outputs.find(item => item.source.stateCode === source.stateCode);
		if (!output) continue;
		for (const candidate of candidateSnapshot.records) {
			if (!["listed", "filed", "qualified", "write-in"].includes(candidate.status) || (candidate.scope !== "congressional" && !(candidate.scope === "statewide" && /(?:U\.?S|United States).*Senat|Governor/iu.test(candidate.office) && !/Wayne State|Board of|Regent/iu.test(candidate.office)))) continue;
			for (const person of candidatePeople(candidate)) {
				const matches = biographies.filter(biography => biography.stateCode === source.stateCode && normalizeName(biography.name) === normalizeName(person.name));
				if (matches.length !== 1 || options.previous.some(snapshot => !snapshot.sourceId.startsWith("us-cdir-") && snapshot.stateCode === source.stateCode && snapshot.electionDate === source.electionDate && snapshot.records.some(record => withoutInitials(record.name) === withoutInitials(person.name)))) continue;
				const biography = matches[0]!;
				const facts = [...fieldFacts("Education", reviewedField(biography, "education")), ...fieldFacts("Professional background", reviewedField(biography, "professionalHistory"))];
				if (!facts.length || facts.length > 6) continue;
				const id = digest(`${output.source.id}/${candidate.id}/${person.slot}`).slice(0, 24);
				if (output.records.some(record => record.id === id || normalizeName(record.name) === normalizeName(person.name))) continue;
				const office = candidate.scope === "congressional" && /representative|\bhouse\b/iu.test(person.office) && !/senat|delegate|resident commissioner/iu.test(person.office) ? "U.S. Representative" : person.office;
				output.records.push({ id, name: person.name, office, scope: candidate.scope, ...(candidate.jurisdiction ? { jurisdiction: candidate.jurisdiction } : candidate.district ? { jurisdiction: `${candidate.scope === "congressional" ? "Congressional District" : "District"} ${candidate.district}` } : {}), facts, sourceDocumentIndex: 0 });
				output.identities.push({ candidateId: candidate.id, candidateName: candidate.name, candidateSourceId: source.id, directoryName: biography.name, biographyOffset: biography.offset, slot: person.slot });
			}
		}
	}
	return outputs.filter(output => output.records.length).map(({ source, records, identities }) => {
		const documents = [{ url: congressionalDirectory.url, sha256: options.sha256, capturedAt: new Date(options.capturedAt).toISOString(), includedRecordCount: records.length }];
		const snapshot: ElectionReferenceSnapshot = { schemaVersion: 1, type: "election-references", stateCode: source.stateCode, sourceId: source.id, electionDate: source.electionDate, retrievedAt: documents[0]!.capturedAt, sourceSha256: digest(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), recordCount: records.length, documents, records };
		return { source, snapshot, identities };
	});
}
