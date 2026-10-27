export interface OrangePathCommand { kind: string; values: number[] }
function reject(): never {
	throw new Error("The Orange County rendered path requires review.");
}
export function orangePathCommands(body: string, left = 0, top = 0): OrangePathCommand[] {
	if (body.length > 200000 || /[^MLCZ\d\s+.,-]/u.test(body)) return reject();
	const tokens = body.match(/[MLCZ]|[-+]?(?:\d+\.?\d*|\.\d+)/gu) ?? [];
	const result: OrangePathCommand[] = [];
	for (let position = 0; position < tokens.length;) {
		const kind = tokens[position++]!;
		if (!["M", "L", "C", "Z"].includes(kind)) return reject();
		const count = kind === "C" ? 6 : kind === "Z" ? 0 : 2;
		const values = tokens.slice(position, position + count).map((value, index) => Number(value) + (index % 2 ? top : left));
		if (values.length !== count || values.some(value => !Number.isFinite(value))) return reject();
		result.push({ kind, values });
		position += count;
	}
	while (result.at(-1)?.kind === "M") result.pop();
	return result;
}
export function orangeRuleShapes(body: string) {
	const commands = orangePathCommands(body);
	const result: { box: number[]; closed: boolean }[] = [];
	let points: number[][] = [];
	const complete = (closed: boolean) => {
		if (points.length !== (closed ? 4 : 2) || new Set(points.map(point => point.join(","))).size !== points.length || points.some((point, index) => (index > 0 || closed) && point[0] !== points[(index + points.length - 1) % points.length]![0] && point[1] !== points[(index + points.length - 1) % points.length]![1]) || (closed && (new Set(points.map(point => point[0])).size !== 2 || new Set(points.map(point => point[1])).size !== 2))) return reject();
		result.push({ box: [Math.min(...points.map(point => point[0]!)), Math.min(...points.map(point => point[1]!)), Math.max(...points.map(point => point[0]!)), Math.max(...points.map(point => point[1]!))], closed });
		points = [];
	};
	for (const command of commands) {
		if (command.kind === "C") return reject();
		if (command.kind === "M" && points.length) complete(false);
		if (command.kind === "Z") complete(true);
		else points.push(command.values);
	}
	if (points.length) complete(false);
	if (!result.length || result.length > 1000) return reject();
	return result;
}
export function orangeStrokeMatches(actual: readonly OrangePathCommand[], expected: readonly OrangePathCommand[]) {
	return actual.length === expected.length && actual.every((command, index) => command.kind === expected[index]!.kind && command.values.length === expected[index]!.values.length && command.values.every((value, position) => Math.abs(value - expected[index]!.values[position]!) <= 0.005));
}
