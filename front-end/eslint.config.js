import globals from "globals";
import base from "../eslint.config.js";
import nuxt from "./.nuxt/eslint.config.mjs";

export default base
	.append(nuxt())
	.append({
		ignores: [
			".nuxt/**",
			".output/**"
		],
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		},
		rules: {
			"no-undef": "off"
		}
	})
	.append({
		files: ["test/**/*.ts"],
		rules: {
			"test/no-import-node-test": "off"
		}
	})
	.append({
		files: ["nuxt.config.ts"],
		rules: {
			"nuxt/nuxt-config-keys-order": "off"
		}
	});
