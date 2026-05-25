import { test, expect, Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', "admin@thefairycrocheter.fr");
  await page.fill('input[type="password"]', "Arielle2026");
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/);
}

test.describe("Produits", () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test("liste produits accessible", async ({ page }) => {
    await page.goto("/produits");
    await expect(page.getByText(/Produits/i).first()).toBeVisible();
  });

  test("formulaire nouveau produit accessible", async ({ page }) => {
    await page.goto("/produits/nouveau");
    await expect(page.getByText(/Nouveau produit/i)).toBeVisible();
    await expect(page.locator('input[name="nom"], input[placeholder*="nom"]').first()).toBeVisible();
  });
});
