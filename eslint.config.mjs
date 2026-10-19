import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Client/server boundary (ADR-002, security review M3): browser code imports only src/shared and src/client,
  // so the DB client with its Turso token can never end up in the client bundle.
  {
    files: ["src/components/**", "src/client/**", "src/shared/**", "src/app/page.tsx", "src/app/layout.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(@/|(\\.\\.?/)+)(server|db)(/|$)",
              message: "Client code imports only src/shared and src/client (ADR-002).",
            },
            {
              regex: "^(@libsql/|drizzle-orm($|/)|node:)",
              message: "No DB driver or Node modules in client code (ADR-002).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**",
    "data/**",
    "playwright-report/**",
    "test-results/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
