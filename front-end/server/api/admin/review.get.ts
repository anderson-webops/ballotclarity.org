import { defineEventHandler } from "h3";
import { getAdminReview } from "../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	return await getAdminReview(event);
});
