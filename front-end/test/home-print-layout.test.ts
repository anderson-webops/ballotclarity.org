import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mainCss = readFileSync(new URL("../src/assets/styles/main.css", import.meta.url), "utf8");

test("homepage print layout collapses high-level desktop grids", () => {
	assert.match(mainCss, /@media print \{/);
	assert.match(mainCss, /\.home-hero-grid,[\s\S]+?\.home-roadmap-grid \{[\s\S]+?display: block !important;/);
	assert.match(mainCss, /\.home-hero-grid,[\s\S]+?grid-template-columns: 1fr !important;/);
});

test("homepage print layout keeps only compact card grids multi-column", () => {
	assert.match(mainCss, /\.home-trust-grid,[\s\S]+?\.home-result-grid \{[\s\S]+?display: grid !important;/);
	assert.match(mainCss, /\.home-trust-grid,[\s\S]+?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;/);
});
