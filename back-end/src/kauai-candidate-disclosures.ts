import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";

export const kauaiEthicsIndexUrl = "https://www.kauai.gov/Government/Boards-and-Commissions/Board-of-Ethics";
export const kauaiDisclosurePdfProfile = Object.freeze({ maximumPages: 100, maximumPdfBytes: 12 * 1024 * 1024, maximumTextBytes: 4 * 1024 * 1024 });
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const clean = (value: string) => value.normalize("NFC").replace(/\s+/gu, " ").trim();
export const kauaiDisclosureHash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
function reject(): never {
	throw new Error("Kauai candidate disclosure evidence requires review.");
}

function date(year: number, month: number, day: number) {
	const value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
	if (year < 2000 || year > 2099 || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) return reject();
	return value;
}

export function kauaiDisclosurePublication(value: string) {
	const url = new URL(value);
	const match = /^\/files\/assets\/public\/v\/\d{1,2}\/boards-and-commissions\/board-of-ethics\/(20\d{2})_(\d{2})(\d{2})_boe-agenda-packet\.pdf$/iu.exec(url.pathname);
	if (!match || url.href !== value || url.origin !== "https://www.kauai.gov" || url.username || url.password || url.search || url.hash || url.port) return reject();
	return { url: value, meetingDate: date(Number(match[1]), Number(match[2]), Number(match[3])) };
}

export function readKauaiDisclosureIndex(body: string, publicationUrl: string) {
	if (Buffer.byteLength(body) > 3 * 1024 * 1024) return reject();
	const publication = kauaiDisclosurePublication(publicationUrl);
	const regions = descendants(parseStateHtml(body), node => attribute(node, "id") === "main-content");
	if (regions.length !== 1) return reject();
	const offered = descendants(regions[0]!, node => node.nodeName === "a").flatMap((node) => {
		const label = clean(stateHtmlText(node));
		const match = /^BOE_(20\d{2})_(\d{2})(\d{2})_Notice Agenda Packet(?: \(PDF, [\d.]+[KMG]B\))?$/u.exec(label);
		if (!match) return [];
		const url = new URL(attribute(node, "href"), kauaiEthicsIndexUrl);
		if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash || url.href.length > 2048) return reject();
		return [{ label, url: url.href, meetingDate: date(Number(match[1]), Number(match[2]), Number(match[3])) }];
	});
	const matches = offered.filter(item => item.url === publication.url);
	if (offered.length > 100 || matches.length !== 1 || matches[0]!.meetingDate !== publication.meetingDate) return reject();
	return { publication, newerOfferedPublications: offered.filter(item => item.meetingDate > publication.meetingDate) };
}

export interface KauaiDisclosureRecord {
	id: string;
	name: string;
	office: "Mayor" | "County Council";
	disclosureReceived: string;
	disclosureUpdated: string | null;
	sourcePage: number;
}

function receivedDate(value: string, year: number, reportDate: string) {
	const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/u.exec(value);
	if (!match || Number(match[3]) !== year % 100) return reject();
	const received = date(year, Number(match[1]), Number(match[2]));
	if (received > reportDate) return reject();
	return received;
}

export function readKauaiCandidateDisclosures(text: string, packetMeetingDate: string) {
	if (Buffer.byteLength(text) > kauaiDisclosurePdfProfile.maximumTextBytes) return reject();
	const pages = text.split("\f");
	if (!pages.at(-1)?.trim()) pages.pop();
	if (!pages.length || pages.length > kauaiDisclosurePdfProfile.maximumPages) return reject();
	const packet = /^(20\d{2})-(\d{2})-(\d{2})$/u.exec(packetMeetingDate);
	if (!packet || date(Number(packet[1]), Number(packet[2]), Number(packet[3])) !== packetMeetingDate) return reject();
	const packetLabel = `${months[Number(packet[2]) - 1]} ${Number(packet[3])}, ${packet[1]}`;
	if (!pages.slice(0, 3).some(page => clean(page).includes(packetLabel))) return reject();
	const reports = pages.flatMap((page, index) => {
		if (!/Following is a list of 20\d{2} Candidates/u.test(clean(page))) return [];
		if (/[^\P{Cc}\n\r\t]/u.test(page)) return reject();
		const normalized = clean(page);
		const identifier = /\bBOE (20\d{2})-\d{1,3}\b/u.exec(normalized);
		const heading = /\bDATE: ([A-Za-z]+) (\d{1,2}), (20\d{2}) TO: Board of Ethics FROM: [\p{L} .,'’-]+, Administrative Assistant RE: (20\d{2}) Candidate Disclosure Following is a list of (20\d{2}) Candidates for Mayor and County Council with the dates of disclosure received:/u.exec(normalized);
		if (!identifier || !heading || !normalized.includes("OFFICE OF BOARDS & COMMISSIONS") || new Set([identifier[1], heading[3], heading[4], heading[5], packet[1]]).size !== 1) return reject();
		const year = Number(heading[3]);
		const reportDate = date(year, months.indexOf(heading[1]!) + 1, Number(heading[2]));
		if (reportDate > packetMeetingDate) return reject();
		const lines = page.split(/\r?\n/u).map(clean).filter(Boolean);
		const first = lines.indexOf("Mayoral Candidates:");
		const footer = lines.findIndex(line => line.startsWith("4444 Rice Street, Suite 300"));
		if (first < 0 || footer <= first || footer !== lines.length - 2 || lines.at(-1) !== "An Equal Opportunity Employer") return reject();
		let office: KauaiDisclosureRecord["office"] = "Mayor";
		let council = false;
		const records: KauaiDisclosureRecord[] = [];
		for (const line of lines.slice(first + 1, footer)) {
			if (line === "County Council Candidates:") {
				if (council || !records.length) return reject();
				council = true;
				office = "County Council";
				continue;
			}
			const row = /^(\p{L}[\p{L}\p{M} .,'’‘()\-]{1,100}) [–-] (\d{1,2}\/\d{1,2}\/\d{2})(?:, updated (\d{1,2}\/\d{1,2}\/\d{2}))?$/u.exec(line);
			if (!row || row[1] !== row[1]!.trim()) return reject();
			const name = row[1]!;
			const disclosureReceived = receivedDate(row[2]!, year, reportDate);
			const disclosureUpdated = row[3] ? receivedDate(row[3], year, reportDate) : null;
			if (disclosureUpdated && disclosureUpdated < disclosureReceived) return reject();
			records.push({ id: kauaiDisclosureHash(`HI\nKauai County\n${year}\n${office}\n${name}`).slice(0, 24), name, office, disclosureReceived, disclosureUpdated, sourcePage: index + 1 });
		}
		if (!council || !records.some(record => record.office === "County Council") || records.length > 100 || new Set(records.map(record => record.name)).size !== records.length) return reject();
		return [{ cycleYear: year, reportDate, memoId: identifier[0], records, sourcePage: index + 1 }];
	}).sort((first, second) => second.reportDate.localeCompare(first.reportDate));
	if (!reports.length || reports.filter(report => report.reportDate === reports[0]!.reportDate).length !== 1) return reject();
	return { ...reports[0]!, packetPages: pages.length };
}
