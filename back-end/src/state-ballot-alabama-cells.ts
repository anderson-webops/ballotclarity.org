import type { AlabamaCell, AlabamaContent, AlabamaStroke } from "./state-ballot-alabama-types.js";

export function alabamaCells(
	content: Pick<AlabamaContent, "strokes" | "textSpans">,
	includeNested = false
): AlabamaCell[] {
	const merged: (AlabamaStroke & {
		band: number[];
	})[] = [];
	let joiningOperations = 0;
	const bridgeIndices = new Map<
		"h" | "v",
		{
			entries: {
				ink: number[];
				start: number;
				end: number;
			}[];
			maximumSpan: number;
		}
	>(
		["h", "v"].map((axis) => {
			const horizontal = axis === "h";
			const entries = content.strokes
				.filter(stroke => stroke.axis !== axis)
				.map(stroke => ({
					ink: stroke.ink,
					start: stroke.ink[horizontal ? 0 : 1],
					end: stroke.ink[horizontal ? 2 : 3]
				}))
				.sort((first, second) => first.start - second.start);
			return [
				axis as "h" | "v",
				{ entries, maximumSpan: entries.reduce((maximum, item) => Math.max(maximum, item.end - item.start), 0) }
			];
		})
	);
	const bridgeCache = new Map<string, boolean>();
	const bridge = (axis: "h" | "v", start: number, end: number, band: number[]): boolean => {
		if (end - start < 0.001) return true;
		const horizontal = axis === "h";
		const key = JSON.stringify([axis, start, end, band]);
		if (bridgeCache.has(key)) return bridgeCache.get(key)!;
		const intervals: number[][] = [];
		const { entries, maximumSpan } = bridgeIndices.get(axis)!;
		let lower = 0;
		let upper = entries.length;
		while (lower < upper) {
			const middle = Math.floor((lower + upper) / 2);
			if (entries[middle].start < start - maximumSpan - 0.001) lower = middle + 1;
			else upper = middle;
		}
		for (let index = lower; index < entries.length && entries[index].start <= end + 0.001; index++) {
			if (++joiningOperations > 2000000) throw new Error("Cell joining exceeds its bounds.");
			const ink = entries[index].ink;
			if (
				ink[horizontal ? 1 : 0] > band[0] + 0.001
				|| ink[horizontal ? 3 : 2] < band[1] - 0.001
				|| ink[horizontal ? 2 : 3] < start
				|| ink[horizontal ? 0 : 1] > end
			) {
				continue;
			}
			intervals.push([ink[horizontal ? 0 : 1], ink[horizontal ? 2 : 3]]);
		}
		let position = start;
		for (const interval of intervals.sort((first, second) => first[0] - second[0])) {
			if (interval[0] > position + 0.001) break;
			position = Math.max(position, interval[1]);
			if (position >= end - 0.001) {
				bridgeCache.set(key, true);
				return true;
			}
		}
		bridgeCache.set(key, false);
		return false;
	};
	for (const stroke of content.strokes) {
		const horizontal = stroke.axis === "h";
		const band = [stroke.ink[horizontal ? 1 : 0], stroke.ink[horizontal ? 3 : 2]];
		const edge = merged.find((edge) => {
			if (edge.axis !== stroke.axis || Math.min(edge.band[1], band[1]) <= Math.max(edge.band[0], band[0]))
				return false;
			const joined = [Math.max(edge.band[0], band[0]), Math.min(edge.band[1], band[1])];
			return (
				(edge.start <= stroke.end + 0.001 && edge.end >= stroke.start - 0.001)
				|| bridge(stroke.axis, Math.min(edge.end, stroke.end), Math.max(edge.start, stroke.start), joined)
			);
		});
		if (edge) {
			edge.start = Math.min(edge.start, stroke.start);
			edge.end = Math.max(edge.end, stroke.end);
			edge.band = [Math.max(edge.band[0], band[0]), Math.min(edge.band[1], band[1])];
			edge.position = (edge.band[0] + edge.band[1]) / 2;
		}
		else {
			merged.push({ ...stroke, band });
		}
	}
	const vertical = merged.filter(edge => edge.axis === "v").sort((first, second) => first.position - second.position);
	const horizontal = merged
		.filter(edge => edge.axis === "h")
		.sort((first, second) => first.position - second.position);
	if (vertical.length > 1000 || horizontal.length > 1000) throw new Error("Cell edge budget exceeded.");
	const cells: {
		bounds: number[];
		borders: AlabamaCell["borders"];
	}[] = [];
	let operations = 0;
	for (const left of vertical) {
		const bottoms = horizontal.filter(
			edge =>
				edge.band[1] >= left.start - 0.001
				&& edge.band[0] <= left.end + 0.001
				&& edge.start <= left.band[1] + 0.001
				&& edge.end > left.band[0] + 10
		);
		for (const [index, bottom] of bottoms.entries()) {
			let found = false;
			for (const top of bottoms.slice(index + 1)) {
				for (const right of vertical.filter(edge => edge.position > left.position + 10)) {
					if (++operations > 200000) throw new Error("Cell geometry budget exceeded.");
					if (
						right.start <= bottom.band[1] + 0.001
						&& right.end >= top.band[0] - 0.001
						&& bottom.end >= right.band[0] - 0.001
						&& top.end >= right.band[0] - 0.001
					) {
						cells.push({
							bounds: [left.position, bottom.position, right.position, top.position],
							borders: {
								left: [...left.band],
								bottom: [...bottom.band],
								right: [...right.band],
								top: [...top.band]
							}
						});
						found = true;
						break;
					}
				}
				if (found) break;
			}
		}
	}
	const unique = [
		...new Map(cells.map(cell => [cell.bounds.map(value => value.toFixed(2)).join("/"), cell])).values()
	];
	const selected = includeNested
		? unique
		: unique.filter(
				cell =>
					unique.filter(
						other =>
							other !== cell
							&& other.bounds[0] >= cell.bounds[0] - 0.1
							&& other.bounds[1] >= cell.bounds[1] - 0.1
							&& other.bounds[2] <= cell.bounds[2] + 0.1
							&& other.bounds[3] <= cell.bounds[3] + 0.1
					).length < 2
			);
	if (!selected.length || selected.length > 500) throw new Error("Cell count requires review.");
	return selected
		.map(({ bounds, borders }) => {
			const spans = content.textSpans
				.filter((span) => {
					const horizontal = (span.bounds[0] + span.bounds[2]) / 2;
					const vertical = (span.bounds[1] + span.bounds[3]) / 2;
					return (
						horizontal > bounds[0] - 0.2
						&& horizontal < bounds[2] + 0.2
						&& vertical > bounds[1] - 0.2
						&& vertical < bounds[3] + 0.2
					);
				})
				.sort((first, second) => second.baseline - first.baseline || first.bounds[0] - second.bounds[0]);
			return { bounds, borders, spans, text: spans.map(span => span.text).join("\n") };
		})
		.sort((first, second) => first.bounds[0] - second.bounds[0] || second.bounds[3] - first.bounds[3]);
}
