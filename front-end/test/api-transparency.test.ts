import assert from "node:assert/strict";
import test from "node:test";
import { publicApiTransparencyItems } from "../src/utils/api-transparency.ts";

test("public API transparency list covers the main nationwide provider stack", () => {
	assert.ok(publicApiTransparencyItems.length >= 6);
	assert.ok(publicApiTransparencyItems.some(item => item.id === "census-geocoder"));
	assert.ok(publicApiTransparencyItems.some(item => item.id === "open-states"));
	assert.ok(publicApiTransparencyItems.some(item => item.id === "openfec"));
	assert.ok(publicApiTransparencyItems.some(item => item.id === "lda-gov"));
	assert.ok(publicApiTransparencyItems.every(item => item.docsUrl.startsWith("https://")));
	assert.ok(publicApiTransparencyItems.every(item => item.routeFamilies.length > 0));
});
