import type { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, realpath } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import { electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { discoverFultonEducationNotices, fultonEducationNoticeIndexUrl, readFultonEducationNotice } from "./fulton-education-notice.js";
import { verifyFultonCalendarPolicy } from "./fulton-election-calendar.js";
import { fultonPolicyReceipts } from "./fulton-source-policy.js";
import { acquireStateBallotAutomationLock } from "./state-ballot-automation-lock.js";
import { extractStateBallotPdfText, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";

const hash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));

export async function readFultonEducationNoticeCapture(capturePath: string, captureSha256: string, electionDate: string, options: { extract?: (body: Buffer) => Promise<string>; now?: () => number } = {}) {
	if (!/^[a-f\d]{64}$/u.test(captureSha256) || (electionDate !== "latest-published" && !/^20\d{2}-\d{2}-\d{2}$/u.test(electionDate))) throw new Error("Provide a pinned Fulton education-notice capture.");
	const now = (options.now ?? Date.now)();
	if (!Number.isFinite(now)) throw new Error("The education-notice verification clock is invalid.");
	const directory = await realpath(dirname(capturePath));
	assertExternalStateDataDirectory(directory);
	const original = await readBoundedStateDataBytes(capturePath, 4 * 1024 * 1024);
	if (hash(original) !== captureSha256) throw new Error("The education-notice capture manifest hash changed.");
	const capture = JSON.parse(original.toString("utf8"));
	if (!exact(capture, ["schemaVersion", "type", "sourceIndexUrl", "documents", "publisherRequests", "reviewedPolicyDigestsMatched", "publicationApproved", "importApproved"]) || capture.schemaVersion !== 1 || capture.type !== "fulton-education-notice-original-capture" || capture.sourceIndexUrl !== fultonEducationNoticeIndexUrl || capture.reviewedPolicyDigestsMatched !== true || capture.publicationApproved !== false || capture.importApproved !== false || capture.publisherRequests !== 4 || !Array.isArray(capture.documents) || capture.documents.length !== 4) throw new Error("The education-notice capture inventory requires review.");
	const inputs: { record: Record<string, unknown>; body: Buffer }[] = [];
	let totalBytes = 0;
	for (const record of capture.documents) {
		if (!exact(record, ["url", "sha256", "bytes", "capturedAt", "status", "contentType", "path"]) || typeof record.url !== "string" || typeof record.sha256 !== "string" || !/^[a-f\d]{64}$/u.test(record.sha256) || ![`${record.sha256}.pdf`, `${record.sha256}.html`].includes(String(record.path)) || !Number.isSafeInteger(record.bytes) || Number(record.bytes) < 1 || Number(record.bytes) > 12 * 1024 * 1024 || record.status !== 200 || typeof record.capturedAt !== "string" || !Number.isFinite(Date.parse(record.capturedAt)) || new Date(record.capturedAt).toISOString() !== record.capturedAt || Date.parse(record.capturedAt) > now) throw new Error("The education-notice captured input requires review.");
		totalBytes += Number(record.bytes);
		if (totalBytes > 24 * 1024 * 1024 || inputs.some(input => input.record.url === record.url)) throw new Error("The education-notice capture exceeds its bounded inventory.");
		const body = await readBoundedStateDataBytes(join(directory, String(record.path)));
		if (body.length !== record.bytes || hash(body) !== record.sha256) throw new Error("The education-notice captured document bytes changed.");
		inputs.push({ record, body });
	}
	if (inputs[0]!.record.url !== fultonPolicyReceipts[0]!.url || inputs[1]!.record.url !== fultonPolicyReceipts[1]!.url || inputs[2]!.record.url !== fultonEducationNoticeIndexUrl) throw new Error("The education-notice policy/index order changed.");
	for (const [index, input] of inputs.slice(0, 2).entries()) verifyFultonCalendarPolicy(input.body.toString("utf8"), index);
	const robots = electionDocumentRobotsPolicy(inputs[0]!.body);
	if (inputs.some(input => !robots.allowed(String(input.record.url))) || robots.delay > 11000) throw new Error("The education-notice publisher permissions require review.");
	const offered = discoverFultonEducationNotices(inputs[2]!.body.toString("utf8"));
	const selected = electionDate === "latest-published" ? offered.at(-1) : offered.find(notice => notice.electionDate === electionDate);
	const document = inputs[3]!;
	if (!selected || selected.url !== document.record.url || document.record.contentType !== "application/pdf" || document.body.subarray(0, 5).toString() !== "%PDF-" || document.record.path !== `${document.record.sha256}.pdf`) throw new Error("The education-notice selected publication changed.");
	const extract = options.extract ?? (async body => extractStateBallotPdfText(body, await resolveStateBallotPdfExtractor(), undefined, "layout", 20));
	const facts = readFultonEducationNotice(await extract(document.body), selected.electionDate);
	const source = { url: selected.url, sha256: document.record.sha256, capturedAt: document.record.capturedAt, sourceCaptureSha256: captureSha256, indexSha256: inputs[2]!.record.sha256 };
	const quote = (value: string | number) => `"${String(value).replaceAll("\"", "\"\"")}"`;
	const columns = ["kind", "system", "subject", "condition", "value", "year", "pages", "sourceUrl", "sourceSha256", "capturedAt"];
	const rows = [
		...facts.projects.map(project => [project.category, project.system, project.subject, project.condition, "", "", project.pages.join(";"), `${source.url}#page=${project.pages[0]}`, String(source.sha256), String(source.capturedAt)]),
		...facts.schedule.map(row => ["annual-principal-limit", "Atlanta Independent School System", "Maximum annual principal", "authorized maximum", row.printedAmount, row.year, row.page, `${source.url}#page=${row.page}`, String(source.sha256), String(source.capturedAt)]),
	];
	const csv = `${columns.join(",")}\n${rows.map(row => row.map(quote).join(",")).join("\n")}\n`;
	const report = { ...facts, source, officialSource: true, csvSha256: hash(csv), publisherRequestsDuringPreparation: 0 };
	const body = `${JSON.stringify(report, null, 2)}\n`;
	return { report, csv, body, documents: inputs.map(input => input.record) };
}

