import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import type { PublicJudicialEvaluation } from "./types/civic.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";
import { containsControlCharacters } from "./text-validation.js";

export const judicialEvaluationSources = [{
	id: "ak-ajc-2026",
	stateCode: "AK",
	electionDate: "2026-11-03",
	issuer: "Alaska Judicial Council",
	rosterSourceId: "ak-doe-2026",
	publicationDate: "2026-09-04",
	documentUrls: ["https://ajc.alaska.gov/retention/current2026.html", "https://ajc.alaska.gov/retention/docs/pr_2026_ret_recommendations_UPDATED.pdf"],
	maximumPage: 4,
}] as const;

interface JudicialEvaluationRecord {
	officialRecordId: string;
	officialName: string;
	officialOffice: string;
	officialScope: "statewide" | "local";
	officialSourceDistrictLabel: string;
	councilDisplayName: string;
	courtLabel: string;
	recommendation: PublicJudicialEvaluation["recommendation"];
	performanceFinding: PublicJudicialEvaluation["performanceFinding"];
	criteriaCited: string[];
	sourcePage: number;
	councilVote: { yes: number | null; no: number | null; abstain: number | null; unanimous: boolean };
}

export interface JudicialEvaluationSnapshot {
	schemaVersion: 1;
	type: "official-judicial-evaluations";
	sourceId: string;
	stateCode: string;
	electionDate: string;
	issuer: string;
	publicationDate: string;
	researchSha256: string;
	roster: { sourceId: string; sha256: string; retrievedAt: string; recordCount: number };
	documents: { url: string; sha256: string; capturedAt: string }[];
	records: JudicialEvaluationRecord[];
	publicationReview: { status: "unreviewed" | "approved"; reviewer: string | null; reviewedAt: string | null; contentSha256: string };
}

export interface JudicialEvaluationRepository {
	getEvaluation: (roster: StateBallotSnapshot, officialRecordId: string) => Promise<PublicJudicialEvaluation | null>;
}

const digest = (body: string) => createHash("sha256").update(body).digest("hex");
const validHash = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{64}$/u.test(value);
const validText = (value: unknown, maximum = 300): value is string => typeof value === "string" && Boolean(value.trim()) && value.trim() === value && value.length <= maximum && !containsControlCharacters(value);
const validInstant = (value: unknown, now: number): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now;
const exactKeys = (value: object, keys: string[]) => Object.keys(value).sort().join(",") === keys.sort().join(",");
const objectValue = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function judicialEvaluationContentSha256(snapshot: JudicialEvaluationSnapshot) {
	return digest(JSON.stringify(Object.fromEntries(Object.entries(snapshot).filter(([key]) => key !== "publicationReview"))));
}

