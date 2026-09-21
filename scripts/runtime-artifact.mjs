import { createHash } from "node:crypto";
import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, extname, relative, resolve, sep } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const projectRoot = resolve(import.meta.dirname, "..");
const contractSourcePath = resolve(projectRoot, "deploy/runtime-artifact-contract.json");
const manifestFileName = "runtime-manifest.json";
const forbiddenExtensions = new Set([".db", ".key", ".p12", ".pem", ".sqlite"]);
const copiedPaths = [
	["front-end/.output", "front-end/.output"],
	["back-end/dist", "back-end/dist"],
	["back-end/package.json", "back-end/package.json"],
	["back-end/package-lock.json", "back-end/package-lock.json"],
	["back-end/.npmrc", "back-end/.npmrc"],
	["deploy/runtime-artifact-contract.json", "runtime-artifact-contract.json"],
];

function normalizePath(root, path) {
	return relative(root, path).split(sep).join("/");
}

function assertSafeOutputPath(outputRoot) {
	if (basename(outputRoot) !== "ballot-clarity-runtime")
		throw new Error("Runtime artifact output must end in ballot-clarity-runtime.");

	if (outputRoot === projectRoot || projectRoot.startsWith(`${outputRoot}${sep}`))
		throw new Error("Runtime artifact output cannot contain the source checkout.");
}

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		encoding: "utf8",
		stdio: options.capture ? "pipe" : "inherit",
		...options,
	});

	if (result.error)
		throw result.error;

	if (result.status !== 0) {
		const detail = options.capture ? String(result.stderr || result.stdout || "").trim() : "";
		throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}.${detail ? ` ${detail}` : ""}`);
	}

	return String(result.stdout || "").trim();
}

function runNpm(args, options = {}) {
	if (process.env.npm_execpath)
		return run(process.execPath, [process.env.npm_execpath, ...args], options);

	return run(process.platform === "win32" ? "npm.cmd" : "npm", args, options);
}

function hashFile(path) {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function listArtifactFiles(root) {
	const files = [];
	const visit = (directory) => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = resolve(directory, entry.name);

			if (entry.isSymbolicLink())
				throw new Error(`Runtime artifact cannot contain symbolic links: ${normalizePath(root, path)}`);

			if (entry.isDirectory()) {
				visit(path);
				continue;
			}

			if (entry.isFile() && normalizePath(root, path) !== manifestFileName)
				files.push(path);
		}
	};

	visit(root);
	return files.sort((left, right) => normalizePath(root, left).localeCompare(normalizePath(root, right)));
}

function assertNoPrivateOrWritableContent(root, files) {
	for (const path of files) {
		const relativePath = normalizePath(root, path);
		const fileName = basename(path).toLowerCase();
		const extension = extname(fileName);

		if (fileName === ".env" || fileName.startsWith(".env."))
			throw new Error(`Runtime artifact contains an environment file: ${relativePath}`);

		if (forbiddenExtensions.has(extension) || /\.sqlite-(?:shm|wal)$/u.test(fileName))
			throw new Error(`Runtime artifact contains private or writable state: ${relativePath}`);
	}
}

function readContract(root = projectRoot) {
	const path = root === projectRoot
		? contractSourcePath
		: resolve(root, "runtime-artifact-contract.json");
	return JSON.parse(readFileSync(path, "utf8"));
}

function assertRequiredPaths(root, contract) {
	for (const service of contract.services) {
		for (const requiredPath of [service.entrypoint, ...service.requiredPaths]) {
			const resolvedPath = resolve(root, requiredPath);

			if (!existsSync(resolvedPath))
				throw new Error(`Runtime artifact is missing required path: ${requiredPath}`);
		}
	}
}

function assertBuildInputs() {
	for (const [source] of copiedPaths) {
		if (!existsSync(resolve(projectRoot, source)))
			throw new Error(`Runtime artifact build input is missing: ${source}`);
	}
}

function getSourceIdentity() {
	const commit = run("git", ["rev-parse", "HEAD"], { capture: true, cwd: projectRoot });
	const status = run("git", ["status", "--porcelain", "--untracked-files=no"], {
		capture: true,
		cwd: projectRoot,
	});

	return {
		commit,
		dirty: Boolean(status),
	};
}

function buildManifest(outputRoot, contract) {
	const files = listArtifactFiles(outputRoot);
	assertNoPrivateOrWritableContent(outputRoot, files);

	return {
		schemaVersion: 1,
		source: getSourceIdentity(),
		toolchain: {
			node: process.version,
			npm: runNpm(["--version"], { capture: true, cwd: projectRoot }),
		},
		services: contract.services,
		externalWritableState: contract.externalWritableState,
		files: files.map((path) => {
			const stats = statSync(path);
			return {
				path: normalizePath(outputRoot, path),
				sha256: hashFile(path),
				size: stats.size,
				mode: stats.mode & 0o777,
			};
		}),
	};
}

export function verifyRuntimeArtifact(outputRoot) {
	const resolvedRoot = resolve(outputRoot);
	const manifestPath = resolve(resolvedRoot, manifestFileName);

	if (!existsSync(manifestPath))
		throw new Error(`Runtime artifact is missing ${manifestFileName}.`);

	const contract = readContract(resolvedRoot);
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	assertRequiredPaths(resolvedRoot, contract);
	const files = listArtifactFiles(resolvedRoot);
	assertNoPrivateOrWritableContent(resolvedRoot, files);
	const actualPaths = files.map(path => normalizePath(resolvedRoot, path));
	const expectedPaths = manifest.files.map(file => file.path);

	if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths))
		throw new Error("Runtime artifact file inventory does not match its manifest.");

	for (const expected of manifest.files) {
		const path = resolve(resolvedRoot, expected.path);
		const stats = statSync(path);

		if (
			stats.size !== expected.size
			|| (stats.mode & 0o777) !== expected.mode
			|| hashFile(path) !== expected.sha256
		)
			throw new Error(`Runtime artifact hash mismatch: ${expected.path}`);
	}

	return manifest;
}

export function buildRuntimeArtifact(outputRoot = resolve(projectRoot, "dist/ballot-clarity-runtime")) {
	const resolvedRoot = resolve(outputRoot);
	assertSafeOutputPath(resolvedRoot);
	const sourceContract = readContract();
	assertBuildInputs();
	rmSync(resolvedRoot, { force: true, recursive: true });
	mkdirSync(resolvedRoot, { recursive: true });

	for (const [source, target] of copiedPaths) {
		const sourcePath = resolve(projectRoot, source);
		const targetPath = resolve(resolvedRoot, target);
		mkdirSync(dirname(targetPath), { recursive: true });
		cpSync(sourcePath, targetPath, { recursive: true });
	}

	runNpm([
		"ci",
		"--omit=dev",
		"--include=optional",
		"--ignore-scripts",
		"--workspaces=false",
		"--no-audit",
		"--no-fund",
	], { cwd: resolve(resolvedRoot, "back-end") });

	const contract = readContract(resolvedRoot);
	assertRequiredPaths(resolvedRoot, contract);
	const manifest = buildManifest(resolvedRoot, contract);
	writeFileSync(resolve(resolvedRoot, manifestFileName), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });
	verifyRuntimeArtifact(resolvedRoot);
	return { manifest, outputRoot: resolvedRoot };
}

function isDirectExecution(metaUrl) {
	return Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === metaUrl;
}

if (isDirectExecution(import.meta.url)) {
	const [command = "build", outputPath] = process.argv.slice(2);
	const outputRoot = outputPath ? resolve(outputPath) : undefined;

	if (command === "build") {
		const result = buildRuntimeArtifact(outputRoot);
		console.log(`Built and verified ${result.manifest.files.length} runtime files at ${result.outputRoot}.`);
	}
	else if (command === "verify") {
		const manifest = verifyRuntimeArtifact(outputRoot ?? resolve(projectRoot, "dist/ballot-clarity-runtime"));
		console.log(`Verified ${manifest.files.length} runtime files.`);
	}
	else {
		throw new Error(`Unknown runtime artifact command: ${command}`);
	}
}
