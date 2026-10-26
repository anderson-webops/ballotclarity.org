const escaped = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll("\"", "&quot;");
export const winnebagoField = (text: string, left: number, top: number, bold = true) => `<text top="${top}" left="${left}" width="200" height="14" font="0">${bold ? `<b>${escaped(text)}</b>` : escaped(text)}</text>`;
const candidate = (name: string, left: number, top: number) => winnebagoField(name, left, top) + winnebagoField("123 PRIVATE SAMPLE RD.", left, top + 18, false);

export function winnebagoFixture(year = 2026) {
	const first = [
		winnebagoField("FEDERAL", 33, 186),
		winnebagoField("UNITED STATES SENATOR", 33, 206),
		candidate("SAMPLE SENATOR", 293, 206),
		candidate("SECOND SENATOR", 681, 206),
		winnebagoField("STATE", 33, 279),
		winnebagoField("GOVERNOR/LIEUTENANT GOV.", 33, 300),
		candidate("SAMPLE GOVERNOR /", 293, 300),
		candidate("SECOND GOVERNOR /", 681, 300),
		winnebagoField("SAMPLE PARTNER", 293, 335),
		winnebagoField("SECOND PARTNER", 681, 356),
		winnebagoField("16TH CONGRESSIONAL", 33, 420),
		candidate("SAMPLE REPRESENTATIVE", 293, 420),
		winnebagoField("NO CANDIDATE", 681, 420),
		winnebagoField("COUNTY WIDE", 33, 500),
		winnebagoField("SHERIFF", 33, 530),
		winnebagoField("NO CANDIDATE", 293, 530),
		candidate("SAMPLE SHERIFF", 681, 530),
		winnebagoField("INDEPENDENT CANDIDATE", 293, 600),
		candidate("SAMPLE INDEPENDENT", 293, 620),
		winnebagoField("COUNTY BOARD", 33, 740),
		winnebagoField("DISTRICT TWELVE -", 33, 762),
		winnebagoField("UN-EXPIRED 2-YEAR TERM", 33, 780),
		candidate("SAMPLE BOARD MEMBER", 293, 780),
		winnebagoField("NO CANDIDATE", 681, 780)
	].join("");
	const second = [
		winnebagoField("NON-PARTISAN CANDIDATES:", 33, 184),
		winnebagoField("FOREST PRESERVE", 33, 202),
		winnebagoField("COMMISSIONER", 33, 220),
		candidate("SAMPLE COMMISSIONER", 293, 220),
		candidate("OTHER COMMISSIONER", 293, 320),
		winnebagoField("4TH APPELLATE COURT JUDGE RETENTION", 33, 648),
		winnebagoField("SAMPLE JUDGE", 293, 666)
	].join("");
	return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE pdf2xml SYSTEM "pdf2xml.dtd">\n<pdf2xml producer="poppler">${
		[first, second].map((body, index) => `<page number="${index + 1}" width="918" height="1188">${[
			winnebagoField(`9/25/${year}`, 82, 59, false),
			winnebagoField(String(year), 434, 59),
			winnebagoField("GENERAL", 346, 87),
			winnebagoField("ELECTION", 456, 85),
			winnebagoField("List of Candidates", 372, 112),
			winnebagoField("OFFICE", 33, 167),
			winnebagoField("DEMOCRAT", 293, 167),
			winnebagoField("REPUBLICAN", 681, 167),
			winnebagoField(`Page ${index + 1}`, 690, 59, false),
			winnebagoField(`Page ${index + 1} of 2`, 400, 1130, false),
			body
		].join("")}</page>`).join("")}</pdf2xml>`;
}
