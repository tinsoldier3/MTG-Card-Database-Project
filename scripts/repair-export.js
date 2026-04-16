const fs = require("fs");
const path = require("path");

const EXPORT_PATH = process.argv[2];

if (!EXPORT_PATH) {
  console.error("Usage: node scripts/repair-export.js <export-json-path>");
  process.exit(1);
}

const DECK_FILE_MAP = [
  { deck: "Atraxa", file: "/Users/cassidy/Downloads/Atraxa.txt" },
  { deck: "Timey-Wimey", file: "/Users/cassidy/Downloads/Timey-Wimey.txt" },
  { deck: "Food and Fellowship", file: "/Users/cassidy/Downloads/Food and Fellowship (Precon).txt" },
  { deck: "Play for Free", file: "/Users/cassidy/Downloads/Play for Free.txt" },
  { deck: "Chishiro", file: "/Users/cassidy/Downloads/Chishiro Precon.txt" },
  { deck: "Counter Intelligence", file: "/Users/cassidy/Downloads/Counter Intellegence Precon.txt" },
  { deck: "Ashling Flame Dancer", file: "/Users/cassidy/Downloads/Ashling Flame Dancer (Luke).txt" },
  { deck: "Merfolk", file: "/Users/cassidy/Downloads/Merfolk - Lorwyn Eclipsed.txt" },
  { deck: "1/1 Counter Deck", file: "/Users/cassidy/Downloads/1_1_counter deck.txt" },
  { deck: "Bumi Unleased", file: "/Users/cassidy/Downloads/Bumi Unleashed.txt" }
];

function normalizeStoredCard(card) {
  return {
    ...card,
    colorIdentity: Array.isArray(card.colorIdentity) ? card.colorIdentity : [],
    set: typeof card.set === "string" ? card.set.toLowerCase() : "",
    collectorNumber: typeof card.collectorNumber === "string" ? card.collectorNumber : "",
    scryfallId: typeof card.scryfallId === "string" ? card.scryfallId : "",
    foil: Boolean(card.foil)
  };
}

function parseDeckLine(line) {
  const cleanedLine = line.replace(/\*F\*/g, "").trim();
  const patterns = [
    /^(\d+)x?\s+(.+?)\s+\(([A-Za-z0-9]+)\)\s+([A-Za-z0-9-]+)(?:\s+\[.*\])?$/,
    /^(\d+)x?\s+(.+?)\s+\(([A-Za-z0-9]+)\)(?:\s+\[.*\])?$/,
    /^(\d+)x?\s+(.+?)\s+\[([A-Za-z0-9]+)\](?:\s+\(F\))?$/
  ];

  for (const pattern of patterns) {
    const match = cleanedLine.match(pattern);
    if (!match) {
      continue;
    }

    let quantity = parseInt(match[1], 10);
    let cardName = match[2].trim();
    let setCode = match[3] ? match[3].toLowerCase() : "";
    let collectorNumber = match[4] || "";

    if (cardName.includes(" // ")) {
      cardName = cardName.split(" // ")[0].trim();
    }

    return {
      quantity,
      cardName,
      set: setCode,
      collectorNumber
    };
  }

  return null;
}

function parseDeckFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split("\n");
  let inMaybeboard = false;
  const identifiers = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("// MAYBEBOARD")) {
      inMaybeboard = true;
    }

    if (
      !trimmed
      || trimmed.startsWith("//")
      || inMaybeboard
      || line.includes("{noDeck}")
    ) {
      continue;
    }

    const isFoil = line.includes("*F*") || line.includes("(F)");
    const parsed = parseDeckLine(line);
    if (!parsed) {
      continue;
    }

    for (let i = 0; i < parsed.quantity; i += 1) {
      identifiers.push({
        name: parsed.cardName,
        set: parsed.set,
        collector_number: parsed.collectorNumber,
        foil: isFoil,
        matched: false
      });
    }
  }

  return identifiers;
}

