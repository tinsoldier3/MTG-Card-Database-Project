const { test, expect } = require("@playwright/test");

test("loads the collection page", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "My MTG Collection" })).toBeVisible();
  await expect(page.getByLabel("Card name")).toBeVisible();
  await expect(page.getByLabel("Deck name")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add card" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Repair deck prints" })).toBeVisible();
  await expect(page.locator("#filterNote")).toHaveText(/Showing all cards|No cards/i);
});

test("renders stored print metadata", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("mtgCollection", JSON.stringify([
      {
        name: "Island",
        type: "Basic Land — Island",
        image: "https://cards.scryfall.io/normal/front/0/0/00000000-0000-0000-0000-000000000000.jpg",
        deck: "Atraxa",
        colorIdentity: [],
        set: "dbl",
        collectorNumber: "278"
      }
    ]));
  });

  await page.goto("/");

  await expect(page.getByText("Print: DBL #278")).toBeVisible();
});
