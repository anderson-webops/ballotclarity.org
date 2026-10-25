import type { StateCandidateRecord, StateContestScope } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import type { StateBallotWorkbookSheet } from "./state-ballot-workbook.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { normalizePublicHref } from "./public-href.js";
import { fetchRemoteSourceDocument, fetchRemoteSourceText } from "./remote-json-source.js";
import {
	stateHtmlAttribute as attribute,
	stateHtmlDescendants as descendants,
	parseStateHtml,
	stateHtmlText
} from "./state-ballot-html.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";
import { readStateBallotWorkbook, stateBallotWorkbookContract } from "./state-ballot-workbook.js";
import { containsControlCharacters } from "./text-validation.js";

export const vermontDiscoveryUrl = "https://sos.vermont.gov/elections/election-info-resources/candidates";
export interface VermontElection {
	electionId: null;
	electionDate: string;
	workbookUrl: string;
}
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const text = (node: Parameters<typeof stateHtmlText>[0]) => clean(stateHtmlText(node));
function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
	return Boolean(
		value
		&& typeof value === "object"
		&& !Array.isArray(value)
		&& Object.keys(value).sort().join("|") === [...keys].sort().join("|")
	);
}
export const vermontPolicyReceipts = [
	{
		url: "https://sos.vermont.gov/robots.txt",
		status: 200,
		region: "bytes",
		sha256: "77dd650ba0de3f8d8b3c9aee6a96fe450a433446f6a59a8006226ebcdffff231"
	},
	{
		url: "https://www.vermont.gov/robots.txt",
		status: 200,
		region: "bytes",
		sha256: "77dd650ba0de3f8d8b3c9aee6a96fe450a433446f6a59a8006226ebcdffff231"
	},
	{
		url: "https://outside.vermont.gov/robots.txt",
		status: 404,
		region: "bytes",
		sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
	},
	{
		url: "https://www.vermont.gov/policies/privacy",
		status: 200,
		region: "main-text",
		sha256: "6f49f68a35be325c29464a519d6e105ba3e7771597e248f144c0450168c7f585"
	},
	{
		url: "https://www.vermont.gov/policies",
		status: 200,
		region: "main-text",
		sha256: "c832bff498e9527c972003c11099612d05e85ed406bc8a04a2de2c916019e85c"
	}
] as const;
const headers = [
	"Contest",
	"District Name",
	"Name On Ballot",
	"Town Of Residence",
	"Party",
	"Address",
	"City",
	"State",
	"Zip",
	"Day Time Phone",
	"Evening Phone",
	"Email",
	"Website",
	"Term Length(Years)",
	"Vote for Count",
	"Financial Disclosure"
];
const scopes: Record<string, StateContestScope> = {
	"REPRESENTATIVE TO CONGRESS": "statewide",
	"UNITED STATES SENATOR": "statewide",
	"GOVERNOR": "statewide",
	"LIEUTENANT GOVERNOR": "statewide",
	"STATE TREASURER": "statewide",
	"SECRETARY OF STATE": "statewide",
	"AUDITOR OF ACCOUNTS": "statewide",
	"ATTORNEY GENERAL": "statewide",
	"STATE SENATOR": "state-senate",
	"STATE REPRESENTATIVE": "state-house",
	"PROBATE JUDGE": "local",
	"ASSISTANT JUDGE": "local",
	"STATE'S ATTORNEY": "local",
	"SHERIFF": "local",
	"HIGH BAILIFF": "local",
	"JUSTICE OF THE PEACE": "local"
};
const voteWords = [
	"",
	"ONE",
	"TWO",
	"THREE",
	"FOUR",
	"FIVE",
	"SIX",
	"SEVEN",
	"EIGHT",
	"NINE",
	"TEN",
	"ELEVEN",
	"TWELVE",
	"THIRTEEN",
	"FOURTEEN",
	"FIFTEEN"
];
type VermontTextRequest = (
	url: string,
	options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }
) => Promise<string>;

