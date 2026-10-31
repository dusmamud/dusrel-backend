// ESLint flat config (CommonJS — root package.json has no
// "type": "module", so this file uses require/module.exports).
//
// Pass-first on purpose: the first `pnpm lint` must succeed on the
// existing code. The two relaxations at the bottom exist because
// existing code uses `any` (tests, parseBody helpers) and has a few
// intentionally unused bindings. Tighten them later, one rule at a
// time, with a code cleanup — not by flipping this file alone.
//
// TypeScript rules are the non-type-checked recommended set, so no
// parserOptions.project is needed. Node globals apply everywhere
// because every package here runs on Node.

const js = require("@eslint/js");
const globals = require("globals");
const tseslint = require("typescript-eslint");

module.exports = [
  // Never lint build output or installed deps.
  {
    ignores: ["**/dist/**", "**/node_modules/**"],
  },
  // Plain JS files (config files, scripts): recommended JS rules.
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-console": "off",
    },
  },
  // TypeScript files: typescript-eslint recommended, scoped to TS.
  ...tseslint.configs.recommended.map((entry) => ({
    ...entry,
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      ...(entry.languageOptions ?? {}),
      globals: globals.node,
    },
  })),
  // Pass-first relaxations (see header comment).
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
    },
  },
];
