import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("major sections have a shared responsive spacing rule", () => {
	assert.match(read("../uno.config.ts"), /\["section-stack", "space-y-16 lg:space-y-24"\]/u);
});

test("major page groups gain space while retaining compact print spacing", () => {
	for (const path of ["elections/[slug].vue", "locations/[slug].vue", "districts/[slug].vue", "ballot/[slug].vue"])
		assert.match(read(`../src/pages/${path}`), /class="[^"]*section-stack[^"]*print:space-y-8/u);
	for (const path of ["candidate/[slug]/index.vue", "representatives/[slug]/index.vue"])
		assert.match(read(`../src/pages/${path}`), /class="[^"]*section-stack[^"]*print:space-y-6/u);
});

test("representative categories use generous section gaps without expanding individual rows", () => {
	const page = read("../src/pages/representatives/index.vue");
	assert.match(page, /<div class="section-stack print:space-y-8">\s*<section\s+v-for="group in groupedRepresentatives"/u);
	assert.match(page, /v-for="group in groupedRepresentatives"[\s\S]*?class="space-y-5"/u);
	assert.match(page, /v-for="representative in group\.representatives"[\s\S]*?class="py-5 border-t/u);
});

test("representative background topics and statements have reading space with compact print gaps", () => {
	const page = read("../src/pages/representatives/[slug]/index.vue");
	const biography = page.slice(page.indexOf("id=\"biography\""), page.indexOf("id=\"actions\""));
	assert.match(biography, /gap-x-6 gap-y-12 grid[^"]*print:gap-6/u);
	assert.match(biography, /class="space-y-8 lg:space-y-12 print:!space-y-4"/u);
	assert.match(biography, /class="space-y-8 lg:space-y-12 print:!space-y-6"/u);
	assert.match(biography, /class="mt-4 space-y-8 lg:space-y-12 print:!space-y-3"/u);
});
