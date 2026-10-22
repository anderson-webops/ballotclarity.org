import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateCandidateRecord, StateContestScope } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";

export const oregonBallotDocuments = [
	{ url: "https://multco.us/file/ballot_directive_-_november_3%2C_2026_general/download", pageCount: 18, firstPage: 6, lastPage: 18 },
	{ url: "https://multco.us/file/ballot_content_-_nov._2026/download", pageCount: 15, firstPage: 1, lastPage: 9 },
	{ url: "https://multco.us/file/ballot_content_rcv_-_nov._2026/download", pageCount: 2, firstPage: 1, lastPage: 2 },
] as const;

interface Candidate {
	name: string;
	party: string;
	ballotDesignation?: string;
}

export interface OregonBallotClaim extends Candidate {
	documentIndex: number;
	page: number;
	office: string;
	scope: StateContestScope;
	district: string;
	jurisdiction?: string;
	sourceOfficeLabel: string;
	sourceJurisdictionLabel?: string;
}

const parties = new Set(["Democrat", "Republican", "Working Families", "Libertarian", "Independent", "Progressive", "Pacific Green"]);
const localGroups = new Set(["City of Lake Oswego", "City of Fairview", "City of Gresham", "City of Maywood Park", "City of Troutdale", "City of Wood Village", "East Multnomah Soil and Water", "West Multnomah Soil and Water", "Columbia River PUD, Subdivision 1", "Interlachen Water People's Utility", "Rockwood Water People's Utility", "Multnomah County", "City of Portland", "City of Portland, Councilor, District 3", "City of Portland, Councilor, District 4"]);

function requireValue(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(`The Oregon ballot ${message}.`);
}

function clean(value: string) {
	return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function object(value: unknown, keys: readonly string[]) {
	requireValue(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key)), "object has unexpected fields");
	return value as Record<string, unknown>;
}

function geography(printedOffice: string, group?: string): Pick<OregonBallotClaim, "office" | "scope" | "district" | "jurisdiction"> {
	const office = printedOffice.replace(/At- Large/gu, "At-Large");
	const national = office.match(/^US Representative, (\d+)(?:st|nd|rd|th) District$/u);
	if (national) {
		requireValue(Number(national[1]) >= 1 && Number(national[1]) <= 6, "congressional district has changed");
		requireValue(!group || group === office.replace(",", ""), "congressional office contradicts its county report area");
		return { office: "US Representative", scope: "congressional", district: national[1]! };
	}
	const legislative = office.match(/^State (Senator|Representative), (\d+)(?:st|nd|rd|th) District$/u);
	if (legislative) {
		requireValue(Number(legislative[2]) >= 1 && Number(legislative[2]) <= (legislative[1] === "Senator" ? 30 : 60), "legislative district has changed");
		requireValue(!group || group === `${legislative[1] === "Senator" ? "Senate" : "House"} District ${legislative[2]}`, "legislative office contradicts its county report area");
		return { office: `State ${legislative[1]}`, scope: legislative[1] === "Senator" ? "state-senate" : "state-house", district: legislative[2]! };
	}
	if (["US Senator", "Governor"].includes(office)) return { office, scope: "statewide", district: "" };
	const court = office.match(/^Judge of the Circuit Court, (\d+)(?:st|nd|rd|th) District, Position (\d+)$/u);
	if (court) {
		requireValue(Number(court[1]) >= 1 && Number(court[1]) <= 99 && Number(court[2]) >= 1 && Number(court[2]) <= 99, "court district or position has changed");
		requireValue(!group || group === `Circuit Court District ${court[1]!.padStart(2, "0")}`, "court office contradicts its county report area");
		return { office: `Judge of the Circuit Court, District ${court[1]}, Position ${court[2]}`, scope: "local", district: court[1]!, jurisdiction: `Oregon Circuit Court District ${court[1]}` };
	}
	const attorney = office.match(/^District Attorney, (Curry|Jefferson|Lake) County$/u);
	if (attorney) return { office, scope: "local", district: "", jurisdiction: `${attorney[1]} County` };
	requireValue(group && localGroups.has(group), "local office has no recognized jurisdiction");
	if (group.startsWith("City of ")) requireValue(office.startsWith(`${group.replace(/, Councilor, District \d+$/u, "")}, `), "city office does not match its jurisdiction");
	else requireValue(office.startsWith(group.split(",")[0]!), "local office does not match its jurisdiction");
	const jurisdiction = office.includes(", Director,") ? office.split(", Director,")[0]! : group.replace(/, Councilor, District \d+$/u, "");
	return { office, scope: "local", district: "", jurisdiction };
}

