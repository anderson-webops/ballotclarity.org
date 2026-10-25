import type { CensusGeographyItem } from "../src/census-geocoder.js";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { buildActiveNationwideLookupCookie } from "../src/active-nationwide-lookup.js";
import { createAddressEnrichmentService } from "../src/address-enrichment.js";
import { createCensusDistrictContext, isCurrentCensusDistrictContext } from "../src/census-district-context.js";
import { buildDistrictMatches, createCensusGeocoderClient } from "../src/census-geocoder.js";
import { currentCongress } from "../src/congressional-boundaries.js";
import { createApp } from "../src/server.js";
import { createZipLocationService } from "../src/zip-location.js";

const now = () => Date.parse("2026-10-25T16:00:00Z");
function geography(session: number, code = "10", state = "48"): Record<string, CensusGeographyItem[]> {
	return { [`${session}th Congressional Districts`]: [{ BASENAME: code, CDSESSN: String(session), GEOID: `${state}${code}`, NAME: `Congressional District ${code}`, STATE: state }], Counties: [{ COUNTY: "453", GEOID: "48453", NAME: "Travis County", STATE: "48" }] };
}
const response = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

test("Census district mapping retains publisher session, vintage and state without trusting conflicting layers", () => {
	const matches = buildDistrictMatches(geography(120), "Current_Current");
	assert.equal(matches[1].congressionalSession, 120);
	assert.equal(matches[1].boundaryVintage, "Current_Current");
	assert.equal(matches[1].stateFips, "48");
	for (const geographies of [
		{ "120th Congressional Districts": [{ ...geography(120)["120th Congressional Districts"][0], CDSESSN: "119" }] },
		{ "120th Congressional Districts": [...geography(120)["120th Congressional Districts"], ...geography(120)["120th Congressional Districts"]] },
		{ "Congressional Districts": geography(120)["120th Congressional Districts"] },
	])
		assert.deepEqual(buildDistrictMatches(geographies), []);
});

test("Census discovers offered historical geography to separate the current officeholder from the upcoming ballot", async () => {
	const requests: URL[] = [];
	const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
		const url = new URL(String(input));
		requests.push(url);
		assert.ok(init?.signal instanceof AbortSignal);
		assert.equal(url.origin, "https://geocoding.geo.census.gov");
		assert.equal(url.searchParams.has("address"), false);
		if (url.pathname.endsWith("/vintages"))
			return response({ vintages: [{ vintageName: "ACS2024_Current" }, { vintageName: "ACS2025_Current" }, { vintageName: "ACS2026_Current" }] });
		assert.equal(url.searchParams.get("vintage"), "ACS2025_Current");
		assert.equal(url.searchParams.get("x"), "-97.74");
		return response({ result: { geographies: geography(119, "37") } });
	}) as typeof fetch;
	const resolve = createCensusDistrictContext({ benchmark: "Public_AR_Current", fetchImpl, now, timeoutMs: 1000 });
	for (let attempt = 0; attempt < 2; attempt++) {
		const result = await resolve(geography(120), 30.27, -97.74, "Current_Current");
		assert.equal(result.districtMatches[1].districtCode, "37");
		assert.equal(result.districtMatches[1].congressionalSession, 119);
		assert.equal(result.electionDistrictMatches[0].districtCode, "10");
		assert.equal(result.electionDistrictMatches[0].congressionalSession, 120);
		assert.equal(isCurrentCensusDistrictContext(result, now()), true);
		assert.equal(isCurrentCensusDistrictContext(result, Date.parse("2027-01-04T00:00:00Z")), false);
	}
	assert.equal(requests.filter(url => url.pathname.endsWith("/vintages")).length, 1);
	assert.equal(requests.length, 3);
});

test("historical geography failure preserves non-congressional and election data without assigning the wrong representative", async () => {
	for (const mode of ["denied", "missing", "bad-session", "wrong-state", "ambiguous", "network"]) {
		let requests = 0;
		const resolve = createCensusDistrictContext({ benchmark: "Public_AR_Current", now, timeoutMs: 1000, fetchImpl: (async (input) => {
			requests++;
			if (mode === "network")
				throw new Error("Unavailable");
			if (String(input).includes("/vintages?"))
				return mode === "denied" ? new Response("", { status: 403 }) : response({ vintages: mode === "missing" ? [] : [{ vintageName: "ACS2025_Current" }] });
			const geographies = geography(mode === "bad-session" ? 120 : 119, "37", mode === "wrong-state" ? "06" : "48");
			if (mode === "ambiguous")
				geographies["119th Congressional Districts"].push({ ...geographies["119th Congressional Districts"][0], BASENAME: "38" });
			return response({ result: { geographies } });
		}) as typeof fetch });
		const result = await resolve(geography(120), 30.27, -97.74, "Current_Current");
		assert.equal(result.districtMatches.length, 1, mode);
		assert.equal(result.districtMatches[0].districtType, "county", mode);
		assert.equal(result.electionDistrictMatches[0].congressionalSession, 120, mode);
		assert.equal(isCurrentCensusDistrictContext(result, now()), false, mode);
		assert.ok(requests <= 2, mode);
	}
});

