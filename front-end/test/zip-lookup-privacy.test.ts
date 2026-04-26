import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const addressLookupForm = readFileSync(new URL("../src/components/AddressLookupForm.vue", import.meta.url), "utf8");
const privacyPage = readFileSync(new URL("../src/pages/privacy.vue", import.meta.url), "utf8");

test("lookup form discloses ZIP-only operations logging without implying address logging", () => {
	assert.match(addressLookupForm, /Exact 5-digit ZIP lookups may be counted in a ZIP-only operations log/i);
	assert.match(addressLookupForm, /full street addresses (?:are|and ZIP\+4 entries are) not added to that log/i);
});

test("privacy policy describes ZIP-only log scope and exclusions", () => {
	assert.match(privacyPage, /ZIP-only lookup operations log/);
	assert.match(privacyPage, /Timestamp, exact 5-digit ZIP, lookup result, guide-availability status, and whether a ZIP area selection was required/);
	assert.match(privacyPage, /does not include raw lookup text, full street addresses, ZIP\+4 entries, IP address, or user agent/);
	assert.match(privacyPage, /Full street addresses, ZIP\+4 entries, city names, and mixed address strings are not added to the ZIP-only log/);
});
