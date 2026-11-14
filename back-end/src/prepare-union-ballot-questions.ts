import type { Buffer } from "node:buffer";
import type { UnionSampleQuestion } from "./union-ballot-questions.js";
import { randomUUID } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { loadUnionBallotCaptures } from "./prepare-union-ballot-corroboration.js";
import { acquireStateBallotAutomationLock } from "./state-ballot-automation-lock.js";
import { extractStateBallotPdfText, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";
import { readBoundedStateDataBytes } from "./state-ballot-storage.js";
import { readUnionSampleQuestion } from "./union-ballot-questions.js";
import { unionCandidateHash as hash } from "./union-county-candidates.js";

type Extract = (body: Buffer, format: "layout" | "bbox-layout") => Promise<string>;
const native: Extract = async (body, format) => extractStateBallotPdfText(body, await resolveStateBallotPdfExtractor(), undefined, format);
const quote = (value: unknown) => `"${String(value).replace(/^(\s*[=+@-])/u, "'$1").replaceAll("\"", "\"\"")}"`;
async function persist(directory: string, name: string, body: string) {
	const handle = await open(join(directory, name), "wx", 0o600);
	try {
		await handle.writeFile(body);
		await handle.sync();
	}
	finally { await handle.close(); }
}
export async function prepareUnionBallotQuestions(path: string, options: { extract?: Extract; now?: () => number } = {}) {
	const plan = JSON.parse((await readBoundedStateDataBytes(path, 32768)).toString("utf8"));
	if (!plan || typeof plan !== "object" || Array.isArray(plan) || Object.keys(plan).sort().join(",") !== "ballotCaptures,outputRoot,schemaVersion,type" || plan.schemaVersion !== 1 || plan.type !== "union-ballot-question-preparation" || typeof plan.outputRoot !== "string") throw new Error("Provide an exact Union public-question preparation plan.");
	const { batches, catalog, originals } = await loadUnionBallotCaptures(plan.ballotCaptures, (options.now ?? Date.now)());
	const records: { id: string; electionDate: string; question: UnionSampleQuestion; sources: { form: number; sourceUrl: string; sourceSha256: string; capturedAt: string; page: 1; publishedLabels: typeof catalog.documents[number]["claims"] }[] }[] = [];
	const inventory: { form: number; sourceUrl: string; sourceSha256: string; capturedAt: string; questionPanels: number }[] = [];
	for (const input of originals) {
		const extract = options.extract ?? native;
		const question = readUnionSampleQuestion(await extract(input.body, "bbox-layout"), await extract(input.body, "layout"), input.document, catalog.edition.electionDate);
		inventory.push({ form: input.document.form, sourceUrl: input.metadata.url, sourceSha256: input.metadata.sha256, capturedAt: input.metadata.capturedAt, questionPanels: question ? 1 : 0 });
		if (!question) continue;
		const existing = records.find(record => record.question.municipality === question.municipality);
		if (existing && JSON.stringify(existing.question) !== JSON.stringify(question)) throw new Error("Union sample forms contain conflicting municipal question text.");
		const record = existing ?? { id: hash(JSON.stringify(["NJ", "Union County", catalog.edition.electionDate, question])).slice(0, 24), electionDate: catalog.edition.electionDate, question, sources: [] };
		if (!existing) records.push(record);
		record.sources.push({ form: input.document.form, sourceUrl: input.metadata.url, sourceSha256: input.metadata.sha256, capturedAt: input.metadata.capturedAt, page: 1, publishedLabels: input.document.claims });
	}
	records.sort((left, right) => left.question.municipality.localeCompare(right.question.municipality));
	for (const record of records) record.sources.sort((left, right) => left.form - right.form);
	inventory.sort((left, right) => left.form - right.form);
	const columns = ["id", "electionDate", "municipality", "printedHeading", "officialTextEn", "interpretiveStatementEn", "officialTextEs", "interpretiveStatementEs", "printedChoices", "sampleForms", "sourceUrls", "sourceSha256s", "sourceCapturedAt", "sourcePages"];
	const csv = `${columns.map(quote).join(",")}\n${records.map(record => [record.id, record.electionDate, record.question.municipality, record.question.printedHeading, record.question.officialText.en, record.question.interpretiveStatement.en, record.question.officialText.es, record.question.interpretiveStatement.es, record.question.printedChoices.join(";"), record.sources.map(source => source.form).join(";"), record.sources.map(source => source.sourceUrl).join(";"), record.sources.map(source => source.sourceSha256).join(";"), record.sources.map(source => source.capturedAt).join(";"), record.sources.map(source => source.page).join(";")].map(quote).join(",")).join("\n")}${records.length ? "\n" : ""}`;
	const result = { schemaVersion: 1, type: "union-public-question-research-preparation", electionDate: catalog.edition.electionDate, ballotCaptureHashes: batches.map(batch => batch.pin.sha256), catalogSha256: catalog.sha256, questions: records, inventory, questionCount: records.length, sampleFormsReviewed: originals.length, questionForms: inventory.filter(source => source.questionPanels).map(source => source.form), csvSha256: hash(csv), publisherRequests: 0, translationEquivalenceVerified: false, currentLawIndependentlyVerified: false, voterApplicabilityVerified: false, substantiveReviewComplete: false, imported: false, publicationApproved: false, automaticImportApproved: false };
	const lock = await acquireStateBallotAutomationLock(plan.outputRoot);
	try {
		const outputDirectory = join(lock.directory, `prepared-${randomUUID()}`);
		await mkdir(outputDirectory, { mode: 0o700 });
		const body = `${JSON.stringify(result, null, 2)}\n`;
		await persist(outputDirectory, "questions.csv", csv);
		await persist(outputDirectory, "questions.json", body);
		return { outputDirectory, questions: records.length, sampleForms: originals.length, questionForms: result.questionForms, sha256: hash(body), publisherRequests: 0, imported: false, publicationApproved: false };
	}
	finally { await lock.release(); }
}

if (process.argv[1]?.endsWith("prepare-union-ballot-questions.ts") || process.argv[1]?.endsWith("prepare-union-ballot-questions.js")) {
	const [path, ...extra] = process.argv.slice(2);
	if (!path || extra.length) {
		console.error("Use prepare-union-ballot-questions PLAN.json.");
		process.exitCode = 1;
	}
	else {
		prepareUnionBallotQuestions(path).then(result => console.log(JSON.stringify(result))).catch((error: unknown) => {
			console.error(error instanceof Error ? error.message : "Union public-question preparation failed.");
			process.exitCode = 1;
		});
	}
}
