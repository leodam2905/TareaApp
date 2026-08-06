import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Next loads .env.local for the dev server it starts, but the setup project
// runs in Playwright's own process and needs the credentials too.
dotenv.config({ path: ".env.local" });

/**
 * E2E config for the Tarea web app.
 *
 * Two test projects:
 *   - "public"  — no login required. Runs anywhere, no credentials needed.
 *   - "authed"  — reuses a signed-in session produced by e2e/auth.setup.ts.
 *                 Requires E2E_CUSTOMER_EMAIL / E2E_CUSTOMER_PASSWORD.
 *
 * Run only the public ones with:  npm run test:e2e -- --project=public
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "html" : [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "public",
      testIgnore: /authed\//,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "authed",
      testMatch: /authed\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/customer.json",
      },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    // Next's first-request dev compile blows through the 30s default.
    timeout: 180_000,
  },
});
