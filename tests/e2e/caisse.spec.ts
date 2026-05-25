import { test, expect, Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', "admin@thefairycrocheter.fr");
  await page.fill('input[type="password"]', "Arielle2026");
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 10_000 });
}

test.describe("Caisse POS", () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test("accès page nouvelle vente", async ({ page }) => {
    await page.goto("/ventes/nouvelle");
    await expect(page.getByText(/caisse/i)).toBeVisible();
  });

  test("champ scan/recherche visible et focusable", async ({ page }) => {
    await page.goto("/ventes/nouvelle");
    const input = page.locator('input[placeholder*="Scanner"], input[placeholder*="code-barres"], input[placeholder*="produit"]').first();
    await expect(input).toBeVisible();
    await input.focus();
    await expect(input).toBeFocused();
  });

  test("bouton 'Scanner caméra' présent", async ({ page }) => {
    await page.goto("/ventes/nouvelle");
    await expect(page.getByText(/Scanner caméra/i)).toBeVisible();
  });
});
