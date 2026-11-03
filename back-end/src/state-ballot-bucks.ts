import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateBallotTablePage } from "./state-ballot-pdf-grid.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

export const bucksOrigin = "https://www.buckscounty.gov";
export const bucksIndexUrl = `${bucksOrigin}/1221/Running-For-Office`;
export const bucksNoticeUrl = `${bucksOrigin}/2136/Official-Notice-for-Military-and-Oversea`;
export const bucksHash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");
export const bucksExact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const close = (first: number, second: number) => Math.abs(first - second) <= 1;
type Cell = StateBallotTablePage["cells"][number];

export function bucksReject(): never {
	throw new Error("The Bucks County publication, election or policy requires review.");
}

export function validBucksDate(value: string) {
	return /^20\d{2}-11-0[2-8]$/u.test(value) && value >= "2026-11-03" && Number(value.slice(0, 4)) % 2 === 0 && new Date(`${value}T00:00:00Z`).getUTCDay() === 2;
}

export function bucksSource(electionDate: string): StateBallotSource {
	return { stateCode: "PA", id: electionDate === "2026-11-03" ? "pa-bucks-2026" : `pa-bucks-general-${electionDate}`, label: "Bucks County candidate listing", electionDate, url: bucksIndexUrl, pageUrl: bucksIndexUrl, format: "bucks-pdf", countyName: "Bucks County", defaultPriority: -20, snapshotStorage: "external", ballotPreview: false, withheldDistrictScopes: ["congressional", "state-senate", "state-house"] };
}

export function validateBucksSource(source: StateBallotSource) {
	const expected = bucksSource(source.electionDate);
	if (!validBucksDate(source.electionDate) || !bucksExact(source, Object.keys(expected)) || Object.entries(expected).some(([key, value]) => JSON.stringify(source[key as keyof StateBallotSource]) !== JSON.stringify(value))) return bucksReject();
}

export function validateBucksDocumentUrl(value: string, electionDate: string, offeredUrl?: string) {
	const url = new URL(value);
	const short = /^\/DocumentCenter\/View\/(\d{1,10})$/u.exec(url.pathname);
	const named = new RegExp(`^/DocumentCenter/View/(\\d{1,10})/${electionDate.slice(0, 4)}-General-Election---(?:Official|Unofficial)-Candidate-Listing---UPD-\\d{2}-\\d{2}-${electionDate.slice(0, 4)}$`, "u").exec(url.pathname);
	if (url.href !== value || url.origin !== bucksOrigin || url.username || url.password || url.hash || !["", "?bidId="].includes(url.search) || (!short && !named)) return bucksReject();
	if (offeredUrl) {
		validateBucksDocumentUrl(offeredUrl, electionDate);
		const offered = new URL(offeredUrl);
		if (value !== offeredUrl && (offered.search || offered.pathname !== `/DocumentCenter/View/${(short ?? named)![1]}`)) return bucksReject();
	}
}

function tablePages(value: unknown): StateBallotTablePage[] {
	if (!Array.isArray(value) || !value.length || value.length > 20 || Buffer.byteLength(JSON.stringify(value)) > 4 * 1024 * 1024) return bucksReject();
	for (const [index, page] of value.entries()) {
		if (!bucksExact(page, ["number", "width", "height", "text", "cells"]) || page.number !== index + 1 || page.width !== 1008 || page.height !== 612 || typeof page.text !== "string" || page.text.length > 100000 || !Array.isArray(page.cells) || page.cells.length < 10 || page.cells.length > 500) return bucksReject();
		for (const cell of page.cells) {
			if (!bucksExact(cell, ["bounds", "text", "logicalText"]) || !Array.isArray(cell.bounds) || cell.bounds.length !== 4 || cell.bounds.some((coordinate: unknown) => typeof coordinate !== "number" || !Number.isFinite(coordinate) || coordinate < 0) || cell.bounds[0] >= cell.bounds[2] || cell.bounds[1] >= cell.bounds[3] || cell.bounds[2] > page.width || cell.bounds[3] > page.height || typeof cell.text !== "string" || typeof cell.logicalText !== "string" || cell.text.length > 3000 || clean(cell.text) !== clean(cell.logicalText)) return bucksReject();
		}
		const tokens = (body: string) => clean(body).split(" ").filter(Boolean).sort().join(" ");
		if (tokens(page.text) !== tokens(page.cells.map(cell => cell.logicalText).join(" "))) return bucksReject();
	}
	return value as StateBallotTablePage[];
}

