import type { TestContext } from "node:test";
import type { HandoffEnvelope } from "../../src/private-handoff-protocol.js";
import { Buffer } from "node:buffer";
import { generateKeyPairSync } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handoffHash, handoffPath, validateHandoff } from "../../src/private-handoff-protocol.js";
import { createHandoffReceiver } from "../../src/private-handoff-receiver.js";

export const handoffNow = Date.parse("2026-10-28T16:00:00.000Z");
export const handoffAudience = "ballot-test-private-inbox";

export function handoffFixture() {
	const release = { tag: "v1.14.58", commit: "a".repeat(40), archiveSha256: "b".repeat(64) };
	const values = {
		"CURRENT-SERVER-HANDOFF.md": "# Private test handoff\n\nCustody only.\n",
		"DATA-DELTA.json": JSON.stringify({ pendingFileCount: 0, archive: { created: false } }),
		"PENDING-DELIVERY.json": JSON.stringify({
			pendingContentFiles: 0,
			currentSourceRelease: {
				sourceTag: release.tag,
				sourceCommit: release.commit,
				archiveSha256: release.archiveSha256,
				publicationVerified: true
			}
		}),
		"SERVER-DATA-BASELINE.json": JSON.stringify({ files: [] }),
		"SERVER-RECEIVED-DATA-BASELINE.json": JSON.stringify({ files: [] })
	};
	const files = Object.entries(values).map(([name, text]) => {
		const body = Buffer.from(text);
		return { name, bytes: body.length, sha256: handoffHash(body), contentBase64: body.toString("base64") };
	});
	const envelope: HandoffEnvelope = {
		schemaVersion: 1,
		type: "ballot-private-release-handoff",
		audience: handoffAudience,
		release,
		files
	};
	const body = Buffer.from(JSON.stringify(envelope));
	validateHandoff(body, handoffAudience);
	return { envelope, body, keys: generateKeyPairSync("ed25519") };
}

export function changeHandoffFile(envelope: HandoffEnvelope, name: string, body: Buffer | string) {
	const buffer = Buffer.from(body);
	const next = { name, bytes: buffer.length, sha256: handoffHash(buffer), contentBase64: buffer.toString("base64") };
	const index = envelope.files.findIndex(file => file.name === name);
	if (index === -1) envelope.files.push(next);
	else envelope.files[index] = next;
}

export async function handoffTemporary(context: TestContext) {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "private-handoff-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	return directory;
}

export async function handoffService(context: TestContext, options: { maximumEntries?: number } = {}) {
	const fixture = handoffFixture();
	const directory = await handoffTemporary(context);
	const server = await createHandoffReceiver({
		directory: join(directory, "inbox"),
		audience: handoffAudience,
		publicKeys: [fixture.keys.publicKey],
		maximumEntries: options.maximumEntries,
		now: () => handoffNow
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("Missing private test listener.");
	context.after(async () => {
		server.closeAllConnections();
		await new Promise<void>(resolve => server.close(() => resolve()));
	});
	const origin = `http://127.0.0.1:${address.port}`;
	return {
		...fixture,
		directory,
		server,
		origin,
		endpoint: `https://example.invalid${handoffPath}`,
		request: ((input, init) => fetch(`${origin}${new URL(String(input)).pathname}`, init)) as typeof fetch
	};
}
