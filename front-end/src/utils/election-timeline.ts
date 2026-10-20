import type { ElectionKeyDate } from "~/types/civic";
import { parseDateInput } from "./display-time-zone";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const dayMs = 86_400_000;

export type KeyDateStatus = "passed" | "today" | "upcoming";

export interface KeyDateTimelineEntry extends ElectionKeyDate {
	daysAway: number;
	isNext: boolean;
	relativeLabel: string;
	status: KeyDateStatus;
}

function calendarDayKey(instant: Date, timeZone: string | null | undefined) {
	return new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		month: "2-digit",
		...(timeZone ? { timeZone } : {}),
		year: "numeric",
	}).format(instant);
}

function dayKeyToUtc(key: string) {
	const [year, month, day] = key.split("-").map(Number);
	return Date.UTC(year!, month! - 1, day!);
}

/**
 * Whole calendar days from `now` until `value`, measured in the reader's display time zone.
 * Date-only values (YYYY-MM-DD) are treated as that calendar day everywhere.
 */
export function calendarDaysUntil(value: string, now: Date, timeZone?: string | null) {
	const targetKey = isoDatePattern.test(value) ? value : calendarDayKey(parseDateInput(value), timeZone);
	return Math.round((dayKeyToUtc(targetKey) - dayKeyToUtc(calendarDayKey(now, timeZone))) / dayMs);
}

export function describeDaysAway(daysAway: number) {
	if (daysAway < 0)
		return "Passed";

	if (daysAway === 0)
		return "Today";

	if (daysAway === 1)
		return "Tomorrow";

	return `In ${daysAway} days`;
}

function resolveStatus(value: string, daysAway: number, now: Date): KeyDateStatus {
	if (daysAway < 0)
		return "passed";

	// A timed deadline (for example, polls closing) has passed once its moment is behind us.
	if (!isoDatePattern.test(value) && parseDateInput(value).getTime() < now.getTime())
		return "passed";

	return daysAway === 0 ? "today" : "upcoming";
}

/**
 * Orders key dates chronologically and marks which have passed and which one is next.
 */
export function buildKeyDateTimeline(keyDates: ElectionKeyDate[], now: Date, timeZone?: string | null): KeyDateTimelineEntry[] {
	const entries = keyDates
		.map((item, index) => {
			const daysAway = calendarDaysUntil(item.date, now, timeZone);
			const status = resolveStatus(item.date, daysAway, now);

			return {
				...item,
				daysAway,
				index,
				isNext: false,
				relativeLabel: status === "passed" ? "Passed" : describeDaysAway(daysAway),
				// Same-day entries list all-day windows before timed deadlines.
				sortTime: isoDatePattern.test(item.date) ? Number.NEGATIVE_INFINITY : parseDateInput(item.date).getTime(),
				status,
			};
		})
		.sort((left, right) => left.daysAway - right.daysAway || left.sortTime - right.sortTime || left.index - right.index);
	const nextEntry = entries.find(entry => entry.status !== "passed");

	if (nextEntry)
		nextEntry.isNext = true;

	return entries.map(({ index: _index, sortTime: _sortTime, ...entry }) => entry);
}
