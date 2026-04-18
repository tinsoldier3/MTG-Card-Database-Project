const STORAGE_KEY = "mtgCollection";

const COMMANDER_DECKS = {
  atraxa: {
    label: "Atraxa",
    colors: ["W", "U", "B", "G"],
    commander: ["Atraxa, Praetors' Voice"]
  },
  merfolk: {
    label: "Merfolk (Sygg)",
    colors: ["W", "U"],
    commander: ["Sygg, Wanderwine Wisdom"]
  },
  "timey wimey": {
    label: "Timey Wimey (Tenth Doctor & Rose)",
    colors: ["W", "U", "R"],
    commander: ["Rose Tyler", "The Tenth Doctor"]
  },
  "bumi unleashed": {
    label: "Bumi Unleashed",
    colors: ["R", "G"],
    commander: ["Bumi, Unleashed"]
  },
  "counter intelligence": {
    label: "Counter Intelligence (Inspirit)",
    colors: ["W", "U", "R"],
    commander: ["Inspirit, Flagship Vessel"]
  },
  chishiro: {
    label: "Chishiro",
    colors: ["R", "G"],
    commander: ["Chishiro, the Shattered Blade"]
  },
  "ashling flame dancer": {
    label: "Ashling Flame Dancer",
    colors: ["R"],
    commander: ["Ashling, Flame Dancer"]
  },
  "play for free": {
    label: "Play for Free (Ellie and Alan)",
    colors: ["W", "U", "G"],
    commander: ["Ellie and Alan, Paleontologists"]
  },
  "food and fellowship": {
    label: "Food and Fellowship (Frodo & Sam)",
    colors: ["W", "B", "G"],
    commander: ["Frodo, Adventurous Hobbit", "Sam, Loyal Attendant"]
  },
  painbow: {
    label: "Painbow (Jared Carthalion)",
    colors: ["W", "U", "B", "R", "G"],
    commander: ["Jared Carthalion"]
  },
  "exit from exile - wolves": {
    label: "Exit From Exile - Wolves (Faldorn)",
    colors: ["R", "G"],
    commander: ["Faldorn, Dread Wolf Herald"]
  },
  vampires: {
    label: "Vampires (Anhelo)",
    colors: ["U", "B", "R"],
    commander: ["Anhelo, the Painter"]
  },
  "1/1 counter deck": {
    label: "1/1 Counter Deck (Shalai and Hallar)",
    colors: ["W", "R", "G"],
    commander: ["Shalai and Hallar"]
  }
};

const DECK_NAME_ALIASES = {
  atraxa: "Atraxa",
  "atraxa (praetors' voice)": "Atraxa",
  merfolk: "Merfolk",
  "merfolk (sygg)": "Merfolk",
  sygg: "Merfolk",
  "timey wimey": "Timey Wimey",
  "timey-wimey": "Timey Wimey",
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
  painbow: "Painbow",
  "jared carthalion": "Painbow",
  "exit from exile - wolves": "Exit From Exile - Wolves",
  "exit from exile": "Exit From Exile - Wolves",
  faldorn: "Exit From Exile - Wolves",
  vampires: "Vampires",
  anhelo: "Vampires",
  "maestro's massacre": "Vampires",
  "1/1 counter deck": "1/1 Counter Deck"
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
let currentView = "decks";

document.addEventListener("DOMContentLoaded", function() {
  cacheElements();
  initializeTheme();
  bindEvents();
  setCurrentViewFromHash();
  populateCommanderFilter();
  populateDeckFilter();
  displayCards();
  refreshMissingColorIdentities();
});

function setCurrentViewFromHash() {
  const hash = window.location.hash.substring(1);
  currentView = hash === "boxes" ? "boxes" : "decks";
  updateNavActive();
  document.title = currentView === "boxes" ? "Collection Boxes - My MTG Collection" : "Decks - My MTG Collection";
}

function initializeTheme() {
  let savedTheme = localStorage.getItem("theme") || "light";
  setTheme(savedTheme);
}

function setTheme(theme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark-mode");
    elements.themeToggle.textContent = "☀️";
    localStorage.setItem("theme", "dark");
  } else {
    document.documentElement.classList.remove("dark-mode");
    elements.themeToggle.textContent = "🌙";
    localStorage.setItem("theme", "light");
  }
}

