import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, realpath, stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import process from "node:process";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { containsControlCharacters } from "./text-validation.js";

export const stateBallotPdfCollectorContract = Object.freeze({ configuration: "STATE_BALLOT_PDFTOTEXT", executable: "absolute path to maintained Poppler pdftotext", role: "bounded collection worker; public API may read persisted facts without this tool", maximumPdfBytes: 12 * 1024 * 1024, maximumTextBytes: 4 * 1024 * 1024, timeoutMs: 12000, maximumPages: 50 });
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
async function runPdfExtractor(bytes: Buffer, executable: string, arguments_: string[], timeoutMs: number) {
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
			if (length > stateBallotPdfCollectorContract.maximumTextBytes) fail();
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
		child.stdin.end(bytes);
	});
}

export async function extractStateBallotPdfText(bytes: Buffer, executable: string, timeoutMs: number = stateBallotPdfCollectorContract.timeoutMs, format: "layout" | "bbox-layout" | "raw-bbox" = "layout", maximumPages: number = stateBallotPdfCollectorContract.maximumPages) {
	if (!["layout", "bbox-layout", "raw-bbox"].includes(format) || !Number.isInteger(maximumPages) || maximumPages < 1 || maximumPages > 2000) throw new Error("The PDF extraction input exceeds its reviewed bounds.");
	const body = await runPdfExtractor(bytes, executable, [...(format === "raw-bbox" ? ["-raw", "-bbox"] : [`-${format}`]), "-enc", "UTF-8", "-eol", "unix", "-", "-"], timeoutMs);
	const pages = format !== "layout" ? [...body.matchAll(/<page\b/gu)].length : body.split("\f").filter(page => page.trim()).length;
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

export async function extractStateBallotPdfSvg(bytes: Buffer, executable: string, page: number, timeoutMs: number = stateBallotPdfCollectorContract.timeoutMs) {
	if (!Number.isInteger(page) || page < 1 || page > stateBallotPdfCollectorContract.maximumPages) throw new Error("The PDF grid page exceeds its reviewed bounds.");
	return runPdfExtractor(bytes, executable, ["-svg", "-f", String(page), "-l", String(page), "-", "-"], timeoutMs);
}
