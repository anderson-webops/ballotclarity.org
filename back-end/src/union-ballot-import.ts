import type { Buffer } from "node:buffer";
import type { StateBallotCycleCatalog } from "./state-ballot-cycles.js";
import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import process from "node:process";
import { withStateBallotAutomationLock } from "./state-ballot-automation-lock.js";
import { parseStateBallotCycleCatalog, readStateBallotCycleCatalog, writeStateBallotCycleCatalog } from "./state-ballot-cycles.js";
import { parseBundledStateSnapshot } from "./state-ballot-snapshot.js";
import { assertExternalStateDataDirectory, createStateBallotStorage, readBoundedStateDataBytes, serializeStoredStateSnapshot } from "./state-ballot-storage.js";
import { unionSampleSource, unionSampleSourceForElection } from "./state-ballot-union-source.js";
import { inspectUnionBallotAutomation, readUnionBallotAutomationPlan, runUnionBallotAutomation } from "./union-ballot-automation.js";
import { unionSampleLandingUrl } from "./union-county-ballots.js";
import { unionCandidateHash as hash } from "./union-county-candidates.js";

interface Policy { schemaVersion: 1; type: "union-ballot-import-policy"; profileSha256: string; baselineSnapshotSha256: string; dataDirectory: string; catalogPath: string; allowFutureElections: boolean }
interface Receipt { schemaVersion: 1; type: "union-ballot-import-receipt"; policySha256: string; sourceId: string; electionDate: string; snapshotSha256: string; importedAt: string; preparedRunId: string }
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);

