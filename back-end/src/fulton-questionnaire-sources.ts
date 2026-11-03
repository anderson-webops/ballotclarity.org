import type { ElectionDocumentSource } from "./election-document-sources.js";
import type { ElectionReferenceSource } from "./election-reference-sources.js";

const host = "buckheadcouncil.org";
const indexUrl = `https://${host}/election-central-2026/`;
const publications = [
	{ name: "Eric J. Tatum", file: "Eric-Tatum-Responses.pdf", pages: 3 },
	{ name: "Jodi Merriday", file: "Jodi-Merridays-Responses.pdf", pages: 3 },
	{ name: "Paul Burton", file: "Paul-Burton-Responses-4.pdf", pages: 3 },
	{ name: "Kevin Abel", file: "Kevin-Abel-Responses.pdf", pages: 3 },
	{ name: "Sonya Halpern", file: "Sonya-Halpern-Responses.pdf", pages: 3 },
	{ name: "John F. Guest, Jr.", file: "John-F.-Guest-Response.pdf", pages: 3 },
	{ name: "Deborah Silcox", file: "Deborah-Silcox-Responses.pdf", pages: 2 },
	{ name: "Helmut Lucero Love", file: "Dr.-Helmut-Love-Response.pdf", pages: 3 }
] as const;

export const fultonQuestionnaireReference: ElectionReferenceSource = {
	id: "ga-bcn-questionnaires-2026",
	stateCode: "GA",
	electionDate: "2026-11-03",
	optional: true,
	documents: publications.map(publication => ({
		url: `https://${host}/wp-content/uploads/2026/10/${publication.file}`,
		title: `${publication.name} candidate questionnaire`,
		publisher: "Buckhead Council of Neighborhoods",
		candidateName: publication.name,
		kind: "candidate-statement",
		pdfMaximumPages: publication.pages
	}))
};

export const fultonQuestionnaireDocument: ElectionDocumentSource = {
	id: "ga-bcn-questionnaire-documents-2026",
	stateCode: "GA",
	electionDate: "2026-11-03",
	host,
	indexUrl,
	dateMarkers: ["Election Central 2026", "Fulton County Chair", "Georgia Senate District 14"],
	policies: [{ id: "robots", url: `https://${host}/robots.txt`, format: "robots" }, { id: "index-links", url: indexUrl, format: "links" }],
	documentPatterns: publications.map(publication => `^/wp-content/uploads/2026/10/${publication.file.replaceAll(".", "\\.")}$`),
	minimumDocuments: publications.length,
	maximumDocuments: publications.length
};
