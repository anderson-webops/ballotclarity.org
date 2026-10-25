export type AdminCorrectionsState = "loading" | "authentication-required" | "error" | "empty" | "ready";

export function getAdminCorrectionsState(input: {
	authenticated: boolean | undefined;
	corrections: unknown;
	failed: boolean;
	pending: boolean;
	unauthorized: boolean;
}): AdminCorrectionsState {
	if (input.pending) return "loading";
	if (input.unauthorized || input.authenticated === false) return "authentication-required";
	if (input.failed || input.authenticated !== true || !Array.isArray(input.corrections)) return "error";
	return input.corrections.length === 0 ? "empty" : "ready";
}
