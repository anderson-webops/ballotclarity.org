import type { StateRecordsResponse } from "~/types/civic";
import { normalizeExternalHref } from "./link";

interface DocumentLink { label: string; url: string }

export function isSampleBallotDocument(document: DocumentLink) {
	return /\bsample[\s_-]*ballot\b/iu.test(`${document.label} ${document.url}`);
}

export function recordPublications(source?: StateRecordsResponse["source"]) {
	const documents = source?.documentLinks?.length ? source.documentLinks : source?.url ? [{ label: source.label ?? "Official source", url: source.url }] : [];
	return documents.flatMap((document) => {
		const url = normalizeExternalHref(document.url);
		return url ? [{ ...document, url }] : [];
	});
}

export function recordPublicationGroups(source?: StateRecordsResponse["source"]) {
	const fulton = source?.id?.startsWith("ga-fulton-");
	const groups = new Map<string, { label: string; documents: DocumentLink[] }>();
	for (const document of recordPublications(source).filter(document => !isSampleBallotDocument(document))) {
		const writeIns = fulton && /write.ins?/iu.test(document.label);
		const commission = fulton && /public service commission/iu.test(document.label);
		const label = writeIns ? "Local" : commission || /\bstatewide\b/iu.test(document.label) ? "State" : /\bfederal\b/iu.test(document.label) ? "Federal" : "Publications";
		const group = groups.get(label) ?? { label, documents: [] };
		group.documents.push({ ...document, label: writeIns ? "District 5 write-ins" : commission ? "Public Service Commission" : document.label });
		groups.set(label, group);
	}
	return ["Publications", "Federal", "State", "Local"].flatMap(label => groups.has(label) ? [groups.get(label)!] : []);
}

export function recordSourceTitle(source?: StateRecordsResponse["source"]) {
	return source?.id?.startsWith("ga-fulton-") ? "Fulton County election sources" : source?.label ?? "Election sources";
}

export function recordSourceNotice(source?: StateRecordsResponse["source"]) {
	return source?.id?.startsWith("ga-fulton-") ? "" : source?.scopeNotice ?? "";
}
