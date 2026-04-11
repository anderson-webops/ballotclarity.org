import { defineEventHandler } from "h3";
import { getAdminSourceMonitor } from "../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	return await getAdminSourceMonitor(event);
});
