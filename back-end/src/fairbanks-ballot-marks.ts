import type { StateHtmlNode } from "./state-ballot-html.js";
import { Buffer } from "node:buffer";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml } from "./state-ballot-html.js";
import { orangePathCommands, orangeRuleShapes } from "./state-ballot-orange-shapes.js";
import { winnebagoGlyphBounds } from "./state-ballot-winnebago-visual.js";

export interface FairbanksSelectionMark { left: number; top: number; right: number; bottom: number }
type ParentNode = StateHtmlNode & { parentNode?: ParentNode };
function requireValue(condition: unknown, detail: string): asserts condition {
	if (!condition) throw new Error(`The Fairbanks rendered selection inventory requires review: ${detail}.`);
}
function parents(node: StateHtmlNode) {
	const result: ParentNode[] = [];
	for (let parent = (node as ParentNode).parentNode; parent; parent = parent.parentNode) {
		requireValue(result.length < 64, "ancestry bounds");
		result.push(parent);
	}
	return result;
}
function matrix(value: string) {
	if (!value) return [1, 0, 0, 1, 0, 0];
	const matched = /^matrix\(([^()]+)\)$/u.exec(value);
	const numbers = matched?.[1]?.trim().split(/[\s,]+/u).map(Number);
	if (!numbers || numbers.length !== 6 || !numbers.every(Number.isFinite)) throw new Error("The Fairbanks rendered transform requires review.");
	return numbers;
}
function transformed(box: number[], values: number[]): FairbanksSelectionMark {
	const points = [[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]].map(([left, top]) => [values[0]! * left! + values[2]! * top! + values[4]!, values[1]! * left! + values[3]! * top! + values[5]!]);
	return { left: Math.min(...points.map(point => point[0]!)), top: Math.min(...points.map(point => point[1]!)), right: Math.max(...points.map(point => point[0]!)), bottom: Math.max(...points.map(point => point[1]!)) };
}
function overlap(first: FairbanksSelectionMark, second: FairbanksSelectionMark) {
	return first.left < second.right - 0.01 && first.right > second.left + 0.01 && first.top < second.bottom - 0.01 && first.bottom > second.top + 0.01;
}
function visibleStroke(value: string) {
	const matched = /^rgb\(([\d.]+)%,\s*([\d.]+)%,\s*([\d.]+)%\)$/u.exec(value);
	if (!matched) return false;
	const colors = matched.slice(1).map(Number);
	if (!colors.every(channel => Number.isFinite(channel) && channel >= 0 && channel <= 100)) return false;
	const linear = colors.map(channel => channel / 100 <= 0.04045 ? channel / 1292 : ((channel / 100 + 0.055) / 1.055) ** 2.4);
	return 1.05 / (0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]! + 0.05) >= 3;
}

