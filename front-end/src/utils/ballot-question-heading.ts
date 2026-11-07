export function ballotQuestionHeading(title: string, audience = "") {
	const proposition = /^(Proposition (?:[1-9]\d?|[A-Z])): A CITIZENS[’'] INITIATIVE PROPOSITION (?:THAT )?(.+)$/u.exec(title);
	if (proposition) {
		const topic = proposition[2]!.toLocaleLowerCase("en-US");
		const named = audience ? topic.split(audience.toLocaleLowerCase("en-US")).join(audience) : topic;
		return { title: named.charAt(0).toLocaleUpperCase("en-US") + named.slice(1), reference: proposition[1]! };
	}
	const match = /^([1-9]\d?)\. (.+) \((House Resolution [1-9]\d{0,5})\)$/u.exec(title);
	return match
		? { title: match[2]!, reference: `Question ${match[1]} · ${match[3]}` }
		: { title, reference: "" };
}
