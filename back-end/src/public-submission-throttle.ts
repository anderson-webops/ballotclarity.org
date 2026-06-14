import process from "node:process";

interface PublicSubmissionThrottleState {
	count: number;
	resetAt: number;
}

export interface PublicSubmissionThrottleResult {
	allowed: boolean;
	retryAfterSeconds: number;
}

export interface PublicSubmissionThrottle {
	attempt: (key: string) => PublicSubmissionThrottleResult;
}

interface PublicSubmissionThrottleOptions {
	maxSubmissions?: number;
	windowMs?: number;
}

function getNumberEnv(name: string, fallback: number) {
	const raw = Number(process.env[name]);
	return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function normalizeThrottleKey(key: string) {
	return key.trim().toLowerCase() || "unknown";
}

export function createPublicSubmissionThrottle(options: PublicSubmissionThrottleOptions = {}): PublicSubmissionThrottle {
	const attempts = new Map<string, PublicSubmissionThrottleState>();
	const windowMs = options.windowMs ?? getNumberEnv("PUBLIC_FEEDBACK_RATE_LIMIT_WINDOW_MS", 10 * 60 * 1000);
	const maxSubmissions = options.maxSubmissions ?? getNumberEnv("PUBLIC_FEEDBACK_RATE_LIMIT_MAX", 5);

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

			if (current.count >= maxSubmissions) {
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
