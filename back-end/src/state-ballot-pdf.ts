import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdtemp, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import process from "node:process";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { containsControlCharacters } from "./text-validation.js";

export const stateBallotPdfCollectorContract = Object.freeze({ configuration: "STATE_BALLOT_PDFTOTEXT", executable: "absolute path to maintained Poppler pdftotext", role: "bounded collection worker; public API may read persisted facts without this tool", maximumPdfBytes: 12 * 1024 * 1024, maximumTextBytes: 4 * 1024 * 1024, timeoutMs: 12000, maximumPages: 50 });
export const stateBallotNativePdfCollectorContract = Object.freeze({ configurations: ["STATE_BALLOT_PDFTOHTML", "STATE_BALLOT_PDFTOCAIRO", "STATE_BALLOT_QPDF"], role: "bounded collection worker; public readers use persisted facts without native tools or publisher requests", maximumPages: 20, maximumOutputBytes: 4 * 1024 * 1024, timeoutMs: 12000 });
export const chicagoNativePdfCollectorContract = Object.freeze({ maximumPages: 50, maximumObjectBytes: 16 * 1024 * 1024 });
export const nycNativePdfCollectorContract = Object.freeze({ maximumPages: 60, maximumObjectBytes: 4 * 1024 * 1024 });
export const orangeNativePdfCollectorContract = Object.freeze({ maximumPages: 256, maximumObjectBytes: 8 * 1024 * 1024, maximumXmlBytes: 8 * 1024 * 1024, maximumSvgBytes: 2 * 1024 * 1024, maximumRenderedBytes: 128 * 1024 * 1024, maximumDurationMs: 180000 });
export class StateBallotPdfCapabilityError extends Error {}

export async function fetchStateBallotPdfDocument(url: string, options: { allowedHosts: string[]; request?: typeof fetchRemoteSourceDocument; extractor: (bytes: Buffer) => Promise<string>; now?: () => number }) {
	const response = await (options.request ?? fetchRemoteSourceDocument)(url, { allowedHosts: options.allowedHosts, maxBytes: stateBallotPdfCollectorContract.maximumPdfBytes, timeoutMs: stateBallotPdfCollectorContract.timeoutMs });
	if (response.status !== 200 || response.contentType !== "application/pdf" || !response.body.subarray(0, 5).equals(Buffer.from("%PDF-")) || response.body.length > stateBallotPdfCollectorContract.maximumPdfBytes) throw new Error("The candidate PDF request failed without a permitted bounded document.");
	const text = await options.extractor(response.body);
	return { url, text, sha256: createHash("sha256").update(response.body).digest("hex"), retrievedAt: new Date((options.now ?? Date.now)()).toISOString() };
}

export async function resolveStateBallotPdfExtractor(value = process.env.STATE_BALLOT_PDFTOTEXT) {
	if (!value || !isAbsolute(value) || containsControlCharacters(value)) throw new StateBallotPdfCapabilityError("Configure an absolute Poppler pdftotext path in the bounded collection worker.");
	try {
		const executable = await realpath(value);
		if (!(await stat(executable)).isFile()) throw new Error("Not a regular executable");
		await access(executable, constants.X_OK);
		return executable;
	}
	catch { throw new StateBallotPdfCapabilityError("The configured PDF text extractor is unavailable."); }
}
async function runPdfExtractor(bytes: Buffer, executable: string, arguments_: string[], timeoutMs: number, streamInput = true, maximumOutputBytes = stateBallotPdfCollectorContract.maximumTextBytes) {
	if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-")) || bytes.length > stateBallotPdfCollectorContract.maximumPdfBytes || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > stateBallotPdfCollectorContract.timeoutMs) throw new Error("The PDF extraction input exceeds its reviewed bounds.");
	return new Promise<string>((resolve, reject) => {
		const child = spawn(executable, arguments_, { stdio: ["pipe", "pipe", "pipe"], env: { PATH: process.env.PATH, LANG: "C.UTF-8" } });
		const chunks: Buffer[] = [];
		let length = 0;
		let stderrLength = 0;
		let failed = false;
		const fail = () => {
			failed = true;
			child.kill("SIGKILL");
		};
		const timer = setTimeout(fail, timeoutMs);
		child.stdout.on("data", (chunk: Buffer) => {
			length += chunk.length;
			if (length > maximumOutputBytes) fail();
			else chunks.push(chunk);
		});
		child.stderr.on("data", (chunk: Buffer) => {
			stderrLength += chunk.length;
			if (stderrLength > 65536) fail();
		});
		child.stdin.on("error", () => {
			failed = true;
		});
		child.once("error", () => {
			clearTimeout(timer);
			reject(new StateBallotPdfCapabilityError("The PDF extractor could not start."));
		});
		child.once("close", (code, signal) => {
			clearTimeout(timer);
			if (failed || signal || code !== 0) {
				reject(new Error("PDF text extraction failed or exceeded its bounds."));
			}
			else {
				const body = Buffer.concat(chunks).toString("utf8");
				if (!body.trim() || body.includes("\uFFFD")) reject(new Error("The PDF has no supported bounded UTF-8 text."));
				else resolve(body);
			}
		});
		child.stdin.end(streamInput ? bytes : undefined);
	});
}

