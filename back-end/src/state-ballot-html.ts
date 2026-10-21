import { parse } from "parse5";

export interface StateHtmlNode {
	nodeName: string;
	value?: string;
	attrs?: Array<{ name: string; value: string }>;
	childNodes?: StateHtmlNode[];
}

export function parseStateHtml(body: string) {
	return parse(body) as unknown as StateHtmlNode;
}

export function stateHtmlDescendants(node: StateHtmlNode, predicate: (child: StateHtmlNode) => boolean): StateHtmlNode[] {
	return (node.childNodes ?? []).flatMap(child => [
		...(predicate(child) ? [child] : []),
		...stateHtmlDescendants(child, predicate),
	]);
}

export function stateHtmlAttribute(node: StateHtmlNode, name: string) {
	return node.attrs?.find(item => item.name === name)?.value ?? "";
}

export function stateHtmlText(node: StateHtmlNode): string {
	if (node.nodeName === "script" || node.nodeName === "style") return "";
	return node.value ?? (node.childNodes ?? []).map(stateHtmlText).join(" ");
}

export function stateHtmlTableRows(table: StateHtmlNode) {
	return (table.childNodes ?? []).flatMap(child => child.nodeName === "tr"
		? [child]
		: ["thead", "tbody", "tfoot"].includes(child.nodeName)
				? (child.childNodes ?? []).filter(node => node.nodeName === "tr")
				: []);
}
