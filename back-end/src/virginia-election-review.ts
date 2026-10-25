import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";
import { assertExternalStateDataDirectory, readBoundedStateData, readBoundedStateDataBytes } from "./state-ballot-storage.js";

type PublicationKind = "candidates" | "referendums";
export interface VirginiaTableReview { electionDate: string; kind: PublicationKind; expectedRows: number; expectedTrailingZipOmissions?: number }

const headers = {
	candidates: ["Locality", "Office Ballot Order", "Party Ballot Order", "Office Title", "District", "Number of Seats", "Office Term", "Special Office Unexpired Term End Date", "Candidate Party", "Candidate Name", "Incumbent", "Campaign Email", "Campaign Website", "Campaign Phone", "Campaign Address Line 1", "Campaign Address Line 2", "Campaign City", "Campaign State", "Campaign Zip"],
	referendums: ["Locality", "Active", "Referendum Ballot Order", "Referendum Area", "Referendum Title", "Referendum Text"],
};
const hash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");
const clean = (node: Parameters<typeof stateHtmlText>[0]) => stateHtmlText(node).replace(/\s+/gu, " ").trim();

function electionDateParts(electionDate: string) {
	const date = new Date(electionDate);
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(electionDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== electionDate) throw new Error("Provide a valid Virginia election date.");
	return { full: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date), month: new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(date), year: date.getUTCFullYear(), day: date.getUTCDate() };
}

