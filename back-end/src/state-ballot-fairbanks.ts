import type { FairbanksCandidateDocument } from "./fairbanks-ballot-candidates.js";
import type { prepareFairbanksCandidateEvidence } from "./fairbanks-candidate-preparation.js";
import type { FairbanksPublicationAccessReview, FairbanksPublicationCapture, fetchFairbanksElectionPublications } from "./fairbanks-election-publications.js";
import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { readFairbanksBallotCandidates } from "./fairbanks-ballot-candidates.js";
import { fairbanksPublicationIndexUrl, readFairbanksPublicationCapture } from "./fairbanks-election-publications.js";

type Factory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;
type Evidence = Awaited<ReturnType<typeof prepareFairbanksCandidateEvidence>>;
type CollectionOptions = Parameters<typeof fetchFairbanksElectionPublications>[0] & { discovery?: string; scratchDirectory?: string; prepare?: typeof prepareFairbanksCandidateEvidence };
export interface FairbanksElection { electionId: null; electionDate: string; pageUrl: string; fairbanksDocuments: { kind: "sample" | "notice"; url: string; sha256: string }[] }
interface CandidateCapture { schemaVersion: 1; type: "fairbanks-candidate-capture"; capture: FairbanksPublicationCapture; native: Evidence }
function defaults() {
	return ["https://www.fnsb.gov/DocumentCenter/View/28941/FNSB-Sample-Ballot-PDF", "https://www.fnsb.gov/DocumentCenter/View/29012/Notice-of-Election-PDF"];
}
const hash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{64}$/u.test(value);
function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));
}
function requireValue(condition: unknown, detail: string): asserts condition {
	if (!condition) throw new Error(`The Fairbanks candidate source requires review: ${detail}.`);
}
function electionDate(value: unknown): value is string {
	return typeof value === "string" && /^20\d{2}-(?:10|11)-\d{2}$/u.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value && new Date(`${value}T00:00:00Z`).getUTCDay() === 2 && value >= "2026-10-06";
}
function documentUrls(value: unknown): value is string[] {
	return Array.isArray(value) && value.length === 2 && new Set(value).size === 2 && value.every(url => typeof url === "string" && /^https:\/\/www\.fnsb\.gov\/DocumentCenter\/View\/\d{1,8}\/[A-Za-z0-9-]+-PDF$/u.test(url));
}
export function validateFairbanksElection(value: unknown): asserts value is FairbanksElection {
	requireValue(exact(value, ["electionId", "electionDate", "pageUrl", "fairbanksDocuments"]) && value.electionId === null && electionDate(value.electionDate) && value.pageUrl === fairbanksPublicationIndexUrl() && Array.isArray(value.fairbanksDocuments) && value.fairbanksDocuments.length === 2, "election identity");
	const documents = value.fairbanksDocuments;
	requireValue(documents.every((document, index) => exact(document, ["kind", "url", "sha256"]) && document.kind === (index ? "notice" : "sample") && digest(document.sha256)) && documentUrls(documents.map(document => document.url)), "offered document inventory");
}
export function fairbanksSource(date = "2026-10-06", urls = defaults()): StateBallotSource {
	requireValue(electionDate(date) && documentUrls(urls), "source date and publications");
	return { stateCode: "AK", id: date === "2026-10-06" ? "ak-fairbanks-2026" : `ak-fairbanks-municipal-${date}`, label: "Fairbanks municipal candidates", electionDate: date, url: urls[0]!, pageUrl: fairbanksPublicationIndexUrl(), format: "fairbanks-pdf", countyName: "Fairbanks North Star Borough", documentUrls: [...urls], snapshotStorage: "external", ballotPreview: false };
}
export function validateFairbanksSource(source: StateBallotSource) {
	const expected = fairbanksSource(source.electionDate, source.documentUrls ? [...source.documentUrls] : []);
	requireValue(exact(source, Object.keys(expected)) && Object.entries(expected).every(([key, value]) => isDeepStrictEqual(source[key as keyof StateBallotSource], value)), "source configuration");
}
export function fairbanksDocumentDigest(documents: readonly { url: string; sha256: string }[]) {
	return hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 }))));
}
export function readFairbanksCycleDiscovery(body: string, now = Date.now()) {
	requireValue(typeof body === "string" && Buffer.byteLength(body) <= 12 * 1024 * 1024, "discovery bounds");
	const capture: unknown = JSON.parse(body);
	const inventory = readFairbanksPublicationCapture(capture, now);
	const accepted = capture as FairbanksPublicationCapture;
	const election = { electionId: null, electionDate: inventory.electionDate, pageUrl: fairbanksPublicationIndexUrl(), fairbanksDocuments: accepted.documents.map(({ kind, url, sha256 }) => ({ kind, url, sha256 })) };
	validateFairbanksElection(election);
	return { capture: accepted, index: accepted.index, elections: [election] };
}
function geometry(documents: FairbanksCandidateDocument[], capture: FairbanksPublicationCapture) {
	for (const [index, document] of documents.entries()) {
		requireValue(exact(document, ["kind", "sourceSha256", "geometry", "bbox", "pages"]) && Array.isArray(document.pages) && document.pages.every(page => exact(page, ["page", "width", "height", "dpi", "pngSha256", "ocr", "svg"])), "native document contract");
		const value = document.geometry;
		const expected = index ? [0, 0, 792, 792] : [0, 0, 612, 1008];
		requireValue(exact(value, ["schemaVersion", "objectsSha256", "pages"]) && value.schemaVersion === 1 && digest(value.objectsSha256) && Array.isArray(value.pages) && value.pages.length === capture.documents[index]!.text.split("\f").filter(page => page.trim()).length, "inspected page inventory");
		for (const [position, page] of value.pages.entries()) requireValue(exact(page, ["page", "mediaBox", "cropBox", "rotation", "userUnit"]) && page.page === position + 1 && isDeepStrictEqual(page.mediaBox, expected) && isDeepStrictEqual(page.cropBox, expected) && page.rotation === 0 && page.userUnit === 1, "inspected page geometry");
	}
}
export function readFairbanksCandidateCapture(body: string, now = Date.now()) {
	requireValue(typeof body === "string" && Buffer.byteLength(body) <= 12 * 1024 * 1024, "capture bounds");
	const value: unknown = JSON.parse(body);
	requireValue(exact(value, ["schemaVersion", "type", "capture", "native"]) && value.schemaVersion === 1 && value.type === "fairbanks-candidate-capture", "capture contract");
	const discovery = readFairbanksCycleDiscovery(JSON.stringify(value.capture), now);
	requireValue(exact(value.native, ["tools", "prepared", "documents"]) && exact(value.native.tools, ["textSha256", "rendererSha256", "vectorSha256", "inspectorSha256", "readerSha256", "readerVersion"]) && Object.entries(value.native.tools).every(([key, item]) => key === "readerVersion" ? typeof item === "string" && /^tesseract 5\.\d+\.\d+\b/u.test(item) : digest(item)) && Array.isArray(value.native.documents) && value.native.documents.length === 2, "native evidence inventory");
	const documents = value.native.documents as FairbanksCandidateDocument[];
	geometry(documents, discovery.capture);
	const prepared = readFairbanksBallotCandidates(discovery.capture, documents, now);
	requireValue(isDeepStrictEqual(prepared, value.native.prepared), "native evidence result binding");
	return { ...(value as unknown as CandidateCapture), prepared, election: discovery.elections[0]! };
}
export function parseFairbanksCandidateCapture(source: StateBallotSource, body: string, factory: Factory, now = Date.now(), previous?: { records: readonly StateCandidateRecord[]; documents?: readonly { url: string; sha256: string; retrievedAt: string }[] }) {
	validateFairbanksSource(source);
	const result = readFairbanksCandidateCapture(body, now);
	requireValue(result.election.electionDate === source.electionDate && isDeepStrictEqual(result.election.fairbanksDocuments.map(item => item.url), source.documentUrls), "source and captured election agreement");
	const records = result.prepared.records.map((candidate) => {
		const record = factory(source, { name: candidate.name, office: candidate.office, district: "", scope: "local", jurisdiction: candidate.jurisdiction, party: "", status: "listed", termYears: candidate.termYears });
		requireValue(record, "normalized candidate identity");
		record.voteLimit = candidate.voteLimit;
		return record;
	});
	requireValue(new Set(records.map(record => record.id)).size === records.length, "duplicate candidate identity");
	if (previous?.records.some(record => !records.some(item => item.id === record.id))) throw new Error("An accepted Fairbanks candidate disappeared; retain the snapshot for review.");
	const documents = result.capture.documents.map(document => ({ url: document.url, sha256: document.sha256, retrievedAt: previous?.documents?.find(item => item.url === document.url && item.sha256 === document.sha256)?.retrievedAt ?? document.capturedAt, includedRecordCount: result.prepared.records.filter(record => record.sourceUrl === document.url).length }));
	return { records, documents, retrievedAt: new Date(Math.min(...documents.map(document => Date.parse(document.retrievedAt)))).toISOString(), sha256: fairbanksDocumentDigest(documents), collectionIndexSha256: fairbanksDocumentDigest(documents) };
}
export function validateFairbanksStoredSnapshot(source: StateBallotSource, data: Record<string, unknown>) {
	validateFairbanksSource(source);
	requireValue(Array.isArray(data.documents) && data.documents.length === 2 && data.documents.every((document, index) => document && document.url === source.documentUrls?.[index] && digest(document.sha256)), "stored document inventory");
	requireValue(data.collectionIndexSha256 === fairbanksDocumentDigest(data.documents) && data.sourceSha256 === data.collectionIndexSha256, "stored document digest");
	requireValue(Array.isArray(data.records) && data.records.every(record => record && record.scope === "local" && record.district === "" && record.status === "listed" && !record.party && !record.incumbent && !record.candidateUrl && ["Fairbanks North Star Borough", "City of Fairbanks", "City of North Pole"].includes(record.jurisdiction) && Number.isSafeInteger(record.termYears) && record.termYears >= 1 && record.termYears <= 9 && Number.isSafeInteger(record.voteLimit) && record.voteLimit >= 1 && record.voteLimit <= 9 && record.termEnd === undefined && record.seats === undefined), "stored municipal candidate fields");
}
async function reviewFile(options: CollectionOptions) {
	if (options?.accessReview || !process.env.STATE_BALLOT_FAIRBANKS_REVIEW_FILE) return options?.accessReview;
	const { readBoundedStateDataBytes } = await import("./state-ballot-storage.js");
	return JSON.parse((await readBoundedStateDataBytes(process.env.STATE_BALLOT_FAIRBANKS_REVIEW_FILE, 16384)).toString("utf8")) as FairbanksPublicationAccessReview;
}
export async function fetchFairbanksCycleDiscovery(options: CollectionOptions = {}) {
	const { fetchFairbanksElectionPublications } = await import("./fairbanks-election-publications.js");
	const capture = await fetchFairbanksElectionPublications({ ...options, accessReview: await reviewFile(options) });
	const body = JSON.stringify(capture);
	readFairbanksCycleDiscovery(body, (options.now ?? Date.now)());
	return body;
}
export async function fetchFairbanksCandidateCapture(source: StateBallotSource, options: CollectionOptions = {}) {
	validateFairbanksSource(source);
	const directory = options.scratchDirectory ?? process.env.STATE_BALLOT_FAIRBANKS_EVIDENCE_DIR;
	requireValue(directory, "configured private collection directory");
	const { assertExternalStateDataDirectory } = await import("./state-ballot-storage.js");
	assertExternalStateDataDirectory(directory);
	await mkdir(directory, { recursive: true, mode: 0o700 });
	requireValue(await realpath(directory) === directory, "physical collection directory");
	const path = join(directory, "fairbanks-collection.lock");
	const lock = await open(path, "wx", 0o600).catch((error: NodeJS.ErrnoException) => {
		if (error.code === "EEXIST") throw new Error("The Fairbanks collection lock requires review; retain accepted evidence.");
		throw error;
	});
	try {
		await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
		await lock.sync();
		return await collectFairbanksCandidates(source, options, directory);
	}
	finally {
		await lock.close();
		await unlink(path);
	}
}
async function collectFairbanksCandidates(source: StateBallotSource, options: CollectionOptions, directory: string) {
	const { readBoundedStateDataBytes } = await import("./state-ballot-storage.js");
	const pointer = join(directory, "fairbanks-last-capture.json");
	let previous: ReturnType<typeof readFairbanksCandidateCapture> | undefined;
	try {
		previous = readFairbanksCandidateCapture((await readBoundedStateDataBytes(pointer)).toString("utf8"), (options.now ?? Date.now)());
	}
	catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
	const discovered = options.discovery ?? await fetchFairbanksCycleDiscovery({ ...options, previous: previous?.capture });
	const now = (options.now ?? Date.now)();
	const discovery = readFairbanksCycleDiscovery(discovered, now);
	requireValue(discovery.elections[0]!.electionDate === source.electionDate && isDeepStrictEqual(discovery.elections[0]!.fairbanksDocuments.map(item => item.url), source.documentUrls), "offered election selection");
	const capture = discovery.capture;
	if (previous) {
		const pages = [...previous.capture.policies, previous.capture.index, ...previous.capture.documents];
		for (const page of [...capture.policies, capture.index, ...capture.documents]) page.capturedAt = pages.find(item => item.url === page.url && item.sha256 === page.sha256 && item.body === page.body)?.capturedAt ?? page.capturedAt;
	}
	const { prepareFairbanksCandidateEvidence, storeFairbanksCandidateEvidence } = await import("./fairbanks-candidate-preparation.js");
	const reuse = previous && previous.election.electionDate === source.electionDate && previous.capture.documents.every((document, index) => document.sha256 === capture.documents[index]!.sha256 && document.url === capture.documents[index]!.url);
	const native = previous && reuse ? { ...previous.native, prepared: readFairbanksBallotCandidates(capture, previous.native.documents, now) } : await (options.prepare ?? prepareFairbanksCandidateEvidence)(capture, directory, now);
	if (previous?.election.electionDate === source.electionDate && previous.prepared.records.some(record => !native.prepared.records.some(item => item.name === record.name && item.office === record.office && item.jurisdiction === record.jurisdiction))) throw new Error("An accepted Fairbanks candidate disappeared; retain the evidence for review.");
	const body = Buffer.from(JSON.stringify({ schemaVersion: 1, type: "fairbanks-candidate-capture", capture, native }));
	readFairbanksCandidateCapture(body.toString("utf8"), now);
	const contentUnchanged = previous && reuse && previous.capture.index.sha256 === capture.index.sha256 && previous.capture.policies.every((policy, index) => policy.sha256 === capture.policies[index]!.sha256) && isDeepStrictEqual(previous.capture.accessReview, capture.accessReview);
	if (!contentUnchanged) await storeFairbanksCandidateEvidence(directory, body, source.electionDate);
	const temporary = join(directory, `.${randomUUID()}.capture.tmp`);
	const handle = await open(temporary, "wx", 0o600);
	try {
		await handle.writeFile(body);
		await handle.sync();
		await handle.close();
		await rename(temporary, pointer);
		const parent = await open(directory, "r");
		try {
			await parent.sync();
		}
		finally {
			await parent.close();
		}
	}
	finally {
		await handle.close().catch(() => {});
		await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== "ENOENT") throw error;
		});
	}
	return body.toString("utf8");
}
