const STORAGE_KEY = "mtgCollection";

const COMMANDER_DECKS = {
  Atraxa: {
    label: "Atraxa",
    colors: ["W", "U", "B", "G"]
  },
  Merfolk: {
    label: "Merfolk (Sygg)",
    colors: ["W", "U"]
  },
  "Timey Wimey": {
    label: "Timey Wimey (Tenth Doctor & Rose)",
    colors: ["W", "U", "R"]
  },
  "Bumi Unleashed": {
    label: "Bumi Unleashed",
    colors: ["R", "G"]
  },
  "Counter Intelligence": {
    label: "Counter Intelligence (Inspirit)",
    colors: ["W", "U", "R"]
  },
  Chishiro: {
    label: "Chishiro",
    colors: ["R", "G"]
  },
  "Ashling Flame Dancer": {
    label: "Ashling Flame Dancer",
    colors: ["R"]
  },
  "Play for Free": {
    label: "Play for Free (Ellie and Alan)",
    colors: ["W", "U", "G"]
  },
  "Food and Fellowship": {
    label: "Food and Fellowship (Frodo & Sam)",
    colors: ["W", "B", "G"]
  },
  "Shalai and Hallar": {
    label: "Shalai and Hallar",
    colors: ["W", "R", "G"]
  }
};

const DECK_NAME_ALIASES = {
  atraxa: "Atraxa",
  "atraxa (praetors' voice)": "Atraxa",
  merfolk: "Merfolk",
  "merfolk (sygg)": "Merfolk",
  sygg: "Merfolk",
  "timey wimey": "Timey Wimey",
  "timey wimey (tenth doctor & rose)": "Timey Wimey",
  "tenth doctor & rose": "Timey Wimey",
  "bumi unleashed": "Bumi Unleashed",
  "counter intelligence": "Counter Intelligence",
  "counter intelligence (inspirit)": "Counter Intelligence",
  inspirit: "Counter Intelligence",
  chishiro: "Chishiro",
  ashling: "Ashling Flame Dancer",
  "ashling flame dancer": "Ashling Flame Dancer",
  "play for free": "Play for Free",
  "play for free (ellie and alan)": "Play for Free",
  "ellie and alan": "Play for Free",
  "food and fellowship": "Food and Fellowship",
  "food and fellowship (frodo & sam)": "Food and Fellowship",
  "frodo & sam": "Food and Fellowship",
  "shalai and hallar": "Shalai and Hallar"
};

const COLOR_NAMES = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green"
};

const elements = {};
let collection = loadCollection();
let statusMessageTimeout;

document.addEventListener("DOMContentLoaded", function() {
  cacheElements();
  bindEvents();
  populateCommanderFilter();
  populateDeckFilter();
  displayCards();
  refreshMissingColorIdentities();
});

function cacheElements() {
  elements.cardCount = document.getElementById("cardCount");
  elements.searchInput = document.getElementById("searchInput");
  elements.cardGrid = document.getElementById("cardGrid");
  elements.progressContainer = document.getElementById("progressContainer");
  elements.progressText = document.getElementById("progressText");
  elements.progressBar = document.getElementById("progressBar");
  elements.cardInput = document.getElementById("cardInput");
  elements.deckInput = document.getElementById("deckInput");
  elements.fileInput = document.getElementById("fileInput");
  elements.collectionImportInput = document.getElementById("collectionImportInput");
  elements.deckOptions = document.getElementById("deckOptions");
  elements.commanderFilter = document.getElementById("commanderFilter");
  elements.deckFilter = document.getElementById("deckFilter");
  elements.filterNote = document.getElementById("filterNote");
  elements.statusMessage = document.getElementById("statusMessage");
  elements.addCardButton = document.getElementById("addCardButton");
  elements.importDeckButton = document.getElementById("importDeckButton");
  elements.exportCollectionButton = document.getElementById("exportCollectionButton");
  elements.importCollectionButton = document.getElementById("importCollectionButton");
}

