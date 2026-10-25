import type { StateBallotTablePage } from "./state-ballot-pdf-grid.js";
import { Buffer } from "node:buffer";

type Cell = StateBallotTablePage["cells"][number];
interface Columns { left: number; names: number; split: number; party: number; term: number; right: number }
export interface ClarkCandidateClaim {
	page: number;
	row: number;
	lastName: string;
	firstName: string;
	name: string;
	partyCode: string;
	officeParts: string[];
	term: string;
	section: string;
	localSection?: string;
}

const parties = ["DEM", "REP", "NP", "NPP", "IAP", "LPN"];
const sections = ["FEDERAL PARTISAN", "STATE PARTISAN", "COUNTY PARTISAN", "STATE AND DISTRICT NONPARTISAN", "COUNTY NONPARTISAN", "CITY (ALL NONPARTISAN)", "TOWNSHIP NONPARTISAN"];
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const fold = (value: string) => value.normalize("NFKC").replace(/[‘’]/gu, "'").replace(/[“”]/gu, "\"").replace(/\s+/gu, "").toLowerCase();
const close = (first: number, second: number) => Math.abs(first - second) < 1;
const keys = (value: unknown, fields: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...fields].sort().join(","));

function pages(value: unknown): StateBallotTablePage[] {
	if (Buffer.byteLength(JSON.stringify(value) ?? "") > 4 * 1024 * 1024 || !Array.isArray(value) || !value.length || value.length > 50) throw new Error("The Clark County table document exceeds its bounds.");
	let previous = 0;
	for (const page of value) {
		if (!keys(page, ["number", "width", "height", "text", "cells"]) || !Number.isSafeInteger(page.number) || Number(page.number) <= previous || Number(page.number) > 50 || page.width !== 612 || page.height !== 792 || typeof page.text !== "string" || page.text.length > 50000 || !Array.isArray(page.cells) || page.cells.length > 500) throw new Error("The Clark County table page has changed geometry or content.");
		previous = Number(page.number);
		for (const cell of page.cells) {
			if (!keys(cell, ["bounds", "text", "logicalText"]) || !Array.isArray(cell.bounds) || cell.bounds.length !== 4 || cell.bounds.some(value => typeof value !== "number" || !Number.isFinite(value)) || cell.bounds[0] < 0 || cell.bounds[1] < 0 || cell.bounds[2] > 613 || cell.bounds[3] > 793 || cell.bounds[0] >= cell.bounds[2] || cell.bounds[1] >= cell.bounds[3] || typeof cell.text !== "string" || typeof cell.logicalText !== "string" || cell.text.length > 3000 || cell.logicalText.length > 3000) throw new Error("The Clark County table cell is invalid.");
		}
	}
	return value as StateBallotTablePage[];
}

function headerColumns(page: StateBallotTablePage, party: Cell) {
	const offices = page.cells.filter(cell => clean(cell.text) === "CONTEST");
	const terms = page.cells.filter(cell => fold(cell.text) === "term(years)");
	if (offices.length !== 1 || terms.length !== 1 || !close(offices[0]!.bounds[3], party.bounds[3]) || !close(terms[0]!.bounds[0], party.bounds[2]) || !close(terms[0]!.bounds[3], party.bounds[3])) throw new Error("The Clark County table headers are incomplete.");
	const office = offices[0]!;
	const first = page.cells.find(cell => close(cell.bounds[0], party.bounds[0]) && close(cell.bounds[2], party.bounds[2]) && cell.bounds[1] >= party.bounds[3] - 1 && parties.includes(clean(cell.text)));
	if (!first) throw new Error("The Clark County table has no readable candidate rows.");
	const names = page.cells.filter(cell => close(cell.bounds[1], first.bounds[1]) && close(cell.bounds[3], first.bounds[3]) && cell.bounds[0] >= office.bounds[2] - 1 && cell.bounds[2] <= party.bounds[0] + 1).sort((first, second) => first.bounds[0] - second.bounds[0]);
	if (names.length !== 2 || !close(names[0]!.bounds[0], office.bounds[2]) || !close(names[0]!.bounds[2], names[1]!.bounds[0]) || !close(names[1]!.bounds[2], party.bounds[0])) throw new Error("The Clark County name columns are incomplete or ambiguous.");
	return { left: office.bounds[0], names: office.bounds[2], split: names[0]!.bounds[2], party: party.bounds[0], term: party.bounds[2], right: terms[0]!.bounds[2] };
}

