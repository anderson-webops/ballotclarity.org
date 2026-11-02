import type { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

export const alabamaHash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export type AlabamaPdfDictionary = Record<string, unknown>;
export interface AlabamaPdfObject {
	value?: unknown;
	stream?: {
		dict: AlabamaPdfDictionary;
		data: string;
	};
}
export interface AlabamaPdfDocument {
	version: number;
	qpdf: [
		{
			jsonversion: number;
			calledgetallpages: boolean;
		},
		Record<string, AlabamaPdfObject>
	];
	pages: {
		object: string;
		contents: string[];
	}[];
	encrypt: {
		encrypted: boolean;
	};
	attachments: Record<string, unknown>;
	acroform: {
		needappearances: boolean;
		fields: unknown[];
	};
}
export interface AlabamaObjectProof {
	objects: number;
	visited: number;
	decodedStreamBytes: number;
	pageCount: number;
	fontResources: number;
	emptyFormVerified: boolean;
	actionsAndAnnotationsAbsent: boolean;
}
export type AlabamaToken
	= | {
		kind: "operator" | "name";
		value: string;
	}
	| {
		kind: "number";
		value: number;
	}
	| {
		kind: "bytes";
		bytes: Buffer;
	}
	| {
		kind: "array";
		values: AlabamaToken[];
	}
	| {
		kind: "dictionary";
		entries: [string, AlabamaToken][];
	}
	| { kind: "close-array" | "close-dictionary" };
export interface AlabamaFontGlyph {
	character: string;
	unicode: number;
	glyph: number;
	units: number;
	ink: number[] | null;
	outline: Buffer;
	fontProven?: boolean;
	signature?: string;
	fontProofError?: string;
}
export interface AlabamaGlyph {
	character: string;
	font: string;
	fontParsed: boolean;
	fontProven: boolean;
	fontProofError?: string;
	ink: number[];
	origin: number[];
	clip: number[];
	clipped: boolean;
	fill: string;
	alpha: number;
	blend: string;
	overprint: boolean;
	render: number;
	operation: number;
	sourceCharacter: number;
	backgroundProven?: boolean;
	backgroundOperation?: number;
	unresolvedBackgroundOperations?: number[];
}
export interface AlabamaPaint {
	kind: string;
	bounds: number[];
	operation: number;
	geometry?: string;
	unknown?: boolean;
	fill?: string;
	alpha?: number;
	blend?: string;
	overprint?: boolean;
	colorSpace?: string;
	render?: number;
}
export interface AlabamaStroke {
	axis: "h" | "v";
	position: number;
	start: number;
	end: number;
	ink: number[];
	lineWidth: number;
	overprint: boolean;
	colorSpace: string;
	operation: number;
}
export interface AlabamaTextSpan {
	text: string;
	originalText?: string;
	operation: number;
	sourceNonspaceGlyphs: number;
	visibleGlyphs: number;
	partialGlyphs: number;
	fontParsed: boolean;
	fontProven: boolean;
	font: string;
	clip: number[];
	bounds: number[];
	baseline: number;
	occludedGlyphs?: number;
	fullyVisible?: boolean;
	glyphs: AlabamaGlyph[];
}
export interface AlabamaContent {
	glyphs: AlabamaGlyph[];
	painted: AlabamaPaint[];
	strokes: AlabamaStroke[];
	textSpans: AlabamaTextSpan[];
	operatorCounts: Record<string, number>;
	totalGlyphs: number;
	hiddenGlyphs: number;
	partialGlyphs: number;
	fontPrograms: number;
	fontResources: number;
	objectProof: AlabamaObjectProof;
	sourceFactsAccepted: false;
}
export interface AlabamaVisibleContent extends AlabamaContent {
	occludedGlyphs: {
		glyph: AlabamaGlyph;
		cover: AlabamaPaint;
	}[];
	invisibleGlyphs: {
		glyph: AlabamaGlyph;
		reason: string;
	}[];
	uncertainOverlays: {
		glyph: AlabamaGlyph;
		following: AlabamaPaint[];
	}[];
	borderErasers: number;
	borderComparisons: number;
	drawingOverlapChecks: number;
	drawingIndexReferences: number;
}
export interface AlabamaBorders {
	left: number[];
	bottom: number[];
	right: number[];
	top: number[];
}
export interface AlabamaCell {
	bounds: number[];
	borders: AlabamaBorders;
	spans: AlabamaTextSpan[];
	text: string;
}
export interface AlabamaBoundary {
	schemaVersion: number;
	method: string;
	headerBounds: number[];
	rows?: {
		bounds: number[];
		borders: AlabamaBorders;
		sourceOperations: number[];
	}[];
	closingFrame?: {
		bounds: number[];
		borders: AlabamaBorders;
		sourceOperations: number[];
	};
	closingRow?: {
		bounds: number[];
		borders: AlabamaBorders;
		markerOperations: number[];
	};
	boundary: {
		bounds: number[];
		borders: AlabamaBorders;
		markerOperations: number[];
	};
	markerTextVisibilityUsedAsFact: false;
	candidateSpans?: AlabamaTextSpan[];
}
export interface AlabamaOfficeContext {
	office: string;
	district: string;
	scope: "statewide" | "congressional" | "state-house" | "state-senate" | "local" | "state-board-of-education";
	jurisdiction?: string;
}
export interface AlabamaField {
	vote: AlabamaTextSpan;
	heading: string;
	bounds: number[];
	cell: AlabamaCell;
	spans: AlabamaTextSpan[];
	holdReason: string | null;
	terminator?: number;
	boundaryProof?: AlabamaBoundary;
}
export interface AlabamaSourceIdentity {
	county: string;
	electionDate: string;
	sourceUrl: string;
	sourceSha256: string;
}
export interface AlabamaDrawingProof {
	schemaVersion: number;
	method: string;
	region: number[];
	paintOperationsChecked: number;
	unparsedImagesOrTextAccepted: false;
}
export interface AlabamaCandidateClaim extends AlabamaSourceIdentity, AlabamaOfficeContext {
	id: string;
	stateCode: "AL";
	name: string;
	party: string;
	recordRole: "printed-sample-ballot-claim";
	pageNumber: number;
	sourceOfficeHeading: string;
	officeRuleOperation: number;
	terminatorOperation: number;
	boundaryMethod: string;
	boundaryProof?: AlabamaBoundary;
	fieldDrawingProof: AlabamaDrawingProof;
	sourceOperations: number[];
	reviewStatus: string;
	individualApplicabilityVerified: false;
}
export interface AlabamaHeldField {
	sourceOfficeHeading: string;
	officeRuleOperation: number;
	bounds: number[];
	sourceOperations: number[];
	reason: string;
	printedPartyRows: number;
	applicationImportApproved: false;
	publicationApproved: false;
}
export interface AlabamaNativeReview extends AlabamaSourceIdentity {
	schemaVersion: number;
	type: "alabama-native-ballot-draft";
	records: AlabamaCandidateClaim[];
	excluded: {
		kind: string;
		heading: string;
		headerOperation: number;
	}[];
	heldFields: AlabamaHeldField[];
	nativeFieldsComplete: boolean;
	officeFields: number;
	candidateOfficeFields: number;
	applicationImportApproved: false;
	publicationApproved: false;
	recurringCollectionApproved: false;
}
