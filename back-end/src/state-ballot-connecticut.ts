import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateCandidateRecord, StateContestScope } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { connecticutBallotDocuments } from "./state-ballot-connecticut-documents.js";

type Bounds = [number, number, number, number];
interface BallotCell {
	bounds: Bounds;
	text: string;
	logicalText: string;
	tags: Array<{ text: string; top: number; bottom: number }>;
}

export interface ConnecticutBallotClaim {
	documentIndex: number;
	page: number;
	town: string;
	votingDistrict?: string;
	office: string;
	scope: StateContestScope;
	district: string;
	jurisdiction?: string;
	name: string;
	party: string;
	position: string;
	sourceOfficeLabel: string;
	sourcePartyLabel: string;
	cellBounds: Bounds;
}

export interface ConnecticutBallotQuestion {
	documentIndex: number;
	page: number;
	town: string;
	text: string;
	cellBounds: Bounds;
}

const offices = [
	["governor", "Governor and Lieutenant Governor", "statewide"],
	["representativeincongress", "Representative in Congress", "congressional"],
	["statesenator", "State Senator", "state-senate"],
	["statesenate", "State Senator", "state-senate"],
	["staterepresentative", "State Representative", "state-house"],
	["secretaryofthestate", "Secretary of the State", "statewide"],
	["secretaryofstate", "Secretary of the State", "statewide"],
	["treasurer", "Treasurer", "statewide"],
	["comptroller", "Comptroller", "statewide"],
	["attorneygeneral", "Attorney General", "statewide"],
	["judgeofprobate", "Judge of Probate", "local"],
	["registrarofvoters", "Registrar of Voters", "local"],
	["boardofeducation", "Board of Education", "local"],
	["representativetownmeeting", "Representative Town Meeting", "local"],
] as const;
const partyNames: Readonly<Record<string, string>> = {
	"democraticparty": "Democratic",
	"republicanparty": "Republican",
	"workingfamiliesparty": "Working Families",
	"independentparty": "Independent",
	"greenparty": "Green",
	"newmovementparty": "New Movement",
	"unitedcommunityparty": "United Community",
	"workers'voiceparty": "Workers' Voice",
	"yankeenationalparty": "Yankee National",
	"petitioningcandidate": "Petitioning Candidate",
	"nonpartisan": "Nonpartisan",
	"write-invotes": "Write-in",
	"write-invotesvotosporescrito": "Write-in",
};

function object(value: unknown, keys: readonly string[]) {
	if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key)))
		throw new Error("The Connecticut ballot object has unexpected fields.");
	return value as Record<string, unknown>;
}

function text(value: unknown, limit = 2000) {
	if (typeof value !== "string" || value.length > limit)
		throw new Error("The Connecticut ballot text field is invalid.");
	return value.normalize("NFKC");
}

function clean(value: string) {
	return value.replace(/\s+/gu, " ").trim();
}

function fold(value: string) {
	return clean(value).replace(/\s+/gu, "").toLowerCase();
}

function bounds(value: unknown, width: number, height: number): Bounds {
	if (!Array.isArray(value) || value.length !== 4 || value.some(number => typeof number !== "number" || !Number.isFinite(number)) || value[0] < 0 || value[1] < 0 || value[2] > width + 1 || value[3] > height + 1 || value[0] >= value[2] || value[1] >= value[3])
		throw new Error("The Connecticut ballot geometry is invalid.");
	return value as Bounds;
}

