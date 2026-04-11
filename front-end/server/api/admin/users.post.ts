import { defineEventHandler, readBody } from "h3";
import { createAdminUser } from "../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	const body = await readBody<Record<string, unknown>>(event);

	return await createAdminUser(event, body);
});
