import type { UnionBallotCapture, UnionBallotCollectionOptions } from "./union-county-ballots.js";
import { randomUUID } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { acquireStateBallotAutomationLock } from "./state-ballot-automation-lock.js";
import { readBoundedStateDataBytes } from "./state-ballot-storage.js";
import { collectUnionSampleBatch, collectUnionSampleWindow } from "./union-county-ballots.js";
import { unionCandidateHash } from "./union-county-candidates.js";

async function persist(directory: string, name: string, body: string | Uint8Array) {
	const handle = await open(join(directory, name), "wx", 0o600);
	try {
		await handle.writeFile(body);
		await handle.sync();
	}
	finally { await handle.close(); }
}
export async function collectUnionBallotEvidence(path: string, options: { collect?: typeof collectUnionSampleBatch; collectWindow?: typeof collectUnionSampleWindow; collection?: Omit<UnionBallotCollectionOptions, "onCapture"> } = {}) {
	const plan = JSON.parse((await readBoundedStateDataBytes(path, 32768)).toString("utf8"));
	const window = plan?.type === "union-sample-ballot-window";
	if (!plan || typeof plan !== "object" || Array.isArray(plan) || Object.keys(plan).sort().join(",") !== (window ? "accessReview,catalogSha256,outputRoot,schemaVersion,type,windowOffset" : "accessReview,catalogSha256,forms,outputRoot,schemaVersion,type") || plan.schemaVersion !== 1 || (!window && plan.type !== "union-sample-ballot-collection") || typeof plan.outputRoot !== "string") throw new Error("Provide an exact Union sample-ballot collection plan.");
	const lock = await acquireStateBallotAutomationLock(plan.outputRoot);
	try {
		const outputDirectory = join(lock.directory, `intake-${Date.now()}-${randomUUID()}`);
		await mkdir(outputDirectory, { mode: 0o700 });
		const inputs: (Omit<UnionBallotCapture, "body"> & { path: string; bytes: number })[] = [];
		const stored = new Set<string>();
		async function onCapture(capture: UnionBallotCapture) {
			if (unionCandidateHash(capture.body) !== capture.sha256 || inputs.some(input => input.role === capture.role || input.url === capture.url)) throw new Error("Union sample-ballot capture identity changed.");
			const name = `${capture.sha256}.${capture.body.subarray(0, 5).toString() === "%PDF-" ? "pdf" : "txt"}`;
			if (!stored.has(name)) {
				await persist(outputDirectory, name, capture.body);
				stored.add(name);
			}
			const { body, ...metadata } = capture;
			const input = { ...metadata, path: name, bytes: body.length };
			await persist(outputDirectory, `${capture.role}.metadata.json`, `${JSON.stringify(input, null, 2)}\n`);
			inputs.push(input);
		}
		const collected = window ? await (options.collectWindow ?? collectUnionSampleWindow)(plan.windowOffset, plan.accessReview, plan.catalogSha256, { ...options.collection, onCapture }) : await (options.collect ?? collectUnionSampleBatch)(plan.forms, plan.accessReview, plan.catalogSha256, { ...options.collection, onCapture });
		if (inputs.length !== collected.captures.length || inputs.length !== collected.selected.length + 7) throw new Error("Union sample-ballot capture inventory is incomplete.");
		const body = `${JSON.stringify({ schemaVersion: 1, type: "union-sample-ballot-capture", catalog: collected.catalog, selected: collected.selected, accessReview: plan.accessReview, inputs, imported: false, publicationApproved: false, personalApplicabilityVerified: false }, null, 2)}\n`;
		await persist(outputDirectory, "capture.json", body);
		const handle = await open(outputDirectory, "r");
		try {
			await handle.sync();
		}
		finally { await handle.close(); }
		return { outputDirectory, catalogSha256: collected.catalog.sha256, forms: collected.selected.map(document => document.form), completeCatalogDocuments: collected.catalog.documents.length, captureSha256: unionCandidateHash(body), imported: false, publicationApproved: false };
	}
	finally { await lock.release(); }
}

if (process.argv[1]?.endsWith("collect-union-ballot-evidence.ts") || process.argv[1]?.endsWith("collect-union-ballot-evidence.js")) {
	const [path, ...extra] = process.argv.slice(2);
	if (!path || extra.length) {
		console.error("Use collect-union-ballot-evidence PLAN.json.");
		process.exitCode = 1;
	}
	else {
		collectUnionBallotEvidence(path).then(result => console.log(JSON.stringify(result))).catch((error: unknown) => {
			console.error(error instanceof Error ? error.message : "Union sample-ballot collection failed.");
			process.exitCode = 1;
		});
	}
}
