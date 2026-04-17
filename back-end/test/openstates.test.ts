import assert from "node:assert/strict";
import test from "node:test";
import { createOpenStatesClient } from "../src/openstates.js";

test("createOpenStatesClient caps jurisdiction page size at the Open States maximum", async () => {
	const requestedUrls: URL[] = [];
	const client = createOpenStatesClient({
		apiKey: "test-openstates-key",
		fetchImpl: (async (resource) => {
			const requestUrl = resource as URL;

			requestedUrls.push(requestUrl);

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
		/error 400 Bad Request - \{"detail":"invalid per_page, must be in \[1, 50\]"\}/i
	);
});
