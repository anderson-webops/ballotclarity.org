import { defineEventHandler } from "h3";
import { enableAdminMfa, readAdminRequestBody } from "../../../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	const body = await readAdminRequestBody(event);

	return await enableAdminMfa(event, body);
});
