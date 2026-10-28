import assert from "node:assert/strict";
import test from "node:test";
import { groupCountyOfficeholders } from "../src/utils/county-officeholder-groups.ts";

test("county offices and commission members have distinct visible groups without hiding records", () => {
	const people = [{ name: "Commissioner", officeType: "county_commission" }, { name: "Sheriff", officeType: "county_official" }];
	const before = structuredClone(people);
	const groups = groupCountyOfficeholders(people, ["County Commissioner, District 4", "District Attorney"]);
	assert.deepEqual(groups.map(group => group.label), ["County commission", "County offices"]);
	assert.deepEqual(groups[0]!.people, [people[0]]);
	assert.deepEqual(groups[0]!.vacancies, ["County Commissioner, District 4"]);
	assert.deepEqual(groups[1]!.people, [people[1]]);
	assert.deepEqual(groups[1]!.vacancies, ["District Attorney"]);
	assert.deepEqual(people, before);
});

test("one category avoids a redundant heading and explicit vacancies remain visible", () => {
	const groups = groupCountyOfficeholders([{ officeType: "county_commission" }], ["County Commission Chair"]);
	assert.equal(groups.length, 1);
	assert.equal(groups[0]!.label, "");
	assert.deepEqual(groupCountyOfficeholders([], ["Sheriff"])[0]!.vacancies, ["Sheriff"]);
});

test("other district pages retain their original unsplit representation", () => {
	const people = [{ officeType: "mayor" }, { officeType: "city_official" }];
	assert.deepEqual(groupCountyOfficeholders(people), [{ id: "representatives", label: "", people, vacancies: [] }]);
});
