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
const exactZip5Pattern = /^\d{5}$/;

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
	return exactZip5Pattern.test(normalized) ? normalized : null;
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

			if (lookupResponse.inputKind !== "zip")
				return;

			const zip5 = normalizeZipLookupLogInput(rawInput);

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
