import type {
	AdminAuditResponse,
	AdminContentHistoryResponse,
	AdminContentResponse,
	AdminCorrectionsResponse,
	AdminOverviewResponse,
	AdminReviewResponse,
	AdminSessionResponse,
	AdminSourceMonitorResponse,
	AdminUsersResponse,
	GuidePackageListResponse,
	GuidePackageRecordResponse,
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

export function useAdminAudit() {
	return useFetch<AdminAuditResponse>("/api/admin/audit", {
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

export function useAdminContentHistory(id: MaybeRefOrGetter<string | undefined>) {
	const contentId = computed(() => toValue(id));

	return useAsyncData<AdminContentHistoryResponse | null>(
		() => `admin-content-history:${contentId.value ?? "missing"}`,
		() => contentId.value
			? $fetch(`/api/admin/content/${contentId.value}/history`, {
					headers: adminRequestHeaders(),
				})
			: Promise.resolve(null),
		{
			default: () => null,
			watch: [contentId],
		}
	);
}

export function useAdminGuidePackages() {
	return useFetch<GuidePackageListResponse>("/api/admin/packages", {
		headers: adminRequestHeaders()
	});
}

export function useAdminGuidePackage(id: MaybeRefOrGetter<string | undefined>) {
	const packageId = computed(() => toValue(id));

	return useAsyncData<GuidePackageRecordResponse | null>(
		() => `admin-guide-package:${packageId.value ?? "missing"}`,
		() => packageId.value
			? $fetch(`/api/admin/packages/${packageId.value}`, {
					headers: adminRequestHeaders(),
				})
			: Promise.resolve(null),
		{
			default: () => null,
			watch: [packageId],
		}
	);
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
