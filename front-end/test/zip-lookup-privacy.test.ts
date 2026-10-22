import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const addressLookupForm = readFileSync(new URL("../src/components/AddressLookupForm.vue", import.meta.url), "utf8");
const privacyPage = readFileSync(new URL("../src/pages/privacy.vue", import.meta.url), "utf8");
const termsPage = readFileSync(new URL("../src/pages/terms.vue", import.meta.url), "utf8");
const appFooter = readFileSync(new URL("../src/components/AppFooter.vue", import.meta.url), "utf8");
const methodologyPage = readFileSync(new URL("../src/pages/methodology.vue", import.meta.url), "utf8");

test("lookup form leaves privacy disclosures to the policy linked in the footer", () => {
	assert.doesNotMatch(addressLookupForm, /Lookup data is used only|Data use:|ZIP-only operations log|to="\/privacy"|privacyId/);
	assert.match(appFooter, /\{ label: "Privacy", to: "\/privacy" \}/);
	assert.doesNotMatch(methodologyPage, /keeps the data-use explanation near the lookup form/);
	assert.doesNotMatch(privacyPage, /keeps the explanation near the lookup form/);
});

test("lookup input retains result and error descriptions without a removed privacy reference", () => {
	assert.match(addressLookupForm, /:aria-describedby="inputDescribedBy"/);
	assert.match(addressLookupForm, /lookupResult\.value && shouldShowInlineResults\.value \? actionsId : ""/);
	assert.match(addressLookupForm, /errorMessage\.value \? errorId : ""/);
	assert.match(addressLookupForm, /\]\.filter\(Boolean\)\.join\(" "\) \|\| undefined/);
});

test("privacy policy describes ZIP-only log scope and exclusions", () => {
	assert.match(privacyPage, /ZIP-only lookup operations log/);
	assert.match(privacyPage, /only an exact 5-digit ZIP entered by itself as the lookup input/);
	assert.match(privacyPage, /Timestamp, exact normalized 5-digit ZIP input, lookup result, guide-availability status, and whether a ZIP area selection was required/);
	assert.match(privacyPage, /does not include raw lookup text, full street addresses, ZIP\+4 entries, city names, mixed address strings, provider-normalized ZIPs, IP address, or user agent/);
});

test("privacy retention table remains keyboard-accessible on narrow screens", () => {
	assert.match(privacyPage, /id="retention-heading"/);
	assert.match(privacyPage, /overflow-x-auto focus-ring" role="region" aria-labelledby="retention-heading" tabindex="0"/);
});

test("privacy policy discloses optional ballot-content provider recipients", () => {
	assert.match(privacyPage, /CTCL BIP, Ballotpedia, BallotReady CivicEngine, or Democracy Works/);
	assert.match(privacyPage, /are active recipients only when configured/);
	assert.match(privacyPage, /verify the exact ballot with the linked official state or local voter\/ballot tool/i);
});

test("terms require official verification for provider ballot previews", () => {
	assert.match(termsPage, /Provider-returned ballot previews, candidate lists, contest lists, or measure summaries are not the official ballot/);
	assert.match(termsPage, /Verify your exact ballot with the linked official state or local voter\/ballot tool/);
});
