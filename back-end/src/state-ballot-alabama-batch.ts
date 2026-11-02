import type { StateBallotSource } from "./state-ballot-sources.js";
import { randomUUID } from "node:crypto";
import { open, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { alabamaHash } from "./state-ballot-alabama-types.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";

export async function selectAlabamaCountyBatch(sources: StateBallotSource[], catalogPath: string) {
	assertExternalStateDataDirectory(dirname(catalogPath));
	const ordered = [...sources].sort((first, second) => first.id.localeCompare(second.id));
	if (!ordered.length) return { sources: [], deferredSources: [], complete: async () => undefined };
	const selectionSha256 = alabamaHash(JSON.stringify(ordered.map(source => source.id)));
	const path = `${catalogPath}.alabama-batch.json`;
	let start = 0;
	try {
		const value: unknown = JSON.parse((await readBoundedStateDataBytes(path, 4096)).toString("utf8"));
		if (
			!value
			|| typeof value !== "object"
			|| Array.isArray(value)
			|| Object.keys(value).sort().join("|") !== "nextIndex|schemaVersion|selectionSha256"
			|| !("schemaVersion" in value)
			|| value.schemaVersion !== 1
			|| !("selectionSha256" in value)
			|| typeof value.selectionSha256 !== "string"
			|| !/^[a-f\d]{64}$/u.test(value.selectionSha256)
			|| !("nextIndex" in value)
			|| !Number.isSafeInteger(value.nextIndex)
			|| Number(value.nextIndex) < 0
			|| Number(value.nextIndex) > 10000
		) {
			throw new Error("The Alabama collection cursor requires review.");
		}
		if (value.selectionSha256 === selectionSha256) {
			if (Number(value.nextIndex) >= ordered.length)
				throw new Error("The Alabama collection cursor is outside its selected sources.");
			start = Number(value.nextIndex);
		}
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	const rotated = [...ordered.slice(start), ...ordered.slice(0, start)];
	const selected = rotated.slice(0, 25);
	const deferredSources = rotated.slice(25).map(source => source.id);
	return {
		sources: selected,
		deferredSources,
		async complete() {
			if (!ordered.length) return;
			const temporary = `${path}.${randomUUID()}.tmp`;
			try {
				const handle = await open(temporary, "wx", 0o600);
				try {
					await handle.writeFile(
						`${JSON.stringify({
							schemaVersion: 1,
							selectionSha256,
							nextIndex: (start + selected.length) % ordered.length
						})}\n`
					);
					await handle.sync();
				}
				finally {
					await handle.close();
				}
				await rename(temporary, path);
			}
			finally {
				await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
					if (error.code !== "ENOENT") throw error;
				});
			}
		}
	};
}
