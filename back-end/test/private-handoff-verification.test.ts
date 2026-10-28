import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { execFileSync, spawnSync } from "node:child_process";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { captureHandoffEvidence, HandoffError, handoffHash, handoffKeyId, signHandoff, verifyHandoffEvidence } from "../src/private-handoff-protocol.js";
import { verifyStoredHandoff, verifyStoredHandoffWithConfig } from "../src/private-handoff-verification.js";
import { handoffAudience, handoffFixture, handoffNow, handoffService } from "./helpers/private-handoff.js";

async function stored(context: TestContext) {
	const service = await handoffService(context);
	const id = randomUUID();
	const headers = signHandoff(service.body, handoffAudience, service.keys.privateKey, id, handoffNow);
	const response = await service.request(service.endpoint, { method: "POST", headers, body: service.body });
	assert.equal(response.status, 201);
	const accepted = await response.json();
	return { ...service, id, headers, accepted, packet: join(service.directory, "inbox", id), options: { audience: handoffAudience, publicKeys: [service.keys.publicKey], release: service.envelope.release } };
}

test("durable authentication preserves the original headers and is independently verified after ingress expiry", async (context) => {
	const packet = await stored(context);
	const evidence = JSON.parse(await readFile(join(packet.packet, "authentication.json"), "utf8"));
	assert.deepEqual(evidence, captureHandoffEvidence(packet.headers, handoffNow));
	assert.equal(evidence.schemaVersion, 1);
	assert.equal(evidence.authenticatedAt, new Date(handoffNow).toISOString());
	assert(handoffNow + 301000 < Date.now());
	const result = await verifyStoredHandoff(packet.packet, packet.options);
	assert.equal(result.status, "verified");
	assert.equal(result.payloadSha256, handoffHash(packet.body));
	assert.equal(result.keyId, handoffKeyId(packet.keys.publicKey));
	assert.equal(result.files, 5);
	const retryHeaders = signHandoff(packet.body, handoffAudience, packet.keys.privateKey, packet.id, handoffNow + 31000);
	const response = await packet.request(packet.endpoint, { method: "POST", headers: retryHeaders, body: packet.body });
	assert.equal(response.status, 401);
	const originalRetry = await packet.request(packet.endpoint, { method: "POST", headers: packet.headers, body: packet.body });
	assert.equal(originalRetry.status, 200);
	assert.deepEqual((await originalRetry.json()).receipt, packet.accepted.receipt);
	assert.deepEqual(JSON.parse(await readFile(join(packet.packet, "authentication.json"), "utf8")), evidence);
});

test("at-rest verification rejects evidence tampering, swapped identities and untrusted keys", async (context) => {
	const packet = await stored(context);
	const filename = join(packet.packet, "authentication.json");
	const original = await readFile(filename, "utf8");
	const mutations: Array<(value: Record<string, unknown> & { headers: Record<string, unknown> }) => void> = [
		(value) => { value.schemaVersion = 2; },
		(value) => { value.method = "GET"; },
		(value) => { value.path = "/api/private-release-handoffs/other"; },
		(value) => { value.headers.signature = `handoff=:${Buffer.alloc(64).toString("base64")}:`; },
		(value) => { value.headers["x-handoff-id"] = randomUUID(); },
		(value) => { value.headers["x-handoff-audience"] = "another-audience"; },
		(value) => { value.headers["content-encoding"] = "gzip"; },
		(value) => { value.authenticatedAt = new Date(handoffNow + 301000).toISOString(); },
	];
	for (const mutate of mutations) {
		const changed = JSON.parse(original);
		mutate(changed);
		await writeFile(filename, JSON.stringify(changed));
		await assert.rejects(() => verifyStoredHandoff(packet.packet, packet.options));
	}
	await writeFile(filename, original);
	await assert.rejects(() => verifyStoredHandoff(packet.packet, { ...packet.options, publicKeys: [generateKeyPairSync("ed25519").publicKey] }));
	await assert.rejects(() => verifyStoredHandoff(packet.packet, { ...packet.options, audience: "wrong-audience" }));
	await assert.rejects(() => verifyStoredHandoff(packet.packet, { ...packet.options, release: { ...packet.options.release, commit: "c".repeat(40) } }));
	await assert.rejects(() => verifyStoredHandoff(packet.packet, { ...packet.options, publicKeys: [packet.keys.privateKey] }));
});

