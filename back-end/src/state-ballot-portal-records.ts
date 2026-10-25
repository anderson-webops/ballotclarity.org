import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateCandidateRecord, StateContestScope } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { normalizePublicHref } from "./public-href.js";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlTableRows, stateHtmlText } from "./state-ballot-html.js";
import { southCarolinaSourceElectionId } from "./state-ballot-southern.js";

type RecordFactory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;

function object(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error("The public candidate object is invalid.");
	return value as Record<string, unknown>;
}

function text(value: unknown, optional = false) {
	if (optional && (value === null || value === undefined)) return "";
	if (typeof value !== "string" || value.length > 1000)
		throw new Error("The public candidate text field is invalid.");
	return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function requiredRecord(source: StateBallotSource, values: StateCandidateValues, factory: RecordFactory) {
	const record = factory(source, values);
	if (!record) throw new Error("The public candidate record is incomplete.");
	return record;
}

function parsePennsylvania(source: StateBallotSource, body: string, factory: RecordFactory) {
	const document = parseStateHtml(body);
	const select = stateHtmlDescendants(document, node => node.nodeName === "select" && stateHtmlAttribute(node, "id") === "ctl00_ContentPlaceHolder1_ReportElectionDropDown")[0];
	const selected = select && stateHtmlDescendants(select, node => node.nodeName === "option" && Boolean(node.attrs?.some(attribute => attribute.name === "selected")));
	if (source.electionDate !== "2026-11-03" || selected?.length !== 1 || stateHtmlAttribute(selected[0]!, "value") !== "116" || text(stateHtmlText(selected[0]!)) !== "2026 General Election (11/03/2026)")
		throw new Error("The public candidate database does not select the configured general election.");
	const containers = stateHtmlDescendants(document, node => node.nodeName === "input" && stateHtmlAttribute(node, "id") === "dataJson" && Boolean(stateHtmlAttribute(node, "value").trim()));
	if (containers.length !== 1)
		throw new Error("The public candidate database has an invalid dataset container.");
	const rows: unknown = JSON.parse(stateHtmlAttribute(containers[0]!, "value"));
	if (!Array.isArray(rows) || !rows.length || rows.length > 25_000)
		throw new Error("The public candidate database has an invalid complete record set.");
	const offices: Record<string, { scope: StateContestScope; districtKind?: string }> = {
		"GOVERNOR": { scope: "statewide" },
		"LIEUTENANT GOVERNOR": { scope: "statewide" },
		"REPRESENTATIVE IN CONGRESS": { scope: "congressional", districtKind: "Congressional" },
		"SENATOR IN THE GENERAL ASSEMBLY": { scope: "state-senate", districtKind: "Senatorial" },
		"REPRESENTATIVE IN THE GENERAL ASSEMBLY": { scope: "state-house", districtKind: "Legislative" },
	};
	return rows.flatMap((value) => {
		const row = object(value);
		if (text(row.ElectionName) !== "2026 General Election")
			throw new Error("The public candidate database mixes election years or stages.");
		const office = text(row.OfficeName);
		if (["MEMBER OF DEMOCRATIC STATE COMMITTEE", "MEMBER OF REPUBLICAN STATE COMMITTEE"].includes(office)) return [];
		const contest = offices[office];
		const status = text(row.CandidateStatusValue);
		const type = text(row.CandidateTypeValue);
		const primary = text(row.PrimaryResult);
		if (!contest || !["Approved", "Withdrawn", "Inactive-CrossFiled"].includes(status) || !["Paper", "Petition", "Substitute", "Write-in"].includes(type) || !["true", "false"].includes(primary) || !["true", "false"].includes(text(row.GeneralResult)))
			throw new Error("The public candidate status or office vocabulary has changed.");
		if (primary !== "true" && !["Paper", "Substitute"].includes(type)) return [];
		const districtLabel = text(row.DistrictName);
		const districtMatch = districtLabel.match(/^(\d+)(?:st|nd|rd|th) (Congressional|Senatorial|Legislative) District$/u);
		if (contest.scope === "statewide" ? districtLabel !== "Statewide" : !districtMatch || districtMatch[2] !== contest.districtKind || Number(districtMatch[1]) < 1)
			throw new Error("The public candidate district does not match its office.");
		const record = requiredRecord(source, {
			name: text(row.CandidateName),
			office,
			party: text(row.PartyName),
			scope: contest.scope,
			district: districtMatch?.[1],
			status: status === "Withdrawn" ? "withdrawn" : status === "Inactive-CrossFiled" ? "inactive" : "listed",
		}, factory);
		record.sourceStatus = `${status}; ${type}${primary === "true" ? "; primary winner" : ""}`;
		return [record];
	});
}

function campaignUrl(value: unknown) {
	const published = text(value, true);
	const href = /^https?:\/\//iu.test(published) ? published : /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/?#].*)?$/iu.test(published) ? `https://${published}` : "";
	return normalizePublicHref(href) || undefined;
}

function parseWestVirginia(source: StateBallotSource, body: string, factory: RecordFactory) {
	const envelope = object(JSON.parse(body));
	if (!Array.isArray(envelope.documents) || envelope.documents.length !== 2)
		throw new Error("The public candidate document set is incomplete.");
	const seen = new Set<number>();
	return envelope.documents.flatMap((value: unknown, index: number) => {
		const document = object(value);
		if (document.candidateType !== ["R", "W"][index] || typeof document.body !== "string")
			throw new Error("The public candidate document types have changed.");
		const response = object(JSON.parse(document.body));
		const data = object(response.data);
		const meta = object(response.meta);
		const rows = data.candidates;
		if (response.error || !Array.isArray(rows) || rows.length > 5000 || meta.first !== true || meta.last !== true || meta.number !== 0 || meta.size !== 5000 || meta.totalElements !== rows.length || meta.numberOfElements !== rows.length || meta.totalPages !== (rows.length ? 1 : 0))
			throw new Error("The public candidate results do not contain every page.");
		return rows.flatMap((value: unknown) => {
			const row = object(value);
			const electionDate = text(row.electionDate);
			const electionType = text(row.electionType);
			if (electionDate !== "11/03/2026" || electionType !== "GENERAL") return [];
			if (source.electionDate !== "2026-11-03" || row.electionId !== 19080 || text(row.electionName) !== "11/03/2026 - GENERAL 2026" || (index === 1 ? row.candidateType !== "W" : !["R", "N"].includes(text(row.candidateType))))
				throw new Error("The public candidate record does not match the configured election.");
			if (typeof row.candidateId !== "number" || !Number.isSafeInteger(row.candidateId) || row.candidateId < 1 || seen.has(row.candidateId))
				throw new Error("The public candidate identity is invalid or duplicated.");
			seen.add(row.candidateId);
			let office = text(row.officeName);
			if (/EXECUTIVE COMMITTEE/u.test(office))
				throw new Error("The general-election record set contains a party committee office.");
			const division = text(row.divisionNumber, true);
			if (division && !/\bDIVISION\b/u.test(office)) office += `, Division ${division}`;
			const record = requiredRecord(source, {
				name: text(row.candidateBallotName),
				office,
				party: text(row.partyDescription, true),
				status: index === 1 ? "write-in" : "listed",
				jurisdiction: text(row.townName, true) || text(row.candidateDistrictName, true),
				candidateUrl: campaignUrl(row.website),
				sourceCandidateId: String(row.candidateId),
				sourceDistrictLabel: text(row.candidateDistrictName, true),
				sourceDivision: division,
				sourceAreaLabel: text(row.magisterialDistrict, true),
			}, factory);
			record.sourceStatus = `${electionType}; ${text(row.candidateType)}`;
			return [record];
		});
	});
}

export function parseStatePortalRecords(source: StateBallotSource, body: string, factory: RecordFactory) {
	if (source.format === "pennsylvania-html") return parsePennsylvania(source, body, factory);
	if (source.format === "west-virginia-json") return parseWestVirginia(source, body, factory);
	if (source.format === "south-carolina-html") return parseSouthCarolina(source, body, factory);
	if (source.format === "alaska-html") return parseAlaska(source, body, factory);
	if (source.format === "kansas-html") return parseKansas(source, body, factory);
	throw new Error("No parser is configured for this public candidate portal.");
}

function parseKansas(source: StateBallotSource, body: string, factory: RecordFactory) {
	const document = parseStateHtml(body);
	const hasClass = (node: ReturnType<typeof parseStateHtml>, name: string) => stateHtmlAttribute(node, "class").split(/\s+/u).includes(name);
	const selection = (name: string) => {
		const controls = stateHtmlDescendants(document, node => node.nodeName === "select" && stateHtmlAttribute(node, "name") === name);
		if (controls.length !== 1) throw new Error("The Kansas candidate filters have changed.");
		const selected = stateHtmlDescendants(controls[0]!, node => node.nodeName === "option" && Boolean(node.attrs?.some(attribute => attribute.name === "selected")));
		if (selected.length !== 1) throw new Error("The Kansas candidate filter selection is missing.");
		return { value: stateHtmlAttribute(selected[0]!, "value"), label: text(stateHtmlText(selected[0]!)) };
	};
	const election = selection("field_election_reference_target_id");
	if (source.electionDate !== "2026-11-03" || election.value !== "6023" || election.label !== "November 3, 2026 General Election" || selection("field_office_jurisdiction_target_id_1").value !== "All" || selection("field_office_level_target_id_1").value !== "All")
		throw new Error("The Kansas candidate page is not the complete configured general-election selection.");
	if (stateHtmlDescendants(document, node => stateHtmlAttribute(node, "class").split(/\s+/u).some(value => /^pager(?:$|__|-)/u.test(value)) || stateHtmlAttribute(node, "rel").split(/\s+/u).includes("next")).length)
		throw new Error("The Kansas candidate page is paginated; a complete source is required.");
	const containers = stateHtmlDescendants(document, node => hasClass(node, "view-content"));
	const indicators = stateHtmlDescendants(document, node => hasClass(node, "view-filters-info"));
	if (containers.length !== 1 || indicators.length !== 1 || text(stateHtmlText(indicators[0]!)) !== "Showing All Candidates")
		throw new Error("The Kansas candidate result layout has changed.");
	const content = containers[0]!;
	const allCards = stateHtmlDescendants(document, node => hasClass(node, "candidate--teaser"));
	if (!allCards.length || allCards.length > 5000) throw new Error("The Kansas candidate results are empty or exceed their limit.");
	const records: StateCandidateRecord[] = [];
	const operationalText = (node: ReturnType<typeof parseStateHtml>): string => {
		if (["script", "style"].includes(node.nodeName)) return "";
		if (node.nodeName === "li" && stateHtmlDescendants(node, child => child.nodeName === "label" && ["City:", "Phone:", "Website:", "E-mail:"].includes(text(stateHtmlText(child)))).length) return "";
		return node.value ?? (node.childNodes ?? []).map(operationalText).join(" ");
	};
	for (const group of (content.childNodes ?? []).filter(node => hasClass(node, "view-grouping"))) {
		const headers = (group.childNodes ?? []).filter(node => hasClass(node, "view-grouping-header"));
		if (headers.length !== 1) throw new Error("The Kansas candidate jurisdiction heading is missing.");
		const heading = text(stateHtmlText(headers[0]!));
		if (!heading || heading.length > 250) throw new Error("The Kansas candidate jurisdiction heading is invalid.");
		let office = "";
		const visit = (node: ReturnType<typeof parseStateHtml>) => {
			if (node.nodeName === "h3") office = text(stateHtmlText(node));
			if (!hasClass(node, "candidate--teaser")) {
				for (const child of node.childNodes ?? []) visit(child);
				return;
			}
			const names = stateHtmlDescendants(node, child => child.nodeName === "h4" && hasClass(child, "title"));
			const parties = stateHtmlDescendants(node, child => hasClass(child, "party"));
			const fields = stateHtmlDescendants(node, child => child.nodeName === "li");
			if (stateHtmlDescendants(node, child => child.nodeName === "label").some(child => !["Incumbent:", "City:", "Phone:", "Website:", "E-mail:"].includes(text(stateHtmlText(child)))) || /\b(?:withdrawn|withdrew|deceased|disqualified|defeated|unopposed|elected)\b/iu.test(operationalText(node)))
				throw new Error("The Kansas candidate card contains an unreviewed status or field.");
			const field = (label: string) => fields.filter(child => stateHtmlDescendants(child, item => item.nodeName === "label" && text(stateHtmlText(item)) === label).length);
			const incumbents = field("Incumbent:");
			if (!office || names.length !== 1 || parties.length !== 1 || incumbents.length !== 1)
				throw new Error("The Kansas candidate card is incomplete.");
			const incumbent = text(stateHtmlText(incumbents[0]!)).replace(/^Incumbent:\s*/u, "");
			const name = text(stateHtmlText(names[0]!));
			const party = text(stateHtmlText(parties[0]!));
			if (!["Yes", "No"].includes(incumbent) || !["Democratic", "Republican", "Libertarian", "United Kansas", "Nonpartisan office"].includes(party))
				throw new Error("The Kansas candidate party or incumbent vocabulary has changed.");
			let scope: StateContestScope;
			let district = "";
			let jurisdiction: string | undefined;
			const house = office.match(/^Kansas Representative ([1-9]\d*)$/u);
			const congress = office.match(/^U\.S\. Representative ([1-9]\d*)(?:st|nd|rd|th) District$/u);
			const statewideJudicial = /^Kansas (?:Supreme Court Justice|Court of Appeals Judge) Position [1-9]\d*$/u.test(office);
			const localJudicial = /^(?:10th Judicial District Judge Division|10th District Magistrate Judge Position) [1-9]\d*$/u.test(office);
			if (["U.S. Senate", "Governor/Lieutenant Governor", "Secretary of State", "Attorney General", "State Treasurer", "Commissioner of Insurance"].includes(office) || statewideJudicial) {
				scope = "statewide";
			}
			else if (house || congress) {
				scope = house ? "state-house" : "congressional";
				district = (house ?? congress)![1]!;
			}
			else if (localJudicial || /^State Board of Education [1-9]\d*$/u.test(office) || /^County Commissioner (?:Chairman|District [1-9]\d*)$/u.test(office) || (office === "Clerk" && heading.endsWith(" Township")) || office === "Mayor") {
				scope = "local";
				district = localJudicial ? "10" : office.match(/(?:District|Education) ([1-9]\d*)$/u)?.[1] ?? "";
				jurisdiction = localJudicial ? "10th Judicial District" : office === "Clerk" || office === "Mayor" ? heading : office.startsWith("County Commissioner") ? "Johnson County" : "State Board of Education";
			}
			else {
				throw new Error("The Kansas candidate office or jurisdiction vocabulary has changed.");
			}
			if (office === "Governor/Lieutenant Governor" && (name.split(" / ").length !== 2 || name.split(" / ").some(member => !member.trim())))
				throw new Error("The Kansas governor ticket is incomplete.");
			if ((statewideJudicial || localJudicial) && party !== "Nonpartisan office")
				throw new Error("The Kansas retention office has an unexpected party label.");
			const websites = field("Website:");
			if (websites.length > 1) throw new Error("The Kansas candidate has ambiguous website fields.");
			const record = requiredRecord(source, { name, office: statewideJudicial || localJudicial ? `${office}, Judicial retention` : office, party, scope, district, jurisdiction, status: "listed", candidateUrl: websites[0] ? campaignUrl(text(stateHtmlText(websites[0])).replace(/^Website:\s*/u, "")) : undefined }, factory);
			if (incumbent === "Yes") record.ballotDesignation = "Incumbent";
			if (statewideJudicial || localJudicial) record.sourceStatus = "Judicial retention election";
			if (heading === "Spring Hill Township" && name === "Tara A. Combs") record.sourceStatus = "Revised notice: Tara A. Combes";
			records.push(record);
		};
		visit(group);
	}
	if (records.length !== allCards.length || new Set(records.map(record => record.id)).size !== records.length)
		throw new Error("The Kansas candidate groups are incomplete or duplicated.");
	return records;
}

export function buildSouthCarolinaSearchForm(source: StateBallotSource, body: string) {
	const electionId = southCarolinaSourceElectionId(source);
	const document = parseStateHtml(body);
	const forms = stateHtmlDescendants(document, node => node.nodeName === "form" && stateHtmlAttribute(node, "id") === "searchForm");
	const label = `${Number(source.electionDate.slice(5, 7))}/${Number(source.electionDate.slice(8))}/${source.electionDate.slice(0, 4)} Statewide General Election`;
	if (forms.length !== 1 || stateHtmlDescendants(forms[0]!, node => node.nodeName === "h2" && text(stateHtmlText(node)) === label).length !== 1)
		throw new Error("The public search does not identify the configured general election.");
	const inputs = stateHtmlDescendants(forms[0]!, node => node.nodeName === "input");
	const field = (name: string) => inputs.filter(node => stateHtmlAttribute(node, "name") === name);
	if (field("ElectionId").length !== 1 || stateHtmlAttribute(field("ElectionId")[0]!, "value") !== electionId || field("ExportFileName").length !== 1)
		throw new Error("The public search election identity has changed.");
	const filename = stateHtmlAttribute(field("ExportFileName")[0]!, "value");
	if (!filename.includes(`${electionId}_${source.electionDate.slice(5, 7)}_${source.electionDate.slice(8)}_${source.electionDate.slice(0, 4)}`) || filename.length > 300)
		throw new Error("The public search export identity has changed.");
	const fields = new URLSearchParams({ ElectionId: electionId, ExportFileName: filename, CandidateFirstName: "", CandidateLastName: "" });
	const selectors = stateHtmlDescendants(forms[0]!, node => node.nodeName === "select");
	const counties = selectors.filter(node => stateHtmlAttribute(node, "name") === "SelectedAssociatedCounties");
	if (selectors.length !== 4 + counties.length || counties.length > 1 || counties.some(node => stateHtmlDescendants(node, child => child.nodeName === "option" && Boolean(child.attrs?.some(attribute => attribute.name === "selected")) && stateHtmlAttribute(child, "value") !== "").length > 0)) throw new Error("The public candidate search contains changed or filtered controls.");
	for (const name of ["SelectedOffice", "SelectedCandidateStatus", "SelectedPoliticalParty", "SelectedFilingLocation"]) {
		const select = stateHtmlDescendants(forms[0]!, node => node.nodeName === "select" && stateHtmlAttribute(node, "name") === name);
		const options = select.length === 1 && stateHtmlDescendants(select[0]!, node => node.nodeName === "option" && text(stateHtmlText(node)) === "All");
		if (!options || options.length !== 1)
			throw new Error("The public search no longer supports an unfiltered request.");
		const selected = stateHtmlDescendants(select[0]!, node => node.nodeName === "option" && Boolean(node.attrs?.some(attribute => attribute.name === "selected")));
		if (selected.length > 1 || (selected[0] ?? stateHtmlDescendants(select[0]!, node => node.nodeName === "option")[0]) !== options[0]) throw new Error("The public candidate search has a selected filter.");
		fields.set(name, stateHtmlAttribute(options[0]!, "value"));
	}
	return fields.toString();
}

function parseSouthCarolina(source: StateBallotSource, body: string, factory: RecordFactory) {
	const envelope = object(JSON.parse(body));
	const electionId = southCarolinaSourceElectionId(source);
	if (Object.keys(envelope).sort().join(",") !== "page,records" || typeof envelope.page !== "string" || typeof envelope.records !== "string")
		throw new Error("The public search envelope is invalid.");
	buildSouthCarolinaSearchForm(source, envelope.page);
	const document = parseStateHtml(envelope.records);
	const election = stateHtmlDescendants(document, node => node.nodeName === "input" && stateHtmlAttribute(node, "id") === "ElectionId");
	const tables = stateHtmlDescendants(document, node => node.nodeName === "table");
	if (election.length !== 1 || stateHtmlAttribute(election[0]!, "value") !== electionId || tables.length !== 1 || stateHtmlAttribute(tables[0]!, "id") !== "gridCandidateSearch" || !/<\/tbody\s*>[\s\S]*<\/table\s*>/iu.test(envelope.records))
		throw new Error("The public candidate results are incomplete or identify a different election.");
	const rows = stateHtmlTableRows(tables[0]!);
	const cells = (row: typeof document) => (row.childNodes ?? []).filter(node => ["td", "th"].includes(node.nodeName));
	if (cells(rows[0]!).map(node => text(stateHtmlText(node))).join("|") !== "Office|Associated Counties|Name on Ballot|Running Mate|Party|Location of Filing|Candidate Status" || rows.length < 2 || rows.length > 25_001)
		throw new Error("The public candidate result columns have changed.");
	const statuses: Record<string, StateCandidateRecord["status"]> = {
		"Active": "listed",
		"Deceased After Primary": "inactive",
		"Deceased Before Primary": "inactive",
		"Deceased Before Election": "inactive",
		"Decertified before Primary": "disqualified",
		"Decertified after Primary": "disqualified",
		"Defeated At Convention": "defeated",
		"Defeated In Primary": "defeated",
		"Defeated in Election": "defeated",
		"Disqualified before Primary": "disqualified",
		"Disqualified after Primary": "disqualified",
		"Not Certified for General": "disqualified",
		"Not Certified for Primary": "disqualified",
		"Petition Failed": "disqualified",
		"Withdrew": "withdrawn",
		"Withdrew After Primary": "withdrawn",
		"Withdrew Before Primary": "withdrawn",
		"Elected": "elected",
	};
	const statewide = ["President and Vice President", "Governor and Lieutenant Governor", "Secretary of State", "State Treasurer", "Attorney General", "Comptroller General", "State Superintendent of Education", "Commissioner of Agriculture", "U.S. Senate"];
	const identifiers = new Set<string>();
	return rows.slice(1).map((row, index) => {
		const columns = cells(row);
		const values = columns.map(node => text(stateHtmlText(node)));
		const identifier = stateHtmlAttribute(row, "data-key");
		if (columns.length !== 7 || stateHtmlAttribute(row, "data-index") !== String(index) || !/^[1-9]\d*$/u.test(identifier) || identifiers.has(identifier) || !Object.hasOwn(statuses, values[6]!))
			throw new Error("The public candidate result identity, order or status has changed.");
		identifiers.add(identifier);
		const office = values[0]!;
		const federal = office.match(/^U\.S\. House of Representatives, District ([1-7])$/u);
		const house = office.match(/^State House of Representatives, District (\d+)$/u);
		const senate = office.match(/^State Senate, District (\d+)$/u);
		if ((office.startsWith("U.S. House") && !federal) || (office.startsWith("State House") && (!house || Number(house[1]) < 1 || Number(house[1]) > 124)) || (office.startsWith("State Senate") && (!senate || Number(senate[1]) < 1 || Number(senate[1]) > 46)))
			throw new Error("The public legislative office does not identify a recognized district.");
		let name = values[2]!;
		const runningMate = values[3]!;
		if (["President and Vice President", "Governor and Lieutenant Governor"].includes(office) && values[6] === "Active") {
			const activeMate = runningMate.match(/^(.+) \(Active\)$/u);
			if (!activeMate && (office !== "President and Vice President" || runningMate !== "Not Designated")) throw new Error("The public candidate ticket does not identify its running mate or explicit missing designation.");
			if (activeMate) name += ` / ${activeMate[1]}`;
		}
		const links = stateHtmlDescendants(columns[2]!, node => node.nodeName === "a" && Boolean(stateHtmlAttribute(node, "href")));
		if (links.length !== 1) throw new Error("The public candidate detail link is missing or ambiguous.");
		const candidateUrl = new URL(stateHtmlAttribute(links[0]!, "href"), source.pageUrl);
		if (candidateUrl.origin !== new URL(source.pageUrl).origin || candidateUrl.pathname !== "/Candidate/CandidateDetail/" || candidateUrl.searchParams.get("candidateId") !== identifier || candidateUrl.searchParams.get("electionId") !== electionId)
			throw new Error("The public candidate detail identity does not match its row.");
		const record = requiredRecord(source, {
			name,
			office,
			party: values[4]!,
			scope: statewide.includes(office) ? "statewide" : federal ? "congressional" : house ? "state-house" : senate ? "state-senate" : "local",
			district: federal?.[1] ?? house?.[1] ?? senate?.[1],
			jurisdiction: values[1],
			candidateUrl: candidateUrl.href,
			sourceCandidateId: identifier,
			sourceAreaLabel: values[1],
			status: statuses[values[6]!]!,
		}, factory);
		record.sourceStatus = values[6]!;
		return record;
	});
}

function parseAlaska(source: StateBallotSource, body: string, factory: RecordFactory) {
	const envelope = object(JSON.parse(body));
	if (source.electionDate !== "2026-11-03" || !Array.isArray(envelope.documents) || envelope.documents.length !== 3 || source.documentUrls?.length !== 3)
		throw new Error("The Alaska candidate document set is incomplete.");
	const records = envelope.documents.flatMap((value: unknown, index: number) => {
		const item = object(value);
		if (item.url !== source.documentUrls?.[index] || typeof item.body !== "string") throw new Error("The Alaska candidate document order has changed.");
		const document = parseStateHtml(item.body);
		const textContent = stateHtmlText(document).replace(/\s+/gu, " ").trim();
		if (!stateHtmlDescendants(document, node => node.nodeName === "h2" && text(stateHtmlText(node)) === "2026 General Election").length || !textContent.includes("Election Date November 3, 2026"))
			throw new Error("The Alaska candidate page does not identify the configured general election.");
		const pagers = stateHtmlDescendants(document, node => node.nodeName === "ul" && stateHtmlAttribute(node, "class").split(/\s/u).includes("frm_pagination"));
		const active = pagers.length === 1 && stateHtmlDescendants(pagers[0]!, node => node.nodeName === "li" && stateHtmlAttribute(node, "class").split(/\s/u).includes("active"));
		const pageNumbers = pagers.length === 1 && [...new Set(stateHtmlDescendants(pagers[0]!, node => node.nodeName === "a").map((node) => {
			const url = new URL(stateHtmlAttribute(node, "href"), source.url);
			if (url.origin !== new URL(source.url).origin || url.pathname !== "/candidates/" || url.searchParams.get("election") !== "26genr") throw new Error("The Alaska candidate pager has changed.");
			return url.searchParams.get("frm-page-407");
		}))].sort();
		if (!active || active.length !== 1 || text(stateHtmlText(active[0]!)) !== String(index + 1) || JSON.stringify(pageNumbers) !== "[\"1\",\"2\",\"3\"]")
			throw new Error("The Alaska candidate pagination is incomplete or changed.");
		let office = "";
		const records = [];
		for (const node of stateHtmlDescendants(document, child => child.nodeName === "h4" || child.nodeName === "table")) {
			if (node.nodeName === "h4") {
				office = text(stateHtmlText(node));
				continue;
			}
			const legislative = office.match(/^(SENATE|HOUSE) DISTRICT ([A-T]|\d{2})$/u);
			if (legislative && (legislative[1] === "SENATE" ? !/^[A-T]$/u.test(legislative[2]!) : !/^(?:0[1-9]|[1-3]\d|40)$/u.test(legislative[2]!))) throw new Error("The Alaska legislative district does not match its office.");
			const judicial = office.match(/^(?:SUPREME COURT|STATE SUPERIOR COURT 0[1-4]|STATE DISTRICT COURT 0[1-4])$/u);
			const statewide = ["GOVERNOR / LIEUTENANT GOVERNOR", "UNITED STATES SENATOR", "UNITED STATES REPRESENTATIVE"].includes(office);
			if (!statewide && !legislative && !judicial) throw new Error("The Alaska candidate office has changed.");
			const rows = stateHtmlTableRows(node);
			const cells = (row: typeof node) => (row.childNodes ?? []).filter(child => ["th", "td"].includes(child.nodeName));
			const headers = cells(rows[0]!).map(child => text(stateHtmlText(child)));
			if (headers.length !== 4 || headers[0] !== "Candidate Name on Ballot" || !["Campaign Address", "Address"].includes(headers[1]!) || headers[2] !== "Contact" || headers[3] !== "Election Pamphlet Information" || rows.length < 2)
				throw new Error("The Alaska candidate columns have changed.");
			for (const row of rows.slice(1)) {
				const columns = cells(row);
				if (columns.length !== 4) throw new Error("The Alaska candidate row is incomplete.");
				const names = stateHtmlDescendants(columns[0]!, child => child.nodeName === "strong");
				const details = stateHtmlDescendants(columns[0]!, child => child.nodeName === "small");
				const flags = stateHtmlDescendants(columns[0]!, child => child.nodeName === "span").map(child => text(stateHtmlText(child))).filter(Boolean);
				const status = details.length === 1 && text(stateHtmlText(details[0]!)).match(/^(?:\((Registered Republican(?: \/ Registered Democrat)?|Registered Democrat(?: \/ Nonpartisan)?|Registered Libertarian|Nonpartisan|Undeclared)\) )?\(Certified\)$/u);
				if (names.length !== 1 || !status || flags.some(flag => flag !== "Certified Write-In")) throw new Error("The Alaska candidate certification or name has changed.");
				const websites = stateHtmlDescendants(columns[2]!, child => child.nodeName === "a" && /^https?:\/\//iu.test(stateHtmlAttribute(child, "href")));
				if (websites.length > 1) throw new Error("The Alaska candidate website is ambiguous.");
				const record = requiredRecord(source, {
					name: text(stateHtmlText(names[0]!)),
					office: judicial ? `${office}, Judicial retention` : office,
					party: status[1] ?? "",
					scope: statewide || office === "SUPREME COURT" ? "statewide" : legislative ? legislative[1] === "SENATE" ? "state-senate" : "state-house" : "local",
					district: legislative?.[2],
					jurisdiction: judicial ? office : undefined,
					status: flags.length ? "write-in" : "qualified",
					candidateUrl: websites[0] && campaignUrl(stateHtmlAttribute(websites[0], "href")),
					sourceDistrictLabel: office,
				}, factory);
				record.sourceStatus = flags.length ? "Certified Write-In" : "Certified";
				records.push(record);
			}
		}
		if (!records.length) throw new Error("The Alaska candidate page is empty.");
		return records;
	});
	const repeated = new Map<string, string>();
	for (const record of records) {
		const content = JSON.stringify(record);
		if (repeated.has(record.id) && repeated.get(record.id) !== content)
			throw new Error("The repeated Alaska candidate claims are inconsistent.");
		repeated.set(record.id, content);
	}
	return records;
}
