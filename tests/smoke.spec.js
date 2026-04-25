const { test, expect } = require("@playwright/test");

// Intercept the Supabase CDN script and replace it with a minimal mock.
// session: null → unauthenticated; pass a session object to simulate sign-in.
// cards: array of row-shaped objects returned by from("cards").select("*").
function mockSupabase(page, { session = null, cards = [] } = {}) {
  return page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", async (route) => {
    const sessionJson = JSON.stringify(session);
    const cardsJson = JSON.stringify(cards);
    await route.fulfill({
      contentType: "application/javascript",
      body: `
        window.supabase = {
          createClient: function() {
            return {
              auth: {
                onAuthStateChange: function() {
                  return { data: { subscription: { unsubscribe: function() {} } } };
                },
                getSession: async function() {
                  return { data: { session: ${sessionJson} } };
                },
                signOut: async function() { return {}; }
              },
              from: function() {
                return {
                  select: function() {
                    return Promise.resolve({ data: ${cardsJson}, error: null });
                  },
                  upsert: function() { return Promise.resolve({ error: null }); },
                  delete: function() {
                    return {
                      eq: function() { return Promise.resolve({ error: null }); },
                      in: function() { return Promise.resolve({ error: null }); }
                    };
                  }
                };
              },
              channel: function() {
                return { on: function() { return { subscribe: function() { return {}; } }; } };
              },
              removeChannel: function() {}
            };
          }
        };
      `
    });
  });
}

// Stub out Scryfall so tests don't make real network calls.
function mockScryfall(page) {
  return page.route("https://api.scryfall.com/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/sets")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ object: "list", data: [] })
      });
    } else {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: [], not_found: [] })
      });
    }
  });
}

const MOCK_SESSION = { user: { id: "test-user-123", email: "test@example.com" } };

test("shows the auth panel when not signed in", async ({ page }) => {
  await mockSupabase(page, { session: null });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "MTG Collection Manager" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Forgot password?" })).toBeVisible();
});

test("shows the main app when signed in", async ({ page }) => {
  await mockSupabase(page, { session: MOCK_SESSION, cards: [] });
  await mockScryfall(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Magic the Gathering - Collection Manager" })).toBeVisible();
  await expect(page.getByLabel("Card name")).toBeVisible();
  await expect(page.getByLabel("Deck name")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add card" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Repair deck prints" })).toBeVisible();
  await expect(page.locator("#filterNote")).toHaveText(/Showing all decks/i);
});

test("renders stored print metadata when signed in", async ({ page }) => {
  const cards = [{
    id: "test-card-1",
    name: "Lightning Bolt",
    type: "Instant",
    image: "https://cards.scryfall.io/normal/front/0/0/00000000-0000-0000-0000-000000000000.jpg",
    deck: "atraxa",
    foil: false,
    quantity: 1,
    color_identity: ["R"],
    set: "dbl",
    collector_number: "278",
    scryfall_id: ""
  }];

  await mockSupabase(page, { session: MOCK_SESSION, cards });
  await mockScryfall(page);
  await page.goto("/");

  await expect(page.getByText("Print: DBL #278")).toBeVisible();
});
