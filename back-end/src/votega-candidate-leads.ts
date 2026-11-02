import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import { basename, dirname, isAbsolute, join, normalize } from "node:path";
import { parse as parseCsv } from "csv-parse/sync";
import { normalizePublicHref } from "./public-href.js";
import { isPublicRemoteAddress, parseRemoteJsonUrl } from "./remote-json-source.js";
import { configuredStateBallotSources } from "./state-ballot-registry.js";
import { parseBundledStateSnapshot } from "./state-ballot-snapshot.js";
import { assertExternalStateDataDirectory, readBoundedStateData } from "./state-ballot-storage.js";
import { containsControlCharacters } from "./text-validation.js";

export const voteGaPublication = {
	repository: "https://github.com/Votega/ga-races-elections",
	license: "CC-BY-SA-4.0",
	licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
	attribution: "Data from VoteGA.org, CC BY-SA 4.0. Original source: Georgia Secretary of State.",
} as const;

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const text = (value: unknown, maximum = 600): value is string => typeof value === "string" && value.length <= maximum && !containsControlCharacters(value);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const date = (value: unknown): value is string => typeof value === "string" && /^20\d{2}-\d{2}-\d{2}$/u.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const timestamp = (value: unknown, now: number): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now;
const normalized = (value: string) => value.normalize("NFC").toLowerCase().replace(/[’‘]/gu, "'").replace(/[“”]/gu, "\"").replace(/\s+/gu, " ").trim();
const personName = (value: string) => normalized(value.includes(",") && value.split(",").length === 2 ? value.split(",").reverse().join(" ") : value);
const party = (value: string) => normalized(value) === "democratic" ? "democrat" : normalized(value);
const columns = "raceId,level,chamber,district,cycle,phase,electionDate,party,name,type,isIncumbent,candidateId,memberId,memberSource,candidateKey";

interface PublicationBodies {
	commit: string;
	capturedAt: string;
	races: string;
	candidates: string;
	license: string;
	notice: string;
}

interface CandidateContext {
	key: string;
	name: string;
	names: string[];
	party: string;
	officeKey: string;
	website?: string;
	websiteHold?: "unsafe-or-noncanonical-url";
	occupation?: string;
	county?: string;
}

function officeKey(scope: StateCandidateRecord["scope"], office: string, district: string) {
	const label = normalized(office);
	if (["congressional", "state-senate", "state-house"].includes(scope)) {
		const expression = scope === "congressional" ? /^(?:united states house of representatives|u\.s\. house)(?: -)?(?: district (\d+))?$/u : scope === "state-senate" ? /^(?:state senate|georgia state senate)(?: -)?(?: district (\d+))?$/u : /^(?:state house(?: of representatives)?|georgia house of representatives)(?: -)?(?: district (\d+))?$/u;
		const matched = expression.exec(label);
		if (!matched || !/^\d{1,3}$/u.test(district) || Number(district) < 1 || (matched[1] && Number(matched[1]) !== Number(district))) return null;
		return `${scope}:${Number(district)}`;
	}
	if (scope !== "statewide") return null;
	if (["united states senate", "u.s. senate"].includes(label) && !district) return "us-senate";
	const commissioner = /^public service commission(?:er)?(?: district (\d+))?$/u.exec(label);
	if (commissioner && /^\d$/u.test(district) && Number(district) >= 1 && Number(district) <= 5 && (!commissioner[1] || Number(commissioner[1]) === Number(district))) return `psc:${Number(district)}`;
	const aliases: Record<string, string> = { "labor commissioner": "commissioner of labor", "insurance commissioner": "commissioner of insurance", "insurance & fire safety commissioner": "commissioner of insurance", "agriculture commissioner": "commissioner of agriculture" };
	const canonical = aliases[label] ?? label;
	return !district && ["governor", "lieutenant governor", "secretary of state", "attorney general", "commissioner of agriculture", "commissioner of insurance", "state school superintendent", "commissioner of labor"].includes(canonical) ? canonical : null;
}

