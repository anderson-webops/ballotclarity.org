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
