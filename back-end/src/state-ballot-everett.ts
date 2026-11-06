import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { EverettGlyphCatalog } from "./state-ballot-everett-visual.js";
import type { StateCandidateRecord, StateContestScope } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { inspectEverettVisual, parseEverettNativeTree } from "./state-ballot-everett-visual.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, stateHtmlText } from "./state-ballot-html.js";

type EverettClaimScope = StateContestScope | "regional" | "county";
type Factory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;
export interface EverettNativeDocument { url: string; xml: string; svg: string }
export const everettIndexUrl = "https://cityofeverett.com/city-hall/departments/elections-department/";
export const everettDocumentUrls = [
	"https://cityofeverett.com/wp-content/uploads/2026/09/STATE-BALLOT-WD-2-PCT-12A.pdf",
	"https://cityofeverett.com/wp-content/uploads/2026/09/STATE-BALLOT-WD-1PCT-123A-WD-2-PCT-23-WD-3-6.pdf",
	"https://cityofeverett.com/wp-content/uploads/2026/09/STATE-BALLOT-WD-1-PCT-3.pdf",
] as const;

export function everettSource(electionDate: string, documentUrls: readonly string[] = everettDocumentUrls): StateBallotSource {
	assert(/^20\d{2}-\d{2}-\d{2}$/u.test(electionDate));
	assert.equal(new Date(`${electionDate}T00:00:00Z`).toISOString().slice(0, 10), electionDate);
	assert(documentUrls.length > 0 && documentUrls.length <= 20 && new Set(documentUrls).size === documentUrls.length);
	for (const address of documentUrls) {
		const url = new URL(address);
		assert(url.origin === "https://cityofeverett.com" && url.href === address && !url.search && !url.hash && new RegExp(`^/wp-content/uploads/${electionDate.slice(0, 4)}/(?:0[1-9]|1[0-2])/[A-Za-z0-9-]+[.]pdf$`, "u").test(url.pathname));
	}
	return { stateCode: "MA", id: `ma-everett-${electionDate.slice(0, 4)}`, label: "Everett election ballots", electionDate, url: documentUrls[0], pageUrl: everettIndexUrl, format: "reviewed-pdf", retrievalPolicy: "manual-snapshot", snapshotStorage: "external", placeName: "Everett city", documentUrls: [...documentUrls], withheldDistrictScopes: ["state-senate", "state-house"], defaultPriority: -20 };
}

const offices = new Map<string, { office: string; scope: EverettClaimScope; jointTicket?: true }>([
	["SENATOR IN CONGRESS", { office: "Senator in Congress", scope: "statewide" }],
	["GOVERNOR AND LIEUTENANT GOVERNOR", { office: "Governor and Lieutenant Governor", scope: "statewide", jointTicket: true }],
	["ATTORNEY GENERAL", { office: "Attorney General", scope: "statewide" }],
	["SECRETARY OF STATE", { office: "Secretary of State", scope: "statewide" }],
	["TREASURER", { office: "Treasurer", scope: "statewide" }],
	["AUDITOR", { office: "Auditor", scope: "statewide" }],
	["REPRESENTATIVE IN CONGRESS", { office: "Representative in Congress", scope: "congressional" }],
	["COUNCILLOR", { office: "Councillor", scope: "regional" }],
	["SENATOR IN GENERAL COURT", { office: "Senator in General Court", scope: "state-senate" }],
	["REPRESENTATIVE IN GENERAL COURT", { office: "Representative in General Court", scope: "state-house" }],
	["DISTRICT ATTORNEY", { office: "District Attorney", scope: "regional" }],
	["REGISTER OF PROBATE", { office: "Register of Probate", scope: "county" }]
]);

