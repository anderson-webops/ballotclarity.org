import assert from "node:assert/strict";
import test from "node:test";
import { classifyRepresentative } from "../src/utils/representative-classification.js";

test("county-office labels retain each verified role rather than calling the Clerk a commissioner", () => {
	for (const officeTitle of ["Sheriff", "District Attorney", "Solicitor General", "Tax Commissioner", "Clerk of Superior and Magistrate Courts"]) {
		const record = classifyRepresentative({ officeTitle, districtLabel: "Fulton County", districtType: "county", stateCode: "GA" });
		assert.equal(record.officeDisplayLabel, `Fulton County ${officeTitle}`);
		assert.equal(record.officeType, "county_official");
		assert.equal(record.governmentLevel, "county");
	}
});
