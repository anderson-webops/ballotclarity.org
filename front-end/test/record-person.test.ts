import type { PersonProfileResponse } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { matchingRecordPerson } from "../src/utils/record-person.ts";

test("candidate profiles retain a verified identity and state before displaying officeholder details", () => {
	const result = { person: { slug: "example-person", name: "Example Person", location: "Atlanta, Georgia" } } as PersonProfileResponse;
	const identity = { slug: "example-person", name: "Example Person", stateCode: "GA", stateName: "Georgia" };
	assert.equal(matchingRecordPerson(result, identity), result);
	assert.equal(matchingRecordPerson(result, { ...identity, name: "Different Person" }), null);
	assert.equal(matchingRecordPerson(result, { ...identity, slug: "another-person" }), null);
	assert.equal(matchingRecordPerson(result, { ...identity, stateCode: "AL", stateName: "Alabama" }), null);
	assert.equal(matchingRecordPerson({ ...result, person: { ...result.person, location: "Michigan" } }, { ...identity, stateCode: "GA", stateName: undefined }), null);
});
