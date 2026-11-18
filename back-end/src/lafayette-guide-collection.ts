import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { prepareLafayetteBallotResearch } from "./prepare-lafayette-ballot-research.js";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { acquireStateBallotAutomationLock } from "./state-ballot-automation-lock.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { readBoundedStateDataBytes } from "./state-ballot-storage.js";

export const lafayetteGuideIndexUrl = "https://www.oneacadiana.org/advocacy/";
export const lafayetteGuidePolicyUrls = {
	robots: "https://www.oneacadiana.org/robots.txt",
	privacy: "https://www.oneacadiana.org/privacy-policy/",
	governmentRobots: "https://www.lafayettela.gov/robots.txt",
	governmentPrivacy: "https://www.lafayettela.gov/privacy-policy/"
} as const;
const governmentLink = "https://www.lafayettela.gov/millage";
const governmentPage = "https://www.lafayettela.info/";
const hash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const validHash = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{64}$/u.test(value);
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
const validDate = (value: unknown): value is string => typeof value === "string" && /^20\d{2}-\d{2}-\d{2}$/u.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const months = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December"
];
type AccessReview = Record<keyof typeof lafayetteGuidePolicyUrls, string> & { infoRobots: 404 };
interface CollectionPlan { schemaVersion: 1; type: "lafayette-guide-collection"; outputRoot: string; electionDate: string | null; accessReview: AccessReview }
interface Capture { url: string; status: number; sha256: string; bytes: number; capturedAt: string; contentType: string; location: string | null; path: string }
interface Options { fetchDocument?: typeof fetchRemoteSourceDocument; sleep?: (milliseconds: number) => Promise<void>; now?: () => number; extract?: (body: Buffer) => Promise<string> }