export function parseVirginiaElectionTable(body: Uint8Array, review: VirginiaTableReview) {
	const date = electionDateParts(review?.electionDate);
	if (!["candidates", "referendums"].includes(review.kind) || !Number.isSafeInteger(review.expectedRows) || review.expectedRows < 1 || review.expectedRows > 5000) throw new Error("Provide the publication kind and explicit reviewed row count.");
	const expectedOmissions = review.expectedTrailingZipOmissions ?? 0;
	if (!Number.isSafeInteger(expectedOmissions) || expectedOmissions < 0 || expectedOmissions > review.expectedRows || (review.kind !== "candidates" && expectedOmissions !== 0)) throw new Error("Review any omitted trailing postal-code cells explicitly.");
	if (!body.byteLength || body.byteLength > 2 * 1024 * 1024) throw new Error("Virginia election HTML exceeds its size limit.");
	const document = parseStateHtml(new TextDecoder("utf-8", { fatal: true }).decode(body));
	const pending = [{ node: document, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const { node, depth } = pending.pop()!;
		if (++visited > 80_000 || depth > 64) throw new Error("Virginia election HTML exceeds its structure limit.");
		for (const child of node.childNodes ?? []) pending.push({ node: child, depth: depth + 1 });
	}
	const mains = stateHtmlDescendants(document, node => node.nodeName === "main");
	const title = review.kind === "candidates" ? `${date.full} - All Offices` : `${date.month} ${date.year} Proposed Constitutional Amendments and Local Referenda`;
	const headings = mains.length === 1 ? stateHtmlDescendants(mains[0]!, node => node.nodeName === "h1") : [];
	if (headings.length !== 1 || clean(headings[0]!) !== title) throw new Error("Virginia publication does not identify the reviewed election and scope.");
	const tables = stateHtmlDescendants(mains[0]!, node => node.nodeName === "table");
	if (tables.length !== 1 || /pager|pagination/iu.test(stateHtmlAttribute(tables[0]!, "class")) || stateHtmlDescendants(tables[0]!, node => ["script", "style", "template", "form", "input", "iframe"].includes(node.nodeName) || /pager|pagination/iu.test(stateHtmlAttribute(node, "class"))).length) throw new Error("Virginia publication table is missing, interactive or paginated.");
	const rows = stateHtmlDescendants(tables[0]!, node => node.nodeName === "tr").map(row => (row.childNodes ?? []).filter(cell => ["th", "td"].includes(cell.nodeName)).map(clean));
	const omittedZipCells = review.kind === "candidates" ? rows.slice(1).filter(row => row.length === 18).length : 0;
	if (rows.shift()?.join("\n") !== headers[review.kind].join("\n") || rows.length !== review.expectedRows || omittedZipCells !== expectedOmissions || rows.some(row => (row.length !== headers[review.kind].length && !(review.kind === "candidates" && row.length === 18)) || row.some(cell => cell.length > 20_000))) throw new Error("Virginia publication headers, row count or cell shape changed.");
	return rows.map((row, index) => {
		const field = (name: string) => row[headers[review.kind].indexOf(name)]!;
		const common = { publicationRow: index + 1, locality: field("Locality"), personalBallotAssignment: false, identityReconciliationApproved: false };
		if (review.kind === "candidates") {
			if (!common.locality || !field("Office Title") || !field("Candidate Name") || !/^[1-9]\d?$/u.test(field("Number of Seats"))) throw new Error("Virginia candidate row is missing required published fields.");
			return { ...common, officeBallotOrder: field("Office Ballot Order"), partyBallotOrder: field("Party Ballot Order"), office: field("Office Title"), districtAsPublished: field("District"), numberOfSeatsAsPublished: field("Number of Seats"), officeTermAsPublished: field("Office Term"), unexpiredTermEndAsPublished: field("Special Office Unexpired Term End Date"), partyAsPublished: field("Candidate Party"), name: field("Candidate Name"), incumbentAsPublished: field("Incumbent"), campaignWebsiteAsPublished: field("Campaign Website"), trailingPostalCodeCellOmitted: row.length === 18 };
		}
		const area = field("Referendum Area");
		if (!["Yes", "No"].includes(field("Active")) || !["Statewide", "Locality", "District"].includes(area) || Boolean(common.locality) !== (area !== "Statewide") || !field("Referendum Title") || field("Referendum Text").length < 30) throw new Error("Virginia referendum status, area or text is ambiguous.");
		return { ...common, activeAsPublished: field("Active"), ballotOrderAsPublished: field("Referendum Ballot Order"), areaAsPublished: area, title: field("Referendum Title"), questionText: field("Referendum Text"), ballotOptionsInferred: false };
	});
}

export async function prepareVirginiaElectionReview(planPath: string, now = Date.now()) {
	const plan = JSON.parse(await readBoundedStateData(planPath));
	if (!plan || Object.keys(plan).sort().join(",") !== "documents,electionDate,outputDirectory,outputName,schemaVersion,type" || plan.schemaVersion !== 1 || plan.type !== "virginia-election-review-preparation" || !Array.isArray(plan.documents) || plan.documents.length !== 2 || !isAbsolute(plan.outputDirectory ?? "") || !/^[a-z0-9][a-z0-9-]{0,100}$/u.test(plan.outputName ?? "")) throw new Error("Provide a bounded Virginia election review plan.");
	const date = electionDateParts(plan.electionDate);
	const month = date.month.toLowerCase();
	const kinds = new Set<string>();
	const outputs: { name: string; body: string }[] = [];
	const documents = [];
	for (const capture of plan.documents) {
		if (!capture || Object.keys(capture).sort().join(",") !== "capturedAt,expectedRows,expectedTrailingZipOmissions,kind,path,sha256,url" || !["candidates", "referendums"].includes(capture.kind) || kinds.has(capture.kind) || !isAbsolute(capture.path ?? "") || !/^[a-f0-9]{64}$/u.test(capture.sha256 ?? "") || !Number.isFinite(Date.parse(capture.capturedAt)) || Date.parse(capture.capturedAt) > now) throw new Error("Virginia capture provenance is invalid or duplicated.");
		kinds.add(capture.kind);
		const suffix = capture.kind === "candidates" ? `${month}-${date.day}-${date.year}-gen-elect-all-offices` : `${month}-${date.year}-proposed-constitutional-amendments`;
		if (capture.url !== `https://www.elections.virginia.gov/casting-a-ballot/candidate-list/${suffix}/`) throw new Error("Virginia capture URL differs from its reviewed election and scope.");
		const body = await readBoundedStateDataBytes(capture.path);
		if (hash(body) !== capture.sha256) throw new Error("Virginia capture digest differs from its retained original.");
		const rows = parseVirginiaElectionTable(body, { electionDate: plan.electionDate, kind: capture.kind, expectedRows: capture.expectedRows, expectedTrailingZipOmissions: capture.expectedTrailingZipOmissions });
		const metadata = { schemaVersion: 1, type: "virginia-election-publication-review", kind: capture.kind, stateCode: "VA", electionDate: plan.electionDate, sourceUrl: capture.url, sourceSha256: capture.sha256, capturedAt: capture.capturedAt, publicationDate: null, preparedAt: new Date(now).toISOString(), publicationApproved: false, automaticImportApproved: false, personalBallotAssignment: false, identityReconciliationApproved: false };
		const records = rows.map(row => ({ ...metadata, ...row }));
		const columns = [...Object.keys(rows[0]!), "sourceUrl", "sourceSha256", "capturedAt", "electionDate", "publicationApproved"];
		const csvCell = (value: unknown) => {
			const text = String(value);
			return `"${(/^\s*[=+@-]|^[\t\r\n]/u.test(text) ? "'" : "") + text.replaceAll("\"", "\"\"")}"`;
		};
		outputs.push({ name: `${plan.outputName}-${capture.kind}.jsonl`, body: `${[metadata, ...records].map(record => JSON.stringify(record)).join("\n")}\n` });
		outputs.push({ name: `${plan.outputName}-${capture.kind}.csv`, body: `${[columns, ...records.map(record => columns.map(column => (record as unknown as Record<string, unknown>)[column]))].map(row => row.map(csvCell).join(",")).join("\n")}\n` });
		documents.push({ kind: capture.kind as PublicationKind, url: capture.url as string, sha256: capture.sha256 as string, capturedAt: capture.capturedAt as string, publicationRows: rows.length, omittedTrailingPostalCodeCells: capture.expectedTrailingZipOmissions as number });
	}
	const manifest = { schemaVersion: 1, type: "virginia-election-review-manifest", electionDate: plan.electionDate, preparedAt: new Date(now).toISOString(), documents, files: outputs.map(file => ({ name: file.name, bytes: Buffer.byteLength(file.body), sha256: hash(file.body) })), publisherRequests: 0, imported: false, publicationApproved: false, automaticImportApproved: false, personalBallotAssignment: false, identityReconciliationApproved: false };
	outputs.push({ name: `${plan.outputName}-manifest.json`, body: `${JSON.stringify(manifest, null, 2)}\n` });
	outputs.push({ name: `${plan.outputName}-SHA256SUMS`, body: `${outputs.map(file => `${hash(file.body)}  ${file.name}`).join("\n")}\n` });
	if (outputs.some(file => Buffer.byteLength(file.body) > 12 * 1024 * 1024)) throw new Error("Virginia review output exceeds its size limit.");
	assertExternalStateDataDirectory(plan.outputDirectory);
	assertExternalStateDataDirectory(join(await realpath(dirname(plan.outputDirectory)), basename(plan.outputDirectory)));
	await mkdir(plan.outputDirectory);
	assertExternalStateDataDirectory(await realpath(plan.outputDirectory));
	for (const file of outputs) await writeFile(join(plan.outputDirectory, file.name), file.body, { flag: "wx" });
	return { outputDirectory: plan.outputDirectory, files: outputs.length, documents, publisherRequests: 0, imported: false, publicationApproved: false };
}