export function inspectFairbanksSelectionMarks(svg: string, width: number, height: number) {
	requireValue(typeof svg === "string" && Buffer.byteLength(svg) <= 4 * 1024 * 1024 && svg.trimEnd().endsWith("</svg>"), "input bounds");
	const tree = parseStateHtml(svg);
	const pending = [{ node: tree, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const current = pending.pop()!;
		requireValue(++visited <= 80000 && current.depth <= 64, "tree bounds");
		for (const child of current.node.childNodes ?? []) pending.push({ node: child, depth: current.depth + 1 });
	}
	const roots = descendants(tree, node => node.nodeName === "svg");
	requireValue(roots.length === 1 && attribute(roots[0]!, "width") === `${width}pt` && attribute(roots[0]!, "height") === `${height}pt` && attribute(roots[0]!, "viewBox") === `0 0 ${width} ${height}`, "page dimensions");
	const identified = descendants(roots[0]!, node => Boolean(attribute(node, "id")));
	requireValue(new Set(identified.map(node => attribute(node, "id"))).size === identified.length, "unique identifiers");
	const clips = new Map(identified.filter(node => node.nodeName.toLowerCase() === "clippath").map(node => [attribute(node, "id"), node]));
	const paths = descendants(roots[0]!, node => node.nodeName === "path" && !parents(node).some(parent => ["defs", "clippath"].includes(parent.nodeName.toLowerCase())));
	requireValue(paths.length <= 10000, "paint inventory bounds");
	const marks: Array<FairbanksSelectionMark & { order: number }> = [];
	for (const [order, node] of paths.entries()) {
		if (attribute(node, "fill") !== "none" || !attribute(node, "stroke")) continue;
		const commands = orangePathCommands(attribute(node, "d"));
		if (commands.map(command => command.kind).join("") !== "MCCCC") continue;
		const bounds = winnebagoGlyphBounds(attribute(node, "d"));
		const values = matrix(attribute(node, "transform"));
		const box = transformed(bounds, values);
		const ratio = (box.right - box.left) / (box.bottom - box.top);
		if (ratio < 1.2 || ratio > 1.3) continue;
		requireValue(marks.length < 500 && values[0]! > 0 && values[1] === 0 && values[2] === 0 && values[3]! < 0 && Math.abs(values[0]! + values[3]!) < 0.001 && box.left >= 0 && box.top >= 0 && box.right <= width && box.bottom <= height && box.right - box.left >= 4 && box.right - box.left <= 12 && box.bottom - box.top >= 3 && box.bottom - box.top <= 10, "selection geometry");
		const endpoints = [commands[0]!.values, ...commands.slice(1).map(command => command.values.slice(4))];
		const center = [(bounds[0]! + bounds[2]!) / 2, (bounds[1]! + bounds[3]!) / 2];
		const expected = [[bounds[2], center[1]], [center[0], bounds[3]], [bounds[0], center[1]], [center[0], bounds[1]], [bounds[2], center[1]]];
		requireValue(endpoints.every((point, index) => point.length === 2 && point.every((value, axis) => Math.abs(value - expected[index]![axis]!) <= 0.03)), "closed oval outline");
		requireValue(visibleStroke(attribute(node, "stroke")) && Number(attribute(node, "stroke-opacity") || "1") === 1 && Number(attribute(node, "stroke-width")) > 0 && Number(attribute(node, "stroke-width")) <= 1, "selection stroke");
		for (const parent of [node, ...parents(node)]) {
			requireValue((parent === node || !attribute(parent, "transform")) && !attribute(parent, "mask") && !attribute(parent, "filter") && !attribute(parent, "style") && !attribute(parent, "display") && !attribute(parent, "visibility") && Number(attribute(parent, "opacity") || "1") === 1 && Number(attribute(parent, "stroke-opacity") || "1") === 1, "selection visibility");
			if (!attribute(parent, "clip-path")) continue;
			const reference = /^url\(#([^()]+)\)$/u.exec(attribute(parent, "clip-path"));
			const clip = reference ? clips.get(reference[1]!) : undefined;
			const definitions = clip ? descendants(clip, child => child.nodeName === "path") : [];
			requireValue(definitions.length === 1 && !attribute(clip!, "transform"), "selection clipping");
			const shapes = orangeRuleShapes(attribute(definitions[0]!, "d"));
			requireValue(shapes.length === 1 && shapes[0]!.closed && box.left >= shapes[0]!.box[0]! - 0.01 && box.top >= shapes[0]!.box[1]! - 0.01 && box.right <= shapes[0]!.box[2]! + 0.01 && box.bottom <= shapes[0]!.box[3]! + 0.01, "clipped selection");
		}
		marks.push({ ...box, order });
	}
	for (const mark of marks) {
		for (const node of paths.slice(mark.order + 1)) {
			if (!attribute(node, "fill") || attribute(node, "fill") === "none") continue;
			const painted = transformed(winnebagoGlyphBounds(attribute(node, "d")), matrix(attribute(node, "transform")));
			requireValue(!overlap(mark, painted), "later paint obscures a selection");
		}
	}
	return marks.map(({ left, top, right, bottom }) => ({ left, top, right, bottom }));
}