function officeFields(label: string): { office: string; scope: StateCandidateValues["scope"]; district?: string; ticket?: true } {
	if (label === "Pennsylvania Governor and Lieutenant Governor - 4 Year Term (Vote for 1)") return { office: "Governor / Lieutenant Governor", scope: "statewide", ticket: true };
	const match = /^(\d{1,3})(?:st|nd|rd|th) (Congressional|Senatorial|Legislative) District - (Representative in U\.S\. Congress|Senator in the General Assembly|Representative in the General Assembly) - ([24]) Year Term \(Vote for 1\)$/u.exec(label);
	if (!match || Number(match[1]) < 1 || Number(match[1]) > 203) return bucksReject();
	const district = String(Number(match[1]));
	if (match[2] === "Congressional" && match[3] === "Representative in U.S. Congress" && match[4] === "2") return { office: "U.S. Representative", scope: "congressional", district };
	if (match[2] === "Senatorial" && match[3] === "Senator in the General Assembly" && match[4] === "4") return { office: "State Senator", scope: "state-senate", district };
	if (match[2] === "Legislative" && match[3] === "Representative in the General Assembly" && match[4] === "2") return { office: "State Representative", scope: "state-house", district };
	return bucksReject();
}

export function readBucksCandidateTables(value: unknown) {
	const pages = tablePages(value);
	const headings = ["Election:", "Vote for:", "Candidate's Name:", "Political Party:"].map(label => pages[0]!.cells.filter(cell => clean(cell.text) === label));
	if (headings.some(matches => matches.length !== 1)) return bucksReject();
	const header = headings.map(matches => matches[0]!);
	if (header.some((cell, index) => !close(cell.bounds[1], header[0]!.bounds[1]) || !close(cell.bounds[3], header[0]!.bounds[3]) || (index > 0 && !close(cell.bounds[0], header[index - 1]!.bounds[2])))) return bucksReject();
	const claims: StateCandidateValues[] = [];
	const offices = new Set<string>();
	const names = new Set<string>();
	let namedPeople = 0;
	let jointTickets = 0;
	for (const page of pages) {
		const used = new Set<Cell>(page.number === 1 ? header : []);
		const columns = header.map(column => page.cells.filter(cell => close(cell.bounds[0], column.bounds[0]) && close(cell.bounds[2], column.bounds[2]) && cell.bounds[1] >= header[0]!.bounds[3] - 1));
		for (const officeCell of columns[0]!.filter(cell => clean(cell.text))) {
			const label = clean(officeCell.text);
			const fields = officeFields(label);
			const key = `${fields.scope}:${fields.office}:${fields.district ?? ""}`;
			if (offices.has(key)) return bucksReject();
			offices.add(key);
			used.add(officeCell);
			const inside = (cell: Cell) => cell.bounds[1] >= officeCell.bounds[1] - 1 && cell.bounds[3] <= officeCell.bounds[3] + 1;
			const votes = columns[1]!.filter(cell => inside(cell) && clean(cell.text));
			if (!votes.length || votes.some(cell => clean(cell.text) !== (fields.ticket ? "Vote for the Candidates of One Party for Governor and Lieutenant Governor" : "Vote for One"))) return bucksReject();
			votes.forEach(cell => used.add(cell));
			const rows = columns[2]!.filter(cell => inside(cell) && clean(cell.text)).sort((first, second) => first.bounds[1] - second.bounds[1]);
			if (!rows.length || rows.length > 20 || (fields.ticket && rows.length % 2)) return bucksReject();
			const candidates = rows.map((row) => {
				const parties = columns[3]!.filter(cell => close(cell.bounds[1], row.bounds[1]) && close(cell.bounds[3], row.bounds[3]));
				if (parties.length !== 1 || !/^\p{L}[\p{L} .'-]{0,79}$/u.test(clean(parties[0]!.text)) || !votes.some(cell => row.bounds[1] >= cell.bounds[1] - 1 && row.bounds[3] <= cell.bounds[3] + 1)) return bucksReject();
				const name = clean(row.text);
				if (name.length > 150 || !/^\p{L}[\p{L}\p{M} .,'’()-]+$/u.test(name) || names.has(`${key}:${name}`)) return bucksReject();
				names.add(`${key}:${name}`);
				used.add(row);
				used.add(parties[0]!);
				return { name, party: clean(parties[0]!.text) };
			});
			namedPeople += candidates.length;
			if (fields.ticket) {
				for (let index = 0; index < candidates.length; index += 2) {
					const governor = candidates[index]!;
					const lieutenant = candidates[index + 1]!;
					if (!governor.name.endsWith(", For Governor") || !lieutenant.name.endsWith(", For Lieutenant Governor") || governor.party !== lieutenant.party) return bucksReject();
					claims.push({ name: `${governor.name.replace(/, For Governor$/u, "")} / ${lieutenant.name.replace(/, For Lieutenant Governor$/u, "")}`, party: governor.party, office: fields.office, scope: fields.scope, status: "listed" });
					jointTickets++;
				}
			}
			else {
				for (const candidate of candidates) claims.push({ ...candidate, office: fields.office, district: fields.district, scope: fields.scope, status: "listed" });
			}
		}
		if (page.cells.some(cell => clean(cell.text) && !used.has(cell))) return bucksReject();
	}
	if (!claims.length || claims.length > 500) return bucksReject();
	return { claims, namedPeople, jointTickets, offices: offices.size };
}
