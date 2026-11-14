import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { readParishQuestionReferences } from "../src/louisiana-parish-questions.js";

const title = "Road District No. 2 Proposition (Service Charge Renewal)";
const text = "Shall Road District No. 2 continue an annual charge of $75 plus $3.75 for ten years?";
const header = "WEST CARROLL SAMPLE BALLOT\nMunicipal General\nDecember 14, 2030\n";
const raw = `${header}${title}\n${text}\n■Yes ■No\f`;
const fonts = `<fontspec id="1" family="ABCDEF+Rockwell" size="18" color="#4a95d7"/><fontspec id="2" family="ABCDEF+NunitoSans" size="15" color="#231f20"/><fontspec id="3" family="ABCDEF+FontAwesome6Pro" size="21" color="#000000"/><fontspec id="4" family="ABCDEF+NunitoSans-SemiBold" size="17" color="#231f20"/><fontspec id="5" family="ABCDEF+Rockwell" size="25" color="#252d69"/><fontspec id="6" family="ABCDEF+Rockwell" size="29" color="#252d69"/>`;
const electionDay = `<text font="5" top="355" left="58">ELECTION DAY</text><text font="6" top="401" left="58">December 14, 2030</text>`;
const block = `<text font="1">${title}</text><text font="2">${text}</text><text font="3">■</text><text font="4">Yes</text><text font="3">■</text><text font="4">No</text>`;
const xml = `<pdf2xml producer="poppler"><page number="1">${fonts}${electionDay}${block}</page></pdf2xml>`;
const read = (native = raw, visible = xml) => readParishQuestionReferences(native, visible, "West Carroll", "2030-12-14");

test("parish questions retain complete literal wording, charges, choices and printed page", () => {
	const [question] = read();
	assert.equal(question!.title, title);
	assert.equal(question!.text, text);
	assert.deepEqual(question!.choices, ["Yes", "No"]);
	assert.equal(question!.sourcePage, 1);
	assert.equal(question!.reviewStatus, "prepared");
	assert.equal(question!.holdReason, undefined);
	assert.deepEqual(read(), read());
	assert.equal(read(raw.replaceAll(" ", "\n"))[0]!.id, question!.id);
});

test("parish questions preserve wrapped headings and numbered local-option wording", () => {
	const numbered = "Police Jury District 5 Proposition No. 4 of 5 (Local Option Election)";
	const alcohol = "Shall the sale of beverages containing more than six percent alcohol for consumption on the premises be permitted?";
	const native = raw.replace(title, numbered).replace(text, alcohol);
	const visible = xml.replace(title, "Police Jury District 5</text><text font=\"1\">Proposition No. 4 of 5 (Local Option Election)").replace(text, alcohol);
	assert.equal(read(native, visible)[0]!.title, numbered);
	assert.equal(read(native, visible)[0]!.text, alcohol);
	assert.notEqual(read(native, visible)[0]!.id, read()[0]!.id);
});

test("parish municipal heading conflicts retain source text in an explicit held record", () => {
	const municipal = "Town of Example Proposition (Sales Tax)";
	const native = raw.replace(title, municipal);
	const visible = xml.replace(title, municipal);
	assert.equal(read(native, visible)[0]!.holdReason, "heading-body-jurisdiction-conflict");
	assert.equal(read(native, visible)[0]!.text, text);
	const matching = "Shall the Town of Example, State of Louisiana, levy this tax?";
	assert.equal(read(native.replace(text, matching), visible.replace(text, matching))[0]!.reviewStatus, "prepared");
	const school = "City of Example Special School District Proposition (Millage Renewal)";
	assert.equal(read(raw.replace(title, school), xml.replace(title, school))[0]!.reviewStatus, "prepared");
});

