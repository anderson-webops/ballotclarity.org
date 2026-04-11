import type { ModuleOptions } from "@vite-pwa/nuxt";
import process from "node:process";
import { appDescription, appName } from "../constants/index";

const scope = "/";

export const pwa: ModuleOptions = {
	registerType: "autoUpdate",
	scope,
	base: scope,
	manifest: {
		id: scope,
		scope,
		name: appName,
		short_name: "Ballot Clarity",
		description: appDescription,
		theme_color: "#10253E",
		background_color: "#F7F4EE",
		icons: [
			{
				src: "pwa-192x192.png",
				sizes: "192x192",
				type: "image/png",
			},
			{
				src: "pwa-512x512.png",
				sizes: "512x512",
				type: "image/png",
			},
			{
				src: "maskable-icon.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "any maskable",
			},
		],
	},
	workbox: {
		globPatterns: ["**/*.{js,css,html,txt,png,ico,svg}"],
		navigateFallbackDenylist: [/^\/api\//],
		navigateFallback: "/",
		cleanupOutdatedCaches: true,
		runtimeCaching: [
			{
				urlPattern: /^https:\/\/fonts.googleapis.com\/.*/i,
				handler: "CacheFirst",
				options: {
					cacheName: "ballot-clarity-google-fonts",
					expiration: {
						maxEntries: 10,
						maxAgeSeconds: 60 * 60 * 24 * 365,
					},
					cacheableResponse: {
						statuses: [0, 200],
					},
				},
			},
			{
				urlPattern: /^https:\/\/fonts.gstatic.com\/.*/i,
				handler: "CacheFirst",
				options: {
					cacheName: "ballot-clarity-gstatic-fonts",
					expiration: {
						maxEntries: 10,
						maxAgeSeconds: 60 * 60 * 24 * 365,
					},
					cacheableResponse: {
						statuses: [0, 200],
					},
				},
			},
		],
	},
	registerWebManifestInRouteRules: true,
	writePlugin: true,
	devOptions: {
		enabled: process.env.VITE_PLUGIN_PWA === "true",
		navigateFallback: scope,
	},
};
