import type { FultonCountyOfficeholderSnapshot } from "../../src/fulton-county-officeholders.js";
import { createHash } from "node:crypto";
import { fultonCountyOfficeholderPublication, parseFultonCountyOffice } from "../../src/fulton-county-officeholders.js";

export const countyOfficeTestTime = Date.parse("2026-10-27T00:00:00.000Z");
export const countyOfficeHash = (value: string) => createHash("sha256").update(value).digest("hex");
const footer = `<footer><a href="/Privacy-Statement">Privacy Statement</a></footer>`;

export function exampleCountyOfficePages(sheriffName = "Avery First", vacant = false) {
	return fultonCountyOfficeholderPublication.offices.map((definition) => {
		const name = definition.id === "sheriff" ? sheriffName : "Jordan Second";
		const sourceName = definition.id === "sheriff" ? `Sheriff ${name}` : name;
		const profileUrl = `https://fultoncountyga.gov${definition.profilePrefix}${name.replaceAll(" ", "-")}`;
		const card = `<div class="bio-card"><h4 class="bio-card__name">${vacant && definition.id === "sheriff" ? "Vacant" : sourceName}</h4><div class="bio-card__position">${definition.role}</div><div class="bio-card__frame" style="background-image: url(/-/media/Departments/${definition.id}/portrait.png);"></div><a href="${profileUrl}">Read More</a></div>`;
		const page = `<main><h1>Fulton County ${definition.role}</h1>${card}</main>${footer}`;
		const profile = `<main><h1 class="name">${sourceName}</h1><p>${definition.role}, Fulton County</p></main>${footer}`;
		return { definition, name, profileUrl, page, profile };
	});
}

export function exampleCountyOfficeholders(sheriffName = "Avery First", vacant = false, now = countyOfficeTestTime): FultonCountyOfficeholderSnapshot {
	const pages = exampleCountyOfficePages(sheriffName, vacant);
	const capturedAt = new Date(now).toISOString();
	const offices = pages.map(row => parseFultonCountyOffice(row.page, row.definition));
	const documents = [
		...fultonCountyOfficeholderPublication.policies.map((policy, index) => ({ url: policy.url, capturedAt, sha256: countyOfficeHash(`Controlled county policy ${index}`) })),
		...pages.flatMap((row, index) => [{ url: row.definition.pageUrl, capturedAt, sha256: countyOfficeHash(row.page) }, ...(offices[index]!.person ? [{ url: row.profileUrl, capturedAt, sha256: countyOfficeHash(row.profile) }] : [])])
	];
	return { schemaVersion: 1, type: "fulton-county-officeholders", sourceId: "ga-fulton-county-offices", countyFips: "13121", retrievedAt: capturedAt, sourceSha256: countyOfficeHash(JSON.stringify(documents)), documents, offices };
}
