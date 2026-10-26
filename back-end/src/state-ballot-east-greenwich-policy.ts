import { createHash } from "node:crypto";
import { containsControlCharacters } from "./text-validation.js";

export const eastGreenwichRobotsSha256 = "d3a2ea1f865ff83e219237f15c2c04bdf433c2eb8cc20582e597d29d5defb5eb";
const applicableAgents = new Set(["*", "meta-webindexer", "meta-externalagent", "oai-searchbot", "gptbot", "claudebot", "claude-searchbot", "perplexitybot", "amazonbot", "bytespider", "ccbot", "cohere-ai", "reflectionbot", "linkupbot", "exasearchbot", "youbot", "duckassistbot", "serpstatbot", "ahrefsbot", "semrushbot", "mj12bot", "dotbot"]);

export function eastGreenwichRobotsPolicy(body: Uint8Array) {
	const value = new TextDecoder("utf-8", { fatal: true }).decode(body).replace(/\r\n?/gu, "\n");
	if (body.byteLength > 32000 || containsControlCharacters(value.replace(/[\n\t]/gu, "")) || createHash("sha256").update(value).digest("hex") !== eastGreenwichRobotsSha256) throw new Error("The East Greenwich robots policy requires review.");
	const groups: { agents: string[]; denied: string[]; delay: number }[] = [];
	let group: typeof groups[number] | undefined;
	let directives = false;
	for (const raw of value.split("\n")) {
		const line = raw.split("#", 1)[0]!.trim();
		if (!line) continue;
		const separator = line.indexOf(":");
		const key = line.slice(0, separator).trim().toLowerCase();
		const content = line.slice(separator + 1).trim();
		if (separator < 0) throw new Error("The East Greenwich robots format requires review.");
		if (key === "user-agent") {
			if (!group || directives) {
				group = { agents: [], denied: [], delay: 0 };
				groups.push(group);
			}
			group.agents.push(content.toLowerCase());
			directives = false;
		}
		else if (key === "sitemap") {
			continue;
		}
		else if (group && key === "disallow" && content.startsWith("/") && !/[*$%\\]/u.test(content)) {
			group.denied.push(content);
			directives = true;
		}
		else if (group && key === "crawl-delay" && /^\d+$/u.test(content)) {
			group.delay = Math.max(group.delay, Number(content) * 1000);
			directives = true;
		}
		else {
			throw new Error("The East Greenwich robots directive requires review.");
		}
	}
	const selected = groups.filter(item => item.agents.some(agent => applicableAgents.has(agent)));
	if (!selected.some(item => item.agents.includes("*")) || !selected.some(item => item.agents.includes("gptbot") && item.agents.includes("oai-searchbot"))) throw new Error("The East Greenwich applicable groups require review.");
	const denied = selected.flatMap(item => item.denied);
	const delay = Math.max(11000, ...selected.map(item => item.delay));
	return { delay, allowed(address: string) {
		const url = new URL(address);
		return url.protocol === "https:" && url.hostname === "www.eastgreenwichri.gov" && !url.port && !url.username && !url.password && !url.hash && !/[%\\]/u.test(url.pathname) && !denied.some(path => (url.pathname + url.search).startsWith(path));
	} };
}
