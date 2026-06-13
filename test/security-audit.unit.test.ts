import assert from "node:assert/strict";
import test from "node:test";

import {
	documentedUpstreamAuditExceptions,
	evaluateAuditReport,
	formatAuditEvaluation
} from "../scripts/security-audit.mjs";

function buildAllowedReport() {
	return {
		vulnerabilities: Object.fromEntries(Object.entries(documentedUpstreamAuditExceptions).map(([name, exception]) => [
			name,
			{
				name,
				...exception
			}
		]))
	};
}

test("security audit policy passes a clean audit report", () => {
	const evaluation = evaluateAuditReport({ vulnerabilities: {} });

	assert.equal(evaluation.ok, true);
	assert.equal(evaluation.total, 0);
	assert.match(formatAuditEvaluation(evaluation), /no vulnerabilities/);
});

test("security audit policy permits only the documented Nuxt Vite upstream chain", () => {
	const evaluation = evaluateAuditReport(buildAllowedReport());

	assert.equal(evaluation.ok, true);
	assert.equal(evaluation.total, Object.keys(documentedUpstreamAuditExceptions).length);
	assert.deepEqual(evaluation.unexpected, []);
	assert.match(formatAuditEvaluation(evaluation), /documented upstream Nuxt\/Vite advisory entries/);
});

test("security audit policy fails when a new package appears", () => {
	const report = buildAllowedReport();
	report.vulnerabilities.lodash = {
		effects: [],
		fixAvailable: true,
		isDirect: false,
		name: "lodash",
		range: "<4.17.21",
		severity: "high",
		via: [{
			name: "lodash",
			range: "<4.17.21",
			severity: "high",
			source: 123
		}]
	};

	const evaluation = evaluateAuditReport(report);

	assert.equal(evaluation.ok, false);
	assert.deepEqual(evaluation.unexpected, [{
		name: "lodash",
		reason: "No documented exception exists for this audit finding."
	}]);
});

test("security audit policy fails when a documented finding changes", () => {
	const report = buildAllowedReport();
	report.vulnerabilities.esbuild = {
		...report.vulnerabilities.esbuild,
		via: [{
			name: "esbuild",
			range: ">=0.17.0 <0.29.0",
			severity: "critical",
			source: 9999999
		}]
	};

	const evaluation = evaluateAuditReport(report);

	assert.equal(evaluation.ok, false);
	assert.deepEqual(evaluation.unexpected, [{
		name: "esbuild",
		reason: "The audit finding changed from the documented upstream exception fingerprint."
	}]);
});
