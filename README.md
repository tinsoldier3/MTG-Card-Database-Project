# MTG Card Database Project

This project is a personal Magic: The Gathering collection tracker focused on Commander decks. The app lets you add cards, import decklists, organize cards by deck, and flag cards that fall outside a commander's color identity.

## Current Goal

Build a small but reliable collection app that is easy to maintain, easy to extend, and safe to keep using over time.

## Current State

- Frontend-only app (no custom server)
- **Supabase** backend for persistent, multi-device storage (Phase 2 complete)
- Email/password authentication via Supabase Auth
- Row-level security — each user only sees their own collection
- Uses the Scryfall API to look up cards and deck imports
- Supports deck filtering, search, and card movement between decks
- Supports JSON backup export/import
- Auto-migrates existing localStorage data to Supabase on first sign-in
- Realtime sync — collection stays up to date across tabs and devices automatically
- Optimistic UI — card add, remove, and move operations update instantly with background sync and rollback on error
- Loading states — auth buttons, collection grid, and card add button show progress during async operations
- Password reset via email (forgot password link on sign-in screen)

## Project Structure

- [index.html](index.html)
- [styles.css](styles.css)
- [app.js](app.js)

## How To Run

Open [index.html](index.html) in a browser. You will be prompted to sign in or create an account before accessing your collection.

## Persistence

### Phase 1 — Complete
1. `localStorage` for in-browser persistence between sessions.
2. JSON export/import for manual backups.

### Phase 2 — Complete
Supabase (hosted Postgres) replaces localStorage as the source of truth.

- `cards` table stores the full collection, scoped per user via `user_id`
- All writes go through targeted Supabase `upsert`/`delete` calls
- Sign in with email/password; row-level security prevents cross-user access
- JSON export remains available as a manual backup option
- On first sign-in, any existing localStorage data is automatically migrated

### Phase 3 — Future
- Track additional metadata: condition, acquisition date, purchase price, notes
- Optionally migrate the frontend to Vite + Vue once the backend is stable

## What's Next

1. **Quantity editing in-place** — quantity only increases when re-adding a card; no way to set it to a specific number from the card grid.
2. **Deck detail pages** — Archidekt-style per-deck overview using hash routing (planned, not started).
3. **Duplicate detection on import** — cards are matched by name+foil during merge, but quantity stacking across repeated imports could be smarter.
4. **Better auth error messaging** — surface Supabase validation errors (e.g. weak password) more clearly in the sign-up form.
5. **Framework migration (optional)** — move to Vite + Vue once the data layer is stable.

## Supabase Schema

```sql
create table cards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  deck text,
  foil boolean default false,
  quantity integer default 1,
  set text,
  collector_number text,
  scryfall_id text,
  color_identity text[],
  image text,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table cards enable row level security;

create policy "Users can manage their own cards"
  on cards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```
