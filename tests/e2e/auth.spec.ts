import { test, expect } from "@playwright/test";

const ADMIN = { email: "admin@thefairycrocheter.fr", password: "Arielle2026" };

test.describe("Authentification", () => {
  test("login réussi SUPER_ADMIN → dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', ADMIN.email);
    await page.fill('input[type="password"]', ADMIN.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("login échoue avec mauvais mdp", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', ADMIN.email);
    await page.fill('input[type="password"]', "mauvaismdp");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/incorrect|erreur/i)).toBeVisible({ timeout: 5_000 });
  });

  test("route protégée redirige vers login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/login/);
  });
});
