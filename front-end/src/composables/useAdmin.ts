import type {
	AdminContentResponse,
	AdminCorrectionsResponse,
	AdminOverviewResponse,
	AdminReviewResponse,
	AdminSessionResponse,
	AdminSourceMonitorResponse,
	AdminUsersResponse
} from "~/types/civic";

function adminRequestHeaders() {
	return import.meta.server ? useRequestHeaders(["cookie"]) : undefined;
}

export function useAdminSession(key = "admin-session") {
	return useFetch<AdminSessionResponse>("/api/admin/session", {
		headers: adminRequestHeaders(),
		key
	});
}

export function useAdminOverview() {
	return useFetch<AdminOverviewResponse>("/api/admin/overview", {
		headers: adminRequestHeaders()
	});
}

export function useAdminCorrections() {
	return useFetch<AdminCorrectionsResponse>("/api/admin/corrections", {
		headers: adminRequestHeaders()
	});
}

export function useAdminReview() {
	return useFetch<AdminReviewResponse>("/api/admin/review", {
		headers: adminRequestHeaders()
	});
}

export function useAdminContent() {
	return useFetch<AdminContentResponse>("/api/admin/content", {
		headers: adminRequestHeaders()
	});
}

export function useAdminSourceMonitor() {
	return useFetch<AdminSourceMonitorResponse>("/api/admin/sources", {
		headers: adminRequestHeaders()
	});
}

export function useAdminUsers() {
	return useFetch<AdminUsersResponse>("/api/admin/users", {
		headers: adminRequestHeaders()
	});
}
