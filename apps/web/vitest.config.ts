import { defineConfig } from "vitest/config";
import path from "node:path";

// Narrowly scoped: unit tests for server-side logic only. Playwright continues
// to own e2e (`npm run test:e2e`). Nothing here touches the network — the
// geocoding provider and FCM are mocked, so the default suite never makes a paid
// Google call or sends a real push.
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
