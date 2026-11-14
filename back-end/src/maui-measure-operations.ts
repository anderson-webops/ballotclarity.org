import type { AdminOperationDataset } from "./types/civic.js";
import process from "node:process";
import { mauiCharterRefreshIntervalMs, readLatestMauiCharterCapture } from "./maui-charter-collection.js";
import { readMauiPreparationRun } from "./maui-measure-automation-storage.js";
import { mauiMeasurePreparationIdentity, readMauiMeasureAutomationPlan } from "./maui-measure-automation.js";
import { assertExternalStateDataDirectory } from "./state-ballot-storage.js";

export interface MauiMeasureRepository { inspectSources: () => Promise<AdminOperationDataset[]> }

const reasons = {
	"election-review-required": "This election needs a pinned review.",
	"resolution-evidence-required": "Original resolution evidence is required.",
	"editorial-review-required": "Editorial review is required.",
	"missing-review": "This question needs review.",
	"question-changed": "The official question changed.",
	"resolution-document-changed": "The resolution document changed.",
	"review-incomplete": "The review is incomplete.",
	"question-no-longer-offered": "The question is no longer offered."
};

export function createMauiMeasureRepository(planPath = process.env.MAUI_MEASURE_AUTOMATION_PLAN?.trim(), now = Date.now): MauiMeasureRepository | null {
	if (!planPath) return null;
	assertExternalStateDataDirectory(planPath);
	return { async inspectSources() {
		const checkedAt = now();
		const dataset: AdminOperationDataset = { id: "hi-maui-charter", label: "Maui County ballot questions", stateCode: "HI", electionDate: "", kind: "measures", mode: "automatic", status: "missing", records: null, retrievedAt: null, lastAttemptAt: null, lastImportAt: null, failure: null, collectionState: "unreported", preparationState: "unreported", lastSuccessAt: null, lastPreparedAt: null, sourceUrl: "https://mauicountyvotes.gov/charter-amendments", reviewIssues: [] };
		try {
			const plan = await readMauiMeasureAutomationPlan(planPath);
			let source: Awaited<ReturnType<typeof readLatestMauiCharterCapture>> | null = null;
			try {
				source = await readLatestMauiCharterCapture(plan.collectionDirectory, checkedAt);
			}
			catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			}
			const preparation = await readMauiPreparationRun(plan.preparationDirectory, checkedAt);
			const collection = source?.run;
			const inventory = source?.inventory;
			dataset.collectionState = collection?.status ?? "unreported";
			if (collection?.status === "running") dataset.status = "pending";
			dataset.lastAttemptAt = collection?.startedAt ?? null;
			dataset.lastSuccessAt = collection?.lastSuccessAt ?? null;
			dataset.preparationState = preparation?.status ?? "unreported";
			dataset.lastPreparedAt = preparation?.lastPrepared?.preparedAt ?? null;
			if (inventory) {
				dataset.electionDate = inventory.electionDate;
				dataset.records = inventory.questions.length;
				dataset.retrievedAt = source!.capture!.documents.map(document => document.capturedAt).sort().at(-1)!;
				const cohort = plan.cohorts.find(cohort => cohort.electionDate === inventory.electionDate);
				const identity = mauiMeasurePreparationIdentity(source!.run!.latest!.inventorySha256, cohort);
				const matches = preparation?.input?.identitySha256 === identity;
				if (preparation && ["prepared", "review"].includes(preparation.status) && !matches) dataset.preparationState = "unreported";
				dataset.status = preparation?.status === "running" ? "pending" : !preparation || preparation.status === "review" || preparation.input?.identitySha256 !== identity ? "review" : Date.parse(collection!.lastSuccessAt ?? "") + mauiCharterRefreshIntervalMs <= checkedAt ? "stale" : inventory.electionDate < new Date(checkedAt).toISOString().slice(0, 10) ? "archived" : "current";
				dataset.reviewIssues = (matches ? preparation?.issues ?? [] : []).map(issue => ({ id: `${inventory.electionDate}-${issue.resolution ?? "election"}-${issue.reason}`, label: inventory.questions.find(question => question.resolution === issue.resolution)?.title ?? (issue.resolution ? `Resolution ${issue.resolution}` : "Maui County ballot questions"), electionDate: inventory.electionDate, reason: reasons[issue.reason] }));
			}
			if (collection?.status === "failed" || preparation?.status === "failed") {
				dataset.status = "error";
				dataset.failure = collection?.status === "failed" ? "County question collection failed." : "County measure preparation failed.";
			}
			if ((collection?.status === "running" && Date.parse(collection.startedAt) + 3600000 <= checkedAt) || (preparation?.status === "running" && Date.parse(preparation.startedAt) + 3600000 <= checkedAt)) {
				dataset.status = "error";
				dataset.failure = "County measure automation has not reported a result.";
			}
		}
		catch {
			dataset.status = "error";
			dataset.failure = "County measure evidence or configuration is invalid.";
			dataset.preparationState = "invalid";
			dataset.collectionState = "invalid";
		}
		return [dataset];
	} };
}
