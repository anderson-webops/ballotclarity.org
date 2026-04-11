import { defineEventHandler } from "h3";
import { getAdminUsers } from "../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	return await getAdminUsers(event);
});
