const whitespacePattern = /\s+/g;
const googleCivicIpRestrictionPattern = /ip address restriction|violates this restriction/i;
const googleCivicApiKeyInvalidPattern = /api key not valid|keyinvalid|invalid api key/i;
const fetchFailedPattern = /fetch failed|network|socket|timeout|econn|etimedout|enotfound|eai_again/i;

export function summarizeProviderBody(text: string, maxLength = 220) {
	return text.replace(whitespacePattern, " ").trim().slice(0, maxLength);
}

export function summarizeGoogleCivicProviderFailure(status: number, body: string) {
	const summary = summarizeProviderBody(body);

	if (googleCivicIpRestrictionPattern.test(body)) {
		return `Google Civic rejected the configured API key because the current machine's public IP address is not allowed by the key restriction. Update the key's allowed IPs in Google Cloud, run verification from an allowed network, or clear GOOGLE_CIVIC_API_KEY to skip this provider locally. Response ${status}: ${summary}`;
	}

	if (googleCivicApiKeyInvalidPattern.test(body)) {
		return `Google Civic rejected the configured API key as invalid. Replace GOOGLE_CIVIC_API_KEY with a valid Civic Information API key or clear it to skip this provider locally. Response ${status}: ${summary}`;
	}

	return `Elections probe failed with ${status}: ${summary}`;
}

export function summarizeProviderProbeError(error: unknown, timeoutMs: number) {
	const name = error instanceof Error ? error.name : "";
	const message = error instanceof Error ? error.message : String(error);

	if (name === "AbortError") {
		return `Network probe timed out after ${timeoutMs}ms before the provider returned a response. Check local outbound HTTPS, DNS, proxy/VPN, and provider availability, then retry.`;
	}

	if (fetchFailedPattern.test(message)) {
		return `Network probe failed before the provider returned a response. Check local outbound HTTPS, DNS, proxy/VPN, and provider availability, then retry. Detail: ${summarizeProviderBody(message, 160)}`;
	}

	return `Probe failed: ${summarizeProviderBody(message, 220)}`;
}
