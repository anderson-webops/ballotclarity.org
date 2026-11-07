import type { JohnsonBallotEvidence, JohnsonBallotResource } from "./johnson-ballot-publications.js";
import type { JohnsonSampleText } from "./johnson-ballot-questions.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { setTimeout } from "node:timers/promises";
import { electionDocumentPolicyFingerprint, electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { johnsonAppConfigUrl, johnsonBallotHash, johnsonPollingLayer, johnsonPrecinctTable, johnsonQueryUrl, johnsonSampleInventory, offeredJohnsonMap, readJohnsonBallotEvidence, validateJohnsonTable } from "./johnson-ballot-publications.js";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { parseIowaJohnsonCandidateCapture, readIowaJohnsonCandidatePage, readIowaJohnsonDiscovery, validateIowaJohnsonSource } from "./state-ballot-iowa-johnson.js";
import { extractStateBallotPdfText, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";

export interface JohnsonCollectionOptions {
	scratchDirectory?: string;
	requestDocument?: typeof fetchRemoteSourceDocument;
	wait?: (milliseconds: number) => Promise<void>;
	now?: () => number;
	extract?: (bytes: Buffer, format: "raw" | "layout") => Promise<string>;
}
async function atomicWrite(directory: string, name: string, body: Buffer) {
	const temporary = join(directory, `.${randomUUID()}.tmp`);
	try {
		const handle = await open(temporary, "wx", 0o600);
		try {
			await handle.writeFile(body);
			await handle.sync();
		}
		finally {
			await handle.close();
		}
		await rename(temporary, join(directory, name));
		const parent = await open(directory, "r");
		try {
			await parent.sync();
		}
		finally {
			await parent.close();
		}
	}
	finally {
		await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== "ENOENT") throw error;
		});
	}
}
export async function fetchJohnsonNativeCapture(source: StateBallotSource, discovery: string, options: JohnsonCollectionOptions) {
	validateIowaJohnsonSource(source);
	const directory = options.scratchDirectory ?? process.env.STATE_BALLOT_JOHNSON_EVIDENCE_DIR;
	if (!directory) throw new Error("Configure an external Johnson County collection evidence directory.");
	const { assertExternalStateDataDirectory } = await import("./state-ballot-storage.js");
	assertExternalStateDataDirectory(directory);
	await mkdir(directory, { recursive: true, mode: 0o700 });
	if (await realpath(directory) !== directory) throw new Error("Use the physical Johnson County evidence directory.");
	const lockPath = join(directory, `${source.id}.lock`);
	const lock = await open(lockPath, "wx", 0o600);
	try {
		await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
		await lock.sync();
		return await collect(source, discovery, directory, options);
	}
	finally {
		await lock.close();
		await unlink(lockPath);
	}
}
async function collect(source: StateBallotSource, discovery: string, directory: string, options: JohnsonCollectionOptions) {
	const { readBoundedStateDataBytes } = await import("./state-ballot-storage.js");
	const { createStateCandidateRecord } = await import("./state-ballot-records.js");
	const now = options.now ?? Date.now;
	const page = readIowaJohnsonDiscovery(discovery, now()).pages.find(item => item.url === source.pageUrl);
	if (!page) throw new Error("The Johnson County discovery does not offer the selected election.");
	const parsedPage = readIowaJohnsonCandidatePage(source, page.body, createStateCandidateRecord);
	const pointer = join(directory, `${source.id}-last-capture.json`);
	let previous: ReturnType<typeof parseIowaJohnsonCandidateCapture> | undefined;
	let previousEvidence: JohnsonBallotEvidence | undefined;
	let previousBody: string | undefined;
	try {
		const stored = (await readBoundedStateDataBytes(pointer)).toString("utf8");
		previousBody = stored;
		previous = parseIowaJohnsonCandidateCapture(source, stored, createStateCandidateRecord, now());
		const envelope = JSON.parse(stored);
		if (envelope.schemaVersion === 2) previousEvidence = envelope.ballots;
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	const appUrl = offeredJohnsonMap(page.body);
	if (!appUrl) {
		if (previousEvidence) throw new Error("The accepted Johnson County sample map disappeared; retain the accepted capture.");
		return discovery;
	}
	const request = options.requestDocument ?? fetchRemoteSourceDocument;
	const wait = options.wait ?? setTimeout;
	let delay = 11000;
	const resources: JohnsonBallotResource[] = [];
	const resource = async (url: string) => {
		await wait(delay);
		const response = await request(url, { allowedHosts: [new URL(url).hostname], maxBytes: 2 * 1024 * 1024, timeoutMs: 25000 });
		if (response.status !== 200 && !(url === "https://gis.johnsoncountyiowa.gov/robots.txt" && response.status === 404 && response.body.length === 0)) throw new Error("The Johnson County resource request failed; retain accepted evidence.");
		const body = response.body.toString("utf8");
		if (body.includes("\uFFFD") || Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("The Johnson County resource encoding or bounds require review.");
		const sha256 = johnsonBallotHash(body);
		const old = previousEvidence?.resources.find(item => item.url === url && item.sha256 === sha256 && item.body === body);
		const item = { url, status: response.status, body, sha256, retrievedAt: old?.retrievedAt ?? new Date(now()).toISOString() };
		resources.push(item);
		return item;
	};
	const policy = await resource("https://johnsoncountyiowa.gov/robots.txt");
	if (electionDocumentPolicyFingerprint(Buffer.from(policy.body), "robots", policy.url) !== "fbb9e50dc760db7ccf06a498c56f78f170ae0e5cf51d576c0dd2b54831714ede") throw new Error("The Johnson County collection policy requires review.");
	const robots = electionDocumentRobotsPolicy(Buffer.from(policy.body));
	delay = Math.max(delay, robots.delay);
	const gisPolicy = await resource("https://gis.johnsoncountyiowa.gov/robots.txt");
	if (gisPolicy.status !== 404 || gisPolicy.body !== "") throw new Error("The Johnson GIS access policy requires review.");
	const app = await resource(appUrl);
	const config = await resource(johnsonAppConfigUrl(app.body));
	const layer = johnsonPollingLayer(config.body);
	const layerMetadata = await resource(`${layer}?f=pjson`);
	const table = johnsonPrecinctTable(layerMetadata.body, layer);
	const tableMetadata = await resource(`${table}?f=pjson`);
	validateJohnsonTable(tableMetadata.body);
	const ids = await resource(johnsonQueryUrl(table, true));
	const records = await resource(johnsonQueryUrl(table, false));
	const inventory = johnsonSampleInventory(source, ids.body, records.body);
	if (previousEvidence?.documents.some(document => !inventory.urls.includes(document.url))) throw new Error("An accepted Johnson County sample ballot disappeared; retain the accepted capture.");
	if (!inventory.urls.length) {
		if (previousEvidence) throw new Error("The accepted Johnson County samples disappeared; retain the accepted capture.");
		return discovery;
	}
	const executable = options.extract ? undefined : await resolveStateBallotPdfExtractor();
	const extract = options.extract ?? ((bytes: Buffer, format: "raw" | "layout") => extractStateBallotPdfText(bytes, executable!, 12000, format, 12));
	const documents: JohnsonSampleText[] = [];
	let totalBytes = 0;
	for (const url of inventory.urls) {
		if (!robots.allowed(url)) throw new Error("The county robots policy excludes this sample ballot.");
		await wait(delay);
		const response = await request(url, { allowedHosts: ["johnsoncountyiowa.gov"], maxBytes: 12 * 1024 * 1024, timeoutMs: 25000 });
		totalBytes += response.body.length;
		if (response.status !== 200 || response.contentType !== "application/pdf" || response.body.subarray(0, 5).toString() !== "%PDF-" || response.body.length > 12 * 1024 * 1024 || totalBytes > 128 * 1024 * 1024) throw new Error("The Johnson County PDF inventory exceeds its reviewed transport bounds.");
		const sha256 = johnsonBallotHash(response.body);
		const filename = `original-${sha256}.pdf`;
		let stored: Buffer | undefined;
		try {
			stored = await readBoundedStateDataBytes(join(directory, filename));
		}
		catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
		if (stored && (!stored.equals(response.body) || johnsonBallotHash(stored) !== sha256)) throw new Error("The retained Johnson County PDF is inconsistent.");
		if (!stored) await atomicWrite(directory, filename, response.body);
		const old = previousEvidence?.documents.find(document => document.url === url && document.sha256 === sha256);
		const document = old ?? { url, sha256, retrievedAt: new Date(now()).toISOString(), raw: await extract(response.body, "raw"), layout: await extract(response.body, "layout") };
		documents.push(document);
	}
	const ballots = readJohnsonBallotEvidence(source, { schemaVersion: 1, resources, documents }, page.body, now());
	const body = JSON.stringify({ schemaVersion: 2, type: "iowa-johnson-candidate-capture", discovery: JSON.parse(discovery), ballots });
	if (Buffer.byteLength(body) > 12 * 1024 * 1024) throw new Error("The Johnson County complete capture exceeds its size bound.");
	const accepted = parseIowaJohnsonCandidateCapture(source, body, createStateCandidateRecord, now(), previous);
	if (previous && previous.records.some(record => !accepted.records.some(item => item.id === record.id))) throw new Error("An accepted Johnson County candidate disappeared; retain the prior capture.");
	if (parsedPage.records.length !== accepted.records.length) throw new Error("The Johnson County candidate inventory changed during collection.");
	if (previousBody && previous?.sha256 === accepted.sha256) return previousBody;
	await atomicWrite(directory, `${johnsonBallotHash(body)}.capture.json`, Buffer.from(body));
	await atomicWrite(directory, `${source.id}-last-capture.json`, Buffer.from(body));
	return body;
}
