import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const stateBallotWorkbookContract = Object.freeze({
	maximumBytes: 2 * 1024 * 1024,
	maximumExpandedBytes: 24 * 1024 * 1024,
	maximumEntryBytes: 8 * 1024 * 1024,
	maximumEntries: 128,
	maximumOutputBytes: 4 * 1024 * 1024,
	maximumCells: 100000,
	maximumRows: 25001,
	maximumColumns: 32,
	timeoutMs: 12000
});
export interface StateBallotWorkbookSheet {
	sheet: string;
	data: (string | number | boolean | null)[][];
}

export async function readStateBallotWorkbook(bytes: Buffer): Promise<StateBallotWorkbookSheet[]> {
	if (
		bytes.length < 4
		|| bytes.length > stateBallotWorkbookContract.maximumBytes
		|| bytes.readUInt32LE(0) !== 0x04034B50
	) {
		throw new Error("The official workbook exceeds its supported format or size.");
	}
	const worker = new URL(
		import.meta.url.endsWith(".ts") ? "./state-ballot-workbook-worker.ts" : "./state-ballot-workbook-worker.js",
		import.meta.url
	);
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, ["--max-old-space-size=128", fileURLToPath(worker)], {
			stdio: ["pipe", "pipe", "pipe"],
			env: { PATH: process.env.PATH, LANG: "C.UTF-8", TZ: "UTC" }
		});
		const chunks: Buffer[] = [];
		let length = 0;
		let errors = 0;
		let failed = false;
		const fail = () => {
			failed = true;
			child.kill("SIGKILL");
		};
		const timer = setTimeout(fail, stateBallotWorkbookContract.timeoutMs);
		child.stdout.on("data", (chunk: Buffer) => {
			length += chunk.length;
			if (length > stateBallotWorkbookContract.maximumOutputBytes) fail();
			else chunks.push(chunk);
		});
		child.stderr.on("data", (chunk: Buffer) => {
			errors += chunk.length;
			if (errors > 65536) fail();
		});
		child.stdin.on("error", fail);
		child.once("error", () => {
			clearTimeout(timer);
			reject(new Error("The bounded workbook reader could not start."));
		});
		child.once("close", (code, signal) => {
			clearTimeout(timer);
			if (failed || signal || code !== 0)
				return reject(new Error("The official workbook reader failed or exceeded its bounds."));
			try {
				resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as StateBallotWorkbookSheet[]);
			}
			catch {
				reject(new Error("The official workbook reader returned invalid output."));
			}
		});
		child.stdin.end(bytes);
	});
}
