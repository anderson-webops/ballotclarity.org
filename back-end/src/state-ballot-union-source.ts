import type { StateBallotSource } from "./state-ballot-sources.js";
import type { UnionSampleCatalog } from "./union-county-ballots.js";
import { unionCandidateOrigin } from "./union-county-candidates.js";

export function unionSampleSource(catalog?: UnionSampleCatalog): StateBallotSource {
	const electionDate = catalog?.edition.electionDate ?? "2026-11-03";
	const year = electionDate.slice(0, 4);
	const day = Number(electionDate.slice(8));
	if (!/^20\d{2}-11-0[2-8]$/u.test(electionDate) || Number(year) < 2026 || new Date(`${electionDate}T00:00:00Z`).getUTCDay() !== 2) throw new Error("Union sample election date requires review.");
	const pageUrl = `${unionCandidateOrigin}/sample-ballots-for-the-november-${day}-${year}-general-election/`;
	const documentUrls = catalog ? catalog.documents.map(document => document.url) : Array.from({ length: 42 }, (_, index) => `https://ucnj.org/wp-content/uploads/2026/09/2026-UNION-GEN-samples-FORM-${index + 1}.pdf`);
	if ((catalog && catalog.edition.url !== pageUrl) || !documentUrls.length || documentUrls.length > 99 || new Set(documentUrls).size !== documentUrls.length || documentUrls.some(url => !new RegExp(`^https://ucnj\\.org/wp-content/uploads/${year}/(?:0[1-9]|1[0-2])/${year}-UNION-GEN-samples-FORM-[1-9]\\d?\\.pdf$`, "u").test(url))) throw new Error("Union sample document inventory requires review.");
	return { stateCode: "NJ", id: `nj-union-${electionDate}`, label: "Union County sample ballots", electionDate, url: pageUrl, pageUrl, format: "reviewed-pdf", retrievalPolicy: "manual-snapshot", snapshotStorage: "external", defaultPriority: -20, ballotPreview: false, countyName: "Union County", documentUrls };
}
