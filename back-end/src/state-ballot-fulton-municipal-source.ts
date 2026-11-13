import type { StateBallotSource } from "./state-ballot-sources.js";
import assert from "node:assert/strict";

const fultonDiscoveryUrl = "https://fultoncountyga.gov/inside-fulton-county/fulton-county-departments/registration-and-elections/sample-ballots";
export interface FultonMunicipalElection { electionId: null; electionDate: string; pageUrl: string; municipalDocument: { url: string; sha256: string } }
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));

function date(value: string) {
	assert(/^20\d{2}-(?:11|12)-\d{2}$/u.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value && new Date(value).getUTCDay() === 2 && value >= "2025-12-02", "The municipal runoff election date requires review.");
}
export function fultonMunicipalSource(electionDate = "2025-12-02"): StateBallotSource {
	date(electionDate);
	return { id: `ga-fulton-municipal-runoff-${electionDate}`, stateCode: "GA", label: "Fulton County municipal runoff", electionDate, url: fultonDiscoveryUrl, pageUrl: fultonDiscoveryUrl, format: "fulton-municipal-pdf", countyName: "Fulton County", snapshotStorage: "external", ballotPreview: false };
}
export function validateFultonMunicipalSource(source: StateBallotSource) {
	assert.deepEqual(source, fultonMunicipalSource(source.electionDate), "The municipal runoff source configuration requires review.");
}
export function fultonMunicipalDocumentUrl(value: string) {
	const url = new URL(value, fultonDiscoveryUrl);
	assert(url.protocol === "https:" && ["fultoncountyga.gov", "www.fultoncountyga.gov"].includes(url.hostname) && !url.port && !url.username && !url.password && !url.search && !url.hash && /^\/-\/media\/[\w/-]+\.pdf$/u.test(url.pathname), "The municipal publication URL requires review.");
	return url.href;
}
export function validateFultonMunicipalElection(value: unknown): asserts value is FultonMunicipalElection {
	assert(exact(value, ["electionId", "electionDate", "pageUrl", "municipalDocument"]) && value.electionId === null && typeof value.electionDate === "string" && value.pageUrl === fultonDiscoveryUrl && exact(value.municipalDocument, ["url", "sha256"]) && typeof value.municipalDocument.url === "string" && /^[a-f\d]{64}$/u.test(String(value.municipalDocument.sha256)));
	date(value.electionDate);
	assert(fultonMunicipalDocumentUrl(value.municipalDocument.url) === value.municipalDocument.url);
}
