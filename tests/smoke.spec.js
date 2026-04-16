const { test, expect } = require("@playwright/test");

test("loads the collection page", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "My MTG Collection" })).toBeVisible();
  await expect(page.getByLabel("Card name")).toBeVisible();
  await expect(page.getByLabel("Deck name")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add card" })).toBeVisible();
  await expect(page.locator("#filterNote")).toHaveText(/Showing all cards|No cards/i);
});
