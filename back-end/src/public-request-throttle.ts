import process from "node:process";

interface PublicRequestThrottleState {
	count: number;
	resetAt: number;
}

export interface PublicRequestThrottleResult {
	allowed: boolean;
	retryAfterSeconds: number;
}

export interface PublicRequestThrottle {
	attempt: (key: string) => PublicRequestThrottleResult;
}

interface PublicRequestThrottleOptions {
	fallbackMaxRequests?: number;
	fallbackWindowMs?: number;
	maxRequests?: number;
	maxRequestsEnvName?: string;
	windowMs?: number;
	windowMsEnvName?: string;
}

function getNumberEnv(name: string | undefined, fallback: number) {
	if (!name)
		return fallback;

	const raw = Number(process.env[name]);
	return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function normalizeThrottleKey(key: string) {
	return key.trim().toLowerCase() || "unknown";
}

export function createPublicRequestThrottle(options: PublicRequestThrottleOptions = {}): PublicRequestThrottle {
	const attempts = new Map<string, PublicRequestThrottleState>();
	const fallbackWindowMs = options.fallbackWindowMs ?? 10 * 60 * 1000;
	const fallbackMaxRequests = options.fallbackMaxRequests ?? 5;
	const windowMs = options.windowMs ?? getNumberEnv(options.windowMsEnvName, fallbackWindowMs);
	const maxRequests = options.maxRequests ?? getNumberEnv(options.maxRequestsEnvName, fallbackMaxRequests);

	function prune(now: number) {
		for (const [key, state] of attempts.entries()) {
			if (state.resetAt <= now)
				attempts.delete(key);
		}
	}

	return {
		attempt(key: string) {
			const now = Date.now();
			prune(now);

			const normalizedKey = normalizeThrottleKey(key);
			const current = attempts.get(normalizedKey);

			if (!current || current.resetAt <= now) {
				attempts.set(normalizedKey, {
					count: 1,
					resetAt: now + windowMs
				});

				return {
					allowed: true,
					retryAfterSeconds: 0
				};
			}

			if (current.count >= maxRequests) {
				return {
					allowed: false,
					retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
				};
			}

			current.count += 1;
			attempts.set(normalizedKey, current);

			return {
				allowed: true,
				retryAfterSeconds: 0
			};
		}
	};
}
