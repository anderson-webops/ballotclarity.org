import type { PublicStateCandidateRecord } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { electionOfficeLabel, groupElectionCandidates } from "../src/utils/election-candidates.ts";
import { readRecoverableStateRecordQuery } from "../src/utils/state-record-query.ts";

test("election candidates retain every sourced person in federal, state and local office groups", () => {
	const records: PublicStateCandidateRecord[] = [
		{ id: "federal-one", name: "First Federal", office: "United States Senate", scope: "statewide", district: "", status: "listed", party: "Republican" },
		{ id: "federal-two", name: "Second Federal", office: "United States Senate", scope: "statewide", district: "", status: "listed", party: "Democratic" },
		{ id: "state", name: "State Person", office: "State Senate", scope: "state-senate", district: "48", status: "listed" },
		{ id: "local", name: "Local Person", office: "County Commissioner", scope: "local", district: "5", status: "write-in" }
	];
	const before = structuredClone(records);
	const groups = groupElectionCandidates(records);
	assert.deepEqual(groups.map(group => group.label), ["Federal", "State", "Local"]);
	assert.equal(groups[0]!.offices[0]!.candidates.length, 2);
	assert.equal(groups[1]!.offices[0]!.title, "State Senate, District 48");
	assert.deepEqual(groups.flatMap(group => group.offices.flatMap(office => office.candidates)), records);
	assert.deepEqual(records, before);
	assert.deepEqual(groups.map(group => group.offices[0]!.anchorId), ["candidate-office-federal-one", "candidate-office-state", "candidate-office-local"]);
});

test("office contents labels stay short while retaining district and unexpired-seat distinctions", () => {
	for (const [title, label] of [
		["United States Senate", "U.S. Senate"],
		["United States House of Representatives - District 5", "U.S. House 5"],
		["State House of Representatives – District 52", "State House 52"],
		["Secretary of State", "Secretary of State"],
		["Public Service Commissioner District 3", "Public Service 3"],
		["County Commissioner – District 4 (Unexpired Term)", "Commission 4 Unexpired"],
		["Supreme Court - Justice Position #01 (Unexpired)", "Supreme #01 Unexpired"],
		["Fulton Soil & Water Conservation District Supervisor", "Soil & Water"]
	]) {
		assert.equal(electionOfficeLabel(title!), label);
		assert(electionOfficeLabel(title!).split(" ").length <= 3);
	}
});

test("known state records load automatically while explicit selections and invalid inputs retain precedence", () => {
	const states = [{ stateCode: "GA", stateName: "Georgia", configured: true }, { stateCode: "WA", stateName: "Washington", configured: true }];
	assert.equal(readRecoverableStateRecordQuery({}, states, "Georgia").stateCode, "GA");
	assert.equal(readRecoverableStateRecordQuery({ state: "WA" }, states, "GA").stateCode, "WA");
	assert.equal(readRecoverableStateRecordQuery({ state: "" }, states, "GA").stateCode, "");
	assert.equal(readRecoverableStateRecordQuery({ state: "invalid" }, states, "GA").stateCode, "");
	assert.equal(readRecoverableStateRecordQuery({}, states).stateCode, "");
});

test("overview and location watchers only track loaded data, not their own store writes", () => {
	const overview = readFileSync(new URL("../src/pages/elections/[slug].vue", import.meta.url), "utf8");
	const location = readFileSync(new URL("../src/pages/locations/[slug].vue", import.meta.url), "utf8");
	assert.match(overview, /watch\(data,/u);
	assert.match(location, /watch\(\[jurisdiction, nextElectionData\]/u);
	assert.doesNotMatch(overview + location, /watchEffect\(/u);
	assert.match(overview, /<ElectionCandidateRecords/u);
	for (const token of ["lg:col-start-2", "lg:row-span-2", "lg:row-start-1"])
		assert(overview.includes(token));
	assert.match(overview, /<ElectionKeyDates[^>]* compact/u);
	assert.doesNotMatch(overview, /Open location hub|pastKeyDates|changeLog/u);
});

test("compact deadlines retain the election's calendar date and consequential voting-time notes", () => {
	const dates = readFileSync(new URL("../src/components/ElectionKeyDates.vue", import.meta.url), "utf8");
	assert.match(dates, /props.electionDate && item.label === "Election Day polls close"/u);
	assert.match(dates, /:datetime="compactDate\(item\)"/u);
	assert.match(dates, /v-if="compactNote\(item\)"/u);
	assert.match(dates, /v-if="item.isNext"/u);
});

test("overview contents use native fragments below deadlines with visible hover and keyboard feedback", () => {
	const overview = readFileSync(new URL("../src/pages/elections/[slug].vue", import.meta.url), "utf8");
	const contents = overview.slice(overview.indexOf("<nav v-if=\"sectionLinks.length\""), overview.indexOf("</nav>"));
	assert(overview.indexOf("id=\"key-dates\"") < overview.indexOf("<nav v-if=\"sectionLinks.length\""));
	assert.match(contents, /<a :href="section.href"/u);
	assert.doesNotMatch(contents, /NuxtLink|target=|@click/u);
	assert.match(contents, /dark:hover:text-white/u);
	assert.match(contents, /dark:focus-visible:text-white/u);
	assert.match(overview, /@sections="candidateSections = \$event"/u);
	for (const target of ["ballot-items", "voting-info"])
		assert.match(overview, new RegExp(`id="${target}" tabindex="-1"`, "u"));
});

test("candidate contents follow available groups after mounting without extra source requests", () => {
	const candidates = readFileSync(new URL("../src/components/ElectionCandidateRecords.vue", import.meta.url), "utf8");
	assert.match(candidates, /const mounted = useMounted\(\)/u);
	assert.match(candidates, /watch\(\[mounted, sections\]/u);
	assert.match(candidates, /if \(ready\) emit\("sections", items\)/u);
	assert.match(candidates, /data.value\?\.available && !pending.value && !error.value && groups.value.length/u);
	assert.match(candidates, /href: "#candidates-heading", label: "Candidates"/u);
	assert.match(candidates, /href: `#candidate-level-\$\{group.id\}`/u);
	assert.match(candidates, /children: group.offices.map/u);
	assert.match(candidates, /label: electionOfficeLabel\(office.title\), title: office.title/u);
	assert.match(candidates, /<h4 :id="office.anchorId" tabindex="-1"/u);
	assert.match(candidates, /<h3 :id="`candidate-level-\$\{level.id\}`" tabindex="-1"/u);
	assert.doesNotMatch(candidates, /MutationObserver|watchEffect/u);
});
