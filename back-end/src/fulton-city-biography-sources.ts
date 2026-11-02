import type { ElectionDocumentRobotsLayout } from "./election-document-robots-layout.js";
import type { ElectionDocumentSource } from "./election-document-sources.js";
import type { ElectionReferenceSource } from "./election-reference-sources.js";

export const southFultonRobotsLayout: ElectionDocumentRobotsLayout = {
	restrictiveGroups: [
		{ agents: ["Baiduspider"], unrelated: true },
		{ agents: ["Yandex"], unrelated: true },
		{ agents: ["*"] },
		{ agents: ["Siteimprove"], unrelated: true },
		{ agents: ["Siteimprovebot"], unrelated: true },
		{ agents: ["Siteimprovebot-crawler"], unrelated: true },
		{ agents: ["meta-webindexer", "meta-externalagent", "OAI-SearchBot", "GPTBot", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Amazonbot", "Bytespider", "CCBot", "cohere-ai", "Reflectionbot", "LinkupBot", "ExaSearchBot", "YouBot", "DuckAssistBot", "serpstatbot", "AhrefsBot", "SemrushBot", "MJ12bot", "DotBot"] },
	],
};

const agencyPath = "/2919/South-Fulton-Urban-Redevelopment-Agency";

export const fultonWillisServiceReference: ElectionReferenceSource = {
	id: "ga-fulton-willis-government-service-2026",
	stateCode: "GA",
	electionDate: "2026-11-03",
	optional: true,
	allowOfficialCandidateBindings: true,
	documents: [{ url: `https://www.cityofsouthfultonga.gov${agencyPath}`, title: "Helen Zenobia Willis official biography", publisher: "City of South Fulton", candidateName: "Helen Zenobia Willis", kind: "official-biography" }],
};

export const fultonWillisServiceDocument: ElectionDocumentSource = {
	id: "ga-fulton-willis-government-documents-2026",
	stateCode: "GA",
	electionDate: "2026-11-03",
	host: "www.cityofsouthfultonga.gov",
	indexUrl: "https://www.cityofsouthfultonga.gov/27/Government",
	dateMarkers: ["Government", "South Fulton Urban Redevelopment Agency"],
	policies: [{ id: "robots", url: "https://www.cityofsouthfultonga.gov/robots.txt", format: "robots" }, { id: "site-links", url: "https://www.cityofsouthfultonga.gov/", format: "links" }],
	robotsLayout: southFultonRobotsLayout,
	documentPatterns: [`^${agencyPath}$`],
	documentFormat: "html",
	documentDateMarkers: ["South Fulton Urban Redevelopment Agency", "Helen Zenobia Willis", "June 19, 2019"],
	minimumDocuments: 1,
	maximumDocuments: 1,
};
