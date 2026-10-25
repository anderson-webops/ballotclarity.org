import assert from "node:assert/strict";
import test from "node:test";
import { createOpenStatesClient } from "../src/openstates.js";

test("Open States keeps portraits and prefers safe homepage links", async () => {
	const person = { id: "test-person", name: "Alex Example", image: "https://example.org/alex.jpg", current_role: { district: "4", org_classification: "lower" }, links: [{ url: "javascript:alert(1)", note: "homepage" }, { url: "https://example.org/alex/bio" }, { url: "https://example.org/alex", note: "homepage" }] };
	const client = createOpenStatesClient({ apiKey: "test-openstates-key", fetchImpl: (async (resource) => {
		assert.equal(new URL(String(resource)).searchParams.get("include"), "links");
		return new Response(JSON.stringify({ results: [person] }), { status: 200 });
	}) as typeof fetch });
	assert.ok(client);
	const [record] = await client.searchPeopleByName("Alex Example");
	assert.equal(record?.officialWebsiteUrl, "https://example.org/alex");
	assert.equal(record?.profileImages?.[0]?.url, "https://example.org/alex.jpg");
	const [match] = await client.lookupPeopleByCoordinates(0, 0);
	assert.equal(match?.officialWebsiteUrl, record?.officialWebsiteUrl);
	assert.deepEqual(match?.profileImages, record?.profileImages);
	person.links = [{ url: "http://127.0.0.1/private", note: "homepage" }];
	assert.equal((await client.searchPeopleByName("Alex Example"))[0]?.officialWebsiteUrl, undefined);
});

test("createOpenStatesClient caps jurisdiction page size at the Open States maximum", async () => {
	let capturedSignal: AbortSignal | null | undefined;
	const requestedUrls: URL[] = [];
	const client = createOpenStatesClient({
		apiKey: "test-openstates-key",
		fetchImpl: (async (resource, init) => {
			const requestUrl = resource as URL;

			requestedUrls.push(requestUrl);
			capturedSignal = init?.signal;

			return new Response(JSON.stringify({
				pagination: {
					max_page: 1
				},
				results: []
			}), {
				headers: {
					"Content-Type": "application/json"
				},
				status: 200
			});
		}) as typeof fetch
	});

	assert.ok(client);

	await client.listPeopleByJurisdiction("Georgia", {
		perPage: 250
	});

	assert.equal(requestedUrls.length, 1);
	assert.equal(requestedUrls[0].searchParams.get("per_page"), "50");
	assert.ok(capturedSignal instanceof AbortSignal);
});

test("createOpenStatesClient includes the provider response body in lookup errors", async () => {
	const client = createOpenStatesClient({
		apiKey: "test-openstates-key",
		fetchImpl: (async () => {
			return new Response("{\"detail\":\"invalid per_page, must be in [1, 50]\"}", {
				headers: {
					"Content-Type": "application/json"
				},
				status: 400,
				statusText: "Bad Request"
			});
		}) as typeof fetch
	});

	assert.ok(client);

	await assert.rejects(
		client.lookupPeopleByCoordinates(33.749, -84.388),
		/Open States lookup failed: 400 Bad Request - \{"detail":"invalid per_page, must be in \[1, 50\]"\}/i
	);
});
