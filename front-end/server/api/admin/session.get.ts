import { defineEventHandler } from "h3";
import { getAdminSession } from "../../utils/admin-auth";

export default defineEventHandler((event) => {
	return getAdminSession(event);
});
