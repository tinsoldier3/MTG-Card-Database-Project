import { getCardImageUri, createStoredCard, applyCardPrinting } from '../utils/cards.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCRYFALL_BASE = 'https://api.scryfall.com';
const SCRYFALL_COLLECTION_CHUNK = 75;
const SCRYFALL_RATE_DELAY_MS = 200;

// ---------------------------------------------------------------------------
// Set name cache
// ---------------------------------------------------------------------------

/**
 * Fetch all Scryfall sets and return a code→name map.
 *
 * Intentionally does NOT write to localStorage or touch the DOM — callers are
 * responsible for caching and display.
 *
 * @returns {Promise<{ setNameCache: Record<string, string> }>}
 */
export async function loadSetNames() {
  const setNameCache = {};

  try {
    const response = await fetch(`${SCRYFALL_BASE}/sets`);
    const data = await response.json();
    if (data.object === 'list' && Array.isArray(data.data)) {
      data.data.forEach((set) => {
        setNameCache[set.code.toLowerCase()] = set.name;
      });
    }
  } catch (e) {
    console.warn('Could not fetch set names from Scryfall.', e);
  }

  return { setNameCache };
}

// ---------------------------------------------------------------------------
// Single-card lookup
// ---------------------------------------------------------------------------

/**
 * Fetch a single card by name using the fuzzy `/cards/named` endpoint.
 *
 * @param {string} cardName
 * @returns {Promise<object>} Raw Scryfall card object.
 * @throws {Error} When the card is not found or the request fails.
 */
export async function fetchNamedCard(cardName) {
  const response = await fetch(
    `${SCRYFALL_BASE}/cards/named?fuzzy=${encodeURIComponent(cardName)}`
  );
  const card = await response.json();

  if (!response.ok || card.object === 'error') {
    throw new Error(card.details || 'Unable to find that card on Scryfall.');
  }

  return card;
}

// ---------------------------------------------------------------------------
// Bulk card lookups
// ---------------------------------------------------------------------------

/**
 * Fetch up to 75 cards by name using the `/cards/collection` POST endpoint.
 *
 * @param {string[]} names - Array of card names.
 * @returns {Promise<object[]>} Array of raw Scryfall card objects.
 */
export async function fetchCardsByNames(names) {
  if (names.length === 0) return [];

  const identifiers = names.slice(0, SCRYFALL_COLLECTION_CHUNK).map((name) => ({ name }));

  const response = await fetch(`${SCRYFALL_BASE}/cards/collection`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifiers })
  });

  if (!response.ok) return [];

  const data = await response.json();
  return data.data || [];
}

/**
 * Fetch cards from Scryfall by set+collector_number identifiers, in chunks of
 * 75, with a rate-limit delay between requests.
 *
 * Each identifier should have the shape:
 *   { name: string, set: string, collector_number: string }
 *
 * @param {object[]} identifiers
 * @param {function(number, string): void} [onProgress]
 *   Called after each chunk completes with (percentComplete, label).
 *   `percentComplete` is 0–100; `label` is a human-readable progress string.
 * @returns {Promise<{ allCards: Array<{ card: object, identifier: object|null }>, notFound: object[] }>}
 */
