import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const addressLookupForm = readFileSync(new URL("../src/components/AddressLookupForm.vue", import.meta.url), "utf8");
const privacyPage = readFileSync(new URL("../src/pages/privacy.vue", import.meta.url), "utf8");
const termsPage = readFileSync(new URL("../src/pages/terms.vue", import.meta.url), "utf8");

test("lookup form discloses ZIP-only operations logging without implying address logging", () => {
	assert.match(addressLookupForm, /normalized 5-digit ZIP .* may be counted in a ZIP-only operations log/i);
	assert.match(addressLookupForm, /raw lookup text, full street addresses, ZIP\+4 entries, IP address, and user agent are not added to that log/i);
});

test("privacy policy describes ZIP-only log scope and exclusions", () => {
	assert.match(privacyPage, /ZIP-only lookup operations log/);
	assert.match(privacyPage, /Timestamp, normalized 5-digit ZIP, lookup result, guide-availability status, and whether a ZIP area selection was required/);
	assert.match(privacyPage, /ZIP5 may come from exact ZIP input, ZIP\+4 input, the end of a typed address, or provider-normalized address data/);
	assert.match(privacyPage, /does not include raw lookup text, full street addresses, ZIP\+4 entries, city names, IP address, or user agent/);
});

test("privacy policy discloses optional ballot-content provider recipients", () => {
	assert.match(privacyPage, /CTCL BIP, Ballotpedia, BallotReady CivicEngine, or Democracy Works/);
	assert.match(privacyPage, /should be treated as active recipients only when configured/);
	assert.match(privacyPage, /verify the exact ballot with the linked official state or local voter\/ballot tool/i);
});

test("terms require official verification for provider ballot previews", () => {
	assert.match(termsPage, /Provider-returned ballot previews, candidate lists, contest lists, or measure summaries are not the official ballot/);
	assert.match(termsPage, /Verify your exact ballot with the linked official state or local voter\/ballot tool/);
});
