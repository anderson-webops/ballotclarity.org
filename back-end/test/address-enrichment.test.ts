import type { AddressCacheRepository } from "../src/address-cache-repository.js";
import type { CensusGeocoderClient } from "../src/census-geocoder.js";
import type { OpenStatesClient } from "../src/openstates.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createAddressEnrichmentService } from "../src/address-enrichment.js";

test("createAddressEnrichmentService preserves Census geography when Open States lookup fails", async () => {
	const service = createAddressEnrichmentService(
		{
			async lookupAddress() {
				return {
					benchmark: "Public_AR_Current",
					countyFips: "121",
					districtMatches: [
						{
							districtCode: "5",
							districtType: "congressional",
							id: "congressional:5",
							label: "Congressional District 5",
							sourceSystem: "U.S. Census Geocoder"
						}
					],
					latitude: 33.7479,
					longitude: -84.3902,
					normalizedAddress: "55 TRINITY AVE SW, ATLANTA, GA, 30303",
					state: "GA",
					vintage: "Current_Current",
					zip5: "30303"
				};
			}
		} satisfies CensusGeocoderClient,
		{
			async listPeopleByJurisdiction() {
				return [];
			},
			async lookupPeopleByCoordinates() {
				throw new Error("Open States lookup failed: 400 Bad Request - {\"detail\":\"Failed to parse address\"}");
			},
			async searchPeopleByName() {
				return [];
			}
		} satisfies OpenStatesClient,
		{
			driver: "none",
			async getByInput() {
				return null;
			},
			async save() {}
		} satisfies AddressCacheRepository
	);

	const result = await service.lookupAddress("55 Trinity Ave SW, Atlanta, GA 30303");

	assert.ok(result);
	assert.equal(result.fromCache, false);
	assert.equal(result.normalizedAddress, "55 TRINITY AVE SW, ATLANTA, GA, 30303");
	assert.equal(result.districtMatches[0].label, "Congressional District 5");
	assert.deepEqual(result.representativeMatches, []);
});

test("createAddressEnrichmentService preserves lookup results when cache operations fail", async () => {
	const service = createAddressEnrichmentService(
		{
			async lookupAddress() {
				return {
					benchmark: "Public_AR_Current",
					countyFips: "121",
					districtMatches: [
						{
							districtCode: "5",
							districtType: "congressional",
							id: "congressional:5",
							label: "Congressional District 5",
							sourceSystem: "U.S. Census Geocoder"
						}
					],
					latitude: 33.7479,
					longitude: -84.3902,
					normalizedAddress: "55 TRINITY AVE SW, ATLANTA, GA, 30303",
					state: "GA",
					vintage: "Current_Current",
					zip5: "30303"
				};
			}
		} satisfies CensusGeocoderClient,
		null,
		{
			driver: "none",
			async getByInput() {
				throw new Error("database unavailable");
			},
			async save() {
				throw new Error("database unavailable");
			}
		} satisfies AddressCacheRepository
	);

	const result = await service.lookupAddress("55 Trinity Ave SW, Atlanta, GA 30303");

	assert.ok(result);
	assert.equal(result.normalizedAddress, "55 TRINITY AVE SW, ATLANTA, GA, 30303");
	assert.equal(result.districtMatches.length, 1);
});
