export function ballotQuestionHeading(title: string, audience = "") {
	if (audience && title.startsWith(`${audience} `)) {
		const topic = title.slice(audience.length + 1);
		if (["supplemental levy", "temporary override levy"].includes(topic))
			return { title: topic.charAt(0).toLocaleUpperCase("en-US") + topic.slice(1), reference: "" };
	}
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
