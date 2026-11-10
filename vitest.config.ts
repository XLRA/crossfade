import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^~\//, replacement: path("./src/") },
      // Server modules import "server-only" so they can't end up in a client bundle. Outside
      // React's server build that import throws, so tests get the package's empty module.
      { find: /^server-only$/, replacement: path("./node_modules/server-only/empty.js") },
    ],
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
