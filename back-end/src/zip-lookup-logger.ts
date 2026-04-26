import type {
	LocationGuideAvailability,
	LocationLookupResponse,
	LocationLookupResult,
} from "./types/civic.js";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import process from "node:process";

export const defaultZipLookupLogPath = "/var/lib/ballotclarity/zip-lookup-events.jsonl";

const truthyEnvPattern = /^(?:1|true|yes|on)$/i;
const exactZipPattern = /^(\d{5})(?:-\d{4})?$/;
const terminalTrimPattern = /[.,\s]+$/u;

export interface ZipLookupLogEvent {
	timestamp: string;
	zip5: string;
	result: LocationLookupResult;
	guideAvailability: LocationGuideAvailability | null;
	selectionRequired: boolean;
}

export interface ZipLookupLogger {
	readonly enabled: boolean;
	readonly logPath: string;
	record: (rawInput: string, lookupResponse: LocationLookupResponse) => Promise<void>;
}

export interface ZipLookupLoggerOptions {
	appendLine?: (logPath: string, line: string) => Promise<void>;
	enabled?: boolean;
	logPath?: string;
	now?: () => Date;
	onError?: (error: unknown) => void;
}

export function isZipLookupLoggingEnabled(value = process.env.BALLOTCLARITY_ZIP_LOOKUP_LOG_ENABLED) {
	return truthyEnvPattern.test(value?.trim() ?? "");
}

export function normalizeZipLookupLogInput(rawInput: string) {
	const normalized = rawInput.trim();
	return normalized.match(exactZipPattern)?.[1] ?? extractTerminalZip5(normalized);
}

function stripTerminalCountrySuffix(value: string) {
	const normalized = value.trim().replace(terminalTrimPattern, "");
	const lower = normalized.toLowerCase();

	for (const suffix of ["united states of america", "united states", "u.s.a", "usa"]) {
		if (!lower.endsWith(suffix))
			continue;

		const prefix = normalized.slice(0, -suffix.length).replace(terminalTrimPattern, "");

		return prefix;
	}

	return normalized;
}

function extractTerminalZip5(value: string) {
	const normalized = stripTerminalCountrySuffix(value);
	const lastToken = normalized.split(/[\s,]+/u).filter(Boolean).at(-1) ?? "";

	return lastToken.match(exactZipPattern)?.[1] ?? null;
}

function resolveZip5ForLookupLog(rawInput: string, lookupResponse: LocationLookupResponse) {
	if (lookupResponse.inputKind === "zip")
		return rawInput.trim().match(exactZipPattern)?.[1] ?? null;

	return normalizeZipLookupLogInput(lookupResponse.normalizedAddress ?? "")
		?? normalizeZipLookupLogInput(rawInput);
}

async function appendJsonLine(logPath: string, line: string) {
	await mkdir(dirname(logPath), { recursive: true });
	await appendFile(logPath, `${line}\n`, "utf8");
}

function resolveLogPath(logPath?: string) {
	return logPath?.trim()
		|| process.env.BALLOTCLARITY_ZIP_LOOKUP_LOG_PATH?.trim()
		|| defaultZipLookupLogPath;
}

export function createZipLookupLogger(options: ZipLookupLoggerOptions = {}): ZipLookupLogger {
	const enabled = options.enabled ?? isZipLookupLoggingEnabled();
	const logPath = resolveLogPath(options.logPath);
	const appendLine = options.appendLine ?? appendJsonLine;
	const now = options.now ?? (() => new Date());

	return {
		enabled,
		logPath,
		async record(rawInput, lookupResponse) {
			if (!enabled)
				return;

			const zip5 = resolveZip5ForLookupLog(rawInput, lookupResponse);

			if (!zip5)
				return;

			const event: ZipLookupLogEvent = {
				guideAvailability: lookupResponse.guideAvailability ?? null,
				result: lookupResponse.result,
				selectionRequired: Boolean(lookupResponse.selectionOptions?.length),
				timestamp: now().toISOString(),
				zip5
			};

			try {
				await appendLine(logPath, JSON.stringify(event));
			}
			catch (error) {
				options.onError?.(error);
			}
		}
	};
}
