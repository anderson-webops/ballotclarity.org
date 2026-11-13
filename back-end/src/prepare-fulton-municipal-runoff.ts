import type { FultonMunicipalSource } from "./fulton-municipal-runoff.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import process from "node:process";
import { fultonMunicipalRunoffCsv, prepareFultonMunicipalRunoff } from "./fulton-municipal-runoff.js";
import { extractStateBallotPdfXml, resolveStateBallotPdfXmlExtractor } from "./state-ballot-pdf.js";
import { readBoundedStateDataBytes } from "./state-ballot-storage.js";

async function main() {
	const [pdfPath, sourcePath, format = "json", ...extra] = process.argv.slice(2);
	assert(pdfPath && sourcePath && !extra.length && ["json", "csv"].includes(format), "Use PDF SOURCE.json [json|csv] with STATE_BALLOT_PDFTOHTML configured.");
	const bytes = await readBoundedStateDataBytes(pdfPath, 12 * 1024 * 1024);
	const supplied = JSON.parse((await readBoundedStateDataBytes(sourcePath, 16 * 1024)).toString("utf8")) as Partial<FultonMunicipalSource>;
	assert(bytes.subarray(0, 5).toString("ascii") === "%PDF-" && supplied.bytes === bytes.length && supplied.sha256 === createHash("sha256").update(bytes).digest("hex"), "The municipal PDF does not match its original source capture.");
	assert(typeof supplied.url === "string" && typeof supplied.retrievedAt === "string");
	const source = { url: supplied.url, sha256: supplied.sha256, bytes: supplied.bytes, retrievedAt: supplied.retrievedAt };
	const xml = await extractStateBallotPdfXml(bytes, await resolveStateBallotPdfXmlExtractor());
	const inventory = prepareFultonMunicipalRunoff(xml, source);
	process.stdout.write(format === "csv" ? fultonMunicipalRunoffCsv(inventory) : `${JSON.stringify(inventory, null, 2)}\n`);
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "The municipal runoff preparation failed.");
	process.exitCode = 1;
});
