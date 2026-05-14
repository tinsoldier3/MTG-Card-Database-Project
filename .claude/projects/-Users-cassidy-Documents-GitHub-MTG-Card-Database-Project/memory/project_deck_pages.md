---
name: Deck detail pages (Archidekt-style)
description: Planned feature to give each deck its own page, with a decks overview as the entry point
type: project
---

User wants Archidekt-style navigation: a main decks overview page (grid of deck tiles) that links to individual deck detail pages.

**Why:** Current single-page layout gets crowded as more decks are added. Deck-per-page mirrors how tools like Archidekt work.

**How to apply:** When implementing, build on the existing hash routing (`#decks` / `#boxes`). Plan:
1. Decks overview — grid of deck tiles (name, commander, color pips, card count)
2. Hash routing — `#deck/atraxa` style URLs for individual decks, back navigates to overview
3. Deck detail page — current card grid scoped to one deck, with back button
