import type { AlabamaBoundary, AlabamaCell, AlabamaTextSpan } from "./state-ballot-alabama-types.js";

const same = (first: unknown, second: unknown) => JSON.stringify(first) === JSON.stringify(second);
function connects(first: number[], second: number[]) {
	return Math.min(first[1], second[1]) >= Math.max(first[0], second[0]) - 0.001;
}
function contains(outer: number[], inner: number[]) {
	return inner[0] >= outer[0] - 0.001
		&& inner[1] >= outer[1] - 0.001
		&& inner[2] <= outer[2] + 0.001
		&& inner[3] <= outer[3] + 0.001;
}
export function proveAlabamaOfficeFrame(
	header: AlabamaCell,
	vote: AlabamaTextSpan,
	cells: AlabamaCell[]
): AlabamaBoundary | null {
	const possibilities: {
		cell: AlabamaCell;
		candidates: AlabamaTextSpan[];
		markers: AlabamaTextSpan[];
	}[] = [];
	for (const cell of cells) {
		if (
			!contains(cell.bounds, header.bounds)
			|| cell.spans.filter(span => span.text === "(Vote for One)").some(span => span.operation !== vote.operation)
		) {
			continue;
		}
		const body = cell.spans.filter(span => span.baseline < vote.baseline - 0.5);
		const markers = body.filter(span => span.originalText === "Write-in");
		const candidates = body.filter(span => span.originalText !== "Write-in");
		if (
			!markers.length
			|| !candidates.length
			|| candidates.length % 2
			|| markers.some(span => !span.fontProven)
			|| candidates.some(
				span =>
					!span.fullyVisible
					|| !span.fontProven
					|| !span.glyphs.every(glyph => contains(cell.bounds, glyph.ink))
			)
		) {
			continue;
		}
		if (
			markers.some(span => span.baseline >= candidates[candidates.length - 1].baseline)
			|| candidates.some(
				(span, index) =>
					index % 2 === 1
					&& !["democrat", "republican", "independent", "libertarian"].includes(span.text.toLowerCase())
			)
		) {
			continue;
		}
		possibilities.push({ cell, candidates, markers });
	}
	const groups = new Map<string, typeof possibilities>();
	for (const item of possibilities) {
		const key = JSON.stringify(item.candidates.map(span => span.operation));
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key)!.push(item);
	}
	if (groups.size !== 1) return null;
	const alternatives = [...groups.values()][0].sort(
		(first, second) =>
			(first.cell.bounds[2] - first.cell.bounds[0]) * (first.cell.bounds[3] - first.cell.bounds[1])
			- (second.cell.bounds[2] - second.cell.bounds[0]) * (second.cell.bounds[3] - second.cell.bounds[1])
	);
	const { cell, candidates, markers } = alternatives[0];
	return {
		schemaVersion: 1,
		method: "closed-source-office-frame",
		headerBounds: header.bounds,
		closingFrame: {
			bounds: cell.bounds,
			borders: cell.borders,
			sourceOperations: cell.spans.map(span => span.operation)
		},
		boundary: { bounds: cell.bounds, borders: cell.borders, markerOperations: markers.map(span => span.operation) },
		markerTextVisibilityUsedAsFact: false,
		candidateSpans: candidates
	};
}
export function proveAlabamaOfficeRows(header: AlabamaCell, cells: AlabamaCell[]): AlabamaBoundary | null {
	if (!header?.borders) return null;
	const visited = new Set<string>();
	const rows: AlabamaCell[] = [];
	let current = header;
	for (let step = 0; step < 100; step++) {
		const candidates = cells.filter(
			cell =>
				cell !== current
				&& cell.bounds[1] < current.bounds[1] - 0.001
				&& same(cell.borders.top, current.borders.bottom)
				&& connects(cell.borders.left, current.borders.left)
				&& connects(cell.borders.right, current.borders.right)
		);
		const groups = new Map<string, AlabamaCell[]>();
		for (const cell of candidates) {
			const key = JSON.stringify([cell.borders.bottom, cell.borders.top, cell.spans.map(span => span.operation)]);
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(cell);
		}
		if (groups.size !== 1) return null;
		const alternatives = [...groups.values()][0];
		alternatives.sort(
			(first, second) =>
				Math.abs(first.bounds[0] - current.bounds[0])
				+ Math.abs(first.bounds[2] - current.bounds[2])
				- Math.abs(second.bounds[0] - current.bounds[0])
				- Math.abs(second.bounds[2] - current.bounds[2])
		);
		const row = alternatives[0];
		const key = JSON.stringify(row.bounds);
		if (visited.has(key)) throw new Error("The Alabama source row graph contains a cycle.");
		visited.add(key);
		const markers = row.spans.filter(span => span.originalText === "Write-in");
		if (
			markers.length
			&& row.spans.every(span => span.originalText === "Write-in")
			&& markers.every(span => span.fontProven)
			&& rows.length
		) {
			return {
				schemaVersion: 1,
				method: "closed-source-row-geometry",
				headerBounds: header.bounds,
				rows: rows.map(cell => ({
					bounds: cell.bounds,
					borders: cell.borders,
					sourceOperations: cell.spans.map(span => span.operation)
				})),
				closingRow: {
					bounds: row.bounds,
					borders: row.borders,
					markerOperations: markers.map(span => span.operation)
				},
				boundary: {
					bounds: row.bounds,
					borders: row.borders,
					markerOperations: markers.map(span => span.operation)
				},
				markerTextVisibilityUsedAsFact: false,
				candidateSpans: rows.flatMap(cell => cell.spans)
			};
		}
		if (
			row.spans.length !== 2
			|| row.spans.some(
				span =>
					!span.fullyVisible
					|| !span.fontProven
					|| !span.glyphs.every(glyph => contains(row.bounds, glyph.ink))
			)
			|| !["democrat", "republican", "independent", "libertarian"].includes(row.spans[1].text.toLowerCase())
		) {
			return null;
		}
		rows.push(row);
		current = row;
	}
	throw new Error("The Alabama source row graph exceeds its bounds.");
}