async function privateFile(path: string, maximum = 32768) {
	const metadata = await lstat(path);
	if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.uid !== process.getuid?.() || (metadata.mode & 0o077) !== 0 || await realpath(path) !== path) throw new Error("Union import approval requires a physical owner-private file.");
	return readBoundedStateDataBytes(path, maximum);
}
async function store(directory: string, name: string, body: string, replace = false) {
	const temporary = join(directory, replace ? `.union-import-${randomUUID()}.tmp` : name);
	const handle = await open(temporary, "wx", 0o600);
	try {
		await handle.writeFile(body);
		await handle.sync();
	}
	finally { await handle.close(); }
	if (replace) {
		try {
			try {
				if (!(await lstat(join(directory, name))).isFile()) throw new Error("Union import metadata requires a regular file.");
			}
			catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
			await rename(temporary, join(directory, name));
		}
		finally {
			await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
				if (error.code !== "ENOENT") throw error;
			});
		}
	}
	const parent = await open(directory, "r");
	try {
		await parent.sync();
	}
	finally { await parent.close(); }
}
async function context(profilePath: string, policyPath: string) {
	const plan = await readUnionBallotAutomationPlan(profilePath);
	const body = await privateFile(policyPath);
	const value: unknown = JSON.parse(body.toString("utf8"));
	if (!exact(value, ["schemaVersion", "type", "profileSha256", "baselineSnapshotSha256", "dataDirectory", "catalogPath", "allowFutureElections"]) || value.schemaVersion !== 1 || value.type !== "union-ballot-import-policy" || !digest(value.profileSha256) || !digest(value.baselineSnapshotSha256) || typeof value.dataDirectory !== "string" || typeof value.catalogPath !== "string" || typeof value.allowFutureElections !== "boolean" || hash(await privateFile(profilePath)) !== value.profileSha256) throw new Error("Union import approval must match the reviewed collection profile and baseline.");
	assertExternalStateDataDirectory(value.dataDirectory);
	assertExternalStateDataDirectory(dirname(value.catalogPath));
	const separated = relative(plan.directory, value.dataDirectory);
	if (!separated.startsWith("../") || !relative(value.dataDirectory, plan.directory).startsWith("../")) throw new Error("Keep Union preparation and public snapshot storage separate.");
	if (dirname(value.catalogPath) !== value.dataDirectory || value.catalogPath.split("/").at(-1) !== "union-cycles.json") throw new Error("Keep the Union catalog in its reviewed snapshot directory.");
	return { plan, policy: value as unknown as Policy, policySha256: hash(body) };
}
async function receipt(directory: string, policySha256: string | null, now: number): Promise<Receipt | null> {
	let body: Buffer;
	try {
		body = await privateFile(join(directory, "accepted-import.json"));
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
	const value: unknown = JSON.parse(body.toString("utf8"));
	if (!exact(value, ["schemaVersion", "type", "policySha256", "sourceId", "electionDate", "snapshotSha256", "importedAt", "preparedRunId"]) || value.schemaVersion !== 1 || value.type !== "union-ballot-import-receipt" || (!digest(value.policySha256) || (policySha256 !== null && value.policySha256 !== policySha256)) || typeof value.electionDate !== "string" || value.sourceId !== `nj-union-${value.electionDate}` || !digest(value.snapshotSha256) || typeof value.importedAt !== "string" || !Number.isFinite(Date.parse(value.importedAt)) || new Date(value.importedAt).toISOString() !== value.importedAt || Date.parse(value.importedAt) > now || typeof value.preparedRunId !== "string" || !/^run-[a-f0-9-]{36}$/u.test(value.preparedRunId)) throw new Error("Union import enrollment requires review.");
	return value as unknown as Receipt;
}
async function adopt(profilePath: string, policyPath: string, enroll: boolean, now: () => number) {
	const approved = await context(profilePath, policyPath);
	return withStateBallotAutomationLock(approved.plan.directory, "automation.lock", async (directory) => {
		const previous = await receipt(directory, enroll ? null : approved.policySha256, now());
		if (!enroll && !previous) throw new Error("Enroll a reviewed Union baseline before recurring import.");
		const state = (await inspectUnionBallotAutomation(profilePath, now())).state;
		const prepared = state?.latestPrepared;
		if (!state || !prepared || !["prepared-review-required", "unchanged"].includes(state.status)) throw new Error("Union import requires a complete successful preparation.");
		const selected = prepared.files.find(file => file.path.endsWith(`/nj-union-${prepared.electionDate}.json`))!;
		if ((!previous || enroll) && selected.sha256 !== approved.policy.baselineSnapshotSha256) throw new Error("Union enrollment requires the exact reviewed baseline snapshot.");
		if (previous && (prepared.electionDate < previous.electionDate || (!enroll && !approved.policy.allowFutureElections && prepared.electionDate !== previous.electionDate))) throw new Error("The offered Union election falls outside this import approval.");
		const root = join(directory, "runs", prepared.runId);
		const body = (await readBoundedStateDataBytes(join(root, selected.path))).toString("utf8");
		const sourceFile = prepared.files.find(file => file.path.endsWith("/source.json"))!;
		const source = JSON.parse((await readBoundedStateDataBytes(join(root, sourceFile.path))).toString("utf8"));
		const expected = unionSampleSourceForElection(prepared.electionDate, source.documentUrls);
		if (JSON.stringify(source) !== JSON.stringify(expected) || (source.id === unionSampleSource().id && JSON.stringify(source) !== JSON.stringify(unionSampleSource()))) throw new Error("Union import source scope differs from its reviewed catalog.");
		const snapshot = parseBundledStateSnapshot(expected, body);
		if (hash(body) !== selected.sha256 || snapshot.retrievedAt !== prepared.capturedAt || snapshot.records.length !== prepared.candidates || snapshot.source.ballotPreview !== false) throw new Error("Union import output or original clock changed.");
		return withStateBallotAutomationLock(approved.policy.dataDirectory, "automation.lock", async (dataDirectory) => {
			if (dataDirectory !== approved.policy.dataDirectory) throw new Error("Union import requires physical snapshot storage.");
			const metadata = await lstat(dataDirectory);
			if (metadata.uid !== process.getuid?.() || (metadata.mode & 0o022) !== 0) throw new Error("Union import requires owner-controlled snapshot storage.");
			const storage = createStateBallotStorage(dataDirectory);
			const stored = await storage.read(source);
			if (previous?.sourceId === source.id && !stored) throw new Error("Restore the accepted Union snapshot before refreshing it.");
			if (stored) {
				if (stored.retrievedAt > snapshot.retrievedAt) throw new Error("An older Union capture cannot replace accepted data.");
				const after = new Map(snapshot.records.map(record => [record.id, JSON.stringify(record)]));
				if (!enroll && stored.records.some(record => after.get(record.id) !== JSON.stringify(record))) throw new Error("An accepted Union candidate disappeared or changed; retain the snapshot for review.");
			}
			const priorCatalog = readStateBallotCycleCatalog(approved.policy.catalogPath, now());
			if (priorCatalog && priorCatalog.familyId !== unionSampleSource().id) throw new Error("The reviewed catalog belongs to another election family.");
			if (priorCatalog?.elections.some(election => election.electionDate > source.electionDate)) throw new Error("Retain the newer accepted Union election catalog.");
			const election = { electionId: null, electionDate: source.electionDate, unionDocuments: [...source.documentUrls] };
			const catalog: StateBallotCycleCatalog = { schemaVersion: 1, type: "state-ballot-cycle-catalog", familyId: unionSampleSource().id, sourceConfigurationSha256: hash(JSON.stringify(unionSampleSource())), discovery: { url: unionSampleLandingUrl, sha256: prepared.identitySha256, retrievedAt: prepared.capturedAt }, elections: [...(priorCatalog?.elections.filter(item => item.electionDate !== source.electionDate) ?? []), election].sort((first, second) => first.electionDate.localeCompare(second.electionDate)) };
			const history = join(directory, "imports");
			parseStateBallotCycleCatalog(catalog, now());
			await mkdir(history, { recursive: true, mode: 0o700 });
			if (await realpath(history) !== history || ((await lstat(history)).mode & 0o077) !== 0) throw new Error("Union import history requires physical private storage.");
			const preserve = async (value: StateBallotSnapshot) => {
				const preserved = `${JSON.stringify({ source: value.source, snapshot: serializeStoredStateSnapshot(value) })}\n`;
				const name = `${hash(preserved)}.json`;
				try {
					await store(history, name, preserved);
				}
				catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || (await privateFile(join(history, name), 12 * 1024 * 1024)).toString("utf8") !== preserved) throw error; }
			};
			if (stored) await preserve(stored);
			await preserve(snapshot);
			if (previous) {
				const priorReceipt = `${JSON.stringify(previous)}\n`;
				const name = `receipt-${hash(priorReceipt)}.json`;
				try {
					await store(history, name, priorReceipt);
				}
				catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || (await privateFile(join(history, name))).toString("utf8") !== priorReceipt) throw error; }
			}
			const unchanged = stored && serializeStoredStateSnapshot(stored) === serializeStoredStateSnapshot(snapshot);
			if (!unchanged) await storage.write(snapshot);
			await writeStateBallotCycleCatalog(approved.policy.catalogPath, catalog, now());
			const accepted: Receipt = { schemaVersion: 1, type: "union-ballot-import-receipt", policySha256: approved.policySha256, sourceId: source.id, electionDate: source.electionDate, snapshotSha256: selected.sha256, importedAt: previous?.snapshotSha256 === selected.sha256 ? previous.importedAt : new Date(now()).toISOString(), preparedRunId: prepared.runId };
			if (JSON.stringify(previous) !== JSON.stringify(accepted)) await store(directory, "accepted-import.json", `${JSON.stringify(accepted)}\n`, true);
			return { ...accepted, imported: !unchanged, records: snapshot.records.length, retrievedAt: snapshot.retrievedAt, retainedQuestionsForReview: prepared.questions, publicationApproved: false, personalBallotApproved: false, recurringImportEnrolled: true };
		});
	});
}
export async function enrollUnionBallotImport(profilePath: string, policyPath: string, now: () => number = Date.now) {
	return adopt(profilePath, policyPath, true, now);
}
export async function syncUnionBallotImport(profilePath: string, policyPath: string, options: Parameters<typeof runUnionBallotAutomation>[1] = {}) {
	const approved = await context(profilePath, policyPath);
	if (!await receipt(approved.plan.directory, approved.policySha256, (options.now ?? Date.now)())) throw new Error("Enroll a reviewed Union baseline before recurring import.");
	await runUnionBallotAutomation(profilePath, options);
	return adopt(profilePath, policyPath, false, options.now ?? Date.now);
}
