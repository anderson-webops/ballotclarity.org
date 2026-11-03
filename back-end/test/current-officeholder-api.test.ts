import type { AddressInfo } from "node:net";
import type { CongressMemberDetail } from "../src/congress.js";
import assert from "node:assert/strict";
import { once } from "node:events";
import process from "node:process";
import test from "node:test";
import { createOpenStatesClient } from "../src/openstates.js";
import { createApp } from "../src/server.js";

process.env.ADMIN_STORE_DRIVER = "sqlite";
delete process.env.ADMIN_DATABASE_URL;
delete process.env.DATABASE_URL;

test("historical name matches cannot prevent a current federal profile or restore a former office", async (context) => {
	const former = { id: "former-alex", name: "Alex Example", jurisdiction: { name: "Georgia" }, current_role: null, links: [{ url: "https://example.org/former-state-office", note: "homepage" }], updated_at: "2021-10-08" };
	const openStatesClient = createOpenStatesClient({ apiKey: "controlled-openstates-key", fetchImpl: (async () => new Response(JSON.stringify({ results: [former] }), { status: 200 })) as typeof fetch });
	const currentMember = true;
	const detail: CongressMemberDetail = { bioguideId: "E000001", currentMember: true, district: 5, directOrderName: "Alex Example", officialWebsiteUrl: "https://example.org/current-federal-office", party: "Example Party", state: "Georgia", terms: [{ chamber: "House of Representatives", congress: 119, district: 5, memberType: "Representative", startYear: 2025, stateCode: "GA", stateName: "Georgia" }], updatedAt: "2026-11-02T12:00:00Z" };
	const app = await createApp({
		adminDbPath: ":memory:",
		adminMfaEncryptionKey: "controlled-current-office-mfa-key-long-enough",
		activeLookupCookieSecret: "controlled-current-office-cookie-key-long-enough",
		stateBallotRepository: null,
		electionReferenceRepository: null,
		fultonOfficeholderRepository: null,
		fultonCountyOfficeholderRepository: null,
		openStatesClient,
		congressClient: {
			async listMembers() { return [{ bioguideId: "E000001", currentMember, district: 5, name: "Example, Alex", party: "Example Party", state: "Georgia" }]; },
			async listMembersByState() { return []; },
			async getMember() { return { ...detail, currentMember }; }
		},
		googleCivicClient: null,
		openFecClient: null,
		ldaClient: null,
		addressEnrichmentService: null,
		locationGuessOptions: { mode: "disabled" }
	});
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	context.after(async () => {
		await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
		await app.closeResources();
	});
	const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	const response = await fetch(`${base}/api/representatives/alex-example`);
	assert.equal(response.status, 200);
	const body = await response.json();
	assert.equal(body.person.name, "Alex Example");
	assert.equal(body.person.governmentLevel, "federal");
	assert.equal(body.person.officeSought, "U.S. House, District 5");
	assert.equal(body.person.officialWebsiteUrl, detail.officialWebsiteUrl);
	assert.doesNotMatch(JSON.stringify(body), /former-state-office|Unknown district|2021-10-08/u);
});
