export function ballotQuestionParagraphs(text: string) {
	return text.split(/\n\s*\n|(?=Question:|A YES vote|A NO vote|Funding Source Statement:|Fiscal Impact Statement:)/u).filter(paragraph => paragraph.trim());
}
