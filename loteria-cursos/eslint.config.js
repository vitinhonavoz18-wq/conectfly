import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "coverage/**", ".tmp/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,mts}"],
    languageOptions: { ecmaVersion: 2023, globals: globals.node },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": "off",
    },
  },
  {
    // Testes lidam com JSON dinâmico (respostas do banco/APIs): "any" é aceito só aqui.
    files: ["tests/**/*.ts", "**/tests/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  {
    extends: [js.configs.recommended],
    files: ["**/*.{js,mjs}"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: globals.node },
    rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }] },
  },
);
