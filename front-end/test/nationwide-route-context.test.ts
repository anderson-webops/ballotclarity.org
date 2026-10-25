import assert from "node:assert/strict";
import test from "node:test";
import { normalizeLookupResponseForDisplay } from "../src/utils/nationwide-results.ts";
import {
	buildCivicDirectoryApiQuery,
	buildNationwideLookupRouteQuery,
	buildNationwideRouteTarget,
	extractNationwideLookupRouteQuery,
	lookupContextMatchesDirectoryRoute,
} from "../src/utils/nationwide-route-context.ts";

test("nationwide route context carries only an exact five-digit ZIP", () => {
	assert.deepEqual(
		buildNationwideLookupRouteQuery({
			lookupQuery: "30303",
			selectionId: "zip:30303:atlanta-georgia",
		}),
		{
			lookup: "30303",
			selection: "zip:30303:atlanta-georgia",
		}
	);
	assert.equal(
		buildNationwideLookupRouteQuery({
			lookupQuery: "55 Trinity Ave SW, Atlanta, GA 30303",
		}),
		undefined
	);
	assert.equal(
		buildNationwideRouteTarget("/results", {
			lookupQuery: "55 Trinity Ave SW, Atlanta, GA 30303",
		}),
		"/results"
	);
});

test("explicit directory lookup and guide areas override previous browser context", () => {
	const context = { lookupQuery: "65101", selectionId: "zip:65101:cole" };
	assert.deepEqual(buildCivicDirectoryApiQuery(context, { area: "idaho" }, "missouri"), { area: "idaho" });
	assert.deepEqual(buildCivicDirectoryApiQuery(context, { lookup: "83702" }, "missouri"), { lookup: "83702" });
	assert.deepEqual(buildCivicDirectoryApiQuery(context, {}, "missouri"), { lookup: "65101", selection: "zip:65101:cole" });
	assert.deepEqual(buildCivicDirectoryApiQuery(null, {}, "missouri"), { area: "missouri" });
	assert.equal(buildCivicDirectoryApiQuery(null, {}), null);
});

test("directory context remains usable alongside a published guide", () => {
	const context = normalizeLookupResponseForDisplay({
		result: "resolved",
		inputKind: "zip",
		note: "",
		lookupQuery: "65101",
		guideAvailability: "published",
		selectionId: "zip:65101:cole"
	});
	assert.equal(lookupContextMatchesDirectoryRoute(context, {}), true);
	assert.equal(lookupContextMatchesDirectoryRoute(context, { lookup: "65101", selection: "zip:65101:cole" }), true);
	assert.equal(lookupContextMatchesDirectoryRoute({ ...context, guideAvailability: "not-published" }, {}), true);
	assert.equal(lookupContextMatchesDirectoryRoute({ ...context, inputKind: "address", lookupQuery: "100 Private Street" }, {}), true);
});

test("directories reject stored matches for another lookup or area", () => {
	const context = normalizeLookupResponseForDisplay({
		result: "resolved",
		inputKind: "zip",
		note: "",
		lookupQuery: "65101",
		guideAvailability: "published",
		selectionId: "zip:65101:cole"
	});
	for (const query of [
		{ lookup: "65102", selection: "zip:65101:cole" },
		{ lookup: "65101", selection: "zip:65101:other" },
		{ lookup: "65101" },
		{ lookup: "100 Private Street" },
		{ selection: "zip:65101:cole" },
		{ area: "other-guide" }
	]) assert.equal(lookupContextMatchesDirectoryRoute(context, query), false);
	assert.equal(lookupContextMatchesDirectoryRoute(null, {}), false);
	assert.equal(lookupContextMatchesDirectoryRoute({ ...context, result: "unresolved" }, {}), false);
});

test("route parsing rejects address and malformed selection values", () => {
	assert.equal(
		extractNationwideLookupRouteQuery({
			lookup: "55 Trinity Ave SW, Atlanta, GA 30303",
		}),
		null
	);
	assert.deepEqual(
		extractNationwideLookupRouteQuery({
			lookup: "30303",
			selection: "contains spaces",
		}),
		{ lookup: "30303" }
	);
});
