import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
 
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
 
const compat = new FlatCompat({ baseDirectory: __dirname });
 
const config = [
  {
    ignores: [".next/**", "node_modules/**", "coverage/**", ".mail/**"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["warn", { allow: ["warn", "error", "log"] }],
    },
  },
];
 
export default config;