export function validateVermontElection(value: unknown): asserts value is VermontElection {
	if (
		!exact(value, ["electionId", "electionDate", "workbookUrl"])
		|| value.electionId !== null
		|| typeof value.electionDate !== "string"
		|| !/^20\d{2}-11-0[2-8]$/u.test(value.electionDate)
		|| value.electionDate < "2026-11-03"
		|| Number(value.electionDate.slice(0, 4)) % 2
		|| new Date(value.electionDate).getUTCDay() !== 2
		|| typeof value.workbookUrl !== "string"
	) {
		throw new Error("The Vermont regular-general election identity is invalid.");
	}
	const url = new URL(value.workbookUrl);
	if (
		url.origin !== "https://outside.vermont.gov"
		|| url.username
		|| url.password
		|| url.search
		|| url.hash
		|| url.pathname
		!== `/dept/sos/Elections_Division/election_info_resources/candidates/${value.electionDate.slice(0, 4)}_general_election_qualified_candidates.xlsx`
	) {
		throw new Error("The Vermont candidate workbook is not an approved published control.");
	}
}

export function validateVermontSource(source: StateBallotSource) {
	validateVermontElection({ electionId: null, electionDate: source.electionDate, workbookUrl: source.url });
	if (
		source.stateCode !== "VT"
		|| source.format !== "vermont-xlsx"
		|| source.retrievalPolicy
		|| source.postBody
		|| source.pageUrl !== vermontDiscoveryUrl
		|| source.documentUrls?.join("|") !== source.url
		|| source.id !== (source.electionDate === "2026-11-03" ? "vt-sos-2026" : `vt-general-${source.electionDate}`)
	) {
		throw new Error("The Vermont source identity is not configured.");
	}
}

function indexElection(body: string): VermontElection {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("The Vermont candidate index exceeds its bounds.");
	const document = parseStateHtml(body);
	const headings = descendants(document, node => node.nodeName === "h1");
	if (headings.length !== 1 || text(headings[0]!) !== "General Election Candidates")
		throw new Error("The Vermont candidate index changed.");
	const dates = descendants(document, node => node.nodeName === "p")
		.map(text)
		.filter(value => value.startsWith("Primary Election - "));
	const date
		= dates.length === 1
			&& /^Primary Election - Tuesday, [A-Za-z]+ \d{1,2}, (20\d{2}) \| General Election - Tuesday, November ([2-8]), \1$/u.exec(
				dates[0]!
			);
	if (!date) throw new Error("The Vermont general-election date is absent or ambiguous.");
	const links = descendants(
		document,
		node =>
			node.nodeName === "a" && text(node) === `${date[1]} General Election Candidate Listing/Financial Disclosure`
	);
	const policyLinks = [
		...new Set(
			descendants(
				document,
				node =>
					node.nodeName === "a"
					&& /privacy|terms of use|conditions of use|copyright policy|legal statement/iu.test(text(node))
			).map(node => new URL(attribute(node, "href"), vermontDiscoveryUrl).href)
		)
	];
	if (links.length !== 1 || policyLinks.join("|") !== "https://www.vermont.gov/policies/privacy")
		throw new Error("The Vermont candidate or policy links require review.");
	const election = {
		electionId: null,
		electionDate: `${date[1]}-11-0${date[2]}`,
		workbookUrl: new URL(attribute(links[0]!, "href"), vermontDiscoveryUrl).href
	};
	validateVermontElection(election);
	return election;
}

interface VermontCapture {
	schemaVersion: 1;
	type: "vermont-election-discovery";
	policies: typeof vermontPolicyReceipts;
	index: string;
	workbook: { url: string; sha256: string; retrievedAt: string; sheets: StateBallotWorkbookSheet[] };
}

