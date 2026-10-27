import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { fetchPimaCycleDiscovery, pimaPolicyFingerprint, readPimaOfferedElections, readPimaPublicState, validatePimaDocumentUrl } from "../src/state-ballot-pima-discovery.js";

const eventId = "278faa5f-617a-4724-a2fe-22c45c452cd2";
const ordinary = "https://content.civicplus.com/api/assets/az-pimacounty/d2c310c3-ade7-484e-a6f0-1ddaebec0799";
const writeIns = "https://content.civicplus.com/api/assets/az-pimacounty/b54c9e42-8520-4201-be8d-10b859da80df";
const preload = (value: unknown) => `<script>window.__PRELOADED_STATE__='${JSON.stringify(value).replace(/\\/gu, "\\\\").replace(/'/gu, "\\'")}'</script>`;
const event = (date: string) => ({ id: eventId, contentTypeName: "event", data: { title: { en: `${date.slice(0, 4)} General Election` }, eventdate: { iv: { startDate: `${date}T13:00:00Z` } } } });
const page = (date = "2026-11-03", publications = true) => `${preload({ contentItems: [event(date)] })}<a href="/elections?contentId=${eventId}">${date.slice(0, 4)} General Election</a>${publications ? `<a href="${ordinary}">${date.slice(0, 4)} General Election Official Candidate List (PDF)</a><a href="${writeIns}">${date.slice(0, 4)} General Election Official Write-In List (PDF)</a>` : ""}`;

