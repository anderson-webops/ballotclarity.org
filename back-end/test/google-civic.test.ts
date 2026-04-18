import assert from "node:assert/strict";
import test from "node:test";
import { createGoogleCivicClient, createGoogleCivicLookup, fetchGoogleCivic, shouldForceGoogleCivicIpv4 } from "../src/google-civic.js";

test("shouldForceGoogleCivicIpv4 parses supported truthy flags", () => {
	assert.equal(shouldForceGoogleCivicIpv4("true"), true);
	assert.equal(shouldForceGoogleCivicIpv4("TRUE"), true);
	assert.equal(shouldForceGoogleCivicIpv4("1"), true);
	assert.equal(shouldForceGoogleCivicIpv4("yes"), true);
	assert.equal(shouldForceGoogleCivicIpv4("on"), true);
	assert.equal(shouldForceGoogleCivicIpv4("false"), false);
	assert.equal(shouldForceGoogleCivicIpv4(undefined), false);
});

test("createGoogleCivicLookup forces IPv4 resolution", () => {
	let capturedHostname = "";
	let capturedOptions: { all?: boolean; family?: number | string; hints?: number } | null = null;
	let callbackFamily = 0;
	const lookup = createGoogleCivicLookup((hostname, options, callback) => {
		capturedHostname = hostname;
		capturedOptions = options;
		(callback as (error: NodeJS.ErrnoException | null, address: string, family: number) => void)(null, "203.0.113.10", 4);
	});

	lookup("www.googleapis.com", { family: 6, hints: 32 }, ((error: NodeJS.ErrnoException | null, _address: string, family: number) => {
		assert.equal(error, null);
		callbackFamily = family;
	}) as never);

	assert.equal(capturedHostname, "www.googleapis.com");
	assert.deepEqual(capturedOptions, {
		all: false,
		family: 4,
		hints: 32
	});
	assert.equal(callbackFamily, 4);
});

test("createGoogleCivicLookup preserves all-lookups when the caller requests multiple addresses", () => {
	let capturedOptions: { all?: boolean; family?: number | string; hints?: number } | null = null;
	let callbackAddresses: { address: string; family: number }[] = [];
	const lookup = createGoogleCivicLookup((_hostname, options, callback) => {
		capturedOptions = options;
		(callback as (error: NodeJS.ErrnoException | null, addresses: { address: string; family: number }[]) => void)(null, [
			{
				address: "203.0.113.10",
				family: 4
			}
		]);
	});

	lookup("www.googleapis.com", { all: true, family: 6, hints: 16 }, ((error: NodeJS.ErrnoException | null, addresses: { address: string; family: number }[]) => {
		assert.equal(error, null);
		callbackAddresses = addresses;
	}) as never);

	assert.deepEqual(capturedOptions, {
		all: true,
		family: 4,
		hints: 16
	});
	assert.deepEqual(callbackAddresses, [
		{
			address: "203.0.113.10",
			family: 4
		}
	]);
});

test("fetchGoogleCivic uses an injected fetch implementation before the IPv4 transport path", async () => {
	let called = false;
	const expectedResponse = new Response("{\"ok\":true}", {
		headers: {
			"Content-Type": "application/json"
		},
		status: 200
	});
	const fetchImpl = (async (resource, init) => {
		called = true;
		assert.equal(resource instanceof URL, true);
		assert.equal((resource as URL).hostname, "www.googleapis.com");
		assert.deepEqual(init?.headers, {
			Accept: "application/json"
		});

		return expectedResponse;
	}) as typeof fetch;

	const response = await fetchGoogleCivic(new URL("https://www.googleapis.com/civicinfo/v2/elections"), {
		fetchImpl,
		forceIPv4: true
	});

	assert.equal(called, true);
	assert.equal(response, expectedResponse);
});

test("createGoogleCivicClient requests partial voterinfo data before treating the lookup as failed", async () => {
	const requestedUrls: URL[] = [];
	const client = createGoogleCivicClient({
		apiKey: "test-google-civic-key",
		fetchImpl: (async (resource) => {
			const requestUrl = resource as URL;

			requestedUrls.push(requestUrl);

			return new Response(JSON.stringify({
				kind: "civicinfo#voterInfoResponse",
				normalizedInput: {
					city: "Atlanta",
					line1: "55 Trinity Avenue Southwest",
					state: "GA",
					zip: "30303"
				}
			}), {
				headers: {
					"Content-Type": "application/json"
				},
				status: 200
			});
		}) as typeof fetch
	});

	assert.ok(client);

	const result = await client.lookupVoterInfo("55 Trinity Ave SW, Atlanta, GA 30303");

	assert.ok(result);
	assert.equal(requestedUrls.length, 1);
	assert.equal(requestedUrls[0].searchParams.get("returnAllAvailableData"), "true");
	assert.equal(result.verified, true);
	assert.match(result.note, /did not return an election-specific record/i);
});

test("createGoogleCivicClient converts election-unknown responses into a fallback note", async () => {
	const client = createGoogleCivicClient({
		apiKey: "test-google-civic-key",
		fetchImpl: (async () => {
			return new Response(JSON.stringify({
				error: {
					errors: [
						{
							reason: "invalid"
						}
					],
					message: "Election unknown"
				}
			}), {
				headers: {
					"Content-Type": "application/json"
				},
				status: 400
			});
		}) as typeof fetch
	});

	assert.ok(client);

	const result = await client.lookupVoterInfo("55 Trinity Ave SW, Atlanta, GA 30303");

	assert.ok(result);
	assert.equal(result.verified, false);
	assert.match(result.note, /did not return election-specific voter information/i);
});