export async function extractStateBallotPdfText(bytes: Buffer, executable: string, timeoutMs: number = stateBallotPdfCollectorContract.timeoutMs, format: "layout" | "raw" | "bbox-layout" | "raw-bbox" = "layout", maximumPages: number = stateBallotPdfCollectorContract.maximumPages) {
	if (!["layout", "raw", "bbox-layout", "raw-bbox"].includes(format) || !Number.isInteger(maximumPages) || maximumPages < 1 || maximumPages > 2000) throw new Error("The PDF extraction input exceeds its reviewed bounds.");
	const body = await runPdfExtractor(bytes, executable, [...(format === "raw-bbox" ? ["-raw", "-bbox"] : [`-${format}`]), "-enc", "UTF-8", "-eol", "unix", "-", "-"], timeoutMs);
	const pages = format === "layout" || format === "raw" ? body.split("\f").filter(page => page.trim()).length : [...body.matchAll(/<page\b/gu)].length;
	if (!pages || pages > maximumPages) throw new Error("The PDF has no supported bounded UTF-8 text.");
	return body;
}

export async function resolveStateBallotPdfSvgExtractor(value = process.env.STATE_BALLOT_PDFTOCAIRO) {
	if (!value) throw new StateBallotPdfCapabilityError("Configure an absolute maintained Poppler pdftocairo path in the bounded grid collection worker.");
	try {
		return await resolveStateBallotPdfExtractor(value);
	}
	catch { throw new StateBallotPdfCapabilityError("Configure an absolute maintained Poppler pdftocairo path in the bounded grid collection worker."); }
}

export async function extractStateBallotPdfSvg(bytes: Buffer, executable: string, page: number, timeoutMs: number = stateBallotPdfCollectorContract.timeoutMs, profile: "standard" | "nyc" | "orange" = "standard") {
	if (!["standard", "nyc", "orange"].includes(profile) || !Number.isInteger(page) || page < 1 || page > (profile === "orange" ? orangeNativePdfCollectorContract.maximumPages : profile === "nyc" ? nycNativePdfCollectorContract.maximumPages : stateBallotPdfCollectorContract.maximumPages)) throw new Error("The PDF grid page exceeds its reviewed bounds.");
	return runPdfExtractor(bytes, executable, ["-svg", "-f", String(page), "-l", String(page), "-", "-"], timeoutMs, true, profile === "orange" ? orangeNativePdfCollectorContract.maximumSvgBytes : stateBallotPdfCollectorContract.maximumTextBytes);
}

export async function resolveStateBallotPdfXmlExtractor(value = process.env.STATE_BALLOT_PDFTOHTML) {
	if (!value) throw new StateBallotPdfCapabilityError("Configure an absolute maintained Poppler pdftohtml path in the bounded collection worker.");
	return resolveStateBallotPdfExtractor(value);
}

export async function resolveStateBallotPdfObjectInspector(value = process.env.STATE_BALLOT_QPDF) {
	if (!value) throw new StateBallotPdfCapabilityError("Configure an absolute maintained qpdf path in the bounded collection worker.");
	return resolveStateBallotPdfExtractor(value);
}

export async function extractStateBallotPdfXml(bytes: Buffer, executable: string, profile: "standard" | "chicago" | "nyc" | "orange" = "standard") {
	if (!["standard", "chicago", "nyc", "orange"].includes(profile)) throw new Error("The native PDF worker profile is unsupported.");
	const body = await runPdfExtractor(bytes, executable, ["-xml", "-i", "-stdout", "-", "-"], stateBallotPdfCollectorContract.timeoutMs, true, profile === "orange" ? orangeNativePdfCollectorContract.maximumXmlBytes : stateBallotPdfCollectorContract.maximumTextBytes);
	const pages = [...body.matchAll(/<page\b/gu)].length;
	if (!pages || pages > (profile === "orange" ? orangeNativePdfCollectorContract.maximumPages : profile === "chicago" ? chicagoNativePdfCollectorContract.maximumPages : profile === "nyc" ? nycNativePdfCollectorContract.maximumPages : stateBallotNativePdfCollectorContract.maximumPages)) throw new Error("The native PDF page inventory exceeds its bounds.");
	return body;
}

export async function inspectStateBallotPdfObjects(bytes: Buffer, executable: string, profile: "standard" | "chicago" | "nyc" | "orange" = "standard") {
	if (!["standard", "chicago", "nyc", "orange"].includes(profile)) throw new Error("The native PDF worker profile is unsupported.");
	if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-")) || bytes.length > stateBallotPdfCollectorContract.maximumPdfBytes) throw new Error("The PDF inspection input exceeds its bounds.");
	const directory = await mkdtemp(join(tmpdir(), "ballot-pdf-inspection-"));
	try {
		const filename = join(directory, "document.pdf");
		await writeFile(filename, bytes, { flag: "wx", mode: 0o600 });
		return await runPdfExtractor(bytes, executable, ["--json=2", "--json-stream-data=inline", "--decode-level=generalized", filename], stateBallotPdfCollectorContract.timeoutMs, false, profile === "orange" ? orangeNativePdfCollectorContract.maximumObjectBytes : profile === "chicago" ? chicagoNativePdfCollectorContract.maximumObjectBytes : profile === "nyc" ? nycNativePdfCollectorContract.maximumObjectBytes : stateBallotNativePdfCollectorContract.maximumOutputBytes);
	}
	finally {
		await rm(directory, { recursive: true, force: true });
	}
}
