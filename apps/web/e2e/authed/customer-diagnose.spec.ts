import { test, expect } from "@playwright/test";

/**
 * Signed-in customer diagnose page. Runs in the "authed" project, which loads
 * the session saved by e2e/auth.setup.ts.
 */

test("customer diagnose page shows a result and the disclaimer", async ({ page }) => {
  await page.route("**/api/ai/diagnose", (route) =>
    route.fulfill({
      json: {
        category: "ELECTRICAL",
        confidence: "medium",
        urgency: "urgent",
        explanation: "Scorching around the outlet suggests a wiring fault.",
        tips: ["Stop using the outlet.", "Call a licensed electrician now."],
      },
    })
  );

  await page.goto("/customer/diagnose");

  // Not redirected to login — the saved session is live.
  await expect(page).toHaveURL(/\/customer\/diagnose/);

  await page.getByRole("textbox").first().fill("Burn marks around a wall outlet");
  await page.getByRole("button", { name: /diagnose/i }).first().click();

  await expect(page.getByText(/scorching around the outlet/i)).toBeVisible();
  await expect(page.getByText(/not a professional inspection/i)).toBeVisible();
});
