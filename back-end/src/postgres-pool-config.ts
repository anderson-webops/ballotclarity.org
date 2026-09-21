import type { PoolConfig } from "pg";
import process from "node:process";

interface PostgresPoolConfigOptions {
	connectionString: string;
	defaultMax: number;
	maxEnvName: string;
}

const defaultConnectionTimeoutMs = 5_000;
const defaultIdleTimeoutMs = 10_000;
const maximumConnectionTimeoutMs = 60_000;
const maximumIdleTimeoutMs = 300_000;
const maximumPoolSize = 100;

export function resolveBoundedPositiveInteger(
	value: string | number | null | undefined,
	fallback: number,
	maximum: number,
) {
	const parsed = typeof value === "number" ? value : Number(value);

	return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum
		? parsed
		: fallback;
}

export function createPostgresPoolConfig(
	options: PostgresPoolConfigOptions,
	env: NodeJS.ProcessEnv = process.env,
): PoolConfig {
	return {
		allowExitOnIdle: true,
		connectionString: options.connectionString,
		connectionTimeoutMillis: resolveBoundedPositiveInteger(
			env.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
			defaultConnectionTimeoutMs,
			maximumConnectionTimeoutMs,
		),
		idleTimeoutMillis: resolveBoundedPositiveInteger(
			env.DATABASE_POOL_IDLE_TIMEOUT_MS,
			defaultIdleTimeoutMs,
			maximumIdleTimeoutMs,
		),
		max: resolveBoundedPositiveInteger(
			env[options.maxEnvName],
			options.defaultMax,
			maximumPoolSize,
		),
	};
}