test("signed envelope, independent stored files and custody assertions must all agree", async (context) => {
	const packet = await stored(context);
	for (const name of ["envelope.json", "CURRENT-SERVER-HANDOFF.md", "receipt.json"]) {
		const filename = join(packet.packet, name);
		const original = await readFile(filename);
		await writeFile(filename, name === "receipt.json" ? JSON.stringify({ ...packet.accepted.receipt, keyId: "e".repeat(64) }) : Buffer.concat([original, Buffer.from(" ")]));
		await assert.rejects(() => verifyStoredHandoff(packet.packet, packet.options));
		await writeFile(filename, original);
	}
	await writeFile(join(packet.packet, "unexpected.json"), "{}", { mode: 0o600 });
	await assert.rejects(() => verifyStoredHandoff(packet.packet, packet.options));
	await rm(join(packet.packet, "unexpected.json"));
	await chmod(join(packet.packet, "authentication.json"), 0o640);
	await assert.rejects(() => verifyStoredHandoff(packet.packet, packet.options));
	await chmod(join(packet.packet, "authentication.json"), 0o600);
	const original = await readFile(join(packet.packet, "authentication.json"));
	await rm(join(packet.packet, "authentication.json"));
	await writeFile(join(packet.directory, "redirected.json"), original, { mode: 0o600 });
	await symlink(join(packet.directory, "redirected.json"), join(packet.packet, "authentication.json"));
	await assert.rejects(() => verifyStoredHandoff(packet.packet, packet.options));
});

test("legacy receipt retries remain valid custody without manufacturing missing original signature evidence", async (context) => {
	const packet = await stored(context);
	const before = await readFile(join(packet.packet, "receipt.json"));
	await rm(join(packet.packet, "authentication.json"));
	await assert.rejects(() => verifyStoredHandoff(packet.packet, packet.options), (error: unknown) => error instanceof HandoffError && error.code === "legacy-signature-unavailable");
	const retry = await packet.request(packet.endpoint, { method: "POST", headers: packet.headers, body: packet.body });
	assert.equal(retry.status, 200);
	assert.deepEqual((await retry.json()).receipt, packet.accepted.receipt);
	assert.deepEqual(await readFile(join(packet.packet, "receipt.json")), before);
	await assert.rejects(() => readFile(join(packet.packet, "authentication.json")));
});

test("verification CLI uses a separate owner-trusted enrollment file and emits metadata only", async (context) => {
	const packet = await stored(context);
	const trusted = join(packet.directory, "trusted");
	await mkdir(trusted, { mode: 0o700 });
	const config = join(trusted, "enrollment.json");
	await writeFile(config, JSON.stringify({ schemaVersion: 1, audience: handoffAudience, publicKeys: [packet.keys.publicKey.export({ format: "pem", type: "spki" })] }), { mode: 0o600 });
	assert.equal((await verifyStoredHandoffWithConfig(packet.packet, config, packet.envelope.release)).status, "verified");
	const root = fileURLToPath(new URL("../../", import.meta.url));
	const command = ["--import", "tsx", "back-end/src/manage-private-handoff.ts", "verify", packet.packet, config, packet.envelope.release.tag, packet.envelope.release.commit, packet.envelope.release.archiveSha256];
	const result = JSON.parse(execFileSync(process.execPath, command, { cwd: root, encoding: "utf8" }));
	assert.equal(result.status, "verified");
	assert.equal(result.signatureEvidenceVersion, 1);
	assert(!JSON.stringify(result).includes("signature-input"));
	await rm(join(packet.packet, "authentication.json"));
	const legacy = spawnSync(process.execPath, command, { cwd: root, encoding: "utf8" });
	assert.equal(legacy.status, 76);
	assert.match(legacy.stderr, /legacy-custody-unverifiable/u);
});

test("signed evidence cannot be detached from its body or presented as an unbounded signature profile", () => {
	const fixture = handoffFixture();
	const keys = new Map([[handoffKeyId(fixture.keys.publicKey), fixture.keys.publicKey]]);
	const evidence = captureHandoffEvidence(signHandoff(fixture.body, handoffAudience, fixture.keys.privateKey, randomUUID(), handoffNow), handoffNow);
	assert.throws(() => verifyHandoffEvidence(Buffer.concat([fixture.body, Buffer.from(" ")]), evidence, handoffAudience, keys));
	assert.throws(() => verifyHandoffEvidence(fixture.body, { ...evidence, headers: { ...evidence.headers, signature: "x".repeat(20_000) } }, handoffAudience, keys));
});