export function parseJudicialEvaluationSnapshot(body: string, now = Date.now()): JudicialEvaluationSnapshot {
	if (Buffer.byteLength(body) > 1024 * 1024) throw new Error("Judicial evaluation data exceeds its size limit.");
	const value: unknown = JSON.parse(body);
	if (!objectValue(value) || !exactKeys(value, ["schemaVersion", "type", "sourceId", "stateCode", "electionDate", "issuer", "publicationDate", "researchSha256", "roster", "documents", "records", "publicationReview"])) throw new Error("Judicial evaluation fields are invalid.");
	const data = value as unknown as JudicialEvaluationSnapshot;
	const source = judicialEvaluationSources.find(source => source.id === data.sourceId);
	if (!source || data.schemaVersion !== 1 || data.type !== "official-judicial-evaluations" || data.stateCode !== source.stateCode || data.electionDate !== source.electionDate || data.issuer !== source.issuer || data.publicationDate !== source.publicationDate || !validHash(data.researchSha256)) throw new Error("Judicial evaluations do not match their configured source and election.");
	if (!objectValue(data.roster) || !exactKeys(data.roster, ["sourceId", "sha256", "retrievedAt", "recordCount"]) || data.roster.sourceId !== source.rosterSourceId || !validHash(data.roster.sha256) || !validInstant(data.roster.retrievedAt, now) || !Number.isSafeInteger(data.roster.recordCount) || data.roster.recordCount < 1 || data.roster.recordCount > 25_000) throw new Error("Judicial evaluations require an exact official roster binding.");
	if (!Array.isArray(data.documents) || data.documents.length !== source.documentUrls.length) throw new Error("Judicial evaluation documents are invalid.");
	for (const [index, document] of data.documents.entries()) {
		if (!objectValue(document) || !exactKeys(document, ["url", "sha256", "capturedAt"]) || document.url !== source.documentUrls[index] || !validHash(document.sha256) || !validInstant(document.capturedAt, now) || Date.parse(document.capturedAt) < Date.parse(source.publicationDate)) throw new Error("Judicial evaluation document provenance is invalid.");
	}
	if (!Array.isArray(data.records) || !data.records.length || data.records.length > 1000 || data.records.length > data.roster.recordCount) throw new Error("Judicial evaluation records are invalid.");
	const identities = new Set<string>();
	for (const record of data.records) {
		if (!objectValue(record) || !exactKeys(record, ["officialRecordId", "officialName", "officialOffice", "officialScope", "officialSourceDistrictLabel", "councilDisplayName", "courtLabel", "recommendation", "performanceFinding", "criteriaCited", "sourcePage", "councilVote"])
			|| typeof record.officialRecordId !== "string" || !/^[a-f\d]{24}$/u.test(record.officialRecordId) || identities.has(record.officialRecordId)
			|| !validText(record.officialName) || !validText(record.officialOffice) || !/Judicial retention/iu.test(record.officialOffice) || !["statewide", "local"].includes(record.officialScope)
			|| typeof record.officialSourceDistrictLabel !== "string" || record.officialSourceDistrictLabel.length > 300 || containsControlCharacters(record.officialSourceDistrictLabel) || !validText(record.councilDisplayName) || !validText(record.courtLabel)) {
			throw new Error("Judicial evaluation identities are invalid or duplicated.");
		}
		const expectedFinding = { "retain": "met-standards", "do-not-retain": "did-not-meet-standards", "not-made": "not-made" }[record.recommendation];
		if (!expectedFinding || record.performanceFinding !== expectedFinding || !Array.isArray(record.criteriaCited) || record.criteriaCited.length > 20 || !record.criteriaCited.every(criterion => validText(criterion, 200)) || (record.recommendation === "not-made" && record.criteriaCited.length)
			|| !Number.isSafeInteger(record.sourcePage) || record.sourcePage < 1 || record.sourcePage > source.maximumPage) {
			throw new Error("Institutional findings and reviewed source pages must remain explicit.");
		}
		if (!objectValue(record.councilVote) || !exactKeys(record.councilVote, ["yes", "no", "abstain", "unanimous"]) || typeof record.councilVote.unanimous !== "boolean" || ![record.councilVote.yes, record.councilVote.no, record.councilVote.abstain].every(count => count === null || (Number.isSafeInteger(count) && count >= 0 && count <= 1000))) throw new Error("Known and unknown Council vote counts must remain distinct.");
		identities.add(record.officialRecordId);
	}
	const review = data.publicationReview;
	if (!objectValue(review) || !exactKeys(review, ["status", "reviewer", "reviewedAt", "contentSha256"]) || !validHash(review.contentSha256) || review.contentSha256 !== judicialEvaluationContentSha256(data)) throw new Error("Judicial evaluation review must bind the exact content.");
	if (review.status === "unreviewed") {
		if (review.reviewer !== null || review.reviewedAt !== null) throw new Error("Unreviewed judicial evaluations cannot carry publication approval.");
	}
	else if (review.status !== "approved" || !validText(review.reviewer, 200) || !validInstant(review.reviewedAt, now) || Date.parse(review.reviewedAt) < Math.max(...data.documents.map(document => Date.parse(document.capturedAt)))) {
		throw new Error("Public judicial evaluations require an explicit current content review.");
	}
	return data;
}

export function createJudicialEvaluationRepository(options: { dataDirectory?: string | null; now?: () => number } = {}): JudicialEvaluationRepository {
	const directory = options.dataDirectory === undefined ? process.env.STATE_BALLOT_DATA_DIR || null : options.dataDirectory;
	if (directory) assertExternalStateDataDirectory(directory);
	const now = options.now ?? Date.now;
	return { async getEvaluation(roster, officialRecordId) {
		const source = judicialEvaluationSources.find(source => source.stateCode === roster.source.stateCode && source.rosterSourceId === roster.source.id && source.electionDate === roster.source.electionDate);
		if (!directory || !source || now() >= Date.parse(source.electionDate) + 2 * 86400000) return null;
		let body: string;
		try {
			const canonicalDirectory = await realpath(directory);
			assertExternalStateDataDirectory(canonicalDirectory);
			body = (await readBoundedStateDataBytes(join(canonicalDirectory, `${source.id}.judicial-evaluations.json`), 1024 * 1024)).toString("utf8");
		}
		catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
			throw error;
		}
		const data = parseJudicialEvaluationSnapshot(body, now());
		if (data.publicationReview.status !== "approved") return null;
		if (data.sourceId !== source.id || data.roster.sha256 !== roster.sha256 || data.roster.retrievedAt !== roster.retrievedAt || data.roster.recordCount !== roster.records.length) throw new Error("The official judicial roster changed; a new exact identity review is required.");
		const officialRecords = new Map(roster.records.map(record => [record.id, record]));
		for (const record of data.records) {
			const official = officialRecords.get(record.officialRecordId);
			if (!official || official.name !== record.officialName || official.office !== record.officialOffice || official.scope !== record.officialScope || (official.sourceDistrictLabel ?? "") !== record.officialSourceDistrictLabel) throw new Error("Judicial evaluation identity does not match the exact official record.");
		}
		const record = data.records.find(record => record.officialRecordId === officialRecordId);
		if (!record) return null;
		return { officialRecordId, stateCode: data.stateCode, electionDate: data.electionDate, issuer: data.issuer, courtLabel: record.courtLabel, recommendation: record.recommendation, performanceFinding: record.performanceFinding, criteriaCited: record.criteriaCited, publicationDate: data.publicationDate, source: { url: `${data.documents[1]!.url}#page=${record.sourcePage}`, capturedAt: data.documents[1]!.capturedAt } };
	} };
}