function candidateContexts(bodies: PublicationBodies, electionDate: string, phase: string, now: number) {
	if (!/^[a-f0-9]{40}$/u.test(bodies.commit) || !timestamp(bodies.capturedAt, now) || !date(electionDate) || !["general", "primary", "runoff"].includes(phase) || [bodies.races, bodies.candidates].some(body => typeof body !== "string" || Buffer.byteLength(body) > 12 * 1024 * 1024)) throw new Error("Provide bounded VoteGA captures, an exact commit and an election phase/date.");
	if (!bodies.license.includes("Creative Commons Attribution-ShareAlike 4.0 International") || !bodies.notice.includes("CC-BY-SA-4.0") || !bodies.notice.includes("Georgia Secretary of State")) throw new Error("Retain the VoteGA license and upstream-source notice with the capture.");
	const publication = JSON.parse(bodies.races) as unknown;
	if (!object(publication) || !timestamp(publication.updatedAt, Date.parse(bodies.capturedAt)) || !Array.isArray(publication.races) || !publication.races.length || publication.races.length > 5_000) throw new Error("The VoteGA race publication has invalid provenance or bounds.");
	const rows = parseCsv(bodies.candidates, { columns: true, skip_empty_lines: true, max_record_size: 16_384 }) as Record<string, string>[];
	if (!rows.length || rows.length > 25_000 || rows.some(row => Object.keys(row).join(",") !== columns || Object.values(row).some(value => !text(value, 600)))) throw new Error("The VoteGA candidate table has an unreviewed schema or invalid fields.");
	const table = new Map<string, Record<string, string>[]>();
	for (const row of rows) {
		const key = JSON.stringify([row.raceId, row.phase, row.candidateKey]);
		table.set(key, [...table.get(key) ?? [], row]);
	}
	const identities = new Set<string>();
	const contexts: CandidateContext[] = [];
	const raceIds = new Set<string>();
	for (const race of publication.races) {
		if (!object(race) || !text(race.id, 150) || !race.id || raceIds.has(race.id) || !object(race.phases)) throw new Error("The VoteGA race identities are invalid or duplicated.");
		raceIds.add(race.id);
		if (race.cycle !== Number(electionDate.slice(0, 4))) continue;
		const selected = race.phases[phase];
		if (!object(selected) || selected.electionDate !== electionDate) continue;
		if (!text(race.chamber, 300) || !["federal", "state-executive", "state"].includes(String(race.level))) continue;
		const scope = race.level === "federal" && race.chamber === "U.S. House" ? "congressional" : race.level === "state" && race.chamber === "Georgia State Senate" ? "state-senate" : race.level === "state" && race.chamber === "Georgia House of Representatives" ? "state-house" : "statewide";
		const seat = race.district === undefined ? "" : String(race.district);
		const office = officeKey(scope, race.chamber, seat);
		if (!office) continue;
		if (selected.candidates !== undefined && selected.ballots !== undefined) throw new Error("A VoteGA phase has competing candidate representations.");
		const entries: { candidate: unknown; party: string }[] = [];
		if (selected.ballots !== undefined) {
			if (!object(selected.ballots)) throw new Error("The VoteGA party ballots are invalid.");
			for (const [label, candidates] of Object.entries(selected.ballots)) {
				if (!text(label, 100) || !label || !Array.isArray(candidates)) throw new Error("The VoteGA party ballots are invalid.");
				entries.push(...candidates.map(candidate => ({ candidate, party: label })));
			}
		}
		else if (Array.isArray(selected.candidates)) {
			entries.push(...selected.candidates.map(candidate => ({ candidate, party: "" })));
		}
		else {
			throw new TypeError("The VoteGA phase has no recognized candidate list.");
		}
		if (entries.length > 1_000) throw new Error("The VoteGA race exceeds its candidate bound.");
		for (const entry of entries) {
			const candidate = entry.candidate;
			if (!object(candidate)) throw new Error("The VoteGA candidate is invalid.");
			const key = candidate.id ?? candidate.memberId;
			if (!text(key, 150) || !key) throw new Error("The VoteGA candidate has no explicit identity.");
			const identity = `${race.id}/${phase}/${key}`;
			if (identities.has(identity)) throw new Error("The VoteGA candidate identity is duplicated.");
			identities.add(identity);
			const matching = table.get(JSON.stringify([race.id, phase, key])) ?? [];
			if (matching.length !== 1) throw new Error("The VoteGA JSON and candidate table do not have a unique join.");
			const row = matching[0]!;
			if (!row.name.trim() || row.electionDate !== electionDate || row.cycle !== String(race.cycle) || row.level !== race.level || row.chamber !== race.chamber || row.district !== seat || !row.party || (entry.party && party(row.party) !== party(entry.party)) || (candidate.party !== undefined && (!text(candidate.party, 100) || party(row.party) !== party(candidate.party)))) throw new Error("The VoteGA JSON and candidate table disagree on election, office or party.");
			const names = [row.name];
			for (const field of ["name", "legalName"]) {
				if (candidate[field] !== undefined) {
					if (!text(candidate[field], 250) || !candidate[field].trim()) throw new Error("A VoteGA candidate name is invalid.");
					names.push(candidate[field]);
				}
			}
			if (names.length > 1 && !names.slice(1).some(name => personName(name) === personName(row.name))) throw new Error("The VoteGA candidate table and JSON names disagree.");
			const context: CandidateContext = { key: identity, name: row.name, names: [...new Set(names.map(personName))], party: party(row.party), officeKey: office };
			for (const field of ["occupation", "county"] as const) {
				if (candidate[field] !== undefined && candidate[field] !== null && candidate[field] !== "") {
					if (!text(candidate[field]) || !candidate[field].trim()) throw new Error("The VoteGA candidate context has invalid text.");
					context[field] = candidate[field].trim();
				}
			}
			if (candidate.website !== undefined && candidate.website !== null && candidate.website !== "") {
				try {
					if (!text(candidate.website, 2_000)) throw new Error("Invalid website.");
					const url = parseRemoteJsonUrl(candidate.website);
					const href = normalizePublicHref(candidate.website);
					if (!href || href !== url.href) throw new Error("Invalid website.");
					const hostname = url.hostname.replace(/^\[|\]$/gu, "");
					if (isIP(hostname) && !isPublicRemoteAddress(hostname)) throw new Error("Private address.");
					context.website = href;
				}
				catch { context.websiteHold = "unsafe-or-noncanonical-url"; }
			}
			contexts.push(context);
		}
	}
	return { contexts, updatedAt: publication.updatedAt };
}

