/**
 * @opta/eslint-config - Base ESLint configuration
 *
 * Shared ESLint rules for all TypeScript projects in the Opta monorepo.
 * For Next.js projects, use @opta/eslint-config/next instead.
 */

import { defineConfig, globalIgnores } from "eslint/config";

/**
 * Base ESLint configuration for TypeScript projects
 */
const baseConfig = defineConfig([
  // Global ignores
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.next/**",
    "**/out/**",
    "**/.turbo/**",
    "**/coverage/**",
  ]),
  {
    // TypeScript/JavaScript files
    files: ["**/*.{js,mjs,cjs,ts,tsx,mts,cts}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      // Best practices
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "warn",
      "no-unused-vars": "off", // Handled by TypeScript
      "prefer-const": "error",
      "no-var": "error",

      // Code style
      eqeqeq: ["error", "always", { null: "ignore" }],
      curly: ["error", "all"],
    },
  },
]);

export default baseConfig;
