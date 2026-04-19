import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";
import { createApp } from "../src/server.js";

async function withEnv<T>(overrides: Record<string, string>, run: () => Promise<T>) {
	const previous = new Map<string, string | undefined>();

	for (const [key, value] of Object.entries(overrides)) {
		previous.set(key, process.env[key]);
		process.env[key] = value;
	}

	try {
		return await run();
	}
	finally {
		for (const [key, value] of previous.entries()) {
			if (value === undefined)
				delete process.env[key];
			else
				process.env[key] = value;
		}
	}
}

test("createApp falls back to local sqlite/no-cache startup when postgres is unavailable in non-production", async () => {
	await withEnv({
		ADMIN_DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:1/ballot_clarity",
		ADMIN_STORE_DRIVER: "postgres",
		DATABASE_URL: "",
		NODE_ENV: "test",
	}, async () => {
		const app = await createApp();

		assert.equal(typeof app.listen, "function");
	});
});
