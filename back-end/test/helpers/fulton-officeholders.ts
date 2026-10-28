import type { FultonOfficeholderSnapshot } from "../../src/fulton-officeholders.js";
import { createHash } from "node:crypto";
import { fultonOfficeholderPublication, parseFultonBoardSeats } from "../../src/fulton-officeholders.js";

export const officeholderTestTime = Date.parse("2026-10-27T00:00:00.000Z");
export const officeholderHash = (value: string) => createHash("sha256").update(value).digest("hex");
const people = ["Avery Chair", "Alex One", "Blair Two", "Casey Three", "Vacant", "Drew Five", "Elliot Six"];
const slug = (name: string) => name.replaceAll(" ", "-");

export function exampleFultonPublications(chair = people[0]!, fillDistrictFour = false) {
	const names = [chair, ...people.slice(1)];
	if (fillDistrictFour) names[4] = "Morgan Four";
	const footer = `<footer><a href="/Privacy-Statement">Privacy Statement</a></footer>`;
	const roster = `<main>seven-member Board of Commissioners; Chairman representing all of Fulton County${names.flatMap((name, district) => name === "Vacant" ? [] : [`<div class="bio-card"><h4 class="bio-card__name">${district === 6 ? "Vice Chair " : ""}${name}</h4><div class="bio-card__position">${district ? `District ${district}` : "Chairman"}</div><div class="bio-card__frame" style="background-image: url(/-/media/Commissioners/${district}.png);"></div><a href="/Commissioners/${slug(name)}">Read more</a><a href="/Commissioners/${slug(name)}">Read more</a></div>`]).join("")}</main>${footer}`;
	const finder = `<main>${names.slice(1).map((name, position) => `<h3>District ${position + 1} - ${name}</h3>`).join("")}</main>${footer}`;
	return { roster, finder };
}

export function exampleFultonOfficeholders(chair = people[0]!, fillDistrictFour = false, now = officeholderTestTime): FultonOfficeholderSnapshot {
	const publication = exampleFultonPublications(chair, fillDistrictFour);
	const capturedAt = new Date(now).toISOString();
	const urls = [...fultonOfficeholderPublication.policies.map(policy => policy.url), fultonOfficeholderPublication.rosterUrl, fultonOfficeholderPublication.districtUrl];
	const documents = urls.map((url, index) => ({ url, capturedAt, sha256: officeholderHash(index === 2 ? publication.roster : index === 3 ? publication.finder : `Controlled policy metadata ${index}`) }));
	return { schemaVersion: 1, type: "fulton-officeholders", sourceId: "ga-fulton-board", countyFips: "13121", retrievedAt: capturedAt, sourceSha256: officeholderHash(JSON.stringify(documents)), documents, seats: parseFultonBoardSeats(publication.roster, publication.finder) };
}