function toggleTheme() {
  let currentTheme = document.documentElement.classList.contains("dark-mode") ? "dark" : "light";
  let newTheme = currentTheme === "dark" ? "light" : "dark";
  setTheme(newTheme);
}

function cacheElements() {
  elements.cardCount = document.getElementById("cardCount");
  elements.searchInput = document.getElementById("searchInput");
  elements.cardGrid = document.getElementById("cardGrid");
  elements.progressContainer = document.getElementById("progressContainer");
  elements.progressText = document.getElementById("progressText");
  elements.progressBar = document.getElementById("progressBar");
  elements.cardInput = document.getElementById("cardInput");
  elements.quantityInput = document.getElementById("quantityInput");
  elements.foilInput = document.getElementById("foilInput");
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
  elements.repairPrintsButton = document.getElementById("repairPrintsButton");
  elements.exportCollectionButton = document.getElementById("exportCollectionButton");
  elements.importCollectionButton = document.getElementById("importCollectionButton");
  elements.decksLink = document.getElementById("decksLink");
  elements.boxesLink = document.getElementById("boxesLink");
  elements.headerText = document.getElementById("headerText");
  elements.themeToggle = document.getElementById("themeToggle");
  elements.sortSelect = document.getElementById("sortSelect");
}

function bindEvents() {
  elements.searchInput.addEventListener("input", displayCards);
  elements.commanderFilter.addEventListener("change", displayCards);
  elements.deckFilter.addEventListener("change", displayCards);
  elements.addCardButton.addEventListener("click", addCard);
  elements.importDeckButton.addEventListener("click", importDeck);
  elements.repairPrintsButton.addEventListener("click", repairDeckPrints);
  elements.exportCollectionButton.addEventListener("click", exportCollection);
  elements.importCollectionButton.addEventListener("click", importCollectionBackup);
  window.addEventListener("hashchange", handleHashChange);
  elements.themeToggle.addEventListener("click", toggleTheme);
  elements.sortSelect.addEventListener("change", displayCards);
}

function handleHashChange() {
  setCurrentViewFromHash();
  populateDeckFilter();
  displayCards();
}

function updateNavActive() {
  elements.decksLink.classList.toggle("active", currentView === "decks");
  elements.boxesLink.classList.toggle("active", currentView === "boxes");
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
    deck: normalizeDeckName(card.deck || "unsorted"),
    foil: Boolean(card.foil),
    quantity: card.quantity || 1,
    colorIdentity: Array.isArray(card.colorIdentity) ? card.colorIdentity : [],
    set: typeof card.set === "string" ? card.set.toLowerCase() : "",
    collectorNumber: typeof card.collectorNumber === "string" ? card.collectorNumber : "",
    scryfallId: typeof card.scryfallId === "string" ? card.scryfallId : ""
  };
}

