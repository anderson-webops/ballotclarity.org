import type { ChicagoQuestion } from "./state-ballot-chicago.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { createHash } from "node:crypto";
import { chicagoDiscoveryUrl, chicagoDocumentDigest, validateChicagoDocumentUrl, validateChicagoSource } from "./state-ballot-chicago-collection.js";
import { containsControlCharacters } from "./text-validation.js";

export function readChicagoSnapshotMetadata(source: StateBallotSource, data: Record<string, unknown>) {
	validateChicagoSource(source);
	if (typeof data.sourceAsOfDate !== "string" || !/^20\d{2}-\d{2}-\d{2}$/u.test(data.sourceAsOfDate) || !Number.isFinite(Date.parse(data.sourceAsOfDate)) || new Date(data.sourceAsOfDate).toISOString().slice(0, 10) !== data.sourceAsOfDate || data.sourceAsOfDate.slice(0, 4) !== source.electionDate.slice(0, 4) || data.sourceAsOfDate > source.electionDate || typeof data.retrievedAt !== "string" || data.sourceAsOfDate > data.retrievedAt.slice(0, 10) || typeof data.sourceAsOf !== "string") throw new Error("The Chicago stored source date is invalid.");
	const asOf = /^(\d{1,2})\/(\d{1,2})\/(20\d{2}) (?:[1-9]|1[0-2]):[0-5]\d:[0-5]\d [AP]M$/u.exec(data.sourceAsOf);
	if (!asOf || `${asOf[3]}-${asOf[1]!.padStart(2, "0")}-${asOf[2]!.padStart(2, "0")}` !== data.sourceAsOfDate) throw new Error("The Chicago stored civil timestamp disagrees with its date.");
	if (!Array.isArray(data.documents) || data.documents.length !== 1) throw new Error("The Chicago stored document inventory is invalid.");
	const document = data.documents[0];
	if (!document || typeof document !== "object" || typeof document.url !== "string" || typeof document.sha256 !== "string") throw new Error("The Chicago stored publication is invalid.");
	validateChicagoDocumentUrl(document.url);
	if (data.collectionIndexSha256 !== chicagoDocumentDigest([{ kind: "general", url: document.url, sha256: document.sha256 }]) || source.pageUrl !== chicagoDiscoveryUrl) throw new Error("The Chicago stored publication digest is invalid.");
	if (!Array.isArray(data.ballotQuestions) || !data.ballotQuestions.length || data.ballotQuestions.length > 300) throw new Error("The Chicago stored questions exceed their bounds.");
	const questions = data.ballotQuestions.map((value: unknown) => {
		if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== "audience,choices,explicitlyAdvisory,id,officialText,pages,title,voterApplicabilityVerified") throw new Error("The Chicago stored question fields are invalid.");
		const item = value as Record<string, unknown>;
		for (const [key, maximum] of [["audience", 300], ["title", 350], ["officialText", 5000]] as const) {
			if (typeof item[key] !== "string" || !item[key].trim() || item[key].length > maximum || containsControlCharacters(item[key])) throw new Error("The Chicago stored question text is invalid.");
		}
		const pages = item.pages;
		if (!String(item.audience).startsWith("To the Voters of ") || !String(item.audience).endsWith(":") || item.voterApplicabilityVerified !== false || item.explicitlyAdvisory !== String(item.title).startsWith("ADVISORY QUESTION") || JSON.stringify(item.choices) !== "[\"Yes\",\"No\"]" || !Array.isArray(pages) || !pages.length || pages.length > 50 || pages.some((page, index) => !Number.isInteger(page) || page < 1 || page > 50 || (index > 0 && page <= pages[index - 1]))) throw new Error("The Chicago stored question audience or choices are invalid.");
		const id = createHash("sha256").update(JSON.stringify([source.id, source.electionDate, item.audience, item.officialText])).digest("hex").slice(0, 24);
		if (item.id !== id) throw new Error("The Chicago stored question identity is invalid.");
		return item as unknown as ChicagoQuestion;
	});
	if (new Set(questions.map(item => item.id)).size !== questions.length) throw new Error("The Chicago stored question identities repeat.");
	return { ballotQuestions: questions, sourceAsOfDate: data.sourceAsOfDate, sourceAsOf: data.sourceAsOf };
}
