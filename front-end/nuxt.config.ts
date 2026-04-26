import process from "node:process";
import { defineNuxtConfig } from "nuxt/config";
import { analyticsTrackers, appDescription, appName } from "./src/constants/index";
import { buildPreHydrationDeployRecoveryScript } from "./src/utils/deploy-recovery";
import { buildPreHydrationDisplayTimeZoneScript } from "./src/utils/display-time-zone";

const assetVersion = "20260417";
const isDev = process.env.NODE_ENV === "development";
const analyticsDisabled = process.env.NUXT_DISABLE_ANALYTICS === "1" || process.env.NUXT_DISABLE_ANALYTICS === "true";
const buildId = process.env.NUXT_PUBLIC_BUILD_ID
	|| process.env.RELEASE_VERSION
	|| process.env.SOURCE_VERSION
	|| process.env.VERCEL_GIT_COMMIT_SHA
	|| process.env.GITHUB_SHA
	|| process.env.COMMIT_SHA
	|| `local-${Date.now().toString(36)}`;

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
			htmlAttrs: {
				"lang": "en",
				"data-app-build": buildId
			},
			viewport: "width=device-width,initial-scale=1",
			link: [
				{ rel: "shortcut icon", href: `/favicon.ico?v=${assetVersion}` },
				{ rel: "icon", href: `/favicon.ico?v=${assetVersion}`, sizes: "any" },
				{ rel: "icon", type: "image/svg+xml", href: `/favicon.svg?v=${assetVersion}` },
				{ rel: "icon", type: "image/png", href: `/favicon-32x32.png?v=${assetVersion}`, sizes: "32x32" },
				{ rel: "icon", type: "image/png", href: `/favicon-16x16.png?v=${assetVersion}`, sizes: "16x16" },
				{ rel: "apple-touch-icon", href: `/apple-touch-icon.png?v=${assetVersion}` },
				{ rel: "manifest", href: `/site.webmanifest?v=${assetVersion}` }
			],
			meta: [
				{ name: "viewport", content: "width=device-width, initial-scale=1" },
				{ name: "description", content: appDescription },
				{ name: "ballot-clarity-build-id", content: buildId },
				{ name: "application-name", content: appName },
				{ name: "apple-mobile-web-app-status-bar-style", content: "default" }
			],
			script: [
				{
					innerHTML: buildPreHydrationDisplayTimeZoneScript(),
					id: "ballot-clarity-display-time-zone",
					tagPosition: "head",
					type: "text/javascript",
				},
				{
					innerHTML: buildPreHydrationDeployRecoveryScript(),
					id: "ballot-clarity-deploy-recovery",
					tagPosition: "head",
					type: "text/javascript",
				},
				...(isDev || analyticsDisabled
					? []
					: analyticsTrackers.map(tracker => ({
							"defer": true,
							"key": `ballot-clarity-analytics-${tracker.label}`,
							"src": `https://${tracker.domain}/script.js`,
							"data-website-id": tracker.websiteId,
						}))),
			]
		}
	},

	css: ["~/assets/styles/main.css"],

	colorMode: {
		classSuffix: "",
		preference: "system",
		fallback: "light"
	},

	runtimeConfig: {
		adminApiBase: process.env.ADMIN_API_BASE || process.env.NUXT_PUBLIC_API_BASE || "http://127.0.0.1:3001/api",
		adminApiKey: process.env.ADMIN_API_KEY || "",
		adminSessionSecret: process.env.ADMIN_SESSION_SECRET || "",
		public: {
			apiBase: process.env.NUXT_PUBLIC_API_BASE || "http://127.0.0.1:3001/api",
			buildId,
			governingLaw: process.env.NUXT_PUBLIC_GOVERNING_LAW || "",
			operatorLegalName: process.env.NUXT_PUBLIC_OPERATOR_LEGAL_NAME || "Jacob Anderson",
			operatorNoticeAddress: process.env.NUXT_PUBLIC_OPERATOR_NOTICE_ADDRESS || "",
			siteUrl: process.env.NUXT_PUBLIC_SITE_URL || "https://ballotclarity.org",
			venue: process.env.NUXT_PUBLIC_VENUE || ""
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
		routeRules: {
			"/_nuxt/**": {
				headers: {
					"cache-control": "public, max-age=31536000, immutable"
				}
			},
			"/admin": {
				headers: {
					"X-Robots-Tag": "noindex, nofollow"
				}
			},
			"/admin/**": {
				headers: {
					"X-Robots-Tag": "noindex, nofollow"
				}
			},
			"/api/**": {
				headers: {
					"X-Robots-Tag": "noindex, nofollow"
				}
			},
			"/ballot": {
				headers: {
					"X-Robots-Tag": "noindex, nofollow"
				}
			},
			"/ballot/**": {
				headers: {
					"X-Robots-Tag": "noindex, nofollow"
				}
			},
			"/compare": {
				headers: {
					"X-Robots-Tag": "noindex, nofollow"
				}
			},
			"/compare/**": {
				headers: {
					"X-Robots-Tag": "noindex, nofollow"
				}
			},
			"/plan": {
				headers: {
					"X-Robots-Tag": "noindex, nofollow"
				}
			},
			"/plan/**": {
				headers: {
					"X-Robots-Tag": "noindex, nofollow"
				}
			},
			"/search": {
				headers: {
					"X-Robots-Tag": "noindex, nofollow"
				}
			},
			"/search/**": {
				headers: {
					"X-Robots-Tag": "noindex, nofollow"
				}
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