export function readEverettCandidateDocument(body: string, electionDate: string) {
	assert(Buffer.byteLength(body) < 4 * 1024 * 1024);
	assert.match(electionDate, /^20\d{2}-\d{2}-\d{2}$/u);
	const document = parseEverettNativeTree(body);
	const pages = descendants(document, node => node.nodeName === "page");
	assert(pages.length > 0 && pages.length <= 20);
	assert(pages.every((page, index) => attribute(page, "number") === String(index + 1) && attribute(page, "width") === "918" && attribute(page, "height") === "1944"));
	const fonts = new Map(descendants(document, node => node.nodeName === "fontspec").map(node => [attribute(node, "id"), { family: attribute(node, "family"), color: attribute(node, "color"), size: Number(attribute(node, "size")) }]));
	assert(pages.slice(1).every(page => descendants(page, node => node.nodeName === "text").every((node) => {
		const font = fonts.get(attribute(node, "font"));
		return font && !(font.family === "HelveticaLTStd" && font.size === 13) && !offices.has(stateHtmlText(node).replace(/\s+/gu, " ").trim());
	})), "Additional candidate pages require review.");
	const all = descendants(pages[0], node => node.nodeName === "text").map((node) => {
		const font = fonts.get(attribute(node, "font"));
		assert(font);
		const field = { text: stateHtmlText(node).replace(/\s+/gu, " ").trim(), left: Number(attribute(node, "left")), top: Number(attribute(node, "top")), width: Number(attribute(node, "width")), height: Number(attribute(node, "height")), font };
		assert([field.left, field.top, field.width, field.height].every(Number.isFinite));
		assert(field.left >= 0 && field.top >= 0 && field.width >= 0 && field.height > 0 && field.left + field.width <= 919 && field.top + field.height <= 1945);
		return field;
	}).filter(field => field.text);
	const date = new Date(`${electionDate}T00:00:00Z`);
	assert.equal(date.toISOString().slice(0, 10), electionDate);
	const printedDate = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
	const dateFields = all.filter(field => field.font.family.endsWith("+HelveticaNeueLTStd-Bd") && field.font.size === 18 && field.text.startsWith(`${printedDate} / `));
	assert.equal(dateFields.length, 1);
	const city = all.filter(field => field.font.color === "#000000" && field.top < 200 && field.text === "EVERETT");
	assert.equal(city.length, 1);
	const styleFields = all.filter(field => field.font.color === "#000000" && field.top < 250 && /^WDS?\./u.test(field.text)).sort((first, second) => first.top - second.top);
	assert(styleFields.length >= 1 && styleFields.length <= 4);
	const fields = all.filter(field => field.font.color === "#000000" && field.left < 585 && field.top >= 410 && field.top < 1840);
	const headings = fields.filter(field => field.font.family === "HelveticaLTStd" && offices.has(field.text));
	const groups: typeof headings = [];
	for (const heading of [...headings].sort((first, second) => first.left - second.left || first.top - second.top)) {
		const previous = groups.at(-1);
		if (previous && heading.text === previous.text && Math.abs(heading.left - previous.left) < 2 && heading.top - previous.top === 17) continue;
		groups.push(heading);
	}
	assert.equal(groups.length, 12);
	assert.equal(new Set(groups.map(group => group.text)).size, 12);
	const names = fields.filter(field => field.font.family === "HelveticaLTStd" && field.font.size === 13);
	assert(names.length > 0 && names.length <= 100);
	const records = names.map((name) => {
		assert.match(name.text, /^[\p{L}\p{M}][\p{L}\p{M} .,'’&-]{1,179}$/u);
		const heading = groups.filter(group => Math.abs(group.left - name.left) <= 2 && group.top < name.top).sort((first, second) => second.top - first.top)[0];
		assert(heading);
		const properties = offices.get(heading.text)!;
		const districtFields = fields.filter(field => Math.abs(field.left - heading.left) <= 1 && field.top > heading.top && field.top < name.top && /(?:DISTRICT|COUNTY)$/u.test(field.text));
		assert.equal(districtFields.length, properties.scope === "statewide" ? 0 : 1);
		const votes = fields.filter(field => field.top > heading.top && field.top < name.top && Math.floor(field.left / 300) === Math.floor(name.left / 300) && field.text === "Vote for not more than ONE");
		assert.equal(votes.length, 1);
		const partyFields = fields.filter(field => field.font.family === "HelveticaLTStd-LightCond" && field.top >= name.top && field.top <= name.top + 6 && Math.floor(field.left / 300) === Math.floor(name.left / 300) && field.text.includes("/"));
		assert.equal(partyFields.length, 1);
		const partyParts = partyFields[0].text.split("/").map(value => value.trim());
		assert(partyParts.length === 2 && partyParts.every(value => value.length > 0 && value.length <= 100));
		const partyDesignation = partyParts[0];
		assert.match(partyDesignation, /^[A-Za-z][A-Za-z -]{1,99}$/u);
		const reelection = fields.filter(field => Math.floor(field.left / 300) === Math.floor(name.left / 300) && field.top > name.top + 6 && field.top < name.top + 20 && field.text.includes("Candidate for Re-election"));
		assert(reelection.length <= 1);
		return { name: name.text, ...properties, ...(districtFields[0] ? { districtLabel: districtFields[0].text } : {}), partyDesignation, ...(reelection.length ? { incumbent: true } : {}) };
	});
	assert(groups.every(group => records.some(record => record.office === offices.get(group.text)!.office)));
	assert.equal(new Set(records.map(record => JSON.stringify(record))).size, records.length);
	return { pageCount: pages.length, electionDate, styleLabel: ["EVERETT", ...styleFields.map(field => field.text)].join(" "), records };
}

function geography(claim: ReturnType<typeof readEverettCandidateDocument>["records"][number]): Pick<StateCandidateValues, "scope" | "district" | "jurisdiction" | "sourceDistrictLabel"> {
	if (claim.scope === "statewide") return { scope: "statewide", district: "" };
	const label = claim.districtLabel;
	assert(label && label.length <= 100);
	if (claim.scope === "congressional") {
		const names = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "EIGHTH", "NINTH", "TENTH"];
		const district = names.indexOf(label.replace(/ DISTRICT$/u, "")) + 1;
		assert(district > 0 && label.endsWith(" DISTRICT"));
		return { scope: "congressional", district: String(district), sourceDistrictLabel: label };
	}
	if (claim.scope === "state-senate" || claim.scope === "state-house") return { scope: claim.scope, district: label.replace(/ DISTRICT$/u, ""), sourceDistrictLabel: label };
	assert(claim.scope === "regional" || claim.scope === "county");
	return { scope: "local", district: "", jurisdiction: `Massachusetts, ${label}`, sourceDistrictLabel: label };
}

export function validateEverettSource(source: StateBallotSource) {
	const expected = everettSource(source.electionDate, source.documentUrls);
	assert.deepEqual(source, expected, "The Everett source configuration requires review.");
	return expected;
}

export function readEverettCandidateDocuments(source: StateBallotSource, documents: readonly EverettNativeDocument[], factory: Factory, glyphApprovals?: EverettGlyphCatalog) {
	const expected = validateEverettSource(source);
	assert(documents.length === expected.documentUrls!.length && documents.every((document, index) => document.url === expected.documentUrls![index]));
	const records = new Map<string, StateCandidateRecord>();
	const areas = new Map<string, Set<string>>();
	const claims: { record: StateCandidateRecord; documentIndex: number; page: 1; styleLabel: string }[] = [];
	const styles = new Set<string>();
	const pageCounts: number[] = [];
	for (const [documentIndex, document] of documents.entries()) {
		inspectEverettVisual(document.xml, document.svg, glyphApprovals);
		const parsed = readEverettCandidateDocument(document.xml, source.electionDate);
		assert(!styles.has(parsed.styleLabel) && parsed.styleLabel.length <= 250, "Repeated or unbounded Everett ballot style.");
		styles.add(parsed.styleLabel);
		pageCounts.push(parsed.pageCount);
		for (const claim of parsed.records) {
			const candidate = factory(source, { name: claim.name, office: claim.office, party: claim.partyDesignation, ...geography(claim), status: "listed" });
			assert(candidate, "The Everett candidate identity requires review.");
			candidate.sourceStatus = "Sample ballot candidate";
			candidate.voteLimit = 1;
			if (claim.incumbent) candidate.incumbent = true;
			if (claim.jointTicket) candidate.ballotDesignation = "Joint ticket";
			const previous = records.get(candidate.id);
			assert(!previous || JSON.stringify(previous) === JSON.stringify(candidate), "Conflicting Everett candidate facts.");
			if (!previous) records.set(candidate.id, candidate);
			const selected = records.get(candidate.id)!;
			if (!areas.has(candidate.id)) areas.set(candidate.id, new Set());
			areas.get(candidate.id)!.add(parsed.styleLabel);
			claims.push({ record: selected, documentIndex, page: 1, styleLabel: parsed.styleLabel });
		}
	}
	for (const [id, record] of records) {
		const area = [...areas.get(id)!].join("; ");
		assert(area.length <= 300, "The Everett style inventory exceeds its record bounds.");
		record.sourceAreaLabel = area;
	}
	return { records: [...records.values()], claims, pageCounts };
}