export function prepareVoteGaCandidateLeads(bodies: PublicationBodies, snapshots: readonly StateBallotSnapshot[], phase = "general", now = Date.now()) {
	const electionDate = snapshots[0]?.source.electionDate;
	if (!electionDate || !snapshots.length || snapshots.length > 100 || snapshots.some(snapshot => snapshot.source.stateCode !== "GA" || snapshot.source.electionDate !== electionDate || Date.parse(snapshot.retrievedAt) > now) || new Set(snapshots.map(snapshot => snapshot.source.id)).size !== snapshots.length) throw new Error("Provide distinct official Georgia snapshots for one election.");
	const { contexts, updatedAt } = candidateContexts(bodies, electionDate, phase, now);
	const records = snapshots.flatMap(snapshot => snapshot.records.map((record) => {
		const identity = { sourceId: snapshot.source.id, recordId: record.id, name: record.name, office: record.office, district: record.district, party: record.party ?? "" };
		const office = officeKey(record.scope, record.office, record.district);
		if (!["listed", "qualified", "filed", "write-in", "unopposed"].includes(record.status)) return { ...identity, status: "inactive-official-record" as const };
		if (!office) return { ...identity, status: "unsupported-office" as const };
		if (!record.party) return { ...identity, status: "missing-party" as const };
		const matches = contexts.filter(context => context.names.includes(personName(record.name)) && context.party === party(record.party!) && context.officeKey === office);
		if (matches.length !== 1) return { ...identity, status: matches.length ? "ambiguous" as const : "not-matched" as const };
		const matched = matches[0]!;
		return { ...identity, status: "review-required" as const, context: { key: matched.key, sourceName: matched.name, ...(matched.website ? { website: matched.website } : {}), ...(matched.websiteHold ? { websiteHold: matched.websiteHold } : {}), ...(matched.occupation ? { occupation: matched.occupation } : {}), ...(matched.county ? { residenceCounty: matched.county } : {}) } };
	}));
	return {
		schemaVersion: 1,
		type: "candidate-context-leads",
		stateCode: "GA",
		electionDate,
		phase,
		publication: { ...voteGaPublication, commit: bodies.commit, capturedAt: bodies.capturedAt, updatedAt, racesSha256: digest(bodies.races), candidatesSha256: digest(bodies.candidates), licenseSha256: digest(bodies.license), noticeSha256: digest(bodies.notice), url: `${voteGaPublication.repository}/blob/${bodies.commit}/races/${electionDate.slice(0, 4)}/races.json` },
		policy: { publicImport: false, qualificationAuthority: "official-snapshot-only", upstreamReuseReviewRequired: true, copiedBiographies: false, copiedImages: false, inferredIncumbency: false },
		snapshots: snapshots.map(snapshot => ({ sourceId: snapshot.source.id, sourceUrl: snapshot.source.pageUrl, sourceSha256: snapshot.sha256, retrievedAt: snapshot.retrievedAt, recordCount: snapshot.records.length })),
		counts: { officialRecords: records.length, publicationContexts: contexts.length, reviewRequired: records.filter(record => record.status === "review-required").length },
		records,
	};
}

