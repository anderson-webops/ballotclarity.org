import type { OrangePathCommand } from "./state-ballot-orange-shapes.js";
import { orangePathCommands } from "./state-ballot-orange-shapes.js";

type Point = [number, number];
type Box = [number, number, number, number];
export interface IowaInkShape {
	contours: Point[][];
	edges: [Point, Point][];
	edgeBounds: Box[];
	box: Box;
	error: number;
}
const tolerance = 0.001;
function reject(): never {
	throw new Error("The Iowa rendered ink geometry requires review.");
}
function distance(point: Point, start: Point, end: Point) {
	const horizontal = end[0] - start[0];
	const vertical = end[1] - start[1];
	const length = horizontal ** 2 + vertical ** 2;
	const position = length
		? Math.max(0, Math.min(1, ((point[0] - start[0]) * horizontal + (point[1] - start[1]) * vertical) / length))
		: 0;
	return Math.hypot(point[0] - start[0] - position * horizontal, point[1] - start[1] - position * vertical);
}
function middle(first: Point, second: Point): Point {
	return [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
}
function bounds(points: Point[]): Box {
	return [
		Math.min(...points.map(point => point[0])),
		Math.min(...points.map(point => point[1])),
		Math.max(...points.map(point => point[0])),
		Math.max(...points.map(point => point[1]))
	];
}
function near(first: Box, second: Box, margin: number) {
	return (
		first[0] <= second[2] + margin
		&& first[2] >= second[0] - margin
		&& first[1] <= second[3] + margin
		&& first[3] >= second[1] - margin
	);
}
function cross(start: Point, end: Point, point: Point) {
	return (end[0] - start[0]) * (point[1] - start[1]) - (point[0] - start[0]) * (end[1] - start[1]);
}
function edgeDistance(first: [Point, Point], second: [Point, Point]) {
	const firstCrosses = cross(first[0], first[1], second[0]) * cross(first[0], first[1], second[1]) <= 0;
	const secondCrosses = cross(second[0], second[1], first[0]) * cross(second[0], second[1], first[1]) <= 0;
	if (firstCrosses && secondCrosses && near(bounds(first), bounds(second), 0)) return 0;
	return Math.min(
		distance(first[0], ...second),
		distance(first[1], ...second),
		distance(second[0], ...first),
		distance(second[1], ...first)
	);
}
function inside(point: Point, shape: IowaInkShape) {
	let winding = 0;
	for (const [start, end] of shape.edges) {
		if (start[1] <= point[1] && end[1] > point[1] && cross(start, end, point) > 0) winding++;
		if (start[1] > point[1] && end[1] <= point[1] && cross(start, end, point) < 0) winding--;
	}
	return winding !== 0;
}
export function iowaInkShape(
	path: string | OrangePathCommand[],
	matrix: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0],
	close = true
): IowaInkShape {
	if (matrix.length !== 6 || matrix.some(value => !Number.isFinite(value) || Math.abs(value) > 100000))
		return reject();
	const commands = typeof path === "string" ? orangePathCommands(path) : path;
	if (!commands.length || commands.length > 10000) return reject();
	const contours: Point[][] = [];
	const edges: [Point, Point][] = [];
	let points: Point[] = [];
	let position: Point = [0, 0];
	let start: Point = [0, 0];
	let curved = false;
	let total = 0;
	const transform = (horizontal: number, vertical: number): Point => [
		matrix[0] * horizontal + matrix[2] * vertical + matrix[4],
		matrix[1] * horizontal + matrix[3] * vertical + matrix[5]
	];
	const append = (point: Point) => {
		if (++total > 32768 || point.some(value => !Number.isFinite(value) || Math.abs(value) > 100000))
			return reject();
		if (points.length && Math.hypot(point[0] - position[0], point[1] - position[1]) > 1e-12)
			edges.push([position, point]);
		points.push(point);
		position = point;
	};
	const finish = () => {
		if (!points.length) return;
		if (close && points.length > 1 && (position[0] !== start[0] || position[1] !== start[1])) append(start);
		contours.push(points);
		points = [];
	};
	const curve = (first: Point, controlOne: Point, controlTwo: Point, last: Point, depth = 0): void => {
		if (distance(controlOne, first, last) <= tolerance && distance(controlTwo, first, last) <= tolerance) {
			append(last);
			return;
		}
		if (depth >= 16) return reject();
		const firstHalf = middle(first, controlOne);
		const center = middle(controlOne, controlTwo);
		const lastHalf = middle(controlTwo, last);
		const left = middle(firstHalf, center);
		const right = middle(center, lastHalf);
		const split = middle(left, right);
		curve(first, firstHalf, left, split, depth + 1);
		curve(split, right, lastHalf, last, depth + 1);
	};
	for (const command of commands) {
		const expected
			= command.kind === "M" || command.kind === "L" ? 2 : command.kind === "C" ? 6 : command.kind === "Z" ? 0 : -1;
		if (expected < 0 || command.values.length !== expected || command.values.some(value => !Number.isFinite(value)))
			return reject();
		if (command.kind === "M") {
			finish();
			start = transform(command.values[0]!, command.values[1]!);
			append(start);
		}
		else if (!points.length) {
			return reject();
		}
		else if (command.kind === "L") {
			append(transform(command.values[0]!, command.values[1]!));
		}
		else if (command.kind === "C") {
			curved = true;
			curve(
				position,
				transform(command.values[0]!, command.values[1]!),
				transform(command.values[2]!, command.values[3]!),
				transform(command.values[4]!, command.values[5]!)
			);
		}
		else {
			append(start);
		}
	}
	finish();
	if (!edges.length) return reject();
	return {
		contours,
		edges,
		edgeBounds: edges.map(bounds),
		box: bounds(contours.flat()),
		error: curved ? tolerance : 0
	};
}
export function iowaInkOverlaps(first: IowaInkShape, second: IowaInkShape, strokeRadius?: number) {
	if (strokeRadius !== undefined && (!Number.isFinite(strokeRadius) || strokeRadius < 0 || strokeRadius > 1000))
		return reject();
	const margin = first.error + second.error + (strokeRadius ?? 0) + 1e-6;
	if (!near(first.box, second.box, margin)) return false;
	let comparisons = 0;
	for (const [firstIndex, firstEdge] of first.edges.entries()) {
		for (const [secondIndex, secondEdge] of second.edges.entries()) {
			if (++comparisons > 2000000) return reject();
			if (
				near(first.edgeBounds[firstIndex]!, second.edgeBounds[secondIndex]!, margin)
				&& edgeDistance(firstEdge, secondEdge) <= margin
			) {
				return true;
			}
		}
	}
	if (second.contours.some(points => inside(points[0]!, first))) return true;
	return strokeRadius === undefined && first.contours.some(points => inside(points[0]!, second));
}
