import { defineEventHandler } from "h3";
import { clearAdminSession } from "../../utils/admin-auth";

export default defineEventHandler((event) => {
	return clearAdminSession(event);
});
