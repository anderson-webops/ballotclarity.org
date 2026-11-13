import type { AdminOperationDataset } from "~/types/civic";

export function adminDatasetStatus(item: AdminOperationDataset) {
	if (item.kind === "calendars" && item.status === "pending") return "Collecting";
	if (item.kind === "calendars" && item.status === "missing") return "Not collected";
	return { current: "Available", stale: "Stale", missing: "Missing", pending: "Awaiting records", error: "Error", archived: "Archived", review: "Review required" }[item.status];
}

export function adminDatasetCount(item: AdminOperationDataset) {
	if (item.records === null) return item.kind === "calendars" ? "Not collected" : "Not imported";
	return `${item.records} ${item.kind === "calendars" ? "events" : "records"}`;
}
