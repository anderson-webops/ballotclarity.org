import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml } from "./state-ballot-html.js";
import { winnebagoNativePages } from "./state-ballot-winnebago-native.js";

const hash = (body: string) => createHash("sha256").update(body).digest("hex");
const colors = ["rgb(0%, 0%, 0%)", "rgb(0%, 0%, 100%)", "rgb(100%, 0%, 0%)"];
function reject(): never {
	throw new Error("The Winnebago rendered/native PDF inventory requires review.");
}

export function winnebagoGlyphBounds(definition: string) {
	if (definition.length > 50000 || /[^MLCZ\d\s+.,-]/u.test(definition)) return reject();
	const tokens = definition.match(/[MLCZ]|[-+]?(?:\d+\.?\d*|\.\d+)/gu) ?? [];
	if (tokens[0] !== "M") return reject();
	const points: number[][] = [];
	let position = [0, 0];
	let start = [0, 0];
	function curve(first: number, controlOne: number, controlTwo: number, last: number) {
		const times = [0, 1];
		const coefficient = -first + 3 * controlOne - 3 * controlTwo + last;
		const middle = 2 * (first - 2 * controlOne + controlTwo);
		const constant = controlOne - first;
		if (Math.abs(coefficient) < 1e-12) {
			if (middle) times.push(-constant / middle);
		}
		else {
			const determinant = middle * middle - 4 * coefficient * constant;
			if (determinant >= 0) times.push((-middle + Math.sqrt(determinant)) / (2 * coefficient), (-middle - Math.sqrt(determinant)) / (2 * coefficient));
		}
		return times.filter(time => time >= 0 && time <= 1).map(time => first * (1 - time) ** 3 + 3 * controlOne * (1 - time) ** 2 * time + 3 * controlTwo * (1 - time) * time * time + last * time ** 3);
	}
	for (let index = 0; index < tokens.length;) {
		const command = tokens[index++];
		const count = command === "C" ? 6 : command === "M" || command === "L" ? 2 : command === "Z" ? 0 : -1;
		const numbers = tokens.slice(index, index + count).map(Number);
		if (count < 0 || numbers.length !== count || numbers.some(value => !Number.isFinite(value))) return reject();
		index += count;
		if (command === "M" || command === "L") {
			position = numbers;
			if (command === "M") start = numbers;
			points.push(position);
		}
		else if (command === "C") {
			const horizontal = curve(position[0]!, numbers[0]!, numbers[2]!, numbers[4]!);
			const vertical = curve(position[1]!, numbers[1]!, numbers[3]!, numbers[5]!);
			points.push([Math.min(...horizontal), Math.min(...vertical)], [Math.max(...horizontal), Math.max(...vertical)]);
			position = numbers.slice(4);
		}
		else {
			position = start;
			points.push(start);
		}
	}
	if (!points.length || points.some(point => point.length !== 2)) return reject();
	return [Math.min(...points.map(point => point[0]!)), Math.min(...points.map(point => point[1]!)), Math.max(...points.map(point => point[0]!)), Math.max(...points.map(point => point[1]!))];
}

