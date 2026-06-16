import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "build", "coverage"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    // P1.4 boundary fence: all Matrix runtime/SDK logic lives in matrix-core.
    // The app may only import *types* from matrix-js-sdk — any value import is a
    // regression that should move into packages/matrix-core instead.
    files: ["apps/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {
        paths: [{
          name: "matrix-js-sdk",
          message:
            "В apps/ разрешён только `import type` из matrix-js-sdk. Вся рантайм-логика SDK живёт в @matrix-platform/matrix-core.",
          allowTypeImports: true,
        }],
      }],
    },
  },
);

