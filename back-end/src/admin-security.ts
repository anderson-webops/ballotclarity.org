import type { AdminSecurityStatus, AdminSecurityUser, AdminUser } from "./types/civic.js";

function toSecurityUser(user: AdminUser): AdminSecurityUser {
	return {
		displayName: user.displayName,
		id: user.id,
		role: user.role,
		username: user.username
	};
}

export function buildAdminSecurityStatus(users: AdminUser[]): AdminSecurityStatus {
	const activeUsers = users.filter(user => !user.disabledAt);
	const usersWithoutMfa = activeUsers
		.filter(user => !user.mfaEnabledAt)
		.map(toSecurityUser);
	const activeUserCount = activeUsers.length;
	const mfaEnabledUserCount = activeUsers.filter(user => user.mfaEnabledAt).length;

	if (!activeUserCount) {
		return {
			activeAdminCount: 0,
			activeUserCount: 0,
			mfaEnabledUserCount: 0,
			status: "needs_attention",
			summary: "No active admin-portal users are configured.",
			usersWithoutMfa: []
		};
	}

	return {
		activeAdminCount: activeUsers.filter(user => user.role === "admin").length,
		activeUserCount,
		mfaEnabledUserCount,
		status: usersWithoutMfa.length ? "needs_attention" : "healthy",
		summary: usersWithoutMfa.length
			? usersWithoutMfa.length === 1
				? "1 active admin-portal account still needs MFA."
				: `${usersWithoutMfa.length} active admin-portal accounts still need MFA.`
			: "All active admin-portal accounts have MFA enabled.",
		usersWithoutMfa
	};
}
