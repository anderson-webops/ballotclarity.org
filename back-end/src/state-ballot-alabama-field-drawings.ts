import type {
	AlabamaDrawingProof,
	AlabamaField,
	AlabamaTextSpan,
	AlabamaVisibleContent
} from "./state-ballot-alabama-types.js";

function intersects(first: number[], second: number[]) {
	return Math.min(first[2], second[2]) > Math.max(first[0], second[0]) + 0.001
		&& Math.min(first[3], second[3]) > Math.max(first[1], second[1]) + 0.001;
}
export function proveAlabamaFieldDrawings(
	content: AlabamaVisibleContent,
	field: AlabamaField,
	spans: AlabamaTextSpan[]
): AlabamaDrawingProof {
	const candidateLeft = Math.min(
		...spans.filter((span, index) => index % 2 === 0).flatMap(span => span.glyphs.map(glyph => glyph.ink[0]))
	);
	const marker = content.textSpans?.find(span => span.operation === field.terminator);
	const bottom
		= field.boundaryProof?.boundary.bounds[1]
			?? marker?.bounds[1]
			?? Math.min(...spans.flatMap(span => span.glyphs.map(glyph => glyph.ink[1])));
	const region = [field.cell.borders.left[1], bottom, field.cell.borders.right[0], field.cell.borders.top[0]];
	let checked = 0;
	for (const paint of content.painted) {
		if (!intersects(paint.bounds, region)) continue;
		checked++;
		const white = paint.fill === "white" && paint.alpha === 1 && paint.blend === "/Normal" && !paint.overprint;
		const axis
			= paint.kind === "stroke"
				&& paint.geometry !== undefined
				&& ["horizontal", "vertical"].includes(paint.geometry)
				&& paint.fill === "black"
				&& paint.alpha === 1
				&& paint.blend === "/Normal";
		const choiceGutter
			= ["path", "rectangle", "stroke"].includes(paint.kind)
				&& paint.bounds[2] < candidateLeft - 0.001
				&& paint.bounds[3] < field.vote.baseline
				&& paint.bounds[0] >= field.bounds[0] - 0.001
				&& paint.fill === "black"
				&& paint.alpha === 1
				&& paint.blend === "/Normal";
		if (!white && !axis && !choiceGutter) throw new Error("An unparsed drawing overlaps the Alabama office field.");
	}
	if (content.glyphs.some(glyph => !glyph.fontProven && intersects(glyph.ink, region)))
		throw new Error("Unproved text overlaps the Alabama office field.");
	return {
		schemaVersion: 1,
		method: "bounded-office-paint-inventory",
		region,
		paintOperationsChecked: checked,
		unparsedImagesOrTextAccepted: false
	};
}
