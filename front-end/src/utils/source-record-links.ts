export function buildSourceRecordHref(sourceId: string, publishedSourceIds: Iterable<string>) {
	const publishedSourceIdSet = publishedSourceIds instanceof Set
		? publishedSourceIds
		: new Set(publishedSourceIds);

	return publishedSourceIdSet.has(sourceId) ? `/sources/${sourceId}` : null;
}
