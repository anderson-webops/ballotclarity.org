import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const nuxtDowngradeFix = {
	isSemVerMajor: true,
	name: "nuxt",
	version: "2.18.1"
};

export const documentedUpstreamAuditExceptions = {
	"@nuxt/nitro-server": {
		effects: ["nuxt"],
		fixAvailable: nuxtDowngradeFix,
		isDirect: false,
		range: ">=3.20.0",
		reason: "npm currently reports Nuxt 4's published package range as vulnerable and suggests downgrading to Nuxt 2, which is not a valid fix for this Nuxt 4 app.",
		severity: "high",
		via: ["nuxt"]
	},
	"@nuxt/vite-builder": {
		effects: ["nuxt"],
		fixAvailable: nuxtDowngradeFix,
		isDirect: false,
		range: ">=3.3.2",
		reason: "This is part of the Nuxt 4 builder chain that currently resolves through Vite 7.",
		severity: "high",
		via: ["nuxt", "vite", "vite-node"]
	},
	esbuild: {
		effects: ["vite"],
		fixAvailable: nuxtDowngradeFix,
		isDirect: false,
		range: "0.17.0 - 0.28.0",
		reason: "Vite 7.3.5 declares esbuild ^0.27.0. Current Nuxt 4.4.8 still declares Vite ^7.3.3, so forcing Vite 8 is outside Nuxt's published dependency contract.",
		severity: "high",
		via: [
			{
				name: "esbuild",
				range: ">=0.17.0 <0.28.1",
				severity: "high",
				source: 1120679
			},
			{
				name: "esbuild",
				range: ">=0.27.3 <0.28.1",
				severity: "low",
				source: 1120680
			}
		]
	},
	nuxt: {
		effects: ["@nuxt/nitro-server", "@nuxt/vite-builder"],
		fixAvailable: nuxtDowngradeFix,
		isDirect: true,
		range: ">=3.3.2",
		reason: "The direct Nuxt finding is an aggregate of the Nuxt package-chain advisories above.",
		severity: "high",
		via: ["@nuxt/nitro-server", "@nuxt/vite-builder"]
	},
	vite: {
		effects: ["@nuxt/vite-builder", "vite-node", "vite-plugin-inspect", "vite-plugin-vue-tracer"],
		fixAvailable: nuxtDowngradeFix,
		isDirect: false,
		range: "4.2.0-beta.0 - 8.0.3",
		reason: "Current Nuxt 4.4.8 depends on Vite 7. Vite 8 is outside @nuxt/vite-builder's declared dependency range.",
		severity: "high",
		via: ["esbuild"]
	},
	"vite-node": {
		effects: ["@nuxt/vite-builder"],
		fixAvailable: nuxtDowngradeFix,
		isDirect: false,
		range: "1.0.0-beta.0 - 5.3.0",
		reason: "This follows from @nuxt/vite-builder's current vite-node dependency.",
		severity: "high",
		via: ["vite"]
	},
	"vite-plugin-inspect": {
		effects: [],
		fixAvailable: true,
		isDirect: false,
		range: "0.10.0-alpha.0 - 11.3.3",
		reason: "This follows from Nuxt devtools' current Vite 7 plugin chain.",
		severity: "high",
		via: ["vite"]
	},
	"vite-plugin-vue-tracer": {
		effects: [],
		fixAvailable: true,
		isDirect: false,
		range: "<=1.3.0",
		reason: "This follows from Nuxt devtools' current Vite 7 plugin chain.",
		severity: "high",
		via: ["vite"]
	}
};

function sortValues(values) {
	return [...values].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function normalizeFixAvailable(fixAvailable) {
	if (fixAvailable === true || fixAvailable === false || fixAvailable === undefined)
		return fixAvailable;

	return {
		isSemVerMajor: Boolean(fixAvailable.isSemVerMajor),
		name: fixAvailable.name,
		version: fixAvailable.version
	};
}

function normalizeVia(via) {
	return sortValues((via ?? []).map((entry) => {
		if (typeof entry === "string")
			return { name: entry, type: "package" };

		return {
			name: entry.name,
			range: entry.range,
			severity: entry.severity,
			source: entry.source,
			type: "advisory"
		};
	}));
}

function vulnerabilityFingerprint(vulnerability) {
	return {
		effects: sortValues(vulnerability.effects ?? []),
		fixAvailable: normalizeFixAvailable(vulnerability.fixAvailable),
		isDirect: Boolean(vulnerability.isDirect),
		range: vulnerability.range,
		severity: vulnerability.severity,
		via: normalizeVia(vulnerability.via)
	};
}

function sameFingerprint(left, right) {
	return JSON.stringify(vulnerabilityFingerprint(left)) === JSON.stringify(vulnerabilityFingerprint(right));
}

export function evaluateAuditReport(report) {
	const vulnerabilities = report?.vulnerabilities ?? {};
	const unexpected = [];
	const allowed = [];

	for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
		const documentedException = documentedUpstreamAuditExceptions[name];

		if (!documentedException) {
			unexpected.push({
				name,
				reason: "No documented exception exists for this audit finding."
			});
			continue;
		}

		if (!sameFingerprint(vulnerability, documentedException)) {
			unexpected.push({
				name,
				reason: "The audit finding changed from the documented upstream exception fingerprint."
			});
			continue;
		}

		allowed.push(name);
	}

	return {
		allowed,
		ok: unexpected.length === 0,
		total: Object.keys(vulnerabilities).length,
		unexpected
	};
}

export function formatAuditEvaluation(evaluation) {
	if (evaluation.ok && evaluation.total === 0)
		return "npm audit passed with no vulnerabilities.";

	if (evaluation.ok) {
		return [
			`npm audit found ${evaluation.allowed.length} documented upstream Nuxt/Vite advisory entries and no unexpected vulnerabilities.`,
			"These entries are tracked in docs/security-audit.md. Revisit when Nuxt publishes a Vite 8-compatible release."
		].join("\n");
	}

	return [
		"npm audit found unexpected or changed vulnerabilities:",
		...evaluation.unexpected.map(item => `- ${item.name}: ${item.reason}`)
	].join("\n");
}

export function readNpmAuditReport() {
	try {
		return JSON.parse(execFileSync("npm", ["audit", "--workspaces", "--json"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"]
		}));
	}
	catch (error) {
		if (error.stdout)
			return JSON.parse(error.stdout.toString());

		throw error;
	}
}

export function main() {
	const evaluation = evaluateAuditReport(readNpmAuditReport());
	console.log(formatAuditEvaluation(evaluation));

	if (!evaluation.ok)
		process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
	main();
