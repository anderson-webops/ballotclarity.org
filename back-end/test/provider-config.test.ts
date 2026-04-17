import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";
import { getProviderConfigItems, resolveProviderCredential } from "../src/provider-config.js";

async function withEnv(overrides: Record<string, string | undefined>, run: () => void | Promise<void>) {
	const previous = new Map<string, string | undefined>();

	for (const [key, value] of Object.entries(overrides)) {
		previous.set(key, process.env[key]);

		if (value === undefined)
			delete process.env[key];
		else
			process.env[key] = value;
	}

	try {
		await run();
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

test("DATA_API_KEY acts as a fallback for Congress.gov and OpenFEC", async () => {
	await withEnv({
		CONGRESS_API_KEY: undefined,
		DATA_API_KEY: "shared-data-gov-key",
		OPENFEC_API_KEY: undefined
	}, () => {
		assert.deepEqual(resolveProviderCredential("congress"), {
			source: "DATA_API_KEY",
			value: "shared-data-gov-key"
		});
		assert.deepEqual(resolveProviderCredential("openfec"), {
			source: "DATA_API_KEY",
			value: "shared-data-gov-key"
		});

		const items = getProviderConfigItems();
		assert.equal(items.find(item => item.id === "data-gov")?.configured, true);
		assert.equal(items.find(item => item.id === "congress")?.configured, true);
		assert.equal(items.find(item => item.id === "openfec")?.configured, true);
	});
});

test("service-specific keys override DATA_API_KEY", async () => {
	await withEnv({
		CONGRESS_API_KEY: "direct-congress-key",
		DATA_API_KEY: "shared-data-gov-key",
		OPENFEC_API_KEY: "direct-openfec-key"
	}, () => {
		assert.deepEqual(resolveProviderCredential("congress"), {
			source: "CONGRESS_API_KEY",
			value: "direct-congress-key"
		});
		assert.deepEqual(resolveProviderCredential("openfec"), {
			source: "OPENFEC_API_KEY",
			value: "direct-openfec-key"
		});
	});
});
