import { defineEventHandler, readBody } from "h3";
import { createAdminGuidePackage } from "../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	const body = await readBody<Record<string, unknown>>(event);
	return await createAdminGuidePackage(event, body);
});
