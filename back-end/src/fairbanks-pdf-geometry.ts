import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

interface Geometry { page: number; mediaBox: number[]; cropBox: number[]; rotation: 0; userUnit: 1 }
function object(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function requireValue(condition: unknown, detail: string): asserts condition {
	if (!condition) throw new Error(`The Fairbanks PDF geometry requires review: ${detail}.`);
}

export function inspectFairbanksPdfGeometry(body: string, kind: "sample" | "notice") {
	requireValue(typeof body === "string" && Buffer.byteLength(body) <= 4 * 1024 * 1024 && ["sample", "notice"].includes(kind), "input bounds");
	const data: unknown = JSON.parse(body);
	requireValue(object(data) && Array.isArray(data.pages) && data.pages.length > 0 && data.pages.length <= (kind === "sample" ? 4 : 20) && Array.isArray(data.qpdf) && data.qpdf.length === 2 && object(data.qpdf[1]), "page and object inventory");
	const objects = data.qpdf[1];
	requireValue(Object.keys(objects).length > 0 && Object.keys(objects).length <= 10000, "object bounds");
	const resolve = (reference: unknown) => {
		requireValue(typeof reference === "string" && /^\d+ \d+ R$/u.test(reference), "page reference");
		const entry = objects[`obj:${reference}`];
		requireValue(object(entry) && object(entry.value), "page object");
		return entry.value;
	};
	const seen = new Set<string>();
	const expected = kind === "sample" ? [0, 0, 612, 1008] : [0, 0, 792, 792];
	const pages: Geometry[] = data.pages.map((page: unknown, index) => {
		requireValue(object(page) && typeof page.object === "string" && !seen.has(page.object), "unique page identity");
		seen.add(page.object);
		const initial = resolve(page.object);
		requireValue(initial["/Type"] === "/Page", "page type");
		const inherited = (key: string): unknown => {
			let current = initial;
			const parents = new Set<Record<string, unknown>>();
			while (parents.size < 16) {
				requireValue(!parents.has(current), "cyclic page inheritance");
				parents.add(current);
				if (current[key] !== undefined) return current[key];
				if (!current["/Parent"]) return undefined;
				current = resolve(current["/Parent"]);
			}
			throw new Error("The Fairbanks PDF geometry exceeds its inheritance bounds.");
		};
		const mediaBox = inherited("/MediaBox");
		const cropBox = inherited("/CropBox") ?? mediaBox;
		const rotation = inherited("/Rotate") ?? 0;
		const userUnit = inherited("/UserUnit") ?? 1;
		requireValue(Array.isArray(mediaBox) && mediaBox.length === 4 && mediaBox.every((value, position) => typeof value === "number" && Number.isFinite(value) && value === expected[position]), "media box");
		requireValue(Array.isArray(cropBox) && cropBox.length === 4 && cropBox.every((value, position) => value === mediaBox[position]) && rotation === 0 && userUnit === 1, "crop, rotation or page units");
		return { page: index + 1, mediaBox, cropBox, rotation: 0, userUnit: 1 };
	});
	return { schemaVersion: 1 as const, objectsSha256: createHash("sha256").update(body).digest("hex"), pages };
}
