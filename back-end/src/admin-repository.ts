import type { AdminRepository, AdminRepositoryOptions } from "./admin-store.js";
import process from "node:process";
import { createSqliteAdminRepository } from "./admin-store.js";
import { createPostgresAdminRepository } from "./postgres-admin-store.js";

function resolveStoreDriver(options: AdminRepositoryOptions) {
	const configured = (process.env.ADMIN_STORE_DRIVER || "").trim().toLowerCase();

	if (configured === "postgres")
		return "postgres" as const;

	if (configured === "sqlite")
		return "sqlite" as const;

	if (options.databaseUrl || process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL)
		return "postgres" as const;

	return "sqlite" as const;
}

export async function createAdminRepository(options: AdminRepositoryOptions = {}): Promise<AdminRepository> {
	const driver = resolveStoreDriver(options);

	if (driver === "postgres")
		return await createPostgresAdminRepository(options);

	return createSqliteAdminRepository(options);
}
