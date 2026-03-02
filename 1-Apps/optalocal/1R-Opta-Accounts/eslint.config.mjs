import tseslint from "typescript-eslint";
import next from "eslint-config-next";

export default tseslint.config(
  {
    ignores: [".next/**", ".vercel/**", "node_modules/**"],
  },
  ...next,
);
