import { defineEventHandler } from "h3";
import { disableAdminMfa, readAdminRequestBody } from "../../../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	const body = await readAdminRequestBody(event);

	return await disableAdminMfa(event, body);
});
