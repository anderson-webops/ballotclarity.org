import { normalizeDisplayTimeZone } from "./display-time-zone";

export function electionTimeZone(election: { timeZone?: string; slug?: string } | null | undefined, fallback?: string | null) {
	return normalizeDisplayTimeZone(election?.timeZone)
		?? (election?.slug === "2026-fulton-county-general" ? "America/New_York" : fallback);
}
