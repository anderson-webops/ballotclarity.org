import { defineEventHandler } from "h3";
import { getValidatedAdminSession } from "../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	return await getValidatedAdminSession(event);
});
