import type {
	AlabamaCandidateClaim,
	AlabamaField,
	AlabamaHeldField,
	AlabamaNativeReview,
	AlabamaOfficeContext,
	AlabamaSourceIdentity,
	AlabamaTextSpan,
	AlabamaVisibleContent
} from "./state-ballot-alabama-types.js";
import assert from "node:assert/strict";
import { alabamaCells } from "./state-ballot-alabama-cells.js";
import { proveAlabamaFieldDrawings } from "./state-ballot-alabama-field-drawings.js";
import { proveAlabamaOfficeFrame, proveAlabamaOfficeRows } from "./state-ballot-alabama-rows.js";
import { alabamaHash as hash } from "./state-ballot-alabama-types.js";

const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
function isParty(value: string) {
	return ["democrat", "republican", "independent", "libertarian"].includes(value.toLowerCase());
}
function proved(span: AlabamaTextSpan, content: AlabamaVisibleContent) {
	return span.fontProven
		&& span.glyphs.every(
			glyph =>
				glyph.fontProven
				&& glyph.backgroundProven
				&& !glyph.clipped
				&& glyph.fill === "black"
				&& glyph.alpha === 1
				&& glyph.render === 0
				&& glyph.blend === "/Normal"
		)
		&& !content.uncertainOverlays.some(item => item.glyph.operation === span.operation);
}
function within(span: AlabamaTextSpan, bounds: number[]) {
	const horizontal = (span.bounds[0] + span.bounds[2]) / 2;
	const vertical = (span.bounds[1] + span.bounds[3]) / 2;
	return (
		horizontal > bounds[0] - 0.2
		&& horizontal < bounds[2] + 0.2
		&& vertical > bounds[1] - 0.2
		&& vertical < bounds[3] + 0.2
	);
}
export function headingText(spans: AlabamaTextSpan[]) {
	const lines = spans.map(span => clean(span.text));
	for (let index = 0; index < lines.length; index++) {
		for (let count = 1; count <= index; count++) {
			if (lines.slice(index - count, index).join(" ") === lines[index]) lines[index] = "";
		}
	}
	return clean(lines.join(" ")).replace(/\s+,/gu, ",");
}
export function officeContext(heading: string, county: string): AlabamaOfficeContext {
	const named = new Map([
		["FOR GOVERNOR", "Governor"],
		["FOR LIEUTENANT GOVERNOR", "Lieutenant Governor"],
		["FOR UNITED STATES SENATOR", "U.S. Senate"],
		["FOR ATTORNEY GENERAL", "Attorney General"],
		["FOR SECRETARY OF STATE", "Secretary of State"],
		["FOR STATE TREASURER", "State Treasurer"],
		["FOR STATE AUDITOR", "State Auditor"],
		["FOR COMMISSIONER OF AGRICULTURE AND INDUSTRIES", "Commissioner of Agriculture and Industries"]
	]);
	if (named.has(heading)) return { office: named.get(heading)!, district: "", scope: "statewide" };
	let match;
	match = /^FOR UNITED STATES REPRESENTATIVE,? ([1-9]\d?)(?:ST|ND|RD|TH) CONGRESSIONAL DISTRICT$/u.exec(heading);
	if (match) return { office: "U.S. Representative", district: match[1], scope: "congressional" };
	match = /^FOR STATE (SENATOR|REPRESENTATIVE),? DISTRICT NO\. ([1-9]\d{0,2})$/u.exec(heading);
	if (match) {
		return {
			office: match[1] === "SENATOR" ? "State Senator" : "State Representative",
			district: match[2],
			scope: match[1] === "SENATOR" ? "state-senate" : "state-house"
		};
	}
	match = /^FOR PUBLIC SERVICE COMMISSION, PLACE ?NO\. ([1-9])$/u.exec(heading);
	if (match) return { office: `Public Service Commissioner, Place ${match[1]}`, district: "", scope: "statewide" };
	match = /^FOR ASSOCIATE JUSTICE OF THE SUPREME COURT, PLACE ?([1-9])$/u.exec(heading);
	if (match) {
		return {
			office: `Associate Justice of the Supreme Court, Place ${match[1]}`,
			district: "",
			scope: "statewide"
		};
	}
	match = /^FOR COURT OF (CIVIL|CRIMINAL) APPEALS JUDGE, PLACE ([1-9])$/u.exec(heading);
	if (match) {
		return {
			office: `Court of ${match[1] === "CIVIL" ? "Civil" : "Criminal"} Appeals, Place ${match[2]}`,
			district: "",
			scope: "statewide"
		};
	}
	match = /^FOR CIRCUIT COURT JUDGE, ([1-9]\d?)(?:ST|ND|RD|TH) JUDICIAL CIRCUIT, PLACE NO\. ([1-9]\d?)$/u.exec(
		heading
	);
	if (match) {
		return {
			office: `Circuit Court Judge, Circuit ${match[1]}, Place ${match[2]}`,
			district: match[1],
			scope: "local",
			jurisdiction: `Judicial Circuit ${match[1]}`
		};
	}
	const prefix = `${county.toUpperCase()} COUNTY`;
	if (heading === `FOR ${prefix} SHERIFF`)
		return { office: "Sheriff", district: "", scope: "local", jurisdiction: `${county} County` };
	if (heading === `FOR ${prefix} REVENUE COMMISSIONER`)
		return { office: "Revenue Commissioner", district: "", scope: "local", jurisdiction: `${county} County` };
	if (heading === `FOR ${prefix} CORONER`)
		return { office: "Coroner", district: "", scope: "local", jurisdiction: `${county} County` };
	if (heading === `FOR ${prefix} RACING COMMISSIONER`)
		return { office: "Racing Commissioner", district: "", scope: "local", jurisdiction: `${county} County` };
	for (const label of ["TAX ASSESSOR", "TAX COLLECTOR"]) {
		if (heading === `FOR ${label}, ${prefix}`) {
			return {
				office: label === "TAX ASSESSOR" ? "Tax Assessor" : "Tax Collector",
				district: "",
				scope: "local",
				jurisdiction: `${county} County`
			};
		}
	}
	match = /^FOR MEMBER, STATE BOARD OF EDUCATION, DISTRICT NO\. ([1-9])$/u.exec(heading);
	if (match) {
		return {
			office: `Member, State Board of Education, District ${match[1]}`,
			district: match[1],
			scope: "state-board-of-education",
			jurisdiction: `Alabama State Board of Education District ${match[1]}`
		};
	}
	if (
		heading.startsWith(`FOR MEMBER, ${prefix} COMMISSION, DISTRICT NO. `)
		|| heading.startsWith(`FOR MEMBER, ${prefix} COMMISSION DISTRICT NO. `)
	) {
		match = /DISTRICT NO\. ([1-9]\d?)$/u.exec(heading);
		if (match) {
			return {
				office: `Member, ${county} County Commission, District ${match[1]}`,
				district: match[1],
				scope: "local",
				jurisdiction: `${county} County Commission District ${match[1]}`
			};
		}
	}
	if (heading.startsWith(`FOR MEMBER, ${prefix} BOARD OF EDUCATION, PLACE `)) {
		match = /PLACE ([1-9]\d?)$/u.exec(heading);
		if (match) {
			return {
				office: `Member, ${county} County Board of Education, Place ${match[1]}`,
				district: match[1],
				scope: "local",
				jurisdiction: `${county} County Board of Education Place ${match[1]}`
			};
		}
	}
	if (heading.endsWith(`, BESSEMER DIVISION OF ${prefix}`)) {
		match = /^FOR ASSISTANT (TAX ASSESSOR|TAX COLLECTOR),/u.exec(heading);
		if (match) {
			return {
				office: `Assistant ${match[1] === "TAX ASSESSOR" ? "Tax Assessor" : "Tax Collector"}, Bessemer Division`,
				district: "",
				scope: "local",
				jurisdiction: `Bessemer Division of ${county} County`
			};
		}
	}
	if (heading.startsWith(`FOR DISTRICT COURT JUDGE, ${prefix}, PLACE NO. `)) {
		match = /PLACE NO\. ([1-9])$/u.exec(heading);
		if (match) {
			return {
				office: `District Court Judge, ${county} County, Place ${match[1]}`,
				district: county,
				scope: "local",
				jurisdiction: `${county} County`
			};
		}
	}
	if (
		heading.startsWith(`FOR MEMBER, ${prefix} BOARD OF EDUCATION, DISTRICT NO. `)
		|| heading.startsWith(`FOR MEMBER, ${prefix} BOARD OF EDUCATION DISTRICT NO. `)
	) {
		match = /DISTRICT NO\. ([1-9]\d?)$/u.exec(heading);
		if (match) {
			return {
				office: `Member, ${county} County Board of Education, District ${match[1]}`,
				district: match[1],
				scope: "local",
				jurisdiction: `${county} County Board of Education District ${match[1]}`
			};
		}
	}
	throw new Error(`An Alabama office heading requires review: ${heading}`);
}
export function readAlabamaReview(content: AlabamaVisibleContent, input: AlabamaSourceIdentity): AlabamaNativeReview {
	const { county, electionDate, sourceUrl, sourceSha256 } = input;
	assert(/^[A-Z][A-Za-z. ]{1,40}$/u.test(county));
	assert(/^20\d{2}-11-0[2-8]$/u.test(electionDate));
	const date = new Date(`${electionDate}T12:00:00Z`);
	assert.equal(date.getUTCDay(), 2, "The general-election date must be a Tuesday.");
	assert(/^[a-f\d]{64}$/u.test(sourceSha256), "Original source bytes must be fingerprinted.");
	const url = new URL(sourceUrl);
	const prefix = `https://www.sos.alabama.gov/sites/default/files/sample-ballots/${date.getUTCFullYear()}/gen/`;
	const documentName = sourceUrl.startsWith(prefix) ? sourceUrl.slice(prefix.length) : "";
	const countyDocument = /^([A-Za-z]+(?:[.-][A-Za-z]+)*)[-_]Sample\.pdf$/u.exec(documentName);
	assert.equal(url.href, sourceUrl);
	assert(
		!url.search
		&& !url.hash
		&& !url.username
		&& !url.password
		&& countyDocument
		&& countyDocument[1].replace(/[.-]/gu, "").toLowerCase() === county.replace(/[. ]/gu, "").toLowerCase(),
		"The native county document must match its offered source identity."
	);
	const printedDate = `NOVEMBER ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
	assert(
		content.textSpans.some(span => span.text === printedDate && span.fullyVisible && proved(span, content)),
		"The proved visible election date must corroborate the offered index."
	);
	assert(
		content.textSpans.some(
			span =>
				span.text === `${county.toUpperCase()} COUNTY, ALABAMA` && span.fullyVisible && proved(span, content)
		),
		"The proved visible county must corroborate its index label."
	);
	const cells = alabamaCells(content, true);
	const straightPartySelections = cells
		.filter(
			cell =>
				/^(?:ALABAMA DEMOCRATIC PARTY|ALABAMA REPUBLICAN PARTY)$/u.test(
					clean(cell.spans.map(span => span.text).join(" "))
				) && cell.spans.every(span => span.fullyVisible)
		)
		.flatMap(cell => cell.spans.map(span => span.operation));
	const votes = content.textSpans.filter(span => span.text === "(Vote for One)");
	const fields: AlabamaField[] = [];
	const headerOperations = new Set<number>();
	for (const vote of votes) {
		const candidates = cells.filter(
			cell => within(vote, cell.bounds) && cell.spans.some(span => /^FOR(?: |MEMBER,)/u.test(span.text))
		);
		if (!candidates.length) throw new Error("An office voting rule is outside a proved header cell.");
		candidates.sort(
			(first, second) =>
				(first.bounds[2] - first.bounds[0]) * (first.bounds[3] - first.bounds[1])
				- (second.bounds[2] - second.bounds[0]) * (second.bounds[3] - second.bounds[1])
		);
		const cell = candidates[0];
		const headerSpans = cell.spans.filter(
			span => span.baseline > vote.baseline + 0.5 && span.operation !== vote.operation
		);
		for (const span of headerSpans) headerOperations.add(span.operation);
		const heading = headingText(headerSpans);
		if (!heading.startsWith("FOR")) throw new Error("A candidate header is not explicit.");
		fields.push({
			vote,
			heading,
			bounds: cell.bounds,
			cell,
			spans: [],
			holdReason: !proved(vote, content)
				? "The office voting rule has unproved visible glyphs."
				: headerSpans.some(span => !proved(span, content))
					? "An office header has unproved visible glyphs."
					: null
		});
	}
	if (content.textSpans.some(span => /^FOR(?: |MEMBER,)/u.test(span.text) && !headerOperations.has(span.operation)))
		throw new Error("An office header has no accounted voting rule.");
	for (const field of fields) {
		const following = fields
			.filter(
				other =>
					other !== field
					&& Math.abs(other.bounds[0] - field.bounds[0]) < 1.5
					&& Math.abs(other.bounds[2] - field.bounds[2]) < 1.5
					&& other.vote.baseline < field.vote.baseline - 1
			)
			.sort((first, second) => second.vote.baseline - first.vote.baseline)[0];
		const terminator = content.textSpans
			.filter(
				span =>
					span.originalText === "Write-in"
					&& span.fullyVisible
					&& proved(span, content)
					&& span.baseline < field.vote.baseline - 0.5
					&& span.baseline > (following?.bounds[3] ?? 0)
					&& (span.bounds[0] + span.bounds[2]) / 2 > field.bounds[0] - 0.2
					&& (span.bounds[0] + span.bounds[2]) / 2 < field.bounds[2] + 0.2
			)
			.sort((first, second) => second.baseline - first.baseline)[0];
		field.terminator = terminator?.operation;
		if (!terminator) {
			const proof
				= proveAlabamaOfficeRows(field.cell, cells) ?? proveAlabamaOfficeFrame(field.cell, field.vote, cells);
			if (proof) {
				field.terminator = proof.boundary.markerOperations[0];
				field.boundaryProof = { ...proof };
				delete field.boundaryProof.candidateSpans;
				field.spans = proof.candidateSpans ?? [];
				continue;
			}
		}
		const lower = Math.max(following ? following.bounds[3] : 0, terminator?.baseline ?? 0);
		field.spans = content.textSpans
			.filter(
				span =>
					span.baseline < field.vote.baseline - 0.5
					&& span.baseline > lower + 0.2
					&& (span.bounds[0] + span.bounds[2]) / 2 > field.bounds[0] - 0.2
					&& (span.bounds[0] + span.bounds[2]) / 2 < field.bounds[2] + 0.2
			)
			.sort((first, second) => second.baseline - first.baseline || first.bounds[0] - second.bounds[0]);
	}
	const records: AlabamaCandidateClaim[] = [];
	const excluded: AlabamaNativeReview["excluded"] = [];
	const heldFields: AlabamaHeldField[] = [];
	const seenNames = new Set<string>();
	const candidateOperations = new Set<number>();
	for (const field of fields) {
		const start = records.length;
		try {
			const spans = field.spans.filter(
				span =>
					span.originalText !== "Write-in"
					&& !["CONTINUE VOTING", "ON BACK", "CONTINUE VOTING ON BACK"].includes(span.text)
			);
			if (!spans.length) {
				excluded.push({
					kind: "empty-source-template",
					heading: field.heading,
					headerOperation: field.vote.operation
				});
				continue;
			}
			if (field.holdReason) throw new Error(field.holdReason);
			if (!field.terminator) throw new Error("A candidate field has no explicit printed terminator.");
			const context = officeContext(field.heading, county);
			if (spans.length % 2) {
				throw new Error(
					`The printed name/party sequence is incomplete: ${field.heading} / ${spans.map(span => span.text).join("|")}`
				);
			}
			const fieldDrawingProof = proveAlabamaFieldDrawings(content, field, spans);
			for (let index = 0; index < spans.length; index += 2) {
				const name = spans[index];
				const party = spans[index + 1];
				if (
					!/^[\p{Lu}\p{Lt}][\p{L}\p{M} .,'’"()\-]+$/u.test(name.text)
					|| name.text.length > 160
					|| !isParty(party.text)
					|| !name.fullyVisible
					|| !party.fullyVisible
					|| !proved(name, content)
					|| !proved(party, content)
				) {
					throw new Error(
						`An Alabama candidate field has unresolved visible content: ${field.heading} / ${name.text} / ${party.text}`
					);
				}
				if (
					content.uncertainOverlays.some(item =>
						[name.operation, party.operation].includes(item.glyph.operation)
					)
				) {
					throw new Error("A candidate intersects an unresolved overlay.");
				}
				if (candidateOperations.has(name.operation) || candidateOperations.has(party.operation))
					throw new Error("A candidate field is assigned more than once.");
				candidateOperations.add(name.operation);
				candidateOperations.add(party.operation);
				const key = [
					"AL",
					electionDate,
					context.office.toLowerCase(),
					context.district,
					name.text.toLowerCase(),
					party.text.toLowerCase(),
					context.jurisdiction?.toLowerCase() ?? ""
				];
				const id = hash(JSON.stringify(key)).slice(0, 24);
				if (seenNames.has(id)) throw new Error("A candidate is duplicated.");
				seenNames.add(id);
				records.push({
					id,
					stateCode: "AL",
					electionDate,
					county,
					...context,
					name: name.text,
					party: party.text,
					recordRole: "printed-sample-ballot-claim",
					sourceUrl,
					sourceSha256,
					pageNumber: 1,
					sourceOfficeHeading: field.heading,
					officeRuleOperation: field.vote.operation,
					terminatorOperation: field.terminator,
					boundaryMethod: field.boundaryProof?.method ?? "proved-visible-terminator",
					...(field.boundaryProof ? { boundaryProof: field.boundaryProof } : {}),
					fieldDrawingProof,
					sourceOperations: [name.operation, party.operation],
					reviewStatus: "native-draft-awaiting-independent-proof",
					individualApplicabilityVerified: false
				});
			}
		}
		catch (error) {
			if (!(error instanceof Error)) throw error;
			if (/duplicated|assigned more than once/u.test(error.message)) throw error;
			for (const record of records.splice(start)) {
				seenNames.delete(record.id);
				for (const operation of record.sourceOperations) candidateOperations.delete(operation);
			}
			heldFields.push({
				sourceOfficeHeading: field.heading,
				officeRuleOperation: field.vote.operation,
				bounds: field.bounds,
				sourceOperations: field.spans.map(span => span.operation),
				reason: error.message,
				printedPartyRows: field.spans.filter(span => isParty(span.text)).length,
				applicationImportApproved: false,
				publicationApproved: false
			});
		}
	}
	const heldOperations = new Set(heldFields.flatMap(field => field.sourceOperations));
	for (const operation of candidateOperations) {
		if (heldOperations.has(operation)) throw new Error("A held office overlaps a candidate field.");
	}
	for (const span of content.textSpans.filter(span => isParty(span.text))) {
		if (
			!candidateOperations.has(span.operation)
			&& !straightPartySelections.includes(span.operation)
			&& !heldOperations.has(span.operation)
		) {
			throw new Error(`A printed candidate party row was not accounted: ${span.text} @ ${span.operation}`);
		}
	}
	if ((!records.length && !heldFields.length) || records.length > 200 || heldFields.length > 100)
		throw new Error("The native county candidate inventory is out of bounds.");
	return {
		schemaVersion: 1,
		type: "alabama-native-ballot-draft",
		electionDate,
		county,
		sourceUrl,
		sourceSha256,
		records,
		excluded,
		heldFields,
		nativeFieldsComplete: heldFields.length === 0,
		officeFields: fields.length,
		candidateOfficeFields: fields.length - excluded.length - heldFields.length,
		applicationImportApproved: false,
		publicationApproved: false,
		recurringCollectionApproved: false
	};
}
export function readAlabamaDraftRecords(content: AlabamaVisibleContent, input: AlabamaSourceIdentity) {
	const review = readAlabamaReview(content, input);
	if (review.heldFields.length) throw new Error(review.heldFields[0].reason);
	return review;
}
