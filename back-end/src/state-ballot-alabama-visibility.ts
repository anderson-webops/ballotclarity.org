import type {
	AlabamaContent,
	AlabamaGlyph,
	AlabamaPaint,
	AlabamaStroke,
	AlabamaVisibleContent
} from "./state-ballot-alabama-types.js";

function intersects(first: number[], second: number[]) {
	return Math.min(first[2], second[2]) > Math.max(first[0], second[0]) + 0.001
		&& Math.min(first[3], second[3]) > Math.max(first[1], second[1]) + 0.001;
}
function contains(outer: number[], inner: number[]) {
	return outer[0] <= inner[0] + 0.001
		&& outer[1] <= inner[1] + 0.001
		&& outer[2] >= inner[2] - 0.001
		&& outer[3] >= inner[3] - 0.001;
}
export function resolveAlabamaVisibility(content: AlabamaContent): AlabamaVisibleContent {
	const borderErasers = [
		...content.painted,
		...content.glyphs.map(glyph => ({
			kind: "text",
			bounds: [
				Math.max(glyph.ink[0], glyph.clip[0]),
				Math.max(glyph.ink[1], glyph.clip[1]),
				Math.min(glyph.ink[2], glyph.clip[2]),
				Math.min(glyph.ink[3], glyph.clip[3])
			],
			fill: glyph.fill,
			alpha: glyph.alpha,
			blend: glyph.blend,
			operation: glyph.operation
		}))
	].filter(paint => paint.alpha !== 0 && !(paint.fill === "black" && paint.alpha === 1 && paint.blend === "/Normal"));
	const drawings: AlabamaPaint[] = [
		...content.painted,
		...content.glyphs.map(glyph => ({
			kind: "text",
			bounds: glyph.ink,
			fill: glyph.fill,
			alpha: glyph.alpha,
			blend: glyph.blend,
			overprint: glyph.overprint,
			render: glyph.render,
			operation: glyph.operation
		}))
	];
	const buckets = new Map<string, AlabamaPaint[]>();
	let references = 0;
	let comparisons = 0;
	function keys(box: number[]) {
		if (
			!Array.isArray(box)
			|| box.length !== 4
			|| box.some(value => !Number.isFinite(value) || Math.abs(value) > 1000000)
		) {
			throw new Error("Invalid native drawing bounds.");
		}
		const [left, bottom, right, top] = box.map(value => Math.floor(value / 32));
		if (right - left > 64 || top - bottom > 64) throw new Error("Drawing index extent exceeds its bounds.");
		const selected = [];
		for (let horizontal = left; horizontal <= right; horizontal++) {
			for (let vertical = bottom; vertical <= top; vertical++) selected.push(`${horizontal}:${vertical}`);
		}
		return selected;
	}
	for (const drawing of drawings) {
		for (const key of keys(drawing.bounds)) {
			if (++references > 1000000) throw new Error("Drawing index budget exceeded.");
			if (!buckets.has(key)) buckets.set(key, []);
			buckets.get(key)!.push(drawing);
		}
	}
	function touching(glyph: AlabamaGlyph) {
		const selected = new Set<AlabamaPaint>();
		for (const key of keys(glyph.ink)) {
			for (const drawing of buckets.get(key) ?? []) selected.add(drawing);
		}
		return [...selected].filter((drawing) => {
			if (++comparisons > 10000000) throw new Error("Drawing overlap budget exceeded.");
			return drawing.operation !== glyph.operation && intersects(drawing.bounds, glyph.ink);
		});
	}
	const opaqueWhite = (paint: AlabamaPaint) =>
		paint.kind === "rectangle"
		&& !paint.unknown
		&& paint.fill === "white"
		&& paint.alpha === 1
		&& paint.blend === "/Normal"
		&& !paint.overprint;
	const removed: AlabamaVisibleContent["occludedGlyphs"] = [];
	const uncertain: AlabamaVisibleContent["uncertainOverlays"] = [];
	const invisible: AlabamaVisibleContent["invisibleGlyphs"] = [];
	const glyphs = content.glyphs.filter((glyph) => {
		const overlaps = touching(glyph);
		const before = overlaps.filter(paint => paint.operation < glyph.operation);
		const background = before
			.filter(paint => opaqueWhite(paint) && contains(paint.bounds, glyph.ink))
			.sort((first, second) => second.operation - first.operation)[0];
		const earlier = before.filter(
			paint =>
				paint.operation > (background?.operation ?? -1)
				&& !(paint.fill === "white" && paint.alpha === 1 && paint.blend === "/Normal" && !paint.overprint)
		);
		glyph.backgroundProven = earlier.length === 0;
		glyph.backgroundOperation = background?.operation ?? 0;
		if (earlier.length) glyph.unresolvedBackgroundOperations = [...new Set(earlier.map(paint => paint.operation))];
		if (
			glyph.fill === "white"
			&& glyph.alpha === 1
			&& glyph.render === 0
			&& glyph.blend === "/Normal"
			&& !glyph.overprint
		) {
			if (!earlier.length) {
				invisible.push({ glyph, reason: "white-on-proved-white-background" });
				return false;
			}
		}
		const following = overlaps.filter(paint => paint.operation > glyph.operation && paint.alpha !== 0);
		const cover = following.find(paint => opaqueWhite(paint) && contains(paint.bounds, glyph.ink));
		if (cover) {
			removed.push({ glyph, cover });
			return false;
		}
		if (following.length) uncertain.push({ glyph, following });
		return true;
	});
	const visibleOperations = new Map<number, AlabamaGlyph[]>();
	for (const glyph of glyphs) {
		if (!visibleOperations.has(glyph.operation)) visibleOperations.set(glyph.operation, []);
		visibleOperations.get(glyph.operation)!.push(glyph);
	}
	const textSpans = content.textSpans.flatMap((span) => {
		const selected = visibleOperations.get(span.operation);
		if (!selected) return [];
		const visibleIndices = new Set(
			selected.flatMap(glyph =>
				Array.from({ length: glyph.character.length }, (_, index) => glyph.sourceCharacter + index)
			)
		);
		const text = [...span.text]
			.filter((character, index) => /\s/u.test(character) || visibleIndices.has(index))
			.join("")
			.trim();
		return [
			{
				...span,
				text,
				originalText: span.text,
				fontProven: selected.every(glyph => glyph.fontProven),
				occludedGlyphs: span.visibleGlyphs - selected.length,
				fullyVisible: span.sourceNonspaceGlyphs === selected.length && !span.partialGlyphs,
				glyphs: selected
			}
		];
	});
	const strokes: AlabamaStroke[] = [];
	let borderComparisons = 0;
	for (const stroke of content.strokes) {
		if (!Array.isArray(stroke.ink) || stroke.ink.length !== 4)
			throw new Error("Native stroke ink evidence is required.");
		let parts = [stroke.ink];
		for (const paint of borderErasers) {
			if (++borderComparisons > 10000000) throw new Error("Border visibility budget exceeded.");
			if (paint.operation <= stroke.operation) continue;
			parts = parts.flatMap((part) => {
				if (!intersects(part, paint.bounds)) return [part];
				const left = Math.max(part[0], paint.bounds[0]);
				const bottom = Math.max(part[1], paint.bounds[1]);
				const right = Math.min(part[2], paint.bounds[2]);
				const top = Math.min(part[3], paint.bounds[3]);
				return [
					[part[0], part[1], left, part[3]],
					[right, part[1], part[2], part[3]],
					[left, part[1], right, bottom],
					[left, top, right, part[3]]
				].filter(bounds => bounds[2] - bounds[0] > 0.001 && bounds[3] - bounds[1] > 0.001);
			});
			if (parts.length > 256) throw new Error("Stroke visibility exceeds its bounds.");
		}
		for (const ink of parts) {
			const horizontal = stroke.axis === "h";
			const start = ink[horizontal ? 0 : 1];
			const end = ink[horizontal ? 2 : 3];
			if (end - start > 5) {
				strokes.push({
					...stroke,
					ink,
					start,
					end,
					position: (ink[horizontal ? 1 : 0] + ink[horizontal ? 3 : 2]) / 2
				});
			}
		}
	}
	return {
		...content,
		glyphs,
		textSpans,
		strokes,
		occludedGlyphs: removed,
		invisibleGlyphs: invisible,
		uncertainOverlays: uncertain,
		borderErasers: borderErasers.length,
		borderComparisons,
		drawingOverlapChecks: comparisons,
		drawingIndexReferences: references,
		sourceFactsAccepted: false
	};
}
