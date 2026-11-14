import { fultonPolicyReceipts } from "./fulton-source-policy.js";

export const fultonCalendarPublication = {
	sourceId: "ga-fulton-election-calendar",
	stateCode: "GA",
	countyFips: "13121",
	indexUrl: "https://fultoncountyga.gov/Inside-Fulton-County/Fulton-County-Departments/Registration-and-Elections",
	calendarUrl: "https://fultoncountyga.gov/Inside-Fulton-County/Fulton-County-Departments/Registration-and-Elections/Election-Key-Dates",
	policies: fultonPolicyReceipts.slice(0, 2),
	minimumRefreshIntervalMs: 6 * 3600000,
	minimumRequestIntervalMs: 11000,
	maximumDocumentBytes: 3 * 1024 * 1024
} as const;
