const { test, expect } = require("@playwright/test");

// Intercept the Supabase CDN script and replace it with a minimal mock.
// session: null → unauthenticated; pass a session object to simulate sign-in.
// cards: array of row-shaped objects returned by from("cards").select("*").
function mockSupabase(page, { session = null, cards = [], selectError = null, pagedSelectError = null } = {}) {
  return page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", async (route) => {
    const sessionJson = JSON.stringify(session);
    const cardsJson = JSON.stringify(cards);
    const selectErrorJson = JSON.stringify(selectError);
    const pagedSelectErrorJson = JSON.stringify(pagedSelectError);
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
                function buildSelectResult(start, end) {
                  if (${selectErrorJson}) {
                    return Promise.resolve({ data: null, error: ${selectErrorJson} });
                  }
                  if (start !== null && end !== null && ${pagedSelectErrorJson}) {
                    return Promise.resolve({ data: null, error: ${pagedSelectErrorJson} });
                  }
                  const slicedCards = start === null || end === null
                    ? ${cardsJson}
                    : ${cardsJson}.slice(start, end + 1);
                  return Promise.resolve({ data: slicedCards, error: null });
                }

                return {
                  select: function() {
                    return {
                      eq: function() { return this; },
                      order: function() { return this; },
                      range: function(start, end) {
                        return buildSelectResult(start, end);
                      },
                      then: function(resolve, reject) {
                        return buildSelectResult(null, null).then(resolve, reject);
                      }
                    };
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
  await expect(page.getByLabel(/^Password$/)).toBeVisible();
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

test("shows a helpful empty state when collection loading fails", async ({ page }) => {
  await mockSupabase(page, {
    session: MOCK_SESSION,
    selectError: { message: "database unavailable" }
  });
  await mockScryfall(page);
  await page.goto("/");

  await expect(page.locator("#cardGrid").getByText("We couldn't load your cards from Supabase right now. Try refreshing the page in a moment.")).toBeVisible();
  await expect(page.locator("#statusMessage")).toContainText("We couldn't load your cards from Supabase right now. Try refreshing the page in a moment.");
});

test("keeps valid cards visible when one stored row is malformed", async ({ page }) => {
  const cards = [{
    id: "bad-row",
    name: null,
    type: "Instant",
    image: "",
    deck: "atraxa",
    foil: false,
    quantity: 1,
    color_identity: ["R"],
    set: "dbl",
    collector_number: "001",
    scryfall_id: ""
  }, {
    id: "good-row",
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

  await expect(page.getByText("Lightning Bolt")).toBeVisible();
  await expect(page.locator("#statusMessage")).toContainText("Skipped 1 invalid saved card while loading.");
});

test("loads more than one batch of cards", async ({ page }) => {
  const cards = Array.from({ length: 1001 }, function(_, index) {
    return {
      id: "card-" + index,
      name: "Card " + index,
      type: "Artifact",
      image: "",
      deck: "atraxa",
      foil: false,
      quantity: 1,
      color_identity: [],
      set: "mh3",
      collector_number: String(index + 1),
      scryfall_id: ""
    };
  });

  await mockSupabase(page, { session: MOCK_SESSION, cards });
  await mockScryfall(page);
  await page.goto("/");

  await expect(page.locator("#headerText")).toContainText("1001");
  await expect(page.getByText("Card 1000")).toBeVisible();
});

test("falls back to a simple query if the paged query fails", async ({ page }) => {
  const cards = [{
    id: "fallback-card",
    name: "Counterspell",
    type: "Instant",
    image: "",
    deck: "atraxa",
    foil: false,
    quantity: 1,
    color_identity: ["U"],
    set: "7ed",
    collector_number: "67",
    scryfall_id: ""
  }];

  await mockSupabase(page, {
    session: MOCK_SESSION,
    cards,
    pagedSelectError: { message: "ordered query failed" }
  });
  await mockScryfall(page);
  await page.goto("/");

  await expect(page.getByText("Counterspell")).toBeVisible();
  await expect(page.locator("#statusMessage")).toContainText("Loaded your cards with a compatibility fallback.");
});
