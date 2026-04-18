import { hasBuildMismatch, isLikelyStaleNuxtChunkError, readServerBuildId, triggerStaleClientRecovery } from "~/utils/deploy-recovery";

export default defineNuxtPlugin((nuxtApp) => {
	const runtimeConfig = useRuntimeConfig();
	const router = useRouter();
	const clientBuildId = String(runtimeConfig.public.buildId || "");

	function recoverFromStaleClient(error: unknown, reason: string) {
		if (!isLikelyStaleNuxtChunkError(error))
			return false;

		return triggerStaleClientRecovery(readServerBuildId() || clientBuildId, `Ballot Clarity updated. Reloading… (${reason})`);
	}

	const serverBuildId = readServerBuildId();

	if (hasBuildMismatch(clientBuildId, serverBuildId))
		triggerStaleClientRecovery(serverBuildId, "Ballot Clarity updated. Reloading…");

	router.onError((error) => {
		recoverFromStaleClient(error, "route chunk");
	});

	nuxtApp.hook("app:error", (error) => {
		recoverFromStaleClient(error, "app shell");
	});

	window.addEventListener("error", (event) => {
		recoverFromStaleClient(event.error ?? event, "window error");
	});

	window.addEventListener("unhandledrejection", (event) => {
		recoverFromStaleClient(event.reason ?? event, "dynamic import");
	});
});