export function inspectWinnebagoVisual(xml: string, svg: string, page: number) {
	const native = winnebagoNativePages(xml)[page - 1];
	if (!native || Buffer.byteLength(svg) > 4 * 1024 * 1024 || !svg.trimEnd().endsWith("</svg>")) return reject();
	const document = parseStateHtml(svg);
	const roots = descendants(document, node => node.nodeName === "svg");
	if (roots.length !== 1 || attribute(roots[0]!, "width") !== "612pt" || attribute(roots[0]!, "height") !== "792pt" || attribute(roots[0]!, "viewBox") !== "0 0 612 792") return reject();
	const definitions = new Map(descendants(roots[0]!, node => attribute(node, "id").startsWith("glyph-")).map(node => [attribute(node, "id"), descendants(node, child => child.nodeName === "path").map(child => attribute(child, "d")).join(" ")]));
	const identified = descendants(roots[0]!, node => Boolean(attribute(node, "id")));
	if (new Set(identified.map(node => attribute(node, "id"))).size !== identified.length) return reject();
	for (const glyph of identified.filter(node => attribute(node, "id").startsWith("glyph-"))) {
		if (descendants(glyph, node => node.nodeName !== "#text" && node.nodeName !== "path").length || descendants(glyph, node => node.nodeName === "path").some(node => node.attrs?.some(item => item.name !== "d"))) return reject();
	}
	const fields = native.map(field => ({ ...field, left: field.left / 1.5, right: (field.left + field.width) / 1.5, top: field.top / 1.5, bottom: (field.top + field.height) / 1.5, count: 0 }));
	const clipping = new Map(descendants(roots[0]!, node => node.nodeName.toLowerCase() === "clippath").map((node) => {
		const paths = descendants(node, child => child.nodeName === "path");
		const definition = paths.length === 1 ? attribute(paths[0]!, "d") : "";
		const numbers = (definition.match(/[-+]?(?:\d+\.?\d*|\.\d+)/gu) ?? []).map(Number);
		if (definition.replace(/[-+]?(?:\d+\.?\d*|\.\d+)/gu, "").replace(/\s/gu, "") !== "MLLLZM" || numbers.length !== 10 || numbers.some(number => !Number.isFinite(number))) return reject();
		const corners = [0, 2, 4, 6].map(index => [numbers[index]!, numbers[index + 1]!]);
		if (new Set(corners.map(point => point[0])).size !== 2 || new Set(corners.map(point => point[1])).size !== 2 || new Set(corners.map(point => point.join(","))).size !== 4 || corners.some((point, index) => point[0] !== corners[(index + 1) % 4]![0] && point[1] !== corners[(index + 1) % 4]![1]) || numbers[8] !== numbers[0] || numbers[9] !== numbers[1]) return reject();
		return [attribute(node, "id"), [Math.min(numbers[0]!, numbers[2]!, numbers[4]!, numbers[6]!), Math.min(numbers[1]!, numbers[3]!, numbers[5]!, numbers[7]!), Math.max(numbers[0]!, numbers[2]!, numbers[4]!, numbers[6]!), Math.max(numbers[1]!, numbers[3]!, numbers[5]!, numbers[7]!)]] as const;
	}));
	const pending = [{ node: roots[0]!, clips: [] as string[] }];
	let visited = 0;
	let visibleGlyphs = 0;
	let underlines = 0;
	let clippedContactGlyphs = 0;
	let reviewedCandidateClips = 0;
	let backgrounds = 0;
	const paintedFields = new Set<typeof fields[number]>();
	while (pending.length) {
		const item = pending.pop()!;
		const node = item.node;
		if (++visited > 40000) return reject();
		if (node.nodeName === "defs") continue;
		if (!["svg", "g", "use", "path", "#text"].includes(node.nodeName) || attribute(node, "style") || attribute(node, "transform") || attribute(node, "mask") || attribute(node, "opacity") || attribute(node, "filter")) return reject();
		const clip = attribute(node, "clip-path");
		if (clip && (node.nodeName !== "g" || !/^url\(#clip-\d+\)$/u.test(clip) || !clipping.has(clip.slice(5, -1)))) return reject();
		const clips = clip ? [...item.clips, clip.slice(5, -1)] : item.clips;
		if ((attribute(node, "fill-opacity") && attribute(node, "fill-opacity") !== "1") || (attribute(node, "fill") && !colors.includes(attribute(node, "fill")) && !(node.nodeName === "path" && attribute(node, "fill") === "rgb(100%, 100%, 100%)"))) return reject();
		if (node.nodeName === "use") {
			const glyph = attribute(node, "href");
			if (!/^#glyph-\d+-\d+$/u.test(glyph) || !definitions.has(glyph.slice(1))) return reject();
			if (definitions.get(glyph.slice(1))!.trim()) {
				const left = Number(attribute(node, "x"));
				const top = Number(attribute(node, "y"));
				const matches = fields.filter(field => left >= field.left - 0.75 && left < field.right + 0.75 && top >= field.top - 0.75 && top <= field.bottom + 0.75);
				if (!matches.length || matches.length > 2) return reject();
				if (matches.length === 2 && !matches.every(field => ["GENERAL", "ELECTION"].includes(field.text)) && !matches.every(field => /^(?:\d+|st|nd|rd|th)$/u.test(field.text))) return reject();
				const field = matches.sort((first, second) => second.left - first.left)[0]!;
				if (clips.length) {
					if (field.bold) {
						const bounds = clips.length === 1 ? clipping.get(clips[0]!) : undefined;
						const ink = winnebagoGlyphBounds(definitions.get(glyph.slice(1))!).map((value, index) => value + (index % 2 ? top : left));
						if (!bounds || ink[0]! < bounds[0]! - 0.005 || ink[1]! < bounds[1]! - 0.005 || ink[2]! > bounds[2]! + 0.005 || ink[3]! > bounds[3]! + 0.005) return reject();
						reviewedCandidateClips++;
					}
					else {
						clippedContactGlyphs++;
					}
				}
				field.count++;
				paintedFields.add(field);
				visibleGlyphs++;
			}
		}
		else if (node.nodeName === "path") {
			if (!["rgb(0%, 0%, 100%)", "rgb(100%, 100%, 100%)"].includes(attribute(node, "fill")) || attribute(node, "stroke")) return reject();
			const definition = attribute(node, "d");
			if (definition.replace(/[-+]?(?:\d+\.?\d*|\.\d+)/gu, "").replace(/\s/gu, "") !== "MLLLZM") return reject();
			const numbers = (definition.match(/[-+]?(?:\d+\.?\d*|\.\d+)/gu) ?? []).map(Number);
			if (numbers.length !== 10 || numbers.some(number => !Number.isFinite(number))) return reject();
			const horizontal = [numbers[0]!, numbers[2]!, numbers[4]!, numbers[6]!];
			const vertical = [numbers[1]!, numbers[3]!, numbers[5]!, numbers[7]!];
			const left = Math.min(...horizontal);
			const right = Math.max(...horizontal);
			const top = Math.min(...vertical);
			const bottom = Math.max(...vertical);
			if (left < 0 || top < 0 || right > 612 || bottom > 792 || bottom <= top || right <= left) return reject();
			if (attribute(node, "fill") === "rgb(100%, 100%, 100%)") {
				if ([...paintedFields].some(field => field.left < right && field.right > left && field.top < bottom && field.bottom > top)) return reject();
				backgrounds++;
			}
			else {
				if (bottom - top > 0.75 || !fields.some(field => /@|^https?:\/\//u.test(field.text) && Math.abs(field.left - left) < 0.75 && Math.abs(field.right - right) < 0.75 && top >= field.bottom - 2 && bottom <= field.bottom + 0.75)) return reject();
				underlines++;
			}
		}
		for (const child of [...(node.childNodes ?? [])].reverse()) pending.push({ node: child, clips });
	}
	if (fields.some(field => field.count !== field.text.replace(/\s/gu, "").length)) return reject();
	return { svgSha256: hash(svg), fields: fields.length, visibleGlyphs, underlines, clippedContactGlyphs, reviewedCandidateClips, backgrounds };
}
