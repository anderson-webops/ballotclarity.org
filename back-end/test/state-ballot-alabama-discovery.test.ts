import type { AlabamaReferenceCapture } from "../src/state-ballot-alabama-discovery.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	alabamaAnnualPages,
	alabamaDiscoveryUrl,
	alabamaGeneralElection,
	alabamaReferenceCsv,
	prepareAlabamaReferences
} from "../src/state-ballot-alabama-discovery.js";
import { alabamaHash } from "../src/state-ballot-alabama-types.js";

const origin = "https://www.sos.alabama.gov";
const { body: robots }: { body: string } = JSON.parse(readFileSync(new URL("./fixtures/alabama-robots.json", import.meta.url), "utf8"));
const now = Date.parse("2026-11-02T12:00:00.000Z");
function capture(year = 2026, day = 3): AlabamaReferenceCapture {
	const annual = `${alabamaDiscoveryUrl}/${year}`;
	const index = `${origin}/alabama-votes/${year}-general-election-sample-ballots`;
	const prefix = `${origin}/sites/default/files/sample-ballots/${year}/gen/`;
	const parties = ["Democratic Party Candidates", "Republican Party Candidates", "Constitutional Amendments"];
	const pages: [string, string][] = [
		[`${origin}/robots.txt`, robots],
		[alabamaDiscoveryUrl, `<main><a href="${annual}">${year}</a></main>`],
		[
			annual,
			`<main><h2>General Election – November ${day}, ${year}</h2><a href="${index}">Sample Ballots</a>${parties.map((party, index) => `<a href="/sites/default/files/election-${year}/certification${index}.pdf">State Certification of ${party}</a>`).join("")}<h2>Other election</h2><a href="/unrelated">Candidates</a></main>`
		],
		[
			index,
			`<main><h1>${year} General Election Sample Ballots</h1><a href="${prefix}${year}GeneralElectionStatewideBack.pdf">Statewide amendments</a><table><tr>${[
				["Macon", "Macon_Sample.pdf"],
				["St. Clair", "StClair-Sample.pdf"]
			]
				.map(([county, file]) => `<td><a href="${prefix}${file}">${county}</a></td>`)
				.join("")}</tr></table></main>`
		]
	];
	return {
		schemaVersion: 1,
		type: "alabama-election-reference-capture",
		documents: pages.map(([url, body]) => ({
			url,
			body,
			sha256: alabamaHash(body),
			capturedAt: "2026-11-02T10:00:00.000Z"
		}))
	};
}
function edit(match: string, transform: (body: string) => string) {
	const changed = capture();
	const selected = changed.documents.find(item => item.url.includes(match))!;
	selected.body = transform(selected.body);
	selected.sha256 = alabamaHash(selected.body);
	return changed;
}

