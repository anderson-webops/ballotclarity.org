import {
	hasBuildMismatch,
	isLikelyStaleNuxtChunkError,
	persistClientBuildId,
	readServerBuildId,
	shouldRecoverFromBuildMismatch,
	triggerStaleClientRecovery,
	unregisterStaleServiceWorkers,
} from "~/utils/deploy-recovery";

export default defineNuxtPlugin({
	enforce: "pre",
	name: "deploy-recovery",
	setup(nuxtApp) {
		const runtimeConfig = useRuntimeConfig();
		const router = useRouter();
		const clientBuildId = String(runtimeConfig.public.buildId || "");

		function recoverFromStaleClient(error: unknown, reason: string) {
			if (!isLikelyStaleNuxtChunkError(error))
				return false;

			return triggerStaleClientRecovery(readServerBuildId() || clientBuildId, `Ballot Clarity updated. Reloading… (${reason})`);
		}

		const serverBuildId = readServerBuildId();

		if (hasBuildMismatch(clientBuildId, serverBuildId)) {
			triggerStaleClientRecovery(
				serverBuildId,
				shouldRecoverFromBuildMismatch(clientBuildId, serverBuildId)
					? "Ballot Clarity updated. Reloading…"
					: "Ballot Clarity updated. Please refresh this page."
			);
			return;
		}

		persistClientBuildId(clientBuildId);
		document.documentElement.removeAttribute("data-stale-client-recovery");

		router.onError((error) => {
			recoverFromStaleClient(error, "route chunk");
		});

		nuxtApp.hook("app:error", (error) => {
			recoverFromStaleClient(error, "app shell");
		});

		nuxtApp.hook("app:mounted", () => {
			persistClientBuildId(clientBuildId);
			document.documentElement.removeAttribute("data-stale-client-recovery");
			void unregisterStaleServiceWorkers();
		});

		window.addEventListener("error", (event) => {
			recoverFromStaleClient(event.error ?? event, event.target && event.target !== window ? "asset load" : "window error");
		}, true);

		window.addEventListener("unhandledrejection", (event) => {
			recoverFromStaleClient(event.reason ?? event, "dynamic import");
		});

		window.addEventListener("vite:preloadError", (event) => {
			event.preventDefault();
			recoverFromStaleClient(event, "vite preload");
		});
	},
});
