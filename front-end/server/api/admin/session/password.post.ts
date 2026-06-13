import { defineEventHandler } from "h3";
import { changeAdminPassword, readAdminRequestBody } from "../../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	const body = await readAdminRequestBody(event);

	return await changeAdminPassword(event, body);
});
