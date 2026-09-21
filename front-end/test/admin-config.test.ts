import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const frontEndRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const adminAuthSource = readFileSync(resolve(frontEndRoot, "server/utils/admin-auth.ts"), "utf8");

test("admin proxy credentials and target use only production-validated canonical settings", () => {
	assert.match(adminAuthSource, /apiBase:\s*process\.env\.ADMIN_API_BASE/u);
	assert.match(adminAuthSource, /apiKey:\s*process\.env\.ADMIN_API_KEY/u);
	assert.match(adminAuthSource, /sessionSecret:\s*process\.env\.ADMIN_SESSION_SECRET/u);
	assert.doesNotMatch(adminAuthSource, /NUXT_ADMIN_(?:API_BASE|API_KEY|SESSION_SECRET)/u);
});
