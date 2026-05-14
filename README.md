# MTG Card Database Project

This project is a personal Magic: The Gathering collection tracker focused on Commander decks. The app lets you add cards, import decklists, organize cards by deck, and flag cards that fall outside a commander's color identity.

## Current Goal

Build a small but reliable collection app that is easy to maintain, easy to extend, and safe to keep using over time.

## Current State

- **Vue 3 + Vite** frontend with Pinia state management
- **Supabase** backend for persistent, multi-device storage
- Email/password authentication via Supabase Auth
- Row-level security — each user only sees their own collection
- Uses the Scryfall API to look up cards and deck imports
- Supports deck filtering, search, and card movement between decks
- Supports JSON backup export/import
- Auto-migrates existing localStorage data to Supabase on first sign-in
- Realtime sync — collection stays up to date across tabs and devices automatically
- Optimistic UI — card add, remove, and move operations update instantly with background sync and rollback on error
- Password reset via email (forgot password link on sign-in screen)
- In-place quantity editing — each card has a number input and "Set qty" button directly in the card grid
- **Deck Builder view** — browse your collection alongside a target deck; filter available cards by source (unsorted, other decks, or full collection), card type, and commander legality; move cards in or out with one click
- **AI Deck Assistant** — chat panel in the deck builder; Scryfall smart search parses natural language prompts into EDHREC-ranked results; optional Anthropic API key upgrades to Claude-powered suggestions with full deck context
- Collection load fallback — if the paginated Supabase query fails, the app retries with a simple query and notifies you
- Smart import deduplication — duplicate card lines in import files have their quantities summed; merge mode preserves higher existing quantities instead of overwriting
- **Deck detail pages** — per-deck view with mana curve chart, color distribution, live price estimate (Scryfall), type breakdown, and Copy Decklist
- **Card metadata** — condition (NM/LP/MP/HP/DMG), acquisition date, purchase price, and notes editable per card via Details modal; condition shown as inline badge
- **Controls panel** — Add Cards (Scryfall lookup), Import deck (.txt, replace/merge/repair prints), Export/Import collection backup, search, and sort on all collection views

## Project Structure

```
├── index.html
├── styles.css
├── vite.config.js
├── src/
│   ├── main.js
│   ├── App.vue
│   ├── components/
│   │   ├── AuthPanel.vue
│   │   ├── ResetPasswordPanel.vue
│   │   ├── ControlsPanel.vue      # Add Cards, Import/Export, Search, Sort
│   │   ├── DecksOverview.vue      # Deck tile grid (default view)
│   │   ├── DeckDetail.vue         # Per-deck detail with mana curve & price
│   │   ├── DeckBuilder.vue        # Builder + AI assistant
│   │   ├── CardGrid.vue           # Boxes / By Set views
│   │   └── CardDetailsModal.vue   # Condition, price, notes editor
│   ├── store/
│   │   └── collection.js          # Pinia store (auth, collection CRUD, realtime)
│   ├── composables/
│   │   ├── useSupabase.js         # Supabase client + DB helpers
│   │   └── useScryfall.js         # Scryfall API wrappers
│   └── utils/
│       ├── constants.js           # COMMANDER_DECKS, CARD_CONDITIONS, etc.
│       └── cards.js               # Pure card utility functions
```

## How To Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in a browser. You will be prompted to sign in or create an account before accessing your collection.

To build for production:

```bash
npm run build
npm run preview
```

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

### Phase 3 — Complete
- Track additional metadata: condition, acquisition date, purchase price, notes
- Migrated frontend to Vite + Vue 3 with Pinia and modular SFC components

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
  created_at timestamptz default now(),
  condition text,
  acquired_date text,
  purchase_price numeric,
  notes text
);

alter table cards enable row level security;

create policy "Users can manage their own cards"
  on cards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```
