import assert from "node:assert/strict";
import test from "node:test";
import { buildBallotContentProviderSummary, getBallotContentProviderOptions } from "../src/ballot-content-providers.js";

const envNames = [
	"BALLOTPEDIA_API_BASE_URL",
	"BALLOTPEDIA_API_KEY",
	"BALLOTREADY_API_KEY",
	"BALLOTREADY_API_URL",
	"CTCL_BIP_API_KEY",
	"CTCL_BIP_API_URL",
	"DEMOCRACY_WORKS_API_BASE_URL",
	"DEMOCRACY_WORKS_API_KEY",
	"GOOGLE_CIVIC_API_KEY",
] as const;

function withCleanProviderEnv(callback: () => void) {
	const previous = new Map<string, string | undefined>();

	for (const name of envNames) {
		previous.set(name, process.env[name]);
		delete process.env[name];
	}

	try {
		callback();
	}
	finally {
		for (const [name, value] of previous) {
			if (value === undefined)
				delete process.env[name];
			else
				process.env[name] = value;
		}
	}
}

test("ballot-content provider registry exposes optional providers without requiring keys", () => {
	withCleanProviderEnv(() => {
		const providers = getBallotContentProviderOptions();
		const ids = providers.map(provider => provider.id).sort();

		assert.deepEqual(ids, [
			"ballotpedia",
			"ballotready-civicengine",
			"ctcl-bip",
			"democracy-works",
			"google-civic",
		]);
		assert.equal(providers.find(provider => provider.id === "google-civic")?.connectionStatus, "needs_key");
		assert.equal(providers.find(provider => provider.id === "ctcl-bip")?.connectionStatus, "needs_partner_access");
		assert.equal(providers.find(provider => provider.id === "ballotpedia")?.envVars.includes("BALLOTPEDIA_API_KEY"), true);
		assert.equal(providers.find(provider => provider.id === "democracy-works")?.envVars.includes("DEMOCRACY_WORKS_API_KEY"), true);
		assert.equal(buildBallotContentProviderSummary().active, 0);
	});
});

test("ballot-content provider registry marks configured API paths active", () => {
	withCleanProviderEnv(() => {
		process.env.GOOGLE_CIVIC_API_KEY = "google";
		process.env.BALLOTPEDIA_API_KEY = "ballotpedia";
		process.env.DEMOCRACY_WORKS_API_KEY = "democracy-works";
		process.env.CTCL_BIP_API_URL = "https://example.org/ctcl";
		process.env.BALLOTREADY_API_KEY = "ballotready";
		process.env.BALLOTREADY_API_URL = "https://example.org/graphql";

		const providers = getBallotContentProviderOptions();

		assert.equal(providers.every(provider => provider.connectionStatus === "active"), true);
		assert.deepEqual(buildBallotContentProviderSummary(), {
			active: 5,
			needsAccess: 0,
			total: 5,
		});
	});
});
