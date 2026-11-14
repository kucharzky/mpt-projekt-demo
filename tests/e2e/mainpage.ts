import { test, expect } from "@playwright/test";

test.describe("Strona główna SmartUniPlanner", () => {
  test("wyświetla nazwę aplikacji", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "SmartUniPlanner" })
    ).toBeVisible();
  });

  test("wyświetla opis aplikacji", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByText("Inteligentny Planer Studencki — early scaffold")
    ).toBeVisible();
  });
});