import type { PublicElectionReference } from "~/types/civic";

export function candidateReferenceFacts(references: readonly PublicElectionReference[], preceding: readonly string[] = []) {
	const seen = new Set(preceding.map(fact => fact.toLocaleLowerCase("en-US").replace(/\s+/gu, " ").trim()));
	return references.map((reference) => {
		const facts = reference.facts.flatMap((original) => {
			if (/^(?:Listed by Open States as |Recorded role start:|Matched from )/u.test(original)) return [];
			const fact = original.replace(/^Listed occupation:/u, "Occupation:").replace(/^Listed education:/u, "Education:");
			const key = fact.toLocaleLowerCase("en-US").replace(/\s+/gu, " ").trim();
			if (!key || seen.has(key)) return [];
			seen.add(key);
			return [fact];
		});
		return { ...reference, facts };
	}).filter(reference => reference.facts.length);
}
