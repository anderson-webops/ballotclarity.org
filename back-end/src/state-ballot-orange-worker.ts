import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { inspectOrangePdfFonts } from "./state-ballot-orange-fonts.js";
import { orangeProofPages, readOrangeCandidateProof } from "./state-ballot-orange-proof.js";
import { inspectOrangeProofVisual } from "./state-ballot-orange-visual.js";
import { extractStateBallotPdfSvg, extractStateBallotPdfXml, inspectStateBallotPdfObjects, orangeNativePdfCollectorContract, resolveStateBallotPdfObjectInspector, resolveStateBallotPdfSvgExtractor, resolveStateBallotPdfXmlExtractor } from "./state-ballot-pdf.js";

interface Options { xmlExecutable?: string; svgExecutable?: string; objectExecutable?: string; onPage?: (page: number, svg: string) => Promise<void> }
export async function verifyOrangeCandidateProof(bytes: Buffer, electionDate: string, options: Options = {}) {
	const startedAt = Date.now();
	const [xmlExecutable, svgExecutable, objectExecutable] = await Promise.all([resolveStateBallotPdfXmlExtractor(options.xmlExecutable), resolveStateBallotPdfSvgExtractor(options.svgExecutable), resolveStateBallotPdfObjectInspector(options.objectExecutable)]);
	const xml = await extractStateBallotPdfXml(bytes, xmlExecutable, "orange");
	const result = readOrangeCandidateProof(xml, electionDate);
	const fields = orangeProofPages(xml);
	const objects = await inspectStateBallotPdfObjects(bytes, objectExecutable, "orange");
	const fonts = inspectOrangePdfFonts(objects);
	if ((JSON.parse(objects) as { pages: unknown[] }).pages.length !== result.pages) throw new Error("The Orange County native page inventories disagree.");
	const pages: (ReturnType<typeof inspectOrangeProofVisual> & { page: number })[] = [];
	let outputBytes = 0;
	for (let page = 1; page <= result.pages; page++) {
		const svg = await extractStateBallotPdfSvg(bytes, svgExecutable, page, 12000, "orange");
		outputBytes += Buffer.byteLength(svg);
		if (outputBytes > orangeNativePdfCollectorContract.maximumRenderedBytes || Date.now() - startedAt > orangeNativePdfCollectorContract.maximumDurationMs) throw new Error("The Orange County native verification exceeds its resource bounds.");
		pages.push({ page, ...inspectOrangeProofVisual(fields[page - 1]!, svg, page) });
		await options.onPage?.(page, svg);
		if (Date.now() - startedAt > orangeNativePdfCollectorContract.maximumDurationMs) throw new Error("The Orange County native verification exceeds its resource bounds.");
	}
	return { xml, objects, result, proof: { schemaVersion: 1 as const, type: "orange-native-verification" as const, sourceSha256: createHash("sha256").update(bytes).digest("hex"), xmlSha256: createHash("sha256").update(xml).digest("hex"), objectsSha256: createHash("sha256").update(objects).digest("hex"), fonts, pages, sourceDistrictLabelsApprovedForBallotMatching: false as const } };
}
