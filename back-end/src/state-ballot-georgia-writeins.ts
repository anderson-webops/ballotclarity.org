import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { createStateCandidateRecord } from "./state-ballot-records.js";
import { parseBundledStateSnapshot } from "./state-ballot-snapshot.js";

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function calendarDate(month: string, day: string, year: string) {
	const value = `${year}-${String(months.indexOf(month) + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
	if (!months.includes(month) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error("The Georgia certificate date is invalid.");
	return value;
}

export function parseGeorgiaWriteInCertificate(text: string) {
	if (Buffer.byteLength(text) > 256 * 1024 || text.includes("\uFFFD") || text.split("\f").filter(page => page.trim()).length !== 1) throw new Error("The Georgia certificate exceeds its reviewed single-page format.");
	const lines = text.split(/\r?\n/u).map(line => line.replace(/\s+/gu, " ").trim()).filter(Boolean);
	const heading = lines.indexOf("FINAL LIST OF CERTIFIED WRITE-IN CANDIDATES");
	if (heading < 2 || !lines.slice(0, heading).includes("Office of the Secretary of State") || !lines.slice(0, heading).includes("Elections Division")) throw new Error("The Georgia certificate authority or final-list heading is missing.");
	const election = /^Listed below are the qualified Write-In Candidates for the (\w+) (\d{1,2}), (\d{4}), General Election$/u.exec(lines[heading + 1] ?? "");
	const publication = /^Published this (\d{1,2})(?:st|nd|rd|th) day of (\w+) (\d{4}) pursuant to O\.C\.G\.A\.? § 21-2-133\(e\)\(1\) Page 1 of 1$/u.exec(lines.at(-1) ?? "");
	const footer = lines.indexOf("Pursuant to O.C.G.A. § 21-2-494, Write-In votes will be counted only for the candidates whose names appear on this list.");
	if (!election || !publication || footer !== lines.length - 2) throw new Error("The Georgia certificate election, publication or completeness footer is invalid.");
	const electionDate = calendarDate(election[1]!, election[2]!, election[3]!);
	const publishedOn = calendarDate(publication[2]!, publication[1]!, publication[3]!);
	if (publishedOn > electionDate) throw new Error("The Georgia certificate publication follows its election.");
	const offices = new Set<string>();
	const identities = new Set<string>();
	const candidates: { name: string; office: string; district: string; scope: "statewide" | "congressional" | "state-house" }[] = [];
	let current: Omit<(typeof candidates)[number], "name"> | undefined;
	let count = 0;
	for (const line of lines.slice(heading + 2, footer)) {
		const congressional = /^U\.S\. House of Representatives, District ([1-9]\d{0,2})$/u.exec(line);
		const house = /^State Representative, District ([1-9]\d{0,2})$/u.exec(line);
		const office = line === "U.S. Senate"
			? { office: "United States Senate", district: "", scope: "statewide" as const }
			: line === "Governor"
				? { office: "Governor", district: "", scope: "statewide" as const }
				: congressional
					? { office: `United States House of Representatives - District ${congressional[1]}`, district: congressional[1]!, scope: "congressional" as const }
					: house ? { office: `State House District ${house[1]}`, district: house[1]!, scope: "state-house" as const } : undefined;
		if (office) {
			if ((current && !count) || offices.has(office.office)) throw new Error("The Georgia certificate repeats an office or leaves it empty.");
			offices.add(office.office);
			current = office;
			count = 0;
			continue;
		}
		if (!current || !/^[\p{L}\p{M}][\p{L}\p{M} .,'’\-]{1,148}$/u.test(line) || !line.includes(" ") || /\b(?:district|representatives?|senate|governor|commission|court|president|secretary|attorney|treasurer|sheriff|council)\b/iu.test(line)) throw new Error("The Georgia certificate has an unsupported office or candidate line.");
		const identity = JSON.stringify([current.office, line.normalize("NFKC").toLowerCase()]);
		if (identities.has(identity) || candidates.length >= 500) throw new Error("The Georgia certificate repeats a candidate or exceeds its bounds.");
		identities.add(identity);
		candidates.push({ ...current, name: line });
		count += 1;
	}
	if (!current || !count || !candidates.length) throw new Error("The Georgia certificate has no complete candidate section.");
	return { electionDate, publishedOn, candidates };
}

export function prepareGeorgiaWriteInSnapshot(source: StateBallotSource, text: string, pdfSha256: string, retrievedAt: string) {
	const certificate = parseGeorgiaWriteInCertificate(text);
	if (source.stateCode !== "GA" || source.recordRole !== "certified-writeins" || source.format !== "reviewed-pdf" || source.retrievalPolicy !== "manual-snapshot" || source.snapshotStorage !== "external" || source.electionDate !== certificate.electionDate || source.documentUrls?.length !== 1 || source.documentUrls[0] !== source.url || !/^[a-f0-9]{64}$/u.test(pdfSha256) || !Number.isFinite(Date.parse(retrievedAt)) || new Date(retrievedAt).toISOString() !== retrievedAt || retrievedAt.slice(0, 10) < certificate.publishedOn) throw new Error("The Georgia certificate does not match its reviewed source or capture provenance.");
	const records = certificate.candidates.map(candidate => createStateCandidateRecord(source, { ...candidate, party: "", status: "Certified write-in" }));
	if (records.some(record => !record)) throw new Error("A Georgia write-in could not be normalized.");
	const documents = [{ url: source.url, sha256: pdfSha256, retrievedAt, includedRecordCount: records.length }];
	const body = JSON.stringify({ schemaVersion: 1, stateCode: source.stateCode, sourceId: source.id, electionDate: source.electionDate, sourceUrl: source.pageUrl, retrievalPolicy: "manual-snapshot", retrievedAt, sourceSha256: createHash("sha256").update(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))).digest("hex"), recordCount: records.length, records, documents });
	parseBundledStateSnapshot(source, body);
	return { body, publishedOn: certificate.publishedOn };
}
