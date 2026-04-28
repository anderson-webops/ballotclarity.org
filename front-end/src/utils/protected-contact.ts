const projectInboxLocalPart = [104, 101, 108, 108, 111] as const;
const projectInboxDomain = [98, 97, 108, 108, 111, 116, 99, 108, 97, 114, 105, 116, 121, 46, 111, 114, 103] as const;

function decodeCharacterCodes(codes: readonly number[]) {
	return String.fromCharCode(...codes);
}

export function getProtectedContactEmail() {
	return `${decodeCharacterCodes(projectInboxLocalPart)}@${decodeCharacterCodes(projectInboxDomain)}`;
}

export function buildProtectedContactHref(subject?: string) {
	const normalizedSubject = subject?.trim();

	return normalizedSubject
		? `mailto:${getProtectedContactEmail()}?subject=${encodeURIComponent(normalizedSubject)}`
		: `mailto:${getProtectedContactEmail()}`;
}
