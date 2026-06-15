import assert from "node:assert/strict";
import test from "node:test";
import {
	summarizeGoogleCivicProviderFailure,
	summarizeProviderBody,
	summarizeProviderProbeError,
} from "../src/provider-diagnostic-messages.js";

test("summarizeProviderBody normalizes whitespace and truncates long provider payloads", () => {
	const summary = summarizeProviderBody(" first\n\nsecond\tthird ".repeat(20), 32);

	assert.equal(summary.length, 32);
	assert.doesNotMatch(summary, /\s{2,}/);
	assert.match(summary, /^first second third first/);
});

test("Google Civic diagnostics explain IP-restricted API key failures", () => {
	const message = summarizeGoogleCivicProviderFailure(403, JSON.stringify({
		error: {
			code: 403,
			message: "The provided API key has an IP address restriction. The originating IP address of the call violates this restriction."
		}
	}));

	assert.match(message, /public IP address is not allowed/i);
	assert.match(message, /Update the key's allowed IPs/i);
	assert.match(message, /clear GOOGLE_CIVIC_API_KEY/i);
	assert.match(message, /Response 403/);
});

test("Google Civic diagnostics explain invalid API key failures", () => {
	const message = summarizeGoogleCivicProviderFailure(400, JSON.stringify({
		error: {
			code: 400,
			message: "API key not valid. Please pass a valid API key.",
			status: "INVALID_ARGUMENT"
		}
	}));

	assert.match(message, /rejected the configured API key as invalid/i);
	assert.match(message, /Replace GOOGLE_CIVIC_API_KEY/i);
});

test("Google Civic diagnostics preserve generic provider failures", () => {
	const message = summarizeGoogleCivicProviderFailure(500, "temporary upstream failure");

	assert.equal(message, "Elections probe failed with 500: temporary upstream failure");
});

test("provider probe diagnostics explain network and timeout failures", () => {
	const timeoutMessage = summarizeProviderProbeError(
		new DOMException("The operation was aborted.", "AbortError"),
		15000,
	);
	const networkMessage = summarizeProviderProbeError(new TypeError("fetch failed"), 15000);

	assert.match(timeoutMessage, /timed out after 15000ms/i);
	assert.match(timeoutMessage, /outbound HTTPS, DNS, proxy\/VPN/i);
	assert.match(networkMessage, /failed before the provider returned a response/i);
	assert.match(networkMessage, /Detail: fetch failed/i);
});
