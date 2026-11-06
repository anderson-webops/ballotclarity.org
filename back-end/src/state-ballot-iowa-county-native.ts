import type { StateContestScope } from "./state-ballot-records.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import {
	stateHtmlAttribute as attribute,
	stateHtmlDescendants as descendants,
	parseStateHtml,
	stateHtmlText
} from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

export type IowaSampleCounty = "Monona" | "Woodbury";
export interface IowaSampleContext {
	county: IowaSampleCounty;
	electionDate: string;
	style: string;
}
export interface IowaSampleLine {
	page: number;
	column: number;
	ymin: number;
	ymax: number;
	text: string;
}
interface Word {
	value: string;
	xmin: number;
	ymin: number;
	xmax: number;
	ymax: number;
}
interface Office {
	office: string;
	scope: StateContestScope;
	districtCode: string | null;
	jurisdiction: string;
	team: boolean;
}
export interface IowaSampleContest extends Office {
	voteLimit: number;
	nonpartisanOffice: boolean;
	printedCaption: string;
	page: number;
	column: number;
	style: string;
}
export interface IowaSampleChoice extends Office {
	key: string;
	stateCode: "IA";
	electionDate: string;
	name: string;
	party: string | null;
	recordKind: "candidate" | "joint-ticket" | "judicial-retention-question";
	members?: string[];
	choices?: ["Yes", "No"];
	voteLimit?: number;
	nonpartisanOffice?: boolean;
	termType?: "to-fill-vacancy" | null;
}
export interface IowaSampleClaim extends Omit<IowaSampleLine, "text"> {
	key: string;
	sourceName: string;
	style: string;
}
export interface IowaSampleRead {
	records: IowaSampleChoice[];
	claims: IowaSampleClaim[];
	contests: IowaSampleContest[];
	questionLines: IowaSampleLine[];
}
export interface IowaSampleDocument {
	url: string;
	sha256: string;
	retrievedAt: string;
	style: string;
	bbox: string;
	layout: string;
}
export interface IowaCountyNativeRead {
	records: IowaSampleChoice[];
	claims: (IowaSampleClaim & { url: string; sha256: string })[];
	documents: { url: string; sha256: string; retrievedAt: string; style: string; includedRecordCount: number }[];
	contests: (IowaSampleContest & { url: string })[];
	questionLines: (IowaSampleLine & { url: string; style: string })[];
	sha256: string;
	retrievedAt: string;
	collectionIndexSha256: string;
}

