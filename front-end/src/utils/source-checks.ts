export interface ScheduledSourceCheck {
	id: string;
	nextCheckAt: string;
}

export interface ScheduledSourceCheckEntry<T extends ScheduledSourceCheck> {
	check: T;
	isOverdue: boolean;
}

/**
 * Lists overdue checks first (oldest first), then upcoming ones (soonest first), so a past
 * due date is never presented as future work.
 */
export function orderScheduledSourceChecks<T extends ScheduledSourceCheck>(checks: T[], now: Date, limit = 4): ScheduledSourceCheckEntry<T>[] {
	return checks
		.map(check => ({ check, isOverdue: new Date(check.nextCheckAt).getTime() < now.getTime(), time: new Date(check.nextCheckAt).getTime() }))
		.filter(entry => !Number.isNaN(entry.time))
		.sort((left, right) => Number(right.isOverdue) - Number(left.isOverdue) || left.time - right.time)
		.slice(0, limit)
		.map(({ check, isOverdue }) => ({ check, isOverdue }));
}
