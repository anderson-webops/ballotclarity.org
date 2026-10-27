import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { inspectNycPdfFonts } from "./state-ballot-nyc-fonts.js";
import { inspectNycVisual } from "./state-ballot-nyc-visual.js";
import { nycGeneralDate, readNycCandidateDocument } from "./state-ballot-nyc.js";
import { extractStateBallotPdfSvg, extractStateBallotPdfXml, inspectStateBallotPdfObjects, resolveStateBallotPdfObjectInspector, resolveStateBallotPdfSvgExtractor, resolveStateBallotPdfXmlExtractor } from "./state-ballot-pdf.js";

type Factory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;
interface Options { xmlExecutable?: string; svgExecutable?: string; objectExecutable?: string; onPage?: (page: number, svg: string) => Promise<void> }

export async function verifyNycCandidatePdf(source: StateBallotSource, bytes: Buffer, factory: Factory, options: Options = {}) {
	if (source.stateCode !== "NY") throw new Error("The NYC native source identity requires review.");
	nycGeneralDate(source.electionDate);
	const [xmlExecutable, svgExecutable, objectExecutable] = await Promise.all([resolveStateBallotPdfXmlExtractor(options.xmlExecutable), resolveStateBallotPdfSvgExtractor(options.svgExecutable), resolveStateBallotPdfObjectInspector(options.objectExecutable)]);
	const xml = await extractStateBallotPdfXml(bytes, xmlExecutable, "nyc");
	const objects = await inspectStateBallotPdfObjects(bytes, objectExecutable, "nyc");
	const fonts = inspectNycPdfFonts(objects);
	const result = readNycCandidateDocument(source, xml, factory);
	const pages: (ReturnType<typeof inspectNycVisual> & { page: number })[] = [];
	let outputBytes = 0;
	for (let page = 1; page <= result.pages; page++) {
		const svg = await extractStateBallotPdfSvg(bytes, svgExecutable, page, 12000, "nyc");
		outputBytes += Buffer.byteLength(svg);
		if (outputBytes > 32 * 1024 * 1024) throw new Error("The NYC native rendering exceeds its collection bounds.");
		pages.push({ page, ...inspectNycVisual(xml, svg, page) });
		await options.onPage?.(page, svg);
	}
	return { xml, objects, result, proof: { schemaVersion: 1 as const, type: "nyc-native-verification" as const, sourceSha256: createHash("sha256").update(bytes).digest("hex"), xmlSha256: createHash("sha256").update(xml).digest("hex"), objectsSha256: createHash("sha256").update(objects).digest("hex"), fonts, pages } };
}
