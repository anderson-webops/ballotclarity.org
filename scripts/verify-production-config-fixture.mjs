import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function secret() {
	return randomBytes(32).toString("hex");
}

function writeJson(path, value) {
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeEnv(path, values) {
	const content = Object.entries(values)
		.map(([key, value]) => `${key}=${value}`)
		.join("\n");

	writeFileSync(path, `${content}\n`, "utf8");
}

const root = mkdtempSync(join(tmpdir(), `ballot-clarity-prod-fixture-${randomUUID()}-`));
const snapshotPath = join(root, "live-coverage.active.json");
const envPath = join(root, "production.env");

try {
	writeJson(snapshotPath, {
		updatedAt: "2026-04-19T19:36:50.252Z",
	});
	writeJson(`${snapshotPath}.meta.json`, {
		approvedAt: "2026-04-19T19:36:50.252Z",
		importedAt: "2026-04-19T19:36:50.252Z",
		reviewedAt: "2026-04-19T19:36:50.252Z",
		sourceLabel: "CI production configuration fixture",
		sourceType: "imported",
		status: "production_approved",
	});
	writeEnv(envPath, {
		ADMIN_API_BASE: "http://127.0.0.1:3001/api",
		ADMIN_API_KEY: secret(),
		ADMIN_DATABASE_URL: "postgres://ballotclarity:secret@db.internal:5432/ballotclarity",
		ADMIN_LOGIN_LOCKOUT_MS: "1800000",
		ADMIN_LOGIN_MAX_ATTEMPTS: "5",
		ADMIN_LOGIN_WINDOW_MS: "900000",
		ADMIN_SESSION_SECRET: secret(),
		ADMIN_STORE_DRIVER: "postgres",
		CONTACT_ADDRESS: "hello@ballotclarity.org",
		CONTACT_ADDRESS_SESSION_SECRET: secret(),
		LIVE_COVERAGE_FILE: snapshotPath,
		LIVE_COVERAGE_REQUIRED: "true",
		NUXT_PUBLIC_API_BASE: "https://ballotclarity.org/api/",
		NUXT_PUBLIC_SITE_URL: "https://ballotclarity.org",
		PUBLIC_FEEDBACK_RATE_LIMIT_MAX: "5",
		PUBLIC_FEEDBACK_RATE_LIMIT_WINDOW_MS: "600000",
		PUBLIC_LOOKUP_RATE_LIMIT_MAX: "60",
		PUBLIC_LOOKUP_RATE_LIMIT_WINDOW_MS: "600000",
		SOURCE_ASSET_BASE_URL: "https://assets.ballotclarity.org/source-files",
		TRUST_PROXY: "true",
	});

	const result = spawnSync(
		process.execPath,
		[join(repoRoot, "scripts", "production-config-check.mjs"), "--env-file", envPath],
		{
			cwd: repoRoot,
			encoding: "utf8",
		},
	);

	if (result.stdout)
		process.stdout.write(result.stdout);

	if (result.stderr)
		process.stderr.write(result.stderr);

	process.exitCode = result.status ?? 1;
}
finally {
	rmSync(root, {
		force: true,
		recursive: true,
	});
}
