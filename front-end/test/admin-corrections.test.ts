import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { getAdminCorrectionsState } from "../src/utils/admin-corrections-state.ts";

const correctionsPage = readFileSync(resolve("src/pages/admin/corrections.vue"), "utf8");

test("admin corrections queue exposes linked content workflow controls", () => {
	assert.match(correctionsPage, /useAdminSession\("admin-corrections-session"\)/);
	assert.match(correctionsPage, /useAdminContent\(\)/);
	assert.match(correctionsPage, /Linked content record/);
	assert.match(correctionsPage, /v-model="item\.contentId"/);
	assert.match(correctionsPage, /`\/admin\/content\/\$\{item\.contentId\}`/);
	assert.match(correctionsPage, /canManagePublicCorrections/);
	assert.match(correctionsPage, /Boolean\(session\.value\.mfaEnabledAt\)/);
	assert.match(correctionsPage, /New submissions remain private/);
});

test("corrections queue distinguishes loading, authentication, errors and a verified empty response", () => {
	const input = {
		authenticated: true,
		corrections: [],
		failed: false,
		pending: false,
		unauthorized: false
	};
	assert.equal(getAdminCorrectionsState(input), "empty");
	assert.equal(getAdminCorrectionsState({ ...input, pending: true }), "loading");
	assert.equal(getAdminCorrectionsState({ ...input, authenticated: false }), "authentication-required");
	assert.equal(getAdminCorrectionsState({ ...input, unauthorized: true }), "authentication-required");
	assert.equal(getAdminCorrectionsState({ ...input, failed: true }), "error");
	assert.equal(getAdminCorrectionsState({ ...input, corrections: null }), "error");
	assert.equal(getAdminCorrectionsState({ ...input, authenticated: undefined }), "error");
	assert.equal(getAdminCorrectionsState({ ...input, corrections: [{ id: "pending-report" }] }), "ready");
	assert.equal(
		getAdminCorrectionsState({ ...input, corrections: [{ id: "pending-report" }], failed: true }),
		"error"
	);
	assert.equal(getAdminCorrectionsState({ ...input, corrections: [{ id: "pending-report" }] }), "ready");
	assert.match(correctionsPage, /@retry="retryQueue"/);
	assert.match(correctionsPage, /Promise\.all\(\[refreshSession\(\), refresh\(\)\]\)/);
	assert.match(correctionsPage, /v-if="queueState === 'empty'"/);
	assert.match(correctionsPage, /v-else-if="queueState === 'ready'"/);
});