function readCapture(body: string): {
	capture: VermontCapture;
	election: VermontElection;
	rows: StateBallotWorkbookSheet["data"];
} {
	if (Buffer.byteLength(body) > 6 * 1024 * 1024)
		throw new Error("The Vermont acquisition evidence exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (
		!exact(value, ["schemaVersion", "type", "policies", "index", "workbook"])
		|| value.schemaVersion !== 1
		|| value.type !== "vermont-election-discovery"
		|| JSON.stringify(value.policies) !== JSON.stringify(vermontPolicyReceipts)
		|| typeof value.index !== "string"
		|| !exact(value.workbook, ["url", "sha256", "retrievedAt", "sheets"])
	) {
		throw new Error("The Vermont acquisition evidence is invalid.");
	}
	const capture = value as unknown as VermontCapture;
	const election = indexElection(capture.index);
	const workbook = capture.workbook;
	if (
		workbook.url !== election.workbookUrl
		|| !/^[a-f0-9]{64}$/u.test(workbook.sha256)
		|| !Number.isFinite(Date.parse(workbook.retrievedAt))
		|| new Date(workbook.retrievedAt).toISOString() !== workbook.retrievedAt
		|| !Array.isArray(workbook.sheets)
		|| workbook.sheets.length !== 2
		|| workbook.sheets[0]?.sheet !== "Candidate Listing"
		|| workbook.sheets[1]?.sheet !== "Selection Criteria"
	) {
		throw new Error("The Vermont workbook identity or sheets changed.");
	}
	const rows = workbook.sheets[0].data;
	const criteria = workbook.sheets[1].data;
	if (
		!Array.isArray(rows)
		|| !rows.length
		|| rows.length > 25001
		|| JSON.stringify(rows[0]) !== JSON.stringify(headers)
		|| rows.some(
			row =>
				!Array.isArray(row)
				|| row.length > headers.length
				|| row.some(cell => cell !== null && !["string", "number", "boolean"].includes(typeof cell))
		)
		|| !Array.isArray(criteria)
		|| criteria.length !== 1
		|| criteria[0]?.length !== 1
		|| typeof criteria[0][0] !== "string"
	) {
		throw new Error("The Vermont workbook columns or selection metadata changed.");
	}
	const revision = /^Last Updated: (\d{1,2})\/(\d{1,2})\/(20\d{2})$/u.exec(criteria[0][0]);
	const revisionDate = revision && `${revision[3]}-${revision[1]!.padStart(2, "0")}-${revision[2]!.padStart(2, "0")}`;
	if (
		!revisionDate
		|| revision![3] !== election.electionDate.slice(0, 4)
		|| !Number.isFinite(Date.parse(revisionDate))
		|| new Date(revisionDate).toISOString().slice(0, 10) !== revisionDate
		|| Date.parse(revisionDate) > Date.parse(workbook.retrievedAt)
	) {
		throw new Error("The Vermont workbook revision date is invalid.");
	}
	return { capture, election, rows: rows.slice(1) };
}

export function readVermontElectionDiscovery(body: string) {
	return [readCapture(body).election];
}

export function parseVermontCandidateCapture(source: StateBallotSource, body: string) {
	validateVermontSource(source);
	const { capture, election, rows } = readCapture(body);
	if (election.electionDate !== source.electionDate || election.workbookUrl !== source.url)
		throw new Error("The Vermont candidate capture belongs to another election.");
	if (!rows.length) {
		if (source.id !== "vt-sos-2026") throw new StateBallotAwaitingRecordsError(source.id);
		throw new Error("The current Vermont candidate list is unexpectedly empty.");
	}
	const records: StateCandidateRecord[] = rows.map((row) => {
		const field = (position: number, maximum = 300) => {
			const value = row[position];
			if (
				typeof value !== "string"
				|| !clean(value)
				|| value.length > maximum
				|| containsControlCharacters(value)
			) {
				throw new Error("The Vermont candidate row is incomplete.");
			}
			return clean(value);
		};
		const office = field(0);
		const area = field(1);
		const name = field(2, 250);
		const literalParty = field(4);
		const party = literalParty === "UNKNOWN" ? undefined : literalParty;
		const scope = scopes[office];
		const termYears = row[13];
		const voteLimit
			= typeof row[14] === "number" ? row[14] : typeof row[14] === "string" ? voteWords.indexOf(row[14]) : 0;
		if (
			!scope
			|| (scope === "statewide") !== (area === "N/A")
			|| typeof termYears !== "number"
			|| !Number.isInteger(termYears)
			|| termYears < 1
			|| termYears > 10
			|| !Number.isInteger(voteLimit)
			|| voteLimit < 1
			|| voteLimit > 50
		) {
			throw new Error("The Vermont office, district, term or vote limit requires review.");
		}
		const district = "";
		const jurisdiction = scope === "local" ? area : undefined;
		const identity = [
			source.stateCode,
			source.electionDate,
			office.toLowerCase(),
			district,
			name.toLowerCase(),
			(party ?? "").toLowerCase(),
			...(scope === "state-senate" || scope === "state-house" || jurisdiction ? [area.toLowerCase()] : [])
		];
		let candidateUrl: string | undefined;
		if (typeof row[12] === "string" && !row[12].includes("@")) {
			const website = clean(row[12]);
			candidateUrl
				= normalizePublicHref(/^[a-z][a-z\d+.-]*:/iu.test(website) ? website : `https://${website}`) || undefined;
		}
		return {
			id: hash(JSON.stringify(identity)).slice(0, 24),
			name,
			office,
			...(party ? { party } : {}),
			district,
			scope,
			status: "listed",
			sourceStatus: "Official general-election candidate list",
			termYears,
			voteLimit,
			...(scope !== "statewide" ? { sourceDistrictLabel: area } : {}),
			...(jurisdiction ? { jurisdiction } : {}),
			...(candidateUrl ? { candidateUrl } : {})
		};
	});
	if (new Set(records.map(record => record.id)).size !== records.length)
		throw new Error("The Vermont candidate list repeats an identity.");
	const document = capture.workbook;
	return {
		records,
		retrievedAt: document.retrievedAt,
		sha256: hash(JSON.stringify([{ url: document.url, sha256: document.sha256 }])),
		documents: [
			{
				url: document.url,
				sha256: document.sha256,
				retrievedAt: document.retrievedAt,
				includedRecordCount: records.length
			}
		]
	};
}

