import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envLinePattern = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/;
const quotedValuePattern = /^(['"])(.*)\1$/;

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

export function loadRootEnv(cwd = process.cwd()) {
	const envPath = resolve(cwd, ".env");

	if (!existsSync(envPath))
		return {};

	return parseEnvContent(readFileSync(envPath, "utf8"));
}

export function applyProviderLocalOverrides(env, cwd = process.cwd()) {
	return {
		...env,
		ADMIN_DB_PATH: env.ADMIN_DB_PATH || resolve(cwd, "back-end", "data", "ballot-clarity.sqlite"),
		ADMIN_DATABASE_URL: "",
		ADMIN_STORE_DRIVER: "sqlite",
		DATABASE_URL: "",
		SOURCE_ASSET_BASE_URL: "",
	};
}
