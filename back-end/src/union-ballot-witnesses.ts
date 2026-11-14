import type { UnionSampleCatalog, UnionSampleDocument } from "./union-county-ballots.js";
import type { UnionCandidateReference } from "./union-county-candidates.js";
import { Buffer } from "node:buffer";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";

const canonical = (value: string) => value.normalize("NFKC").toLocaleUpperCase("en-US").replace(/[^\p{L}\p{N}]/gu, "");
interface Word { value: string; left: number; right: number; top: number; bottom: number }
export interface UnionBallotCell { page: number; position: string; observedName: string; nameWordCount: number }
function reject(): never {
	throw new Error("The Union County visible sample-ballot evidence requires review.");
}
export function readUnionBallotCells(body: string, layout: string, document: UnionSampleDocument, electionDate: string) {
	if (Buffer.byteLength(body) > 4 * 1024 * 1024 || Buffer.byteLength(layout) > 4 * 1024 * 1024 || !/^20\d{2}-11-0[2-8]$/u.test(electionDate)) return reject();
	const date = `NOVEMBER ${Number(electionDate.slice(8))}, ${electionDate.slice(0, 4)}`;
	const visible = layout.normalize("NFKC").toLocaleUpperCase("en-US");
	const forms = [...visible.matchAll(/\bFORM\s+(\d{1,2})\b/gu)].map(match => Number(match[1]));
	if (!forms.length || forms.some(form => form !== document.form) || !canonical(visible).includes(canonical("OFFICIAL GENERAL ELECTION SAMPLE BALLOT")) || !canonical(visible).includes(canonical(`USED ON ${date}`)) || !canonical(visible).includes("UNIONCOUNTYNEWJERSEY")) return reject();
	const municipalities = [...new Set(document.claims.map(claim => claim.municipality))];
	if (municipalities.length !== 1 || !canonical(visible).includes(canonical(municipalities[0]!))) return reject();
	const pages = descendants(parseStateHtml(body), node => node.nodeName === "page");
	if (pages.length !== 1 || layout.split("\f").filter(page => page.trim()).length !== 1) return reject();
	const page = pages[0]!;
	const width = Number(attribute(page, "width"));
	const height = Number(attribute(page, "height"));
	if (width !== 1824 || height !== 1284) return reject();
	const words = descendants(page, node => node.nodeName === "word").map((node): Word => {
		const word = { value: stateHtmlText(node).trim(), left: Number(attribute(node, "xmin")), right: Number(attribute(node, "xmax")), top: Number(attribute(node, "ymin")), bottom: Number(attribute(node, "ymax")) };
		if (!word.value || word.value.length > 500 || ![word.left, word.right, word.top, word.bottom].every(Number.isFinite) || word.left < 0 || word.right > width || word.top < 0 || word.bottom > height || word.left >= word.right || word.top >= word.bottom) return reject();
		return word;
	});
	if (!words.length || words.length > 20000) return reject();
	const header = words.filter(word => word.top < 220).map(word => word.value).join(" ");
	if (!canonical(header).includes(canonical(`USED ON ${date}`)) || !canonical(header).includes(canonical(municipalities[0]!))) return reject();
	const markers = words.filter(word => /^\d{1,2}(?:[A-Z]|-\d{1,2})$/u.test(word.value) && word.top > 240 && word.bottom < 1030 && word.bottom - word.top > 10 && word.bottom - word.top < 24);
	if (!markers.length || markers.length > 150) return reject();
	const cells: UnionBallotCell[] = [];
	for (const marker of markers) {
		const selected = words.filter(word => word.left >= marker.left - 140 && word.right <= marker.left + 1 && word.top >= marker.top - 12 && word.top <= marker.bottom && [12.5, 18.75].some(size => Math.abs(word.bottom - word.top - size) < 0.05)).sort((left, right) => left.top - right.top || left.left - right.left);
		if (selected.some(word => !canonical(visible).includes(canonical(word.value)))) return reject();
		const observedName = selected.map(word => word.value).join(" ");
		if (observedName.length > 250) return reject();
		cells.push({ page: 1, position: marker.value, observedName, nameWordCount: selected.length });
	}
	return cells;
}

export function reconcileUnionBallotReferences(references: (UnionCandidateReference & { kind: "general" | "school"; electionDate: string })[], catalog: UnionSampleCatalog, samples: { form: number; cells: UnionBallotCell[]; sourceUrl: string; sourceSha256: string; capturedAt: string }[]) {
	if (!references.length || references.length > 2000 || new Set(samples.map(sample => sample.form)).size !== samples.length || samples.length !== catalog.documents.length || catalog.documents.some(document => !samples.some(sample => sample.form === document.form && sample.sourceUrl === document.url))) return reject();
	return references.map((reference) => {
		if (reference.electionDate !== catalog.edition.electionDate || !["general", "school"].includes(reference.kind) || !reference.name || !/^\d{1,2}(?:[A-Z]|-\d{1,2})$/u.test(reference.position)) return reject();
		const area = reference.jurisdictionLabel.replace(/^(?:TOWNSHIP|TOWN|CITY|BOROUGH) OF /u, "");
		const relevant = catalog.documents.filter(document => reference.jurisdictionLabel === "UNION COUNTY" || document.claims.some(claim => canonical(claim.municipality) === canonical(area)));
		if (!relevant.length) return reject();
		const positionEvidence = relevant.flatMap((document) => {
			const sample = samples.find(sample => sample.form === document.form)!;
			return sample.cells.filter(cell => cell.position === reference.position).map(cell => ({ form: document.form, page: cell.page, position: cell.position, observedName: cell.observedName, sourceUrl: sample.sourceUrl, sourceSha256: sample.sourceSha256, capturedAt: sample.capturedAt, publishedLabels: document.claims }));
		});
		const witnesses = positionEvidence.filter(cell => canonical(cell.observedName) === canonical(reference.name));
		return { reference, status: witnesses.length ? "name-and-position-corroborated" : "review-required", witnesses, reviewReason: witnesses.length ? null : positionEvidence.some(cell => cell.observedName) ? "different-visible-name-at-position" : "no-visible-name-at-position", positionEvidence: witnesses.length ? [] : positionEvidence, applicableSampleFormsReviewed: relevant.map(document => document.form), officeAndPartyVerified: false, qualificationVerified: false, personalApplicabilityVerified: false, publicationApproved: false };
	});
}
