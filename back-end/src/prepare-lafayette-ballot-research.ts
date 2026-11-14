import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import process from "node:process";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";
import { extractStateBallotPdfText, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";

interface Pin { path: string; sha256: string; url: string; capturedAt: string }
interface Plan { schemaVersion: 1; type: "lafayette-ballot-research-preparation"; electionDate: string; guide: Pin; governmentPage: Pin; outputDirectory: string }
const hash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");
const clean = (value: string) => value.normalize("NFKC").replace(/[“”]/gu, "\"").replace(/’/gu, "'").replace(/\s+/gu, " ").trim();
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
const date = (value: unknown): value is string => typeof value === "string" && /^20\d{2}-\d{2}-\d{2}$/u.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

function fiscal(question: string) {
	const number = (pattern: RegExp) => {
		const matches = [...question.matchAll(pattern)];
		const printed = matches.length === 1 ? matches[0]![1]! : "";
		const value = /^(?:[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d+)?$/u.test(printed) ? Number(printed.replaceAll(",", "")) : Number.NaN;
		if (!Number.isFinite(value) || value <= 0 || value > 1_000_000_000_000) throw new Error("A Lafayette fiscal value is missing or ambiguous.");
		return value;
	};
	if (question.includes("incur debt and issue")) {
		return { kind: "bond-authorization", maximumBondDollars: number(/incur debt and issue not exceeding \$([\d,]+)/gu), maximumYears: number(/to run not exceeding (\d+) years/gu), maximumAnnualInterestPercent: number(/rates not exceeding (\d+(?:\.\d+)?)% per annum/gu), firstYearReferencedMills: number(/above the (\d+(?:\.\d+)?) mills currently being levied/gu) };
	}
	const years = number(/for a period of (\d+) years/gu);
	const firstYear = number(/beginning with the year (20\d{2})/gu);
	const lastYear = number(/ending with the year (20\d{2})/gu);
	if (lastYear - firstYear + 1 !== years) throw new Error("The Lafayette tax term is inconsistent.");
	return { kind: "property-tax-continuation", mills: number(/continue to levy (?:a special tax of |a )(\d+(?:\.\d+)?) mills/gu), years, firstYear, lastYear, estimatedAnnualRevenueDollars: number(/an estimated \$([\d,]+) reasonably expected/gu) };
}

function verifySummaries(guide: string, government: string, values: ReturnType<typeof fiscal>) {
	const mills = (value: string) => [...value.matchAll(/\b(\d+(?:\.\d+)?) mills\b/gu)].map(match => Number(match[1]));
	if (values.kind === "property-tax-continuation") {
		for (const summary of [guide, government]) {
			const rates = mills(summary);
			const terms = [...summary.matchAll(/\b(20\d{2})[–-](20\d{2})\b/gu)];
			if (rates.length !== 1 || rates[0] !== values.mills || terms.length !== 1 || Number(terms[0]![1]) !== values.firstYear || Number(terms[0]![2]) !== values.lastYear) throw new Error("A proposition fiscal summary disagrees with its question.");
		}
		if (!guide.includes(`${values.years} years`)) throw new Error("The guide's fiscal term disagrees with its question.");
	}
	else {
		const amount = /\bUp to \$(\d+(?:\.\d+)?) million\b/u.exec(guide);
		const rates = mills(government);
		if (!amount || Number(amount[1]) * 1_000_000 !== values.maximumBondDollars || !guide.includes(`up to ${values.maximumYears} years`) || rates.length !== 1 || rates[0] !== values.firstYearReferencedMills) throw new Error("A bond summary disagrees with its question.");
	}
}

function candidates(page: string, electionDate: string) {
	const sections = page.split(/\bRUNOFF ELECTIONS?\b/u);
	if (sections.length === 1) return [];
	if (sections.length !== 2) throw new Error("Runoff candidate sections require review.");
	const raw = sections[1]!.trim().split(/\n[ \t]*\n/u).map(block => block.trim()).filter(Boolean);
	const paragraphs = raw.map(clean);
	const office = paragraphs[0];
	const printedVoterArea = paragraphs[1];
	if (paragraphs.length !== 3 || office !== "Lafayette City Court Judge, Division B" || !printedVoterArea || printedVoterArea.length > 500 || /^[=+@-]/u.test(printedVoterArea)) throw new Error("The printed runoff office or area requires review.");
	const rows = raw[2]!.trim().split("\n");
	if (!rows.length || rows.length > 20) throw new Error("Runoff candidate rows exceed their bounds.");
	const result = rows.map((line) => {
		const columns = line.trim().split(/[ \t]{2,}/u);
		const name = clean(columns[0] ?? "");
		const partyAsPrinted = clean(columns[1] ?? "");
		if (columns.length !== 2 || !/^\p{L}[\p{L} .'’()-]{1,249}$/u.test(name) || !["Republican", "Democratic", "Democrat", "Independent", "Libertarian", "Green", "No Party", "No Party Affiliation"].includes(partyAsPrinted)) throw new Error("Printed runoff name or party fields require review.");
		return { id: hash(`${electionDate}:${office}:${name}:${partyAsPrinted}`).slice(0, 24), stateCode: "LA", electionDate, name, partyAsPrinted, office, printedVoterArea, guidePage: 1, sourceClaimOnly: true, officialQualificationVerified: false };
	});
	if (new Set(result.map(row => row.name)).size !== result.length) throw new Error("Runoff references contain repeated names.");
	return result;
}

export function readLafayetteBallotResearch(guideText: string, governmentHtml: string, electionDate: string) {
	if (!date(electionDate) || Buffer.byteLength(guideText) > 4 * 1024 * 1024 || Buffer.byteLength(governmentHtml) > 2 * 1024 * 1024) throw new Error("Provide bounded Lafayette sources and an explicit election date.");
	const formattedDate = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" }).format(new Date(electionDate));
	const pages = guideText.split("\f").filter(page => page.trim());
	const tree = parseStateHtml(governmentHtml);
	const governmentText = clean(stateHtmlText(tree));
	if (!pages.length || pages.length > 20 || clean(pages[0]!.trim().split("\n")[0]!) !== `${formattedDate} Ballot Guide` || !governmentText.includes(formattedDate) || !governmentText.includes("Lafayette Consolidated Government")) throw new Error("The publications do not establish the same Lafayette election.");
	const official = stateHtmlDescendants(tree, node => node.nodeName === "details" && stateHtmlAttribute(node, "class").split(/\s+/u).includes("prop-detail")).map((node) => {
		const summaries = stateHtmlDescendants(node, child => child.nodeName === "summary");
		const questions = stateHtmlDescendants(node, child => child.nodeName === "p" && stateHtmlAttribute(child, "class").split(/\s+/u).includes("ballot-question"));
		const designation = summaries.length === 1 ? /^Prop\. ([1-9]\d?) of ([1-9]\d?)\b/u.exec(clean(stateHtmlText(summaries[0]!))) : null;
		if (!designation || questions.length !== 1) throw new Error("Government proposition structure requires review.");
		return { number: Number(designation[1]), total: Number(designation[2]), summary: clean(stateHtmlText(summaries[0]!)), question: clean(stateHtmlText(questions[0]!)) };
	});
	if (!official.length || official.length > 50 || new Set(official.map(item => item.question)).size !== official.length) throw new Error("Government proposition identities are incomplete or duplicated.");
	const rows = pages.flatMap((page, pageIndex) => [...page.matchAll(/(Parishwide|City of Lafayette) Proposition No\.[ \t]*([1-9]\d?)[ \t]*\n([\s\S]*?)(?=(?:Parishwide|City of Lafayette) Proposition No\.|$)/gu)].map((match) => {
		const title = clean(match[3]!.trim().split("\n")[0]!);
		const printedQuestions = [...match[3]!.matchAll(/Official ballot question:\s*[“"]([\s\S]*?\?)[”"]/gu)];
		if (!title || title.length > 250 || /^[=+@-]/u.test(title) || printedQuestions.length !== 1) throw new Error("Guide proposition wording requires review.");
		const question = clean(printedQuestions[0]![1]!);
		const area = match[1] === "Parishwide" ? "Lafayette Parish" : "City of Lafayette";
		if (!question.startsWith(`Shall the ${match[1] === "Parishwide" ? "Parish" : "City"} of Lafayette, State of Louisiana`) || question.length > 6000) throw new Error("Printed proposition area is inconsistent.");
		const matching = official.filter(item => item.question === question);
		if (matching.length !== 1) throw new Error("The guide and government proposition wording disagree.");
		const guideNumber = Number(match[2]);
		const governmentNumber = matching[0]!.number;
		const values = fiscal(question);
		verifySummaries(clean(match[3]!.slice(0, match[3]!.indexOf("Official ballot question:"))), matching[0]!.summary, values);
		return { id: hash(`${electionDate}:${area}:${question}`).slice(0, 24), electionDate, stateCode: "LA", area, title, question, questionSha256: hash(question), guidePage: pageIndex + 1, guideNumber, governmentNumber, governmentTotal: matching[0]!.total, numberingStatus: guideNumber === governmentNumber ? "agrees" : "conflict", canonicalPropositionNumber: null, fiscal: values };
	}));
	if (rows.length !== official.length || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error("The complete proposition sets do not reconcile.");
	for (const area of new Set(rows.map(row => row.area))) {
		const selected = rows.filter(row => row.area === area);
		const ordinals = Array.from({ length: selected.length }, (_, index) => index + 1).join(",");
		if (selected.length > 25 || selected.some(row => row.governmentTotal !== selected.length) || selected.map(row => row.guideNumber).sort((first, second) => first - second).join(",") !== ordinals || selected.map(row => row.governmentNumber).sort((first, second) => first - second).join(",") !== ordinals) throw new Error("Proposition numbering is incomplete or repeated within its printed area.");
	}
	const unresolvedResolutions = [...new Set(governmentText.match(/\b(?:PR|CR)-X{2,}-20\d{2}\b/gu) ?? [])];
	const conflicts = rows.filter(row => row.numberingStatus === "conflict").map(row => ({ id: row.id, area: row.area, title: row.title, guideNumber: row.guideNumber, governmentNumber: row.governmentNumber }));
	return { schemaVersion: 1, type: "lafayette-ballot-research", electionDate, rows, candidateReferences: candidates(pages[0]!, electionDate), conflicts, unresolvedResolutions, exactQuestionSetsAgree: true, officialCertificationVerified: false, personalApplicabilityVerified: false, automaticImportApproved: false, publicationApproved: false };
}

function pin(value: unknown): value is Pin {
	return exact(value, ["path", "sha256", "url", "capturedAt"]) && typeof value.path === "string" && isAbsolute(value.path) && typeof value.sha256 === "string" && /^[a-f\d]{64}$/u.test(value.sha256) && typeof value.url === "string" && typeof value.capturedAt === "string" && Number.isFinite(Date.parse(value.capturedAt)) && new Date(value.capturedAt).toISOString() === value.capturedAt && Date.parse(value.capturedAt) <= Date.now();
}

export async function prepareLafayetteBallotResearch(path: string, extract?: (bytes: Buffer) => Promise<string>) {
	const value: unknown = JSON.parse((await readBoundedStateDataBytes(path, 32768)).toString("utf8"));
	if (!exact(value, ["schemaVersion", "type", "electionDate", "guide", "governmentPage", "outputDirectory"]) || value.schemaVersion !== 1 || value.type !== "lafayette-ballot-research-preparation" || !date(value.electionDate) || !pin(value.guide) || !pin(value.governmentPage) || typeof value.outputDirectory !== "string") throw new Error("Provide pinned Lafayette publications and an external output directory.");
	const plan = value as unknown as Plan;
	const guideUrl = new URL(plan.guide.url);
	const edition = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" }).format(new Date(plan.electionDate)) + plan.electionDate.slice(0, 4);
	if (guideUrl.protocol !== "https:" || guideUrl.hostname !== "www.oneacadiana.org" || guideUrl.port || guideUrl.username || guideUrl.password || guideUrl.search || guideUrl.hash || !/^\/wp-content\/uploads\/GeauxVote_[A-Za-z]{3}20\d{2}_BallotGuide-FINAL(?:-v[1-9]\d?)?\.pdf$/u.test(guideUrl.pathname) || !guideUrl.pathname.startsWith(`/wp-content/uploads/GeauxVote_${edition}_BallotGuide-`) || plan.governmentPage.url !== "https://www.lafayettela.info/") throw new Error("The source URL requires a separate publisher review.");
	assertExternalStateDataDirectory(plan.outputDirectory);
	assertExternalStateDataDirectory(join(await realpath(dirname(plan.outputDirectory)), basename(plan.outputDirectory)));
	const guide = await readBoundedStateDataBytes(plan.guide.path, 12 * 1024 * 1024);
	const government = await readBoundedStateDataBytes(plan.governmentPage.path, 2 * 1024 * 1024);
	if (hash(guide) !== plan.guide.sha256 || hash(government) !== plan.governmentPage.sha256 || !guide.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("The original publication bytes do not match their pins.");
	const guideText = await (extract ?? (async bytes => extractStateBallotPdfText(bytes, await resolveStateBallotPdfExtractor(), undefined, "layout", 20)))(guide);
	const result = readLafayetteBallotResearch(guideText, government.toString("utf8"), plan.electionDate);
	const report = { ...result, sources: { guide: { url: plan.guide.url, sha256: plan.guide.sha256, capturedAt: plan.guide.capturedAt }, governmentPage: { url: plan.governmentPage.url, sha256: plan.governmentPage.sha256, capturedAt: plan.governmentPage.capturedAt } } };
	const fields = ["id", "electionDate", "area", "title", "guideNumber", "governmentNumber", "guidePage", "numberingStatus", "questionSha256", "fiscal"] as const;
	const csv = `${[fields.join(","), ...result.rows.map(row => fields.map(field => `"${(typeof row[field] === "object" ? JSON.stringify(row[field]) : String(row[field])).replaceAll("\"", "\"\"")}"`).join(","))].join("\n")}\n`;
	const candidateFields = ["id", "electionDate", "name", "partyAsPrinted", "office", "printedVoterArea", "guidePage"] as const;
	const candidateCsv = `${[candidateFields.join(","), ...result.candidateReferences.map(row => candidateFields.map(field => `"${String(row[field]).replaceAll("\"", "\"\"")}"`).join(","))].join("\n")}\n`;
	const files = [{ path: "research.json", body: `${JSON.stringify(report, null, 2)}\n` }, { path: "measures.csv", body: csv }, { path: "candidates.csv", body: candidateCsv }];
	const manifest = { schemaVersion: 1, type: "lafayette-ballot-research-preparation", electionDate: plan.electionDate, sources: report.sources, files: files.map(file => ({ path: file.path, bytes: Buffer.byteLength(file.body), sha256: hash(file.body) })), measures: result.rows.length, candidateReferences: result.candidateReferences.length, numberingConflicts: result.conflicts.length, unresolvedResolutions: result.unresolvedResolutions, publisherRequests: 0, imported: false, publicationApproved: false, automaticImportApproved: false };
	await mkdir(plan.outputDirectory, { mode: 0o700 });
	for (const file of [...files, { path: "preparation.json", body: `${JSON.stringify(manifest, null, 2)}\n` }]) await writeFile(join(plan.outputDirectory, file.path), file.body, { flag: "wx", mode: 0o600 });
	return { outputDirectory: plan.outputDirectory, measures: result.rows.length, candidateReferences: result.candidateReferences.length, numberingConflicts: result.conflicts.length, publisherRequests: 0, imported: false, publicationApproved: false };
}

if (process.argv[1]?.endsWith("prepare-lafayette-ballot-research.ts") || process.argv[1]?.endsWith("prepare-lafayette-ballot-research.js")) {
	const [path, ...extra] = process.argv.slice(2);
	if (!path || extra.length) {
		console.error("Use prepare-lafayette-ballot-research PLAN.json.");
		process.exitCode = 1;
	}
	else {
		prepareLafayetteBallotResearch(path).then(result => console.log(JSON.stringify(result))).catch((error: unknown) => {
			console.error(error instanceof Error ? error.message : "Lafayette ballot research preparation failed.");
			process.exitCode = 1;
		});
	}
}
