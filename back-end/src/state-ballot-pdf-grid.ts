import { Buffer } from "node:buffer";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";
import { extractStateBallotPdfSvg, extractStateBallotPdfText, resolveStateBallotPdfExtractor, resolveStateBallotPdfSvgExtractor, stateBallotPdfCollectorContract } from "./state-ballot-pdf.js";

type Rectangle = [number, number, number, number];
interface Edge { axis: "h" | "v"; position: number; start: number; end: number }
interface Word { text: string; left: number; top: number; right: number; bottom: number }
export interface StateBallotGridPage {
	number: number;
	width: number;
	height: number;
	headerText: string;
	cells: Array<{ bounds: Rectangle; text: string; logicalText: string; tags: Array<{ text: string; top: number; bottom: number }> }>;
}

export const stateBallotPdfGridContract = Object.freeze({
	configuration: "STATE_BALLOT_PDFTOCAIRO",
	executable: "absolute path to maintained Poppler pdftocairo",
	textConfiguration: stateBallotPdfCollectorContract.configuration,
	maximumPages: stateBallotPdfCollectorContract.maximumPages,
	maximumSvgBytes: stateBallotPdfCollectorContract.maximumTextBytes,
	maximumDocumentMs: 60000,
	maximumGridOperations: 200000,
	role: "bounded collection worker; no network or script execution while reading geometry",
});

function svgRectangles(body: string, width: number, height: number): Rectangle[] {
	if (Buffer.byteLength(body) > stateBallotPdfGridContract.maximumSvgBytes) throw new Error("The ballot grid SVG exceeds its bounds.");
	const document = parseStateHtml(body);
	const roots = stateHtmlDescendants(document, node => node.nodeName === "svg");
	if (roots.length !== 1 || stateHtmlAttribute(roots[0]!, "viewBox") !== `0 0 ${width} ${height}`) throw new Error("The ballot grid SVG does not match the text page.");
	const paths = stateHtmlDescendants(roots[0]!, node => node.nodeName === "path");
	if (paths.length > 20000) throw new Error("The ballot grid has too many drawing paths.");
	const inheritedTransforms = new Set(stateHtmlDescendants(roots[0]!, node => node.nodeName !== "path" && Boolean(stateHtmlAttribute(node, "transform"))).flatMap(node => stateHtmlDescendants(node, child => child.nodeName === "path")));
	const edges: Edge[] = [];
	for (const path of paths) {
		const stroke = stateHtmlAttribute(path, "stroke") || /(?:^|;)\s*stroke:\s*([^;]+)/u.exec(stateHtmlAttribute(path, "style"))?.[1];
		if (!stroke || stroke === "none") continue;
		const definition = stateHtmlAttribute(path, "d");
		if (!/^[MLZ\s,\deE.+-]+$/u.test(definition)) continue;
		if (stateHtmlAttribute(roots[0]!, "transform") || inheritedTransforms.has(path)) throw new Error("The ballot grid has an unsupported ancestor transform.");
		const transformText = stateHtmlAttribute(path, "transform");
		const transform = transformText ? /^matrix\(([^)]+)\)$/u.exec(transformText)?.[1]?.split(/[,\s]+/u).filter(Boolean).map(Number) : [1, 0, 0, 1, 0, 0];
		if (!transform || transform.length !== 6 || transform.some(value => !Number.isFinite(value) || Math.abs(value) > 10000)) throw new Error("The ballot grid transform is invalid.");
		const point = (horizontal: number, vertical: number) => {
			const result = [transform[0]! * horizontal + transform[2]! * vertical + transform[4]!, transform[1]! * horizontal + transform[3]! * vertical + transform[5]!] as const;
			if (result.some(value => !Number.isFinite(value)) || result[0] < -1 || result[0] > width + 1 || result[1] < -1 || result[1] > height + 1) throw new Error("The ballot grid path lies outside the page.");
			return result;
		};
		const tokens = definition.match(/[MLZ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/gu) ?? [];
		if (tokens.length > 20000) throw new Error("The ballot grid path exceeds its bounds.");
		let previous: readonly [number, number] | undefined;
		let beginning: readonly [number, number] | undefined;
		let command: string | undefined;
		const segment = (end: readonly [number, number]) => {
			if (previous) {
				const [startX, startY] = previous;
				if (Math.abs(end[1] - startY) < 0.05 && Math.abs(end[0] - startX) > 10) edges.push({ axis: "h", position: (startY + end[1]) / 2, start: Math.min(startX, end[0]), end: Math.max(startX, end[0]) });
				if (Math.abs(end[0] - startX) < 0.05 && Math.abs(end[1] - startY) > 10) edges.push({ axis: "v", position: (startX + end[0]) / 2, start: Math.min(startY, end[1]), end: Math.max(startY, end[1]) });
			}
			previous = end;
			if (edges.length > 4000) throw new Error("The ballot grid has too many line segments.");
		};
		for (let index = 0; index < tokens.length;) {
			if (/^[MLZ]$/u.test(tokens[index]!)) command = tokens[index++];
			if (command === "Z") {
				if (!beginning) throw new Error("The ballot grid path has no initial point.");
				segment(beginning);
				command = undefined;
				continue;
			}
			if (!["M", "L"].includes(command ?? "") || index + 1 >= tokens.length || /^[MLZ]$/u.test(tokens[index]!) || /^[MLZ]$/u.test(tokens[index + 1]!)) throw new Error("The ballot grid path is incomplete.");
			const current = point(Number(tokens[index++]), Number(tokens[index++]));
			if (command === "M") {
				previous = current;
				beginning = current;
				command = "L";
			}
			else {
				segment(current);
			}
		}
	}
	const joined: Edge[] = [];
	for (const axis of ["h", "v"] as const) {
		const groups: Edge[][] = [];
		for (const edge of edges.filter(edge => edge.axis === axis).sort((first, second) => first.position - second.position)) {
			const group = groups.at(-1);
			if (!group || edge.position - group.at(-1)!.position > 3) groups.push([edge]);
			else group.push(edge);
		}
		for (const group of groups) {
			const position = group.reduce((sum, edge) => sum + edge.position, 0) / group.length;
			let active: Edge | undefined;
			for (const edge of group.sort((first, second) => first.start - second.start)) {
				if (!active || edge.start > active.end + 3) {
					active = { ...edge, position };
					joined.push(active);
				}
				else {
					active.end = Math.max(active.end, edge.end);
				}
			}
		}
	}
	const horizontal = joined.filter(edge => edge.axis === "h");
	const vertical = joined.filter(edge => edge.axis === "v").sort((first, second) => first.position - second.position);
	if (horizontal.length > 200 || vertical.length > 200) throw new Error("The ballot grid has too many joined edges.");
	const cells: Rectangle[] = [];
	let operations = 0;
	for (const left of vertical) {
		const tops = horizontal.filter(edge => edge.start <= left.position + 3 && edge.end >= left.position - 3 && edge.position >= left.start - 3 && edge.position <= left.end + 3).sort((first, second) => first.position - second.position);
		for (let topIndex = 0; topIndex < tops.length; topIndex++) {
			const top = tops[topIndex]!;
			let found = false;
			for (const bottom of tops.slice(topIndex + 1)) {
				for (const right of vertical.filter(edge => edge.position > left.position + 3)) {
					operations += 1;
					if (operations > stateBallotPdfGridContract.maximumGridOperations) throw new Error("The ballot grid geometry exceeds its operation budget.");
					if (right.start <= top.position + 3 && right.end >= bottom.position - 3 && top.end >= right.position - 3 && bottom.end >= right.position - 3) {
						cells.push([left.position, top.position, right.position, bottom.position]);
						found = true;
						break;
					}
				}
				if (found) break;
			}
		}
	}
	if (cells.length < 30 || cells.length > 500) throw new Error("The ballot grid cell count is outside its bounds.");
	return cells;
}

