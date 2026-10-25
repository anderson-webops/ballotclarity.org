import type { StateRecordState } from "~/types/civic";
import { readStateRecordQuery } from "./state-records";

export function readRecoverableStateRecordQuery(query: Record<string, unknown>, states: readonly StateRecordState[]) {
	const filters = readStateRecordQuery(query, states);
	const state = states.find(state => state.stateCode === filters.stateCode);
	if (state?.configured === false && !state.sources?.length && typeof query.source === "string" && /^[a-z0-9][a-z0-9-]{0,100}$/u.test(query.source))
		return { ...filters, sourceId: undefined };
	return filters;
}

export function stateRecordSourceMismatch(requestedSource: unknown, response: { available: boolean; source?: { id?: string } } | null | undefined) {
	return Boolean(response?.available && requestedSource !== undefined && (typeof requestedSource !== "string" || response.source?.id !== requestedSource));
}
