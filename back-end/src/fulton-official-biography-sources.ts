import type { ElectionDocumentSource } from "./election-document-sources.js";
import type { ElectionReferenceSource } from "./election-reference-sources.js";

export const fultonOfficialBiographyReference: ElectionReferenceSource = {
	id: "ga-fulton-thorne-official-biography-2026",
	stateCode: "GA",
	electionDate: "2026-11-03",
	optional: true,
	allowOfficialCandidateBindings: true,
	documents: [{ url: "https://fultoncountyga.gov/Commissioners/Bridget-Thorne", title: "Bridget Thorne official biography", publisher: "Fulton County Government", candidateName: "Bridget Thorne", kind: "official-biography" }],
};

export const fultonOfficialBiographyDocument: ElectionDocumentSource = {
	id: "ga-fulton-thorne-official-documents-2026",
	stateCode: "GA",
	electionDate: "2026-11-03",
	host: "fultoncountyga.gov",
	indexUrl: "https://fultoncountyga.gov/commissioners",
	dateMarkers: ["Board of Commissioners", "Bridget Thorne"],
	policies: [{ id: "robots", url: "https://fultoncountyga.gov/robots.txt", format: "robots" }, { id: "privacy", url: "https://fultoncountyga.gov/Privacy-Statement", format: "main" }],
	documentPatterns: ["^/Commissioners/Bridget-Thorne$"],
	documentFormat: "html",
	documentDateMarkers: ["Bridget Thorne", "Georgia Tech"],
	minimumDocuments: 1,
	maximumDocuments: 1,
};

const ivoryArticlePath = "/News/2025/08/11/Commissioner-Mo-Ivory-Receives-Appointments-to-Several-NACo-Committees";

export const fultonIvoryOfficialBiographyReference: ElectionReferenceSource = {
	id: "ga-fulton-ivory-official-biography-2026",
	stateCode: "GA",
	electionDate: "2026-11-03",
	optional: true,
	allowOfficialCandidateBindings: true,
	documents: [{ url: `https://fultoncountyga.gov${ivoryArticlePath}`, title: "Mo Ivory official biography", publisher: "Fulton County Government", candidateName: "Mo Ivory", kind: "official-biography" }],
};

export const fultonIvoryOfficialBiographyDocument: ElectionDocumentSource = {
	id: "ga-fulton-ivory-official-documents-2026",
	stateCode: "GA",
	electionDate: "2026-11-03",
	host: "fultoncountyga.gov",
	indexUrl: `https://fultoncountyga.gov${ivoryArticlePath}`,
	dateMarkers: ["Commissioner Mo Ivory Receives Appointments", "August 11, 2025"],
	policies: [{ id: "robots", url: "https://fultoncountyga.gov/robots.txt", format: "robots" }, { id: "privacy", url: "https://fultoncountyga.gov/Privacy-Statement", format: "main" }],
	documentPatterns: [`^${ivoryArticlePath}$`],
	documentFormat: "html",
	indexIsDocument: true,
	documentDateMarkers: ["Mo Ivory", "Spelman College", "Temple University School of Law"],
	minimumDocuments: 1,
	maximumDocuments: 1,
};
