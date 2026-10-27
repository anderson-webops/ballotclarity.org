import { readFileSync } from "node:fs";

export const douglasPolicyFixture: Record<string, string> = JSON.parse(readFileSync(new URL("../fixtures/douglas-policy.json", import.meta.url), "utf8"));
export const douglasFixtureClock = Date.parse("2026-10-26T12:00:00.000Z");
export const douglasFixturePeople = [
	{ name: "Ada Example", candidateId: "101", officeId: "139", office: "Governor", category: "Partisan", party: "Republican" },
	{ name: "Bob Example", candidateId: "102", officeId: "139", office: "Governor", category: "Partisan", party: "Democratic" },
	{ name: "Casey Example", candidateId: "103", officeId: "140", office: "Legislature - District 04", category: "Nonpartisan", party: "Republican" },
	{ name: "Dana Example", candidateId: "104", officeId: "76", office: "Elkhorn Board of Education #10", category: "Nonpartisan", party: "Democratic" },
	{ name: "Emery Example", candidateId: "105", officeId: "45", office: "Douglas County Court - District 4", category: "Nonpartisan", party: "Nonpartisan" },
	{ name: "Finley Example", candidateId: "106", officeId: "155", office: "Lieutenant Governor", category: "Partisan", party: "Republican" }
];
const footer = douglasPolicyFixture.footer!;
const input = (name: string, value: string) => `<input type="hidden" name="${name}" value="${value}">`;
export function douglasFormFixture(year = "2026", selected = false, publications = true) {
	const offices = [...new Map(douglasFixturePeople.map(person => [person.officeId, person])).values()];
	const state = [input("__VIEWSTATE", "synthetic-state"), input("__VIEWSTATEGENERATOR", "12345678"), input("__EVENTVALIDATION", "synthetic-validation"), input("ctl00$ContentPlaceHolder1$hfOfficeID", ""), input("ctl00$ContentPlaceHolder1$hfElection", selected ? year : "")].join("");
	const options = `<option ${selected ? "" : "selected"} value="">Select an Election</option><option value="${year}S">${year} SID</option><option ${selected ? "selected" : ""} value="${year}G">${year} General</option>`;
	const officeOptions = selected && publications ? `<select name="ctl00$ContentPlaceHolder1$ddlOffices"><option selected value="">Select an Office</option>${offices.map(office => `<option value="${office.officeId}">${office.office}</option>`).join("")}</select>` : "";
	const rows = offices.map(office => `<tr><td><a href="office_detail.aspx?oid=${office.officeId}&amp;sid=10">${office.office}</a> - ${office.category} Office</td></tr><tr><td><table>${douglasFixturePeople.filter(person => person.officeId === office.officeId).map(person => `<tr><td><a href="candidates.aspx?cid=${person.candidateId}&amp;oid=${person.officeId}&amp;eid=${year}%20General">${person.name}</a></td><td></td><td>Filed: 01/30/${year}</td></tr>`).join("")}</table></td></tr><tr><td></td></tr>`).join("");
	const writeIns = selected && publications ? `<div id="ContentPlaceHolder1_writein"><a id="WriteIns">Write-In Candidates (By Date Filed)</a><table><tr><td colspan="3">Elkhorn Board of Education #10</td></tr><tr><td><a href="elections/${year}/General/SyntheticWriteIn.pdf">Robin Example</a></td><td>Filed: 09/16/${year}</td></tr><tr><td></td></tr></table></div>` : "";
	return `<html><body><form method="post" action="./candidate_info.aspx">${state}<select name="ctl00$ContentPlaceHolder1$ddlElections" id="ContentPlaceHolder1_ddlElections">${options}</select>${officeOptions}<span id="ContentPlaceHolder1_lblOffices">${selected && publications ? `<table>${rows}</table>` : ""}</span>${writeIns}</form>${footer}</body></html>`;
}
export function douglasCalendarFixture(date = "2026-11-03", published = true) {
	return `${published ? `<div><h2>${date.slice(0, 4)} Statewide Gubernatorial General Election</h2><table><tr><td><span id="ContentPlaceHolder1_GVGubGeneral_lblDate_25">Tuesday, November ${Number(date.slice(8))}, ${date.slice(0, 4)}</span></td><td><span id="ContentPlaceHolder1_GVGubGeneral_lblDescription_25">Statewide General Election Day. Polls open from 8:00 a.m. until 8:00 p.m.</span></td></tr></table></div>` : ""}${footer}`;
}
export function douglasProfileFixture(candidateId: string, year = "2026") {
	const person = douglasFixturePeople.find(person => person.candidateId === candidateId)!;
	return `<html><body><input type="hidden" id="ContentPlaceHolder1_hfCID" value="${person.candidateId}"><input type="hidden" id="ContentPlaceHolder1_hfOID" value="${person.officeId}"><span id="ContentPlaceHolder1_lblElectionName">${year} General Election</span><span id="ContentPlaceHolder1_gvCandidateInfo_lblCandidateHeader_0">${person.name}, ${person.office}</span><div><span id="ContentPlaceHolder1_gvCandidateInfo_lblParty_0">${person.party}</span></div><span id="ContentPlaceHolder1_gvCandidateInfo_lblFileDate_0">1/30/${year}</span>${footer}</body></html>`;
}