function readDocuments(body: string) {
	requireValue(new TextEncoder().encode(body).length <= 1024 * 1024, "extraction exceeds its size limit");
	const payload = object(JSON.parse(body), ["documents"]);
	requireValue(Array.isArray(payload.documents) && payload.documents.length === 3, "document set is incomplete");
	return payload.documents.map((value: unknown, index: number) => {
		const document = object(value, ["url", "pageCount", "electionHeader", "pages"]);
		const configured = oregonBallotDocuments[index]!;
		requireValue(document.url === configured.url && document.pageCount === configured.pageCount && Array.isArray(document.pages) && document.pages.length === configured.lastPage - configured.firstPage + 1, "document identity or candidate-page set has changed");
		if (index === 0) requireValue(document.electionHeader === "SUBJECT: Official Ballot Statement for the General Election on November 3, 2026", "directive does not identify the configured election");
		else requireValue(document.electionHeader === undefined, "county document has unexpected directive metadata");
		return document.pages.map((value: unknown, offset: number) => {
			const page = object(value, ["number", "text"]);
			const number = configured.firstPage + offset;
			requireValue(page.number === number && typeof page.text === "string" && page.text.length > 200 && page.text.length < 12000, "candidate page is missing or invalid");
			const text = page.text.normalize("NFKC");
			if (index === 0) requireValue(text.includes("Candidate Ballot Statement") && text.includes("2026 General Election") && text.includes("September 3, 2026") && new RegExp(`Page ${number} of 18\\s*$`, "u").test(text), "statement page header or date has changed");
			else requireValue(text.includes("County: MULTNOMAH") && text.includes(`Election : 11/03/2026 - November ${index === 1 ? "General" : "RCV"} Election 2026`) && text.includes(`9/22/2026 ${index === 1 ? "12:56:05" : "12:58:43"} PM`) && new RegExp(`Oregon Centralized Voter Registration\\s+Page\\s*:\\s*${number}\\s*$`, "u").test(text) && !text.includes("Measure No:"), "county report identity, page number or date has changed");
			return { number, text };
		});
	});
}

export function extractOregonBallots(body: string) {
	const documents = readDocuments(body);
	const claims: OregonBallotClaim[] = [];
	const contests: Array<{ documentIndex: number; page: number; office: string; count: number }> = [];
	function emit(office: string, candidates: Candidate[], documentIndex: number, page: number, group?: string, count = candidates.length) {
		requireValue(office && candidates.length > 0 && candidates.length === count && count <= 100, "candidate count does not match its printed contest");
		const area = geography(office, group);
		requireValue(new Set(candidates.map(candidate => candidate.name)).size === candidates.length, "contest repeats a candidate");
		for (const candidate of candidates) {
			const party = clean(candidate.party);
			requireValue(candidate.name.length <= 250 && /\p{L}/u.test(candidate.name) && !/^(?:no candidate filed|write.?in)$/iu.test(candidate.name) && (!party || party.split(", ").every(party => parties.has(party))), "candidate name or party is invalid");
			requireValue(area.scope === "local" ? !party : party, "party does not match the contest type");
			requireValue(!candidate.ballotDesignation || area.office.startsWith("Judge of the Circuit Court,"), "incumbent designation is outside a judicial contest");
			claims.push({ documentIndex, page, sourceOfficeLabel: office, sourceJurisdictionLabel: group, ...area, ...candidate, party });
		}
		contests.push({ documentIndex, page, office, count });
	}
	for (const [documentIndex, pages] of documents.entries()) {
		let office = "";
		let candidates: Candidate[] = [];
		let group = "";
		let firstPage = 0;
		let groupContests = 0;
		for (const page of pages) {
			for (const line of page.text.split("\n")) {
				const text = clean(line);
				if (!text) continue;
				if (documentIndex === 0) {
					if (/^(?:Secretary of State Elections Division|255 Capitol St|Candidate Ballot Statement|2026 General Election|September 3, 2026|Page \d+ of 18)/u.test(text)) continue;
					const heading = line.trim().split(/\s{2,}/u);
					if (heading.length === 2 && heading[1] === "Vote for one") {
						if (office) emit(office, candidates, documentIndex, firstPage);
						office = clean(heading[0]!);
						candidates = [];
						firstPage = page.number;
						continue;
					}
					requireValue(office, "named statement row has no office");
					const [name, party = "", ...extra] = line.trim().split(/\s{2,}/u);
					requireValue(!extra.length, "statement candidate columns have changed");
					candidates.push({ name: clean(name!), party: party === "Incumbent" ? "" : party, ballotDesignation: party === "Incumbent" ? "Incumbent" : undefined });
					continue;
				}
				if (/^(?:County: MULTNOMAH|Ballot Content(?: RCV)? Date : 9\/22\/2026 \d{1,2}:\d{2}:\d{2} PM|Report No\. : E-019|Election : 11\/03\/2026 - November (?:General|RCV) Election 2026|Oregon Centralized Voter Registration Page : \d+|Federal Offices|Partisan State Offices|Nonpartisan State Offices|City Offices|District Offices|County Offices)$/u.test(text) || text === ":") continue;
				const count = text.match(/^Number Candidates Filed:\s*(\d+)$/u);
				if (count) {
					emit(office, candidates, documentIndex, firstPage, group, Number(count[1]));
					office = "";
					candidates = [];
					groupContests += 1;
					continue;
				}
				const total = text.match(/^Contest Total:\s*(\d+)$/u);
				if (total) {
					requireValue(groupContests === Number(total[1]), "county group contest count has changed");
					groupContests = 0;
					continue;
				}
				const indent = line.match(/^ */u)![0].length;
				if (indent === 3) {
					requireValue(!office, "jurisdiction starts inside another contest");
					group = text;
					requireValue(localGroups.has(group) || /^(?:Federal|Statewide Partisan|US Representative [135](?:st|rd|th) District|Senate District \d+|House District \d+|Circuit Court District 04)$/u.test(group), "county jurisdiction label has changed");
					if (documentIndex === 2 && /^City of Portland, Councilor, District [34]$/u.test(group)) {
						office = group;
						firstPage = page.number;
					}
					continue;
				}
				if (indent === 5) {
					const title = line.trim().split(/\s{2,}/u)[0]!;
					if (!office) {
						office = title;
						firstPage = page.number;
					}
					else {
						office += ` ${title}`;
					}
					continue;
				}
				if (/^\d+ Year Term$|^Unexpired$|^Term$/u.test(text)) continue;
				if (/^\s{50,}\S/u.test(line)) {
					requireValue(candidates.length, "wrapped party label has no candidate");
					candidates.at(-1)!.party = clean(`${candidates.at(-1)!.party} ${text}`);
					continue;
				}
				if (indent >= 8 && indent <= 12) {
					requireValue(office, "county candidate has no office");
					const [name, party = "", ...extra] = line.trim().split(/\s{2,}/u);
					requireValue(name && !extra.length, "county candidate columns have changed");
					const incumbent = name.endsWith(" - Incumbent");
					candidates.push({ name: incumbent ? name.slice(0, -12) : name, party, ballotDesignation: incumbent ? "Incumbent" : undefined });
					continue;
				}
				requireValue(false, "county report has an unrecognized row");
			}
		}
		if (documentIndex === 0) emit(office, candidates, documentIndex, firstPage);
		else requireValue(!office && !groupContests, "county report ends inside a contest");
	}
	const stateContests = contests.filter(contest => contest.documentIndex === 0);
	requireValue(stateContests.length === 93 && new Set(stateContests.map(contest => contest.office)).size === 93, "state statement office set is incomplete");
	for (const [index, expected] of [183, 109, 46].entries()) requireValue(claims.filter(claim => claim.documentIndex === index).length === expected, "captured candidate set is incomplete");
	return { claims, contests, candidatePageCount: documents.reduce((total, pages) => total + pages.length, 0) };
}

