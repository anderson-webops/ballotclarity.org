import assert from "node:assert/strict";
import test from "node:test";
import { formatCivicDateTime } from "../src/utils/display-time-zone.ts";
import { electionTimeZone } from "../src/utils/election-time-zone.ts";
import { buildKeyDateTimeline } from "../src/utils/election-timeline.ts";

test("Fulton deadlines use Eastern time independently of reader location and DST", () => {
	const deadline = { label: "Election Day polls close", date: "2026-11-04T00:00:00.000Z" };
	for (const reader of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
		const zone = electionTimeZone({ slug: "2026-fulton-county-general" }, reader);
		assert.equal(zone, "America/New_York");
		assert.match(formatCivicDateTime(deadline.date, zone), /Nov 3, 2026 at 7:00 PM/u);
		assert.equal(buildKeyDateTimeline([deadline], new Date("2026-11-03T23:59:59Z"), zone)[0]?.isNext, true);
		assert.equal(buildKeyDateTimeline([deadline], new Date("2026-11-04T00:00:01Z"), zone)[0]?.status, "passed");
	}
	assert.equal(electionTimeZone({ timeZone: "America/Denver" }, "UTC"), "America/Denver");
	assert.equal(electionTimeZone({ timeZone: "Invalid" }, "UTC"), "UTC");
});
