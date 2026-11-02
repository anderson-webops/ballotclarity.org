import type { AlabamaReferenceCapture } from "../../src/state-ballot-alabama-discovery.js";
import type { AlabamaNativeVerification } from "../../src/state-ballot-alabama-native.js";
import type {
	AlabamaCandidateClaim,
	AlabamaNativeReview,
	AlabamaSourceIdentity
} from "../../src/state-ballot-alabama-types.js";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { alabamaDiscoveryUrl } from "../../src/state-ballot-alabama-discovery.js";
import { officeContext } from "../../src/state-ballot-alabama-records.js";
import { alabamaOrigin } from "../../src/state-ballot-alabama-source.js";
import { alabamaHash } from "../../src/state-ballot-alabama-types.js";

export const alabamaFixturePdf = Buffer.from("%PDF-Synthetic Alabama fixture");
const { body: robots }: { body: string } = JSON.parse(
	readFileSync(new URL("../fixtures/alabama-robots.json", import.meta.url), "utf8")
);
export function alabamaCaptureFixture(year = 2026, day = 3): AlabamaReferenceCapture {
	const annual = `${alabamaDiscoveryUrl}/${year}`;
	const sample = `${alabamaOrigin}/alabama-votes/${year}-general-election-sample-ballots`;
	const prefix = `${alabamaOrigin}/sites/default/files/sample-ballots/${year}/gen/`;
	const rows: [string, string][] = [
		[`${alabamaOrigin}/robots.txt`, robots],
		[alabamaDiscoveryUrl, `<main><a href="${annual}">${year}</a></main>`],
		[
			annual,
			`<main><h2>General Election – November ${day}, ${year}</h2><a href="${sample}">Sample Ballots</a>${["Democratic Party Candidates", "Republican Party Candidates", "Constitutional Amendments"].map((label, index) => `<a href="/sites/default/files/election-${year}/certification${index}.pdf">State Certification of ${label}</a>`).join("")}</main>`
		],
		[
			sample,
			`<main><h1>${year} General Election Sample Ballots</h1><a href="${prefix}${year}GeneralElectionStatewideBack.pdf">Statewide amendments</a><table><tr>${["Macon", "Montgomery", "Jefferson"].map(county => `<td><a href="${prefix}${county}-Sample.pdf">${county}</a></td>`).join("")}</tr></table></main>`
		]
	];
	return {
		schemaVersion: 1,
		type: "alabama-election-reference-capture",
		documents: rows.map(([url, body]) => ({
			url,
			body,
			sha256: alabamaHash(body),
			capturedAt: "2026-11-02T12:00:00.000Z"
		}))
	};
}
export function alabamaVerificationFixture(input: AlabamaSourceIdentity): AlabamaNativeVerification {
	const claims = [
		["FOR GOVERNOR", "ALPHA CANDIDATE", "Democrat"],
		["FOR MEMBER, STATE BOARD OF EDUCATION, DISTRICT NO. 2", "BETA CANDIDATE", "Republican"]
	];
	const records: AlabamaCandidateClaim[] = claims.map(([heading, name, party], index) => {
		const context = officeContext(heading, input.county);
		const id = alabamaHash(
			JSON.stringify([
				"AL",
				input.electionDate,
				context.office.toLowerCase(),
				context.district,
				name.toLowerCase(),
				party.toLowerCase(),
				context.jurisdiction?.toLowerCase() ?? ""
			])
		).slice(0, 24);
		return {
			...input,
			...context,
			id,
			stateCode: "AL",
			name,
			party,
			recordRole: "printed-sample-ballot-claim",
			pageNumber: 1,
			sourceOfficeHeading: heading,
			officeRuleOperation: index * 10 + 1,
			terminatorOperation: index * 10 + 4,
			boundaryMethod: "synthetic-fixture",
			fieldDrawingProof: {
				schemaVersion: 1,
				method: "synthetic-fixture",
				region: [0, 0, 10, 10],
				paintOperationsChecked: 0,
				unparsedImagesOrTextAccepted: false
			},
			sourceOperations: [index * 10 + 2, index * 10 + 3],
			reviewStatus: "native-draft-awaiting-independent-proof",
			individualApplicabilityVerified: false
		};
	});
	const result: AlabamaNativeReview = {
		...input,
		schemaVersion: 1,
		type: "alabama-native-ballot-draft",
		records,
		excluded: [],
		heldFields: [],
		nativeFieldsComplete: true,
		officeFields: 2,
		candidateOfficeFields: 2,
		applicationImportApproved: false,
		publicationApproved: false,
		recurringCollectionApproved: false
	};
	return {
		result,
		proof: {
			schemaVersion: 1,
			type: "alabama-original-native-verification",
			sourceSha256: input.sourceSha256,
			reviewSha256: alabamaHash(JSON.stringify(result)),
			objectsSha256: "1".repeat(64),
			objectProof: {
				objects: 5,
				visited: 10,
				decodedStreamBytes: 100,
				pageCount: 1,
				fontResources: 1,
				emptyFormVerified: true,
				actionsAndAnnotationsAbsent: true
			},
			glyphs: 100,
			drawingOverlapChecks: 0,
			borderComparisons: 0,
			fullyAccountedFields: 2,
			sourceFactsAccepted: false
		}
	};
}