export async function prepareVoteGaCandidateLeadFiles(path: string, now = Date.now()) {
	const plan = JSON.parse(await readBoundedStateData(path));
	const fields = ["races", "candidates", "license", "notice"] as const;
	if (!object(plan) || Object.keys(plan).sort().join(",") !== "candidateFiles,outputDirectory,phase,publication,schemaVersion,type" || plan.schemaVersion !== 1 || plan.type !== "votega-candidate-lead-preparation" || !["general", "primary", "runoff"].includes(String(plan.phase)) || !object(plan.publication) || Object.keys(plan.publication).sort().join(",") !== "candidates,capturedAt,commit,license,notice,races" || !Array.isArray(plan.candidateFiles) || !plan.candidateFiles.length || plan.candidateFiles.length > 100 || !plan.candidateFiles.every(file => typeof file === "string" && isAbsolute(file)) || typeof plan.outputDirectory !== "string" || !isAbsolute(plan.outputDirectory) || normalize(plan.outputDirectory) !== plan.outputDirectory) throw new Error("Provide a valid external VoteGA candidate-lead preparation plan.");
	const publication = plan.publication;
	const bodies: Record<string, string> = {};
	for (const field of fields) {
		const capture = publication[field];
		if (!object(capture) || Object.keys(capture).sort().join(",") !== "path,sha256" || typeof capture.path !== "string" || !isAbsolute(capture.path) || typeof capture.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(capture.sha256)) throw new Error("Every VoteGA input needs an absolute path and exact fingerprint.");
		bodies[field] = await readBoundedStateData(capture.path);
		if (digest(bodies[field]!) !== capture.sha256) throw new Error("A VoteGA capture does not match its fingerprint.");
	}
	const inputs = await Promise.all(plan.candidateFiles.map(async (file: string) => {
		const body = await readBoundedStateData(file);
		const metadata = JSON.parse(body);
		const source = configuredStateBallotSources.find(item => item.id === metadata?.sourceId);
		if (!source || !["manual-snapshot", "automatic"].includes(metadata.retrievalPolicy)) throw new Error("Candidate inputs must match configured official sources.");
		return { hash: { path: file, sha256: digest(body) }, snapshot: parseBundledStateSnapshot(source, body, metadata.retrievalPolicy) };
	}));
	const report = prepareVoteGaCandidateLeads({ ...bodies, commit: publication.commit, capturedAt: publication.capturedAt } as PublicationBodies, inputs.map(input => input.snapshot), String(plan.phase), now);
	assertExternalStateDataDirectory(plan.outputDirectory);
	const parent = await realpath(dirname(plan.outputDirectory));
	assertExternalStateDataDirectory(parent);
	if (join(parent, basename(plan.outputDirectory)) !== plan.outputDirectory) throw new Error("Candidate-lead output must use its physical directory.");
	await mkdir(plan.outputDirectory);
	await writeFile(join(plan.outputDirectory, "LICENSE"), bodies.license!, { flag: "wx" });
	await writeFile(join(plan.outputDirectory, "NOTICE.md"), bodies.notice!, { flag: "wx" });
	await writeFile(join(plan.outputDirectory, "candidate-context-leads.json"), `${JSON.stringify({ ...report, inputHashes: inputs.map(input => input.hash) }, null, 2)}\n`, { flag: "wx" });
	return { ...report.counts, outputDirectory: plan.outputDirectory, imported: false, publisherRequests: 0 };
}
