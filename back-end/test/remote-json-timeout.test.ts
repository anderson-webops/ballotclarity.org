import type { ClientRequest, IncomingMessage } from "node:http";
import type { RequestOptions } from "node:https";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import { PassThrough, Readable } from "node:stream";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fetchRemoteJsonText, fetchRemoteSourceDocument } from "../src/remote-json-source.js";

const resolveAddresses = async () => [{ address: "93.184.216.34", family: 4 }];

async function pinnedRequest(context: TestContext, verify: (fixture: {
	request: ClientRequest;
	destroyed: boolean;
	requests: number;
	options: RequestOptions | null;
	onEnd: (() => void) | null;
	respond: ((response: IncomingMessage) => void) | null;
}) => Promise<void>) {
	const request = new EventEmitter() as ClientRequest;
	const fixture = { request, destroyed: false, requests: 0, options: null as RequestOptions | null, onEnd: null as (() => void) | null, respond: null as ((response: IncomingMessage) => void) | null };
	request.setTimeout = () => request;
	request.end = () => {
		queueMicrotask(() => fixture.onEnd?.());
		return request;
	};
	request.destroy = (error?: Error) => {
		fixture.destroyed = true;
		if (error) request.emit("error", error);
		request.emit("close");
		return request;
	};
	const keepAlive = setInterval(() => {}, 1000);
	const replacement = context.mock.method(https, "request", ((options: RequestOptions, respond: (response: IncomingMessage) => void) => {
		fixture.requests++;
		fixture.options = options;
		fixture.respond = respond;
		return request;
	}) as typeof https.request);
	syncBuiltinESMExports();
	try {
		await verify(fixture);
	}
	finally {
		replacement.mock.restore();
		syncBuiltinESMExports();
		clearInterval(keepAlive);
	}
}

test("pinned JSON and document requests destroy a connection that never reaches its socket timeout", async (context) => {
	for (const fetchSource of [fetchRemoteJsonText, fetchRemoteSourceDocument]) {
		await pinnedRequest(context, async (fixture) => {
			await assert.rejects(fetchSource("https://example.com/data", { allowedHosts: ["example.com"], resolveAddresses, timeoutMs: 50 }), /timed out after 50ms/u);
			assert.equal(fixture.destroyed, true);
			assert.equal(fixture.requests, 1);
			assert.equal(fixture.options?.hostname, "93.184.216.34");
			assert.equal(fixture.options?.servername, "example.com");
			assert.equal(fixture.options?.rejectUnauthorized, true);
		});
	}
});

test("a JSON body deadline destroys the retained response rather than leaving a live reader", async () => {
	const body = new PassThrough();
	body.write("{");
	const keepAlive = setInterval(() => {}, 1000);
	try {
		await assert.rejects(fetchRemoteJsonText("https://example.com/data", { resolveAddresses, timeoutMs: 50, transport: async () => ({ statusCode: 200, headers: { "content-type": "application/json" }, body }) }), /timed out after 50ms/u);
		assert.equal(body.destroyed, true);
	}
	finally {
		body.destroy();
		clearInterval(keepAlive);
	}
});

test("a completed pinned response cancels its request deadline without a later destruction", async context => pinnedRequest(context, async (fixture) => {
	fixture.onEnd = () => fixture.respond!(Object.assign(Readable.from(["{}"]), { headers: { "content-type": "application/json" }, statusCode: 200 }) as IncomingMessage);
	assert.equal(await fetchRemoteJsonText("https://example.com/data", { resolveAddresses, timeoutMs: 50 }), "{}");
	await delay(80);
	assert.equal(fixture.destroyed, false);
	assert.equal(fixture.requests, 1);
}));

test("pinned certificate failures keep exact identity validation and finish without a transport retry", async context => pinnedRequest(context, async (fixture) => {
	const failure = Object.assign(new Error("controlled certificate chain failure"), { code: "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" });
	fixture.onEnd = () => {
		fixture.request.emit("error", failure);
	};
	await assert.rejects(fetchRemoteJsonText("https://example.com/data", { resolveAddresses, timeoutMs: 50 }), error => error === failure);
	await delay(80);
	assert.equal(fixture.requests, 1);
	assert.equal(fixture.options?.rejectUnauthorized, true);
	assert.equal(fixture.options?.servername, "example.com");
}));
