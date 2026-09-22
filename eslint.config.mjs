import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import security from "eslint-plugin-security";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  security.configs.recommended,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "**/*.json",
    "next-env.d.ts",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "zod",
              message: "Import Zod through @/platform/validation/zod so CSP-safe jitless mode is configured first.",
            },
          ],
        },
      ],
      // React Hook Form watch() is incompatible with React Compiler - this is expected
      "react-hooks/incompatible-library": "off",
      // This heuristic reports every dynamic property access and is not actionable.
      "security/detect-object-injection": "off",
      // All enabled security findings block lint; warnings are forbidden in CI.
      ...Object.fromEntries(
        Object.keys(security.configs.recommended.rules)
          .filter((rule) => rule !== "security/detect-object-injection")
          .map((rule) => [rule, "error"]),
      ),
    },
  },
  {
    files: ["scripts/**", "**/*.test.*", "**/*.spec.*"],
    rules: {
      // These files only read fixed paths or paths enumerated by Git/the test fixture.
      "security/detect-non-literal-fs-filename": "off",
    },
  },
  {
    files: ["src/platform/validation/zod.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]);

export default eslintConfig;