function lines(words: Word[]) {
	const groups: Array<{ top: number; words: Word[] }> = [];
	for (const word of [...words].sort((first, second) => first.top - second.top || first.left - second.left)) {
		let group = groups.find(group => Math.abs(group.top - word.top) < 2);
		if (!group) {
			group = { top: word.top, words: [] };
			groups.push(group);
		}
		group.words.push(word);
	}
	return groups.sort((first, second) => first.top - second.top).map(group => group.words.sort((first, second) => first.left - second.left).map(word => word.text).join(" ")).join("\n");
}

function readWordPages(body: string) {
	if (Buffer.byteLength(body) > stateBallotPdfCollectorContract.maximumTextBytes) throw new Error("The ballot grid word corpus exceeds its bounds.");
	const pages = stateHtmlDescendants(parseStateHtml(body), node => node.nodeName === "page");
	if (!pages.length || pages.length > stateBallotPdfGridContract.maximumPages) throw new Error("The ballot grid page count is outside its bounds.");
	return pages.map((page) => {
		const width = Number(stateHtmlAttribute(page, "width"));
		const height = Number(stateHtmlAttribute(page, "height"));
		if (!Number.isFinite(width) || !Number.isFinite(height) || width < 600 || width > 1600 || height < 400 || height > 1200) throw new Error("The ballot grid page dimensions require review.");
		const words = stateHtmlDescendants(page, node => node.nodeName === "word").map(word => ({ text: stateHtmlText(word).normalize("NFKC"), left: Number(stateHtmlAttribute(word, "xmin")), right: Number(stateHtmlAttribute(word, "xmax")), top: Number(stateHtmlAttribute(word, "ymin")), bottom: Number(stateHtmlAttribute(word, "ymax")) }));
		if (words.length < 50 || words.length > 10000 || words.some(word => !word.text || word.text.length > 2000 || [word.left, word.right, word.top, word.bottom].some(value => !Number.isFinite(value)) || word.left < 0 || word.top < 0 || word.right > width + 1 || word.bottom > height + 1 || word.left >= word.right || word.top >= word.bottom)) throw new Error("The ballot grid word coordinates are invalid.");
		return { width, height, words };
	});
}