export async function fetchCardsByIdentifiers(identifiers, onProgress) {
  const chunks = [];
  for (let i = 0; i < identifiers.length; i += SCRYFALL_COLLECTION_CHUNK) {
    chunks.push(identifiers.slice(i, i + SCRYFALL_COLLECTION_CHUNK));
  }

  const allCards = [];
  const notFound = [];
  let processed = 0;

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];

    const response = await fetch(`${SCRYFALL_BASE}/cards/collection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifiers: chunk.map((identifier) => ({
          name: identifier.name,
          set: identifier.set,
          collector_number: identifier.collector_number
        }))
      })
    });

    const data = await response.json();

    (data.data || []).forEach((card) => {
      allCards.push({
        card,
        identifier: findMatchingIdentifier(card, chunk)
      });
    });

    if (data.not_found) {
      notFound.push(...data.not_found);
    }

    processed += chunk.length;

    if (typeof onProgress === 'function') {
      const pct = Math.round((processed / identifiers.length) * 100);
      const label = `${processed} of ${identifiers.length} cards`;
      onProgress(pct, label);
    }

    // Respect Scryfall's rate limit between chunks
    if (chunkIndex < chunks.length - 1) {
      await delay(SCRYFALL_RATE_DELAY_MS);
    }
  }

  return { allCards, notFound };
}

// ---------------------------------------------------------------------------
// Deck price / mana curve data
// ---------------------------------------------------------------------------

/**
 * Fetch CMC and pricing data for a set of deck entries using scryfallId
 * identifiers. Returns a map of scryfallId → { cmc, prices }.
 *
 * @param {Array<{ card: { scryfallId: string } }>} deckEntries
 * @returns {Promise<Record<string, { cmc: number, prices: object }>>}
 */
export async function fetchDeckScryfallData(deckEntries) {
  const ids = [];
  const seen = {};

  deckEntries.forEach((entry) => {
    const id = entry.card.scryfallId;
    if (id && typeof id === 'string' && id.length > 0 && !seen[id]) {
      ids.push(id);
      seen[id] = true;
    }
  });

  if (ids.length === 0) return {};

  const result = {};

  for (let i = 0; i < ids.length; i += SCRYFALL_COLLECTION_CHUNK) {
    const batch = ids.slice(i, i + SCRYFALL_COLLECTION_CHUNK);

    try {
      const response = await fetch(`${SCRYFALL_BASE}/cards/collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifiers: batch.map((id) => ({ id }))
        })
      });

      if (!response.ok) continue;

      const data = await response.json();
      if (data.object === 'list' && Array.isArray(data.data)) {
        data.data.forEach((card) => {
          result[card.id] = { cmc: card.cmc || 0, prices: card.prices || {} };
        });
      }
    } catch (e) {
      console.warn('Scryfall deck data fetch failed:', e);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Natural-language → Scryfall query
// ---------------------------------------------------------------------------

/**
 * Convert a natural-language prompt into a Scryfall search query string.
 *
 * Applies color identity constraints when `colors` is provided, appends
 * `format:commander`, and maps common MTG vocabulary to Scryfall syntax.
 *
 * @param {string} prompt
 * @param {string[]} [colors=[]] - Array of MTG color codes, e.g. ['W', 'U', 'G'].
 * @returns {string} Scryfall query string, ready for use with the search endpoint.
 */
export function buildScryfallQueryFromPrompt(prompt, colors = []) {
  const p = prompt.toLowerCase();
  const parts = [];

  if (colors && colors.length > 0) {
    parts.push('id<=' + colors.join('').toLowerCase());
  }
  parts.push('format:commander');

  const wantsLands = /\bland(s|fix|base|ramp)?\b/.test(p);

  if (/\b(ramp|mana rock|mana dork|accelerat|mana fix)\b/.test(p)) {
    if (wantsLands && /\bland/.test(p)) {
      parts.push('(type:land or (oracle:"add {" -type:land) or oracle:"search your library for a basic land")');
    } else {
      parts.push('(oracle:"add {" or oracle:"search your library for a basic land" or (type:artifact oracle:"add"))');
      parts.push('-type:land');
    }
  } else if (/\b(board.?wipe|wrath|mass removal|all creatures|destroy all)\b/.test(p)) {
    parts.push('(oracle:"destroy all" or oracle:"exile all creatures" or oracle:"each creature gets" or oracle:"all creatures get")');
  } else if (/\b(removal|destroy|kill target|exile target|remove|spot removal)\b/.test(p)) {
    parts.push('(oracle:"destroy target" or oracle:"exile target creature" or oracle:"exile target permanent" or oracle:"deals damage to target creature")');
  } else if (/\b(counter(spell)?|counter target|counterspell)\b/.test(p)) {
    parts.push('type:instant oracle:"counter target"');
  } else if (/\b(draw|card draw|card advantage|cantrip)\b/.test(p)) {
    parts.push('(oracle:"draw a card" or oracle:"draw two cards" or oracle:"draw three cards" or oracle:"draw cards")');
    parts.push('-type:land');
  } else if (/\b(tutor|search your library)\b/.test(p)) {
    parts.push('oracle:"search your library"');
    parts.push('-type:land');
  } else if (/\bproliferat/.test(p)) {
    parts.push('oracle:proliferate');
  } else if (/\b(protection|hexproof|shroud|indestructible)\b/.test(p)) {
    parts.push('(keyword:hexproof or keyword:shroud or keyword:indestructible or oracle:"protection from")');
  } else if (/\b(flier|flyer|flying)\b/.test(p)) {
    parts.push('type:creature keyword:flying');
  } else if (/\b(token)\b/.test(p)) {
    parts.push('oracle:"creature token"');
  } else if (/\b(\+1\/\+1|plus one|counter(s)?)\b/.test(p) && !/counter target/.test(p)) {
    parts.push('oracle:"+1/+1 counter"');
  } else if (/\b(extra turn)\b/.test(p)) {
    parts.push('oracle:"extra turn"');
  } else if (/\b(life(gain)?|gain life)\b/.test(p)) {
    parts.push('oracle:"gain life"');
  } else if (/\b(haste)\b/.test(p)) {
    parts.push('keyword:haste type:creature');
  } else if (/\b(trample)\b/.test(p)) {
    parts.push('keyword:trample type:creature');
  } else if (/\b(reanimat|graveyard recursion|from (the|your) graveyard)\b/.test(p)) {
    parts.push('(oracle:"return target" oracle:"graveyard" or oracle:"from your graveyard")');
  } else if (wantsLands) {
    parts.push('type:land');
  } else if (/\b(artifact)\b/.test(p)) {
    parts.push('type:artifact');
  } else if (/\b(enchantment)\b/.test(p)) {
    parts.push('type:enchantment');
  } else if (/\b(creature)\b/.test(p)) {
    parts.push('type:creature');
  } else if (/\b(instant)\b/.test(p)) {
    parts.push('type:instant');
  } else if (/\b(sorcery)\b/.test(p)) {
    parts.push('type:sorcery');
  } else if (/\b(planeswalker)\b/.test(p)) {
    parts.push('type:planeswalker');
  } else {
    const words = prompt.trim().split(/\s+/).filter((w) => w.length > 3);
    if (words.length > 0) {
      parts.push('oracle:"' + words[0].toLowerCase() + '"');
    }
  }

  if (/\b(cheap|low.?cost|1 mana|2 mana|cmc[<= ]+2)\b/.test(p)) {
    parts.push('cmc<=2');
  } else if (/\b(3 mana|cmc[<= ]+3)\b/.test(p)) {
    parts.push('cmc<=3');
  }

  return parts.join(' ') + ' order:edhrec';
}

// ---------------------------------------------------------------------------
// Claude response parsing
// ---------------------------------------------------------------------------

/**
 * Extract card names from a Claude API response that ends with a
 * `CARDS: Name1 | Name2 | ...` line.
 *
 * @param {string} text - The full text content returned by the Claude API.
 * @returns {string[]} Array of trimmed card name strings.
 */
export function extractCardNamesFromClaudeResponse(text) {
  const match = text.match(/CARDS:\s*(.+)$/m);
  if (!match) return [];
  return match[1]
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Find the first unmatched identifier in `identifiers` whose set+collector_number
 * exactly matches `card`, or fall back to a name match. Marks the matched entry.
 *
 * @param {object} card - Raw Scryfall card object.
 * @param {object[]} identifiers - Mutable array of identifier objects.
 * @returns {object|null}
 */
function findMatchingIdentifier(card, identifiers) {
  const exactIndex = identifiers.findIndex(
    (id) =>
      !id.matched &&
      id.set &&
      id.collector_number &&
      id.set === card.set &&
      id.collector_number === card.collector_number
  );

  if (exactIndex >= 0) {
    identifiers[exactIndex].matched = true;
    return identifiers[exactIndex];
  }

  const fallbackIndex = identifiers.findIndex(
    (id) => !id.matched && id.name === card.name
  );

  if (fallbackIndex >= 0) {
    identifiers[fallbackIndex].matched = true;
    return identifiers[fallbackIndex];
  }

  return null;
}

/**
 * Simple Promise-based delay.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Re-export card utilities consumed by callers that import from this composable
export { getCardImageUri, createStoredCard, applyCardPrinting };