function reject(): never {
	throw new Error("The Lafayette guide publication or access policy requires review.");
}
function document(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) return reject();
	return parseStateHtml(body);
}
function main(body: string, official = false) {
	const parsed = document(body);
	const regions = descendants(parsed, node => official
		? node.nodeName === "main"
		: attribute(node, "id") === "main-content");
	if (regions.length !== 1) return reject();
	return regions[0]!;
}
function legalLinks(body: string, origin: string, expected: string[]) {
	const links = [
		...new Set(descendants(document(body), node => node.nodeName === "a" && /privacy|terms|copyright|disclaimer/iu.test(`${stateHtmlText(node)} ${attribute(node, "href")}`)).map(node => new URL(attribute(node, "href"), origin).href))
	].sort();
	if (links.join("\n") !== [...expected].sort().join("\n")) return reject();
}
export function lafayetteGuideLocalDate(clock: number) {
	if (!Number.isFinite(clock)) return reject();
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: "America/Chicago",
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).formatToParts(clock);
	const value = ["year", "month", "day"].map(kind => parts.find(part => part.type === kind)?.value).join("-");
	if (!validDate(value)) return reject();
	return value;
}
export function lafayetteGuidePolicyHash(body: string, kind: keyof typeof lafayetteGuidePolicyUrls) {
	if (kind === "robots") {
		if (body.trim()) return reject();
		return hash("");
	}
	if (kind === "governmentRobots") {
		const expected = "User-agent: * Disallow: /bin/ Disallow: /config/ Disallow: /install/ Disallow: /umbraco/ Disallow: /views/ Disallow: /sandbox/ Sitemap: https://www.lafayettela.gov/sitemap-xml/";
		if (clean(body) !== expected) return reject();
		return hash(clean(body));
	}
	const official = kind === "governmentPrivacy";
	legalLinks(body, lafayetteGuidePolicyUrls[kind], [lafayetteGuidePolicyUrls[kind]]);
	const content = clean(stateHtmlText(main(body, official)));
	if (!content.includes("Privacy Policy") || content.length < 100) return reject();
	return hash(content);
}
export function discoverAcadianaElectionHub(body: string, preferredYear?: number) {
	if (preferredYear !== undefined && (!Number.isInteger(preferredYear) || preferredYear < 2026 || preferredYear > 2099)) return reject();
	legalLinks(body, lafayetteGuideIndexUrl, [lafayetteGuidePolicyUrls.privacy]);
	const links = descendants(document(body), node => node.nodeName === "a" && /elections-hub/u.test(attribute(node, "href"))).map((node) => {
		const url = new URL(attribute(node, "href"), lafayetteGuideIndexUrl);
		const match = /^\/advocacy\/(20\d{2})-elections-hub\/$/u.exec(url.pathname);
		if (!match || url.origin !== "https://www.oneacadiana.org" || url.search || url.hash || url.username || url.password || clean(stateHtmlText(node)) !== `${match[1]} Elections Hub`) return reject();
		return {
			url: url.href,
			year: Number(match[1])
		};
	});
	const offered = [
		...new Map(links.map(link => [link.url, link])).values()
	];
	if (!offered.length || offered.length > 20) return reject();
	return offered.find(hub => hub.year === preferredYear) ?? offered.sort((first, second) => second.year - first.year)[0]!;
}
export function discoverAcadianaBallotGuides(body: string, hub: { url: string; year: number }) {
	if (hub.url !== `https://www.oneacadiana.org/advocacy/${hub.year}-elections-hub/` || !Number.isInteger(hub.year) || hub.year < 2026 || hub.year > 2099) return reject();
	legalLinks(body, hub.url, [lafayetteGuidePolicyUrls.privacy]);
	const region = main(body);
	const headings = descendants(region, node => node.nodeName === "h1");
	if (headings.length !== 1 || clean(stateHtmlText(headings[0]!)) !== `${hub.year} Elections Hub`) return reject();
	const rows = descendants(region, node => node.nodeName === "a" && /Ballot\s*Guide/iu.test(`${stateHtmlText(node)} ${attribute(node, "href")}`)).map((node) => {
		const url = new URL(attribute(node, "href"), hub.url);
		const match = /^\/wp-content\/uploads\/GeauxVote_([A-Za-z]{3})(20\d{2})_BallotGuide-FINAL(?:-v[1-9]\d?)?\.pdf$/u.exec(url.pathname);
		const label = /^(?:View 1A[’']s )?([A-Za-z]+) (\d{1,2}) Ballot Guide$/u.exec(clean(stateHtmlText(node)));
		const month = label
			? months.indexOf(label[1]!) + 1
			: 0;
		const electionDate = `${hub.year}-${String(month).padStart(2, "0")}-${label?.[2]?.padStart(2, "0")}`;
		if (!match || !label || !validDate(electionDate) || match[2] !== String(hub.year) || match[1] !== label[1]!.slice(0, 3) || url.origin !== "https://www.oneacadiana.org" || url.search || url.hash || url.username || url.password) return reject();
		return { electionDate, url: url.href };
	});
	const offered = [
		...new Map(rows.map(row => [row.url, row])).values()
	].sort((first, second) => first.electionDate.localeCompare(second.electionDate));
	if (offered.length > 12 || new Set(offered.map(row => row.electionDate)).size !== offered.length) return reject();
	const governmentLinks = descendants(region, node => node.nodeName === "a").filter(node => new URL(attribute(node, "href"), hub.url).href === governmentLink);
	return { guides: offered, governmentLinked: governmentLinks.length > 0 };
}
async function persist(directory: string, name: string, body: string | Buffer) {
	const handle = await open(join(directory, name), "wx", 0o600);
	try {
		await handle.writeFile(body);
		await handle.sync();
	}
	finally { await handle.close(); }
}
export async function readLafayetteGuideCollectionPlan(planPath: string) {
	const value: unknown = JSON.parse((await readBoundedStateDataBytes(planPath, 32768)).toString("utf8"));
	if (!exact(value, [
		"schemaVersion",
		"type",
		"outputRoot",
		"electionDate",
		"accessReview"
	]) || value.schemaVersion !== 1 || value.type !== "lafayette-guide-collection" || typeof value.outputRoot !== "string" || (value.electionDate !== null && !validDate(value.electionDate)) || !exact(value.accessReview, [
		...Object.keys(lafayetteGuidePolicyUrls),
		"infoRobots"
	]) || value.accessReview.infoRobots !== 404 || !Object.keys(lafayetteGuidePolicyUrls).every(kind => validHash((value.accessReview as Record<string, unknown>)[kind]))) {
		return reject();
	}
	return value as unknown as CollectionPlan;
}
export async function collectLafayetteGuideResearch(planPath: string, options: Options = {}) {
	const value = await readLafayetteGuideCollectionPlan(planPath);
	const review = value.accessReview;
	const lock = await acquireStateBallotAutomationLock(value.outputRoot);
	const captures: Capture[] = [];
	let outputDirectory: string | undefined;
	let previous = -Infinity;
	let totalBytes = 0;
	const now = options.now ?? Date.now;
	try {
		outputDirectory = join(lock.directory, `intake-${Date.now()}-${randomUUID()}`);
		await mkdir(outputDirectory, { mode: 0o700 });
		const directory = outputDirectory;
		async function request(url: string, maximumBytes = 2 * 1024 * 1024) {
			if (captures.length >= 12 || captures.some(capture => capture.url === url)) return reject();
			await (options.sleep ?? wait)(Math.max(0, 11000 - (now() - previous)));
			previous = now();
			const response = await (options.fetchDocument ?? fetchRemoteSourceDocument)(url, {
				allowedHosts: [new URL(url).hostname],
				maxBytes: maximumBytes,
				timeoutMs: 20000
			});
			const capturedAt = new Date(now()).toISOString();
			totalBytes += response.body.length;
			if (response.body.length > maximumBytes || totalBytes > 32 * 1024 * 1024) return reject();
			const sha256 = hash(response.body);
			const path = `${String(captures.length + 1).padStart(2, "0")}-${sha256}.bin`;
			await persist(directory, path, response.body);
			const capture = {
				url,
				status: response.status,
				sha256,
				bytes: response.body.length,
				capturedAt,
				contentType: response.contentType,
				location: response.location ?? null,
				path
			};
			await persist(directory, `${path}.json`, `${JSON.stringify(capture, null, 2)}\n`);
			captures.push(capture);
			return { ...capture, body: response.body };
		}
		function html(capture: Awaited<ReturnType<typeof request>>) {
			if (capture.status !== 200 || !capture.bytes || !/^text\/(?:html|plain)$/u.test(capture.contentType)) return reject();
			return capture.body.toString("utf8");
		}
		for (const kind of ["robots", "privacy"] as const) {
			const capture = await request(lafayetteGuidePolicyUrls[kind]);
			if (capture.status !== 200 || !/^text\/(?:html|plain)$/u.test(capture.contentType) || lafayetteGuidePolicyHash(capture.body.toString("utf8"), kind) !== review[kind]) return reject();
		}
		const today = lafayetteGuideLocalDate(now());
		const preferredYear = Number((value.electionDate ?? today).slice(0, 4));
		const hub = discoverAcadianaElectionHub(html(await request(lafayetteGuideIndexUrl)), preferredYear);
		const edition = discoverAcadianaBallotGuides(html(await request(hub.url)), hub);
		const selected = value.electionDate === null
			? edition.guides.find(guide => guide.electionDate >= today)
			: edition.guides.find(guide => guide.electionDate === value.electionDate);
		let preparation: Awaited<ReturnType<typeof prepareLafayetteBallotResearch>> | null = null;
		if (selected) {
			if (!edition.governmentLinked) return reject();
			const guide = await request(selected.url, 12 * 1024 * 1024);
			if (guide.status !== 200 || guide.contentType !== "application/pdf" || !guide.body.subarray(0, 5).equals(Buffer.from("%PDF-"))) return reject();
			for (const kind of ["governmentRobots", "governmentPrivacy"] as const) {
				const capture = await request(lafayetteGuidePolicyUrls[kind]);
				if (lafayetteGuidePolicyHash(html(capture), kind) !== review[kind]) return reject();
			}
			const bridge = await request(governmentLink);
			if (![301, 302].includes(bridge.status) || bridge.location !== "https://lafayettela.info") return reject();
			const robots = await request("https://lafayettela.info/robots.txt");
			if (robots.status !== 301 || robots.location !== "https://www.lafayettela.info/robots.txt") return reject();
			const canonicalRobots = await request(robots.location);
			if (canonicalRobots.status !== review.infoRobots) return reject();
			const redirect = await request("https://lafayettela.info/");
			if (redirect.status !== 301 || redirect.location !== governmentPage) return reject();
			const government = await request(governmentPage);
			const governmentBody = html(government);
			legalLinks(governmentBody, governmentPage, []);
			const pin = (capture: Capture) => ({
				path: join(directory, capture.path),
				sha256: capture.sha256,
				url: capture.url,
				capturedAt: capture.capturedAt
			});
			const researchPlan = {
				schemaVersion: 1,
				type: "lafayette-ballot-research-preparation",
				electionDate: selected.electionDate,
				guide: pin(guide),
				governmentPage: pin(government),
				outputDirectory: join(directory, "research")
			};
			await persist(directory, "research-plan.json", `${JSON.stringify(researchPlan, null, 2)}\n`);
			preparation = await prepareLafayetteBallotResearch(join(directory, "research-plan.json"), options.extract);
		}
		const report = {
			schemaVersion: 1,
			type: "lafayette-guide-capture",
			status: selected ? "prepared-for-review" : "awaiting-offered-guide",
			requestedElectionDate: value.electionDate,
			hub,
			edition,
			selected: selected ?? null,
			accessReview: review,
			captures,
			preparation,
			imported: false,
			publicationApproved: false,
			automaticImportApproved: false,
			personalApplicabilityVerified: false
		};
		const body = `${JSON.stringify(report, null, 2)}\n`;
		await persist(directory, "capture.json", body);
		const handle = await open(directory, "r");
		try {
			await handle.sync();
		}
		finally { await handle.close(); }
		return {
			outputDirectory,
			status: report.status,
			electionDate: selected?.electionDate ?? null,
			captureSha256: hash(body),
			preparation,
			imported: false,
			publicationApproved: false
		};
	}
	catch (error) {
		if (outputDirectory) {
			await persist(outputDirectory, "failure.json", `${JSON.stringify({
				schemaVersion: 1,
				status: "review-required",
				captures,
				error: error instanceof Error
					? error.message.slice(0, 500)
					: "Collection failed.",
				imported: false,
				publicationApproved: false
			}, null, 2)}\n`);
		}
		throw error;
	}
	finally { await lock.release(); }
}