export function readStateBallotPdfGrid(wordCorpus: string, drawings: string[]): StateBallotGridPage[] {
	const pages = readWordPages(wordCorpus);
	if (drawings.length !== pages.length) throw new Error("The ballot grid drawing set is incomplete.");
	return pages.map(({ width, height, words }, index) => {
		const entries = svgRectangles(drawings[index]!, width, height).map((bounds) => {
			const inside = words.filter(word => (word.left + word.right) / 2 > bounds[0] - 0.2 && (word.left + word.right) / 2 < bounds[2] + 0.2 && (word.top + word.bottom) / 2 > bounds[1] - 0.2 && (word.top + word.bottom) / 2 < bounds[3] + 0.2);
			return { bounds, text: lines(inside), logicalText: inside.map(word => word.text).join(" "), tags: inside.filter(word => /^\d{1,2}[A-Z]$/u.test(word.text)).map(word => ({ text: word.text, top: word.top, bottom: word.bottom })) };
		});
		const anchors = entries.filter(cell => /office/iu.test(cell.text) && /party/iu.test(cell.text) && cell.text.length < 100);
		if (anchors.length !== 1) throw new Error("The ballot grid has no unique Office/Party anchor.");
		const anchor = anchors[0]!;
		const frames = entries.filter(cell => cell !== anchor && cell.bounds[0] <= anchor.bounds[0] && cell.bounds[1] < anchor.bounds[1] && entries.filter(other => other !== cell && other.bounds[0] >= cell.bounds[0] - 0.1 && other.bounds[1] >= cell.bounds[1] - 0.1 && other.bounds[2] <= cell.bounds[2] + 0.1 && other.bounds[3] <= cell.bounds[3] + 0.1).length >= 30);
		const eligible = entries.filter(cell => !frames.includes(cell));
		const selected = new Set([anchor]);
		const corners = (rectangle: Rectangle) => [[rectangle[0], rectangle[1]], [rectangle[2], rectangle[1]], [rectangle[0], rectangle[3]], [rectangle[2], rectangle[3]]];
		for (const current of selected) {
			for (const cell of eligible) {
				if (!selected.has(cell) && corners(current.bounds).some(first => corners(cell.bounds).some(second => Math.abs(first[0]! - second[0]!) < 1 && Math.abs(first[1]! - second[1]!) < 1))) selected.add(cell);
			}
		}
		if (selected.size < 30 || selected.size > 300) throw new Error("The connected ballot grid cell count requires review.");
		const cells = eligible.filter(cell => selected.has(cell));
		for (const cell of cells) {
			if (cell.text.length > 2000 || cell.logicalText.length > 2000 || cell.tags.length > 25 || cells.some(other => other !== cell && other.bounds[0] > cell.bounds[0] + 1 && other.bounds[1] > cell.bounds[1] + 1 && other.bounds[2] < cell.bounds[2] - 1 && other.bounds[3] < cell.bounds[3] - 1)) throw new Error("The connected ballot grid has ambiguous or oversized cells.");
		}
		for (const word of words.filter(word => /^\d{1,2}[A-Z]$/u.test(word.text) && (word.top + word.bottom) / 2 > anchor.bounds[3])) {
			const matches = cells.filter(cell => (word.left + word.right) / 2 > cell.bounds[0] - 0.2 && (word.left + word.right) / 2 < cell.bounds[2] + 0.2 && (word.top + word.bottom) / 2 > cell.bounds[1] - 0.2 && (word.top + word.bottom) / 2 < cell.bounds[3] + 0.2);
			if (matches.length !== 1) throw new Error("A ballot position is outside or ambiguous within the connected grid.", { cause: { page: index + 1, position: word.text, x: (word.left + word.right) / 2, y: (word.top + word.bottom) / 2, matchedCells: matches.map(cell => cell.bounds) } });
		}
		return { number: index + 1, width, height, headerText: lines(words.filter(word => word.bottom < anchor.bounds[1] + 0.5)), cells };
	});
}

export async function extractStateBallotPdfGrid(bytes: Buffer, options: { textExecutable?: string; svgExecutable?: string } = {}) {
	const startedAt = Date.now();
	const textExecutable = options.textExecutable ?? await resolveStateBallotPdfExtractor();
	const svgExecutable = options.svgExecutable ?? await resolveStateBallotPdfSvgExtractor();
	const wordCorpus = await extractStateBallotPdfText(bytes, textExecutable, stateBallotPdfCollectorContract.timeoutMs, "raw-bbox");
	const pages = readWordPages(wordCorpus);
	const drawings: string[] = [];
	for (const [index] of pages.entries()) {
		const remaining = stateBallotPdfGridContract.maximumDocumentMs - (Date.now() - startedAt);
		if (remaining <= 0) throw new Error("The ballot grid document exceeded its time budget.");
		drawings.push(await extractStateBallotPdfSvg(bytes, svgExecutable, index + 1, Math.min(remaining, stateBallotPdfCollectorContract.timeoutMs)));
	}
	const result = readStateBallotPdfGrid(wordCorpus, drawings);
	if (Date.now() - startedAt > stateBallotPdfGridContract.maximumDocumentMs) throw new Error("The ballot grid document exceeded its time budget.");
	return result;
}
