import type { CongressClient, CongressMemberRecord } from "../src/congress.js";
import type { PublicStateCandidateRecord } from "../src/types/civic.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createRecordPortraitResolver } from "../src/record-portraits.js";
import { listSupplementalOfficeholders } from "../src/supplemental-officeholders.js";

const record: PublicStateCandidateRecord = { id: "candidate", name: "Mike Collins", office: "United States Senate", scope: "statewide", district: "", status: "listed", party: "Republican" };
const member: CongressMemberRecord = { bioguideId: "C001129", name: "Collins, Mike", state: "Georgia", district: 10, party: "Republican", currentMember: true, depiction: { imageUrl: "https://www.congress.gov/img/member/c001129_200.jpg", attribution: "U.S. House of Representatives" }, url: "https://www.congress.gov/member/mike-collins/C001129" };
function client(listMembersByState: CongressClient["listMembersByState"]): CongressClient {
	return { listMembersByState, listMembers: async () => [], getMember: async () => null };
}

test("candidate pages share one bounded state portrait lookup and retain attribution", async () => {
	let requests = 0;
	const resolve = createRecordPortraitResolver({ congress: client(async (state) => {
		assert.equal(state, "GA");
		requests++;
		return [member];
	}), officials: () => [] });
	const pages = await Promise.all(Array.from({ length: 10 }, () => resolve("GA", Array.from({ length: 100 }, () => ({ ...record })))));
	assert.equal(requests, 1);
	for (const page of pages) {
		assert.equal(page.length, 100);
		assert.equal(page[0]?.profileImages?.[0]?.sourceUrl, member.url);
		assert.equal(page[0]?.profileImages?.[0]?.attribution, member.depiction?.attribution);
		assert.equal(page[0]?.office, "United States Senate");
	}
	assert.equal("profileImages" in record, false);
	await resolve("GA", [record]);
	assert.equal(requests, 1);
});

test("portraits require matching identity, state, office context and party without fuzzy name guesses", async () => {
	for (const candidate of [{ ...record, name: "Michael Collins" }, { ...record, party: "Democrat" }, { ...record, scope: "local" as const }, { ...record, office: "Governor" }, { ...record, name: "Another Person" }]) {
		const resolve = createRecordPortraitResolver({ congress: client(async () => [member]), officials: () => [] });
		assert.equal((await resolve("GA", [candidate]))[0]?.profileImages, undefined);
	}
	for (const matches of [[{ ...member, state: "Alabama" }], [{ ...member, currentMember: false }], [member, { ...member, bioguideId: "OTHER" }], [{ ...member, depiction: { imageUrl: "javascript:alert(1)" } }]]) {
		const resolve = createRecordPortraitResolver({ congress: client(async () => matches), officials: () => [] });
		assert.equal((await resolve("GA", [record]))[0]?.profileImages, undefined);
	}
});

test("House portraits require the corresponding district, including reference office labels", async () => {
	const resolve = createRecordPortraitResolver({ congress: client(async () => [member]), officials: () => [] });
	const matching = { ...record, scope: "congressional" as const, office: "United States House of Representatives - District 10", district: "" };
	assert.equal((await resolve("GA", [matching]))[0]?.profileImages?.length, 1);
	assert.equal((await resolve("GA", [{ ...matching, district: "5" }]))[0]?.profileImages, undefined);
});

test("available state portraits are reused with district checks and without provider requests", async () => {
	const resolve = createRecordPortraitResolver({ congress: null, officials: listSupplementalOfficeholders });
	const stateRecord = { ...record, name: "Scott Hilton", office: "State House District 48", scope: "state-house" as const, district: "48" };
	assert.equal((await resolve("GA", [stateRecord]))[0]?.profileImages?.length, 1);
	assert.equal((await resolve("GA", [{ ...stateRecord, district: "49" }]))[0]?.profileImages, undefined);
	assert.equal((await resolve("AL", [stateRecord]))[0]?.profileImages, undefined);
});

test("portrait outages leave records available and share a retry cooldown", async () => {
	let clock = 1;
	let requests = 0;
	const resolve = createRecordPortraitResolver({ congress: client(async () => {
		requests++;
		throw new Error("provider unavailable");
	}), officials: () => { throw new Error("optional portrait storage unavailable"); }, now: () => clock });
	assert.deepEqual(await resolve("GA", [record]), [record]);
	assert.deepEqual(await resolve("GA", [record]), [record]);
	assert.equal(requests, 1);
	clock += 300_001;
	assert.deepEqual(await resolve("GA", [record]), [record]);
	assert.equal(requests, 2);
});

test("slow providers have bounded page waits and at most two shared lookups", async () => {
	const pending: Array<(members: CongressMemberRecord[]) => void> = [];
	const resolve = createRecordPortraitResolver({ congress: client(() => new Promise(done => pending.push(done))), officials: () => [], waitMs: 10 });
	const started = performance.now();
	await Promise.all([resolve("GA", [record]), resolve("AL", [record]), resolve("NY", [record]), resolve("GA", [record])]);
	assert.equal(pending.length, 2);
	assert(performance.now() - started < 1000);
	for (const done of pending) done([member]);
	await new Promise(done => setImmediate(done));
	assert.equal((await resolve("GA", [record]))[0]?.profileImages?.length, 1);
});
