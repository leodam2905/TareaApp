import { test, expect } from "@playwright/test";

/**
 * The AI Diagnose section on the marketing homepage.
 *
 * /api/ai/diagnose is always stubbed here: it calls the Anthropic API, so a
 * live run would cost money on every test and return non-deterministic text.
 */

const PLUMBING_RESULT = {
  category: "PLUMBING",
  confidence: "high",
  urgency: "urgent",
  explanation: "Likely a burst supply line behind the wall.",
  tips: ["Shut off the main water valve.", "Call a licensed plumber now."],
};

/**
 * The homepage is server-rendered and hydrates only after the dev server has
 * compiled it. A fill() landing before React attaches onChange sets the DOM
 * value without updating state, leaving the submit button disabled. Retry until
 * the button reacts — that is the signal React is actually live.
 */
async function describeIssue(page: import("@playwright/test").Page, text: string) {
  const textarea = page.getByPlaceholder(/wet patch on my ceiling/i);
  const submit = page.getByRole("button", { name: /diagnose my issue/i });

  await expect(async () => {
    await textarea.fill(text);
    await expect(submit).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  return submit;
}

test.describe("AI Diagnose (marketing)", () => {
  test("returns a category and shows the AI disclaimer", async ({ page }) => {
    await page.route("**/api/ai/diagnose", (route) =>
      route.fulfill({ json: PLUMBING_RESULT })
    );

    await page.goto("/");

    const submit = await describeIssue(page, "Water pouring from under the kitchen sink");
    await submit.click();

    await expect(page.getByText(/plumbing pro/i)).toBeVisible();
    await expect(page.getByText(PLUMBING_RESULT.explanation)).toBeVisible();

    // The disclaimer is a legal requirement, not decoration — assert it hard.
    await expect(
      page.getByText(/not a professional inspection/i)
    ).toBeVisible();
    await expect(page.getByText(/call a licensed pro or 911/i)).toBeVisible();
  });

  test("surfaces an error instead of hanging when the API fails", async ({ page }) => {
    await page.route("**/api/ai/diagnose", (route) =>
      route.fulfill({ status: 500, json: { error: "Could not analyze the issue." } })
    );

    await page.goto("/");
    const submit = await describeIssue(page, "Broken outlet");
    await submit.click();

    await expect(page.getByText(/could not analyze/i)).toBeVisible();
  });

  test("the analyze button stays disabled with no photo and no description", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: /diagnose my issue/i })
    ).toBeDisabled();
  });
});
