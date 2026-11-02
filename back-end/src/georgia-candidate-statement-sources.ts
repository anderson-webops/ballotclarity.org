import type { ElectionDocumentSource } from "./election-document-sources.js";
import type { ElectionReferenceSource } from "./election-reference-sources.js";

const sharedAgents = ["AI2Bot", "Ai2Bot-Dolma", "aiHitBot", "Amazonbot", "anthropic-ai", "Applebot-Extended", "Bytespider", "CCBot", "ClaudeBot", "cohere-ai", "cohere-training-data-crawler", "DuckAssistBot", "FacebookBot", "Google-Extended", "GoogleOther", "GoogleOther-Image", "GoogleOther-Video", "GPTBot", "img2dataset", "Meta-ExternalAgent", "MyCentralAIScraperBot", "omgili", "omgilibot", "Quora-Bot", "TikTokSpider", "YouBot", "AdsBot-Google", "AdsBot-Google-Mobile", "AdsBot-Google-Mobile-Apps"];

interface Publication {
	id: string;
	name: string;
	publisher: string;
	indexUrl: string;
	documentPath: string;
	markers: string[];
	policies?: ElectionDocumentSource["policies"];
	sharedGroup?: true;
	otherRobotsAgents?: string[];
}

const publications: readonly Publication[] = [
	{ id: "dolezal", name: "Greg Dolezal", publisher: "Dolezal for Georgia", indexUrl: "https://gregdolezal.com/", documentPath: "/", markers: ["Greg Dolezal", "Governor"], policies: [{ id: "privacy", url: "https://gregdolezal.com/privacy-policy", format: "region", regionId: "main" }] },
	{ id: "mclaurin", name: "Josh McLaurin", publisher: "Josh for Georgia", indexUrl: "https://www.joshmclaurin.com/", documentPath: "/about", markers: ["Josh McLaurin", "Lieutenant Governor"], policies: [{ id: "privacy", url: "https://www.joshmclaurin.com/privacy-policy", format: "main" }], sharedGroup: true },
	{ id: "fleming", name: "Tim Fleming", publisher: "Fleming for Georgia", indexUrl: "https://www.flemingforga.com/", documentPath: "/", markers: ["Tim Fleming", "Secretary of State"], policies: [{ id: "privacy", url: "https://www.flemingforga.com/privacy-policy", format: "main" }], sharedGroup: true },
	{ id: "miller", name: "Tanya Miller", publisher: "Tanya for Georgia", indexUrl: "https://www.tanyaforgeorgia.com/", documentPath: "/", markers: ["Tanya Miller", "Attorney General"] },
	{ id: "king", name: "John King", publisher: "Georgians for John King", indexUrl: "https://www.votejohnking.com/", documentPath: "/meet-john", markers: ["John King", "Commissioner"], policies: [{ id: "messaging-terms", url: "https://www.votejohnking.com/terms", format: "main" }, { id: "privacy", url: "https://www.votejohnking.com/privacy", format: "main" }] },
	{ id: "woods", name: "Richard Woods", publisher: "Woods for Georgia Education", indexUrl: "https://www.woodsforsuper.com/", documentPath: "/richard.html", markers: ["Richard Woods", "Superintendent"], otherRobotsAgents: ["NerdyBot", "dotbot"] },
	{ id: "powell", name: "Lydia Powell", publisher: "Lydia Powell campaign", indexUrl: "https://www.drlydiapowell.com/", documentPath: "/", markers: ["Lydia Powell", "Superintendent"], sharedGroup: true },
	{ id: "johnson", name: "Fitz Johnson", publisher: "Friends for Fitz", indexUrl: "https://www.friendsforfitz.com/", documentPath: "/", markers: ["Fitz Johnson", "Public Service"], policies: [{ id: "privacy", url: "https://www.friendsforfitz.com/privacy-policy", format: "region", regionId: "dm_content" }] },
	{ id: "porcher", name: "Nikki Porcher", publisher: "Vote Porcher for Georgia", indexUrl: "https://www.voteporcher4ga.com/", documentPath: "/", markers: ["Nikki Porcher", "Labor Commissioner"], policies: [{ id: "privacy", url: "https://www.voteporcher4ga.com/privacy-policy", format: "main" }] },
	{ id: "edwards", name: "Shelia Edwards", publisher: "Committee to Elect Shelia Edwards Public Service Commission", indexUrl: "https://www.shelia4psc.com/", documentPath: "/about", markers: ["Shelia Edwards", "Public Service"], policies: [{ id: "privacy", url: "https://www.shelia4psc.com/privacy-policy", format: "main" }] },
	{ id: "tolbert", name: "Josh Tolbert", publisher: "Tolbert for Georgia", indexUrl: "https://www.teamtolbert.com/", documentPath: "/meet-josh/", markers: ["Josh Tolbert", "Public Service Commission"], policies: [{ id: "privacy", url: "https://www.teamtolbert.com/privacy-policy/", format: "main" }], otherRobotsAgents: ["Googlebot"] },
];

export const georgiaCandidateStatementReferences: readonly ElectionReferenceSource[] = publications.map(publication => ({
	id: `ga-${publication.id}-statements-2026`,
	stateCode: "GA",
	electionDate: "2026-11-03",
	optional: true,
	documents: [{ url: new URL(publication.documentPath, publication.indexUrl).href, title: `${publication.name} campaign biography`, publisher: publication.publisher, kind: "candidate-statement", isCampaignWebsite: true }],
}));

export const georgiaCandidateStatementDocuments: readonly ElectionDocumentSource[] = publications.map(publication => ({
	id: `ga-${publication.id}-campaign-documents-2026`,
	stateCode: "GA",
	electionDate: "2026-11-03",
	host: new URL(publication.indexUrl).hostname,
	indexUrl: publication.indexUrl,
	dateMarkers: publication.markers,
	policies: [{ id: "robots", url: new URL("/robots.txt", publication.indexUrl).href, format: "robots" }, ...(publication.policies ?? [{ id: "home-links", url: publication.indexUrl, format: "links" as const }])],
	...(publication.sharedGroup ? { robotsLayout: { sharedWildcardAgents: sharedAgents } } : {}),
	...(publication.otherRobotsAgents ? { otherRobotsAgents: publication.otherRobotsAgents } : {}),
	documentPatterns: [`^${publication.documentPath.replaceAll(".", "\\.")}$`],
	documentFormat: "html",
	documentDateMarkers: publication.markers,
	minimumDocuments: 1,
	maximumDocuments: 1,
}));
