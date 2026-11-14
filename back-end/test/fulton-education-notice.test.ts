import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { discoverFultonEducationNotices, readFultonEducationNotice } from "../src/fulton-education-notice.js";
import { prepareFultonEducationNoticeFiles } from "../src/prepare-fulton-education-notice.js";

const address = "https://fultoncountyga.gov/-/media/2030-Election/education-notice.pdf";
const section = `<div class="accordion-container faq-item"><h3>Call for Election - ESPLOST</h3><p>NOTICE IS HEREBY GIVEN that on November 5, 2030, an election will be held in all of the election districts of Fulton County.</p><a href="${address}">View notice</a></div>`;
const footer = `<footer><a href="/Privacy-Statement">Privacy Statement</a></footer>`;
const index = `<main>${section}</main>${footer}`;
const text = `NOTICE OF CALL FOR SPECIAL ELECTION
TO THE QUALIFIED VOTERS OF FULTON COUNTY
TO CONSIDER A SPECIAL ONE PERCENT SALES AND USE TAX
NOTICE IS HEREBY GIVEN that on November 5, 2030, an election will be held in all of the election districts of Fulton County
to determine whether a special one percent (1%) tax should be reimposed beginning July 1, 2031,
for a period not to exceed 20 calendar quarters to raise not more than $5,000,000.00.
For the Fulton County School District ("FCS"):
at a total maximum cost of $3,000,000.00
(i) Replace or reconfigure as needed for enrollment and
programmatic needs; specifically:
Replacement elementary school in Planning Region A
Replacement elementary school in Planning Region C
(ii) Critical systems if and as needed based on condition
and identified deficiencies:
Example Middle School
Another Elementary School
(iii) Other program needs.
For the Atlanta Independent School System:
at a total maximum cost of $2,000,000.00
(i) Replace or reconfigure as needed for enrollment and
programmatic needs; specifically:
(1) Example High School
(2) New Elementary School at an alternative
site in the Example feeder pattern
(ii) Other facilities as needed.
Section 2. General Obligation Debt Authorized for Atlanta Independent School System.
aggregate maximum principal amount not to exceed $100,000.00.
The maximum rate or rates of interest on such debt shall not exceed six percent 6% per annum.
Year: Principal Amount:
2032 $40,000.00
2033 $60,000.00
Section 3. Call for Election.
Section 4. Form of Ballot.
Shall this tax be imposed?\f`;

test("Fulton education discovery follows exact offered editions without constructing yearly document names", () => {
	assert.deepEqual(discoverFultonEducationNotices(index), [{ electionDate: "2030-11-05", url: address }]);
	assert.deepEqual(discoverFultonEducationNotices(index.replaceAll("2030", "2034")), [{ electionDate: "2034-11-05", url: address.replace("2030", "2034") }]);
	const newer = section.replaceAll("2030", "2034");
	assert.deepEqual(discoverFultonEducationNotices(index.replace("</main>", `${newer}</main>`)).map(notice => notice.electionDate), ["2030-11-05", "2034-11-05"]);
});

test("Fulton education discovery holds changed policies, duplicate editions and unsafe or missing links", () => {
	for (const changed of [index.replace("</main>", `${section}</main>`), index.replace(address, address.replace("https:", "http:")), index.replace(address, address.replace("fultoncountyga.gov", "elsewhere.example")), index.replace(address, `${address}?download=1`), index.replace(address, `${address}#page=1`), index.replace("</footer>", `<a href="/new-terms">Terms of Use</a></footer>`), index.replace("Call for Election - ESPLOST", "Unrecognized election notice"), index.replace("November 5, 2030", "February 31, 2030")]) assert.throws(() => discoverFultonEducationNotices(changed));
});

