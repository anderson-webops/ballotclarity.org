export interface ElectionDocumentRobotsLayout {
	sharedWildcardAgents: readonly string[];
}

export function reviewedWildcardRobotsAgents(layout: ElectionDocumentRobotsLayout) {
	if (!layout || Object.keys(layout).join(",") !== "sharedWildcardAgents" || !Array.isArray(layout.sharedWildcardAgents) || !layout.sharedWildcardAgents.length || layout.sharedWildcardAgents.length > 50 || layout.sharedWildcardAgents.some(agent => typeof agent !== "string" || !/^[\w-]{1,100}$/iu.test(agent))) throw new Error("Election document collection stopped: robots-shared-group-review-required.");
	const agents = layout.sharedWildcardAgents.map(agent => agent.toLowerCase());
	if (new Set(agents).size !== agents.length) throw new Error("Election document collection stopped: robots-shared-group-review-required.");
	return agents;
}

export function reviewedWildcardRobotsGroup(body: string, layout?: ElectionDocumentRobotsLayout) {
	if (layout === undefined) return body;
	const agents = reviewedWildcardRobotsAgents(layout);
	const expected = [...agents, "*"];
	const lines = body.split(/\r?\n/u);
	const directives = lines.flatMap((raw, index) => {
		const line = raw.split("#", 1)[0]!.trim();
		if (!line) return [];
		const separator = line.indexOf(":");
		return [{ index, key: line.slice(0, separator).trim().toLowerCase(), value: line.slice(separator + 1).trim().toLowerCase() }];
	});
	const headers = directives.slice(0, agents.length + 1);
	if (headers.length !== agents.length + 1 || headers.some((line, index) => line.key !== "user-agent" || line.value !== expected[index]) || directives.slice(agents.length + 1).some(line => line.key === "user-agent")) throw new Error("Election document collection stopped: robots-shared-group-changed.");
	const removed = new Set(headers.slice(0, -1).map(line => line.index));
	return lines.filter((_, index) => !removed.has(index)).join("\n");
}
