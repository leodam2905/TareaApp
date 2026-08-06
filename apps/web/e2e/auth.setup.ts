import { test as setup, expect } from "@playwright/test";

const AUTH_FILE = "e2e/.auth/customer.json";

/**
 * Signs in once and saves the session for the "authed" project.
 *
 * Logging in through the UI is not possible in a test: POST /api/auth/login
 * sends an OTP and returns { requiresOtp: true } for normal accounts. The
 * REVIEW_ACCOUNTS allowlist in app/api/auth/login/route.ts skips OTP and sets
 * the tarea_token cookie directly, so E2E_CUSTOMER_EMAIL must be one of those
 * accounts. If DISABLE_REVIEW_OTP_BYPASS=true is set, this cannot work at all.
 */
setup("authenticate as customer", async ({ request }) => {
  const email = process.env.E2E_CUSTOMER_EMAIL;
  const password = process.env.E2E_CUSTOMER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_CUSTOMER_EMAIL and E2E_CUSTOMER_PASSWORD must be set to run the " +
        "authed project. Add them to apps/web/.env.local (they are gitignored), " +
        "or run only the public tests: npm run test:e2e -- --project=public"
    );
  }

  const res = await request.post("/api/auth/login", {
    data: { email, password },
  });

  expect(res.ok(), `login failed: ${res.status()} ${await res.text()}`).toBeTruthy();

  const body = await res.json();
  expect(
    body.requiresOtp,
    `${email} is not an OTP-bypass review account — login returned requiresOtp. ` +
      "Use an account listed in REVIEW_ACCOUNTS in app/api/auth/login/route.ts."
  ).toBeFalsy();
  expect(body.success).toBe(true);

  await request.storageState({ path: AUTH_FILE });
});