const queues = new Map<string, { started: number; tail: Promise<void> }>();
async function spacedRequest<Value>(url: string, request: () => Promise<Value>) {
	const host = new URL(url).hostname;
	const queue = queues.get(host) ?? { started: 0, tail: Promise.resolve() };
	queues.set(host, queue);
	const result = queue.tail.then(async () => {
		await wait(Math.max(0, 1000 - (Date.now() - queue.started)));
		queue.started = Date.now();
		return request();
	});
	queue.tail = result.then(
		() => {},
		() => {}
	);
	return result;
}

export async function fetchVermontCycleDiscovery(
	options: {
		requestText?: VermontTextRequest;
		requestDocument?: typeof fetchRemoteSourceDocument;
		readWorkbook?: typeof readStateBallotWorkbook;
		now?: () => number;
	} = {}
) {
	const requestText = options.requestText ?? fetchRemoteSourceText;
	const requestDocument = options.requestDocument ?? fetchRemoteSourceDocument;
	await Promise.all(
		vermontPolicyReceipts.map(async (policy) => {
			const response = await spacedRequest(policy.url, () =>
				requestDocument(policy.url, {
					allowedHosts: [new URL(policy.url).hostname],
					maxBytes: 2 * 1024 * 1024,
					timeoutMs: 12000
				}));
			let digest: string;
			if (policy.region === "bytes") {
				digest = hash(response.body);
			}
			else {
				const regions = descendants(
					parseStateHtml(response.body.toString("utf8")),
					node => node.nodeName === "main"
				);
				if (regions.length !== 1) throw new Error("The Vermont policy layout changed.");
				digest = hash(text(regions[0]!));
			}
			if (response.status !== policy.status || digest !== policy.sha256)
				throw new Error("The Vermont publisher policy requires review.");
		})
	);
	const index = await spacedRequest(vermontDiscoveryUrl, () =>
		requestText(vermontDiscoveryUrl, {
			allowedHosts: ["sos.vermont.gov"],
			maxBytes: 2 * 1024 * 1024,
			maxRedirects: 0,
			timeoutMs: 12000
		}));
	const election = indexElection(index);
	const response = await spacedRequest(election.workbookUrl, () =>
		requestDocument(election.workbookUrl, {
			allowedHosts: ["outside.vermont.gov"],
			maxBytes: stateBallotWorkbookContract.maximumBytes,
			timeoutMs: 12000
		}));
	if (
		response.status !== 200
		|| response.contentType !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
		|| response.body.length > stateBallotWorkbookContract.maximumBytes
	) {
		throw new Error("The Vermont candidate workbook request failed.");
	}
	const sheets = await (options.readWorkbook ?? readStateBallotWorkbook)(response.body);
	const capture: VermontCapture = {
		schemaVersion: 1,
		type: "vermont-election-discovery",
		policies: vermontPolicyReceipts,
		index,
		workbook: {
			url: election.workbookUrl,
			sha256: hash(response.body),
			retrievedAt: new Date((options.now ?? Date.now)()).toISOString(),
			sheets
		}
	};
	const body = JSON.stringify(capture);
	readVermontElectionDiscovery(body);
	return body;
}

export async function fetchVermontCandidateCapture(
	source: StateBallotSource,
	discovery?: string,
	options: Parameters<typeof fetchVermontCycleDiscovery>[0] = {}
) {
	validateVermontSource(source);
	const body = discovery ?? (await fetchVermontCycleDiscovery(options));
	const election = readVermontElectionDiscovery(body)[0]!;
	if (election.electionDate !== source.electionDate || election.workbookUrl !== source.url)
		throw new Error("The Vermont acquisition does not match its selected election.");
	return body;
}
