import tseslint from "typescript-eslint";
import next from "eslint-config-next";

export default tseslint.config(
  {
    ignores: [".next/**", "node_modules/**"],
  },
  ...next,
);
