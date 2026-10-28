import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { generateKeyPairSync, randomUUID, verify } from "node:crypto";
import { mkdir, readdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { join } from "node:path";
import test from "node:test";
import {
	buildHandoff,
	deliverHandoff,
	deliverHandoffWithReceipt,
	handoffEndpoint,
	initializeHandoffClient
} from "../src/private-handoff-client.js";
import {
	authenticateHandoff,
	captureHandoffEvidence,
	HandoffError,
	handoffHash,
	handoffKeyId,
	handoffPath,
	maximumHandoffBytes,
	signHandoff,
	validateHandoff
} from "../src/private-handoff-protocol.js";
import { createHandoffReceiver } from "../src/private-handoff-receiver.js";
import { createHandoffInbox, readHandoffFile } from "../src/private-handoff-storage.js";
import {
	changeHandoffFile,
	handoffAudience,
	handoffFixture,
	handoffNow,
	handoffService,
	handoffTemporary
} from "./helpers/private-handoff.js";

test("the restricted HTTP signature profile binds every request component and exact body digest", () => {
	const fixture = handoffFixture();
	const id = randomUUID();
	const headers = signHandoff(fixture.body, handoffAudience, fixture.keys.privateKey, id, handoffNow);
	const parameters = headers["signature-input"].slice("handoff=".length);
	const base = `"@method": POST\n"@path": ${handoffPath}\n"content-digest": ${headers["content-digest"]}\n"x-handoff-id": ${id}\n"x-handoff-audience": ${handoffAudience}\n"@signature-params": ${parameters}`;
	assert.equal(
		verify(
			null,
			Buffer.from(base),
			fixture.keys.publicKey,
			Buffer.from(headers.signature.slice("handoff=:".length, -1), "base64")
		),
		true
	);
	assert.deepEqual(
		authenticateHandoff(
			headers,
			handoffAudience,
			new Map([[handoffKeyId(fixture.keys.publicKey), fixture.keys.publicKey]]),
			handoffNow
		),
		{ id, keyId: handoffKeyId(fixture.keys.publicKey), payloadSha256: handoffHash(fixture.body) }
	);
});

for (const name of [
	"signature",
	"signature-input",
	"content-digest",
	"x-handoff-id",
	"x-handoff-audience",
	"content-type"
]) {
	test(`signature authentication rejects changed ${name}`, () => {
		const fixture = handoffFixture();
		const headers = signHandoff(fixture.body, handoffAudience, fixture.keys.privateKey, randomUUID(), handoffNow);
		const changed = { ...headers, [name]: "changed" };
		assert.throws(
			() =>
				authenticateHandoff(
					changed,
					handoffAudience,
					new Map([[handoffKeyId(fixture.keys.publicKey), fixture.keys.publicKey]]),
					handoffNow
				),
			(error: unknown) => error instanceof HandoffError && error.status === 401
		);
	});
}

test("expired, future, compressed, unknown-key and duplicate-header requests fail closed", () => {
	const fixture = handoffFixture();
	const keys = new Map([[handoffKeyId(fixture.keys.publicKey), fixture.keys.publicKey]]);
	for (const timestamp of [handoffNow - 301000, handoffNow + 31000]) {
		assert.throws(() =>
			authenticateHandoff(
				signHandoff(fixture.body, handoffAudience, fixture.keys.privateKey, randomUUID(), timestamp),
				handoffAudience,
				keys,
				handoffNow
			)
		);
	}
	const headers = signHandoff(fixture.body, handoffAudience, fixture.keys.privateKey, randomUUID(), handoffNow);
	assert.throws(() => authenticateHandoff(headers, handoffAudience, new Map(), handoffNow));
	assert.throws(() =>
		authenticateHandoff({ ...headers, "content-encoding": "gzip" }, handoffAudience, keys, handoffNow)
	);
	assert.throws(() =>
		authenticateHandoff(
			{ ...headers, signature: [headers.signature, headers.signature] },
			handoffAudience,
			keys,
			handoffNow
		)
	);
	const other = generateKeyPairSync("ed25519");
	assert.throws(() =>
		authenticateHandoff(
			signHandoff(fixture.body, handoffAudience, other.privateKey, randomUUID(), handoffNow),
			handoffAudience,
			keys,
			handoffNow
		)
	);
});

const invalidPackets: [string, (fixture: ReturnType<typeof handoffFixture>) => void][] = [
	[
		"parent traversal",
		(fixture) => {
			fixture.envelope.files[0]!.name = "../config.json";
		}
	],
	[
		"absolute path",
		(fixture) => {
			fixture.envelope.files[0]!.name = "/tmp/config.json";
		}
	],
	[
		"duplicate filename",
		(fixture) => {
			fixture.envelope.files[1]!.name = fixture.envelope.files[0]!.name;
		}
	],
	[
		"missing required file",
		(fixture) => {
			fixture.envelope.files.pop();
		}
	],
	[
		"wrong file size",
		(fixture) => {
			fixture.envelope.files[0]!.bytes++;
		}
	],
	[
		"wrong file digest",
		(fixture) => {
			fixture.envelope.files[0]!.sha256 = "0".repeat(64);
		}
	],
	[
		"noncanonical base64",
		(fixture) => {
			fixture.envelope.files[0]!.contentBase64 += "\n";
		}
	],
	[
		"different audience",
		(fixture) => {
			fixture.envelope.audience = "another-service";
		}
	],
	[
		"release mismatch",
		(fixture) => {
			fixture.envelope.release.commit = "c".repeat(40);
		}
	],
	[
		"missing ZIP",
		(fixture) => {
			changeHandoffFile(
				fixture.envelope,
				"DATA-DELTA.json",
				JSON.stringify({ pendingFileCount: 1, archive: { created: true } })
			);
		}
	],
	[
		"private signing key",
		(fixture) => {
			changeHandoffFile(
				fixture.envelope,
				"CURRENT-SERVER-HANDOFF.md",
				"-----BEGIN PRIVATE KEY-----\nsynthetic rejected marker\n"
			);
		}
	],
	[
		"oversized individual file",
		(fixture) => {
			fixture.envelope.files[0]!.bytes = 8 * 1024 * 1024 + 1;
		}
	]
];
for (const [name, mutate] of invalidPackets) {
	test(`packet validation rejects ${name}`, () => {
		const fixture = handoffFixture();
		mutate(fixture);
		assert.throws(() => validateHandoff(Buffer.from(JSON.stringify(fixture.envelope)), handoffAudience));
	});
}

test("encoded request size, unknown envelope fields and invalid JSON are bounded", () => {
	assert.throws(
		() => validateHandoff(Buffer.alloc(maximumHandoffBytes + 1), handoffAudience),
		(error: unknown) => error instanceof HandoffError && error.status === 413
	);
	assert.throws(() => validateHandoff(Buffer.from("{"), handoffAudience));
	const fixture = handoffFixture();
	assert.throws(() =>
		validateHandoff(Buffer.from(JSON.stringify({ ...fixture.envelope, execute: true })), handoffAudience)
	);
});

test("pending archives are checksum-bound opaque custody, not extracted content", () => {
	const fixture = handoffFixture();
	const zip = Buffer.from("504b030400000000", "hex");
	changeHandoffFile(fixture.envelope, "PENDING-CONTENT.zip", zip);
	changeHandoffFile(fixture.envelope, "PENDING-CONTENT.zip.sha256", `${handoffHash(zip)}  PENDING-CONTENT.zip\n`);
	changeHandoffFile(
		fixture.envelope,
		"DATA-DELTA.json",
		JSON.stringify({
			pendingFileCount: 1,
			archive: { created: true, fileCount: 1, bytes: zip.length, sha256: handoffHash(zip) }
		})
	);
	changeHandoffFile(
		fixture.envelope,
		"PENDING-DELIVERY.json",
		JSON.stringify({
			pendingContentFiles: 1,
			currentSourceRelease: {
				sourceTag: fixture.envelope.release.tag,
				sourceCommit: fixture.envelope.release.commit,
				archiveSha256: fixture.envelope.release.archiveSha256,
				publicationVerified: true
			}
		})
	);
	assert.equal(validateHandoff(Buffer.from(JSON.stringify(fixture.envelope)), handoffAudience).files.length, 7);
	changeHandoffFile(fixture.envelope, "PENDING-CONTENT.zip.sha256", `${"0".repeat(64)}  PENDING-CONTENT.zip`);
	assert.throws(() => validateHandoff(Buffer.from(JSON.stringify(fixture.envelope)), handoffAudience));
});

test("private custody survives restart, exact retries and conflicting reuse without overwrite", async (context) => {
	const directory = join(await handoffTemporary(context), "inbox");
	const fixture = handoffFixture();
	const id = randomUUID();
	const authentication = {
		id,
		keyId: handoffKeyId(fixture.keys.publicKey),
		payloadSha256: handoffHash(fixture.body)
	};
	const keys = new Map([[handoffKeyId(fixture.keys.publicKey), fixture.keys.publicKey]]);
	const proof = (body = fixture.body, identity = id) =>
		captureHandoffEvidence(
			signHandoff(body, handoffAudience, fixture.keys.privateKey, identity, handoffNow),
			handoffNow
		);
	const inbox = await createHandoffInbox(directory, handoffAudience, undefined, undefined, keys);
	const accepted = await inbox.accept(fixture.body, authentication, handoffNow, proof());
	assert.equal(accepted.duplicate, false);
	assert.equal(accepted.receipt.custodyOnly, true);
	const before = await readFile(join(directory, id, "receipt.json"));
	const restarted = await createHandoffInbox(directory, handoffAudience, undefined, undefined, keys);
	const duplicate = await restarted.accept(fixture.body, authentication, handoffNow + 1000, proof());
	assert.deepEqual(duplicate.receipt, accepted.receipt);
	assert.equal(duplicate.duplicate, true);
	changeHandoffFile(fixture.envelope, "CURRENT-SERVER-HANDOFF.md", "Changed private handoff");
	const changed = Buffer.from(JSON.stringify(fixture.envelope));
	await assert.rejects(
		() =>
			restarted.accept(
				changed,
				{ ...authentication, payloadSha256: handoffHash(changed) },
				handoffNow,
				proof(changed)
			),
		(error: unknown) => error instanceof HandoffError && error.status === 409
	);
	assert.deepEqual(await readFile(join(directory, id, "receipt.json")), before);
	assert.equal((await stat(directory)).mode & 0o777, 0o700);
	for (const name of await readdir(join(directory, id)))
		assert.equal((await stat(join(directory, id, name))).mode & 0o777, 0o600);
});

test("capacity, interrupted locks, altered files and redirected paths preserve accepted state", async (context) => {
	const directory = await handoffTemporary(context);
	const fixture = handoffFixture();
	const inboxDirectory = join(directory, "inbox");
	const keys = new Map([[handoffKeyId(fixture.keys.publicKey), fixture.keys.publicKey]]);
	const inbox = await createHandoffInbox(inboxDirectory, handoffAudience, undefined, 1, keys);
	const id = randomUUID();
	const authentication = {
		id,
		keyId: handoffKeyId(fixture.keys.publicKey),
		payloadSha256: handoffHash(fixture.body)
	};
	const proof = (identity = id) =>
		captureHandoffEvidence(
			signHandoff(fixture.body, handoffAudience, fixture.keys.privateKey, identity, handoffNow),
			handoffNow
		);
	await inbox.accept(fixture.body, authentication, handoffNow, proof());
	const anotherId = randomUUID();
	await assert.rejects(
		() => inbox.accept(fixture.body, { ...authentication, id: anotherId }, handoffNow, proof(anotherId)),
		(error: unknown) => error instanceof HandoffError && error.status === 507
	);
	await writeFile(join(inboxDirectory, ".intake.lock"), "interrupted", { mode: 0o600 });
	await assert.rejects(
		() => inbox.accept(fixture.body, authentication, handoffNow, proof()),
		(error: unknown) => error instanceof HandoffError && error.status === 503
	);
	const other = join(directory, "other");
	await mkdir(other, { mode: 0o700 });
	await symlink(inboxDirectory, join(other, "redirect"));
	await assert.rejects(() =>
		createHandoffInbox(join(other, "redirect"), handoffAudience, undefined, undefined, keys)
	);
	await assert.rejects(() => readHandoffFile(join(other, "redirect"), 100));
	assert.equal((await readdir(join(inboxDirectory, id))).length, 8);
});

test("HTTP ingestion authenticates before staging and exposes neither files nor admin operations", async (context) => {
	const service = await handoffService(context);
	const url = service.origin + handoffPath;
	assert.equal((await fetch(url, { method: "POST", body: "private rejected body" })).status, 401);
	assert.equal((await fetch(url)).status, 404);
	assert.equal((await fetch(`${service.origin}/admin`)).status, 404);
	assert.deepEqual(await readdir(join(service.directory, "inbox")), []);
	const headers = signHandoff(service.body, handoffAudience, service.keys.privateKey, randomUUID(), handoffNow);
	assert.equal(
		(await fetch(url, { method: "POST", headers, body: `${service.body.toString("utf8")} ` })).status,
		400
	);
	assert.deepEqual(await readdir(join(service.directory, "inbox")), []);
	const accepted = await fetch(url, { method: "POST", headers, body: service.body.toString("utf8") });
	assert.equal(accepted.status, 201);
	assert.equal(accepted.headers.get("cache-control"), "no-store");
	assert.equal(((await accepted.json()) as { receipt: { custodyOnly: boolean } }).receipt.custodyOnly, true);
	assert.equal((await fetch(`${url}/${headers["x-handoff-id"]}`)).status, 404);
	assert.equal((await fetch(url, { method: "POST", headers, body: service.body.toString("utf8") })).status, 200);
});

test("sender rejects unsafe destinations and disabled or non-public verification keys", async (context) => {
	for (const endpoint of [
		undefined,
		"http://example.invalid/api/private-release-handoffs",
		"https://user:secret@example.invalid/api/private-release-handoffs",
		"https://example.invalid/api/private-release-handoffs?token=bad",
		"https://example.invalid/other",
		"https://example.invalid/api/private-release-handoffs#fragment"
	])
		assert.throws(() => handoffEndpoint(endpoint));
	const fixture = handoffFixture();
	const directory = await handoffTemporary(context);
	await assert.rejects(() => createHandoffReceiver({ directory, audience: handoffAudience, publicKeys: [] }));
	await assert.rejects(() =>
		createHandoffReceiver({ directory, audience: handoffAudience, publicKeys: [fixture.keys.privateKey] })
	);
	await assert.rejects(() => initializeHandoffClient(join(directory, ".ai-work", "keys"), handoffAudience));
});

test("real sender retries a lost receipt safely and caches durable custody across invocations", async (context) => {
	const service = await handoffService(context);
	const receiptsDirectory = join(service.directory, "receipts");
	let failures = 3;
	let requests = 0;
	const request: typeof fetch = async (input, init) => {
		requests++;
		const response = await service.request(input, init);
		if (failures > 0) {
			failures--;
			await response.body?.cancel();
			throw new TypeError("Controlled receipt loss");
		}
		return response;
	};
	const options = {
		endpoint: service.endpoint,
		audience: handoffAudience,
		key: service.keys.privateKey,
		body: service.body,
		receiptsDirectory,
		request,
		now: () => handoffNow,
		pause: async () => {}
	};
	await assert.rejects(() => deliverHandoffWithReceipt(options));
	assert.equal(requests, 3);
	assert.equal((await readdir(join(service.directory, "inbox"))).length, 1);
	const accepted = await deliverHandoffWithReceipt(options);
	assert.equal(accepted.duplicate, true);
	assert.equal(accepted.cached, false);
	assert.equal(requests, 4);
	const cached = await deliverHandoffWithReceipt(options);
	assert.equal(cached.cached, true);
	assert.deepEqual(cached.receipt, accepted.receipt);
	assert.equal(requests, 4);
	assert.equal((await readdir(join(service.directory, "inbox"))).length, 1);
});

test("mismatched or oversized receipts never become successful delivery", async () => {
	const fixture = handoffFixture();
	let attempts = 0;
	for (const responseBody of ["{\"duplicate\":false,\"receipt\":{}}", " ".repeat(17 * 1024)]) {
		await assert.rejects(() =>
			deliverHandoff({
				endpoint: `https://example.invalid${handoffPath}`,
				audience: handoffAudience,
				key: fixture.keys.privateKey,
				body: fixture.body,
				request: async () => {
					attempts++;
					return new Response(responseBody, { status: 201 });
				},
				pause: async () => {}
			})
		);
	}
	assert.equal(attempts, 6);
});

test("real active directory packing is snapshot-bound and rejects arbitrary or redirected files", async (context) => {
	const directory = await handoffTemporary(context);
	const fixture = handoffFixture();
	for (const file of fixture.envelope.files)
		await writeFile(join(directory, file.name), Buffer.from(file.contentBase64, "base64"), { mode: 0o600 });
	const packet = await buildHandoff(directory, handoffAudience, fixture.envelope.release);
	assert.equal(packet.envelope.files.length, 5);
	await writeFile(join(directory, "credentials.pem"), "synthetic forbidden filename", { mode: 0o600 });
	await assert.rejects(() => buildHandoff(directory, handoffAudience, fixture.envelope.release));
});

test("altered or incomplete stored packets never receive a duplicate custody acknowledgement", async (context) => {
	const fixture = handoffFixture();
	const directory = join(await handoffTemporary(context), "inbox");
	const keys = new Map([[handoffKeyId(fixture.keys.publicKey), fixture.keys.publicKey]]);
	const inbox = await createHandoffInbox(directory, handoffAudience, undefined, undefined, keys);
	const authentication = {
		id: randomUUID(),
		keyId: handoffKeyId(fixture.keys.publicKey),
		payloadSha256: handoffHash(fixture.body)
	};
	const proof = (identity = authentication.id) =>
		captureHandoffEvidence(
			signHandoff(fixture.body, handoffAudience, fixture.keys.privateKey, identity, handoffNow),
			handoffNow
		);
	await inbox.accept(fixture.body, authentication, handoffNow, proof());
	const receipt = await readFile(join(directory, authentication.id, "receipt.json"));
	await writeFile(join(directory, authentication.id, "CURRENT-SERVER-HANDOFF.md"), "altered test bytes", {
		mode: 0o600
	});
	await assert.rejects(
		() => inbox.accept(fixture.body, authentication, handoffNow, proof()),
		(error: unknown) => error instanceof HandoffError && error.status === 503
	);
	assert.deepEqual(await readFile(join(directory, authentication.id, "receipt.json")), receipt);
	const incomplete = { ...authentication, id: randomUUID() };
	await mkdir(join(directory, incomplete.id), { mode: 0o700 });
	await assert.rejects(() => inbox.accept(fixture.body, incomplete, handoffNow, proof(incomplete.id)));
	assert.deepEqual(await readdir(join(directory, incomplete.id)), []);
});

test("declared oversized requests are rejected without creating staged content", async (context) => {
	const service = await handoffService(context);
	const headers = signHandoff(service.body, handoffAudience, service.keys.privateKey, randomUUID(), handoffNow);
	const status = await new Promise<number>((resolve, reject) => {
		const request = httpRequest(
			service.origin + handoffPath,
			{ method: "POST", headers: { ...headers, "content-length": maximumHandoffBytes + 1 } },
			(response) => {
				response.resume();
				resolve(response.statusCode!);
			}
		);
		request.on("error", reject);
		request.end();
	});
	assert.equal(status, 413);
	assert.deepEqual(await readdir(join(service.directory, "inbox")), []);
});

test("two authenticated slow bodies cannot create unbounded concurrent intake", async (context) => {
	const service = await handoffService(context);
	const pending = [];
	let observed = 0;
	let ready: () => void = () => {};
	const admitted = new Promise<void>((resolve) => {
		ready = resolve;
	});
	service.server.on("request", () => {
		observed++;
		if (observed === 2) ready();
	});
	for (let index = 0; index < 2; index++) {
		const request = httpRequest(service.origin + handoffPath, {
			method: "POST",
			headers: {
				...signHandoff(service.body, handoffAudience, service.keys.privateKey, randomUUID(), handoffNow),
				"content-length": service.body.length
			}
		});
		request.on("error", () => {});
		request.write(service.body.subarray(0, 1));
		pending.push(request);
	}
	await admitted;
	const response = await fetch(service.origin + handoffPath, {
		method: "POST",
		headers: signHandoff(service.body, handoffAudience, service.keys.privateKey, randomUUID(), handoffNow),
		body: service.body.toString("utf8")
	});
	assert.equal(response.status, 429);
	for (const request of pending) request.destroy();
	assert.deepEqual(await readdir(join(service.directory, "inbox")), []);
});

test("a revoked enrollment cannot authenticate against an independently restarted receiver", async (context) => {
	const fixture = handoffFixture();
	const other = generateKeyPairSync("ed25519");
	const directory = await handoffTemporary(context);
	const server = await createHandoffReceiver({
		directory,
		audience: handoffAudience,
		publicKeys: [other.publicKey],
		now: () => handoffNow
	});
	await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
	context.after(() => new Promise<void>(resolve => server.close(() => resolve())));
	const address = server.address();
	assert(address && typeof address !== "string");
	const response = await fetch(`http://127.0.0.1:${address.port}${handoffPath}`, {
		method: "POST",
		headers: signHandoff(fixture.body, handoffAudience, fixture.keys.privateKey, randomUUID(), handoffNow),
		body: fixture.body.toString("utf8")
	});
	assert.equal(response.status, 401);
	assert.deepEqual(await readdir(directory), []);
});
