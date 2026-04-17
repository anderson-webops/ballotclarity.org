import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const runtimeAssets = [
	{
		sourcePath: resolve(projectRoot, "admin-schema.sql"),
		targetPath: resolve(projectRoot, "dist", "admin-schema.sql")
	},
	{
		sourcePath: resolve(projectRoot, "admin-schema.postgres.sql"),
		targetPath: resolve(projectRoot, "dist", "admin-schema.postgres.sql")
	},
	{
		sourcePath: resolve(projectRoot, "live-data-schema.sql"),
		targetPath: resolve(projectRoot, "dist", "live-data-schema.sql")
	}
];

for (const asset of runtimeAssets) {
	if (!existsSync(asset.sourcePath))
		throw new Error(`Missing runtime asset file: ${asset.sourcePath}`);

	mkdirSync(dirname(asset.targetPath), { recursive: true });
	copyFileSync(asset.sourcePath, asset.targetPath);
}
