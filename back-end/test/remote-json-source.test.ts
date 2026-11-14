import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import {
	fetchRemoteJsonText,
	fetchRemoteSourceDocument,
	fetchRemoteSourceText,
	isPublicRemoteAddress,
	parseRemoteJsonUrl,
	RemoteSourceAccessChallengeError,
	RemoteSourceDocumentPolicyError,
} from "../src/remote-json-source.js";

const publicResolver = async () => [{ address: "93.184.216.34", family: 4 }];

test("Fulton native text and document aliases share a durable publisher interval before DNS", { timeout: 20000 }, async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "fulton-native-requests-")));
	const previous = process.env.FULTON_PUBLISHER_REQUEST_DIRECTORY;
	context.after(async () => {
		if (previous === undefined) delete process.env.FULTON_PUBLISHER_REQUEST_DIRECTORY;
		else process.env.FULTON_PUBLISHER_REQUEST_DIRECTORY = previous;
		await rm(directory, { recursive: true, force: true });
	});
	delete process.env.FULTON_PUBLISHER_REQUEST_DIRECTORY;
	let resolutions = 0;
	const starts: number[] = [];
	const options = { allowedHosts: ["fultoncountyga.gov", "www.fultoncountyga.gov"], resolveAddresses: async () => {
		resolutions++;
		return publicResolver();
	}, transport: async () => {
		starts.push(Date.now());
		return response({ body: "retained test body", contentType: "text/plain" });
	} };
	for (const request of [fetchRemoteSourceText, fetchRemoteSourceDocument]) await assert.rejects(request("https://fultoncountyga.gov/robots.txt", options), /Configure the shared Fulton/u);
	assert.equal(resolutions, 0);
	process.env.FULTON_PUBLISHER_REQUEST_DIRECTORY = directory;
	assert.equal(await fetchRemoteSourceText("https://fultoncountyga.gov/robots.txt", options), "retained test body");
	assert.equal((await fetchRemoteSourceDocument("https://www.fultoncountyga.gov/example.pdf", options)).body.toString(), "retained test body");
	assert.ok(starts[1]! - starts[0]! >= 10950);
	assert.equal(resolutions, 2);
	assert.equal(JSON.parse(await readFile(join(directory, "last-request.json"), "utf8")).attempts, 2);
	await assert.rejects(fetchRemoteSourceDocument("https://fultoncountyga.gov/example.pdf", { ...options, allowedHosts: [] }), /allowed bounded/u);
	assert.equal(resolutions, 2);
});

test("native DNS resolution has the same bounded deadline as the HTTP operation", async () => {
	for (const request of [fetchRemoteSourceText, fetchRemoteSourceDocument]) await assert.rejects(request("https://example.com/export", { allowedHosts: ["example.com"], timeoutMs: 5, resolveAddresses: () => new Promise(() => undefined), transport: async () => assert.fail("Timed-out DNS must never open a publisher request") }), /timed out/u);
});

test("redirects into Fulton require the configured gate before a second-host request", async (context) => {
	const previous = process.env.FULTON_PUBLISHER_REQUEST_DIRECTORY;
	delete process.env.FULTON_PUBLISHER_REQUEST_DIRECTORY;
	context.after(() => {
		if (previous !== undefined) process.env.FULTON_PUBLISHER_REQUEST_DIRECTORY = previous;
	});
	const hosts: string[] = [];
	await assert.rejects(fetchRemoteSourceText("https://example.com/start", { allowedHosts: ["example.com", "fultoncountyga.gov"], resolveAddresses: async (hostname) => {
		hosts.push(hostname);
		return publicResolver();
	}, transport: async () => response({ statusCode: 302, location: "https://fultoncountyga.gov/policy" }) }), /Configure the shared Fulton/u);
	assert.deepEqual(hosts, ["example.com"]);
});

const challenge = "<html><head><meta name=\"ROBOTS\" content=\"NOINDEX, NOFOLLOW\"></head><body><iframe id=\"main-iframe\" src=\"/_Incapsula_Resource?incident_id=synthetic\">Request unsuccessful. Incapsula incident ID: synthetic</iframe></body></html>";

test("challenge-only HTTP 200 pages are access failures before text or document parsing", async () => {
	for (const contentType of ["text/html", "TEXT/HTML; charset=utf-8", "application/xhtml+xml"]) {
		for (const capture of [fetchRemoteSourceText, fetchRemoteSourceDocument]) {
			let requests = 0;
			await assert.rejects(capture("https://example.com/elections", { allowedHosts: ["example.com"], resolveAddresses: publicResolver, transport: async () => {
				requests++;
				return response({ body: challenge, contentType });
			} }), error => error instanceof RemoteSourceAccessChallengeError && error.message === "The publisher returned an automated-access challenge.");
			assert.equal(requests, 1);
		}
	}
});

test("access challenge detection preserves real application pages, ordinary text and binary bytes", async () => {
	for (const [body, contentType] of [[challenge.replace("<body>", "<body><main>Candidate records</main>"), "text/html"], [challenge.replace("<body>", "<body><div>Candidate records</div>"), "text/html"], ["<html><body><a href=\"/_Incapsula_Resource\">Security documentation</a></body></html>", "text/html"], [challenge.replace("id=\"main-iframe\"", "id=\"example-frame\""), "text/html"], [challenge, "text/plain"], [challenge, "application/pdf"]] as const) {
		const options = { allowedHosts: ["example.com"], resolveAddresses: publicResolver, transport: async () => response({ body, contentType }) };
		assert.equal(await fetchRemoteSourceText("https://example.com/export", options), body);
		assert.deepEqual((await fetchRemoteSourceDocument("https://example.com/export", options)).body, Buffer.from(body));
	}
});

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
