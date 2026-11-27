import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // "server-only" only matters inside Next.js; in tests every server module is imported directly.
  resolve: { alias: { "@": path.resolve(__dirname), "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts") } },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
