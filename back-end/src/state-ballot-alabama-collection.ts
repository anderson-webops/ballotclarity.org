import type { AlabamaReferenceCapture } from "./state-ballot-alabama-discovery.js";
import type { AlabamaNativeVerification } from "./state-ballot-alabama-native.js";
import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { setTimeout as wait } from "node:timers/promises";
import { electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import {
	alabamaAnnualPages,
	alabamaDiscoveryUrl,
	alabamaGeneralElection,
	prepareAlabamaReferences
} from "./state-ballot-alabama-discovery.js";
import { verifyAlabamaOriginal } from "./state-ballot-alabama-native.js";
import { officeContext } from "./state-ballot-alabama-records.js";
import {
	alabamaDocumentDigest,
	alabamaOrigin,
	alabamaRobotsSha256,
	validateAlabamaSource
} from "./state-ballot-alabama-source.js";
import { alabamaHash } from "./state-ballot-alabama-types.js";

interface Options {
	request?: typeof fetchRemoteSourceDocument;
	now?: () => number;
	sleep?: (milliseconds: number) => Promise<void>;
	discovery?: string;
	scratchDirectory?: string;
	objectExecutable?: string;
	verifyOriginal?: typeof verifyAlabamaOriginal;
	onResponse?: (url: string, response: Awaited<ReturnType<typeof fetchRemoteSourceDocument>>) => Promise<void>;
}
function exact(value: unknown, fields: string[]): value is Record<string, unknown> {
	return Boolean(
		value
		&& typeof value === "object"
		&& !Array.isArray(value)
		&& Object.keys(value).sort().join("|") === [...fields].sort().join("|")
	);
}
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{64}$/u.test(value);
function reject(): never {
	throw new Error("The Alabama candidate publication requires review.");
}
let pendingRequest = Promise.resolve();
let lastRequestAt: number | undefined;
async function acquire(url: string, options: Options, maximumBytes = 3 * 1024 * 1024) {
	const prior = pendingRequest;
	let release!: () => void;
	pendingRequest = new Promise<void>((resolve) => {
		release = resolve;
	});
	await prior;
	try {
		const now = options.now ?? Date.now;
		const before = now();
		if (lastRequestAt !== undefined) {
			await (options.sleep ?? wait)(
				before >= lastRequestAt ? Math.max(0, 20000 - (before - lastRequestAt)) : 20000
			);
		}
		lastRequestAt = now();
		const response = await (options.request ?? fetchRemoteSourceDocument)(url, {
			allowedHosts: ["www.sos.alabama.gov"],
			maxBytes: maximumBytes,
			timeoutMs: 12000
		});
		await options.onResponse?.(url, response);
		if (response.status !== 200 || response.body.length > maximumBytes) return reject();
		return { response, sha256: alabamaHash(response.body), capturedAt: new Date(now()).toISOString() };
	}
	finally {
		release();
	}
}
function utf8(bytes: Buffer) {
	const body = bytes.toString("utf8");
	if (body.includes("\uFFFD")) return reject();
	return body;
}
export function readAlabamaDiscovery(body: string, now = Date.now()) {
	if (typeof body !== "string" || Buffer.byteLength(body) > 32 * 1024 * 1024) return reject();
	return prepareAlabamaReferences(JSON.parse(body), now);
}
export async function fetchAlabamaCycleDiscovery(options: Options = {}) {
	const documents: AlabamaReferenceCapture["documents"] = [];
	const robots = await acquire(`${alabamaOrigin}/robots.txt`, options);
	if (robots.sha256 !== alabamaRobotsSha256) return reject();
	const permissions = electionDocumentRobotsPolicy(robots.response.body);
	documents.push({
		url: `${alabamaOrigin}/robots.txt`,
		body: utf8(robots.response.body),
		sha256: robots.sha256,
		capturedAt: robots.capturedAt
	});
	const page = async (url: string) => {
		if (!permissions.allowed(url)) return reject();
		const item = await acquire(url, options);
		if (!["text/html", "application/xhtml+xml"].includes(item.response.contentType)) return reject();
		const body = utf8(item.response.body);
		documents.push({ url, body, sha256: item.sha256, capturedAt: item.capturedAt });
		return body;
	};
	const index = await page(alabamaDiscoveryUrl);
	for (const [year, url] of alabamaAnnualPages(index)) {
		const annual = alabamaGeneralElection(await page(url), year);
		await page(annual.sampleIndexUrl);
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "alabama-election-reference-capture", documents });
	readAlabamaDiscovery(body, (options.now ?? Date.now)());
	return body;
}
function selectedElection(source: StateBallotSource, discovery: string, now: number) {
	const county = validateAlabamaSource(source);
	const capture = readAlabamaDiscovery(discovery, now);
	const election = capture.elections.find(item => item.electionDate === source.electionDate);
	if (!election) return reject();
	validateAlabamaSource(source, election);
	return { county, capture, election };
}
export async function fetchAlabamaCandidateCapture(source: StateBallotSource, options: Options = {}) {
	const now = options.now ?? Date.now;
	const discovery = options.discovery ?? (await fetchAlabamaCycleDiscovery(options));
	const { county, election } = selectedElection(source, discovery, now());
	const rawCapture = JSON.parse(discovery) as AlabamaReferenceCapture;
	const robots = rawCapture.documents.find(item => item.url === `${alabamaOrigin}/robots.txt`)!;
	if (!electionDocumentRobotsPolicy(Buffer.from(robots.body)).allowed(source.url)) return reject();
	if (!options.verifyOriginal && !options.scratchDirectory)
		throw new Error("Configure an absolute private scratch directory for Alabama collection.");
	const document = await acquire(source.url, options, 12 * 1024 * 1024);
	if (
		document.response.contentType !== "application/pdf"
		|| document.response.body.subarray(0, 5).toString() !== "%PDF-"
	) {
		return reject();
	}
	const native = await (options.verifyOriginal ?? verifyAlabamaOriginal)(
		document.response.body,
		{ county, electionDate: source.electionDate, sourceUrl: source.url, sourceSha256: document.sha256 },
		{ scratchDirectory: options.scratchDirectory ?? "", objectExecutable: options.objectExecutable }
	);
	const recheck = await acquire(election.pageUrl, options);
	const original = rawCapture.documents.find(item => item.url === election.pageUrl)!;
	if (
		!["text/html", "application/xhtml+xml"].includes(recheck.response.contentType)
		|| recheck.sha256 !== original.sha256
		|| JSON.stringify(alabamaGeneralElection(utf8(recheck.response.body), source.electionDate.slice(0, 4)))
		!== JSON.stringify({
			electionDate: election.electionDate,
			pageUrl: election.pageUrl,
			sampleIndexUrl: election.sampleIndexUrl,
			certifications: election.certifications
		})
	) {
		throw new Error("Alabama certification controls changed during collection; retain the accepted snapshot.");
	}
	return JSON.stringify({
		schemaVersion: 1,
		type: "alabama-candidate-capture",
		sourceConfigurationSha256: alabamaHash(JSON.stringify(source)),
		discovery: rawCapture,
		document: { url: source.url, sha256: document.sha256, retrievedAt: document.capturedAt },
		native
	});
}
export function parseAlabamaCandidateCapture(
	source: StateBallotSource,
	body: string,
	factory: typeof import("./state-ballot-records.js").createStateCandidateRecord,
	now = Date.now(),
	previous?: StateBallotSnapshot
) {
	validateAlabamaSource(source);
	if (Buffer.byteLength(body) > 32 * 1024 * 1024) return reject();
	const value: unknown = JSON.parse(body);
	if (
		!exact(value, ["schemaVersion", "type", "sourceConfigurationSha256", "discovery", "document", "native"])
		|| value.schemaVersion !== 1
		|| value.type !== "alabama-candidate-capture"
		|| value.sourceConfigurationSha256 !== alabamaHash(JSON.stringify(source))
	) {
		return reject();
	}
	const { county, election } = selectedElection(source, JSON.stringify(value.discovery), now);
	if (
		!exact(value.document, ["url", "sha256", "retrievedAt"])
		|| value.document.url !== source.url
		|| !digest(value.document.sha256)
		|| typeof value.document.retrievedAt !== "string"
		|| !Number.isFinite(Date.parse(value.document.retrievedAt))
		|| new Date(value.document.retrievedAt).toISOString() !== value.document.retrievedAt
		|| Date.parse(value.document.retrievedAt) > now
		|| (previous && Date.parse(value.document.retrievedAt) < Date.parse(previous.retrievedAt))
	) {
		return reject();
	}
	if (!exact(value.native, ["result", "proof"])) return reject();
	const native = value.native as unknown as AlabamaNativeVerification;
	const review = native.result;
	const proof = native.proof;
	if (
		!proof?.objectProof
		|| proof.objectProof.pageCount !== 1
		|| proof.objectProof.actionsAndAnnotationsAbsent !== true
		|| proof.objectProof.objects < 1
		|| proof.objectProof.objects > 12000
		|| proof.objectProof.fontResources < 1
		|| proof.objectProof.fontResources > 128
		|| !Number.isSafeInteger(proof.glyphs)
		|| proof.glyphs < 1
		|| proof.glyphs > 25000
	) {
		return reject();
	}
	if (
		!review
		|| !proof
		|| proof.schemaVersion !== 1
		|| proof.type !== "alabama-original-native-verification"
		|| proof.sourceSha256 !== value.document.sha256
		|| proof.reviewSha256 !== alabamaHash(JSON.stringify(review))
		|| !digest(proof.objectsSha256)
		|| proof.sourceFactsAccepted !== false
		|| review.type !== "alabama-native-ballot-draft"
		|| review.sourceSha256 !== value.document.sha256
		|| review.sourceUrl !== source.url
		|| review.county !== county
		|| review.electionDate !== source.electionDate
		|| review.nativeFieldsComplete !== true
		|| !Array.isArray(review.heldFields)
		|| review.heldFields.length
		|| review.applicationImportApproved !== false
		|| review.publicationApproved !== false
		|| review.recurringCollectionApproved !== false
		|| !Array.isArray(review.records)
		|| !review.records.length
		|| review.records.length > 200
		|| proof.fullyAccountedFields !== review.officeFields
	) {
		return reject();
	}
	const document = value.document;
	const records = review.records.map((claim) => {
		if (
			claim.stateCode !== "AL"
			|| claim.county !== county
			|| claim.electionDate !== source.electionDate
			|| claim.sourceUrl !== source.url
			|| claim.sourceSha256 !== document.sha256
			|| claim.recordRole !== "printed-sample-ballot-claim"
			|| claim.individualApplicabilityVerified !== false
			|| claim.pageNumber !== 1
			|| !Array.isArray(claim.sourceOperations)
			|| claim.sourceOperations.length !== 2
			|| claim.sourceOperations.some(operation => !Number.isSafeInteger(operation) || operation <= 0)
		) {
			return reject();
		}
		const context = officeContext(claim.sourceOfficeHeading, county);
		if (
			claim.office !== context.office
			|| claim.district !== context.district
			|| claim.scope !== context.scope
			|| claim.jurisdiction !== context.jurisdiction
			|| !/^[\p{Lu}\p{Lt}][\p{L}\p{M} .,'’"()\-]+$/u.test(claim.name)
			|| !["democrat", "republican", "independent", "libertarian"].includes(claim.party?.toLowerCase())
		) {
			return reject();
		}
		const expectedId = alabamaHash(
			JSON.stringify([
				"AL",
				source.electionDate,
				context.office.toLowerCase(),
				context.district,
				claim.name.toLowerCase(),
				claim.party.toLowerCase(),
				context.jurisdiction?.toLowerCase() ?? ""
			])
		).slice(0, 24);
		if (claim.id !== expectedId) return reject();
		const record = factory(source, {
			name: claim.name,
			office: claim.office,
			district: claim.district,
			scope: claim.scope,
			party: claim.party,
			jurisdiction: claim.jurisdiction,
			status: "listed"
		});
		if (!record) return reject();
		return { ...record, sourceStatus: undefined };
	});
	const identities = new Set(records.map(record => record.id));
	if (identities.size !== records.length || previous?.records.some(record => !identities.has(record.id)))
		throw new Error("An accepted Alabama candidate disappeared; retain the snapshot for review.");
	const documents = [
		{
			url: source.url,
			sha256: value.document.sha256,
			retrievedAt: value.document.retrievedAt,
			includedRecordCount: records.length
		}
	];
	return {
		records,
		documents,
		retrievedAt: value.document.retrievedAt,
		sha256: alabamaHash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))),
		collectionIndexSha256: alabamaDocumentDigest(election, county)
	};
}
export function validateAlabamaStoredSnapshot(source: StateBallotSource, value: Record<string, unknown>) {
	validateAlabamaSource(source);
	if (
		!digest(value.collectionIndexSha256)
		|| !Array.isArray(value.records)
		|| !value.records.length
		|| value.records.length > 200
		|| !Array.isArray(value.documents)
		|| value.documents.length !== 1
	) {
		return reject();
	}
	for (const record of value.records) {
		if (
			!record
			|| typeof record !== "object"
			|| Array.isArray(record)
			|| record.status !== "listed"
			|| record.sourceStatus !== undefined
			|| record.incumbent !== undefined
			|| Object.keys(record).some(
				key =>
					![
						"id",
						"name",
						"office",
						"district",
						"scope",
						"party",
						"status",
						"sourceStatus",
						"jurisdiction"
					].includes(key)
			)
			|| typeof record.name !== "string"
			|| typeof record.office !== "string"
			|| typeof record.district !== "string"
			|| typeof record.party !== "string"
			|| !["democrat", "republican", "independent", "libertarian"].includes(String(record.party).toLowerCase())
		) {
			return reject();
		}
		const key = [
			"AL",
			source.electionDate,
			record.office.toLowerCase(),
			record.district,
			record.name.toLowerCase(),
			record.party.toLowerCase()
		];
		if (record.scope === "local" || record.scope === "state-board-of-education") {
			if (typeof record.jurisdiction !== "string" || !record.jurisdiction) return reject();
			key.push(record.jurisdiction.toLowerCase());
		}
		else if (record.jurisdiction !== undefined) {
			return reject();
		}
		if (record.id !== alabamaHash(JSON.stringify(key)).slice(0, 24)) return reject();
		if (
			record.scope === "state-board-of-education"
			&& (record.office !== `Member, State Board of Education, District ${record.district}`
				|| !/^[1-8]$/u.test(record.district)
				|| record.jurisdiction !== `Alabama State Board of Education District ${record.district}`)
		) {
			return reject();
		}
	}
}
