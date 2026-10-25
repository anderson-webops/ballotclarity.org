import { defineEventHandler } from "h3";
import { getAdminOperations } from "../../utils/admin-auth";

export default defineEventHandler(event => getAdminOperations(event));
