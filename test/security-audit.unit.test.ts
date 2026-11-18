import assert from "node:assert/strict";
import test from "node:test";

import {
	evaluateAuditReport,
	formatAuditEvaluation,
	readNpmAuditReport
} from "../scripts/security-audit.mjs";

test("security audit policy passes only a clean audit report", () => {
	const evaluation = evaluateAuditReport({ vulnerabilities: {} });

	assert.equal(evaluation.ok, true);
	assert.equal(evaluation.total, 0);
	assert.deepEqual(evaluation.allowed, []);
	assert.deepEqual(evaluation.unexpected, []);
	assert.match(formatAuditEvaluation(evaluation), /no vulnerabilities/);
});

test("audit errors and incomplete results remain blocking", () => {
	for (const report of [undefined, {}, { error: { code: "EAUDIT" } }, { vulnerabilities: null }, { vulnerabilities: [] }]) {
		const evaluation = evaluateAuditReport(report);
		assert.equal(evaluation.ok, false);
		assert.equal(evaluation.unexpected[0].name, "audit-unavailable");
	}
});

test("the full audit includes root tools and both workspaces", () => {
	const report = readNpmAuditReport((command: string, argumentsList: string[]) => {
		assert.equal(command, "npm");
		assert.deepEqual(argumentsList, ["audit", "--workspaces", "--include-workspace-root", "--json"]);
		return JSON.stringify({ vulnerabilities: {} });
	});
	assert.equal(evaluateAuditReport(report).ok, true);
});

test("security audit policy fails every reported package finding", () => {
	const evaluation = evaluateAuditReport({
		vulnerabilities: {
			esbuild: {
				severity: "high"
			},
			lodash: {
				severity: "moderate"
			}
		}
	});

	assert.equal(evaluation.ok, false);
	assert.equal(evaluation.total, 2);
	assert.deepEqual(evaluation.allowed, []);
	assert.deepEqual(evaluation.unexpected, [
		{
			name: "esbuild",
			reason: "Every npm audit finding must be remediated before release."
		},
		{
			name: "lodash",
			reason: "Every npm audit finding must be remediated before release."
		}
	]);
	assert.match(formatAuditEvaluation(evaluation), /npm audit found vulnerabilities/);
	assert.match(formatAuditEvaluation(evaluation), /esbuild/);
	assert.match(formatAuditEvaluation(evaluation), /lodash/);
});
