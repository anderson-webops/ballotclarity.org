import process from "node:process";
import { createAdminRepository } from "./admin-repository.js";

function readFlag(flag: string) {
	const index = process.argv.indexOf(flag);

	if (index === -1)
		return undefined;

	return process.argv[index + 1];
}

const username = readFlag("--username") || process.env.ADMIN_BOOTSTRAP_USERNAME;
const password = readFlag("--password") || process.env.ADMIN_BOOTSTRAP_PASSWORD;
const displayName = readFlag("--display-name") || process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME || "Ballot Clarity Admin";
const role = (readFlag("--role") || process.env.ADMIN_BOOTSTRAP_ROLE || "admin") as "admin" | "editor";
const dbPath = readFlag("--db-path") || process.env.ADMIN_DB_PATH;

if (!username || !password) {
	console.error("Usage: npm run bootstrap-admin -- --username <name> --password <password> [--display-name <label>] [--role admin|editor] [--db-path <path>]");
	process.exit(1);
}

async function main() {
	try {
		if (!username || !password) {
			throw new Error("Username and password are required.");
		}

		const repository = await createAdminRepository({
			databaseUrl: process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL || null,
			dbPath
		});
		const user = await repository.createUser({
			displayName,
			password,
			role,
			username
		});

		console.log(`Created ${user.role} user ${user.username} in ${(process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL) ? "configured admin database" : dbPath || "default admin database"}.`);
	}
	catch (error) {
		console.error(error instanceof Error ? error.message : "Unable to create admin user.");
		process.exit(1);
	}
}

void main();