function bindEvents() {
  elements.searchInput.addEventListener("input", displayCards);
  elements.commanderFilter.addEventListener("change", displayCards);
  elements.deckFilter.addEventListener("change", displayCards);
  elements.addCardButton.addEventListener("click", addCard);
  elements.importDeckButton.addEventListener("click", importDeck);
  elements.exportCollectionButton.addEventListener("click", exportCollection);
  elements.importCollectionButton.addEventListener("click", importCollectionBackup);
}

function loadCollection() {
  try {
    let storedCollection = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return storedCollection.map(normalizeStoredCard);
  } catch (error) {
    console.error("Unable to load collection from storage.", error);
    return [];
  }
}

function saveCollection() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
}

function normalizeStoredCard(card) {
  return {
    ...card,
    deck: normalizeDeckName(card.deck || "Unsorted"),
    colorIdentity: Array.isArray(card.colorIdentity) ? card.colorIdentity : [],
    set: typeof card.set === "string" ? card.set.toLowerCase() : "",
    collectorNumber: typeof card.collectorNumber === "string" ? card.collectorNumber : "",
    scryfallId: typeof card.scryfallId === "string" ? card.scryfallId : ""
  };
}

function normalizeDeckName(deckName) {
  let trimmedName = (deckName || "").trim();
  if (!trimmedName) {
    return "Unsorted";
  }

  let aliasKey = trimmedName.toLowerCase();
  if (DECK_NAME_ALIASES[aliasKey]) {
    return DECK_NAME_ALIASES[aliasKey];
  }

  let matchedAlias = Object.keys(DECK_NAME_ALIASES).find(function(alias) {
    return aliasKey.includes(alias);
  });

  return matchedAlias ? DECK_NAME_ALIASES[matchedAlias] : trimmedName;
}

function populateCommanderFilter() {
  elements.commanderFilter.innerHTML = "";
  elements.deckOptions.innerHTML = "";

  let allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All cards";
  elements.commanderFilter.appendChild(allOption);

  Object.keys(COMMANDER_DECKS).forEach(function(deckName) {
    let filterOption = document.createElement("option");
    filterOption.value = deckName;
    filterOption.textContent = COMMANDER_DECKS[deckName].label;
    elements.commanderFilter.appendChild(filterOption);

    let deckOption = document.createElement("option");
    deckOption.value = deckName;
    elements.deckOptions.appendChild(deckOption);
  });
}

function populateDeckFilter() {
  let selectedValue = elements.deckFilter.value;
  let deckNames = Array.from(new Set(collection.map(function(card) {
    return normalizeDeckName(card.deck || "Unsorted");
  }))).sort(function(a, b) {
    return a.localeCompare(b);
  });

  elements.deckFilter.innerHTML = "";

  let allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All decks";
  elements.deckFilter.appendChild(allOption);

  deckNames.forEach(function(deckName) {
    let option = document.createElement("option");
    option.value = deckName;
    option.textContent = getDeckDisplayLabel(deckName);
    elements.deckFilter.appendChild(option);
  });

  elements.deckFilter.value = deckNames.includes(selectedValue) ? selectedValue : "";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getDeckDisplayLabel(deckName) {
  return COMMANDER_DECKS[deckName] ? COMMANDER_DECKS[deckName].label : deckName;
}

function showStatusMessage(message) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.classList.remove("hidden");

  clearTimeout(statusMessageTimeout);
  statusMessageTimeout = setTimeout(function() {
    elements.statusMessage.classList.add("hidden");
  }, 2500);
}

function getColorIdentityLabel(colors) {
  if (!colors || colors.length === 0) {
    return "Colorless";
  }

  return colors.map(function(color) {
    return COLOR_NAMES[color] || color;
  }).join(", ");
}

function getPrintLabel(card) {
  if (!card.set) {
    return "";
  }

  let setLabel = card.set.toUpperCase();
  return card.collectorNumber
    ? setLabel + " #" + card.collectorNumber
    : setLabel;
}

