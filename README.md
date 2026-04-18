# MTG Card Database Project

This project is a personal Magic: The Gathering collection tracker focused on Commander decks. The app lets you add cards, import decklists, organize cards by deck, and flag cards that fall outside a commander's color identity.

## Current Goal

Build a small but reliable collection app that is easy to maintain, easy to extend, and safe to keep using over time.

## What "Done Next" Looks Like

- Keep collection data persistent across sessions and devices.
- Make the codebase easier to understand by separating HTML, CSS, and JavaScript.
- Support importing real decklists and browsing the collection by deck.
- Show Commander-specific legality issues clearly.
- Create a solid base for a later move to a framework or backend if needed.

## Current State

- Frontend-only app
- Uses `localStorage` for in-browser persistence
- Uses the Scryfall API to look up cards and deck imports
- Supports deck filtering, search, and card movement between decks
- Supports JSON backup export/import for more durable collection storage

## Project Structure

- [index.html](/Users/cassidy/Documents/GitHub/MTG%20Card%20Database%20Project/index.html)
- [styles.css](/Users/cassidy/Documents/GitHub/MTG%20Card%20Database%20Project/styles.css)
- [app.js](/Users/cassidy/Documents/GitHub/MTG%20Card%20Database%20Project/app.js)

## Persistence Plan

The goal is for the collection to be durable and accessible from any device — not just the browser it was added in.

### Current (Phase 1 — in place)

1. `localStorage` keeps the collection in the browser between sessions.
2. JSON export/import provides a manual backup so the data is not trapped in one browser.

### Next (Phase 2 — planned)

Migrate to **Supabase** as the backend database. Supabase is a hosted Postgres service with a simple JavaScript client — no server to manage, free tier is sufficient for a personal collection.

The plan:

1. Create a Supabase project and define a `cards` table (columns: `id`, `name`, `type`, `deck`, `foil`, `quantity`, `set`, `collector_number`, `scryfall_id`, `color_identity`, `image`, `created_at`).
2. Replace `localStorage` reads/writes in `app.js` with Supabase client calls (`select`, `insert`, `update`, `delete`).
3. Add a simple login (Supabase Auth supports email/password and magic links out of the box) so the collection is tied to a user account rather than a browser.
4. Keep the JSON export feature as a manual backup option even after the migration.

### Later (Phase 3 — future)

- Track additional metadata: condition, acquisition date, purchase price, notes.
- Automatic sync across devices without manual export/import.
- Optionally migrate the frontend to Vite + Vue for a better developer experience once the backend is stable.

## Next Iterations

1. Set up Supabase project and schema.
2. Replace `localStorage` with Supabase in `app.js`.
3. Add Supabase Auth for user login.
4. Add duplicate detection and quantity tracking instead of storing repeated copies as separate records.
5. Improve deck import parsing for more decklist formats.
6. Add tests around deck normalization, search, and Commander legality rules.
7. Decide whether to stay lightweight or migrate to a framework like Vite + Vue.

## How To Run

Open [index.html](/Users/cassidy/Documents/GitHub/MTG%20Card%20Database%20Project/index.html) in a browser.

## Notes

This repo is intentionally staying simple for now. The immediate goal is to build a dependable foundation before adding a framework or backend. The Supabase migration is the single highest-leverage next step — it solves persistence and multi-device access in one move without requiring a custom server.
