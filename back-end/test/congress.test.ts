import assert from "node:assert/strict";
import test from "node:test";
import { createCongressClient } from "../src/congress.js";

test("Congress lists retain supplied portraits without requesting each member", async () => {
	let requests = 0;
	const client = createCongressClient({ apiKey: "test-congress-key", fetchImpl: (async () => {
		requests++;
		return new Response(JSON.stringify({ members: [{ bioguideId: "A000001", name: "Example, Alex", state: "GA", depiction: { imageUrl: "https://example.org/alex.jpg", attribution: "Official portrait" } }] }), { status: 200 });
	}) as typeof fetch });
	assert.ok(client);
	assert.equal((await client.listMembers())[0]?.depiction?.imageUrl, "https://example.org/alex.jpg");
	assert.equal((await client.listMembersByState("GA"))[0]?.depiction?.attribution, "Official portrait");
	assert.equal(requests, 2);
});

test("Congress.gov requests use bounded abort signals across client workflows", async () => {
	const capturedSignals: Array<AbortSignal | null | undefined> = [];
	const fetchImpl = (async (resource, init) => {
		capturedSignals.push(init?.signal);
		const requestUrl = resource as URL;

		if (requestUrl.pathname.endsWith("/A000001")) {
			return new Response(JSON.stringify({
				member: {
					bioguideId: "A000001",
					currentMember: true,
					directOrderName: "Alex Example",
					partyHistory: [{ partyName: "Independent" }],
					state: "GA",
					terms: [],
				},
			}), { status: 200 });
		}

		return new Response(JSON.stringify({ members: [] }), { status: 200 });
	}) as typeof fetch;
	const client = createCongressClient({
		apiKey: "test-congress-key",
		fetchImpl,
		timeoutMs: 5_000,
	});

	assert.ok(client);
	await client.listMembers();
	await client.listMembersByState("GA");
	await client.getMember("A000001");

	assert.equal(capturedSignals.length, 3);
	assert.ok(capturedSignals.every(signal => signal instanceof AbortSignal));
});
