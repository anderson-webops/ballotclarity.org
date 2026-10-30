import type { PersonProfileResponse } from "~/types/civic";

function normalized(value: string) {
	return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function matchingRecordPerson(result: PersonProfileResponse, identity: { slug: string; name: string; stateCode: string; stateName?: string }) {
	const location = ` ${normalized(result.person.location)} `;
	return result.person.slug === identity.slug && normalized(result.person.name) === normalized(identity.name) && [identity.stateName, identity.stateCode].filter(Boolean).some(state => location.includes(` ${normalized(state!)} `)) ? result : null;
}
