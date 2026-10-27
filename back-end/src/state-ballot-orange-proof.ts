import type { StateHtmlNode } from "./state-ballot-html.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

export interface OrangeProofField { text: string; left: number; top: number; width: number; height: number; font: number }
export interface OrangeProofContest { id: string; heading: string; office: string; districtLabel: string; sharedWith: string; voteFor: number; candidateCount: number; qualifiedCount: number; pages: number[] }
export interface OrangeProofCandidate { id: string; contestId: string; sourceCandidateId: string; name: string; party?: string; ballotDesignation: string; qualifiedDate: string; page: number }
const fontSizes = [18, 12, 16, 10, 11, 11, 13, 13, 21, 12, 12, 11, 10, 13, 13, 10, 11, 9, 10, 12, 12];
const boldFonts = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 13, 15, 17, 19, 20]);
const italicFonts = new Set([0, 1, 2, 9, 11, 20]);
const text = (node: StateHtmlNode) => stateHtmlText(node).replace(/\s+/gu, " ").trim();
function reject(detail: string): never {
	throw new Error(`The Orange County candidate proof ${detail} requires review.`);
}
function one<T>(items: T[], detail: string) {
	if (items.length !== 1) return reject(detail);
	return items[0]!;
}
function civilDate(value: string) {
	const match = /^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/u.exec(value);
	if (!match) return reject("date");
	const date = `${match[3]}-${match[1]!.padStart(2, "0")}-${match[2]!.padStart(2, "0")}`;
	if (!Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) return reject("date");
	return date;
}
function safe(value: string, maximum = 300) {
	if (!value || value.length > maximum || /[<>\\\u200B-\u200F\u202A-\u202E\u2060-\u206F]/u.test(value) || containsControlCharacters(value)) return reject("text");
	return value;
}
export function orangeProofPages(body: string) {
	if (Buffer.byteLength(body) > 8 * 1024 * 1024 || body.includes("\uFFFD") || containsControlCharacters(body.replace(/[\r\n\t]/gu, "")) || !/^<\?xml[^>]+>\s*<!DOCTYPE pdf2xml SYSTEM "pdf2xml.dtd">/u.test(body) || !/<\/pdf2xml>\s*$/u.test(body)) return reject("XML envelope");
	const dom = parseStateHtml(body);
	const pending = [{ node: dom, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const { node, depth } = pending.pop()!;
		if (++visited > 300000 || depth > 32 || !["#document", "#documentType", "#comment", "#text", "html", "head", "body", "pdf2xml", "page", "fontspec", "img", "text", "b", "i"].includes(node.nodeName)) return reject("DOM bounds or markup");
		for (const child of node.childNodes ?? []) pending.push({ node: child, depth: depth + 1 });
	}
	const pages = descendants(dom, node => node.nodeName === "page");
	const fonts = new Map<number, string>();
	if (!pages.length || pages.length > 256) return reject("page bounds");
	return pages.map((page, index) => {
		if (page.attrs?.some(item => !["number", "position", "width", "height", "top", "left"].includes(item.name)) || attribute(page, "number") !== String(index + 1) || attribute(page, "width") !== "1188" || attribute(page, "height") !== "918" || attribute(page, "top") !== "0" || attribute(page, "left") !== "0") return reject("page sequence or geometry");
		for (const node of descendants(page, node => node.nodeName === "fontspec")) {
			const id = Number(attribute(node, "id"));
			const family = attribute(node, "family");
			const color = [1, 13, 14].includes(id) ? "#0000ff" : [3, 4].includes(id) ? "#ffffff" : id === 6 ? "#800000" : "#000000";
			if (String(id) !== attribute(node, "id") || id < 0 || id >= fontSizes.length || fonts.has(id) || node.attrs?.some(item => !["id", "size", "family", "color"].includes(item.name)) || attribute(node, "size") !== String(fontSizes[id]) || !/^[A-Z]{6}\+Arial(?:-Unicode-MS)?$/u.test(family) || family.includes("-Unicode-MS") !== [5, 12].includes(id) || attribute(node, "color") !== color) return reject("font inventory");
			fonts.set(id, family);
		}
		const images = descendants(page, node => node.nodeName === "img");
		if (images.length > Number(index === 0) || images.some(node => node.attrs?.some(item => !["top", "left", "width", "height", "src"].includes(item.name)) || attribute(node, "left") !== "37" || attribute(node, "top") !== "35" || attribute(node, "width") !== "41" || attribute(node, "height") !== "38")) return reject("unexpected image");
		const fields = descendants(page, node => node.nodeName === "text").map((node): OrangeProofField => {
			const font = Number(attribute(node, "font"));
			if (String(font) !== attribute(node, "font") || !fonts.has(font) || ["top", "left", "width", "height"].some(key => !/^\d{1,4}$/u.test(attribute(node, key))) || node.attrs?.some(item => !["top", "left", "width", "height", "font"].includes(item.name)) || descendants(node, child => !["#text", "b", "i"].includes(child.nodeName)).length || descendants(node, child => child.nodeName === "b").length !== Number(boldFonts.has(font)) || descendants(node, child => child.nodeName === "i").length !== Number(italicFonts.has(font))) return reject("text style or visibility");
			const field = { text: text(node), left: Number(attribute(node, "left")), top: Number(attribute(node, "top")), width: Number(attribute(node, "width")), height: Number(attribute(node, "height")), font };
			if ([field.left, field.top, field.width, field.height].some(value => !Number.isFinite(value)) || field.left < 0 || field.top < 0 || field.width < 0 || field.height <= 0 || field.left + field.width > 1190 || field.top + field.height > 920 || field.text.length > 1800) return reject("text geometry");
			if (field.text) safe(field.text, 1800);
			return field;
		}).filter(field => field.text).sort((first, second) => first.top - second.top || first.left - second.left);
		if (!fields.length || fields.length > 2500) return reject("field bounds");
		if (index === pages.length - 1) {
			if (fonts.size !== fontSizes.length || new Set(fonts.values()).size !== 5) return reject("incomplete font inventory");
			for (const group of [[0, 1, 2, 20], [3, 4, 6, 7, 8, 13, 15, 17, 19], [5, 12], [9, 11], [10, 14, 16, 18]]) {
				if (group.some(id => fonts.get(id) !== fonts.get(group[0]!))) return reject("font role mapping");
			}
		}
		return fields;
	});
}
export function readOrangeCandidateProof(body: string, electionDate: string) {
	if (!/^20\d{2}-\d{2}-\d{2}$/u.test(electionDate) || !Number.isFinite(Date.parse(electionDate)) || new Date(electionDate).toISOString().slice(0, 10) !== electionDate) return reject("election context");
	const pages = orangeProofPages(body);
	const first = pages[0]!;
	if (one(first.filter(field => field.font === 0), "title").text !== "Contest/Candidate Proof List" || civilDate(one(first.filter(field => field.font === 2), "election title").text.replace(/^General Election - /u, "")) !== electionDate || one(first.filter(field => field.font === 1 && field.text.startsWith("Candidates:")), "candidate scope").text !== "Candidates: Qualified Candidates" || one(first.filter(field => field.font === 1 && field.text.startsWith("Contests:")), "contest scope").text !== "Contests: 1020 to 6400 - Contests On Ballot" || one(first.filter(field => field.font === 1 && field.text.startsWith("Candidates are")), "candidate order").text !== "Candidates are in Random Alpha Order") return reject("report identity");
	const contests = new Map<string, OrangeProofContest>();
	const candidates: OrangeProofCandidate[] = [];
	const printedClocks: { page: number; date: string; time: string }[] = [];
	let currentContest: OrangeProofContest | undefined;
	let currentCandidate: Partial<OrangeProofCandidate> | undefined;
	let lastContestId = "";
	const completeCandidate = () => {
		if (!currentCandidate) return;
		if (!currentCandidate.name || !currentCandidate.ballotDesignation || !currentCandidate.qualifiedDate || !currentCandidate.sourceCandidateId || !currentCandidate.contestId || !currentCandidate.page || !currentContest || currentCandidate.contestId !== currentContest.id || currentContest.heading.startsWith("Voter Nominated ") !== Boolean(currentCandidate.party)) return reject("candidate fields");
		const id = createHash("sha256").update(JSON.stringify([electionDate, currentCandidate.contestId, currentCandidate.sourceCandidateId, currentCandidate.name, currentCandidate.party ?? ""])).digest("hex").slice(0, 24);
		candidates.push({ ...currentCandidate, id } as OrangeProofCandidate);
		currentCandidate = undefined;
	};
	for (const [pageIndex, fields] of pages.entries()) {
		const page = pageIndex + 1;
		const consumed = new Set<OrangeProofField>();
		const columns = ["Contest/District", "Vote For", "Status", "Num", "Qualified", "Num", "Cands", "Distict ID/Name"].sort();
		if (fields.filter(field => [3, 4].includes(field.font)).map(field => field.text).sort().join("|") !== columns.join("|") || (pageIndex > 0 && fields.some(field => [0, 1, 2].includes(field.font))) || (pageIndex === 0 && fields.filter(field => field.font === 1).length !== 3)) return reject("column or header inventory");
		if (one(fields.filter(field => field.font === 18 && field.text.startsWith("CFMR001")), "report footer").text !== "CFMR001 - Contest/Candidate Proof List" || one(fields.filter(field => /^Page \d+ of \d+$/u.test(field.text)), "page footer").text !== `Page ${page} of ${pages.length}`) return reject("page footer");
		const clock = /^Print Date and Time: (\d{1,2}\/\d{1,2}\/20\d{2}) (\d{1,2}):(\d{2}):(\d{2})(AM|PM)$/u.exec(one(fields.filter(field => field.font === 18 && field.text.startsWith("Print Date")), "printed clock").text);
		if (!clock || Number(clock[2]) < 1 || Number(clock[2]) > 12 || Number(clock[3]) > 59 || Number(clock[4]) > 59) return reject("printed clock");
		printedClocks.push({ page, date: civilDate(clock[1]!), time: `${String(Number(clock[2]) % 12 + (clock[5] === "PM" ? 12 : 0)).padStart(2, "0")}:${clock[3]}:${clock[4]}` });
		const identifiers = fields.filter(field => field.font === 7 && field.left === 56 && /^\d{4}$/u.test(field.text));
		if (!identifiers.length) return reject("contest inventory");
		const occurrence = new Map<OrangeProofField, OrangeProofContest>();
		for (const identifier of identifiers) {
			if (lastContestId && Number(identifier.text) < Number(lastContestId)) return reject("contest sequence");
			lastContestId = identifier.text;
			const heading = one(fields.filter(field => field.font === 5 && field.left === 28 && identifier.top - field.top >= 18 && identifier.top - field.top <= 24), "contest heading");
			const office = one(fields.filter(field => field.font === 7 && field.left === 102 && Math.abs(field.top - identifier.top) <= 1), "office");
			const metadata = fields.filter(field => field.font === 7 && field.top - identifier.top >= 16 && field.top - identifier.top <= 21);
			const numberAt = (minimum: number, maximum: number) => {
				const field = one(metadata.filter(field => field.left >= minimum && field.left < maximum), "contest counts");
				if (!/^\d{1,2}$/u.test(field.text) || Number(field.text) < 1 || Number(field.text) > 40) return reject("contest counts");
				consumed.add(field);
				return Number(field.text);
			};
			const voteFor = numberAt(835, 870);
			const candidateCount = numberAt(890, 940);
			const qualifiedCount = numberAt(950, 990);
			if (qualifiedCount > candidateCount) return reject("qualification counts");
			const status = one(fields.filter(field => field.font === 6 && field.left === 1008 && field.top - identifier.top >= 16 && field.top - identifier.top <= 21), "ballot status");
			if (status.text !== "ON BALLOT" || !/^(?:Voter Nominated|Nonpartisan) /u.test(heading.text)) return reject("ballot status or category");
			const labels = fields.filter(field => field.font === 7 && field.left === 502 && field.top - identifier.top >= 16 && field.top - identifier.top <= 48);
			const districtLabel = labels.map(field => field.text).join(" ");
			const shared = fields.filter(field => field.font === 9 && field.text === "Shared with:" && field.top > identifier.top && field.top < identifier.top + 90);
			if (shared.length > 1) return reject("shared jurisdiction label");
			const sharedWith = shared.length ? one(fields.filter(field => field.font === 10 && field.left === 168 && Math.abs(field.top - shared[0]!.top) <= 1), "shared jurisdiction").text : "";
			let contest = contests.get(identifier.text);
			if (!contest) {
				if (!districtLabel || (!sharedWith && identifier.top < 800)) return reject("missing initial geography");
				contest = { id: identifier.text, heading: safe(heading.text), office: safe(office.text), districtLabel: safe(districtLabel), sharedWith: sharedWith ? safe(sharedWith) : "", voteFor, candidateCount, qualifiedCount, pages: [] };
				contests.set(contest.id, contest);
			}
			else if (contest.heading !== heading.text || contest.office !== office.text || (districtLabel && contest.districtLabel !== districtLabel) || (sharedWith && contest.sharedWith && contest.sharedWith !== sharedWith) || contest.voteFor !== voteFor || contest.candidateCount !== candidateCount || contest.qualifiedCount !== qualifiedCount) {
				return reject("contradictory continuation");
			}
			if (sharedWith && !contest.sharedWith) contest.sharedWith = safe(sharedWith);
			if (!contest.pages.includes(page)) contest.pages.push(page);
			occurrence.set(identifier, contest);
			for (const field of [heading, office, identifier, status, ...labels]) consumed.add(field);
		}
		for (const field of fields) {
			const contest = occurrence.get(field);
			if (contest) {
				if (currentContest && currentContest.id !== contest.id) completeCandidate();
				currentContest = contest;
			}
			if (field.font === 13) {
				completeCandidate();
				if (!currentContest?.sharedWith || field.left !== 167 || !/\p{L}/u.test(field.text)) return reject("candidate identity");
				currentCandidate = { contestId: currentContest.id, name: safe(field.text, 250), page };
				const parties = fields.filter(item => item.font === 14 && Math.abs(item.top - field.top) <= 1);
				if (parties.length > 1 || parties.some(item => ![", Republican", ", Democratic", ", Green"].includes(item.text) || item.left < field.left + field.width - 1 || item.left > field.left + field.width + 3)) return reject("party label");
				if (parties.length) {
					currentCandidate.party = parties[0]!.text.slice(2);
					consumed.add(parties[0]!);
				}
			}
			if (field.font === 12) {
				if (!currentCandidate || currentCandidate.ballotDesignation || field.left !== 167) return reject("ballot designation");
				currentCandidate.ballotDesignation = safe(field.text);
			}
			if (field.font === 15) {
				if (!currentCandidate || currentCandidate.qualifiedDate || field.left !== 1094) return reject("qualification date");
				one(fields.filter(item => item.font === 11 && item.text === "Qualified Date:" && item.left === 1013 && Math.abs(item.top - field.top) <= 1), "qualification label");
				currentCandidate.qualifiedDate = civilDate(field.text);
				if (currentCandidate.qualifiedDate > electionDate) return reject("qualification date");
			}
			if (field.font === 16 && field.left === 1092) {
				if (!currentCandidate || currentCandidate.sourceCandidateId || !/^[1-9]\d{0,2}$/u.test(field.text)) return reject("candidate source identifier");
				one(fields.filter(item => item.font === 11 && item.text === "Cand ID:" && item.left === 1042 && Math.abs(item.top - field.top) <= 1), "candidate identifier label");
				currentCandidate.sourceCandidateId = field.text;
			}
		}
		if (fields.some(field => [5, 6, 7, 14].includes(field.font) && !consumed.has(field))) return reject("unassigned contest or party text");
	}
	completeCandidate();
	const last = pages.at(-1)!;
	const total = (label: string, left: number) => {
		const caption = one(last.filter(field => field.font === 20 && field.text === label), "report totals");
		const value = one(last.filter(field => field.font === 19 && field.left === left && Math.abs(field.top - caption.top) <= 1), "report totals");
		if (!/^\d{1,4}$/u.test(value.text)) return reject("report totals");
		return Number(value.text);
	};
	if (total("Total Contests:", 139) !== contests.size || total("Total Candidates Filed:", 187) !== candidates.length || new Set(candidates.map(candidate => `${candidate.contestId}:${candidate.sourceCandidateId}`)).size !== candidates.length || new Set(candidates.map(candidate => candidate.id)).size !== candidates.length) return reject("complete inventory");
	for (const contest of contests.values()) {
		if (!contest.sharedWith || candidates.filter(candidate => candidate.contestId === contest.id).length !== contest.qualifiedCount) return reject("contest candidate inventory");
	}
	return { electionDate, pages: pages.length, contests: [...contests.values()], candidates, printedClocks, sourceStatus: "Qualified Candidates" as const, nativeVerificationRequired: true as const };
}