function chunkArray(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function findMatchingIdentifier(card, identifiers) {
  let exactIndex = identifiers.findIndex((identifier) => {
    return !identifier.matched
      && identifier.set
      && identifier.collector_number
      && identifier.set === card.set
      && identifier.collector_number === card.collector_number;
  });

  if (exactIndex >= 0) {
    identifiers[exactIndex].matched = true;
    return identifiers[exactIndex];
  }

  let nameIndex = identifiers.findIndex((identifier) => {
    return !identifier.matched && identifier.name === card.name;
  });

  if (nameIndex >= 0) {
    identifiers[nameIndex].matched = true;
    return identifiers[nameIndex];
  }

  return null;
}

async function fetchCardsByIdentifiers(identifiers) {
  const allCards = [];
  const notFound = [];

  for (const chunk of chunkArray(identifiers, 75)) {
    const response = await fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifiers: chunk.map((identifier) => ({
          name: identifier.name,
          set: identifier.set,
          collector_number: identifier.collector_number
        }))
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error("Scryfall request failed: " + text);
    }

    const data = await response.json();
    for (const card of data.data || []) {
      allCards.push({
        card,
        identifier: findMatchingIdentifier(card, chunk)
      });
    }

    if (Array.isArray(data.not_found)) {
      notFound.push(...data.not_found);
    }
  }

  return { allCards, notFound };
}

function applyCardPrinting(existingCard, fetchedCard, identifier) {
  return normalizeStoredCard({
    ...existingCard,
    name: fetchedCard.name,
    type: fetchedCard.type_line,
    image: fetchedCard.image_uris?.normal || fetchedCard.card_faces?.[0]?.image_uris?.normal || existingCard.image,
    colorIdentity: fetchedCard.color_identity || existingCard.colorIdentity || [],
    set: fetchedCard.set || identifier.set || existingCard.set || "",
    collectorNumber: fetchedCard.collector_number || identifier.collector_number || existingCard.collectorNumber || "",
    scryfallId: fetchedCard.id || existingCard.scryfallId || "",
    foil: typeof identifier.foil === "boolean" ? identifier.foil : existingCard.foil
  });
}

function findBackupMatchIndex(deckCards, identifier) {
  const exactIndex = deckCards.findIndex((entry) => {
    return !entry.matched
      && entry.card.name === identifier.name
      && entry.card.set === identifier.set
      && entry.card.collectorNumber === identifier.collector_number;
  });

  if (exactIndex >= 0) {
    deckCards[exactIndex].matched = true;
    return exactIndex;
  }

  const nameIndex = deckCards.findIndex((entry) => {
    return !entry.matched && entry.card.name === identifier.name;
  });

  if (nameIndex >= 0) {
    deckCards[nameIndex].matched = true;
    return nameIndex;
  }

  return -1;
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(EXPORT_PATH, "utf8"));
  const cards = (Array.isArray(raw) ? raw : raw.collection).map(normalizeStoredCard);
  const summary = [];

  for (const mapping of DECK_FILE_MAP) {
    if (!fs.existsSync(mapping.file)) {
      summary.push({ deck: mapping.deck, skipped: "deck file missing" });
      continue;
    }

    const identifiers = parseDeckFile(mapping.file);
    if (identifiers.length === 0) {
      summary.push({ deck: mapping.deck, skipped: "no parseable deck entries" });
      continue;
    }

    const deckCards = cards
      .map((card, index) => ({ card, index, matched: false }))
      .filter((entry) => entry.card.deck === mapping.deck);

    if (deckCards.length === 0) {
      summary.push({ deck: mapping.deck, skipped: "no cards in backup" });
      continue;
    }

    const { allCards, notFound } = await fetchCardsByIdentifiers(identifiers);
    let updated = 0;

    for (const entry of allCards) {
      if (!entry.identifier) {
        continue;
      }

      const backupIndex = findBackupMatchIndex(deckCards, entry.identifier);
      if (backupIndex < 0) {
        continue;
      }

      const match = deckCards[backupIndex];
      cards[match.index] = applyCardPrinting(match.card, entry.card, entry.identifier);
      updated += 1;
    }

    summary.push({
      deck: mapping.deck,
      updated,
      deckCards: deckCards.length,
      notFound: notFound.length,
      unmatchedBackupCards: deckCards.filter((entry) => !entry.matched).length
    });
  }

  const outputPath = EXPORT_PATH.replace(/\.json$/i, ".repaired.json");
  const nextRaw = Array.isArray(raw)
    ? cards
    : {
        ...raw,
        exportedAt: new Date().toISOString(),
        cardCount: cards.length,
        collection: cards
      };

  fs.writeFileSync(outputPath, JSON.stringify(nextRaw, null, 2));

  console.log(JSON.stringify({
    outputPath,
    summary
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
