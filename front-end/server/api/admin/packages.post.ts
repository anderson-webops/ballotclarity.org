import { defineEventHandler } from "h3";
import { createAdminGuidePackage, readAdminRequestBody } from "../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	const body = await readAdminRequestBody(event);
	return await createAdminGuidePackage(event, body);
});