function readCell(value: unknown, width: number, height: number): BallotCell {
	const cell = object(value, ["bounds", "text", "logicalText", "tags"]);
	if (!Array.isArray(cell.tags) || cell.tags.length > 25)
		throw new Error("The Connecticut ballot position markers are invalid.");
	const rectangle = bounds(cell.bounds, width, height);
	return {
		bounds: rectangle,
		text: text(cell.text),
		logicalText: text(cell.logicalText),
		tags: cell.tags.map((value: unknown) => {
			const tag = object(value, ["text", "top", "bottom"]);
			if (typeof tag.top !== "number" || typeof tag.bottom !== "number" || !Number.isFinite(tag.top) || !Number.isFinite(tag.bottom) || tag.top >= tag.bottom || tag.top < rectangle[1] - 1 || tag.bottom > rectangle[3] + 1 || !/^\d{1,2}[A-Z]$/u.test(text(tag.text, 4)))
				throw new Error("The Connecticut ballot position marker is outside its cell.");
			return { text: tag.text as string, top: tag.top, bottom: tag.bottom };
		}),
	};
}

function district(header: string, pattern: RegExp, maximum: number) {
	const matches = [...header.matchAll(pattern)];
	const value = matches.length === 1 ? Number(matches[0]![1]) : 0;
	if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
		throw new Error("The Connecticut ballot does not identify its legislative districts.");
	return String(value);
}

function printedVotingDistrict(header: string) {
	const lines = header.split("\n");
	const label = /Voting\s*Districts?(?:\/Distritos?\s*Electoral(?:es)?)?/iu;
	const index = lines.findIndex(line => label.test(line));
	if (index < 0) return undefined;
	let value = lines[index]!.split(label)[1]?.trim() ?? "";
	value = value.replace(/\/Distritos?\s*Electoral(?:es)?\s+(?:\S.*)?$/iu, "");
	let next = index + 1;
	if (!value && /^Distrito\s*Electoral$/iu.test(lines[next] ?? "")) {
		value = lines[next + 1] ?? "";
		next += 2;
	}
	while (value.trim().endsWith(",") && next < lines.length && fold(lines[next]!).replace(/,$/u, "").split(",").every(part => /^(?:district)?\d+[a-z]?(?:-\d+[a-z]?)?$/u.test(part))) {
		value += ` ${lines[next]}`;
		next += 1;
	}
	if (value.length > 100 || !/^(?:one|two|three|(?:district)?\d+[a-z]?(?:-\d+[a-z]?)?(?:[,&/](?:district)?\d+[a-z]?(?:-\d+[a-z]?)?)*(?:windelks|vfw|wmtcelks|wcfd)?)$/u.test(fold(value)))
		throw new Error("The Connecticut printed voting district label has changed.");
	return clean(value);
}

export interface ConnecticutBallotConfiguration {
	electionDate: string;
	documents: ReadonlyArray<{ town: string; url: string; pageCount: number }>;
	retainUnassignedDistrictClaims?: true;
}

const reviewedConfiguration: ConnecticutBallotConfiguration = { electionDate: "2026-11-03", documents: connecticutBallotDocuments };

