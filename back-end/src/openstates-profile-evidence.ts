import type { ElectionReferenceSource } from "./election-reference-sources.js";
import { createHash } from "node:crypto";
import { containsControlCharacters } from "./text-validation.js";

export const openStatesProfilePolicy = {
	schemaVersion: 1,
	repository: "openstates/people",
	memberDirectory: "data/STATE/legislature",
	primaryPublication: "https://data.openstates.org/people/current/STATE.csv",
	scopes: ["state-house", "state-senate"],
};

export const openStatesProfilePolicySha256 = createHash("sha256").update(JSON.stringify(openStatesProfilePolicy)).digest("hex");

export interface OpenStatesProfileMember {
	policySha256: string;
	commit: string;
	personId: string;
	memberPath: string;
	archiveSha256: string;
}

export function supportsOpenStatesProfileMembers(source: ElectionReferenceSource) {
	return /^[A-Z]{2}$/u.test(source.stateCode) && source.id === `openstates-${source.stateCode.toLowerCase()}-service-${source.electionDate.slice(0, 4)}` && source.documents.length === 1 && source.documents[0]?.url === `https://data.openstates.org/people/current/${source.stateCode.toLowerCase()}.csv` && source.documents[0]?.kind === "public-dataset" && source.documents[0]?.publisher === "Open States";
}

export function openStatesProfileLinks(member: OpenStatesProfileMember) {
	const path = member.memberPath.split("/").map(encodeURIComponent).join("/");
	return {
		url: `https://raw.githubusercontent.com/openstates/people/${member.commit}/${path}`,
		pageUrl: `https://github.com/openstates/people/blob/${member.commit}/${path}`,
	};
}

export function validateOpenStatesProfileMember(source: ElectionReferenceSource, value: unknown) {
	if (!supportsOpenStatesProfileMembers(source) || !value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== "archiveSha256,commit,memberPath,personId,policySha256")
		throw new Error("Election reference member provenance is invalid.");
	const member = value as OpenStatesProfileMember;
	if (member.policySha256 !== openStatesProfilePolicySha256 || typeof member.commit !== "string" || !/^[a-f0-9]{40}$/u.test(member.commit) || typeof member.personId !== "string" || !/^ocd-person\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(member.personId) || typeof member.archiveSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(member.archiveSha256) || typeof member.memberPath !== "string" || member.memberPath.length > 512)
		throw new Error("Election reference member provenance is invalid.");
	const parts = member.memberPath.split("/");
	if (parts.length !== 4 || parts[0] !== "data" || parts[1] !== source.stateCode.toLowerCase() || parts[2] !== "legislature" || !parts[3]?.endsWith(`-${member.personId.slice("ocd-person/".length)}.yml`) || member.memberPath.includes("\\") || containsControlCharacters(member.memberPath) || parts.some(part => !part || part === "." || part === ".."))
		throw new Error("Election reference member path is invalid.");
	return member;
}

export function openStatesProfileRecordId(source: ElectionReferenceSource, member: OpenStatesProfileMember) {
	return createHash("sha256").update(`${source.id}/${member.personId}`).digest("hex").slice(0, 24);
}