export function readClarkCandidateTables(value: unknown, electionDate: string, kind: "candidate-table" | "newsletter") {
	if (!["candidate-table", "newsletter"].includes(kind) || !/^20\d{2}-11-0[2-8]$/u.test(electionDate) || new Date(`${electionDate}T00:00:00Z`).getUTCDay() !== 2) throw new Error("The Clark County table election is invalid.");
	const document = pages(value);
	const date = `November ${Number(electionDate.slice(-2))} ${electionDate.slice(0, 4)}, General Election in Clark County, Nevada`;
	if (kind === "candidate-table" && !clean(document[0]!.text).replace(/November (\d+),/u, "November $1").includes(date)) throw new Error("The Clark County candidate table does not identify the configured election.");
	let columns: Columns | undefined;
	let section: string | undefined;
	let localSection: string | undefined;
	const claims: ClarkCandidateClaim[] = [];
	const nonpersonOptions: Array<{ page: number; text: string; officeParts: string[] }> = [];
	const tablePages: number[] = [];
	for (const page of document) {
		const headers = page.cells.filter(cell => clean(cell.text) === "PARTY");
		if (headers.length > 1) throw new Error("The Clark County party header is ambiguous.");
		let top = 0;
		if (headers.length) {
			if (!fold(page.text).includes("candidatenameonballot")) throw new Error("The Clark County candidate heading requires review.");
			columns = headerColumns(page, headers[0]!);
			top = headers[0]!.bounds[3];
		}
		else if (kind === "candidate-table") {
			throw new Error("The Clark County candidate table omitted a page header.");
		}
		if (!columns) continue;
		const layout = columns;
		const partyCells = page.cells.filter(cell => close(cell.bounds[0], layout.party) && close(cell.bounds[2], layout.term) && cell.bounds[1] >= top - 1).sort((first, second) => first.bounds[1] - second.bounds[1]);
		if (!partyCells.length) {
			if (kind === "candidate-table") throw new Error("The Clark County candidate page has no table rows.");
			continue;
		}
		if (tablePages.length && page.number !== tablePages.at(-1)! + 1) throw new Error("The Clark County candidate panels are not contiguous.");
		tablePages.push(page.number);
		const bands = page.cells.filter(cell => close(cell.bounds[0], layout.left) && close(cell.bounds[2], layout.right) && cell.bounds[1] >= top - 1).sort((first, second) => first.bounds[1] - second.bounds[1]);
		let bandIndex = 0;
		const namedCells = new Set<Cell>();
		const appliedTerms = new Set<Cell>();
		for (const [row, cell] of partyCells.entries()) {
			const center = (cell.bounds[1] + cell.bounds[3]) / 2;
			while (bandIndex < bands.length && bands[bandIndex]!.bounds[3] < center) {
				const label = clean(bands[bandIndex++]!.text);
				if (sections.includes(label)) {
					section = label;
					localSection = undefined;
				}
				else if (/^City of [A-Za-z ]{1,60}$/u.test(label)) {
					localSection = label;
				}
				else if (label) {
					throw new Error("The Clark County table section requires review.");
				}
			}
			const office = page.cells.filter(other => other.bounds[0] >= layout.left - 1 && other.bounds[2] <= layout.names + 1 && other.bounds[1] < center && other.bounds[3] > center).sort((first, second) => first.bounds[0] - second.bounds[0]);
			const names = page.cells.filter(other => close(other.bounds[1], cell.bounds[1]) && close(other.bounds[3], cell.bounds[3]) && other.bounds[0] >= layout.names - 1 && other.bounds[2] <= layout.party + 1).sort((first, second) => first.bounds[0] - second.bounds[0]);
			const terms = page.cells.filter(other => close(other.bounds[0], layout.term) && close(other.bounds[2], layout.right) && other.bounds[1] < center && other.bounds[3] > center);
			const partyCode = clean(cell.text);
			if (names.length !== 2 || !close(names[0]!.bounds[0], layout.names) || !close(names[0]!.bounds[2], layout.split) || !close(names[1]!.bounds[0], layout.split) || !close(names[1]!.bounds[2], layout.party) || terms.length !== 1 || !office.length || office.some(cell => !clean(cell.text)) || !section || !parties.includes(partyCode)) throw new Error("The Clark County candidate does not match its complete physical row.");
			const firstName = clean(names[1]!.text);
			const lastName = clean(names[0]!.text);
			const term = clean(terms[0]!.text.replace(/Unex-\s*pired/giu, "Unexpired"));
			if (!firstName || !lastName || firstName.length > 150 || lastName.length > 150 || !/^\d{1,2}(?:-Year Unexpired Term)?$/u.test(term)) throw new Error("The Clark County candidate name or term requires review.");
			for (const name of names) namedCells.add(name);
			appliedTerms.add(terms[0]!);
			claims.push({ page: page.number, row: row + 1, firstName, lastName, name: `${firstName} ${lastName}`, partyCode, officeParts: office.map(cell => clean(cell.text)), term, section, ...(localSection ? { localSection } : {}) });
		}
		const bottom = Math.max(...partyCells.map(cell => cell.bounds[3]), ...[...appliedTerms].map(cell => cell.bounds[3]));
		for (const cell of page.cells.filter(cell => cell.bounds[0] >= layout.names - 1 && cell.bounds[2] <= layout.term + 1 && cell.bounds[1] >= top - 1 && cell.bounds[1] < bottom && clean(cell.text))) {
			if (namedCells.has(cell) || partyCells.includes(cell) || bands.includes(cell)) continue;
			if (/^None of these candidates$/iu.test(clean(cell.text))) {
				const center = (cell.bounds[1] + cell.bounds[3]) / 2;
				const office = page.cells.filter(other => other.bounds[0] >= layout.left - 1 && other.bounds[2] <= layout.names + 1 && other.bounds[1] < center && other.bounds[3] > center).sort((first, second) => first.bounds[0] - second.bounds[0]);
				if (!office.length || office.some(cell => !clean(cell.text))) throw new Error("The Clark County nonperson option has no unambiguous office.");
				nonpersonOptions.push({ page: page.number, text: clean(cell.text), officeParts: office.map(cell => clean(cell.text)) });
			}
			else {
				throw new Error("The Clark County name columns contain an unclassified row.");
			}
		}
	}
	if (!claims.length || claims.length > 2000 || !tablePages.length || (kind === "newsletter" && !fold(document.find(page => page.number === tablePages[0])!.text).includes(`the${electionDate.slice(0, 4)}generalelection`))) throw new Error("The Clark County candidate document is empty or does not identify its election.");
	return { claims, nonpersonOptions, tablePages };
}

