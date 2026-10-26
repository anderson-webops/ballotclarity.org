import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import test from "node:test";
import {
	fetchRemoteJsonText,
	fetchRemoteSourceDocument,
	fetchRemoteSourceText,
	isPublicRemoteAddress,
	parseRemoteJsonUrl,
	RemoteSourceDocumentPolicyError,
} from "../src/remote-json-source.js";

const publicResolver = async () => [{ address: "93.184.216.34", family: 4 }];

test("legacy text decoding is an explicit source option, keeps valid UTF-8 and rejects invalid default or undefined legacy bytes", async () => {
	const legacy = Buffer.from([0x46, 0xE9, 0x6C, 0x69, 0x78]);
	const options = { allowedHosts: ["example.com"], resolveAddresses: publicResolver, maxRedirects: 0, transport: async () => ({ statusCode: 200, headers: { "content-type": "application/tab-separated-values" }, body: Readable.from([legacy]) }) };
	await assert.rejects(fetchRemoteSourceText("https://example.com/export", options));
	assert.equal(await fetchRemoteSourceText("https://example.com/export", { ...options, textEncoding: "utf-8-or-windows-1252" }), "Félix");
	for (const name of ["Félix", "王 Example"]) assert.equal(await fetchRemoteSourceText("https://example.com/export", { ...options, textEncoding: "utf-8-or-windows-1252", transport: async () => ({ statusCode: 200, headers: {}, body: Readable.from([Buffer.from(name)]) }) }), name);
	for (const bytes of [Buffer.from([0x81]), Buffer.from([0xEF, 0xBB, 0xBF, 0xFF])]) await assert.rejects(fetchRemoteSourceText("https://example.com/export", { ...options, textEncoding: "utf-8-or-windows-1252", transport: async () => ({ statusCode: 200, headers: {}, body: Readable.from([bytes]) }) }));
});

test("public document captures preserve binary bytes and never follow redirects", async () => {
	const bytes = Buffer.from([37, 80, 68, 70, 45, 255, 0, 128]);
	const result = await fetchRemoteSourceDocument("https://example.com/file.pdf", { allowedHosts: ["example.com"], resolveAddresses: publicResolver, etag: "\"old\"", transport: async (input) => {
		assert.equal(input.etag, "\"old\"");
		assert.equal(input.document, true);
		return { statusCode: 200, headers: { "content-type": "application/pdf", "etag": "W/\"new\"" }, body: Readable.from([bytes]) };
	} });
	assert.deepEqual(result.body, bytes);
	assert.equal(result.etag, "W/\"new\"");
	assert.equal(result.contentType, "application/pdf");
	let requests = 0;
	const redirect = await fetchRemoteSourceDocument("https://example.com/file.pdf", { allowedHosts: ["example.com"], resolveAddresses: publicResolver, transport: async () => {
		requests++;
		return response({ statusCode: 302, location: "https://private.invalid/file.pdf" });
	} });
	assert.equal(redirect.status, 302);
	assert.equal(redirect.location, "https://private.invalid/file.pdf");
	assert.equal(redirect.body.length, 0);
	assert.equal(requests, 1);
});

test("public document redirect observations expose bounded metadata without following it", async () => {
	for (const location of ["https://example.com/canonical-policy", "/relative-policy", `https://example.com/${"a".repeat(2048)}`, "https://example.com/\r\nInjected: value"]) {
		let requests = 0;
		const result = await fetchRemoteSourceDocument("https://example.com/policy", { allowedHosts: ["example.com"], resolveAddresses: publicResolver, transport: async () => {
			requests++;
			return response({ statusCode: 301, location });
		} });
		assert.equal(result.status, 301);
		assert.equal(result.body.length, 0);
		assert.equal(requests, 1);
		assert.equal(result.location, /^[\x21-\x7E]{1,2048}$/u.test(location) ? location : undefined);
	}
});

test("public document requests reject header injection, private DNS, fragments and oversized bodies", async () => {
	for (const input of [{ etag: "\"old\"\r\nX-Header: injected" }, { maxBytes: 13 * 1024 * 1024 }, { allowedHosts: [] }]) {
		await assert.rejects(fetchRemoteSourceDocument("https://example.com/file.pdf", { allowedHosts: ["example.com"], resolveAddresses: publicResolver, ...input }), /allowed bounded/u);
	}
	await assert.rejects(fetchRemoteSourceDocument("https://example.com/file.pdf#page=1", { allowedHosts: ["example.com"], resolveAddresses: publicResolver }), /allowed bounded/u);
	await assert.rejects(fetchRemoteSourceDocument("https://example.com/file.pdf", { allowedHosts: ["example.com"], resolveAddresses: async () => [{ address: "127.0.0.1", family: 4 }] }), /private/u);
	await assert.rejects(fetchRemoteSourceDocument("https://example.com/file.pdf", { allowedHosts: ["example.com"], resolveAddresses: publicResolver, maxBytes: 4, transport: async () => response({ body: "%PDF-too-large" }) }), RemoteSourceDocumentPolicyError);
});

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
