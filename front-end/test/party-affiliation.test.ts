import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolvePartyAffiliation } from "../src/utils/party-affiliation.ts";
import { stateRecordSummaryParts } from "../src/utils/state-records.ts";
import { themeModes, themeSchemeDefinitions } from "../src/utils/theme-schemes.ts";

test("party colors recognize explicit Democratic and Republican labels and abbreviations", () => {
	for (const label of ["Democrat", "Democratic", "Democratic Party", "Prefers Democratic Party", "DEM", "D", "  democrat  "])
		assert.equal(resolvePartyAffiliation(label), "democratic");
	for (const label of ["Republican", "Republican Party", "Prefers Republican Party", "REP", "R", " republican "])
		assert.equal(resolvePartyAffiliation(label), "republican");
});

test("party colors leave other, ambiguous and missing affiliations neutral", () => {
	for (const label of ["Independent", "Nonpartisan", "Democratic Socialist", "Democratic-Republican", "Republican / Independent", "Not Republican", "", null, undefined])
		assert.equal(resolvePartyAffiliation(label), undefined);
});

test("candidate record summary parts isolate party text without changing office, area or status", () => {
	assert.deepEqual(stateRecordSummaryParts({ id: "example", name: "Example", office: "Council", district: "", jurisdiction: "Example City", scope: "local", status: "qualified", party: "Republican" }), [
		{ label: "Council", isParty: false },
		{ label: "Example City", isParty: false },
		{ label: "Republican", isParty: true },
		{ label: "Qualified", isParty: false }
	]);
});

test("party labels retain their wording and defer to print and forced-color settings", () => {
	const component = readFileSync(new URL("../src/components/PartyLabel.vue", import.meta.url), "utf8");
	assert.match(component, /\{\{ party \}\}/u);
	assert.match(component, /@media print, \(forced-colors: active\)/u);
	assert.match(component, /color: inherit !important/u);
	assert.doesNotMatch(component, /aria-hidden|role="alert"|background:/u);
});

test("candidate summaries keep explicit incumbency separate from party and avoid repeating the office label", () => {
	const record = { id: "example", name: "Example", office: "Justice of Supreme Court", district: "", scope: "statewide" as const, status: "listed" as const, incumbent: true as const };
	assert.deepEqual(stateRecordSummaryParts(record), [{ label: record.office, isParty: false }, { label: "Incumbent", isParty: false }]);
	assert.deepEqual(stateRecordSummaryParts({ ...record, office: "Judge of Court of Appeals Incumbent" }), [{ label: "Judge of Court of Appeals Incumbent", isParty: false }]);
	assert.equal(stateRecordSummaryParts({ ...record, incumbent: undefined }).some(part => part.label === "Incumbent"), false);
});

function luminance(hex: string) {
	const channels = hex.slice(1).match(/../gu)!.map(channel => Number.parseInt(channel, 16) / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
	return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

test("both party colors retain normal-text contrast on every supported theme surface", () => {
	const component = readFileSync(new URL("../src/components/PartyLabel.vue", import.meta.url), "utf8");
	for (const definition of themeSchemeDefinitions) {
		for (const mode of themeModes) {
			for (const party of ["democratic", "republican"]) {
				const selector = mode === "dark" ? `html.dark \\.party-label\\[data-party="${party}"\\]` : `^\\.party-label\\[data-party="${party}"\\]`;
				const color = component.match(new RegExp(`${selector} \\{\\s*color: (#[a-f\\d]{6});`, "mu"))?.[1];
				assert.ok(color);
				for (const token of ["--app-bg", "--app-panel"] as const) {
					const foreground = luminance(color);
					const background = luminance(definition.modes[mode][token]);
					assert.ok((Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05) >= 4.5, `${definition.id}/${mode}/${party}/${token}`);
				}
			}
		}
	}
});