test("matching current Congress and session rollover need no historical lookup or hard-coded future year", async () => {
	let requests = 0;
	for (const [at, session] of [["2026-10-25", 119], ["2027-01-04", 120], ["2029-01-04", 121]] as const) {
		const resolve = createCensusDistrictContext({ benchmark: "Public_AR_Current", now: () => Date.parse(at), timeoutMs: 1000, fetchImpl: (async () => {
			requests++;
			throw new Error("No request expected");
		}) as typeof fetch });
		const result = await resolve(geography(session), 30.27, -97.74, "Current_Current");
		assert.equal(result.districtMatches[1].congressionalSession, session);
		assert.equal(result.electionDistrictMatches[0].congressionalSession, session);
	}
	assert.equal(requests, 0);
});

test("address lookup returns both district contexts without sending the address in historical requests", async () => {
	let addresses = 0;
	const client = createCensusGeocoderClient({ now, fetchImpl: (async (input) => {
		const url = new URL(String(input));
		if (url.pathname.endsWith("/onelineaddress")) {
			addresses++;
			return response({ result: { addressMatches: [{ matchedAddress: "PUBLIC CAPITOL", addressComponents: { state: "TX", zip: "78701" }, coordinates: { x: -97.74, y: 30.27 }, geographies: geography(120) }] } });
		}
		assert.equal(url.searchParams.has("address"), false);
		return url.pathname.endsWith("/vintages") ? response({ vintages: [{ vintageName: "ACS2025_Current" }] }) : response({ result: { geographies: geography(119, "37") } });
	}) as typeof fetch });
	const result = await client.lookupAddress("Public capitol");
	assert.ok(result);
	assert.equal(result.districtMatches[1].districtCode, "37");
	assert.equal(result.electionDistrictMatches?.[0].districtCode, "10");
	assert.equal(addresses, 1);
});

test("a later election cycle discovers the session's offered vintage instead of retaining a 2025 setting", async () => {
	const requests: URL[] = [];
	const resolve = createCensusDistrictContext({ benchmark: "Public_AR_Current", now: () => Date.parse("2030-10-20T00:00:00Z"), timeoutMs: 1000, fetchImpl: (async (input) => {
		const url = new URL(String(input));
		requests.push(url);
		if (url.pathname.endsWith("/vintages"))
			return response({ vintages: [{ vintageName: "ACS2025_Current" }, { vintageName: "ACS2029_Current" }, { vintageName: "ACS2030_Current" }] });
		assert.equal(url.searchParams.get("vintage"), "ACS2029_Current");
		return response({ result: { geographies: geography(121, "5") } });
	}) as typeof fetch });
	const result = await resolve(geography(122, "8"), 30.27, -97.74, "Current_Current");
	assert.equal(result.districtMatches[1].congressionalSession, 121);
	assert.equal(result.electionDistrictMatches[0].congressionalSession, 122);
	assert.equal(requests.length, 2);
});

test("Missouri keeps the approved unchanged plan after the January handover without retaining old officeholder context", async () => {
	const at = Date.parse("2027-01-04T00:00:00Z");
	const resolve = createCensusDistrictContext({ benchmark: "Public_AR_Current", now: () => at, timeoutMs: 1000, fetchImpl: (async (input) => {
		const url = new URL(String(input));
		if (url.pathname.endsWith("/vintages"))
			return response({ vintages: [{ vintageName: "ACS2025_Current" }, { vintageName: "ACS2026_Current" }] });
		assert.equal(url.searchParams.get("vintage"), "ACS2025_Current");
		return response({ result: { geographies: geography(119, "3", "29") } });
	}) as typeof fetch });
	const result = await resolve(geography(120, "5", "29"), 38.57, -92.17, "Current_Current");
	assert.equal(result.districtContextCongress, 120);
	assert.equal(result.districtMatches[1].districtCode, "3");
	assert.equal(result.districtMatches[1].congressionalSession, 119);
	assert.equal(isCurrentCensusDistrictContext(result, at), true);
	assert.equal(isCurrentCensusDistrictContext({ ...result, districtContextCongress: 119 }, at), false);
});

