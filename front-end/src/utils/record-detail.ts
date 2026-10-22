interface RecordPage<RecordType> {
	available: boolean;
	matched: number;
	offset: number;
	records: RecordType[];
}

export async function findRecordDetail<RecordType extends { id: string }, PageType extends RecordPage<RecordType>>(
	loadPage: (offset: number) => Promise<PageType>,
	matches: (record: RecordType) => boolean
) {
	let offset = 0;
	for (;;) {
		const page = await loadPage(offset);
		if (!page.available)
			return null;
		const record = page.records.find(matches);
		if (record)
			return { record, page };
		const nextOffset = page.offset + page.records.length;
		if (!page.records.length || nextOffset >= page.matched)
			return null;
		if (nextOffset <= offset)
			throw new Error("Record pagination did not advance.");
		offset = nextOffset;
	}
}
