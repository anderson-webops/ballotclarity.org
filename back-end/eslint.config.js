import globals from "globals";
import ts from "typescript-eslint";
import base from "../eslint.config.js";

export default base.append(
	{
		files: ["**/*.ts"],
		languageOptions: {
			parser: ts.parser,
			parserOptions: { project: "./tsconfig.test.json", sourceType: "module" },
			globals: { ...globals.node }
		},
		rules: {
			"new-cap": "off"
		}
	},
	{
		files: ["**/*.{js,cjs,mjs}"],
		languageOptions: { globals: { ...globals.node } }
	},
	{
		files: ["test/**/*.ts"],
		rules: {
			"test/no-import-node-test": "off"
		}
	},
	{
		ignores: ["dist/**", "node_modules/**"]
	}
);