function isCardLegalForCommander(card, commanderName) {
  if (!commanderName) {
    return true;
  }

  let commander = COMMANDER_DECKS[normalizeDeckName(commanderName)];
  let commanderColors = commander ? commander.colors : null;
  if (!commanderColors || !Array.isArray(card.colorIdentity)) {
    return true;
  }

  return card.colorIdentity.every(function(color) {
    return commanderColors.includes(color);
  });
}

function getDeckLegality(card) {
  let deckName = normalizeDeckName(card.deck || "Unsorted");
  let hasKnownCommander = Boolean(COMMANDER_DECKS[deckName]);

  if (!hasKnownCommander) {
    return {
      checked: false,
      legal: true
    };
  }

  return {
    checked: true,
    legal: isCardLegalForCommander(card, deckName)
  };
}

function getDeckInputId(index) {
  return "deckEdit-" + index;
}

function displayCards() {
  let selectedCommander = elements.commanderFilter.value;
  let selectedDeck = elements.deckFilter.value;
  let searchQuery = elements.searchInput.value.toLowerCase().trim();
  let visibleCount = 0;
  elements.cardGrid.innerHTML = "";

  if (searchQuery) {
    elements.filterNote.textContent = "Showing results for \"" + searchQuery + "\".";
  } else if (selectedCommander && selectedDeck) {
    elements.filterNote.textContent = "Showing cards in " + getDeckDisplayLabel(selectedDeck) + " that are legal in " + selectedCommander + ".";
  } else if (selectedCommander) {
    elements.filterNote.textContent = "Showing cards legal in " + selectedCommander + ".";
  } else if (selectedDeck) {
    elements.filterNote.textContent = "Showing cards in " + getDeckDisplayLabel(selectedDeck) + ".";
  } else {
    elements.filterNote.textContent = "Showing all cards.";
  }

  let decks = {};
  collection.forEach(function(card, index) {
    let deckName = normalizeDeckName(card.deck || "Unsorted");

    if (selectedDeck && deckName !== selectedDeck) {
      return;
    }

    if (!isCardLegalForCommander(card, selectedCommander)) {
      return;
    }

    if (searchQuery) {
      let nameMatch = card.name.toLowerCase().includes(searchQuery);
      let typeMatch = (card.type || "").toLowerCase().includes(searchQuery);
      let deckMatch = deckName.toLowerCase().includes(searchQuery);
      if (!nameMatch && !typeMatch && !deckMatch) {
        return;
      }
    }

    visibleCount += 1;
    if (!decks[deckName]) {
      decks[deckName] = [];
    }
    decks[deckName].push({ card: card, index: index });
  });

  let deckNames = Object.keys(decks);
  let countLabel = selectedCommander || selectedDeck ? visibleCount + " of " + collection.length : collection.length;
  elements.cardCount.textContent = countLabel;

  if (searchQuery) {
    elements.filterNote.textContent += " " + visibleCount + " cards found.";
  }

  if (deckNames.length === 0) {
    let emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = selectedCommander || selectedDeck || searchQuery
      ? "No cards match the current filters."
      : "No cards in your collection yet.";
    elements.cardGrid.appendChild(emptyState);
    return;
  }

  deckNames.sort(function(a, b) {
    return a.localeCompare(b);
  });

  deckNames.forEach(function(deckName) {
    let deckSection = document.createElement("section");
    deckSection.className = "deck-section";

    let illegalCount = decks[deckName].filter(function(entry) {
      let legality = getDeckLegality(entry.card);
      return legality.checked && !legality.legal;
    }).length;

    let deckHeader = document.createElement("h2");
    deckHeader.className = "deck-heading";
    deckHeader.textContent = deckName + " (" + decks[deckName].length + " cards)";
    deckSection.appendChild(deckHeader);

    if (COMMANDER_DECKS[deckName]) {
      let deckMeta = document.createElement("p");
      deckMeta.className = "deck-meta";
      deckMeta.textContent = illegalCount > 0
        ? illegalCount + " card" + (illegalCount === 1 ? "" : "s") + " outside this commander's color identity."
        : "All visible cards match this commander's color identity.";
      deckSection.appendChild(deckMeta);
    }

    let deckGrid = document.createElement("div");
    deckGrid.className = "card-grid";
    deckSection.appendChild(deckGrid);

    decks[deckName].sort(function(a, b) {
      return a.card.name.localeCompare(b.card.name);
    });

    decks[deckName].forEach(function(entry) {
      let card = entry.card;
      let index = entry.index;
      let newCard = document.createElement("div");
      let legality = getDeckLegality(card);
      let deckInputId = getDeckInputId(index);
      let safeCardName = escapeHtml(card.name);
      let safeTypeLine = escapeHtml(card.type || "");
      let safeDeckName = escapeHtml(card.deck || "Unsorted");
      let safeImage = escapeHtml(card.image || "");

      newCard.className = legality.checked && !legality.legal ? "card card-illegal" : "card";
      newCard.innerHTML = [
        '<img src="' + safeImage + '" alt="' + safeCardName + ' card image" />',
        '<div class="card-name">' + safeCardName + '</div>',
        '<div class="card-type">' + safeTypeLine + '</div>',
        getPrintLabel(card) ? '<div class="card-print">Print: ' + escapeHtml(getPrintLabel(card)) + '</div>' : "",
        '<div class="card-colors">Color identity: ' + getColorIdentityLabel(card.colorIdentity) + '</div>',
        legality.checked && !legality.legal ? '<div class="status-badge illegal">Illegal for this deck</div>' : "",
        '<div class="card-controls">',
        '<input type="text" id="' + deckInputId + '" list="deckOptions" value="' + safeDeckName + '" aria-label="Deck name for ' + safeCardName + '" />',
        '<button type="button" data-action="move" data-index="' + index + '">Move to deck</button>',
        '<button type="button" data-action="remove" data-index="' + index + '">Remove</button>',
        "</div>"
      ].join("");
      deckGrid.appendChild(newCard);
    });

    elements.cardGrid.appendChild(deckSection);
  });

  bindCardActionButtons();
}

