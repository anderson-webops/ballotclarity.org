import type { AlabamaReferenceElection } from "./state-ballot-alabama-discovery.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { alabamaDiscoveryUrl } from "./state-ballot-alabama-discovery.js";
import { alabamaHash } from "./state-ballot-alabama-types.js";

export { alabamaDiscoveryUrl } from "./state-ballot-alabama-discovery.js";

export const alabamaOrigin = "https://www.sos.alabama.gov";
export const alabamaRobotsSha256 = "8e8cb58d810473a52cce903be5ffb73d948eef981bbd101cffbf8dc2c02fcf4e";
function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
	return Boolean(
		value
		&& typeof value === "object"
		&& !Array.isArray(value)
		&& Object.keys(value).sort().join("|") === [...keys].sort().join("|")
	);
}
export function alabamaGeneralDate(value: unknown): value is string {
	if (typeof value !== "string" || !/^20\d{2}-11-0[2-8]$/u.test(value)) return false;
	const date = new Date(`${value}T00:00:00Z`);
	return (
		date.getUTCFullYear() >= 2026
		&& date.getUTCFullYear() % 2 === 0
		&& date.getUTCDay() === 2
		&& date.toISOString().slice(0, 10) === value
	);
}
export function validateAlabamaCountyDocument(
	county: unknown,
	url: unknown,
	electionDate: unknown
): asserts county is string {
	if (
		!alabamaGeneralDate(electionDate)
		|| typeof county !== "string"
		|| !/^[A-Z][A-Za-z. ]{1,40}$/u.test(county)
		|| typeof url !== "string"
	) {
		throw new Error("The Alabama county publication identity requires review.");
	}
	const prefix = `${alabamaOrigin}/sites/default/files/sample-ballots/${electionDate.slice(0, 4)}/gen/`;
	const filename = url.startsWith(prefix)
		? /^([A-Za-z]+(?:[.-][A-Za-z]+)*)[-_]Sample\.pdf$/u.exec(url.slice(prefix.length))
		: null;
	if (!filename || filename[1].replace(/[.-]/gu, "").toLowerCase() !== county.replace(/[. ]/gu, "").toLowerCase())
		throw new Error("The Alabama offered county document requires review.");
}
export function validateAlabamaElection(value: unknown): asserts value is AlabamaReferenceElection {
	if (
		!exact(value, [
			"electionDate",
			"pageUrl",
			"sampleIndexUrl",
			"certifications",
			"countyBallots",
			"statewideBackUrl"
		])
		|| !alabamaGeneralDate(value.electionDate)
	) {
		throw new Error("The Alabama offered election requires review.");
	}
	const year = value.electionDate.slice(0, 4);
	if (
		value.pageUrl !== `${alabamaDiscoveryUrl}/${year}`
		|| value.sampleIndexUrl !== `${alabamaOrigin}/alabama-votes/${year}-general-election-sample-ballots`
		|| value.statewideBackUrl
		!== `${alabamaOrigin
		}/sites/default/files/sample-ballots/${
			year
		}/gen/${
			year
		}GeneralElectionStatewideBack.pdf`
	) {
		throw new Error("The Alabama election publication links require review.");
	}
	if (
		!Array.isArray(value.countyBallots)
		|| !value.countyBallots.length
		|| value.countyBallots.length > 67
		|| !Array.isArray(value.certifications)
		|| value.certifications.length < 3
		|| value.certifications.length > 25
	) {
		throw new Error("The Alabama county or certification inventory requires review.");
	}
	const counties = new Set<string>();
	const urls = new Set<string>();
	for (const sample of value.countyBallots) {
		if (!exact(sample, ["county", "url"])) throw new Error("The Alabama county reference requires review.");
		validateAlabamaCountyDocument(sample.county, sample.url, value.electionDate);
		const key = sample.county.replace(/[. ]/gu, "").toLowerCase();
		if (counties.has(key) || urls.has(String(sample.url)))
			throw new Error("The Alabama county references are duplicated.");
		counties.add(key);
		urls.add(String(sample.url));
	}
	const certifications = value.certifications;
	const labels
		= /^(?:State Certification of (?:Democratic Party Candidates|Republican Party Candidates|Independent Candidate|Constitutional Amendments)|Certification of (?:Democratic|Republican) Party Candidates|Amended Certification of Democratic Party Candidates|Republican Party Amended Certification of Candidates)$/u;
	for (const item of certifications) {
		if (
			!exact(item, ["label", "url"])
			|| typeof item.label !== "string"
			|| !labels.test(item.label)
			|| typeof item.url !== "string"
			|| !item.url.startsWith(`${alabamaOrigin}/sites/default/files/election-${year}/`)
			|| !/^[\w.-]+\.pdf$/u.test(
				item.url.slice((`${alabamaOrigin}/sites/default/files/election-${year}/`).length)
			)
			|| urls.has(item.url)
		) {
			throw new Error("The Alabama certification controls require review.");
		}
		urls.add(item.url);
	}
	for (const label of [
		"State Certification of Democratic Party Candidates",
		"State Certification of Republican Party Candidates"
	]) {
		if (certifications.filter(item => item.label === label).length !== 1)
			throw new Error("The Alabama certification controls are incomplete.");
	}
}
export function alabamaCountySource(election: AlabamaReferenceElection, county: string): StateBallotSource {
	validateAlabamaElection(election);
	const sample = election.countyBallots.find(item => item.county === county);
	if (!sample) throw new Error("The selected Alabama county is not offered.");
	return {
		stateCode: "AL",
		id: `al-county-general-${county.replace(/[. ]/gu, "").toLowerCase()}-${election.electionDate}`,
		label: `${county} County sample ballot`,
		electionDate: election.electionDate,
		url: sample.url,
		pageUrl: election.sampleIndexUrl,
		format: "alabama-pdf",
		countyName: `${county} County`,
		defaultPriority: -50,
		ballotPreview: false,
		snapshotStorage: "external",
		documentUrls: [sample.url],
		documentLinks: [{ label: "Sample ballot", url: sample.url }]
	};
}
export function validateAlabamaSource(source: StateBallotSource, election?: AlabamaReferenceElection) {
	const county = source.countyName?.endsWith(" County") ? source.countyName.slice(0, -7) : "";
	validateAlabamaCountyDocument(county, source.url, source.electionDate);
	const expected: StateBallotSource = {
		stateCode: "AL",
		id: `al-county-general-${county.replace(/[. ]/gu, "").toLowerCase()}-${source.electionDate}`,
		label: `${county} County sample ballot`,
		electionDate: source.electionDate,
		url: source.url,
		pageUrl:
			`${alabamaOrigin}/alabama-votes/${source.electionDate.slice(0, 4)}-general-election-sample-ballots`,
		format: "alabama-pdf",
		countyName: `${county} County`,
		defaultPriority: -50,
		ballotPreview: false,
		snapshotStorage: "external",
		documentUrls: [source.url],
		documentLinks: [{ label: "Sample ballot", url: source.url }]
	};
	if (JSON.stringify(source) !== JSON.stringify(expected))
		throw new Error("The Alabama native source configuration requires review.");
	if (election && JSON.stringify(source) !== JSON.stringify(alabamaCountySource(election, county)))
		throw new Error("The Alabama county source disagrees with its offered election.");
	return county;
}
export function alabamaDocumentDigest(election: AlabamaReferenceElection, county: string) {
	const source = alabamaCountySource(election, county);
	return alabamaHash(
		JSON.stringify({
			electionDate: election.electionDate,
			county,
			url: source.url,
			certifications: election.certifications,
			statewideBackUrl: election.statewideBackUrl
		})
	);
}