function normalizeDeckName(deckName) {
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

function isBoxOrBinder(deckName) {
  let lowerName = deckName.toLowerCase();
  return lowerName.includes("box") || lowerName.includes("binder");
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
  let allDeckNames = Array.from(new Set(collection.map(function(card) {
    return normalizeDeckName(card.deck || "unsorted");
  }))).sort(function(a, b) {
    return a.localeCompare(b);
  });

  let deckNames = allDeckNames.filter(function(deckName) {
    if (currentView === "decks") {
      return !isBoxOrBinder(deckName);
    } else if (currentView === "boxes") {
      return isBoxOrBinder(deckName);
    }
    return true;
  });

  elements.deckFilter.innerHTML = "";

  let allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = currentView === "boxes" ? "All boxes" : "All decks";
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
  if (COMMANDER_DECKS[deckName]) {
    return COMMANDER_DECKS[deckName].label;
  }
  // Title case the deckName
  return deckName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

function showStatusMessage(message) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.classList.remove("hidden");

  clearTimeout(statusMessageTimeout);
  statusMessageTimeout = setTimeout(function() {
    elements.statusMessage.classList.add("hidden");
  }, 2500);
}

function showProgress(message) {
  elements.progressContainer.classList.remove("hidden");
  elements.progressBar.style.width = "0%";
  elements.progressText.textContent = message;
}

function updateProgress(current, total, message) {
  let percent = total > 0 ? Math.round((current / total) * 100) : 0;
  elements.progressBar.style.width = percent + "%";
  elements.progressText.textContent = message;
}

function hideProgress(delay) {
  setTimeout(function() {
    elements.progressContainer.classList.add("hidden");
  }, delay || 0);
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
  let deckName = normalizeDeckName(card.deck || "unsorted");
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
    elements.filterNote.textContent = currentView === "boxes" ? "Showing all boxes and binders." : "Showing all decks.";
  }

  let viewTotal = collection.filter(function(card) {
    let deckName = normalizeDeckName(card.deck || "unsorted");
    if (currentView === "decks") {
      return !isBoxOrBinder(deckName);
    } else if (currentView === "boxes") {
      return isBoxOrBinder(deckName);
    }
    return true;
  }).length;

  let filteredCards = [];
  collection.forEach(function(card, index) {
    let deckName = normalizeDeckName(card.deck || "unsorted");

    if (currentView === "decks" && isBoxOrBinder(deckName)) {
      return;
    }

    if (currentView === "boxes" && !isBoxOrBinder(deckName)) {
      return;
    }

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

    filteredCards.push({ card: card, index: index, deckName: deckName });
    visibleCount++;
  });

  let decks = {};
  filteredCards.forEach(function(entry) {
    if (!decks[entry.deckName]) {
      decks[entry.deckName] = [];
    }
    decks[entry.deckName].push(entry);
  });

  if (currentView === "boxes") {
    // For boxes view, ensure "Collection" for any non-box cards, but since we filtered, all are boxes
    // If no boxes, show "Collection" with all
    if (Object.keys(decks).length === 0) {
      decks["Collection"] = [];
    }
  }

  let deckNames = Object.keys(decks);
  let countLabel;

if (searchQuery) {
  // Searching: show only the number of matches
  countLabel = `${visibleCount} of ${viewTotal}`;
} else if (selectedCommander || selectedDeck) {
  // Filtering by deck or commander
  countLabel = `${visibleCount} of ${viewTotal}`;
} else {
  // No filters: show total cards
  countLabel = viewTotal;
}

  // elements.cardCount.textContent = countLabel;

  let collectionText = currentView === "boxes" ? "in your boxes" : "in your decks";
  elements.headerText.innerHTML = `
  <span id="cardCount">${countLabel}</span> cards ${collectionText}
`;


  if (searchQuery) {
  elements.filterNote.textContent = `Showing results for "${searchQuery}". ${visibleCount} cards found.`;
}


  if (deckNames.length === 0) {
    let emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = selectedCommander || selectedDeck || searchQuery
      ? "No cards match the current filters."
      : currentView === "boxes" ? "No boxes or binders in your collection yet." : "No cards in your decks yet.";
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
    deckHeader.textContent = getDeckDisplayLabel(deckName) + " (" + decks[deckName].length + " cards)";
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

    let sortMode = elements.sortSelect.value;

let deckCommanders = (COMMANDER_DECKS[deckName] && COMMANDER_DECKS[deckName].commander) || [];

decks[deckName].sort(function(a, b) {
  let cardA = a.card;
  let cardB = b.card;

  let aIsCommander = deckCommanders.includes(cardA.name);
  let bIsCommander = deckCommanders.includes(cardB.name);
  if (aIsCommander !== bIsCommander) {
    return aIsCommander ? -1 : 1;
  }

  switch (sortMode) {
    case "type":
      return (cardA.type || "").localeCompare(cardB.type || "");

    case "color":
      return (cardA.colorIdentity.join("") || "")
        .localeCompare(cardB.colorIdentity.join("") || "");

    case "set":
      return (cardA.set || "").localeCompare(cardB.set || "");

    case "collector":
      return (cardA.collectorNumber || "")
        .localeCompare(cardB.collectorNumber || "", undefined, { numeric: true });

    case "name":
    default:
      return cardA.name.localeCompare(cardB.name);
  }
});


    decks[deckName].forEach(function(entry) {
      let card = entry.card;
      let index = entry.index;
      let newCard = document.createElement("div");
      let legality = getDeckLegality(card);
      let deckInputId = getDeckInputId(index);
      let safeCardName = escapeHtml(card.name);
      let safeTypeLine = escapeHtml(card.type || "");
      let safeDeckName = escapeHtml(card.deck || "unsorted");
      let safeImage = escapeHtml(card.image || "");

      newCard.className = legality.checked && !legality.legal ? "card card-illegal" : "card";
      newCard.innerHTML = [
        '<img src="' + safeImage + '" alt="' + safeCardName + ' card image" />',
        '<div class="card-name">' + safeCardName + (card.quantity && card.quantity > 1 ? ' <span class="card-qty">(' + card.quantity + 'x)</span>' : '') + '</div>',
        (card.foil ? '<div class="card-foil">✨ Foil</div>' : ''),
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
    quantity: overrides.quantity || 1,
    colorIdentity: card.color_identity || [],
    set: card.set || overrides.set || "",
    collectorNumber: card.collector_number || overrides.collectorNumber || "",
    scryfallId: card.id || ""
  });
}

function applyCardPrinting(existingCard, fetchedCard, overrides) {
  return normalizeStoredCard({
    ...existingCard,
    name: fetchedCard.name,
    type: fetchedCard.type_line,
    image: getCardImageUri(fetchedCard),
    deck: overrides.deck || existingCard.deck,
    foil: typeof overrides.foil === "boolean" ? overrides.foil : existingCard.foil,
    colorIdentity: fetchedCard.color_identity || existingCard.colorIdentity || [],
    set: fetchedCard.set || overrides.set || existingCard.set || "",
    collectorNumber: fetchedCard.collector_number || overrides.collectorNumber || existingCard.collectorNumber || "",
    scryfallId: fetchedCard.id || existingCard.scryfallId || ""
  });
}

async function addCard() {
  let cardName = elements.cardInput.value.trim();
  let deckName = normalizeDeckName(elements.deckInput.value);
  let quantity = parseInt(elements.quantityInput.value, 10) || 1;
  let foil = elements.foilInput.checked;

  if (!cardName) {
    alert("Please type a card name first!");
    return;
  }

  try {
    let card = await fetchNamedCard(cardName);
    
    // Check for existing card with same name and deck
    let existingIndex = collection.findIndex(function(c) {
      return normalizeDeckName(c.deck || "unsorted") === deckName && 
             c.name === card.name &&
             c.foil === foil;
    });

    if (existingIndex !== -1) {
      // Add quantity to existing card instead of creating duplicate
      collection[existingIndex].quantity = (collection[existingIndex].quantity || 1) + quantity;
      saveCollection();
      populateDeckFilter();
      displayCards();
      showStatusMessage(quantity + "x " + card.name + " added (now " + collection[existingIndex].quantity + " total).");
    } else {
      // Add new card
      collection.push({
        ...createStoredCard(card, {
          deck: deckName,
          foil: foil,
          quantity: quantity
        })
      });

      saveCollection();
      populateDeckFilter();
      displayCards();
      showStatusMessage(quantity + "x " + card.name + " added to " + getDeckDisplayLabel(deckName) + ".");
    }

    elements.cardInput.value = "";
    elements.quantityInput.value = "1";
    elements.foilInput.checked = false;
    elements.cardInput.focus();

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
  let previousDeckName = collection[index].deck || "unsorted";
  collection[index].deck = nextDeckName;
  saveCollection();
  populateDeckFilter();
  displayCards();
  showStatusMessage(collection[index].name + " moved from " + getDeckDisplayLabel(previousDeckName) + " to " + getDeckDisplayLabel(nextDeckName) + ".");
}

function parseDeckLine(line) {
  let cleanedLine = line.replace(/\*F\*/g, "").replace(/\[.*?\]/g, "").trim();
  let exactPrintMatch = cleanedLine.match(/^(\d+)x?\s+(.+?)\s+\(([a-zA-Z0-9]+)\)\s+([a-zA-Z0-9-]+)\s*(.*)$/);
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

function parseDeckFileText(text) {
  let lines = text.split("\n");
  let inMaybeboard = false;
  let identifiers = [];

  lines.forEach(function(line) {
    let trimmed = line.trim();
    if (trimmed.startsWith("// MAYBEBOARD")) {
      inMaybeboard = true;
    }

    if (
      trimmed === ""
      || trimmed.startsWith("// ")
      || trimmed.startsWith("//")
      || inMaybeboard
      || line.includes("{noDeck}")
    ) {
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
        foil: isFoil,
        matched: false
      });
    }
  });

  return identifiers;
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

function findCollectionMatchIndex(deckCards, identifier) {
  let exactIndex = deckCards.findIndex(function(entry) {
    return !entry.matched
      && entry.card.name === identifier.name
      && entry.card.set === identifier.set
      && entry.card.collectorNumber === identifier.collector_number;
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

async function fetchCardsByIdentifiers(identifiers, progressLabel) {
  let chunks = [];
  let allCards = [];
  let notFound = [];
  let processed = 0;

  for (let i = 0; i < identifiers.length; i += 75) {
    chunks.push(identifiers.slice(i, i + 75));
  }

  showProgress(progressLabel + " 0 of " + identifiers.length + " cards...");

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
    updateProgress(processed, identifiers.length, progressLabel + " " + processed + " of " + identifiers.length + " cards...");

    await new Promise(function(resolve) {
      setTimeout(resolve, 200);
    });
  }

  return {
    allCards: allCards,
    notFound: notFound
  };
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
  let identifiers = parseDeckFileText(text);

  if (identifiers.length === 0) {
    alert("No card lines were found in that deck file.");
    return;
  }

  try {
    let result = await fetchCardsByIdentifiers(identifiers, "Importing");
    let allCards = result.allCards;
    let notFound = result.notFound;

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

  hideProgress(3000);
}

async function repairDeckPrints() {
  let deckName = normalizeDeckName(elements.deckInput.value);

  if (!deckName) {
    alert("Please type a deck name before repairing prints.");
    return;
  }

  let file = elements.fileInput.files[0];
  if (!file) {
    alert("Please select the deck txt file used for this deck first.");
    return;
  }

  let deckCards = collection
    .map(function(card, index) {
      return {
        card: card,
        index: index,
        matched: false
      };
    })
    .filter(function(entry) {
      return normalizeDeckName(entry.card.deck) === deckName;
    });

  if (deckCards.length === 0) {
    alert("There are no saved cards in that deck yet.");
    return;
  }

  let text = await file.text();
  let identifiers = parseDeckFileText(text);

  if (identifiers.length === 0) {
    alert("No card lines were found in that deck file.");
    return;
  }

  try {
    let result = await fetchCardsByIdentifiers(identifiers, "Repairing prints for");
    let allCards = result.allCards;
    let updatedCount = 0;
    let unmatchedDeckCards = 0;

    allCards.forEach(function(entry) {
      if (!entry.identifier) {
        return;
      }

      let collectionMatchIndex = findCollectionMatchIndex(deckCards, entry.identifier);
      if (collectionMatchIndex < 0) {
        return;
      }

      let match = deckCards[collectionMatchIndex];
      collection[match.index] = applyCardPrinting(match.card, entry.card, {
        deck: deckName,
        foil: entry.identifier.foil,
        set: entry.identifier.set,
        collectorNumber: entry.identifier.collector_number
      });
      updatedCount += 1;
    });

    unmatchedDeckCards = deckCards.filter(function(entry) {
      return !entry.matched;
    }).length;

    saveCollection();
    populateDeckFilter();
    displayCards();

    elements.progressText.textContent = "Repair complete! Updated " + updatedCount + " cards in " + getDeckDisplayLabel(deckName) + ".";
    elements.progressBar.style.width = "100%";

    if (unmatchedDeckCards > 0 || result.notFound.length > 0) {
      showStatusMessage(
        "Updated " + updatedCount
        + " cards. "
        + unmatchedDeckCards + " saved cards could not be matched, "
        + result.notFound.length + " deck entries were not found."
      );
    } else {
      showStatusMessage("Updated " + updatedCount + " cards to their intended printings.");
    }
  } catch (error) {
    console.error("Unable to repair deck prints.", error);
    alert("Repairing deck prints failed. Please try again.");
  }

  hideProgress(3000);
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
