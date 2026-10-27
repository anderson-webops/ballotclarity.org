export function ballotQuestionHeading(title: string) {
	const match = /^([1-9]\d?)\. (.+) \((House Resolution [1-9]\d{0,5})\)$/u.exec(title);
	return match
		? { title: match[2]!, reference: `Question ${match[1]} · ${match[3]}` }
		: { title, reference: "" };
}
