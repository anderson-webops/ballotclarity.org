import type { FairbanksPublicationCapture } from "./fairbanks-election-publications.js";
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, mkdtemp, open, readFile, realpath, rm, unlink } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { fairbanksCandidateRenderPages, readFairbanksBallotCandidates } from "./fairbanks-ballot-candidates.js";
import { readFairbanksPublicationCapture } from "./fairbanks-election-publications.js";
import { inspectFairbanksPdfGeometry } from "./fairbanks-pdf-geometry.js";
import { extractStateBallotPdfSvg, extractStateBallotPdfText, inspectStateBallotPdfObjects, resolveStateBallotPdfExtractor, resolveStateBallotPdfObjectInspector } from "./state-ballot-pdf.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";

const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));
}
async function execute(executable: string, arguments_: string[], deadline: number) {
	const remaining = Math.min(30000, deadline - Date.now());
	if (remaining < 1) throw new Error("Fairbanks native preparation exceeded its duration bound.");
	return new Promise<string>((resolve, reject) => {
		const child = spawn(executable, arguments_, { stdio: ["ignore", "pipe", "pipe"], env: { PATH: process.env.PATH, LANG: "C.UTF-8", OMP_THREAD_LIMIT: "1", OMP_NUM_THREADS: "1" } });
		const chunks: Buffer[] = [];
		let length = 0;
		let errors = 0;
		let failed = false;
		const stop = () => {
			failed = true;
			child.kill("SIGKILL");
		};
		const timer = setTimeout(stop, remaining);
		child.stdout.on("data", (chunk: Buffer) => {
			length += chunk.length;
			if (length > 4 * 1024 * 1024) stop();
			else chunks.push(chunk);
		});
		child.stderr.on("data", (chunk: Buffer) => {
			errors += chunk.length;
			if (errors > 65536) stop();
		});
		child.once("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});
		child.once("close", (code, signal) => {
			clearTimeout(timer);
			if (failed || signal || code !== 0) reject(new Error("Fairbanks native preparation failed within its bounded tool role."));
			else resolve(Buffer.concat(chunks).toString("utf8"));
		});
	});
}
export async function storeFairbanksCandidateEvidence(directory: string, body: Buffer, electionDate: string) {
	assertExternalStateDataDirectory(directory);
	if (await realpath(directory) !== directory || !/^20\d{2}-\d{2}-\d{2}$/u.test(electionDate) || !Number.isFinite(Date.parse(`${electionDate}T00:00:00Z`)) || new Date(`${electionDate}T00:00:00Z`).toISOString().slice(0, 10) !== electionDate || body.length > 12 * 1024 * 1024) throw new Error("The Fairbanks evidence storage contract requires review.");
	const digest = hash(body);
	const path = join(directory, `fairbanks-candidates-${electionDate}-${digest}.json`);
	const temporary = join(directory, `.${randomUUID()}.tmp`);
	const handle = await open(temporary, "wx", 0o600);
	try {
		await handle.writeFile(body);
		await handle.sync();
		await handle.close();
		try {
			await link(temporary, path);
		}
		catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readBoundedStateDataBytes(path)).equals(body)) throw error;
		}
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
		await unlink(temporary);
	}
	return { path, sha256: digest, bytes: body.length };
}

export async function prepareFairbanksCandidateFiles(planPath: string) {
	const plan = JSON.parse((await readBoundedStateDataBytes(planPath, 128 * 1024)).toString("utf8"));
	if (!exact(plan, ["schemaVersion", "type", "publicationBundle", "outputDirectory"]) || plan.schemaVersion !== 1 || plan.type !== "fairbanks-native-candidate-preparation" || typeof plan.outputDirectory !== "string" || !exact(plan.publicationBundle, ["path", "sha256"]) || typeof plan.publicationBundle.path !== "string" || typeof plan.publicationBundle.sha256 !== "string" || !/^[a-f\d]{64}$/u.test(plan.publicationBundle.sha256)) throw new Error("Provide a pinned Fairbanks native preparation plan.");
	const original = await readBoundedStateDataBytes(plan.publicationBundle.path, 12 * 1024 * 1024);
	if (hash(original) !== plan.publicationBundle.sha256) throw new Error("The pinned Fairbanks publication bundle changed.");
	const bundle = JSON.parse(original.toString("utf8"));
	const inventory = readFairbanksPublicationCapture(bundle.capture);
	if (!isDeepStrictEqual(inventory, bundle.inventory)) throw new Error("The Fairbanks publication inventory changed.");
	const evidence = await prepareFairbanksCandidateEvidence(bundle.capture, plan.outputDirectory);
	const body = Buffer.from(`${JSON.stringify({ schemaVersion: 2, type: "fairbanks-native-preparation-bundle", publicationBundleSha256: plan.publicationBundle.sha256, ...evidence }, null, 2)}\n`);
	if (body.length > 8 * 1024 * 1024) throw new Error("The Fairbanks native evidence exceeds its output bound.");
	const stored = await storeFairbanksCandidateEvidence(plan.outputDirectory, body, evidence.prepared.electionDate);
	return { ...stored, records: evidence.prepared.records.length, renderedPages: evidence.prepared.proof.length, imported: false, published: false };
}

