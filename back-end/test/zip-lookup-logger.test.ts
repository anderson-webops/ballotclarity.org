import type { LocationLookupResponse } from "../src/types/civic.js";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	createZipLookupLogger,
	defaultZipLookupLogPath,
	isZipLookupLoggingEnabled,
	normalizeZipLookupLogInput,
} from "../src/zip-lookup-logger.js";

const resolvedResponse: LocationLookupResponse = {
	guideAvailability: "published",
	inputKind: "zip",
	note: "Resolved.",
	result: "resolved"
};

function readLogEvents(logPath: string) {
	if (!existsSync(logPath))
		return [];

	return readFileSync(logPath, "utf8")
		.trim()
		.split("\n")
		.filter(Boolean)
		.map(line => JSON.parse(line) as Record<string, unknown>);
}

test("ZIP lookup logging truthy parser accepts explicit enabled values only", () => {
	assert.equal(isZipLookupLoggingEnabled("1"), true);
	assert.equal(isZipLookupLoggingEnabled("true"), true);
	assert.equal(isZipLookupLoggingEnabled("yes"), true);
	assert.equal(isZipLookupLoggingEnabled("on"), true);
	assert.equal(isZipLookupLoggingEnabled("false"), false);
	assert.equal(isZipLookupLoggingEnabled(""), false);
});

test("ZIP lookup logger defaults to the production JSONL path", () => {
	const logger = createZipLookupLogger({ enabled: false });

	assert.equal(logger.logPath, defaultZipLookupLogPath);
});

test("ZIP lookup logger writes exact normalized 5-digit ZIP lookups", async () => {
	const tempDir = mkdtempSync(join(tmpdir(), "ballot-clarity-zip-log-"));
	const logPath = join(tempDir, "zip-events.jsonl");

	try {
		const logger = createZipLookupLogger({
			enabled: true,
			logPath,
			now: () => new Date("2026-04-26T21:00:00.000Z")
		});

		await logger.record("30022", resolvedResponse);
		const events = readLogEvents(logPath);

		assert.equal(events.length, 1);
		assert.deepEqual(Object.keys(events[0] ?? {}).sort(), [
			"guideAvailability",
			"result",
			"selectionRequired",
			"timestamp",
			"zip5"
		]);
		assert.deepEqual(events[0], {
			guideAvailability: "published",
			result: "resolved",
			selectionRequired: false,
			timestamp: "2026-04-26T21:00:00.000Z",
			zip5: "30022"
		});
		assert.equal(Object.hasOwn(events[0] ?? {}, "rawInput"), false);
		assert.equal(Object.hasOwn(events[0] ?? {}, "rawLookupText"), false);
		assert.equal(Object.hasOwn(events[0] ?? {}, "userAgent"), false);
		assert.equal(Object.hasOwn(events[0] ?? {}, "ip"), false);
	}
	finally {
		rmSync(tempDir, { force: true, recursive: true });
	}
});

test("ZIP lookup logger stays silent for full addresses containing a ZIP", async () => {
	const tempDir = mkdtempSync(join(tmpdir(), "ballot-clarity-zip-log-"));
	const logPath = join(tempDir, "zip-events.jsonl");

	try {
		const logger = createZipLookupLogger({ enabled: true, logPath });

		await logger.record("55 Trinity Ave SW, Atlanta, GA 30303", {
			...resolvedResponse,
			inputKind: "address"
		});

		assert.deepEqual(readLogEvents(logPath), []);
	}
	finally {
		rmSync(tempDir, { force: true, recursive: true });
	}
});

test("ZIP lookup logger stays silent for ZIP+4 input", async () => {
	const tempDir = mkdtempSync(join(tmpdir(), "ballot-clarity-zip-log-"));
	const logPath = join(tempDir, "zip-events.jsonl");

	try {
		const logger = createZipLookupLogger({ enabled: true, logPath });

		await logger.record("30022-1234", resolvedResponse);

		assert.deepEqual(readLogEvents(logPath), []);
		assert.equal(normalizeZipLookupLogInput("30022-1234"), null);
	}
	finally {
		rmSync(tempDir, { force: true, recursive: true });
	}
});

test("disabled ZIP lookup logger writes nothing", async () => {
	const tempDir = mkdtempSync(join(tmpdir(), "ballot-clarity-zip-log-"));
	const logPath = join(tempDir, "zip-events.jsonl");

	try {
		const logger = createZipLookupLogger({ enabled: false, logPath });

		await logger.record("30022", resolvedResponse);

		assert.deepEqual(readLogEvents(logPath), []);
	}
	finally {
		rmSync(tempDir, { force: true, recursive: true });
	}
});
