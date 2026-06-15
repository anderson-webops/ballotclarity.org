import assert from "node:assert/strict";
import test from "node:test";
import {
	createAddressCacheRepository,
	hashAddressCacheInput,
	normalizeAddressCacheInput,
} from "../src/address-cache-repository.js";

test("address cache input normalization ignores whitespace and casing differences", () => {
	assert.equal(
		normalizeAddressCacheInput("  55   Trinity Ave SW,\nAtlanta, GA 30303  "),
		"55 trinity ave sw, atlanta, ga 30303",
	);
	assert.equal(
		hashAddressCacheInput("55 Trinity Ave SW, Atlanta, GA 30303"),
		hashAddressCacheInput("  55   TRINITY ave sw,\nAtlanta, ga 30303  "),
	);
});

test("address cache input hashing keeps distinct lookup inputs distinct", () => {
	assert.notEqual(
		hashAddressCacheInput("55 Trinity Ave SW, Atlanta, GA 30303"),
		hashAddressCacheInput("5600 Campbellton Fairburn Rd, Fairburn, GA 30213"),
	);
	assert.match(hashAddressCacheInput("55 Trinity Ave SW, Atlanta, GA 30303"), /^[a-f0-9]{64}$/u);
});

test("address cache repository safely disables persistence when no database URL is configured", async () => {
	const repository = await createAddressCacheRepository("");

	assert.equal(repository.driver, "none");
	assert.equal(await repository.getByInput("55 Trinity Ave SW, Atlanta, GA 30303"), null);

	await assert.doesNotReject(repository.save("55 Trinity Ave SW, Atlanta, GA 30303", {
		benchmark: "Public_AR_Current",
		districtMatches: [],
		normalizedAddress: "55 TRINITY AVE SW, ATLANTA, GA, 30303",
		vintage: "Current_Current",
		zip5: "30303",
	}));
});
