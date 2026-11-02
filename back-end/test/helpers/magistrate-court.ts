import type { MagistrateCourtCapture } from "../../src/magistrate-court-directory.js";
import { createHash } from "node:crypto";
import { magistrateCourtPublication, prepareMagistrateCourtDirectory } from "../../src/magistrate-court-directory.js";
import { magistrateTestRobots } from "./magistrate-robots.js";

export const magistrateTestTime = Date.parse("2026-11-02T00:00:00.000Z");
export const magistrateDigest = (value: string) => createHash("sha256").update(value).digest("hex");
export const magistratePolicyLink = "<footer><a href=\"/site/copyright\">Copyright Notices</a></footer>";
export const magistrateContent = (body: string) => `<div id="moduleContent">${body}</div>${magistratePolicyLink}`;

export function magistrateFixture(name = "Morgan Current", now = magistrateTestTime, redirect = true) {
	const origin = "https://www.magistratefulton.org";
	const capturedAt = new Date(now).toISOString();
	const year = new Date(now).getUTCFullYear();
	const chief = "Avery Future";
	const people = [{ name, url: `${origin}/Directory.aspx?EID=31` }, { name: "Taylor Second", url: `${origin}/directory.aspx?EID=32` }];
	const roster = magistrateContent(`<h1>Judges</h1>${people.map(person => `<div class="widget image pageStyles"><header><div><h3 data-headertext="Judge ${person.name}">Judge ${person.name}</h3></div></header><a href="${person.url}"><img src="/ImageRepository/test.jpg" alt="${person.name}"></a></div>`).join("")}`);
	const bodies = [magistrateTestRobots, magistrateContent(`CivicPlus Content Management System © 1997-${year} CivicPlus. All rights reserved. All content © 2006-${year} Fulton County Magistrate Court, GA and its representatives. All rights reserved.`), `<h1 class="widgetTitle">Judge ${chief}</h1>${magistratePolicyLink}`, roster, magistrateContent(`<h1>Chief Magistrate Judge</h1><p>${chief} is the current Chief Magistrate Judge.</p>`)];
	const urls = [...magistrateCourtPublication.policies.map(policy => policy.url), magistrateCourtPublication.homeUrl, magistrateCourtPublication.url, magistrateCourtPublication.chiefUrl];
	const documents: MagistrateCourtCapture["documents"] = urls.map((url, index) => ({ url, status: 200, capturedAt, sha256: magistrateDigest(bodies[index]!), body: bodies[index]! }));
	for (const person of people) {
		const location = `/m/directory/employee?eid=${new URL(person.url).searchParams.get("EID")}`;
		const body = magistrateContent(`<h2>${person.name}</h2><h3>Judges</h3><p>Judge ${person.name} serves on the court.</p>`);
		if (redirect) documents.push({ url: person.url, status: 302, location, capturedAt, sha256: magistrateDigest(""), body: "" });
		documents.push({ url: redirect ? origin + location : person.url, status: 200, capturedAt, sha256: magistrateDigest(body), body });
	}
	const capture: MagistrateCourtCapture = { schemaVersion: 1, type: "magistrate-court-capture", documents };
	return { capture, snapshot: prepareMagistrateCourtDirectory(capture, now), roster, people };
}
