import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";
import process from "node:process";
import { prepareGeorgiaWriteInSnapshot } from "./state-ballot-georgia-writeins.js";
import { extractStateBallotPdfText, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";
import { configuredStateBallotSources } from "./state-ballot-registry.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";

async function main() {
	const [sourceId, pdfPath, retrievedAt, outputPath, ...extra] = process.argv.slice(2);
	const source = configuredStateBallotSources.find(source => source.id === sourceId);
	if (!source || !pdfPath || !retrievedAt || !outputPath || extra.length || !isAbsolute(pdfPath) || !isAbsolute(outputPath) || !Number.isFinite(Date.parse(retrievedAt)) || Date.parse(retrievedAt) > Date.now()) throw new Error("Use prepare-georgia-writeins SOURCE_ID /absolute/certificate.pdf CAPTURED_AT_UTC /absolute/output.json. Preparation is offline and never imports or publishes.");
	assertExternalStateDataDirectory(dirname(outputPath));
	const bytes = await readBoundedStateDataBytes(pdfPath);
	const text = await extractStateBallotPdfText(bytes, await resolveStateBallotPdfExtractor(), 12000, "layout", 1);
	const prepared = prepareGeorgiaWriteInSnapshot(source, text, createHash("sha256").update(bytes).digest("hex"), retrievedAt);
	await writeFile(outputPath, `${prepared.body}\n`, { flag: "wx", mode: 0o600 });
	console.log(JSON.stringify({ sourceId, recordCount: JSON.parse(prepared.body).recordCount, publishedOn: prepared.publishedOn, outputPath }));
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Georgia write-in preparation failed.");
	process.exitCode = 1;
});
