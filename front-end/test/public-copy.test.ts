import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const publicSourceRoots = [
	new URL("../src/components", import.meta.url),
	new URL("../src/pages", import.meta.url)
];
const publicSourceFileRoot = new URL("../public/source-files", import.meta.url);

const referenceArchiveFragments = [
	"Elena Torres",
	"Daniel Brooks",
	"Naomi Park",
	"Thomas Bell",
	"Alicia Greene",
	"Marcus Hill",
	"Sandra Patel",
	"elena-torres",
	"daniel-brooks",
	"naomi-park",
	"thomas-bell",
	"alicia-greene",
	"marcus-hill",
	"sandra-patel"
];
const stagedSourceFileFragments = [
	...referenceArchiveFragments,
	"League of Metro Voters Demo File",
	"Reference archive",
	"reference archive",
	"reference-archive",
	"local reference source",
	"locally hosted reference",
	"stands in for",
	"staged reference archive"
];

function collectFiles(root: URL, predicate: (entry: string) => boolean) {
	const rootPath = fileURLToPath(root);
	const files: string[] = [];
	const pending = [rootPath];

	while (pending.length) {
		const current = pending.pop();
		if (!current)
			continue;

		for (const entry of readdirSync(current)) {
			const path = join(current, entry);
			const stats = statSync(path);

			if (stats.isDirectory()) {
				if (entry !== "admin")
					pending.push(path);
				continue;
			}

			if (predicate(entry))
				files.push(path);
		}
	}

	return files;
}

function collectPublicVueFiles(root: URL) {
	return collectFiles(root, entry => entry.endsWith(".vue"));
}

function collectPublicSourceTextFiles() {
	return collectFiles(publicSourceFileRoot, entry => entry.endsWith(".txt"));
}

function readPublicSource(relativePath: string) {
	return readFileSync(fileURLToPath(new URL(`../src/${relativePath}`, import.meta.url)), "utf8");
}

test("public copy does not expose staged reference-archive candidate names", () => {
	const failures: string[] = [];

	for (const root of publicSourceRoots) {
		for (const file of collectPublicVueFiles(root)) {
			const body = readFileSync(file, "utf8");
			for (const fragment of referenceArchiveFragments) {
				if (body.includes(fragment))
					failures.push(`${relative(process.cwd(), file)} contains ${fragment}`);
			}
		}
	}

	assert.deepEqual(failures, []);
});

test("public source actions only render when a resolved URL is available", () => {
	const sourceList = readPublicSource("components/SourceList.vue");
	const officialResourceList = readPublicSource("components/OfficialResourceList.vue");
	const sourceDetailPage = readPublicSource("pages/sources/[id].vue");

	assert.match(sourceList, /<a v-if="source\.url"/);
	assert.match(officialResourceList, /<a v-if="resource\.url"/);
	assert.match(sourceDetailPage, /<a v-if="data\.source\.url"/);
});

test("public source files do not ship staged reference-archive dossier content", () => {
	const failures: string[] = [];

	for (const file of collectPublicSourceTextFiles()) {
		const relativePath = relative(process.cwd(), file);
		const body = readFileSync(file, "utf8");

		for (const fragment of stagedSourceFileFragments) {
			if (relativePath.includes(fragment) || body.includes(fragment))
				failures.push(`${relativePath} contains ${fragment}`);
		}
	}

	assert.deepEqual(failures, []);
});

test("public corrections page stays reader-facing instead of admin-facing", () => {
	const correctionsPage = readPublicSource("pages/corrections.vue");

	assert.doesNotMatch(correctionsPage, /internal corrections/i);
	assert.doesNotMatch(correctionsPage, /internal queue/i);
	assert.doesNotMatch(correctionsPage, /admin queue/i);
	assert.match(correctionsPage, /private review notes/i);
	assert.match(correctionsPage, /Private contact details/i);
	assert.match(correctionsPage, /No public corrections have been posted/i);
	assert.match(correctionsPage, /When there are public correction records/i);
});

test("public policy pages disclose private access without admin jargon", () => {
	const privacyPage = readPublicSource("pages/privacy.vue");
	const termsPage = readPublicSource("pages/terms.vue");
	const policyText = `${privacyPage}\n${termsPage}`;

	assert.doesNotMatch(policyText, /internal admin/i);
	assert.doesNotMatch(policyText, /internal\/admin/i);
	assert.doesNotMatch(policyText, /admin auth/i);
	assert.doesNotMatch(policyText, /admin session/i);
	assert.doesNotMatch(policyText, /admin store/i);
	assert.match(policyText, /private editorial access/i);
	assert.match(policyText, /Editorial access accounts/i);
});

test("terms contact section stays user-facing instead of maintainer-facing", () => {
	const termsPage = readPublicSource("pages/terms.vue");

	assert.doesNotMatch(termsPage, /should stay aligned/i);
	assert.doesNotMatch(termsPage, /operator identity/i);
	assert.match(termsPage, /Formal notices should use the contact options listed here/);
});

test("public policy pages avoid host-specific maintenance wording", () => {
	const privacyPage = readPublicSource("pages/privacy.vue");
	const termsPage = readPublicSource("pages/terms.vue");
	const policyText = `${privacyPage}\n${termsPage}`;

	assert.doesNotMatch(policyText, /this host today/i);
	assert.doesNotMatch(policyText, /configured on a host/i);
	assert.doesNotMatch(policyText, /Some hosts may/i);
	assert.doesNotMatch(policyText, /host and operator settings/i);
	assert.doesNotMatch(policyText, /policy should be updated/i);
	assert.doesNotMatch(policyText, /This page should be read/i);
	assert.match(policyText, /configured for the site/i);
	assert.match(policyText, /The site may also use coarse geolocation/i);
	assert.match(policyText, /Managed through service settings/i);
	assert.match(policyText, /Privacy Policy will be updated/i);
	assert.match(policyText, /currently published for this service/i);
	assert.match(policyText, /What data Ballot Clarity currently handles/);
});

test("accessibility limits use public-facing availability language", () => {
	const accessibilityPage = readPublicSource("pages/accessibility.vue");

	assert.doesNotMatch(accessibilityPage, /not implemented/i);
	assert.doesNotMatch(accessibilityPage, /design system/i);
	assert.doesNotMatch(accessibilityPage, /internal standards/i);
	assert.doesNotMatch(accessibilityPage, /internal rules/i);
	assert.match(accessibilityPage, /Current limits/);
	assert.match(accessibilityPage, /Multilingual ballot content and alternative reading modes are not available yet/);
});

test("public project identity avoids unverified nonprofit status claims", () => {
	const aboutPage = readPublicSource("pages/about.vue");
	const footer = readPublicSource("components/AppFooter.vue");
	const homePage = readPublicSource("pages/index.vue");
	const neutralityPage = readPublicSource("pages/neutrality.vue");
	const identityText = `${aboutPage}\n${footer}\n${homePage}\n${neutralityPage}`;

	assert.doesNotMatch(identityText, /nonprofit mission/i);
	assert.doesNotMatch(identityText, /nonpartisan nonprofit/i);
	assert.doesNotMatch(identityText, /A nonprofit civic-information/i);
	assert.doesNotMatch(identityText, /Ballot Clarity is a nonprofit/i);
	assert.doesNotMatch(identityText, /501\(c\)\(3\)-style operating model/i);
	assert.match(identityText, /public-interest civic-information site/);
	assert.match(identityText, /Nonpartisan public-interest project/);
	assert.match(identityText, /does not currently claim tax-exempt status/);
});