export function extractConnecticutBallots(body: string, configuration = reviewedConfiguration) {
	if (!/^20\d{2}-11-0[2-8]$/u.test(configuration.electionDate) || new Date(`${configuration.electionDate}T00:00:00Z`).getUTCDay() !== 2 || !configuration.documents.length || configuration.documents.length > 169 || new Set(configuration.documents.map(document => document.town)).size !== configuration.documents.length || configuration.documents.some(document => !/^[A-Z][A-Za-z ]{1,60}$/u.test(document.town) || !Number.isInteger(document.pageCount) || document.pageCount < 1 || document.pageCount > 50)) throw new Error("The Connecticut ballot extraction configuration is invalid.");
	if (new TextEncoder().encode(body).length > 12 * 1024 * 1024 || new Set(configuration.documents.map(document => document.url)).size !== configuration.documents.length) throw new Error("The Connecticut ballot document set exceeds its bounds or repeats a URL.");
	if (configuration.retainUnassignedDistrictClaims !== undefined && configuration.retainUnassignedDistrictClaims !== true) throw new Error("The Connecticut unassigned-claim policy requires explicit review.");
	for (const document of configuration.documents) {
		const url = new URL(document.url);
		if (url.origin !== "https://portal.ct.gov" || url.username || url.password || url.hash || !url.pathname.startsWith(`/-/media/sots/electionservices/town_ballots/${configuration.electionDate.slice(0, 4)}/`) || !url.pathname.endsWith(".pdf")) throw new Error("The Connecticut ballot document URL does not match its official election.");
	}
	const payload = object(JSON.parse(body), ["documents"]);
	if (!Array.isArray(payload.documents) || payload.documents.length !== configuration.documents.length)
		throw new Error("The Connecticut ballot document set is incomplete.");
	const claims: ConnecticutBallotClaim[] = [];
	const questions: ConnecticutBallotQuestion[] = [];
	let blankPositions = 0;
	let pageCount = 0;
	for (const [documentIndex, value] of payload.documents.entries()) {
		const document = object(value, ["url", "town", "pageCount", "pages"]);
		const configured = configuration.documents[documentIndex]!;
		if (document.url !== configured.url || document.town !== configured.town || document.pageCount !== configured.pageCount || !Array.isArray(document.pages) || document.pages.length !== configured.pageCount)
			throw new Error("The Connecticut ballot document identity or page count has changed.");
		for (const [pageIndex, value] of document.pages.entries()) {
			const page = object(value, ["number", "width", "height", "headerText", "cells"]);
			if (page.number !== pageIndex + 1 || typeof page.width !== "number" || typeof page.height !== "number" || !Number.isFinite(page.width) || !Number.isFinite(page.height) || page.width < 600 || page.width > 1600 || page.height < 400 || page.height > 1200 || !Array.isArray(page.cells) || page.cells.length < 30 || page.cells.length > 300)
				throw new Error("The Connecticut ballot page is incomplete or has changed geometry.");
			const headerText = text(page.headerText);
			const header = headerText.split("\n").map(fold).join("\n");
			const printedTown = configured.town === "Westbrook" && configuration.electionDate === "2026-11-03" ? "Westbroook" : configured.town;
			const townPattern = new RegExp(`(?:^|\\n)${printedTown.replace(/ /gu, "\\s+")}\\s*(?:,|\\n|Connecticut\\b)`, "iu");
			if (!header.includes(`november${Number(configuration.electionDate.slice(-2))},${configuration.electionDate.slice(0, 4)}`) || !/\bConnecticut\b/u.test(headerText) || !townPattern.test(headerText))
				throw new Error("The Connecticut ballot header does not identify its town and configured election.");
			const unassigned = configuration.retainUnassignedDistrictClaims && !/congressionaldistrict|senatorialdistrict|assemblydistrict/u.test(header);
			const congressional = unassigned ? "" : district(header, /congressionaldistrict(?:\/distritocongresional)?(\d+)/gu, 5);
			const senate = unassigned ? "" : district(header, /senatorialdistrict(?:\/distritosenatorial)?(\d+)/gu, 36);
			const house = unassigned ? "" : district(header, /assemblydistrict(?:\/distritodelaasamblea)?(\d+)/gu, 151);
			const votingDistrict = printedVotingDistrict(headerText);
			const cells = page.cells.map(value => readCell(value, page.width as number, page.height as number));
			const partyHeaders = cells.filter(cell => /office/u.test(fold(cell.text)) && /party/u.test(fold(cell.text)) && cell.text.length < 100);
			if (partyHeaders.length !== 1) throw new Error("The Connecticut ballot party header is missing or ambiguous.");
			const partyHeader = partyHeaders[0]!;
			const officeCells = cells.filter(cell => Math.abs(cell.bounds[1] - partyHeader.bounds[1]) < 1 && Math.abs(cell.bounds[3] - partyHeader.bounds[3]) < 1 && cell.bounds[0] > partyHeader.bounds[2] - 1).map((cell) => {
				const label = fold(cell.text).replace(/^\d+/u, "");
				const matched = offices.find(([prefix]) => label.startsWith(prefix));
				if (!matched) throw new Error("The Connecticut ballot office header has changed.");
				return { cell, office: matched[1], scope: matched[2] };
			});
			for (const office of ["Governor and Lieutenant Governor", "Representative in Congress", "State Senator", "State Representative", "Secretary of the State", "Treasurer", "Comptroller", "Attorney General", "Judge of Probate"]) {
				if (officeCells.filter(item => item.office === office).length !== 1) throw new Error("The Connecticut ballot office set is incomplete.");
			}
			const partyCells = cells.filter(cell => Math.abs(cell.bounds[0] - partyHeader.bounds[0]) < 1 && Math.abs(cell.bounds[2] - partyHeader.bounds[2]) < 1 && cell.bounds[1] > partyHeader.bounds[1] + 1).map((cell) => {
				const recognized = [...new Set([cell.text, cell.logicalText].map(value => fold(value).replace(/[‘’]/gu, "'")).filter(value => Object.hasOwn(partyNames, value)).map(value => partyNames[value]!))];
				if (!clean(cell.text) && !clean(cell.logicalText)) return { cell, party: "" };
				if (recognized.length !== 1) throw new Error("The Connecticut ballot party label is unknown or inconsistent.");
				return { cell, party: recognized[0]! };
			});
			if (!partyCells.some(item => item.party === "Write-in") || !["Democratic", "Republican", "Working Families"].every(party => partyCells.some(item => item.party === party)))
				throw new Error("The Connecticut ballot party rows are incomplete.");
			for (const cell of cells) {
				if (cell === partyHeader || officeCells.some(item => item.cell === cell) || partyCells.some(item => item.cell === cell) || !clean(cell.text)) continue;
				const body = cell.text.replace(/^[●○◯]\s*/u, "");
				if (/^(?:\d+[A-Z]+)+$/u.test(clean(body).replace(/\s+/gu, ""))) {
					blankPositions += 1;
					continue;
				}
				const officeMatches = officeCells.filter(item => cell.bounds[0] >= item.cell.bounds[0] - 1 && cell.bounds[2] <= item.cell.bounds[2] + 1 && cell.bounds[1] >= item.cell.bounds[3] - 1);
				if (!officeMatches.length && (/\bshall\b/iu.test(body) || /^\d+\.["“]?shall/iu.test(fold(body)))) {
					questions.push({ documentIndex, page: page.number as number, town: configured.town, text: clean(body), cellBounds: cell.bounds });
					continue;
				}
				if (!officeMatches.length && /^voteonthequestion/iu.test(fold(body))) continue;
				const position = body.match(/^(\d{1,2})\s*([A-Z])(?:\s+|$)([\s\S]*)/u);
				if (!position || !clean(position[3]!)) throw new Error("The Connecticut named ballot cell has no unambiguous position label.");
				const marker = cell.tags[0];
				if (!marker || marker.text !== `${position[1]}${position[2]}`) throw new Error("The Connecticut ballot position geometry is inconsistent.");
				const markerY = (marker.top + marker.bottom) / 2;
				const partyMatches = partyCells.filter(item => markerY > item.cell.bounds[1] && markerY < item.cell.bounds[3]);
				if (officeMatches.length !== 1 || partyMatches.length !== 1 || partyMatches[0]!.party === "Write-in") throw new Error("The Connecticut candidate does not match its physical office and party cell.");
				const office = officeMatches[0]!;
				const name = clean(position[3]!);
				if (name.length > 250 || !/\p{L}/u.test(name)) throw new Error("The Connecticut ballot name is invalid.");
				if (office.office === "Governor and Lieutenant Governor" && !/\band\b/iu.test(name)) throw new Error("The Connecticut governor ticket does not identify its running mate.");
				if (office.office === "Representative Town Meeting" && !votingDistrict) throw new Error("The local town-meeting ballot is missing its printed voting area.");
				claims.push({
					documentIndex,
					page: page.number as number,
					town: configured.town,
					votingDistrict,
					office: office.office,
					scope: office.scope,
					district: office.scope === "congressional" ? congressional : office.scope === "state-senate" ? senate : office.scope === "state-house" ? house : "",
					jurisdiction: office.scope === "local" ? office.office === "Representative Town Meeting" ? `${configured.town}; ballot voting district ${votingDistrict}` : configured.town : undefined,
					name,
					party: partyMatches[0]!.party,
					position: `${position[1]}${position[2]}`,
					sourceOfficeLabel: clean(office.cell.text),
					sourcePartyLabel: clean(partyMatches[0]!.cell.logicalText),
					cellBounds: cell.bounds,
				});
			}
			pageCount += 1;
		}
	}
	return { claims, questions, blankPositions, pageCount };
}

function printedName(claim: ConnecticutBallotClaim, electionDate: string) {
	const name = claim.name;
	if (electionDate !== "2026-11-03") return name;
	if (claim.office === "Attorney General" && claim.town === "Morris" && claim.party === "Democratic" && name === "Willian Tong") return "William Tong";
	if (claim.office === "State Representative" && claim.district === "71" && name === "Stephen R. Ferrucci III") return "Stephen R. Ferrucci, III";
	if (claim.office === "Representative in Congress" && claim.district === "3" && name === "Rosa DeLauro") return "Rosa L. DeLauro";
	if (claim.office === "State Representative" && claim.district === "6" && name === "James Jimmy Sanchez") return "James Jimmy Sánchez";
	return name;
}

export function reconcileConnecticutBallots(body: string, configuration = reviewedConfiguration) {
	const extracted = extractConnecticutBallots(body, configuration);
	const groups = new Map<string, { value: StateCandidateValues; parties: Set<string>; claimIndexes: number[] }>();
	const singleChoice = new Map<string, Set<string>>();
	const unassignedClaimIndexes: number[] = [];
	for (const [index, claim] of extracted.claims.entries()) {
		if (!["statewide", "local"].includes(claim.scope) && !claim.district) {
			unassignedClaimIndexes.push(index);
			continue;
		}
		const name = printedName(claim, configuration.electionDate);
		const nameKey = name.toLowerCase().replace(/[\s.'’‘"]/gu, "");
		const key = JSON.stringify([claim.office, claim.district, claim.jurisdiction ?? "", nameKey]);
		const group = groups.get(key) ?? { value: { name, office: claim.office, party: "", scope: claim.scope, district: claim.district, jurisdiction: claim.jurisdiction, status: "listed" }, parties: new Set<string>(), claimIndexes: [] };
		if (claim.party) group.parties.add(claim.party);
		group.claimIndexes.push(index);
		groups.set(key, group);
		if (claim.scope !== "local" && claim.party && !["Petitioning Candidate", "Nonpartisan"].includes(claim.party)) {
			const partyKey = JSON.stringify([claim.office, claim.district, claim.party]);
			const names = singleChoice.get(partyKey) ?? new Set<string>();
			names.add(nameKey);
			if (names.size > 1) throw new Error("The Connecticut sample ballots contain conflicting printed nominees for the same office and party.");
			singleChoice.set(partyKey, names);
		}
	}
	const records = [...groups.values()].map(group => ({ value: { ...group.value, party: [...group.parties].join(" / ") }, claimIndexes: group.claimIndexes }));
	return { ...extracted, records, unassignedClaimIndexes };
}

export function parseConnecticutCandidateRecords(source: StateBallotSource, body: string, factory: (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null) {
	if (source.stateCode !== "CT" || source.electionDate !== "2026-11-03") throw new Error("The Connecticut candidate source does not identify the configured election.");
	return reconcileConnecticutBallots(body).records.map(({ value }) => {
		const record = factory(source, value);
		if (!record) throw new Error("The Connecticut candidate record is incomplete.");
		record.sourceStatus = "Printed sample ballot";
		return record;
	});
}
