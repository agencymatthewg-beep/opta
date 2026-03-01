import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const aliasPath = (relativePath: string): string => {
  const pathname = decodeURIComponent(new URL(relativePath, import.meta.url).pathname);
  return /^\/[A-Za-z]:\//.test(pathname) ? pathname.slice(1) : pathname;
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@opta/protocol-shared": aliasPath(
        "../1D-Opta-CLI-TS/packages/protocol-shared/src/index.ts",
      ),
      "@opta/daemon-client/http-client": aliasPath(
        "../1D-Opta-CLI-TS/packages/daemon-client/src/http-client.ts",
      ),
      "@opta/daemon-client/types": aliasPath(
        "../1D-Opta-CLI-TS/packages/daemon-client/src/types.ts",
      ),
    },
  },
});
