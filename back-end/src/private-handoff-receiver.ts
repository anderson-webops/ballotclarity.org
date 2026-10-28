import type { KeyObject } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { Buffer } from "node:buffer";
import { createPublicKey } from "node:crypto";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
	authenticateHandoff,
	captureHandoffEvidence,
	HandoffError,
	handoffHash,
	handoffKeyId,
	handoffPath,
	maximumHandoffBytes,
	record,
	validAudience
} from "./private-handoff-protocol.js";
import { createHandoffInbox, privateHandoffDirectory, readHandoffFile } from "./private-handoff-storage.js";

async function requestBody(request: IncomingMessage) {
	const chunks: Buffer[] = [];
	let bytes = 0;
	for await (const chunk of request.iterator({ destroyOnReturn: false })) {
		bytes += (chunk as Buffer).length;
		if (bytes > maximumHandoffBytes) throw new HandoffError(413, "handoff-too-large");
		chunks.push(chunk as Buffer);
	}
	return Buffer.concat(chunks, bytes);
}

export async function createHandoffReceiver(options: {
	directory: string;
	audience: string;
	publicKeys: KeyObject[];
	maximumBytes?: number;
	maximumEntries?: number;
	now?: () => number;
}) {
	if (!validAudience(options.audience) || !options.publicKeys.length || options.publicKeys.length > 16)
		throw new Error("The handoff receiver requires an audience and enrolled public keys.");
	const keys = new Map(
		options.publicKeys.map((key) => {
			if (key.type !== "public") throw new Error("Only public verification keys belong on the receiver.");
			return [handoffKeyId(key), key];
		})
	);
	if (keys.size !== options.publicKeys.length) throw new Error("Duplicate handoff verification keys.");
	const inbox = await createHandoffInbox(
		options.directory,
		options.audience,
		options.maximumBytes,
		options.maximumEntries,
		keys
	);
	let active = 0;
	const server = createServer(
		{ maxHeaderSize: 8192, requestTimeout: 10000, headersTimeout: 5000, keepAliveTimeout: 1000 },
		async (request, response) => {
			response.setHeader("Cache-Control", "no-store");
			response.setHeader("Content-Type", "application/json");
			response.setHeader("X-Content-Type-Options", "nosniff");
			response.setHeader("Connection", "close");
			response.once("finish", () => {
				if (!request.complete) request.destroy();
			});
			if (request.method === "GET" && request.url === "/healthz") {
				response.end("{\"status\":\"ok\"}");
				return;
			}
			if (request.method !== "POST" || request.url !== handoffPath) {
				response.statusCode = 404;
				response.end("{\"error\":\"not-found\"}");
				return;
			}
			let admitted = false;
			try {
				const authenticatedAt = options.now?.() ?? Date.now();
				const authentication = authenticateHandoff(request.headers, options.audience, keys, authenticatedAt);
				const length = request.headers["content-length"];
				if (length !== undefined && (!/^\d+$/u.test(length) || Number(length) > maximumHandoffBytes))
					throw new HandoffError(413, "handoff-too-large");
				if (active >= 2) throw new HandoffError(429, "receiver-busy");
				active++;
				admitted = true;
				const body = await requestBody(request);
				if (handoffHash(body) !== authentication.payloadSha256) throw new HandoffError(400, "digest-mismatch");
				const evidence = captureHandoffEvidence(request.headers, authenticatedAt);
				const result = await inbox.accept(body, authentication, options.now?.() ?? Date.now(), evidence);
				response.statusCode = result.duplicate ? 200 : 201;
				response.end(JSON.stringify(result));
			}
			catch (error) {
				response.statusCode = error instanceof HandoffError ? error.status : 503;
				response.end(
					JSON.stringify({ error: error instanceof HandoffError ? error.code : "receiver-unavailable" })
				);
			}
			finally {
				if (admitted) active--;
			}
		}
	);
	server.maxConnections = 16;
	server.maxHeadersCount = 20;
	server.setTimeout(10000, socket => socket.destroy());
	return server;
}

async function main() {
	const filename = process.env.PRIVATE_HANDOFF_RECEIVER_CONFIG;
	if (!filename) throw new Error("PRIVATE_HANDOFF_RECEIVER_CONFIG is required; no receiver was started.");
	if (resolve(filename) !== filename) throw new Error("Receiver configuration must use an absolute path.");
	await privateHandoffDirectory(dirname(filename));
	const config: unknown = JSON.parse((await readHandoffFile(filename, 64 * 1024, true)).toString("utf8"));
	if (
		!record(config)
		|| Object.keys(config).some(
			name =>
				![
					"schemaVersion",
					"audience",
					"publicKeys",
					"inboxDirectory",
					"port",
					"maximumBytes",
					"maximumEntries"
				].includes(name)
		)
		|| config.schemaVersion !== 1
		|| !validAudience(config.audience)
		|| typeof config.inboxDirectory !== "string"
		|| !Number.isSafeInteger(config.port)
		|| Number(config.port) < 1
		|| Number(config.port) > 65535
		|| !Array.isArray(config.publicKeys)
		|| config.publicKeys.some(key => typeof key !== "string" || key.length > 4096)
		|| (config.maximumBytes !== undefined && typeof config.maximumBytes !== "number")
		|| (config.maximumEntries !== undefined && typeof config.maximumEntries !== "number")
	) {
		throw new Error("Invalid private handoff receiver configuration.");
	}
	const server = await createHandoffReceiver({
		directory: config.inboxDirectory,
		audience: config.audience,
		publicKeys: (config.publicKeys as string[]).map(key => createPublicKey(key)),
		maximumBytes: config.maximumBytes as number | undefined,
		maximumEntries: config.maximumEntries as number | undefined
	});
	server.listen(Number(config.port), "127.0.0.1", () =>
		console.log(
			JSON.stringify({ service: "private-release-handoff", listening: "loopback", audience: config.audience })
		));
	for (const signal of ["SIGINT", "SIGTERM"] as const) {
		process.once(signal, () => {
			const deadline = setTimeout(() => {
				server.closeAllConnections();
				process.exit(1);
			}, 12000);
			deadline.unref();
			server.close(() => {
				clearTimeout(deadline);
				process.exit(0);
			});
		});
	}
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
	main().catch(() => {
		console.error("The private handoff receiver could not start. Verify its protected configuration and storage.");
		process.exitCode = 1;
	});
}