test("Pima binds the public event date to actual official candidate and write-in controls", () => {
	const value = readPimaOfferedElections(page());
	assert.deepEqual(value, [{ electionDate: "2026-11-03", documents: [{ kind: "candidates", url: ordinary }, { kind: "write-ins", url: writeIns }] }]);
	assert.deepEqual(readPimaOfferedElections(`${page()}<a href="https://other.example/results.pdf">2026 Primary Election - Summary Results</a>`), value);
	assert.equal("records" in value[0]!, false);
});
test("independently offered future dates and asset identifiers need no annual edit", () => {
	const future = page("2028-11-07").replaceAll("d2c310c3-ade7-484e-a6f0-1ddaebec0799", "11111111-2222-3333-4444-555555555555");
	assert.deepEqual(readPimaOfferedElections(future), [{ electionDate: "2028-11-07", documents: [{ kind: "candidates", url: ordinary.replace("d2c310c3-ade7-484e-a6f0-1ddaebec0799", "11111111-2222-3333-4444-555555555555") }, { kind: "write-ins", url: writeIns }] }]);
	assert.deepEqual(readPimaOfferedElections(page("2032-11-02", false)), [{ electionDate: "2032-11-02", documents: [] }]);
	assert.deepEqual(readPimaOfferedElections(preload({ contentItems: [] })), []);
});
test("filing and interest lists do not substitute for official publications", () => {
	const beforePublication = page("2026-11-03", false);
	assert.deepEqual(readPimaOfferedElections(`${beforePublication}<a href="${ordinary}">2026 General Election Candidates Filed (PDF)</a>`), [{ electionDate: "2026-11-03", documents: [] }]);
	assert.throws(() => readPimaOfferedElections(`${beforePublication}<a href="${writeIns}">2026 General Election Official Write-In List (PDF)</a>`), /requires review/u);
	assert.deepEqual(readPimaOfferedElections(page().replace(`<a href="${writeIns}">2026 General Election Official Write-In List (PDF)</a>`, "")), [{ electionDate: "2026-11-03", documents: [{ kind: "candidates", url: ordinary }] }]);
});
test("event disagreements, unsupported dates and competing publication identities require review", () => {
	for (const value of [page("2026-11-04"), page("2027-11-02"), page().replace("2026-11-03T13:00:00Z", "2028-11-07T13:00:00Z"), page().replace("contentId=", "other="), page().replace(`contentId=${eventId}`, `contentId=${eventId}&preview=true`), `${page()}<a href="${ordinary.replace("d2c310c3", "d2c310c4")}">2026 General Election Official Candidate List (PDF)</a>`, `${page()}<a href="${ordinary}">2026 General Election Official Amended Candidate List (PDF)</a>`]) assert.throws(() => readPimaOfferedElections(value), /requires review/u);
	const conflicting = page().replace(preload({ contentItems: [event("2026-11-03")] }), preload({ contentItems: [event("2026-11-03"), event("2028-11-07")] }));
	assert.throws(() => readPimaOfferedElections(conflicting), /requires review/u);
});
test("public state is decoded as one bounded static string without executing scripts", () => {
	const value = { title: "O'NEILL", path: "C:\\public", encoded: "line\nnext", quotes: "A \"quoted\" value" };
	assert.deepEqual(readPimaPublicState(preload(value)), [value]);
	assert.deepEqual(readPimaPublicState("<script>window.__PRELOADED_STATE__='{" + "\"value\":\"\\x41\\u0042\"" + "}'</script>"), [{ value: "AB" }]);
	for (const body of ["<script>window.__PRELOADED_STATE__=getState()</script>", preload({}) + preload({}), `${preload({})};alert(1)`, "<script>window.__PRELOADED_STATE__='{}';alert(1)</script>", "<script>window.__PRELOADED_STATE__='{" + "\"bad\":\"\\q\"" + "}'</script>", "<script>window.__PRELOADED_STATE__='{}\\'</script>"]) {
		if (body === `${preload({})};alert(1)`) assert.deepEqual(readPimaPublicState(body), [{}]);
		else assert.throws(() => readPimaPublicState(body));
	}
});
test("policy fingerprints include client-rendered legal links and meaningful notice changes", () => {
	const state = { navigation: [{ url: "/125/Disclaimer", displayName: "Disclaimer" }] };
	const body = `${preload(state)}<div id="mainWrapTS"><h1>Notice</h1><p>${"Public information with a source notice. ".repeat(5)}</p><a href="/seal">Use of seal</a></div>`;
	assert.notEqual(pimaPolicyFingerprint(body, "links"), pimaPolicyFingerprint(body.replace("Disclaimer", "New terms"), "links"));
	assert.notEqual(pimaPolicyFingerprint(body, "privacy"), pimaPolicyFingerprint(body.replace("Public information", "Permission required"), "privacy"));
	assert.notEqual(pimaPolicyFingerprint(body, "disclaimer"), pimaPolicyFingerprint(body.replace("/seal", "/changed-seal-policy"), "disclaimer"));
	assert.equal(pimaPolicyFingerprint(body, "privacy"), pimaPolicyFingerprint(body.replace("<h1>", "<h1>\n"), "privacy"));
});
test("asset URLs retain exact host, path, canonical encoding and public namespace", () => {
	validatePimaDocumentUrl(ordinary);
	for (const url of [ordinary.replace("https:", "http:"), ordinary.replace("content.civicplus.com", "other.example"), ordinary.replace("https://", "https://user@"), `${ordinary}?download=1`, `${ordinary}#page=1`, ordinary.replace("az-pimacounty", "other-county"), ordinary.replace("d2c310c3", "%642c310c3")]) assert.throws(() => validatePimaDocumentUrl(url));
});
test("changed robots and transport failures stop before policy, PDF or candidate collection", async () => {
	for (const status of [301, 302, 403, 429, 503]) {
		let calls = 0;
		await assert.rejects(fetchPimaCycleDiscovery({ requestDocument: async () => {
			calls++;
			return { status, contentType: "text/plain", body: Buffer.alloc(0), location: "https://other.example/challenge", etag: undefined };
		} }), /requires review/u);
		assert.equal(calls, 1);
	}
	let calls = 0;
	await assert.rejects(fetchPimaCycleDiscovery({ requestDocument: async () => {
		calls++;
		return { status: 200, contentType: "text/plain", body: Buffer.from("User-agent: GPTBot\nDisallow: /\n"), etag: undefined };
	} }), /requires review/u);
	assert.equal(calls, 1);
});
test("untrusted HTML and public-state nesting stay bounded", () => {
	assert.throws(() => readPimaOfferedElections(" ".repeat(2 * 1024 * 1024 + 1)), /requires review/u);
	assert.throws(() => readPimaOfferedElections("<div>".repeat(100) + "</div>".repeat(100)), /requires review/u);
	assert.throws(() => readPimaPublicState(preload({ nested: JSON.parse(`${"[".repeat(100)}0${"]".repeat(100)}`) })), /requires review/u);
});