function bindCardActionButtons() {
  document.querySelectorAll("[data-action='move']").forEach(function(button) {
    button.addEventListener("click", function() {
      updateCardDeck(Number(button.dataset.index));
    });
  });

  document.querySelectorAll("[data-action='remove']").forEach(function(button) {
    button.addEventListener("click", function() {
      removeCard(Number(button.dataset.index));
    });
  });
}

async function fetchNamedCard(cardName) {
  let response = await fetch("https://api.scryfall.com/cards/named?fuzzy=" + encodeURIComponent(cardName));
  let card = await response.json();

  if (!response.ok || card.object === "error") {
    throw new Error(card.details || "Unable to find that card on Scryfall.");
  }

  return card;
}

function getCardImageUri(card) {
  if (card.image_uris && card.image_uris.normal) {
    return card.image_uris.normal;
  }

  if (Array.isArray(card.card_faces) && card.card_faces[0] && card.card_faces[0].image_uris) {
    return card.card_faces[0].image_uris.normal;
  }

  return "";
}

function createStoredCard(card, overrides) {
  return normalizeStoredCard({
    name: card.name,
    type: card.type_line,
    image: getCardImageUri(card),
    deck: overrides.deck,
    foil: Boolean(overrides.foil),
    colorIdentity: card.color_identity || [],
    set: card.set || overrides.set || "",
    collectorNumber: card.collector_number || overrides.collectorNumber || "",
    scryfallId: card.id || ""
  });
}

async function addCard() {
  let cardName = elements.cardInput.value.trim();
  let deckName = normalizeDeckName(elements.deckInput.value);

  if (!cardName) {
    alert("Please type a card name first!");
    return;
  }

  try {
    let card = await fetchNamedCard(cardName);

    collection.push({
      ...createStoredCard(card, {
        deck: deckName,
        foil: false
      })
    });

    saveCollection();
    populateDeckFilter();
    displayCards();
    elements.cardInput.value = "";
    showStatusMessage(card.name + " added to " + getDeckDisplayLabel(deckName) + ".");

    if (COMMANDER_DECKS[deckName]) {
      elements.commanderFilter.value = deckName;
      displayCards();
    }
  } catch (error) {
    alert(error.message);
  }
}

