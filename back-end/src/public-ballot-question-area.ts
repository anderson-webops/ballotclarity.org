import type { StateBallotQuestion } from "./state-ballot-questions.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import type { PublicBallotQuestionArea } from "./types/civic.js";

const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const place = (value: string) => value.length <= 100 && value === value.trim() && /^\p{L}[\p{L} .’'-]+$/u.test(value) && !/\b(?:and|or|County|City of)\b/iu.test(value);

export function publishedBallotQuestionArea(source: Pick<StateBallotSource, "stateCode" | "format">, question: StateBallotQuestion): PublicBallotQuestionArea | undefined {
	if (source.stateCode !== "GA" || source.format !== "fulton-pdf" || question.audience !== "Fulton County consolidated sample ballot" || question.textKind === "notice" || question.title.length > 350 || question.officialText.length > 20000) return undefined;
	const title = clean(question.title);
	const text = clean(question.officialText);
	const areas: PublicBallotQuestionArea[] = [];
	const add = (kind: PublicBallotQuestionArea["kind"], name: string, evidence: string, excludedMunicipalities?: string[]) => {
		if (name.length <= 120) areas.push({ kind, stateCode: "GA", name, basis: "printed-question", evidence, ...(excludedMunicipalities ? { excludedMunicipalities } : {}) });
	};
	if (/\(House Resolution [1-9]\d{0,5}\)$/u.test(title) && text.includes("Constitution of Georgia")) add("state", "Georgia", "Constitution of Georgia");
	const exclusion = /in that part of Fulton County, Georgia, outside of the City of (\p{L}[\p{L} .’'-]+), for /u.exec(text);
	if (exclusion && place(exclusion[1]!)) add("county-area", `Fulton County outside ${exclusion[1]}`, exclusion[0].trim(), [exclusion[1]!]);
	if (text.includes("majority of the qualified voters residing in Fulton County")) add("county", "Fulton County", "majority of the qualified voters residing in Fulton County");
	const authority = /authorizes the City of (\p{L}[\p{L} .’'-]+), Georgia, to /u.exec(text);
	if (authority && place(authority[1]!) && title.startsWith(`City of ${authority[1]} `)) add("city", authority[1]!, authority[0].trim());
	const residence = /a resident of (\p{L}[\p{L} .’'-]+), Georgia who own and occupy as a primary residence a home situated in the City of \1 qualify /u.exec(text);
	if (residence && place(residence[1]!) && title.startsWith(`City of ${residence[1]} `)) add("city", residence[1]!, residence[0].trim());
	return areas.length === 1 ? areas[0] : undefined;
}
