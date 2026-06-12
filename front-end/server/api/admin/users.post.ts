import { defineEventHandler } from "h3";
import { createAdminUser, readAdminRequestBody } from "../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	const body = await readAdminRequestBody(event);

	return await createAdminUser(event, body);
});
