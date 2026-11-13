import type { StateBallotSource } from "./state-ballot-sources.js";
import { isDeepStrictEqual } from "node:util";
import { acquireStateBallotAutomationLock } from "./state-ballot-automation-lock.js";
import { parseBundledStateSnapshot } from "./state-ballot-snapshot.js";
import { createStateBallotStorage } from "./state-ballot-storage.js";

export async function importNativeStateBallotSnapshot(source: StateBallotSource, body: string, directory: string, now = Date.now()) {
	if (source.retrievalPolicy === "manual-snapshot") throw new Error("Native imports require an enabled automatic source.");
	const snapshot = parseBundledStateSnapshot(source, body, "automatic");
	if (!Number.isFinite(now) || Date.parse(snapshot.retrievedAt) > now) throw new Error("A native snapshot cannot have a future capture time.");
	const lock = await acquireStateBallotAutomationLock(directory);
	try {
		const storage = createStateBallotStorage(lock.directory);
		const previous = await storage.read(source);
		if (previous) {
			const recordIds = new Set(snapshot.records.map(record => record.id));
			const questions = new Map(snapshot.ballotQuestions?.map(question => [question.id, question]));
			if (Date.parse(snapshot.retrievedAt) < Date.parse(previous.retrievedAt)) throw new Error("An older native capture cannot replace accepted data.");
			if (previous.records.some(record => !recordIds.has(record.id))) throw new Error("An accepted candidate disappeared; retain its snapshot for review.");
			if (previous.ballotQuestions?.some(question => !isDeepStrictEqual(question, questions.get(question.id)))) throw new Error("An accepted question changed or disappeared; retain its snapshot for review.");
		}
		await storage.write(snapshot);
		return snapshot;
	}
	finally { await lock.release(); }
}
