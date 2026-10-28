import type { CourtDirectorySnapshot } from "../../src/court-directories.js";
import { createHash } from "node:crypto";
import { courtDirectoryPublication, parseCourtDirectory } from "../../src/court-directories.js";

export const courtTestTime = Date.parse("2026-10-28T00:00:00.000Z");
export const courtDigest = (value: string) => createHash("sha256").update(value).digest("hex");
export const courtPolicyLinks = `<footer><a href="/privacy-policy/">Privacy Policy</a><a href="/terms-of-use/">Terms of Use</a><a href="/legal-disclaimer/">Legal Disclaimer</a></footer>`;

export function courtFixture(name = "Avery Future", now = courtTestTime) {
	const people = [{ name, role: "Chief Judge", division: "A" }, { name: "Morgan Second", role: "Judge", division: "B" }];
	const profiles = people.map(person => ({ ...person, url: `https://fultonstate.org/judge-${person.name.toLowerCase().replaceAll(" ", "-")}/`, body: `<main id="inner-wrap"><h1>Judge ${person.name}</h1><h2>Division ${person.division} | Courtroom 2F</h2></main>${courtPolicyLinks}` }));
	const body = `<ul id="primary-menu">${profiles.map(person => `<li><a href="${person.url}">${person.role} ${person.name}</a></li>`).join("")}</ul><main id="inner-wrap"><h1>The JUDGES</h1><p>State Court of Fulton County</p><div>${profiles.map(person => `<div><div><h3>${person.name.toUpperCase()}</h3><p>${person.role === "Chief Judge" ? "CHIEF JUDGE | " : ""}Division ${person.division} | 2F</p><a href="${person.url}">View Profile →</a></div></div>`).join("")}</div></main>${courtPolicyLinks}`;
	const capturedAt = new Date(now).toISOString();
	const documents = [...courtDirectoryPublication.policies.map(policy => ({ url: policy.url, capturedAt, sha256: courtDigest(policy.url) })), { url: courtDirectoryPublication.url, capturedAt, sha256: courtDigest(body) }, ...profiles.map(profile => ({ url: profile.url, capturedAt, sha256: courtDigest(profile.body) }))];
	const { sourceId, slug, title, countyFips, url } = courtDirectoryPublication;
	const snapshot: CourtDirectorySnapshot = { schemaVersion: 1, type: "court-directory", sourceId, slug, title, countyFips, url, retrievedAt: capturedAt, sourceSha256: courtDigest(JSON.stringify(documents)), documents, judges: parseCourtDirectory(body) };
	return { body, profiles, snapshot };
}
