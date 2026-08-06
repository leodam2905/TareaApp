import { test, expect } from "@playwright/test";

/**
 * Guards the Terms and Privacy disclosures. These are compliance text: a
 * refactor that silently drops a section is a legal problem, not a UI bug.
 */

test.describe("Terms of Service", () => {
  test("renders and discloses the AI Diagnose feature", async ({ page }) => {
    await page.goto("/terms");

    await expect(page.getByRole("heading", { name: "Terms of Service", level: 1 })).toBeVisible();
    await expect(page.getByText("15. AI Diagnose Feature")).toBeVisible();
    await expect(
      page.getByText(/do not constitute a professional inspection/i)
    ).toBeVisible();
    await expect(page.getByText(/contact emergency services/i)).toBeVisible();
  });

  test("section numbering has no duplicates or gaps", async ({ page }) => {
    await page.goto("/terms");

    const headings = await page.locator("h2").allTextContents();
    const numbers = headings
      .map((h) => Number(h.match(/^(\d+)\./)?.[1]))
      .filter((n) => !Number.isNaN(n));

    expect(numbers.length).toBeGreaterThan(0);
    expect(numbers).toEqual([...Array(numbers.length)].map((_, i) => i + 1));
  });
});

test.describe("Privacy Policy", () => {
  test("discloses AI processing and the third-party provider", async ({ page }) => {
    await page.goto("/privacy");

    await expect(page.getByRole("heading", { name: "Privacy Policy", level: 1 })).toBeVisible();
    await expect(page.getByText(/AI Diagnose submissions/i)).toBeVisible();
    await expect(page.getByText(/Anthropic PBC/i)).toBeVisible();
    await expect(page.getByText(/not used to train their models/i)).toBeVisible();
    await expect(page.getByText(/not stored by Tarea/i)).toBeVisible();
  });

  test("Terms and Privacy declare the same version", async ({ page }) => {
    await page.goto("/terms");
    const terms = await page.getByText(/Effective Date:/).innerText();

    await page.goto("/privacy");
    const privacy = await page.getByText(/Effective Date:/).innerText();

    expect(terms).toBe(privacy);
  });
});
