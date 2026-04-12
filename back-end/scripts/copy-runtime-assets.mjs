import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const sourceSchemaPath = resolve(projectRoot, "admin-schema.sql");
const distSchemaPath = resolve(projectRoot, "dist", "admin-schema.sql");

if (!existsSync(sourceSchemaPath))
	throw new Error(`Missing runtime schema file: ${sourceSchemaPath}`);

mkdirSync(dirname(distSchemaPath), { recursive: true });
copyFileSync(sourceSchemaPath, distSchemaPath);
