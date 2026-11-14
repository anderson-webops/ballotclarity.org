import type { Buffer } from "node:buffer";
import type { UnionChoiceContext } from "./union-ballot-choice-context.js";
import type { UnionSampleClaim } from "./union-county-ballots.js";
import type { UnionCandidateReference } from "./union-county-candidates.js";
import { randomUUID } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { loadUnionBallotCaptures } from "./prepare-union-ballot-corroboration.js";
import { acquireStateBallotAutomationLock } from "./state-ballot-automation-lock.js";
import { extractStateBallotPdfText, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";
import { readBoundedStateDataBytes } from "./state-ballot-storage.js";
import { readUnionChoiceContext, unionOfficeCorroborated } from "./union-ballot-choice-context.js";
import { unionCandidateHash as hash } from "./union-county-candidates.js";

type Extract = (body: Buffer, format: "layout" | "bbox-layout") => Promise<string>;
type Reference = UnionCandidateReference & { stateCode: "NJ"; publicationCounty: "Union County"; kind: "general" | "school"; electionDate: string; sourceAsOfDate: string; sourceUrl: string; sourceSha256: string; capturedAt: string };
const native: Extract = async (body, format) => extractStateBallotPdfText(body, await resolveStateBallotPdfExtractor(), undefined, format);
const canonical = (value: string) => value.normalize("NFKC").toLocaleUpperCase("en-US").replace(/[^\p{L}\p{N}]/gu, "");
const quote = (value: unknown) => `"${String(value).replace(/^(\s*[=+@-])/u, "'$1").replaceAll("\"", "\"\"")}"`;
const keys = ["stateCode", "publicationCounty", "kind", "electionDate", "page", "position", "name", "office", "jurisdictionLabel", "partyCode", "termLabel", "sourceAsOfDate", "sourceUrl", "sourceSha256", "capturedAt"];
async function persist(directory: string, name: string, body: string) {
	const handle = await open(join(directory, name), "wx", 0o600);
	try {
		await handle.writeFile(body);
		await handle.sync();
	}
	finally { await handle.close(); }
}
export async function prepareUnionChoiceReview(path: string, options: { extract?: Extract; now?: () => number } = {}) {
	const plan = JSON.parse((await readBoundedStateDataBytes(path, 32768)).toString("utf8"));
	if (!plan || typeof plan !== "object" || Array.isArray(plan) || Object.keys(plan).sort().join(",") !== "ballotCaptures,candidateCorroboration,outputRoot,schemaVersion,type" || plan.schemaVersion !== 1 || plan.type !== "union-choice-context-review" || typeof plan.outputRoot !== "string" || !plan.candidateCorroboration || Object.keys(plan.candidateCorroboration).sort().join(",") !== "path,sha256" || typeof plan.candidateCorroboration.path !== "string" || !/^[a-f0-9]{64}$/u.test(plan.candidateCorroboration.sha256)) throw new Error("Provide an exact Union candidate-context review plan.");
	const now = (options.now ?? Date.now)();
	const { batches, catalog, originals } = await loadUnionBallotCaptures(plan.ballotCaptures, now);
	const parentBody = await readBoundedStateDataBytes(plan.candidateCorroboration.path);
	if (hash(parentBody) !== plan.candidateCorroboration.sha256) throw new Error("Union candidate-comparison evidence changed.");
	const parent = JSON.parse(parentBody.toString("utf8"));
	if (parent.schemaVersion !== 1 || parent.type !== "union-ballot-corroboration-review" || parent.publicationApproved !== false || parent.qualificationVerified !== false || parent.catalog?.sha256 !== catalog.sha256 || !Array.isArray(parent.references) || !parent.references.length || parent.references.length > 2000 || parent.references.some((row: { reference?: Record<string, unknown> }) => {
		const reference = row.reference;
		return !reference || Object.keys(reference).sort().join(",") !== [...keys].sort().join(",") || reference.stateCode !== "NJ" || reference.publicationCounty !== "Union County" || !["general", "school"].includes(String(reference.kind)) || reference.electionDate !== catalog.edition.electionDate || !Number.isSafeInteger(reference.page) || Number(reference.page) < 1 || keys.filter(key => key !== "page").some(key => typeof reference[key] !== "string" || String(reference[key]).length > 1000) || !reference.name || !reference.office || !/^[a-f0-9]{64}$/u.test(String(reference.sourceSha256)) || !Number.isFinite(Date.parse(String(reference.capturedAt))) || Date.parse(String(reference.capturedAt)) > now;
	})) {
		throw new Error("Union candidate references require independent review.");
	}
	const references = parent.references.map((row: { reference: Reference }) => row.reference) as Reference[];
	if (new Set(references.map(reference => JSON.stringify(reference))).size !== references.length) throw new Error("Union candidate references repeat.");
	const samples: { form: number; sourceUrl: string; sourceSha256: string; capturedAt: string; publishedLabels: UnionSampleClaim[]; cells: UnionChoiceContext[] }[] = [];
	for (const input of originals) {
		const extract = options.extract ?? native;
		const cells = readUnionChoiceContext(await extract(input.body, "bbox-layout"), await extract(input.body, "layout"), input.document, catalog.edition.electionDate);
		samples.push({ form: input.document.form, sourceUrl: input.metadata.url, sourceSha256: input.metadata.sha256, capturedAt: input.metadata.capturedAt, publishedLabels: input.document.claims, cells });
	}
	const records = references.map((reference) => {
		const area = canonical(reference.jurisdictionLabel.replace(/^(?:TOWNSHIP|TOWN|CITY|BOROUGH) OF /u, ""));
		const relevant = samples.filter(sample => reference.jurisdictionLabel === "UNION COUNTY" || sample.publishedLabels.some(claim => canonical(claim.municipality) === area));
		if (!relevant.length) throw new Error("Union reference has no published municipal sample context.");
		const witnesses = relevant.flatMap(sample => sample.cells.filter(cell => cell.position === reference.position && canonical(cell.observedName) === canonical(reference.name) && (reference.kind === "school" ? cell.panel === "school" : cell.panel !== "school")).map(cell => ({ form: sample.form, sourceUrl: sample.sourceUrl, sourceSha256: sample.sourceSha256, capturedAt: sample.capturedAt, publishedLabels: sample.publishedLabels, ...cell })));
		const officeCorroborated = witnesses.length > 0 && witnesses.every(witness => unionOfficeCorroborated(reference.office, witness));
		const party = reference.partyCode === "Dem" ? "Democrat" : reference.partyCode === "Rep" ? "Republican" : null;
		const partyStatus = !witnesses.length ? "no-name-match" : party && witnesses.every(witness => witness.printedPartyOrColumn === party) ? "corroborated" : reference.partyCode === "Ind" && witnesses.every(witness => witness.printedPartyOrColumn === "Nomination by Petition") ? "petition-column-only" : reference.partyCode === "" && witnesses.every(witness => witness.panel === "municipal-nonpartisan") ? "explicit-nonpartisan" : reference.partyCode === "" && witnesses.every(witness => witness.panel === "school" && !witness.printedPartyOrColumn) ? "blank-retained" : "review-required";
		return { reference, witnesses, nameAndPositionCorroborated: witnesses.length > 0, officeCorroborated, partyStatus, partyCorroborated: partyStatus === "corroborated", qualificationVerified: false, voterApplicabilityVerified: false, publicationApproved: false };
	});
	const witnessKey = (form: number, cell: UnionChoiceContext) => JSON.stringify([form, cell.position, canonical(cell.observedName), cell.panel]);
	const linked = new Set(records.flatMap(record => record.witnesses.map(witness => witnessKey(witness.form, witness))));
	const printed = samples.flatMap(sample => sample.cells.map(cell => ({ form: sample.form, sourceUrl: sample.sourceUrl, sourceSha256: sample.sourceSha256, capturedAt: sample.capturedAt, publishedLabels: sample.publishedLabels, ...cell })));
	const isEmpty = (cell: UnionChoiceContext) => !cell.observedName || ["NONOMINATIONMADE", "NOPETITIONFILED", "WRITEIN"].includes(canonical(cell.observedName));
	const unlinkedSampleChoices = printed.filter(cell => !isEmpty(cell) && !linked.has(witnessKey(cell.form, cell)));
	const excludedPositionCells = printed.filter(isEmpty);
	const columns = ["name", "kind", "electionDate", "office", "jurisdictionLabel", "partyCode", "position", "originalListAsOfDate", "originalListUrl", "originalListSha256", "originalListCapturedAt", "officeCorroborated", "partyStatus", "printedOffices", "printedPartyOrColumns", "printedSelections", "sampleForms", "sourceUrls", "sourceSha256s", "sourceCapturedAt"];
	const unique = (values: string[]) => [...new Set(values)].join(";");
	const csv = `${columns.map(quote).join(",")}\n${records.map(record => [record.reference.name, record.reference.kind, record.reference.electionDate, record.reference.office, record.reference.jurisdictionLabel, record.reference.partyCode, record.reference.position, record.reference.sourceAsOfDate, record.reference.sourceUrl, record.reference.sourceSha256, record.reference.capturedAt, record.officeCorroborated, record.partyStatus, unique(record.witnesses.map(witness => witness.printedOffice)), unique(record.witnesses.map(witness => witness.printedPartyOrColumn)), unique(record.witnesses.flatMap(witness => witness.printedSelections)), record.witnesses.map(witness => witness.form).join(";"), record.witnesses.map(witness => witness.sourceUrl).join(";"), record.witnesses.map(witness => witness.sourceSha256).join(";"), record.witnesses.map(witness => witness.capturedAt).join(";")].map(quote).join(",")).join("\n")}\n`;
	const unlinkedColumns = ["observedName", "electionDate", "panel", "printedOffice", "printedPartyOrColumn", "position", "form", "page", "sourceUrl", "sourceSha256", "capturedAt"];
	const unlinkedCsv = `${unlinkedColumns.map(quote).join(",")}\n${unlinkedSampleChoices.map(cell => [cell.observedName, catalog.edition.electionDate, cell.panel, cell.printedOffice, cell.printedPartyOrColumn, cell.position, cell.form, cell.page, cell.sourceUrl, cell.sourceSha256, cell.capturedAt].map(quote).join(",")).join("\n")}${unlinkedSampleChoices.length ? "\n" : ""}`;
	const partyStatusCounts = records.reduce<Record<string, number>>((counts, record) => {
		counts[record.partyStatus] = (counts[record.partyStatus] ?? 0) + 1;
		return counts;
	}, {});
	const result = { schemaVersion: 1, type: "union-candidate-context-review", candidateCorroborationSha256: plan.candidateCorroboration.sha256, ballotCaptureHashes: batches.map(batch => batch.pin.sha256), catalogSha256: catalog.sha256, sampleFormsReviewed: samples.length, references: records, unlinkedSampleChoices, excludedPositionCells, referenceCount: records.length, officesCorroborated: records.filter(record => record.officeCorroborated).length, partiesCorroborated: records.filter(record => record.partyCorroborated).length, partyStatusCounts, csvSha256: hash(csv), unlinkedCsvSha256: hash(unlinkedCsv), publisherRequests: 0, qualificationVerified: false, voterApplicabilityVerified: false, substantiveReviewComplete: false, imported: false, publicationApproved: false, automaticImportApproved: false };
	const lock = await acquireStateBallotAutomationLock(plan.outputRoot);
	try {
		const outputDirectory = join(lock.directory, `prepared-${randomUUID()}`);
		await mkdir(outputDirectory, { mode: 0o700 });
		const body = `${JSON.stringify(result, null, 2)}\n`;
		await persist(outputDirectory, "choice-context.csv", csv);
		await persist(outputDirectory, "unlinked-printed-choices.csv", unlinkedCsv);
		await persist(outputDirectory, "choice-context.json", body);
		return { outputDirectory, references: records.length, officesCorroborated: result.officesCorroborated, partiesCorroborated: result.partiesCorroborated, partyStatusCounts: result.partyStatusCounts, sha256: hash(body), publisherRequests: 0, imported: false, publicationApproved: false };
	}
	finally { await lock.release(); }
}

if (process.argv[1]?.endsWith("prepare-union-choice-review.ts") || process.argv[1]?.endsWith("prepare-union-choice-review.js")) {
	const [path, ...extra] = process.argv.slice(2);
	if (!path || extra.length) {
		console.error("Use prepare-union-choice-review PLAN.json.");
		process.exitCode = 1;
	}
	else {
		prepareUnionChoiceReview(path).then(result => console.log(JSON.stringify(result))).catch((error: unknown) => {
			console.error(error instanceof Error ? error.message : "Union candidate-context review failed.");
			process.exitCode = 1;
		});
	}
}
