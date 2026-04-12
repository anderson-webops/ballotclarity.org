import process from "node:process";

interface AttemptState {
	count: number;
	firstAttemptAt: number;
	lockedUntil: number;
}

function getNumberEnv(name: string, fallback: number) {
	const raw = Number(process.env[name]);
	return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export function createAdminLoginThrottle() {
	const attempts = new Map<string, AttemptState>();
	const windowMs = getNumberEnv("ADMIN_LOGIN_WINDOW_MS", 15 * 60 * 1000);
	const maxAttempts = getNumberEnv("ADMIN_LOGIN_MAX_ATTEMPTS", 5);
	const lockoutMs = getNumberEnv("ADMIN_LOGIN_LOCKOUT_MS", 30 * 60 * 1000);

	function prune(now: number) {
		for (const [key, state] of attempts.entries()) {
			if (state.lockedUntil > 0 && state.lockedUntil > now)
				continue;

			if (now - state.firstAttemptAt > windowMs)
				attempts.delete(key);
		}
	}

	function normalizeKey(username: string, ip: string) {
		const normalizedIp = ip.split(",")[0]?.trim().toLowerCase() || "unknown";
		return `${normalizedIp}::${username.trim().toLowerCase()}`;
	}

	return {
		check(username: string, ip: string) {
			const now = Date.now();
			prune(now);
			const key = normalizeKey(username, ip);
			const state = attempts.get(key);

			if (!state || state.lockedUntil <= now)
				return { allowed: true, key, retryAfterSeconds: 0 };

			return {
				allowed: false,
				key,
				retryAfterSeconds: Math.max(1, Math.ceil((state.lockedUntil - now) / 1000))
			};
		},
		clear(key: string) {
			attempts.delete(key);
		},
		recordFailure(key: string) {
			const now = Date.now();
			const current = attempts.get(key);

			if (!current || now - current.firstAttemptAt > windowMs) {
				attempts.set(key, {
					count: 1,
					firstAttemptAt: now,
					lockedUntil: 0
				});
				return;
			}

			const nextCount = current.count + 1;
			attempts.set(key, {
				count: nextCount,
				firstAttemptAt: current.firstAttemptAt,
				lockedUntil: nextCount >= maxAttempts ? now + lockoutMs : 0
			});
		}
	};
}
