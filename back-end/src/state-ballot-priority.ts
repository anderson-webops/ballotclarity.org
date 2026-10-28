import { Buffer } from "node:buffer";
import process from "node:process";
import { getStateBallotCycleFamily } from "./state-ballot-cycles.js";

export function stateBallotPriorityFamilies(environment: NodeJS.ProcessEnv = process.env) {
	const configured = environment.STATE_BALLOT_PRIORITY_FAMILIES;
	if (configured === undefined) return ["ga-fulton-2026"];
	if (Buffer.byteLength(configured) > 8192) throw new Error("The collection priority exceeds its bounds.");
	if (!configured.trim()) return [];
	const families = configured.split(",").map(value => value.trim());
	if (families.length > 100 || new Set(families).size !== families.length || families.some(value => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value))) throw new Error("The collection priority must list distinct approved family IDs.");
	for (const familyId of families) getStateBallotCycleFamily(familyId);
	return families;
}

export function prioritizeStateBallotWork<Item>(items: readonly Item[], identify: (item: Item) => string, familyIds: readonly string[] = ["ga-fulton-2026"]) {
	const families = familyIds.map(getStateBallotCycleFamily);
	const rank = (item: Item) => {
		const id = identify(item);
		const position = families.findIndex(family => id === family.source.id || id.startsWith(`${family.prefix}-`));
		return position < 0 ? families.length : position;
	};
	return [...items].sort((first, second) => rank(first) - rank(second));
}
