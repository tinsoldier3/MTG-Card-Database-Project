# MTG Card Database Project

This project is a personal Magic: The Gathering collection tracker focused on Commander decks. The app lets you add cards, import decklists, organize cards by deck, and flag cards that fall outside a commander's color identity.

## Current Goal

Build a small but reliable collection app that is easy to maintain, easy to extend, and safe to keep using over time.

## What "Done Next" Looks Like

- Keep collection data persistent across sessions.
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

Right now the app has two levels of persistence:

1. `localStorage` keeps the collection in the browser between sessions.
2. JSON export/import provides a manual backup so the data is not trapped in one browser.

Good future upgrades:

1. Move storage into a real database such as SQLite, Postgres, or Supabase.
2. Add automatic sync instead of relying only on local browser storage.
3. Track metadata like quantity, condition, set, and acquisition notes.

## Next Iterations

1. Add duplicate detection and quantity tracking instead of storing repeated copies as separate records.
2. Improve deck import parsing for more decklist formats.
3. Add tests around deck normalization, search, and Commander legality rules.
4. Decide whether to stay lightweight or migrate to a framework like Vite + Vue or Vite + React.

## How To Run

Open [index.html](/Users/cassidy/Documents/GitHub/MTG%20Card%20Database%20Project/index.html) in a browser.

## Notes

This repo is intentionally staying simple for now. The immediate goal is to build a dependable foundation before adding a framework or backend.
