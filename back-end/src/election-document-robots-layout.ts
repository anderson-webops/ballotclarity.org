export type ElectionDocumentRobotsLayout = {
	sharedWildcardAgents: readonly string[];
	restrictiveGroups?: never;
} | {
	sharedWildcardAgents?: never;
	restrictiveGroups: readonly { agents: readonly string[]; unrelated?: true }[];
};

const unrelatedAgents = new Set(["baiduspider", "yandex", "siteimprove", "siteimprovebot", "siteimprovebot-crawler"]);

export function validateReviewedRobotsLayout(layout: ElectionDocumentRobotsLayout) {
	if (!layout || !("restrictiveGroups" in layout)) {
		reviewedWildcardRobotsAgents(layout);
		return;
	}
	if (Object.keys(layout).join(",") !== "restrictiveGroups" || !Array.isArray(layout.restrictiveGroups) || !layout.restrictiveGroups.length || layout.restrictiveGroups.length > 20) throw new Error("Election document collection stopped: robots-restrictive-group-review-required.");
	const observed = new Set<string>();
	for (const group of layout.restrictiveGroups) {
		if (!group || Object.keys(group).sort().join(",") !== (group.unrelated === undefined ? "agents" : "agents,unrelated") || (group.unrelated !== undefined && group.unrelated !== true) || !Array.isArray(group.agents) || !group.agents.length || group.agents.length > 50) throw new Error("Election document collection stopped: robots-restrictive-group-review-required.");
		for (const value of group.agents) {
			if (typeof value !== "string" || (value !== "*" && !/^[\w-]{1,100}$/iu.test(value))) throw new Error("Election document collection stopped: robots-restrictive-group-review-required.");
			const agent = value.toLowerCase();
			if (observed.has(agent) || (group.unrelated && !unrelatedAgents.has(agent))) throw new Error("Election document collection stopped: robots-restrictive-group-review-required.");
			observed.add(agent);
		}
	}
	if (!observed.has("*") || observed.size > 100) throw new Error("Election document collection stopped: robots-restrictive-group-review-required.");
}

export function reviewedRestrictiveRobotsGroups(body: string, layout: ElectionDocumentRobotsLayout) {
	validateReviewedRobotsLayout(layout);
	if (!layout.restrictiveGroups) throw new Error("Election document collection stopped: robots-restrictive-group-review-required.");
	const groups: { agents: string[]; directives: string[] }[] = [];
	for (const raw of body.split(/\r?\n/u)) {
		const line = raw.split("#", 1)[0]!.trim();
		if (!line) continue;
		const separator = line.indexOf(":");
		if (separator < 0) throw new Error("Election document collection stopped: robots-format-changed.");
		const key = line.slice(0, separator).trim().toLowerCase();
		const value = line.slice(separator + 1).trim();
		let current = groups.at(-1);
		if (key === "user-agent") {
			if (!current || current.directives.some(directive => !/^sitemap\s*:/iu.test(directive))) {
				current = { agents: [], directives: [] };
				groups.push(current);
			}
			current.agents.push(value.toLowerCase());
		}
		else {
			if (!current) throw new Error("Election document collection stopped: robots-format-changed.");
			current.directives.push(line);
		}
	}
	if (groups.length !== layout.restrictiveGroups.length) throw new Error("Election document collection stopped: robots-restrictive-group-changed.");
	return groups.map((group, index) => {
		const expected = layout.restrictiveGroups![index]!;
		if (group.agents.join(",") !== expected.agents.map(agent => agent.toLowerCase()).join(",") || !group.directives.some(directive => !/^sitemap\s*:/iu.test(directive))) throw new Error("Election document collection stopped: robots-restrictive-group-changed.");
		return { body: `User-agent: *\n${group.directives.join("\n")}\n`, unrelated: expected.unrelated === true };
	});
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