export async function prepareFairbanksCandidateEvidence(capture: FairbanksPublicationCapture, outputDirectory: string, now = Date.now()) {
	readFairbanksPublicationCapture(capture, now);
	assertExternalStateDataDirectory(outputDirectory);
	await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
	const directory = await realpath(outputDirectory);
	if (directory !== outputDirectory) throw new Error("Fairbanks native output requires an unlinked physical directory.");
	const text = await resolveStateBallotPdfExtractor();
	const renderer = await resolveStateBallotPdfExtractor(process.env.STATE_BALLOT_PDFTOPPM);
	const reader = await resolveStateBallotPdfExtractor(process.env.STATE_BALLOT_TESSERACT);
	const inspector = await resolveStateBallotPdfObjectInspector();
	const vector = await resolveStateBallotPdfExtractor(process.env.STATE_BALLOT_PDFTOCAIRO);
	const deadline = Date.now() + 180000;
	const version = await execute(reader, ["--version"], deadline);
	if (!/^tesseract 5\.\d+\.\d+\b/u.test(version)) throw new Error("Fairbanks native preparation requires maintained Tesseract 5.");
	const temporary = await mkdtemp(join(directory, ".fairbanks-native-"));
	try {
		const documents = [];
		for (const source of capture.documents) {
			const bytes = Buffer.from(source.body, "base64");
			if (deadline - Date.now() < 12000) throw new Error("Fairbanks native preparation exceeded its duration bound.");
			const geometry = inspectFairbanksPdfGeometry(await inspectStateBallotPdfObjects(bytes, inspector, "metadata"), source.kind);
			if (geometry.pages.length !== source.text.split("\f").filter((page: string) => page.trim()).length) throw new Error("The Fairbanks inspected page inventory changed.");
			const remaining = Math.min(12000, deadline - Date.now());
			if (remaining < 1) throw new Error("Fairbanks native preparation exceeded its duration bound.");
			const bbox = await extractStateBallotPdfText(bytes, text, remaining, "bbox-layout", source.kind === "sample" ? 4 : 20);
			const required = fairbanksCandidateRenderPages(bbox, source.kind);
			const path = join(temporary, `${source.kind}.pdf`);
			const file = await open(path, "wx", 0o600);
			try {
				await file.writeFile(bytes);
			}
			finally {
				await file.close();
			}
			const pages = [];
			for (const page of required) {
				if (deadline - Date.now() < 12000) throw new Error("Fairbanks native preparation exceeded its duration bound.");
				const svg = await extractStateBallotPdfSvg(bytes, vector, page.page);
				const prefix = join(temporary, `${source.kind}-${page.page}`);
				await execute(renderer, ["-r", "300", "-f", String(page.page), "-l", String(page.page), "-singlefile", "-png", path, prefix], deadline);
				const png = await readBoundedStateDataBytes(`${prefix}.png`, 12 * 1024 * 1024);
				if (png.length < 33 || !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || Math.abs(png.readUInt32BE(16) - page.width * 300 / 72) > 1 || Math.abs(png.readUInt32BE(20) - page.height * 300 / 72) > 1) throw new Error("The Fairbanks rendered page dimensions changed.");
				const ocr = await execute(reader, [`${prefix}.png`, "stdout", "-l", "eng", "--psm", "11", "tsv"], deadline);
				pages.push({ ...page, dpi: 300 as const, pngSha256: hash(png), ocr, svg });
			}
			documents.push({ kind: source.kind, sourceSha256: source.sha256, geometry, bbox, pages });
		}
		const prepared = readFairbanksBallotCandidates(capture, documents, now);
		return { tools: { textSha256: hash(await readFile(text)), rendererSha256: hash(await readFile(renderer)), vectorSha256: hash(await readFile(vector)), inspectorSha256: hash(await readFile(inspector)), readerSha256: hash(await readFile(reader)), readerVersion: version.split("\n")[0] }, prepared, documents };
	}
	finally {
		await rm(temporary, { recursive: true, force: true });
	}
}