export function reconcileClarkCandidateTables(candidate: unknown, newsletter: unknown, electionDate: string) {
	const first = readClarkCandidateTables(candidate, electionDate, "candidate-table");
	const second = readClarkCandidateTables(newsletter, electionDate, "newsletter");
	if (first.claims.length !== second.claims.length || first.nonpersonOptions.length !== second.nonpersonOptions.length) throw new Error("The Clark County independent publications disagree on their complete counts.");
	for (const [index, claim] of first.claims.entries()) {
		const other = second.claims[index]!;
		for (const key of ["firstName", "lastName", "partyCode", "term", "section", "localSection"] as const) {
			if (fold(claim[key] ?? "") !== fold(other[key] ?? "")) throw new Error("The Clark County independent publications disagree on a candidate field.");
		}
		if (fold(claim.officeParts.join(" ")) !== fold(other.officeParts.join(" "))) throw new Error("The Clark County independent publications disagree on a candidate office.");
	}
	for (const [index, option] of first.nonpersonOptions.entries()) {
		if (fold(option.officeParts.join(" ")) !== fold(second.nonpersonOptions[index]!.officeParts.join(" "))) throw new Error("The Clark County independent publications disagree on a nonperson option.");
	}
	return { claims: first.claims, supportingClaims: second.claims, nonpersonOptions: first.nonpersonOptions, tablePages: [first.tablePages, second.tablePages] };
}