test("Alabama discovers offered county composites without downloading or qualifying candidates", () => {
	const result = prepareAlabamaReferences(capture(), now);
	assert.equal(result.elections[0].electionDate, "2026-11-03");
	assert.deepEqual(
		result.elections[0].countyBallots.map(item => item.county),
		["Macon", "St. Clair"]
	);
	assert.equal(result.elections[0].certifications.length, 3);
	assert.equal(result.documents.length, 4);
	assert.equal(result.candidateExtractionPerformed, false);
	assert.equal(result.candidateQualificationInferred, false);
	assert.equal(result.individualBallotApplicabilityVerified, false);
	assert.equal(result.countyFipsAssigned, false);
	assert.equal(alabamaReferenceCsv(result).trim().split("\n").length, 3);
	assert.deepEqual(prepareAlabamaReferences(capture(), now), result);
});
for (const [year, day] of [
	[2028, 7],
	[2030, 5],
	[2032, 2]
]) {
	test(`Alabama offered ${year} publications retain reusable date and county discovery`, () => {
		const result = prepareAlabamaReferences(capture(year, day), now);
		assert.equal(result.elections[0].electionDate, `${year}-11-0${day}`);
		assert(result.elections[0].countyBallots.every(item => item.url.includes(`/${year}/gen/`)));
	});
}
test("Alabama yearly discovery follows only explicit annual links", () => {
	assert.deepEqual(alabamaAnnualPages(`<main><a href="${alabamaDiscoveryUrl}/2028">2028</a></main>`), [
		["2028", `${alabamaDiscoveryUrl}/2028`]
	]);
	assert.throws(() => alabamaAnnualPages("<main>No annual publication</main>"));
	assert.throws(() => alabamaAnnualPages("<main><a href=\"/guess/2028\">2028</a></main>"));
	assert.throws(
		() =>
			prepareAlabamaReferences(
				edit("/election-information", body =>
					body.replace("</main>", `<a href="${alabamaDiscoveryUrl}/2028">2028</a></main>`)),
				now
			),
		/annual page is missing/u
	);
});
test("Alabama changed robots, new policy links and provenance errors require independent review", () => {
	assert.throws(
		() =>
			prepareAlabamaReferences(
				edit("/robots.txt", body => `${body}\nDisallow: /\n`),
				now
			),
		/robots publication/u
	);
	assert.throws(
		() =>
			prepareAlabamaReferences(
				edit("/election-information/2026", body => `${body}<a href="/terms">Terms</a>`),
				now
			),
		/policy links/u
	);
	const stale = capture();
	stale.documents[1].body += "changed";
	assert.throws(() => prepareAlabamaReferences(stale, now), /provenance/u);
	const future = capture();
	future.documents[1].capturedAt = "2099-01-01T00:00:00.000Z";
	assert.throws(() => prepareAlabamaReferences(future, now), /provenance/u);
});
test("Alabama requires the unique regular election date and complete certification controls", () => {
	for (const value of [
		edit("/election-information/2026", body => body.replace("November 3", "November 4")),
		edit("/election-information/2026", body =>
			body.replace("State Certification of Democratic Party Candidates", "Supplemental Candidates")),
		edit("/election-information/2026", body => body.replace("General Election", "Primary Election"))
	])
		assert.throws(() => prepareAlabamaReferences(value, now));
	assert.throws(
		() => alabamaGeneralElection("<main><h2>General Election – November 3, 2026</h2></main>", "2028"),
		/date conflicts/u
	);
});
test("Alabama wrong county, election, host and duplicate links fail closed", () => {
	for (const replacement of [
		"Mobile-Sample.pdf",
		"../2024/Macon_Sample.pdf",
		"https://evil.example/Macon_Sample.pdf",
		"Macon_Sample.pdf?download=1"
	]) {
		const changed = edit("/2026-general-election-sample-ballots", body =>
			body.replace(`${origin}/sites/default/files/sample-ballots/2026/gen/Macon_Sample.pdf`, replacement));
		assert.throws(() => prepareAlabamaReferences(changed, now));
	}
	assert.throws(() =>
		prepareAlabamaReferences(
			edit("/2026-general-election-sample-ballots", body =>
				body.replace("StClair-Sample.pdf", "Macon_Sample.pdf")),
			now
		)
	);
	assert.throws(() =>
		prepareAlabamaReferences(
			edit("/2026-general-election-sample-ballots", body =>
				body.replaceAll("2026 General Election Sample Ballots", "2024 General Election Sample Ballots")),
			now
		)
	);
});
test("Alabama empty, extra and oversized capture input cannot become a successful discovery", () => {
	assert.throws(() => prepareAlabamaReferences({}, now));
	const extra = capture();
	extra.documents.push({ ...extra.documents[1], url: `${origin}/unrelated` });
	assert.throws(() => prepareAlabamaReferences(extra, now), /extra or prohibited/u);
	assert.throws(
		() =>
			prepareAlabamaReferences(
				edit("/election-information", () => "x".repeat(3 * 1024 * 1024 + 1)),
				now
			),
		/provenance/u
	);
	assert.throws(
		() =>
			prepareAlabamaReferences(
				edit("/2026-general-election-sample-ballots", body =>
					body.replace(/<table>[\s\S]*?<\/table>/u, "<table></table>")),
				now
			),
		/empty, duplicate/u
	);
});
