import { defineEventHandler } from "h3";
import { getProtectedContactAddress } from "../utils/contact-address";

export default defineEventHandler((event) => {
	return getProtectedContactAddress(event);
});