export async function prepareFultonEducationNoticeFiles(path: string, options: { extract?: (body: Buffer) => Promise<string> } = {}) {
	const plan = JSON.parse((await readBoundedStateDataBytes(path, 32768)).toString("utf8"));
	if (!exact(plan, ["schemaVersion", "type", "capturePath", "captureSha256", "outputRoot", "electionDate"]) || plan.schemaVersion !== 1 || plan.type !== "fulton-education-notice-preparation" || typeof plan.capturePath !== "string" || typeof plan.captureSha256 !== "string" || !/^[a-f\d]{64}$/u.test(plan.captureSha256) || typeof plan.outputRoot !== "string" || typeof plan.electionDate !== "string" || (plan.electionDate !== "latest-published" && !/^20\d{2}-\d{2}-\d{2}$/u.test(plan.electionDate))) throw new Error("Provide a pinned Fulton education-notice preparation plan.");
	const { report, csv, body } = await readFultonEducationNoticeCapture(plan.capturePath, plan.captureSha256, plan.electionDate, options);
	const lock = await acquireStateBallotAutomationLock(plan.outputRoot);
	try {
		const outputDirectory = join(lock.directory, `prepared-${plan.captureSha256.slice(0, 16)}-${randomUUID()}`);
		await mkdir(outputDirectory, { mode: 0o700 });
		for (const [name, content] of [["notice-research.csv", csv], ["notice-research.json", body]]) {
			const file = await open(join(outputDirectory, name!), "wx", 0o600);
			try {
				await file.writeFile(content!);
				await file.sync();
			}
			finally { await file.close(); }
		}
		return { status: "research-prepared", outputDirectory, electionDate: report.electionDate, namedProjects: report.projects.length, principalYears: report.schedule.length, researchSha256: hash(body), publisherRequests: 0, imported: false, publicationApproved: false };
	}
	finally { await lock.release(); }
}

if (process.argv[1]?.endsWith("prepare-fulton-education-notice.ts") || process.argv[1]?.endsWith("prepare-fulton-education-notice.js")) {
	const [command, path, ...extra] = process.argv.slice(2);
	Promise.resolve().then(async () => {
		if (!path || extra.length || !["discover", "prepare"].includes(command ?? "")) throw new Error("Use prepare-fulton-education-notice discover INDEX.html or prepare PLAN.json.");
		console.log(JSON.stringify(command === "discover" ? discoverFultonEducationNotices((await readBoundedStateDataBytes(path, 3 * 1024 * 1024)).toString("utf8")) : await prepareFultonEducationNoticeFiles(path)));
	}).catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : "Education-notice preparation failed.");
		process.exitCode = 1;
	});
}
