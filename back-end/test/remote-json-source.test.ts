import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import test from "node:test";
import {
	fetchRemoteJsonText,
	fetchRemoteSourceText,
	isPublicRemoteAddress,
	parseRemoteJsonUrl,
} from "../src/remote-json-source.js";

const publicResolver = async () => [{ address: "93.184.216.34", family: 4 }];

function response(input: {
	body?: string;
	contentType?: string;
	location?: string;
	statusCode?: number;
}) {
	return {
		body: Readable.from([input.body ?? ""]),
		headers: {
			"content-type": input.contentType ?? "application/json",
			"location": input.location,
		},
		statusCode: input.statusCode ?? 200,
	};
}

test("remote JSON sources require public HTTPS destinations", async () => {
	assert.equal(isPublicRemoteAddress("93.184.216.34"), true);
	assert.equal(isPublicRemoteAddress("127.0.0.1"), false);
	assert.equal(isPublicRemoteAddress("10.0.0.4"), false);
	assert.equal(isPublicRemoteAddress("::1"), false);
	assert.throws(() => parseRemoteJsonUrl("http://example.com/coverage.json"), /HTTPS/u);
	assert.throws(() => parseRemoteJsonUrl("https://metadata.internal/coverage.json"), /not allowed/u);

	await assert.rejects(
		fetchRemoteJsonText("https://example.com/coverage.json", {
			resolveAddresses: async () => [{ address: "169.254.169.254", family: 4 }],
			transport: async () => response({ body: "{}" }),
		}),
		/resolved to a private/u
	);
});

test("official text imports retain form POSTs and enforce source-host redirect boundaries", async () => {
	const bodies: Array<string | undefined> = [];
	const body = await fetchRemoteSourceText("https://example.com/download", {
		allowedHosts: ["example.com"],
		postBody: "election=general",
		resolveAddresses: publicResolver,
		transport: async (input) => {
			bodies.push(input.postBody);
			return bodies.length === 1 ? response({ statusCode: 303, location: "/file.csv" }) : response({ contentType: "text/csv", body: "name\nSample\n" });
		},
	});
	assert.equal(body, "name\nSample\n");
	assert.deepEqual(bodies, ["election=general", undefined]);
	await assert.rejects(fetchRemoteSourceText("https://example.com/download", {
		allowedHosts: ["example.com"],
		resolveAddresses: publicResolver,
		transport: async () => response({ statusCode: 307, location: "https://another.example.com/file.csv" }),
	}), /allowlist/u);
});

test("official text imports reject bad UTF-8, private destinations, oversize bodies, and compressed input", async () => {
	for (const [headers, body, expected] of [
		[{ "content-type": "text/csv" }, Buffer.from([0xFF]), /encoded data/u],
		[{ "content-type": "text/csv" }, Buffer.from("12345"), /4-byte limit/u],
		[{ "content-encoding": "gzip" }, Buffer.from("name"), /compressed/u],
	] as const) {
		await assert.rejects(fetchRemoteSourceText("https://example.com/file.csv", {
			maxBytes: 4,
			resolveAddresses: publicResolver,
			transport: async () => ({ headers, body: Readable.from([body]), statusCode: 200 }),
		}), expected);
	}
	await assert.rejects(fetchRemoteSourceText("https://example.com/file.csv", {
		resolveAddresses: async () => [{ address: "127.0.0.1", family: 4 }],
		transport: async () => response({ body: "name\nSample\n" }),
	}), /private/u);
});

test("remote JSON redirects are revalidated and bounded", async () => {
	await assert.rejects(
		fetchRemoteJsonText("https://example.com/coverage.json", {
			resolveAddresses: async hostname => [{
				address: hostname === "private.example" ? "10.0.0.5" : "93.184.216.34",
				family: 4,
			}],
			transport: async () => response({
				location: "https://private.example/secret",
				statusCode: 302,
			}),
		}),
		/resolved to a private/u
	);

	await assert.rejects(
		fetchRemoteJsonText("https://example.com/coverage.json", {
			maxBytes: 4,
			resolveAddresses: publicResolver,
			transport: async () => response({ body: "12345" }),
		}),
		/exceeds the 4-byte limit/u
	);
});

test("remote JSON imports require JSON content and enforce timeouts", async () => {
	await assert.rejects(
		fetchRemoteJsonText("https://example.com/coverage.json", {
			resolveAddresses: publicResolver,
			transport: async () => response({
				body: "<html></html>",
				contentType: "text/html",
			}),
		}),
		/application\/json/u
	);

	await assert.rejects(
		fetchRemoteJsonText("https://example.com/coverage.json", {
			resolveAddresses: publicResolver,
			timeoutMs: 10,
			transport: async () => await new Promise(() => {}),
		}),
		/timed out after 10ms/u
	);
});