test("Fulton notice facts retain conditional named projects, maximum rates and exact reconciled principal cents", () => {
	const facts = readFultonEducationNotice(text, "2030-11-05");
	assert.equal(facts.projects.length, 6);
	assert.equal(facts.projects.at(-1)!.subject, "New Elementary School at an alternative site in the Example feeder pattern");
	assert.ok(facts.projects.every(project => project.fundingGuaranteed === false));
	assert.equal(facts.taxStartDate, "2031-07-01");
	assert.equal(facts.maximumAnnualInterestPercent, 6);
	assert.equal(facts.maximumBondPrincipalCents, 10000000);
	assert.equal(facts.maximumCollectionsCents, 500000000);
	assert.equal(facts.schedule.reduce((total, row) => total + row.maximumPrincipalCents, 0), facts.maximumBondPrincipalCents);
	assert.equal(facts.projectInventoryComplete, false);
	assert.equal(facts.electionOutcomeVerified, false);
	assert.equal(facts.actualInterestRateKnown, false);
	assert.equal(facts.publicationApproved, false);
	assert.deepEqual(readFultonEducationNotice(text.replaceAll("\n", "\n  "), "2030-11-05"), facts);
});

test("Fulton notice reuse follows source dates, amounts, principal years and wrapped pages", () => {
	const changed = text.replaceAll("2030", "2034").replaceAll("2031", "2035").replaceAll("2032", "2036").replaceAll("2033", "2037").replace("$100,000.00", "$110,000.00").replace("$40,000.00", "$50,000.00").replace("six percent 6%", "seven percent 7%");
	const facts = readFultonEducationNotice(changed, "2034-11-05");
	assert.deepEqual(facts.schedule.map(row => row.year), [2036, 2037]);
	assert.equal(facts.maximumAnnualInterestPercent, 7);
	const continued = text.replace("site in the Example feeder pattern", "1\fsite in the Example feeder pattern");
	assert.deepEqual(readFultonEducationNotice(continued, "2030-11-05").projects.at(-1)!.pages, [1, 2]);
	assert.notEqual(facts.projects[0]!.id, readFultonEducationNotice(text, "2030-11-05").projects[0]!.id);
});

test("Fulton notice review rejects inconsistent caps, principal schedules, rates and source dates", () => {
	for (const changed of [text.replace("$100,000.00", "$110,000.00"), text.replace("$5,000,000.00", "$6,000,000.00"), text.replace("six percent 6%", "five percent 6%"), text.replace("2033 $60,000.00", "2034 $60,000.00"), text.replace("Year: Principal Amount:", "Other terms"), text.replace("November 5, 2030", "November 6, 2030"), text.replace("special one percent (1%)", "special one percent (2%)")]) assert.throws(() => readFultonEducationNotice(changed, "2030-11-05"));
});

test("Fulton notice review holds incomplete lists, duplicate records, unsafe names and unexpected structure", () => {
	for (const changed of [text.replace("(2) New Elementary", "(3) New Elementary"), text.replace("Replacement elementary school in Planning Region C", "Replacement elementary school in Planning Region A"), text.replace("Example Middle School", "=Example Middle School"), text.replace("For the Atlanta Independent School System:", "Other school system:"), text.replace("Example High School", "Example\u0000High School"), `${text}${"\f".repeat(21)}`]) assert.throws(() => readFultonEducationNotice(changed, "2030-11-05"));
});

test("Fulton education preparation pins the original capture and leaves outputs untouched on invalid input", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "fulton-education-plan-")));
	context.after(() => rm(directory, { force: true, recursive: true }));
	const original = JSON.stringify({ schemaVersion: 1, type: "unrecognized-capture" });
	const capturePath = join(directory, "capture.json");
	await writeFile(capturePath, original);
	const plan = { schemaVersion: 1, type: "fulton-education-notice-preparation", capturePath, captureSha256: createHash("sha256").update(original).digest("hex"), outputRoot: join(directory, "prepared"), electionDate: "latest-published" };
	const path = join(directory, "plan.json");
	await writeFile(path, JSON.stringify({ ...plan, captureSha256: "0".repeat(64) }));
	await assert.rejects(prepareFultonEducationNoticeFiles(path), /manifest hash changed/u);
	await writeFile(path, JSON.stringify(plan));
	await assert.rejects(prepareFultonEducationNoticeFiles(path), /capture inventory/u);
	assert.equal((await readdir(directory)).includes("prepared"), false);
	await writeFile(path, JSON.stringify({ ...plan, extra: "unreviewed" }));
	await assert.rejects(prepareFultonEducationNoticeFiles(path), /pinned Fulton/u);
});
