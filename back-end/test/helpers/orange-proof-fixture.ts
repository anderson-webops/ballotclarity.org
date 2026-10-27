const sizes = [18, 12, 16, 10, 11, 11, 13, 13, 21, 12, 12, 11, 10, 13, 13, 10, 11, 9, 10, 12, 12];
const bold = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 13, 15, 17, 19, 20]);
const italic = new Set([0, 1, 2, 9, 11, 20]);
export function orangeProofField(value: string, left: number, top: number, font: number, width = 100) {
	const escaped = value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
	const body = italic.has(font) ? `<i>${bold.has(font) ? `<b>${escaped}</b>` : escaped}</i>` : bold.has(font) ? `<b>${escaped}</b>` : escaped;
	return `<text top="${top}" left="${left}" width="${width}" height="15" font="${font}">${body}</text>`;
}
function fonts() {
	return sizes.map((size, id) => {
		const family = [0, 1, 2, 20].includes(id) ? "AAAAAA+Arial" : [3, 4, 6, 7, 8, 13, 15, 17, 19].includes(id) ? "BBBBBB+Arial" : [5, 12].includes(id) ? "CCCCCC+Arial-Unicode-MS" : [9, 11].includes(id) ? "DDDDDD+Arial" : "EEEEEE+Arial";
		const color = [1, 13, 14].includes(id) ? "#0000ff" : [3, 4].includes(id) ? "#ffffff" : id === 6 ? "#800000" : "#000000";
		return `<fontspec id="${id}" size="${size}" family="${family}" color="${color}"/>`;
	}).join("");
}
function columns(top: number) {
	return [["Contest/District", 36, 3], ["Vote For", 827, 4], ["Status", 1009, 3], ["Num", 946, 4], ["Qualified", 946, 4], ["Num", 890, 4], ["Cands", 890, 4], ["Distict ID/Name", 502, 4]].map(([label, left, font]) => orangeProofField(String(label), Number(left), top, Number(font))).join("");
}
function footer(page: number, year: string) {
	return orangeProofField("CFMR001 - Contest/Candidate Proof List", 28, 872, 18) + orangeProofField(`Page ${page} of 2`, 1050, 873, 16) + orangeProofField(`Print Date and Time: 8/28/${year} ${page === 1 ? "3:47:35PM" : "3:48:21PM"}`, 28, 887, 18) + orangeProofField("Denotes Office Goes Into Extension", 533, 875, 19);
}
function contest(id: string, top: number, district = true, shared = true) {
	const partisan = id === "1020";
	return orangeProofField(partisan ? "Voter Nominated STATE Governor" : "Nonpartisan CITY OF EXAMPLE Council Member", 28, top - 22, 5)
		+ orangeProofField(id, 56, top, 7) + orangeProofField(partisan ? "Governor" : "Example City Council", 102, top, 7)
		+ (district ? orangeProofField(partisan ? "*0 Orange County" : "*503 Example City", 502, top + 18, 7, 200) : "")
		+ orangeProofField(partisan ? "1" : "2", 844, top + 18, 7, 11) + orangeProofField(partisan ? "3" : "2", 905, top + 18, 7, 11) + orangeProofField("2", 964, top + 18, 7, 11) + orangeProofField("ON BALLOT", 1008, top + 18, 6)
		+ (shared ? orangeProofField("Shared with:", 90, top + 39, 9) + orangeProofField("(none)", 168, top + 39, 10) : "");
}
function candidate(name: string, party: string | undefined, id: string, top: number, year: string) {
	return orangeProofField(name, 167, top, 13) + (party ? orangeProofField(`, ${party}`, 268, top, 14) : "") + orangeProofField("Synthetic ballot designation", 167, top + 19, 12)
		+ orangeProofField("Qualified Date:", 1013, top + 37, 11, 78) + orangeProofField(`8/7/${year}`, 1094, top + 38, 15, 41) + orangeProofField("Cand ID:", 1042, top + 67, 11, 46) + orangeProofField(id, 1092, top + 67, 16, 9);
}
export function orangeProofFixture(year = "2026") {
	const first = `${fonts()}<image top="35" left="37" width="41" height="38" src="seal.png"/>${orangeProofField("Contest/Candidate Proof List", 475, 38, 0)}${orangeProofField(`General Election - 11/${year === "2028" ? "7" : "3"}/${year}`, 499, 64, 2)
	}${orangeProofField("Candidates: Qualified Candidates", 27, 104, 1)}${orangeProofField("Contests: 1020 to 6400 - Contests On Ballot", 28, 89, 1)}${orangeProofField("Candidates are in Random Alpha Order", 559, 89, 1)}${columns(128)
	}${contest("1020", 172)}${orangeProofField("Incumbent(s):", 65, 228, 10)}${orangeProofField("Sitting Official", 167, 228, 10)}${candidate("PARTISAN ONE", "Republican", "1", 247, year)}${candidate("PARTISAN TWO", "Democratic", "2", 471, year)}${contest("5000", 827, true, false)}${footer(1, year)}`;
	const second = columns(36) + contest("5000", 81, false) + candidate("LOCAL ONE", undefined, "1", 156, year) + candidate("LOCAL TWO", undefined, "2", 400, year)
		+ orangeProofField("Total Contests:", 30, 600, 20) + orangeProofField("2", 139, 601, 19) + orangeProofField("Total Candidates Filed:", 30, 618, 20) + orangeProofField("4", 187, 619, 19) + footer(2, year);
	return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE pdf2xml SYSTEM "pdf2xml.dtd"><pdf2xml><page number="1" position="absolute" top="0" left="0" width="1188" height="918">${first}</page><page number="2" position="absolute" top="0" left="0" width="1188" height="918">${second}</page></pdf2xml>`;
}
