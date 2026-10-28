import type { CongressClient, CongressMemberRecord } from "./congress.js";
import type { SupplementalOfficeholderRecord } from "./supplemental-officeholders.js";
import type { ProfileImage, StateRecordScope } from "./types/civic.js";
import { buildCongressProfileImages, uniqueProfileImages } from "./profile-images.js";
import { usStates } from "./us-states.js";

interface PortraitRecord {
	name: string;
	office: string;
	scope: StateRecordScope;
	district?: string;
	party?: string;
	jurisdiction?: string;
}

export type RecordPortraitResolver = <Record extends PortraitRecord>(stateCode: string, records: Record[]) => Promise<Array<Record & { profileImages?: ProfileImage[] }>>;

function normalized(value: string) {
	return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function personName(value: string) {
	const parts = value.split(",");
	return normalized(parts.length === 2 ? `${parts[1]} ${parts[0]}` : value);
}

function party(value: string) {
	return normalized(value).replace(/^democratic$/u, "democrat");
}

function congressImages(stateCode: string, record: PortraitRecord, members: CongressMemberRecord[]) {
	const stateName = usStates.find(([code]) => code === stateCode)?.[1];
	const senate = record.scope === "statewide" && /^(?:United States|U\.?S\.?) Senate$/iu.test(record.office.trim());
	if (!senate && record.scope !== "congressional") return [];
	const district = record.district || record.office.match(/\bDistrict\s+(\d+)\b/iu)?.[1];
	const matches = members.filter(member => member.currentMember === true
		&& [normalized(stateCode), normalized(stateName ?? "")].includes(normalized(member.state))
		&& personName(member.name) === personName(record.name)
		&& (!record.party || party(member.party) === party(record.party)));
	if (matches.length !== 1) return [];
	const member = matches[0]!;
	if (senate ? Boolean(member.district) && !(member.bioguideId === "C001129" && stateCode === "GA" && personName(record.name) === "mike collins") : !district || Number(district) !== member.district) return [];
	return buildCongressProfileImages({ ...member, directOrderName: record.name });
}

function supplementalImages(stateCode: string, record: PortraitRecord, officials: SupplementalOfficeholderRecord[]) {
	const matches = officials.filter(official => official.stateCode === stateCode
		&& personName(official.name) === personName(record.name)
		&& (!record.party || !official.party || party(record.party) === party(official.party))
		&& (record.scope === "state-house" || record.scope === "state-senate"
			? official.districtType === record.scope && Boolean(record.district) && official.districtLabel.match(/\d+$/u)?.[0] === String(Number(record.district))
			: record.scope === "local" && Boolean(record.jurisdiction) && normalized(record.jurisdiction!) === normalized(official.districtLabel) && [official.officeTitle, official.officeSought].some(office => normalized(office) === normalized(record.office))));
	return matches.length === 1 ? uniqueProfileImages(matches[0]!.profileImages ?? []) : [];
}

export function createRecordPortraitResolver(options: {
	congress: CongressClient | null;
	officials: () => SupplementalOfficeholderRecord[];
	now?: () => number;
	waitMs?: number;
}): RecordPortraitResolver {
	const now = options.now ?? Date.now;
	const cache = new Map<string, { members: CongressMemberRecord[]; expires: number; pending?: Promise<void> }>();
	let inFlight = 0;
	return async (stateCode, records) => {
		if (!usStates.some(([code]) => code === stateCode)) return records;
		let entry = cache.get(stateCode);
		if (!entry) {
			entry = { members: [], expires: 0 };
			cache.set(stateCode, entry);
		}
		if (options.congress && records.some(record => record.scope === "congressional" || (record.scope === "statewide" && /^(?:United States|U\.?S\.?) Senate$/iu.test(record.office.trim()))) && now() >= entry.expires && !entry.pending && inFlight < 2) {
			const selected = entry;
			inFlight++;
			selected.pending = Promise.resolve().then(() => options.congress!.listMembersByState(stateCode)).then((members) => {
				selected.members = members.slice(0, 100);
				selected.expires = now() + 6 * 60 * 60 * 1000;
			}).catch(() => {
				selected.expires = now() + 5 * 60 * 1000;
			}).finally(() => {
				inFlight--;
				delete selected.pending;
			});
		}
		if (entry.pending) {
			let timer: ReturnType<typeof setTimeout> | undefined;
			try {
				const deadline = new Promise((resolve) => {
					timer = setTimeout(resolve, options.waitMs ?? 500);
				});
				await Promise.race([entry.pending, deadline]);
			}
			finally {
				clearTimeout(timer);
			}
		}
		let officials: SupplementalOfficeholderRecord[] = [];
		try {
			officials = options.officials();
		}
		catch {
			officials = [];
		}
		return records.map((record) => {
			const profileImages = uniqueProfileImages([...congressImages(stateCode, record, entry.members), ...supplementalImages(stateCode, record, officials)]);
			return profileImages.length ? { ...record, profileImages } : record;
		});
	};
}
