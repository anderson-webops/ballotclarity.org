import { readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve } from "node:path";

const envLinePattern = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/;
const quotedValuePattern = /^(['"])(.*)\1$/;
const envFilenames = [".env", ".env.local"];

function isFile(path) {
	try {
		return statSync(path).isFile();
	}
	catch {
		return false;
	}
}

function parseEnvContent(content) {
	const parsed = {};

	for (const rawLine of content.split(/\r?\n/u)) {
		const line = rawLine.trim();

		if (!line || line.startsWith("#"))
			continue;

		const match = rawLine.match(envLinePattern);

		if (!match)
			continue;

		const [, key, rawValue = ""] = match;
		const quotedMatch = rawValue.match(quotedValuePattern);
		parsed[key] = quotedMatch ? quotedMatch[2] : rawValue;
	}

	return parsed;
}

function resolveEnvPath(path, cwd) {
	if (!path?.trim())
		return null;

	return isAbsolute(path) ? path : resolve(cwd, path);
}

function addEnvPath(paths, seen, candidate) {
	if (!candidate || seen.has(candidate) || !isFile(candidate))
		return;

	seen.add(candidate);
	paths.push(candidate);
}

export function resolveSharedRepoRoot(cwd = process.cwd()) {
	const gitPath = resolve(cwd, ".git");

	if (!isFile(gitPath))
		return null;

	const gitFile = readFileSync(gitPath, "utf8").trim();
	const match = gitFile.match(/^gitdir:\s*(.+)\s*$/u);

	if (!match)
		return null;

	const gitDir = resolveEnvPath(match[1], cwd);

	if (!gitDir)
		return null;

	const worktreesDir = dirname(gitDir);

	if (basename(worktreesDir) !== "worktrees")
		return null;

	const commonGitDir = dirname(worktreesDir);
	return dirname(commonGitDir);
}

export function findEnvFiles(cwd = process.cwd()) {
	const paths = [];
	const seen = new Set();
	const sharedRepoRoot = resolveSharedRepoRoot(cwd);
	const explicitEnvPath = resolveEnvPath(process.env.BALLOT_CLARITY_ENV_PATH || "", cwd);

	for (const root of [sharedRepoRoot, cwd]) {
		if (!root)
			continue;

		for (const filename of envFilenames)
			addEnvPath(paths, seen, resolve(root, filename));
	}

	addEnvPath(paths, seen, explicitEnvPath);
	return paths;
}

export function loadRootEnv(cwd = process.cwd()) {
	const env = {};

	for (const envPath of findEnvFiles(cwd))
		Object.assign(env, parseEnvContent(readFileSync(envPath, "utf8")));

	return env;
}

function resolveLocalFilePath(pathValue, cwd, fallbackPath) {
	const resolved = resolveEnvPath(pathValue || "", cwd);
	return resolved || fallbackPath;
}

function resolveLocalApiBase(env) {
	const port = Number.parseInt(String(env.PORT || "3001"), 10);
	const safePort = Number.isFinite(port) && port > 0 ? port : 3001;
	return `http://127.0.0.1:${safePort}/api`;
}

export function applyProviderLocalOverrides(env, cwd = process.cwd()) {
	const apiBase = resolveLocalApiBase(env);

	return {
		...env,
		ADMIN_API_BASE: apiBase,
		ADMIN_DB_PATH: resolveLocalFilePath(env.ADMIN_DB_PATH, cwd, resolve(cwd, "back-end", "data", "ballot-clarity.sqlite")),
		ADMIN_DATABASE_URL: "",
		ADMIN_STORE_DRIVER: "sqlite",
		DATABASE_URL: "",
		GOOGLE_CIVIC_FORCE_IPV4: env.GOOGLE_CIVIC_FORCE_IPV4 || (env.GOOGLE_CIVIC_API_KEY ? "true" : ""),
		LAUNCH_DIRECTORY_FILE: resolveLocalFilePath(env.LAUNCH_DIRECTORY_FILE, cwd, resolve(cwd, "data", "launch-directory.local.json")),
		LIVE_COVERAGE_FILE: resolveLocalFilePath(env.LIVE_COVERAGE_FILE, cwd, resolve(cwd, "data", "live-coverage.local.json")),
		NUXT_PUBLIC_API_BASE: apiBase,
		NUXT_PUBLIC_SITE_URL: "http://127.0.0.1:3333",
		SOURCE_ASSET_BASE_URL: "",
	};
}
