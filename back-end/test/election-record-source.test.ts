import assert from "node:assert/strict";
import test from "node:test";
import { electionRecordSource } from "../src/election-record-source.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";

const jurisdiction = { name: "Fulton County", state: "Georgia", jurisdictionType: "County" };
const fulton = configuredStateBallotSources.find(source => source.id === "ga-fulton-2026")!;

test("election records use the exact configured jurisdiction and election without a visitor search", () => {
	assert.deepEqual(electionRecordSource(fulton.electionDate, jurisdiction, [fulton]), { stateCode: "GA", sourceId: fulton.id });
	assert.deepEqual(electionRecordSource("2030-11-05", jurisdiction, [{ ...fulton, id: "ga-fulton-general-2030-11-05", electionDate: "2030-11-05" }]), { stateCode: "GA", sourceId: "ga-fulton-general-2030-11-05" });
});

test("disabled, other-state, other-county and wrong-date sources never replace the requested election", () => {
	for (const sources of [[], [{ ...fulton, ballotPreview: false as const }], [{ ...fulton, stateCode: "MO" }], [{ ...fulton, countyName: "DeKalb County" }], [{ ...fulton, electionDate: "2024-11-05" }], [{ ...fulton, placeName: "Atlanta" }]])
		assert.equal(electionRecordSource(fulton.electionDate, jurisdiction, sources), undefined);
	assert.equal(electionRecordSource(fulton.electionDate, undefined, [fulton]), undefined);
});

test("state and city pages retain their own scope rather than borrowing county records", () => {
	assert.equal(electionRecordSource(fulton.electionDate, { ...jurisdiction, name: "Georgia", jurisdictionType: "state" }, [fulton]), undefined);
	const city = { ...fulton, id: "ga-city-example", placeName: "Atlanta" };
	assert.deepEqual(electionRecordSource(fulton.electionDate, { ...jurisdiction, name: "Atlanta", jurisdictionType: "city" }, [fulton, city]), { stateCode: "GA", sourceId: city.id });
});
