import { readFileSync } from "node:fs";
import process from "node:process";

export interface ReleaseIdentity {
	version: string;
	commit: string;
}

const commitPattern = /^[0-9a-f]{40}$/u;
const versionPattern = /^(?:development|\d+\.\d+\.\d+)$/u;

export function loadReleaseIdentity(): ReleaseIdentity {
	let bytes: string;

	try {
		bytes = readFileSync(new URL("./release-identity.json", import.meta.url), "utf8");
	}
	catch {
		if (process.env.NODE_ENV === "production")
			throw new Error("Packaged release identity is missing.");

		return { version: "development", commit: "0".repeat(40) };
	}

	const identity: unknown = JSON.parse(bytes);

	if (
		!identity
		|| typeof identity !== "object"
		|| Object.keys(identity).sort().join(",") !== "commit,version"
		|| !("commit" in identity)
		|| !("version" in identity)
		|| typeof identity.commit !== "string"
		|| typeof identity.version !== "string"
		|| !commitPattern.test(identity.commit)
		|| !versionPattern.test(identity.version)
	) {
		throw new Error("Packaged release identity is invalid.");
	}

	return { version: identity.version, commit: identity.commit };
}
