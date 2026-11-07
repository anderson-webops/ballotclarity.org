import type { IowaSampleCounty } from "./state-ballot-iowa-county-native.js";
import type { IowaSampleGeometry } from "./state-ballot-iowa-county-proof.js";
import type { IowaRenderedPageProof } from "./state-ballot-iowa-county-visual.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { validateIowaSampleGeometry } from "./state-ballot-iowa-county-proof.js";
import { inspectIowaSampleSvg, iowaRenderedWords } from "./state-ballot-iowa-county-visual.js";

export interface IowaSampleAppearance {
	schemaVersion: 1;
	sourceSha256: string;
	pages: IowaRenderedPageProof[];
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
	return Boolean(
		value
		&& typeof value === "object"
		&& !Array.isArray(value)
		&& Object.keys(value).sort().join("|") === [...keys].sort().join("|")
	);
}
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{64}$/u.test(value);
function integer(value: unknown, maximum: number) {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

export function validateIowaSampleAppearance(
	value: unknown,
	sourceSha256: string,
	bbox: string,
	geometry: IowaSampleGeometry[],
	county: IowaSampleCounty
): asserts value is IowaSampleAppearance {
	validateIowaSampleGeometry(geometry, county);
	assert(
		exact(value, ["schemaVersion", "sourceSha256", "pages"])
		&& value.schemaVersion === 1
		&& digest(value.sourceSha256)
		&& value.sourceSha256 === sourceSha256
		&& Array.isArray(value.pages)
		&& value.pages.length === 2,
		"The Iowa rendered appearance evidence requires review."
	);
	for (const [index, page] of value.pages.entries()) {
		assert(
			exact(page, [
				"page",
				"svgSha256",
				"bboxSha256",
				"geometrySha256",
				"wordInventorySha256",
				"words",
				"characters",
				"glyphs",
				"watermarkLayers",
				"images",
				"minimumContrast",
				"ruleContacts"
			]),
			"The Iowa rendered page fields require review."
		);
		const words = iowaRenderedWords(bbox, geometry[index]!, index + 1);
		const characters = words.reduce((sum, word) => sum + Array.from(word.text).length, 0);
		assert(
			page.page === index + 1
			&& digest(page.svgSha256)
			&& page.bboxSha256 === hash(bbox)
			&& page.geometrySha256 === hash(JSON.stringify(geometry[index]))
			&& page.wordInventorySha256 === hash(JSON.stringify(words))
			&& page.words === words.length
			&& page.characters === characters,
			"The Iowa rendered word or page provenance changed."
		);
		assert(
			integer(page.glyphs, 20000)
			&& Number(page.glyphs) >= Math.ceil(characters / 2)
			&& Number(page.glyphs) <= characters
			&& integer(page.ruleContacts, Number(page.glyphs) * 32)
			&& integer(page.watermarkLayers, county === "Monona" ? 1 : 0)
			&& integer(page.images, 4)
			&& typeof page.minimumContrast === "number"
			&& Number.isFinite(page.minimumContrast)
			&& page.minimumContrast >= 4.5
			&& page.minimumContrast <= 21,
			"The Iowa rendered visibility counters require review."
		);
	}
}

export function buildIowaSampleAppearance(
	sourceSha256: string,
	bbox: string,
	geometry: IowaSampleGeometry[],
	county: IowaSampleCounty,
	svgs: string[]
): IowaSampleAppearance {
	assert(Array.isArray(svgs) && svgs.length === 2, "The Iowa rendered page set is incomplete.");
	const appearance: IowaSampleAppearance = {
		schemaVersion: 1,
		sourceSha256,
		pages: svgs.map((svg, index) => inspectIowaSampleSvg(bbox, svg, geometry[index]!, county, index + 1))
	};
	validateIowaSampleAppearance(appearance, sourceSha256, bbox, geometry, county);
	return appearance;
}
