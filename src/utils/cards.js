import {
  DECK_NAME_ALIASES,
  COMMANDER_DECKS,
  COLOR_NAMES,
  DECK_TYPE_CATEGORIES,
  CARD_CONDITIONS
} from "./constants.js";

// ---------------------------------------------------------------------------
// ID / normalization
// ---------------------------------------------------------------------------

export function createCardId() {
  if (typeof window !== "undefined" && window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return "card-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

export function normalizeDeckName(deckName) {
  let trimmedName = (deckName || "").trim();
  if (!trimmedName) {
    return "unsorted";
  }

  let aliasKey = trimmedName.toLowerCase();
  if (DECK_NAME_ALIASES[aliasKey]) {
    return DECK_NAME_ALIASES[aliasKey].toLowerCase();
  }

  let matchedAlias = Object.keys(DECK_NAME_ALIASES).find(function(alias) {
    return aliasKey.includes(alias);
  });

  return matchedAlias ? DECK_NAME_ALIASES[matchedAlias].toLowerCase() : trimmedName.toLowerCase();
}

export function normalizeStoredCard(card) {
  let safeCard = card || {};
  return {
    ...safeCard,
    id: safeCard.id || createCardId(),
    name: typeof safeCard.name === "string" ? safeCard.name : "",
    type: typeof safeCard.type === "string" ? safeCard.type : "",
    image: typeof safeCard.image === "string" ? safeCard.image : "",
    deck: normalizeDeckName(safeCard.deck || "unsorted"),
    foil: Boolean(safeCard.foil),
    quantity:
      Number.isFinite(Number(safeCard.quantity)) && Number(safeCard.quantity) > 0
        ? Number(safeCard.quantity)
        : 1,
    colorIdentity: Array.isArray(safeCard.colorIdentity)
      ? safeCard.colorIdentity.filter(function(color) {
          return typeof color === "string" && color.length > 0;
        })
      : [],
    set: typeof safeCard.set === "string" ? safeCard.set.toLowerCase() : "",
    collectorNumber: typeof safeCard.collectorNumber === "string" ? safeCard.collectorNumber : "",
    scryfallId: typeof safeCard.scryfallId === "string" ? safeCard.scryfallId : "",
    condition: typeof safeCard.condition === "string" ? safeCard.condition : "",
    acquiredDate: typeof safeCard.acquiredDate === "string" ? safeCard.acquiredDate : "",
    purchasePrice:
      safeCard.purchasePrice != null && Number.isFinite(Number(safeCard.purchasePrice))
        ? Number(safeCard.purchasePrice)
        : null,
    notes: typeof safeCard.notes === "string" ? safeCard.notes : ""
  };
}

export function getRowDebugId(row) {
  if (!row || typeof row !== "object") {
    return "unknown-row";
  }
  return row.id || row.name || "unknown-row";
}

export function safelyMapRowsToCards(rows) {
  let skippedRows = [];
  let mappedCards = (rows || []).reduce(function(cards, row) {
    try {
      let card = rowToCard(row);
      if (!card.name) {
        skippedRows.push(getRowDebugId(row));
        return cards;
      }
      cards.push(card);
    } catch (error) {
      let rowDebugId = getRowDebugId(row);
      skippedRows.push(rowDebugId);
      console.warn("Skipping an invalid card row:", rowDebugId, error, row);
    }
    return cards;
  }, []);

  if (skippedRows.length > 0) {
    console.warn("Skipped invalid saved card rows:", skippedRows.join(", "));
  }

  return mappedCards;
}

// ---------------------------------------------------------------------------
// Deck / display helpers
// ---------------------------------------------------------------------------

export function isBoxOrBinder(deckName) {
  let lowerName = deckName.toLowerCase();
  return lowerName.includes("box") || lowerName.includes("binder");
}

export function getDeckDisplayLabel(deckName) {
  if (COMMANDER_DECKS[deckName]) {
    return COMMANDER_DECKS[deckName].label;
  }
  // Title-case the deck name
  return deckName
    .split(" ")
    .map(function(word) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function getColorIdentityLabel(colors) {
  if (!colors || colors.length === 0) {
    return "Colorless";
  }
  return colors
    .map(function(color) {
      return COLOR_NAMES[color] || color;
    })
    .join(", ");
}

export function getPrintLabel(card) {
  if (!card.set) {
    return "";
  }
  let setLabel = card.set.toUpperCase();
  return card.collectorNumber ? setLabel + " #" + card.collectorNumber : setLabel;
}

export function getDeckLegality(card) {
  let deckName = normalizeDeckName(card.deck || "unsorted");
  let hasKnownCommander = Boolean(COMMANDER_DECKS[deckName]);

  if (!hasKnownCommander) {
    return { checked: false, legal: true };
  }

  let commander = COMMANDER_DECKS[deckName];
  let commanderColors = commander ? commander.colors : null;
  if (!commanderColors || !Array.isArray(card.colorIdentity)) {
    return { checked: true, legal: true };
  }

  let legal = card.colorIdentity.every(function(color) {
    return commanderColors.includes(color);
  });

  return { checked: true, legal: legal };
}

export function getDeckTypeCategory(card, deckName) {
  let commanders = (COMMANDER_DECKS[deckName] && COMMANDER_DECKS[deckName].commander) || [];
  if (commanders.includes(card.name)) return "Commander";
  let type = (card.type || "").toLowerCase();
  if (type.includes("creature")) return "Creatures";
  if (type.includes("planeswalker")) return "Planeswalkers";
  if (type.includes("instant")) return "Instants";
  if (type.includes("sorcery")) return "Sorceries";
  if (type.includes("artifact")) return "Artifacts";
  if (type.includes("enchantment")) return "Enchantments";
  if (type.includes("land")) return "Lands";
  return "Other";
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Set display
// ---------------------------------------------------------------------------

export function getSetDisplayLabel(setCode, setNameCache) {
  if (!setCode || setCode === "UNKNOWN") return "Unknown Set";
  let name = setNameCache[setCode.toLowerCase()];
  return name ? name + " (" + setCode.toUpperCase() + ")" : setCode.toUpperCase();
}

// ---------------------------------------------------------------------------
// Condition
// ---------------------------------------------------------------------------

export function getConditionLabel(value) {
  let found = CARD_CONDITIONS.find(function(c) {
    return c.value === value;
  });
  return found ? found.label : value;
}

// ---------------------------------------------------------------------------
// Card image
// ---------------------------------------------------------------------------

export function getCardImageUri(card) {
  if (card.image_uris && card.image_uris.normal) {
    return card.image_uris.normal;
  }
  if (Array.isArray(card.card_faces) && card.card_faces[0] && card.card_faces[0].image_uris) {
    return card.card_faces[0].image_uris.normal;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Create / apply card data
// ---------------------------------------------------------------------------

export function createStoredCard(card, overrides) {
  return normalizeStoredCard({
    name: card.name,
    type: card.type_line,
    image: getCardImageUri(card),
    deck: overrides.deck,
    foil: Boolean(overrides.foil),
    quantity: overrides.quantity || 1,
    colorIdentity: card.color_identity || [],
    set: card.set || overrides.set || "",
    collectorNumber: card.collector_number || overrides.collectorNumber || "",
    scryfallId: card.id || ""
  });
}

export function applyCardPrinting(existingCard, fetchedCard, overrides) {
  return normalizeStoredCard({
    ...existingCard,
    name: fetchedCard.name,
    type: fetchedCard.type_line,
    image: getCardImageUri(fetchedCard),
    deck: overrides.deck || existingCard.deck,
    foil: typeof overrides.foil === "boolean" ? overrides.foil : existingCard.foil,
    colorIdentity: fetchedCard.color_identity || existingCard.colorIdentity || [],
    set: fetchedCard.set || overrides.set || existingCard.set || "",
    collectorNumber:
      fetchedCard.collector_number || overrides.collectorNumber || existingCard.collectorNumber || "",
    scryfallId: fetchedCard.id || existingCard.scryfallId || ""
  });
}

// ---------------------------------------------------------------------------
// Supabase row mapping
// ---------------------------------------------------------------------------

/**
 * Convert a stored card object to a Supabase DB row.
 * @param {object} card
 * @param {string} userId - The authenticated user's ID.
 */
export function cardToRow(card, userId) {
  return {
    id: card.id,
    name: card.name,
    type: card.type,
    deck: card.deck,
    foil: card.foil,
    quantity: card.quantity || 1,
    set: card.set,
    collector_number: card.collectorNumber,
    scryfall_id: card.scryfallId,
    color_identity: card.colorIdentity,
    image: card.image,
    user_id: userId,
    condition: card.condition || null,
    acquired_date: card.acquiredDate || null,
    purchase_price: card.purchasePrice != null ? card.purchasePrice : null,
    notes: card.notes || null
  };
}

export function rowToCard(row) {
  return normalizeStoredCard({
    id: row.id,
    name: row.name,
    type: row.type,
    deck: row.deck,
    foil: row.foil,
    quantity: row.quantity,
    set: row.set,
    collectorNumber: row.collector_number,
    scryfallId: row.scryfall_id,
    colorIdentity: row.color_identity || [],
    image: row.image,
    condition: row.condition || "",
    acquiredDate: row.acquired_date || "",
    purchasePrice: row.purchase_price != null ? Number(row.purchase_price) : null,
    notes: row.notes || ""
  });
}

// ---------------------------------------------------------------------------
// Decklist generation
// ---------------------------------------------------------------------------

export function generateDecklist(groups) {
  let lines = [];
  DECK_TYPE_CATEGORIES.forEach(function(cat) {
    let entries = groups[cat];
    if (!entries || entries.length === 0) return;
    lines.push("// " + cat);
    entries
      .slice()
      .sort(function(a, b) {
        return a.card.name.localeCompare(b.card.name);
      })
      .forEach(function(e) {
        lines.push((e.card.quantity || 1) + " " + e.card.name);
      });
    lines.push("");
  });
  return lines.join("\n").trim();
}

// ---------------------------------------------------------------------------
// Deck file parsing
// ---------------------------------------------------------------------------

export function parseDeckLine(line) {
  let cleanedLine = line.replace(/\*F\*/g, "").replace(/\[.*?\]/g, "").trim();
  let exactPrintMatch = cleanedLine.match(
    /^(\d+)x?\s+(.+?)\s+\(([a-zA-Z0-9]+)\)\s+([a-zA-Z0-9-]+)\s*(.*)$/
  );
  let fallbackMatch = cleanedLine.match(/^(\d+)x?\s+(.+?)\s+\(([a-zA-Z0-9]+)\)\s*(.*)$/);

  if (!exactPrintMatch && !fallbackMatch) {
    return null;
  }

  let match = exactPrintMatch || fallbackMatch;
  let quantity = parseInt(match[1], 10);
  let cardName = match[2].trim();
  let setCode = match[3].toLowerCase();
  let collectorNumber = exactPrintMatch ? match[4] : "";

  if (cardName.includes(" // ")) {
    cardName = cardName.split(" // ")[0].trim();
  }

  return {
    quantity: quantity,
    cardName: cardName,
    set: setCode,
    collectorNumber: collectorNumber
  };
}

export function parseDeckFileText(text) {
  let lines = text.split("\n");
  let inMaybeboard = false;
  let identifiers = [];

  lines.forEach(function(line) {
    let trimmed = line.trim();
    if (trimmed.startsWith("// MAYBEBOARD")) {
      inMaybeboard = true;
    }

    if (
      trimmed === "" ||
      trimmed.startsWith("// ") ||
      trimmed.startsWith("//") ||
      inMaybeboard ||
      line.includes("{noDeck}")
    ) {
      return;
    }

    let isFoil = line.includes("*F*");
    let parsedLine = parseDeckLine(line);
    if (!parsedLine) {
      return;
    }

    identifiers.push({
      name: parsedLine.cardName,
      set: parsedLine.set,
      collector_number: parsedLine.collectorNumber,
      quantity: parsedLine.quantity,
      foil: isFoil,
      matched: false
    });
  });

  return identifiers;
}

export function consolidateImportIdentifiers(identifiers) {
  let seen = {};
  let result = [];
  identifiers.forEach(function(id) {
    let key = id.name.toLowerCase() + "|" + (id.foil ? "foil" : "nonfoil");
    if (key in seen) {
      result[seen[key]].quantity = (result[seen[key]].quantity || 1) + (id.quantity || 1);
    } else {
      seen[key] = result.length;
      result.push(Object.assign({}, id));
    }
  });
  return result;
}

export function findMatchingIdentifier(card, identifiers) {
  let exactIndex = identifiers.findIndex(function(identifier) {
    return (
      !identifier.matched &&
      identifier.set &&
      identifier.collector_number &&
      identifier.set === card.set &&
      identifier.collector_number === card.collector_number
    );
  });

  if (exactIndex >= 0) {
    identifiers[exactIndex].matched = true;
    return identifiers[exactIndex];
  }

  let fallbackIndex = identifiers.findIndex(function(identifier) {
    return !identifier.matched && identifier.name === card.name;
  });

  if (fallbackIndex >= 0) {
    identifiers[fallbackIndex].matched = true;
    return identifiers[fallbackIndex];
  }

  return null;
}

export function findCollectionMatchIndex(deckCards, identifier) {
  let exactIndex = deckCards.findIndex(function(entry) {
    return (
      !entry.matched &&
      entry.card.name === identifier.name &&
      entry.card.set === identifier.set &&
      entry.card.collectorNumber === identifier.collector_number
    );
  });

  if (exactIndex >= 0) {
    deckCards[exactIndex].matched = true;
    return exactIndex;
  }

  let nameIndex = deckCards.findIndex(function(entry) {
    return !entry.matched && entry.card.name === identifier.name;
  });

  if (nameIndex >= 0) {
    deckCards[nameIndex].matched = true;
    return nameIndex;
  }

  return -1;
}

// ---------------------------------------------------------------------------
// Price / mana curve / color distribution
// ---------------------------------------------------------------------------

export function calcDeckPrice(deckEntries, scryfallData) {
  let total = 0;
  let hasAny = false;
  deckEntries.forEach(function(e) {
    let sfData = e.card.scryfallId ? scryfallData[e.card.scryfallId] : null;
    if (!sfData || !sfData.prices) return;
    let qty = e.card.quantity || 1;
    let priceStr = e.card.foil
      ? sfData.prices.usd_foil || sfData.prices.usd || "0"
      : sfData.prices.usd || sfData.prices.usd_foil || "0";
    let price = parseFloat(priceStr || "0");
    if (price > 0) {
      total += price * qty;
      hasAny = true;
    }
  });
  return hasAny ? total.toFixed(2) : null;
}

/**
 * Build mana curve bucket counts from deck entries and Scryfall data.
 * @param {Array} deckEntries - Array of { card, index } objects.
 * @param {object} scryfallData - Map of scryfallId -> { cmc, prices }.
 * @param {string} deckName - The normalized deck name (used to detect commanders/lands).
 */
export function buildManaCurveData(deckEntries, scryfallData, deckName) {
  let curve = { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6+": 0 };
  deckEntries.forEach(function(e) {
    let cat = getDeckTypeCategory(e.card, deckName);
    if (cat === "Lands") return;
    let sfData = e.card.scryfallId ? scryfallData[e.card.scryfallId] : null;
    let cmc = sfData ? sfData.cmc : 0;
    let qty = e.card.quantity || 1;
    let bucket = cmc >= 6 ? "6+" : String(Math.floor(cmc));
    curve[bucket] = (curve[bucket] || 0) + qty;
  });
  return curve;
}

/**
 * Build and return a DOM element showing the color distribution of the deck.
 * Returns null if there are no colors to show.
 * @param {Array} deckEntries - Array of { card, index } objects.
 * @returns {HTMLElement|null}
 */
export function buildColorDistributionEl(deckEntries) {
  let counts = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  deckEntries.forEach(function(e) {
    let qty = e.card.quantity || 1;
    let colors = e.card.colorIdentity || [];
    if (colors.length === 0) {
      counts.C += qty;
    } else {
      colors.forEach(function(c) {
        if (Object.prototype.hasOwnProperty.call(counts, c)) counts[c] += qty;
      });
    }
  });

  let present = ["W", "U", "B", "R", "G", "C"].filter(function(c) {
    return counts[c] > 0;
  });
  if (present.length === 0) return null;

  let max = Math.max.apply(
    null,
    present.map(function(c) {
      return counts[c];
    })
  );

  let wrap = document.createElement("div");
  wrap.className = "deck-detail-color-dist";

  let heading = document.createElement("h4");
  heading.className = "deck-detail-breakdown-heading";
  heading.textContent = "Colors";
  wrap.appendChild(heading);

  present.forEach(function(c) {
    let row = document.createElement("div");
    row.className = "color-dist-row";

    let pip = document.createElement("span");
    pip.className = "color-pip color-pip-" + c.toLowerCase();
    pip.title = COLOR_NAMES[c] || c;
    row.appendChild(pip);

    let track = document.createElement("div");
    track.className = "color-dist-track";
    let fill = document.createElement("div");
    fill.className = "color-dist-fill color-dist-fill-" + c.toLowerCase();
    fill.style.width = Math.max(4, Math.round((counts[c] / max) * 100)) + "%";
    fill.style.height = "100%";
    track.appendChild(fill);
    row.appendChild(track);

    let countEl = document.createElement("span");
    countEl.className = "color-dist-count";
    countEl.textContent = counts[c];
    row.appendChild(countEl);

    wrap.appendChild(row);
  });

  return wrap;
}

// ---------------------------------------------------------------------------
// Async helpers
// ---------------------------------------------------------------------------

export function withTimeout(promise, timeoutMs, message) {
  let timerId;
  let timeout = new Promise(function(_, reject) {
    timerId = setTimeout(function() {
      reject(new Error(message));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(function() {
    clearTimeout(timerId);
  });
}

export function getCollectionLoadErrorMessage(error) {
  let message =
    error && typeof error.message === "string" ? error.message.toLowerCase() : "";

  if (
    message.includes("jwt") ||
    message.includes("token") ||
    message.includes("auth")
  ) {
    return "Your session expired while loading cards. Sign out and back in if a refresh doesn't fix it.";
  }

  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("timeout")
  ) {
    return "We couldn't reach Supabase to load your cards. Check your connection and try again.";
  }

  return "We couldn't load your cards from Supabase right now. Try refreshing the page in a moment.";
}
