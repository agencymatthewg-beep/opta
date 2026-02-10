/**
 * @opta/eslint-config/next - ESLint configuration for Next.js projects
 *
 * Extends the base configuration with Next.js specific rules.
 */

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Next.js ESLint configuration
 * Extends eslint-config-next with Opta-specific customizations
 */
const nextConfig = defineConfig([
  // Next.js recommended configs
  ...nextVitals,
  ...nextTs,

  // Global ignores (override Next.js defaults)
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/dist/**",
    "**/.turbo/**",
    "**/coverage/**",
    "next-env.d.ts",
  ]),

  // Opta-specific rules
  {
    rules: {
      // Allow unescaped entities in JSX (common in text content)
      "react/no-unescaped-entities": "off",

      // Warn on explicit any, but allow for complex third-party integrations
      "@typescript-eslint/no-explicit-any": "warn",

      // Warn on unused variables but allow underscore prefix for intentionally unused
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Best practices
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
    },
  },
]);

export default nextConfig;
