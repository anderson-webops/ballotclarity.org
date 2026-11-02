import type { analyzeAlabamaObjects } from "./state-ballot-alabama-native-worker.js";
import type { AlabamaSourceIdentity } from "./state-ballot-alabama-types.js";
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { Worker } from "node:worker_threads";
import { alabamaHash } from "./state-ballot-alabama-types.js";
import { resolveStateBallotPdfObjectInspector } from "./state-ballot-pdf.js";

export const alabamaNativeContract = Object.freeze({
	maximumPdfBytes: 12 * 1024 * 1024,
	maximumObjectBytes: 16 * 1024 * 1024,
	maximumDiagnosticsBytes: 65536,
	inspectionTimeoutMs: 12000,
	analysisTimeoutMs: 15000,
	workerOldGenerationMiB: 128,
	workerYoungGenerationMiB: 16,
	workerStackMiB: 4
});
export type AlabamaNativeVerification = ReturnType<typeof analyzeAlabamaObjects>;
interface Options {
	scratchDirectory: string;
	objectExecutable?: string;
}

async function inspectOriginal(bytes: Buffer, executable: string, directory: string) {
	const filename = join(directory, "original.pdf");
	await writeFile(filename, bytes, { flag: "wx", mode: 0o600 });
	return new Promise<string>((resolve, reject) => {
		const child = spawn(
			executable,
			["--json=2", "--json-stream-data=inline", "--decode-level=generalized", filename],
			{ cwd: directory, env: { LANG: "C", LC_ALL: "C", TMPDIR: directory }, stdio: ["ignore", "pipe", "pipe"] }
		);
		const output: Buffer[] = [];
		const diagnostics: Buffer[] = [];
		let outputBytes = 0;
		let diagnosticBytes = 0;
		let failure: string | undefined, killTimer: ReturnType<typeof setTimeout> | undefined;
		const abort = (reason: string) => {
			failure ??= reason;
			child.kill("SIGTERM");
			killTimer ??= setTimeout(() => child.kill("SIGKILL"), 250);
		};
		const timer = setTimeout(abort, alabamaNativeContract.inspectionTimeoutMs, "The Alabama object inspector exceeded its time budget.");
		child.stdout.on("data", (chunk: Buffer) => {
			outputBytes += chunk.length;
			if (outputBytes > alabamaNativeContract.maximumObjectBytes)
				abort("The Alabama object output exceeded its byte budget.");
			else output.push(chunk);
		});
		child.stderr.on("data", (chunk: Buffer) => {
			diagnosticBytes += chunk.length;
			if (diagnosticBytes > alabamaNativeContract.maximumDiagnosticsBytes)
				abort("The Alabama inspector diagnostics exceeded their byte budget.");
			else diagnostics.push(chunk);
		});
		const clear = () => {
			clearTimeout(timer);
			if (killTimer) clearTimeout(killTimer);
		};
		child.once("error", (error) => {
			clear();
			reject(error);
		});
		child.once("close", (code, signal) => {
			clear();
			if (failure || code !== 0 || signal || Buffer.concat(diagnostics).toString().trim())
				reject(new Error(failure ?? `The original Alabama PDF remains held after inspector exit ${code}.`));
			else resolve(Buffer.concat(output).toString("utf8"));
		});
	});
}

export async function verifyAlabamaOriginal(
	bytes: Buffer,
	input: AlabamaSourceIdentity,
	options: Options
): Promise<AlabamaNativeVerification> {
	if (
		!Buffer.isBuffer(bytes)
		|| bytes.length > alabamaNativeContract.maximumPdfBytes
		|| bytes.subarray(0, 5).toString() !== "%PDF-"
		|| input.sourceSha256 !== alabamaHash(bytes)
	) {
		throw new Error("The Alabama original bytes disagree with their capture.");
	}
	if (!isAbsolute(options.scratchDirectory))
		throw new Error("Configure an absolute private scratch directory for the Alabama native worker.");
	const executable = await resolveStateBallotPdfObjectInspector(options.objectExecutable);
	const directory = await mkdtemp(join(options.scratchDirectory, "alabama-inspection-"));
	let objects: string;
	try {
		objects = await inspectOriginal(bytes, executable, directory);
	}
	finally {
		await rm(directory, { recursive: true, force: true });
	}
	const worker = new Worker(
		new URL(
			import.meta.url.endsWith(".ts")
				? "../dist/state-ballot-alabama-native-worker.js"
				: "./state-ballot-alabama-native-worker.js",
			import.meta.url
		),
		{
			workerData: { objects, input },
			env: {},
			execArgv: [],
			resourceLimits: {
				maxOldGenerationSizeMb: alabamaNativeContract.workerOldGenerationMiB,
				maxYoungGenerationSizeMb: alabamaNativeContract.workerYoungGenerationMiB,
				stackSizeMb: alabamaNativeContract.workerStackMiB
			}
		}
	);
	try {
		return await new Promise<AlabamaNativeVerification>((resolve, reject) => {
			let settled = false;
			let timer: ReturnType<typeof setTimeout> | undefined;
			const finish = (error?: Error, value?: AlabamaNativeVerification) => {
				if (settled) return;
				settled = true;
				if (timer) clearTimeout(timer);
				if (error) reject(error);
				else if (value) resolve(value);
				else reject(new Error("The Alabama native worker produced no proof."));
			};
			timer = setTimeout(
				() => finish(new Error("The Alabama native analysis exceeded its time budget.")),
				alabamaNativeContract.analysisTimeoutMs
			);
			worker.once(
				"message",
				(value: ({ ok: true } & AlabamaNativeVerification) | { ok: false; error: string }) =>
					value?.ok === true
						? finish(undefined, value)
						: finish(new Error(value?.error ?? "The Alabama native worker failed closed."))
			);
			worker.once("error", error => finish(error));
			worker.once("exit", code =>
				finish(new Error(`The Alabama native worker exited without a proof (${code}).`)));
		});
	}
	finally {
		await worker.terminate();
	}
}
