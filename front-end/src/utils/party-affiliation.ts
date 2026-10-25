export function resolvePartyAffiliation(party: string | null | undefined) {
	const label = party?.trim().toLowerCase().replace(/^prefers\s+/u, "").replace(/\s+party$/u, "");
	if (["democrat", "democratic", "dem", "d"].includes(label ?? ""))
		return "democratic";
	if (["republican", "rep", "r"].includes(label ?? ""))
		return "republican";
	return undefined;
}
