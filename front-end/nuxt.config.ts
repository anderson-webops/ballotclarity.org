import process from "node:process";
import { defineNuxtConfig } from "nuxt/config";
import { appDescription, appName } from "./src/constants/index";

export default defineNuxtConfig({
	modules: [
		"@vueuse/nuxt",
		"@unocss/nuxt",
		"@pinia/nuxt",
		"@nuxtjs/color-mode",
		"@nuxt/eslint"
	],

	srcDir: "src",

	devtools: {
		enabled: true
	},

	app: {
		head: {
			viewport: "width=device-width,initial-scale=1",
			link: [
				{ rel: "icon", href: "/favicon.ico", sizes: "any" },
				{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
				{ rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
				{ rel: "manifest", href: "/site.webmanifest" }
			],
			meta: [
				{ name: "viewport", content: "width=device-width, initial-scale=1" },
				{ name: "description", content: appDescription },
				{ name: "application-name", content: appName },
				{ name: "apple-mobile-web-app-status-bar-style", content: "default" },
				{ name: "theme-color", media: "(prefers-color-scheme: light)", content: "#F7F4EE" },
				{ name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#09131F" }
			]
		}
	},

	css: ["~/assets/styles/main.css"],

	colorMode: {
		classSuffix: "",
		preference: "light",
		fallback: "light"
	},

	runtimeConfig: {
		public: {
			apiBase: process.env.NUXT_PUBLIC_API_BASE || "http://127.0.0.1:3001/api"
		}
	},

	future: {
		compatibilityVersion: 4
	},

	experimental: {
		payloadExtraction: false,
		renderJsonPayloads: true,
		typedPages: true
	},

	compatibilityDate: "2024-08-14",

	nitro: {
		esbuild: {
			options: {
				target: "esnext"
			}
		},
		prerender: {
			crawlLinks: false,
			routes: []
		}
	},

	vite: {
		build: {
			modulePreload: {
				polyfill: false
			}
		}
	},

	eslint: {
		config: {
			standalone: false,
			nuxt: {
				sortConfigKeys: true
			}
		}
	}
});