export function reconcileOregonBallots(body: string) {
	const extracted = extractOregonBallots(body);
	const groups = new Map<string, { value: StateCandidateValues; ballotDesignation?: string; claimIndexes: number[] }>();
	const singleChoice = new Map<string, string>();
	for (const [index, claim] of extracted.claims.entries()) {
		const nameKey = claim.name.toLowerCase().replace(/[\s.'’]/gu, "");
		const key = JSON.stringify([claim.office, claim.district, claim.jurisdiction ?? "", nameKey]);
		if (claim.scope !== "local") {
			for (const party of claim.party.split(", ")) {
				const partyKey = JSON.stringify([claim.office, claim.district, party]);
				requireValue(!singleChoice.has(partyKey) || singleChoice.get(partyKey) === nameKey, "sources contain conflicting nominees for the same office and party");
				singleChoice.set(partyKey, nameKey);
			}
		}
		const value: StateCandidateValues = { name: claim.name, party: claim.party.split(", ").join(" / "), office: claim.office, district: claim.district, scope: claim.scope, jurisdiction: claim.jurisdiction, status: "listed" };
		const prior = groups.get(key);
		if (prior) {
			requireValue(prior.value.party === value.party && prior.ballotDesignation === claim.ballotDesignation, "repeated candidate has conflicting party or incumbent claims");
			prior.claimIndexes.push(index);
		}
		else {
			groups.set(key, { value, ballotDesignation: claim.ballotDesignation, claimIndexes: [index] });
		}
	}
	return { ...extracted, records: [...groups.values()] };
}

export function parseOregonCandidateRecords(source: StateBallotSource, body: string, factory: (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null) {
	requireValue(source.stateCode === "OR" && source.electionDate === "2026-11-03", "source does not identify the configured election");
	const result = reconcileOregonBallots(body);
	return result.records.map(({ value, ballotDesignation, claimIndexes }) => {
		const record = factory(source, value);
		requireValue(record, "candidate record is incomplete");
		record.sourceStatus = result.claims[claimIndexes[0]!]!.documentIndex === 0 ? "Official Ballot Statement" : "County ballot content";
		if (ballotDesignation) record.ballotDesignation = ballotDesignation;
		return record;
	});
}
