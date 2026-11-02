import type { AlabamaSourceIdentity } from "./state-ballot-alabama-types.js";
import { parentPort, workerData } from "node:worker_threads";
import { readAlabamaContent } from "./state-ballot-alabama-reader.js";
import { readAlabamaDraftRecords } from "./state-ballot-alabama-records.js";
import { alabamaHash } from "./state-ballot-alabama-types.js";
import { resolveAlabamaVisibility } from "./state-ballot-alabama-visibility.js";

export function analyzeAlabamaObjects(objects: string, input: AlabamaSourceIdentity) {
	if (typeof objects !== "string" || objects.length > 16 * 1024 * 1024)
		throw new Error("The Alabama object output exceeded its byte budget.");
	const content = resolveAlabamaVisibility(readAlabamaContent(JSON.parse(objects)));
	const result = readAlabamaDraftRecords(content, input);
	return {
		result,
		proof: {
			schemaVersion: 1 as const,
			type: "alabama-original-native-verification" as const,
			sourceSha256: input.sourceSha256,
			reviewSha256: alabamaHash(JSON.stringify(result)),
			objectsSha256: alabamaHash(objects),
			objectProof: content.objectProof,
			glyphs: content.glyphs.length,
			drawingOverlapChecks: content.drawingOverlapChecks,
			borderComparisons: content.borderComparisons,
			fullyAccountedFields: result.officeFields,
			sourceFactsAccepted: false as const
		}
	};
}

if (parentPort) {
	try {
		const input = workerData as { objects: string; input: AlabamaSourceIdentity };
		parentPort.postMessage({ ok: true, ...analyzeAlabamaObjects(input.objects, input.input) });
	}
	catch (error) {
		parentPort.postMessage({
			ok: false,
			error: error instanceof Error ? error.message : "The Alabama native worker failed closed."
		});
	}
}
