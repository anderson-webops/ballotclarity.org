import { Buffer } from "node:buffer";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import process from "node:process";
import { kauaiDisclosureHash, kauaiDisclosurePdfProfile, kauaiEthicsIndexUrl, readKauaiCandidateDisclosures, readKauaiDisclosureIndex } from "./kauai-candidate-disclosures.js";
import { extractStateBallotPdfText, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";

interface Input { path: string; sha256: string; url: string; capturedAt: string }
interface Plan { schemaVersion: 1; type: "kauai-disclosure-research-preparation"; publication: Input; index: Input; outputDirectory: string }
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));

export async function prepareKauaiDisclosures(path: string, options: { now?: number; extract?: (bytes: Buffer) => Promise<string> } = {}) {
	const now = options.now ?? Date.now();
	const plan = JSON.parse((await readBoundedStateDataBytes(path, 32768)).toString("utf8")) as Plan;
	if (!exact(plan, ["schemaVersion", "type", "publication", "index", "outputDirectory"]) || plan.schemaVersion !== 1 || plan.type !== "kauai-disclosure-research-preparation" || typeof plan.outputDirectory !== "string") throw new Error("Provide a pinned Kauai disclosure preparation plan.");
	for (const input of [plan.index, plan.publication]) {
		if (!exact(input, ["path", "sha256", "url", "capturedAt"]) || typeof input.path !== "string" || !isAbsolute(input.path) || typeof input.sha256 !== "string" || !/^[a-f\d]{64}$/u.test(input.sha256) || typeof input.url !== "string" || typeof input.capturedAt !== "string" || !Number.isFinite(Date.parse(input.capturedAt)) || new Date(input.capturedAt).toISOString() !== input.capturedAt || Date.parse(input.capturedAt) > now) throw new Error("Kauai preparation requires exact original input pins and capture clocks.");
	}
	if (plan.index.url !== kauaiEthicsIndexUrl) throw new Error("Kauai preparation requires the independent county agenda index.");
	assertExternalStateDataDirectory(plan.outputDirectory);
	if (await realpath(dirname(plan.outputDirectory)) !== dirname(plan.outputDirectory)) throw new Error("Kauai preparation requires its physical output parent.");
	const [publication, index] = await Promise.all([readBoundedStateDataBytes(plan.publication.path, kauaiDisclosurePdfProfile.maximumPdfBytes), readBoundedStateDataBytes(plan.index.path, 3 * 1024 * 1024)]);
	if (kauaiDisclosureHash(publication) !== plan.publication.sha256 || kauaiDisclosureHash(index) !== plan.index.sha256 || !publication.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("Kauai preparation input bytes changed.");
	const offered = readKauaiDisclosureIndex(new TextDecoder("utf-8", { fatal: true }).decode(index), plan.publication.url);
	const text = await (options.extract ?? (async bytes => extractStateBallotPdfText(bytes, await resolveStateBallotPdfExtractor(), undefined, "layout", kauaiDisclosurePdfProfile.maximumPages)))(publication);
	const report = readKauaiCandidateDisclosures(text, offered.publication.meetingDate);
	if (report.reportDate > plan.publication.capturedAt.slice(0, 10) || report.reportDate > plan.index.capturedAt.slice(0, 10)) throw new Error("Kauai report and original capture clocks disagree.");
	const facts = { schemaVersion: 1, type: "kauai-candidate-disclosure-research", stateCode: "HI", jurisdiction: "Kauai County", ...report, packetMeetingDate: offered.publication.meetingDate, publication: { url: plan.publication.url, sha256: plan.publication.sha256, bytes: publication.length, capturedAt: plan.publication.capturedAt }, index: { url: plan.index.url, sha256: plan.index.sha256, capturedAt: plan.index.capturedAt }, newerOfferedPublications: offered.newerOfferedPublications, latestPublicationVerified: false, recordCount: report.records.length, ballotQualificationVerified: false, publicationApproved: false, automaticImportApproved: false };
	const quote = (value: string | number | null) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
	const columns = ["id", "name", "office", "cycle_year", "disclosure_received", "disclosure_updated", "report_date", "packet_meeting_date", "source_page", "source_url", "source_sha256", "captured_at"];
	const rows = report.records.map(record => [record.id, record.name, record.office, report.cycleYear, record.disclosureReceived, record.disclosureUpdated, report.reportDate, facts.packetMeetingDate, record.sourcePage, `${facts.publication.url}#page=${record.sourcePage}`, facts.publication.sha256, facts.publication.capturedAt].map(quote).join(","));
	await mkdir(plan.outputDirectory, { mode: 0o700 });
	await writeFile(join(plan.outputDirectory, "kauai-disclosures.json"), `${JSON.stringify(facts, null, 2)}\n`, { flag: "wx", mode: 0o600 });
	await writeFile(join(plan.outputDirectory, "kauai-disclosures.csv"), `${columns.join(",")}\n${rows.join("\n")}\n`, { flag: "wx", mode: 0o600 });
	return { status: "prepared-for-research", records: report.records.length, reportDate: report.reportDate, sourcePage: report.sourcePage, newerOfferedPublications: offered.newerOfferedPublications.length, outputDirectory: plan.outputDirectory, imported: false, ballotQualificationVerified: false, publicationApproved: false, automaticImportApproved: false };
}

if (process.argv[1]?.endsWith("prepare-kauai-disclosures.js") || process.argv[1]?.endsWith("prepare-kauai-disclosures.ts")) {
	const [path, ...extra] = process.argv.slice(2);
	if (!path || extra.length) {
		console.error("Use prepare-kauai-disclosures PLAN.json.");
		process.exitCode = 1;
	}
	else {
		prepareKauaiDisclosures(path).then(result => console.log(JSON.stringify(result))).catch((error: unknown) => {
			console.error(error instanceof Error ? error.message : "Kauai disclosure preparation failed.");
			process.exitCode = 1;
		});
	}
}