test("an obsolete address cache is refreshed and new session provenance survives a cache hit", async () => {
	const congress = currentCongress();
	let cached = { benchmark: "Public_AR_Current", vintage: "Current_Current", normalizedAddress: "Public capitol", districtMatches: buildDistrictMatches(geography(congress + 1)), fromCache: true as const };
	let requests = 0;
	const fresh = { ...cached, districtContextCongress: congress, districtMatches: buildDistrictMatches(geography(congress)), electionDistrictMatches: buildDistrictMatches(geography(congress + 1)).filter(match => match.districtType === "congressional") };
	const service = createAddressEnrichmentService({
		async lookupAddress() {
			requests++;
			return fresh;
		},
	}, null, {
		driver: "none",
		async getByInput() {
			return cached;
		},
		async save(_input, lookup) {
			cached = { ...lookup, fromCache: true };
		},
	});
	const first = await service.lookupAddress("Public capitol");
	assert.equal(first?.fromCache, false);
	assert.equal(first?.districtMatches[1].congressionalSession, congress);
	const second = await service.lookupAddress("Public capitol");
	assert.equal(second?.fromCache, true);
	assert.equal(second?.electionDistrictMatches?.[0].congressionalSession, congress + 1);
	assert.equal(requests, 1);
});

test("ZIP centroids resolve current representatives with the same session-aware Census path", async () => {
	const service = createZipLocationService({ now, openStatesClient: null, fetchImpl: (async (input) => {
		const url = new URL(String(input));
		if (url.origin === "https://api.zippopotam.us")
			return response({ "post code": "78701", "places": [{ "latitude": "30.27", "longitude": "-97.74", "state abbreviation": "TX", "state": "Texas", "place name": "Austin" }] });
		if (url.pathname.endsWith("/vintages"))
			return response({ vintages: [{ vintageName: "ACS2025_Current" }] });
		return response({ result: { geographies: { ...geography(url.searchParams.get("vintage") === "Current_Current" ? 120 : 119, url.searchParams.get("vintage") === "Current_Current" ? "10" : "37"), States: [{ NAME: "Texas", STUSAB: "TX" }] } } });
	}) as typeof fetch });
	const result = await service.lookupZip("78701");
	assert.equal(result?.matches[0].districtMatches[1].districtCode, "37");
	assert.equal(result?.matches[0].districtMatches[1].congressionalSession, 119);
	assert.equal(result?.matches[0].districtContextCongress, 119);
});

test("a January Missouri ZIP lookup preserves new officeholder context through the real API and saved cookie", async (context) => {
	context.mock.timers.enable({ apis: ["Date"], now: Date.parse("2027-01-04T00:00:00Z") });
	const secret = "synthetic-missouri-january-cookie-key";
	const zipLocationService = createZipLocationService({ openStatesClient: null, fetchImpl: (async (input) => {
		const url = new URL(String(input));
		if (url.origin === "https://api.zippopotam.us")
			return response({ "post code": "65101", "places": [{ "latitude": "38.57", "longitude": "-92.17", "state abbreviation": "MO", "state": "Missouri", "place name": "Jefferson City" }] });
		if (url.pathname.endsWith("/vintages"))
			return response({ vintages: [{ vintageName: "ACS2025_Current" }] });
		return response({ result: { geographies: { ...geography(url.searchParams.get("vintage") === "Current_Current" ? 120 : 119, url.searchParams.get("vintage") === "Current_Current" ? "5" : "3", "29"), States: [{ NAME: "Missouri", STUSAB: "MO", STATE: "29" }] } } });
	}) as typeof fetch });
	const app = await createApp({ activeLookupCookieSecret: secret, adminDbPath: ":memory:", addressEnrichmentService: null, congressClient: null, googleCivicClient: null, ldaClient: null, openFecClient: null, openStatesClient: null, stateBallotRepository: null, electionReferenceRepository: null, zipLocationService, locationGuessOptions: { mode: "disabled" }, zipLookupLogger: { enabled: false, logPath: ":memory:", async record() {} } });
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	assert.ok(address && typeof address === "object");
	const origin = `http://127.0.0.1:${address.port}`;
	try {
		const result = await fetch(`${origin}/api/location`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: "65101" }) });
		assert.equal(result.status, 200);
		const lookup = await result.json();
		assert.equal(lookup.districtContextCongress, 120);
		const congressional = lookup.districtMatches.find((match: { districtType: string }) => match.districtType === "congressional");
		assert.equal(congressional.districtCode, "3");
		assert.equal(congressional.congressionalSession, 119);
		const cookie = result.headers.getSetCookie().map(value => value.split(";", 1)[0]).join("; ");
		const active = await (await fetch(`${origin}/api/location/active`, { headers: { cookie } })).json();
		assert.equal(active.districtContextCongress, 120);
		assert.deepEqual(active.districtMatches, lookup.districtMatches);
		const obsolete = buildActiveNationwideLookupCookie({ ...lookup, districtContextCongress: 119 }, secret);
		assert.ok(obsolete);
		assert.equal(await (await fetch(`${origin}/api/location/active`, { headers: { cookie: `ballot-clarity-nationwide-lookup=${encodeURIComponent(obsolete)}` } })).json(), null);
	}
	finally {
		await new Promise<void>(accept => server.close(() => accept()));
		await app.closeResources();
	}
});