function removeCard(index) {
  let removedCardName = collection[index].name;
  collection.splice(index, 1);
  saveCollection();
  populateDeckFilter();
  displayCards();
  showStatusMessage(removedCardName + " removed.");
}

function updateCardDeck(index) {
  let input = document.getElementById(getDeckInputId(index));
  if (!input) {
    return;
  }

  let nextDeckName = normalizeDeckName(input.value);
  let previousDeckName = collection[index].deck || "Unsorted";
  collection[index].deck = nextDeckName;
  saveCollection();
  populateDeckFilter();
  displayCards();
  showStatusMessage(collection[index].name + " moved from " + getDeckDisplayLabel(previousDeckName) + " to " + getDeckDisplayLabel(nextDeckName) + ".");
}

function parseDeckLine(line) {
  let cleanedLine = line.replace(/\*F\*/g, "").replace(/\[.*?\]/g, "").trim();
  let exactPrintMatch = cleanedLine.match(/^(\d+)x?\s+(.+?)\s+\(([a-zA-Z0-9]+)\)\s+([a-zA-Z0-9-]+)$/);
  let fallbackMatch = cleanedLine.match(/^(\d+)x?\s+(.+?)\s+\(([a-zA-Z0-9]+)\)$/);

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

function findMatchingIdentifier(card, identifiers) {
  let exactIndex = identifiers.findIndex(function(identifier) {
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

  let fallbackIndex = identifiers.findIndex(function(identifier) {
    return !identifier.matched && identifier.name === card.name;
  });

  if (fallbackIndex >= 0) {
    identifiers[fallbackIndex].matched = true;
    return identifiers[fallbackIndex];
  }

  return null;
}

async function refreshMissingColorIdentities() {
  let missingCards = collection.filter(function(card) {
    return !Array.isArray(card.colorIdentity) || card.colorIdentity.length === 0;
  });

  if (missingCards.length === 0) {
    return;
  }

  let uniqueNames = Array.from(new Set(missingCards.map(function(card) {
    return card.name;
  })));

  let identifiers = uniqueNames.map(function(name) {
    return { name: name };
  });

  for (let i = 0; i < identifiers.length; i += 75) {
    let chunk = identifiers.slice(i, i + 75);

    try {
      let response = await fetch("https://api.scryfall.com/cards/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers: chunk })
      });

      let data = await response.json();
      let colorMap = {};

      (data.data || []).forEach(function(card) {
        colorMap[card.name] = card.color_identity || [];
      });

      collection = collection.map(function(card) {
        if (colorMap[card.name]) {
          return {
            ...card,
            colorIdentity: colorMap[card.name]
          };
        }

        return card;
      });
    } catch (error) {
      console.error("Unable to refresh color identities.", error);
      return;
    }
  }

  saveCollection();
  populateDeckFilter();
  displayCards();
}

async function importDeck() {
  let deckName = normalizeDeckName(elements.deckInput.value);

  if (!deckName) {
    alert("Please type a deck name before importing!");
    return;
  }

  let file = elements.fileInput.files[0];

  if (!file) {
    alert("Please select a txt file first!");
    return;
  }

  let text = await file.text();
  let lines = text.split("\n");

  let inMaybeboard = false;
  let cardLines = lines.filter(function(line) {
    let trimmed = line.trim();
    if (trimmed.startsWith("// MAYBEBOARD")) {
      inMaybeboard = true;
    }
    if (trimmed === "" || trimmed.startsWith("// ")) {
      return false;
    }
    if (trimmed.startsWith("//")) {
      return false;
    }
    if (inMaybeboard) {
      return false;
    }
    return true;
  });

  let identifiers = [];
  cardLines.forEach(function(line) {
    if (line.includes("{noDeck}")) {
      return;
    }

    let isFoil = line.includes("*F*");
    let parsedLine = parseDeckLine(line);
    if (!parsedLine) {
      return;
    }

    for (let i = 0; i < parsedLine.quantity; i += 1) {
      identifiers.push({
        name: parsedLine.cardName,
        set: parsedLine.set,
        collector_number: parsedLine.collectorNumber,
        foil: isFoil
      });
    }
  });

  if (identifiers.length === 0) {
    alert("No card lines were found in that deck file.");
    return;
  }

  let chunks = [];
  for (let i = 0; i < identifiers.length; i += 75) {
    chunks.push(identifiers.slice(i, i + 75));
  }

  elements.progressContainer.classList.remove("hidden");
  elements.progressBar.style.width = "0%";
  elements.progressText.textContent = "Starting import of " + identifiers.length + " cards into " + deckName + "...";

  let allCards = [];
  let notFound = [];
  let processed = 0;

  try {
    for (let index = 0; index < chunks.length; index += 1) {
      let chunk = chunks[index];
      let response = await fetch("https://api.scryfall.com/cards/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifiers: chunk.map(function(identifier) {
            return {
              name: identifier.name,
              set: identifier.set,
              collector_number: identifier.collector_number
            };
          })
        })
      });

      let data = await response.json();
      (data.data || []).forEach(function(card) {
        allCards.push({
          card: card,
          identifier: findMatchingIdentifier(card, chunk)
        });
      });

      if (data.not_found) {
        notFound = notFound.concat(data.not_found);
      }

      processed += chunk.length;
      let percent = Math.round((processed / identifiers.length) * 100);
      elements.progressBar.style.width = percent + "%";
      elements.progressText.textContent = "Imported " + processed + " of " + identifiers.length + " cards...";

      await new Promise(function(resolve) {
        setTimeout(resolve, 200);
      });
    }

    allCards.forEach(function(entry) {
      collection.push(createStoredCard(entry.card, {
        deck: deckName,
        foil: entry.identifier ? entry.identifier.foil : false,
        set: entry.identifier ? entry.identifier.set : "",
        collectorNumber: entry.identifier ? entry.identifier.collector_number : ""
      }));
    });

    elements.progressText.textContent = notFound.length > 0
      ? "Import complete! " + allCards.length + " cards added. " + notFound.length + " not found."
      : "Import complete! All " + allCards.length + " cards added to " + deckName + ".";
    elements.progressBar.style.width = "100%";

    if (notFound.length > 0) {
      console.log("Cards not found:", notFound);
    }

    saveCollection();
    populateDeckFilter();
    displayCards();
    showStatusMessage(allCards.length + " cards imported to " + getDeckDisplayLabel(deckName) + ".");
  } catch (error) {
    console.error("Unable to import deck.", error);
    alert("Deck import failed. Please try again.");
  }

  setTimeout(function() {
    elements.progressContainer.classList.add("hidden");
  }, 3000);
}

function exportCollection() {
  let exportPayload = {
    exportedAt: new Date().toISOString(),
    cardCount: collection.length,
    collection: collection
  };

  let blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
  let url = URL.createObjectURL(blob);
  let downloadLink = document.createElement("a");
  let dateLabel = new Date().toISOString().slice(0, 10);

  downloadLink.href = url;
  downloadLink.download = "mtg-collection-backup-" + dateLabel + ".json";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(url);

  showStatusMessage("Collection exported as a JSON backup.");
}

async function importCollectionBackup() {
  let file = elements.collectionImportInput.files[0];

  if (!file) {
    alert("Please choose a JSON backup file first.");
    return;
  }

  try {
    let text = await file.text();
    let parsed = JSON.parse(text);
    let importedCards = Array.isArray(parsed) ? parsed : parsed.collection;

    if (!Array.isArray(importedCards)) {
      throw new Error("Invalid backup format.");
    }

    collection = importedCards.map(normalizeStoredCard);
    saveCollection();
    populateDeckFilter();
    displayCards();
    elements.collectionImportInput.value = "";
    showStatusMessage("Collection backup imported successfully.");
  } catch (error) {
    console.error("Unable to import collection backup.", error);
    alert("That JSON backup could not be imported.");
  }
}