test("parish questions hold conflicting dates, parishes and incomplete page inventories", () => {
	for (const native of [raw.replace("December 14", "November 5"), raw.replace("WEST CARROLL", "CADDO"), `${raw}${header}\f`]) assert.throws(() => read(native));
	for (const visible of [xml.replace("number=\"1\"", "number=\"2\""), xml.replace("producer=\"poppler\"", "producer=\"other\""), xml.replace("</page>", `</page><page number="2">${block}</page>`), "a".repeat(4 * 1024 * 1024 + 1)]) assert.throws(() => read(raw, visible));
	assert.throws(() => readParishQuestionReferences(raw.repeat(21), `<pdf2xml producer="poppler">${Array.from({ length: 21 }, (unused, index) => `<page number="${index + 1}">${fonts}${block}</page>`).join("")}</pdf2xml>`, "West Carroll", "2030-12-14"));
});

test("parish questions bind the printed election-day date rather than a matching date elsewhere", () => {
	for (const visible of [xml.replace("December 14, 2030", "November 5, 2030"), xml.replace("top=\"401\"", "top=\"701\""), xml.replace(electionDay, electionDay + electionDay), xml.replace(electionDay, "")]) assert.throws(() => read(raw, visible), /election-day date/u);
	assert.equal(readParishQuestionReferences(raw.replaceAll("2030", "2034"), xml.replaceAll("2030", "2034"), "West Carroll", "2034-12-14").length, 1);
});

test("parish questions reject style drift, unknown fonts and duplicate font identities", () => {
	for (const visible of [xml.replace("#4a95d7", "#ff0000"), xml.replace("size=\"15\"", "size=\"16\""), xml.replace("font=\"2\"", "font=\"9\""), xml.replace("</page>", "<fontspec id=\"1\" family=\"Other\" size=\"18\" color=\"#4a95d7\"/></page>"), xml.replace(text, `${text}\uFFFD`)]) assert.throws(() => read(raw, visible));
	assert.ok(Buffer.byteLength(xml) < 4 * 1024 * 1024);
});

test("parish question cross-check rejects omissions, additions and partial wording", () => {
	for (const visible of [xml.replace(block, ""), xml.replace("$75", "$70"), xml.replace(title, "Different Proposition"), xml.replace("ten years?", "ten years"), xml.replace("Shall ", "Whether "), xml.replace(block, block + block)]) assert.throws(() => read(raw, visible));
	assert.throws(() => read(raw.replace("$75", "$70")));
	assert.throws(() => read(`${raw.trim()}\n${title}\n${text}\n■Yes ■No`));
});

test("parish question choices preserve binary order and reject missing or additional labels", () => {
	for (const visible of [xml.replace(">Yes<", ">No<").replace(">No</text></page>", ">Yes</text></page>"), xml.replace(">No<", ">Maybe<"), xml.replace("<text font=\"4\">No</text>", ""), xml.replace("</page>", "<text font=\"4\">Yes</text></page>")]) assert.throws(() => read(raw, visible));
});

test("candidate-only guides return an empty question inventory without generating placeholders", () => {
	assert.deepEqual(read(header, xml.replace(block, "")), []);
});

test("parish question bounds reject unsupported heading lengths and spreadsheet formula prefixes", () => {
	for (const altered of [`=${title}`, `${"Long ".repeat(80)}Proposition`]) assert.throws(() => read(raw.replace(title, altered), xml.replace(title, altered)));
	const wrapped = "Road District</text><text font=\"1\">No. 2</text><text font=\"1\">Proposition</text><text font=\"1\">(Renewal)";
	assert.throws(() => read(raw.replace(title, "Road District No. 2 Proposition (Renewal)"), xml.replace(title, wrapped)));
	assert.throws(() => read(raw.replace(text, `${"Shall ".repeat(2000)}adopt?`), xml.replace(text, `${"Shall ".repeat(2000)}adopt?`)));
	assert.throws(() => read(`${header}${Array.from({ length: 101 }, (unused, index) => `${title} ${index}\n${text}\n■Yes ■No`).join("\n")}\f`, xml.replace(block, Array.from({ length: 101 }, (unused, index) => block.replace(title, `${title} ${index}`)).join(""))));
});