const parties: Record<string, string> = {
	"REP": "Republican",
	"DEM": "Democratic",
	"LIB": "Libertarian",
	"Republican Party": "Republican",
	"Democratic Party": "Democratic",
	"Libertarian Party": "Libertarian"
};
const numbers: Record<string, number> = {
	one: 1,
	two: 2,
	three: 3,
	four: 4,
	five: 5,
	six: 6,
	seven: 7,
	eight: 8,
	nine: 9,
	ten: 10
};
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
function validName(value: string) {
	return /^\p{L}[\p{L}\p{M} .,'’"“”()-]{2,160}$/u.test(value)
		&& value.includes(" ")
		&& !/\b(?:Write-in|Vote|Office|Notice|District|Commissioner|Council|Township|Court|Ballot|Candidates|following)\b/iu.test(
			value
		);
}
const edges = (county: IowaSampleCounty) => (county === "Woodbury" ? [33, 215, 395, 577] : [19, 211, 403, 593.28]);

function checkedSampleContext(context: IowaSampleContext) {
	assert(["Monona", "Woodbury"].includes(context.county), "The Iowa sample county requires review.");
	assert(
		/^20\d{2}-11-0[2-8]$/u.test(context.electionDate)
		&& Number(context.electionDate.slice(0, 4)) % 2 === 0
		&& new Date(`${context.electionDate}T00:00:00Z`).getUTCDay() === 2,
		"The Iowa general-election date requires review."
	);
	assert(
		typeof context.style === "string"
		&& clean(context.style) === context.style
		&& context.style.length > 0
		&& context.style.length <= 300
		&& !containsControlCharacters(context.style),
		"The Iowa ballot-style label requires review."
	);
}

function checkedContext(context: IowaSampleContext, layout: string) {
	checkedSampleContext(context);
	assert(
		Buffer.byteLength(layout) <= 4 * 1024 * 1024 && !containsControlCharacters(layout.replace(/[\n\r\t\f]/gu, "")),
		"The Iowa sample text exceeds its bounds."
	);
	const normalized = clean(layout);
	assert(
		normalized.includes(
			`November ${Number(context.electionDate.slice(-2))}, ${context.electionDate.slice(0, 4)}`
		)
		&& /General Election/iu.test(normalized)
		&& new RegExp(`${context.county} County|County of ${context.county}`, "iu").test(normalized),
		"The Iowa sample election identity requires review."
	);
}

export function readIowaSampleColumns(body: string, county: IowaSampleCounty): IowaSampleLine[][][] {
	assert(
		["Monona", "Woodbury"].includes(county) && Buffer.byteLength(body) <= 4 * 1024 * 1024,
		"The Iowa native sample exceeds its bounds."
	);
	const tree = parseStateHtml(body);
	const pending = [{ node: tree, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const item = pending.pop()!;
		assert(++visited <= 80000 && item.depth <= 64, "The Iowa native structure exceeds its bounds.");
		for (const child of item.node.childNodes ?? []) pending.push({ node: child, depth: item.depth + 1 });
	}
	const pages = descendants(tree, node => node.nodeName === "page");
	assert(pages.length === 2, "The Iowa sample page count requires review.");
	return pages.map((page, pageIndex) => {
		const width = Number(attribute(page, "width"));
		const height = Number(attribute(page, "height"));
		assert(
			Math.abs(width - 612) < 0.1 && Math.abs(height - 1008) < 0.1,
			"The Iowa sample media geometry requires review."
		);
		const bounds = edges(county);
		const columns: Word[][] = [[], [], []];
		for (const node of descendants(page, candidate => candidate.nodeName === "word")) {
			const value = clean(stateHtmlText(node));
			const xmin = Number(attribute(node, "xmin"));
			const ymin = Number(attribute(node, "ymin"));
			const xmax = Number(attribute(node, "xmax"));
			const ymax = Number(attribute(node, "ymax"));
			assert(
				value
				&& !containsControlCharacters(value)
				&& [xmin, ymin, xmax, ymax].every(Number.isFinite)
				&& xmin >= 0
				&& ymin >= 0
				&& xmax > xmin
				&& ymax > ymin
				&& xmax <= width + 0.1
				&& ymax <= height + 0.1,
				"The Iowa native word geometry requires review."
			);
			const column = bounds.findIndex(
				(boundary, index) => index < 3 && xmin >= boundary && xmin < bounds[index + 1]!
			);
			if (ymax - ymin > 20) {
				assert(
					county === "Monona"
						? /^[SAMPLEBOT]$/u.test(value)
						: /^(?:20\d{2}|General|Election|SAMPLE)$/u.test(value),
					"The Iowa large-font layer requires review."
				);
				continue;
			}
			if (
				column < 0
				|| ymin < (county === "Monona" ? 33.07 : 25)
				|| ymax > (county === "Monona" ? 941.4 : height - 30)
			) {
				continue;
			}
			if (pageIndex > 0 || ymin > 250)
				assert(xmax <= bounds[column + 1]! + 0.1, "An Iowa printed word crosses ballot columns.");
			columns[column]!.push({ value, xmin, ymin, xmax, ymax });
		}
		return columns.map((words, column) => {
			const lines: { ymin: number; ymax: number; words: Word[] }[] = [];
			for (const word of words.sort((first, second) => first.ymin - second.ymin || first.xmin - second.xmin)) {
				const line = lines.find(
					candidate =>
						Math.min(candidate.ymax, word.ymax) - Math.max(candidate.ymin, word.ymin)
						>= Math.min(candidate.ymax - candidate.ymin, word.ymax - word.ymin) * 0.5
				);
				if (line) {
					line.words.push(word);
					line.ymin = Math.min(line.ymin, word.ymin);
					line.ymax = Math.max(line.ymax, word.ymax);
				}
				else {
					lines.push({ ymin: word.ymin, ymax: word.ymax, words: [word] });
				}
			}
			return lines
				.sort((first, second) => first.ymin - second.ymin)
				.map(line => ({
					page: pageIndex + 1,
					column: column + 1,
					ymin: line.ymin,
					ymax: line.ymax,
					text: line.words
						.sort((first, second) => first.xmin - second.xmin)
						.map(word => word.value)
						.join(" ")
				}));
		});
	});
}

function officeContext(caption: string, county: IowaSampleCounty): Office {
	const office = caption
		.replace(/^For /u, "")
		.replace("U.S. Representative", "United States Representative")
		.replace("U.S. Senator", "United States Senator")
		.replace("Governor and Lt Governor", "Governor / Lieutenant Governor")
		.replace("President and Vice President", "President / Vice President")
		.replace("Soil & Water", "Soil and Water")
		.replace(/ District Commissioner$/u, " District")
		.replace(/ Extension Council/u, " Extension")
		.replace(/^County Supervisor District /u, "Board of Supervisors District ")
		.replace(/^Township (Trustee|Clerk) ([\p{L} ]+)$/u, "$2 Township $1");
	const district = /^(?:United States Representative|State Senator|State Representative) District (\d{1,3})$/u.exec(
		office
	);
	if (district) {
		const scope = office.startsWith("United States")
			? "congressional"
			: office.startsWith("State Senator")
				? "state-senate"
				: "state-house";
		assert(
			Number(district[1]) > 0
			&& Number(district[1]) <= (scope === "congressional" ? 4 : scope === "state-senate" ? 50 : 100),
			"The Iowa district number requires review."
		);
		return { office, scope, districtCode: district[1]!, jurisdiction: "Iowa", team: false };
	}
	if (
		[
			"United States Senator",
			"Governor / Lieutenant Governor",
			"President / Vice President",
			"Secretary of State",
			"Auditor of State",
			"Treasurer of State",
			"Secretary of Agriculture",
			"Attorney General"
		].includes(office)
	) {
		return { office, scope: "statewide", districtCode: null, jurisdiction: "Iowa", team: office.includes(" / ") };
	}
	assert(
		/^(?:Board of Supervisors District [1-9]\d?|County (?:Treasurer|Recorder|Attorney|Agricultural Extension(?: To Fill Vacancy)?)|Soil and Water Conservation District|[\p{L} ]+ Township (?:Trustee|Clerk))$/u.test(
			office
		),
		"The Iowa printed office requires review."
	);
	const township = /^([\p{L} ]+) Township (?:Trustee|Clerk)$/u.exec(office)?.[1];
	return {
		office,
		scope: "local",
		districtCode: /Supervisors District (\d+)/u.exec(office)?.[1] ?? null,
		jurisdiction: township ? `${county} County · ${township} Township` : `${county} County`,
		team: false
	};
}

export function readIowaCountySample(bbox: string, layout: string, context: IowaSampleContext): IowaSampleRead {
	checkedContext(context, layout);
	const pages = readIowaSampleColumns(bbox, context.county);
	const firstPage = descendants(parseStateHtml(bbox), node => node.nodeName === "page")[0]!;
	const nativeIdentity = clean(descendants(firstPage, node => node.nodeName === "word" && Number(attribute(node, "ymax")) <= 150).map(stateHtmlText).join(" "));
	assert(
		nativeIdentity.includes(
			`November ${Number(context.electionDate.slice(-2))}, ${context.electionDate.slice(0, 4)}`
		)
		&& /General Election/iu.test(nativeIdentity)
		&& new RegExp(`${context.county} County|County of ${context.county}`, "iu").test(nativeIdentity),
		"The Iowa native and layout identities disagree."
	);
	return readIowaSampleFields(pages, context);
}

export function readIowaSampleFields(pages: IowaSampleLine[][][], context: IowaSampleContext): IowaSampleRead {
	checkedSampleContext(context);
	assert(pages.length === 2 && pages.every(page => page.length === 3), "The Iowa sample column inventory requires review.");
	const records: IowaSampleChoice[] = [];
	const claims: IowaSampleClaim[] = [];
	const contests: IowaSampleContest[] = [];
	const questionLines: IowaSampleLine[] = [];
	const add = (
		values: Omit<IowaSampleChoice, "key" | "stateCode" | "electionDate">,
		evidence: (IowaSampleLine & { sourceName: string })[]
	) => {
		const identity = JSON.stringify([
			context.county,
			context.electionDate,
			values.office,
			values.name,
			values.jurisdiction
		]);
		const key = createHash("sha256").update(identity).digest("hex").slice(0, 24);
		assert(!records.some(record => record.key === key), "An Iowa choice is duplicated within its printed style.");
		records.push({ key, stateCode: "IA", electionDate: context.electionDate, ...values });
		for (const line of evidence) {
			claims.push({
				key,
				sourceName: line.sourceName,
				page: line.page,
				column: line.column,
				ymin: line.ymin,
				ymax: line.ymax,
				style: context.style
			});
		}
	};
	for (const [pageIndex, page] of pages.entries()) {
		for (const [columnIndex, column] of page.entries()) {
			const startRecords = records.length;
			const startContests = contests.length;
			let caption = "";
			let office: Office | undefined;
			let limit: number | undefined;
			let nonpartisan = false;
			let candidates: string[] = [];
			let candidateLines: IowaSampleLine[] = [];
			let candidateParty: string | undefined;
			let active = false;
			let judicial = false;
			let court: string | undefined;
			let pendingJudge: { name: string; line: IowaSampleLine } | undefined;
			let judgeChoices: string[] = [];
			let measure = false;
			const flush = () => {
				if (!candidates.length) return;
				assert(
					office && limit && candidates.length === (office.team ? 2 : 1),
					"The Iowa candidate or joint ticket is incomplete."
				);
				assert(
					nonpartisan || candidateParty || office.scope === "local",
					"An Iowa partisan state/federal choice lacks its printed party."
				);
				assert(candidateLines.length === candidates.length, "The Iowa name evidence is incomplete.");
				add(
					{
						...office,
						name: candidates.join(" / "),
						...(office.team ? { members: [...candidates] } : {}),
						party: candidateParty ?? null,
						nonpartisanOffice: nonpartisan,
						voteLimit: limit,
						recordKind: office.team ? "joint-ticket" : "candidate",
						termType: /To Fill Vacancy/u.test(office.office) ? "to-fill-vacancy" : null
					},
					candidateLines.map((line, index) => ({ ...line, sourceName: candidates[index]! }))
				);
				candidates = [];
				candidateLines = [];
				candidateParty = undefined;
			};
			const flushJudge = () => {
				if (!pendingJudge) return;
				assert.deepEqual(judgeChoices, ["YES", "NO"], "An Iowa retention question lacks its printed choices.");
				assert(court, "The Iowa retention court is missing.");
				const statewide = court.startsWith("Court of Appeals") || court.startsWith("Supreme Court");
				add(
					{
						office: `${court} retention - ${pendingJudge.name}`,
						scope: statewide ? "statewide" : "local",
						districtCode: statewide ? null : "3B",
						jurisdiction: statewide ? "Iowa" : "Iowa Judicial District 3B",
						team: false,
						name: pendingJudge.name,
						party: null,
						recordKind: "judicial-retention-question",
						choices: ["Yes", "No"]
					},
					[{ ...pendingJudge.line, sourceName: pendingJudge.name }]
				);
				pendingJudge = undefined;
				judgeChoices = [];
			};
			for (const line of column) {
				const value = line.text;
				if (/^\d{3,5}$|^Typ:|^TURN THE BALLOT OVER$/u.test(value)) continue;
				if (/^(?:Public Measures|Constitutional Amendment)$/u.test(value)) {
					flush();
					flushJudge();
					active = false;
					measure = true;
				}
				if (measure) {
					questionLines.push(line);
					continue;
				}
				if (/^Judicial Ballot$/iu.test(value)) {
					flush();
					active = false;
					judicial = true;
					continue;
				}
				if (judicial) {
					const nextCourt = /^Court of Appeals Judges?$/u.test(value)
						? "Court of Appeals Judge"
						: /^Supreme Court Justices?$/u.test(value)
							? "Supreme Court Justice"
							: /^District 3B (?:Court )?Judges?$/u.test(value)
								? "District 3B Court Judge"
								: /^District 3B Associate Judges?$/u.test(value)
									? "District 3B Associate Judge"
									: null;
					if (nextCourt) {
						flushJudge();
						court = nextCourt;
						continue;
					}
					if (
						/^(?:Notice to [Vv]oters|by filling in the appropriate oval below each name\.|Shall the following|Judges be retained|retained in office|completely filling|below each name)/u.test(
							value
						)
					) {
						continue;
					}
					assert(court, "The Iowa judicial section requires review.");
					if (value === "YES" || value === "NO") {
						assert(pendingJudge, "An Iowa retention choice has no named judge.");
						judgeChoices.push(value);
						if (judgeChoices.length === 2) flushJudge();
						continue;
					}
					assert(validName(value) && !pendingJudge, "The Iowa judicial name or layout requires review.");
					pendingJudge = { name: value, line };
					continue;
				}
				if (/^(?:Federal|State|County|Nonpartisan|Non Partisan) Offices$/u.test(value)) {
					flush();
					nonpartisan = value.startsWith("Non");
					active = false;
					caption = "";
					continue;
				}
				if (value.startsWith("For ")) {
					flush();
					caption = value;
					office = undefined;
					active = false;
					continue;
				}
				const vote = /^Vote for no more than (\w+)(?: (?:TEAM|Team|team))?$/u.exec(value);
				if (vote) {
					assert(caption && !active, "The Iowa vote instruction is misplaced.");
					office = officeContext(caption, context.county);
					limit = numbers[vote[1]!.toLowerCase()];
					assert(
						limit
						&& !contests.some(
							contest =>
								contest.office === office!.office && contest.jurisdiction === office!.jurisdiction
						),
						"The Iowa vote limit or office identity requires review."
					);
					contests.push({
						...office,
						voteLimit: limit,
						nonpartisanOffice: nonpartisan,
						printedCaption: caption,
						page: line.page,
						column: line.column,
						style: context.style
					});
					active = true;
					continue;
				}
				if (caption && !office && !active) {
					caption += ` ${value}`;
					continue;
				}
				if (!active) continue;
				if (/^\(?Write-in vote(?: for (?:Lt\. Governor|Governor))?, if any\)?$/u.test(value)) {
					flush();
					continue;
				}
				if (parties[value]) {
					assert(candidates.length && !candidateParty, "The Iowa printed party is misplaced.");
					candidateParty = parties[value];
					flush();
					continue;
				}
				const inline = /^(.+) (REP|DEM|LIB)$/u.exec(value);
				if (inline) {
					if (candidates.length) flush();
					assert(validName(inline[1]!), "The Iowa candidate name requires review.");
					candidates = [inline[1]!];
					candidateLines = [line];
					candidateParty = parties[inline[2]!];
					if (!office!.team) flush();
					continue;
				}
				assert(validName(value), "The Iowa candidate line requires review.");
				if (nonpartisan) {
					candidates = [value];
					candidateLines = [line];
					flush();
					continue;
				}
				assert(
					candidates.length < (office!.team ? 2 : 1),
					"The Iowa ticket or party association is ambiguous."
				);
				candidates.push(value);
				candidateLines.push(line);
				if (office!.team && candidates.length === 2 && candidateParty) flush();
			}
			flush();
			flushJudge();
			assert(!caption || office, "The Iowa printed office has no vote instruction.");
			if (pageIndex === 0 || columnIndex === 0) {
				assert(
					contests.length > startContests && !judicial && !measure,
					"An Iowa candidate column is incomplete."
				);
			}
			else if (columnIndex === 1) {
				assert(
					judicial && court && records.length > startRecords && !measure,
					"The Iowa retention column is incomplete."
				);
			}
			else {
				assert(
					measure
					&& !judicial
					&& questionLines.some(line => line.page === pageIndex + 1 && line.column === columnIndex + 1),
					"The Iowa measure column is incomplete."
				);
			}
		}
	}
	assert(
		records.length > 0 && records.length <= 1000 && contests.length <= 100 && questionLines.length <= 500,
		"The Iowa sample record bounds require review."
	);
	return { records, claims, contests, questionLines };
}

export function readIowaCountySamples(
	documents: readonly IowaSampleDocument[],
	context: Omit<IowaSampleContext, "style">,
	now = Date.now()
): IowaCountyNativeRead {
	assert(documents.length > 0 && documents.length <= 100, "The Iowa offered sample set requires review.");
	const origin
		= context.county === "Monona" ? "https://mononacountyiowa.gov" : "https://elections.woodburycountyiowa.gov";
	const records = new Map<string, IowaSampleChoice>();
	const claims: IowaCountyNativeRead["claims"] = [];
	const metadata: IowaCountyNativeRead["documents"] = [];
	const contests: IowaCountyNativeRead["contests"] = [];
	const questionLines: IowaCountyNativeRead["questionLines"] = [];
	const seenUrls = new Set<string>();
	let totalBytes = 0;
	for (const document of documents) {
		const url = new URL(document.url);
		assert(
			url.origin === origin
			&& !url.username
			&& !url.password
			&& !url.search
			&& !url.hash
			&& url.href === document.url
			&& /^\/files\/sample_ballots\/[a-z\d_]+\.pdf$/u.test(url.pathname)
			&& !seenUrls.has(url.href),
			"The Iowa sample URL set requires review."
		);
		seenUrls.add(url.href);
		assert(
			/^[a-f0-9]{64}$/u.test(document.sha256)
			&& Number.isFinite(Date.parse(document.retrievedAt))
			&& new Date(document.retrievedAt).toISOString() === document.retrievedAt
			&& Date.parse(document.retrievedAt) <= now,
			"The Iowa sample provenance requires review."
		);
		totalBytes += Buffer.byteLength(document.bbox) + Buffer.byteLength(document.layout);
		assert(totalBytes <= 32 * 1024 * 1024, "The Iowa native sample set exceeds its bounds.");
		const parsed = readIowaCountySample(document.bbox, document.layout, { ...context, style: document.style });
		let includedRecordCount = 0;
		for (const record of parsed.records) {
			const previous = records.get(record.key);
			if (previous) {
				assert.deepEqual(record, previous, "The Iowa sample styles disagree on a shared choice.");
			}
			else {
				records.set(record.key, record);
				includedRecordCount++;
			}
		}
		claims.push(...parsed.claims.map(claim => ({ ...claim, url: document.url, sha256: document.sha256 })));
		contests.push(...parsed.contests.map(contest => ({ ...contest, url: document.url })));
		questionLines.push(
			...parsed.questionLines.map(line => ({ ...line, url: document.url, style: document.style }))
		);
		metadata.push({
			url: document.url,
			sha256: document.sha256,
			retrievedAt: document.retrievedAt,
			style: document.style,
			includedRecordCount
		});
	}
	const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
	return {
		records: [...records.values()],
		claims,
		documents: metadata,
		contests,
		questionLines,
		sha256: hash(metadata.map(({ url, sha256 }) => ({ url, sha256 }))),
		retrievedAt: new Date(Math.min(...metadata.map(document => Date.parse(document.retrievedAt)))).toISOString(),
		collectionIndexSha256: hash(metadata.map(({ url, style }) => ({ url, style })))
	};
}
