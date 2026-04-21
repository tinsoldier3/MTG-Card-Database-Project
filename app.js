const STORAGE_KEY = "mtgCollection";
const SUPABASE_URL = "https://sxilslbrrrxhysqthdre.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4aWxzbGJycnJ4aHlzcXRoZHJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NTc3NzQsImV4cCI6MjA5MjEzMzc3NH0.vRPVR1H0TxBhnu9YRikxQ9nd48mxK8v0Z-bY-LBl5wU";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
let collection = [];
let currentUserId = null;
let statusMessageTimeout;
let currentView = "decks";
let setNameCache = {};
let realtimeChannel = null;
let isPasswordRecovery = false;

document.addEventListener("DOMContentLoaded", async function() {
  cacheElements();
  initializeTheme();
  bindEvents();

  supabaseClient.auth.onAuthStateChange(async function(event, session) {
    if (event === "PASSWORD_RECOVERY") {
      isPasswordRecovery = true;
      showResetPasswordPanel();
    } else if (event === "SIGNED_IN" && session) {
      if (isPasswordRecovery) return;
      currentUserId = session.user.id;
      await initApp(session.user.email);
    } else if (event === "SIGNED_OUT") {
      isPasswordRecovery = false;
      unsubscribeFromCollection();
      collection = [];
      currentUserId = null;
      showAuthPanel();
    }
  });

  let { data: { session } } = await supabaseClient.auth.getSession();
  if (!isPasswordRecovery) {
    if (session) {
      currentUserId = session.user.id;
      await initApp(session.user.email);
    } else {
      showAuthPanel();
    }
  }
});

async function loadSetNames() {
  const CACHE_KEY = "mtgSetNames";
  const CACHE_AGE_KEY = "mtgSetNamesAge";
  const ONE_DAY = 86400000;

  let cached = localStorage.getItem(CACHE_KEY);
  let cacheAge = parseInt(localStorage.getItem(CACHE_AGE_KEY) || "0");

  if (cached && Date.now() - cacheAge < ONE_DAY) {
    setNameCache = JSON.parse(cached);
    displayCards();
    return;
  }

  try {
    let response = await fetch("https://api.scryfall.com/sets");
    let data = await response.json();
    if (data.object === "list" && Array.isArray(data.data)) {
      data.data.forEach(function(set) {
        setNameCache[set.code.toLowerCase()] = set.name;
      });
      localStorage.setItem(CACHE_KEY, JSON.stringify(setNameCache));
      localStorage.setItem(CACHE_AGE_KEY, String(Date.now()));
      if (currentView === "sets") {
        displayCards();
      }
    }
  } catch (e) {
    console.warn("Could not fetch set names from Scryfall.", e);
  }
}

function getSetDisplayLabel(setCode) {
  if (!setCode || setCode === "UNKNOWN") return "Unknown Set";
  let name = setNameCache[setCode.toLowerCase()];
  return name ? name + " (" + setCode.toUpperCase() + ")" : setCode.toUpperCase();
}

function setCurrentViewFromHash() {
  const hash = window.location.hash.substring(1);
  if (hash === "boxes") {
    currentView = "boxes";
  } else if (hash === "sets") {
    currentView = "sets";
  } else {
    currentView = "decks";
  }
  updateNavActive();
  const titles = {
    boxes: "Collection Boxes - My MTG Collection",
    sets: "By Set - My MTG Collection",
    decks: "Decks - My MTG Collection"
  };
  document.title = titles[currentView];
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
  elements.repairPrintsButton = document.getElementById("repairPrintsButton");
  elements.exportCollectionButton = document.getElementById("exportCollectionButton");
  elements.importDeckReplaceButton = document.getElementById("importDeckReplaceButton");
  elements.importDeckMergeButton = document.getElementById("importDeckMergeButton");
  elements.importCollectionButton = document.getElementById("importCollectionButton");
  elements.decksLink = document.getElementById("decksLink");
  elements.boxesLink = document.getElementById("boxesLink");
  elements.setsLink = document.getElementById("setsLink");
  elements.headerText = document.getElementById("headerText");
  elements.themeToggle = document.getElementById("themeToggle");
  elements.sortSelect = document.getElementById("sortSelect");
  elements.signInButton = document.getElementById("signInButton");
  elements.signUpButton = document.getElementById("signUpButton");
  elements.signOutButton = document.getElementById("signOutButton");
  elements.forgotPasswordButton = document.getElementById("forgotPasswordButton");
  elements.updatePasswordButton = document.getElementById("updatePasswordButton");
  elements.authEmail = document.getElementById("authEmail");
  elements.authPassword = document.getElementById("authPassword");
  elements.newPasswordInput = document.getElementById("newPasswordInput");
  elements.authMessage = document.getElementById("authMessage");
  elements.resetMessage = document.getElementById("resetMessage");
  elements.resetPasswordPanel = document.getElementById("resetPasswordPanel");
  elements.userEmail = document.getElementById("userEmail");
}

function bindEvents() {
  elements.searchInput.addEventListener("input", displayCards);
  elements.commanderFilter.addEventListener("change", displayCards);
  elements.deckFilter.addEventListener("change", displayCards);
  elements.addCardButton.addEventListener("click", addCard);
  elements.repairPrintsButton.addEventListener("click", repairDeckPrints);
  elements.exportCollectionButton.addEventListener("click", exportCollection);
  elements.importDeckReplaceButton.addEventListener("click", () => importDeck("replace"));
  elements.importDeckMergeButton.addEventListener("click", () => importDeck("merge"));
  elements.importCollectionButton.addEventListener("click", importCollectionBackup);
  window.addEventListener("hashchange", handleHashChange);
  elements.themeToggle.addEventListener("click", toggleTheme);
  elements.sortSelect.addEventListener("change", displayCards);
  elements.signInButton.addEventListener("click", signIn);
  elements.signUpButton.addEventListener("click", signUp);
  elements.signOutButton.addEventListener("click", signOut);
  elements.forgotPasswordButton.addEventListener("click", forgotPassword);
  elements.updatePasswordButton.addEventListener("click", updatePassword);
  elements.authPassword.addEventListener("keydown", function(e) {
    if (e.key === "Enter") signIn();
  });
  elements.newPasswordInput.addEventListener("keydown", function(e) {
    if (e.key === "Enter") updatePassword();
  });
}

function handleHashChange() {
  setCurrentViewFromHash();
  populateDeckFilter();
  displayCards();
}

function updateNavActive() {
  elements.decksLink.classList.toggle("active", currentView === "decks");
  elements.boxesLink.classList.toggle("active", currentView === "boxes");
  elements.setsLink.classList.toggle("active", currentView === "sets");
}

async function loadCollection() {
  let { data, error } = await supabaseClient.from("cards").select("*");
  if (error) {
    console.error("Unable to load collection.", error);
    return [];
  }
  return (data || []).map(rowToCard);
}

function saveCollection() {
  // Replaced by targeted Supabase operations — kept as no-op for safety
}

function normalizeStoredCard(card) {
  return {
    ...card,
    id: card.id || crypto.randomUUID(),
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
  allOption.textContent = currentView === "boxes" ? "All boxes" : currentView === "sets" ? "All sources" : "All decks";
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
    if (currentView === "boxes") {
      elements.filterNote.textContent = "Showing all boxes and binders.";
    } else if (currentView === "sets") {
      elements.filterNote.textContent = "Showing cards by set.";
    } else {
      elements.filterNote.textContent = "Showing all decks.";
    }
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

  let collectionText = currentView === "boxes" ? "in your boxes" : currentView === "sets" ? "in your collection" : "in your decks";
  elements.headerText.innerHTML = `
  <span id="cardCount">${countLabel}</span> cards ${collectionText}
`;


  if (searchQuery) {
  elements.filterNote.textContent = `Showing results for "${searchQuery}". ${visibleCount} cards found.`;
}


  if (currentView === "sets") {
    let sets = {};
    filteredCards.forEach(function(entry) {
      let setCode = (entry.card.set || "unknown").toUpperCase();
      if (!sets[setCode]) sets[setCode] = [];
      sets[setCode].push(entry);
    });

    let setNames = Object.keys(sets).sort();

    if (setNames.length === 0) {
      let emptyState = document.createElement("p");
      emptyState.className = "empty-state";
      emptyState.textContent = searchQuery || selectedDeck ? "No cards match the current filters." : "No cards in your collection yet.";
      elements.cardGrid.appendChild(emptyState);
      return;
    }

    let sortMode = elements.sortSelect.value;

    setNames.forEach(function(setCode) {
      let setSection = document.createElement("section");
      setSection.className = "deck-section";

      let setHeader = document.createElement("h2");
      setHeader.className = "deck-heading";
      setHeader.textContent = getSetDisplayLabel(setCode) + " — " + sets[setCode].length + " cards";
      setSection.appendChild(setHeader);

      let setGrid = document.createElement("div");
      setGrid.className = "card-grid";
      setSection.appendChild(setGrid);

      sets[setCode].sort(function(a, b) {
        let cardA = a.card;
        let cardB = b.card;
        switch (sortMode) {
          case "type":
            return (cardA.type || "").localeCompare(cardB.type || "");
          case "color":
            return (cardA.colorIdentity.join("") || "").localeCompare(cardB.colorIdentity.join("") || "");
          case "set":
          case "collector":
            return (cardA.collectorNumber || "").localeCompare(cardB.collectorNumber || "", undefined, { numeric: true });
          case "name":
          default:
            return cardA.name.localeCompare(cardB.name);
        }
      });

      sets[setCode].forEach(function(entry) {
        let card = entry.card;
        let index = entry.index;
        let newCard = document.createElement("div");
        let deckInputId = getDeckInputId(index);
        let safeCardName = escapeHtml(card.name);
        let safeTypeLine = escapeHtml(card.type || "");
        let safeDeckName = escapeHtml(card.deck || "unsorted");
        let safeImage = escapeHtml(card.image || "");
        let deckDisplayLabel = getDeckDisplayLabel(normalizeDeckName(card.deck || "unsorted"));

        newCard.className = "card";
        newCard.innerHTML = [
          '<img src="' + safeImage + '" alt="' + safeCardName + ' card image" />',
          '<div class="card-name">' + safeCardName + (card.quantity && card.quantity > 1 ? ' <span class="card-qty">(' + card.quantity + 'x)</span>' : '') + '</div>',
          (card.foil ? '<div class="card-foil">✨ Foil</div>' : ''),
          '<div class="card-type">' + safeTypeLine + '</div>',
          getPrintLabel(card) ? '<div class="card-print">Print: ' + escapeHtml(getPrintLabel(card)) + '</div>' : "",
          '<div class="card-colors">Color identity: ' + getColorIdentityLabel(card.colorIdentity) + '</div>',
          '<div class="card-deck-label">Location: ' + escapeHtml(deckDisplayLabel) + '</div>',
          '<div class="card-controls">',
          '<input type="text" id="' + deckInputId + '" list="deckOptions" value="' + safeDeckName + '" aria-label="Deck name for ' + safeCardName + '" />',
          '<button type="button" data-action="move" data-index="' + index + '">Move to deck</button>',
          '<button type="button" data-action="remove" data-index="' + index + '">Remove</button>',
          "</div>"
        ].join("");
        setGrid.appendChild(newCard);
      });

      elements.cardGrid.appendChild(setSection);
    });

    bindCardActionButtons();
    return;
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
      let previousCard = collection[existingIndex];
      let updatedCard = { ...previousCard, quantity: (previousCard.quantity || 1) + quantity };
      collection[existingIndex] = updatedCard;
      populateDeckFilter();
      displayCards();
      showStatusMessage(quantity + "x " + card.name + " added (now " + updatedCard.quantity + " total).");
      try {
        await dbUpsertCards([updatedCard]);
      } catch (error) {
        collection[existingIndex] = previousCard;
        populateDeckFilter();
        displayCards();
        showStatusMessage("Could not add " + card.name + ". Please try again.");
      }
    } else {
      let newCard = createStoredCard(card, { deck: deckName, foil: foil, quantity: quantity });
      collection.push(newCard);
      populateDeckFilter();
      displayCards();
      showStatusMessage(quantity + "x " + card.name + " added to " + getDeckDisplayLabel(deckName) + ".");
      try {
        await dbUpsertCards([newCard]);
      } catch (error) {
        collection.splice(collection.indexOf(newCard), 1);
        populateDeckFilter();
        displayCards();
        showStatusMessage("Could not add " + card.name + ". Please try again.");
      }
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

async function removeCard(index) {
  let card = collection[index];
  collection.splice(index, 1);
  populateDeckFilter();
  displayCards();
  showStatusMessage(card.name + " removed.");
  try {
    await dbDeleteCards([card.id]);
  } catch (error) {
    console.error("Could not remove card.", error);
    collection.splice(index, 0, card);
    populateDeckFilter();
    displayCards();
    showStatusMessage("Could not remove " + card.name + ". Please try again.");
  }
}

async function updateCardDeck(index) {
  let input = document.getElementById(getDeckInputId(index));
  if (!input) return;

  let nextDeckName = normalizeDeckName(input.value);
  let previousCard = collection[index];
  let updatedCard = { ...previousCard, deck: nextDeckName };
  collection[index] = updatedCard;
  populateDeckFilter();
  displayCards();
  showStatusMessage(updatedCard.name + " moved from " + getDeckDisplayLabel(previousCard.deck || "unsorted") + " to " + getDeckDisplayLabel(nextDeckName) + ".");
  try {
    await dbUpsertCards([updatedCard]);
  } catch (error) {
    console.error("Could not move card.", error);
    collection[index] = previousCard;
    populateDeckFilter();
    displayCards();
    showStatusMessage("Could not move " + updatedCard.name + ". Please try again.");
  }
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

      let updatedCards = [];
      collection = collection.map(function(card) {
        if (colorMap[card.name]) {
          let updated = { ...card, colorIdentity: colorMap[card.name] };
          updatedCards.push(updated);
          return updated;
        }
        return card;
      });
      if (updatedCards.length > 0) {
        await dbUpsertCards(updatedCards);
      }
    } catch (error) {
      console.error("Unable to refresh color identities.", error);
      return;
    }
  }

  populateDeckFilter();
  displayCards();
}

async function importDeck(mode) {
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

    if (mode === "replace") {
      let idsToDelete = collection
        .filter(c => normalizeDeckName(c.deck || "unsorted") === deckName)
        .map(c => c.id);
      await dbDeleteCards(idsToDelete);
      collection = collection.filter(c => normalizeDeckName(c.deck || "unsorted") !== deckName);
    }

    let toUpsert = [];
    allCards.forEach(function(entry) {
      let newCard = createStoredCard(entry.card, {
        deck: deckName,
        foil: entry.identifier ? entry.identifier.foil : false,
        set: entry.identifier ? entry.identifier.set : "",
        collectorNumber: entry.identifier ? entry.identifier.collector_number : "",
        quantity: entry.identifier ? entry.identifier.quantity : 1
      });

      if (mode === "merge") {
        let existingIndex = collection.findIndex(c =>
          normalizeDeckName(c.deck || "unsorted") === deckName &&
          c.name === newCard.name &&
          c.foil === newCard.foil
        );
        if (existingIndex !== -1) {
          let updatedCard = { ...newCard, id: collection[existingIndex].id };
          collection[existingIndex] = updatedCard;
          toUpsert.push(updatedCard);
        } else {
          collection.push(newCard);
          toUpsert.push(newCard);
        }
      } else {
        collection.push(newCard);
        toUpsert.push(newCard);
      }
    });

    await dbUpsertCards(toUpsert);

    elements.progressText.textContent = notFound.length > 0
      ? "Import complete! " + allCards.length + " cards added. " + notFound.length + " not found."
      : "Import complete! All " + allCards.length + " cards added to " + deckName + ".";
    elements.progressBar.style.width = "100%";

    if (notFound.length > 0) {
      console.log("Cards not found:", notFound);
    }

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
    let toUpsert = [];

    allCards.forEach(function(entry) {
      if (!entry.identifier) {
        return;
      }

      let collectionMatchIndex = findCollectionMatchIndex(deckCards, entry.identifier);
      if (collectionMatchIndex < 0) {
        return;
      }

      let match = deckCards[collectionMatchIndex];
      let updatedCard = applyCardPrinting(match.card, entry.card, {
        deck: deckName,
        foil: entry.identifier.foil,
        set: entry.identifier.set,
        collectorNumber: entry.identifier.collector_number
      });
      collection[match.index] = updatedCard;
      toUpsert.push(updatedCard);
      updatedCount += 1;
    });

    unmatchedDeckCards = deckCards.filter(function(entry) {
      return !entry.matched;
    }).length;

    await dbUpsertCards(toUpsert);
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

    let normalizedCards = importedCards.map(normalizeStoredCard);
    let { error: deleteError } = await supabaseClient.from("cards").delete().eq("user_id", currentUserId);
    if (deleteError) throw deleteError;
    await dbUpsertCards(normalizedCards);
    collection = normalizedCards;
    populateDeckFilter();
    displayCards();
    elements.collectionImportInput.value = "";
    showStatusMessage("Collection backup imported successfully.");
  } catch (error) {
    console.error("Unable to import collection backup.", error);
    alert("That JSON backup could not be imported.");
  }
}

// ========================= //
// SUPABASE DB HELPERS       //
// ========================= //

function cardToRow(card) {
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
    user_id: currentUserId
  };
}

function rowToCard(row) {
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
    image: row.image
  });
}

async function dbUpsertCards(cards) {
  if (!cards.length) return;
  let { error } = await supabaseClient
    .from("cards")
    .upsert(cards.map(cardToRow), { onConflict: "id" });
  if (error) throw error;
}

async function dbDeleteCards(ids) {
  if (!ids.length) return;
  let { error } = await supabaseClient
    .from("cards")
    .delete()
    .in("id", ids);
  if (error) throw error;
}

function handleRealtimeEvent(payload) {
  let { eventType } = payload;

  if (eventType === "INSERT") {
    let alreadyPresent = collection.some(function(c) { return c.id === payload.new.id; });
    if (!alreadyPresent) {
      collection.push(rowToCard(payload.new));
      populateDeckFilter();
      displayCards();
    }
  } else if (eventType === "UPDATE") {
    let index = collection.findIndex(function(c) { return c.id === payload.new.id; });
    if (index !== -1) {
      let updated = rowToCard(payload.new);
      if (JSON.stringify(collection[index]) !== JSON.stringify(updated)) {
        collection[index] = updated;
        populateDeckFilter();
        displayCards();
      }
    }
  } else if (eventType === "DELETE") {
    let index = collection.findIndex(function(c) { return c.id === payload.old.id; });
    if (index !== -1) {
      collection.splice(index, 1);
      populateDeckFilter();
      displayCards();
    }
  }
}

function subscribeToCollection() {
  if (realtimeChannel) {
    supabaseClient.removeChannel(realtimeChannel);
  }
  realtimeChannel = supabaseClient
    .channel("cards-" + currentUserId)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "cards", filter: "user_id=eq." + currentUserId },
      handleRealtimeEvent
    )
    .subscribe();
}

function unsubscribeFromCollection() {
  if (realtimeChannel) {
    supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

// ========================= //
// AUTH                      //
// ========================= //

function showAuthPanel() {
  document.getElementById("authPanel").classList.remove("hidden");
  document.getElementById("appShell").classList.add("hidden");
  elements.resetPasswordPanel.classList.add("hidden");
}

function hideAuthPanel() {
  document.getElementById("authPanel").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");
}

function showResetPasswordPanel() {
  document.getElementById("authPanel").classList.add("hidden");
  document.getElementById("appShell").classList.add("hidden");
  elements.resetPasswordPanel.classList.remove("hidden");
  elements.newPasswordInput.focus();
}

async function initApp(email) {
  hideAuthPanel();
  elements.userEmail.textContent = email || "";

  collection = await loadCollection();

  // Auto-migrate localStorage data on first sign-in if Supabase is empty
  if (collection.length === 0) {
    try {
      let localRaw = localStorage.getItem(STORAGE_KEY);
      if (localRaw) {
        let localCards = JSON.parse(localRaw).map(normalizeStoredCard);
        if (localCards.length > 0) {
          await dbUpsertCards(localCards);
          collection = localCards;
          localStorage.removeItem(STORAGE_KEY);
          showStatusMessage("Migrated " + localCards.length + " cards from local storage to Supabase.");
        }
      }
    } catch (e) {
      console.warn("Could not auto-migrate localStorage data.", e);
    }
  }

  subscribeToCollection();
  setCurrentViewFromHash();
  populateCommanderFilter();
  populateDeckFilter();
  displayCards();
  refreshMissingColorIdentities();
  loadSetNames();
}

async function signIn() {
  let email = elements.authEmail.value.trim();
  let password = elements.authPassword.value;
  elements.authMessage.classList.add("hidden");

  let { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    elements.authMessage.textContent = error.message;
    elements.authMessage.classList.remove("hidden");
    elements.authMessage.style.color = "";
    return;
  }
  currentUserId = data.user.id;
  await initApp(data.user.email);
}

async function signUp() {
  let email = elements.authEmail.value.trim();
  let password = elements.authPassword.value;
  elements.authMessage.classList.add("hidden");

  let { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    elements.authMessage.textContent = error.message;
    elements.authMessage.classList.remove("hidden");
    elements.authMessage.style.color = "";
    return;
  }
  if (data.user && !data.session) {
    elements.authMessage.textContent = "Check your email to confirm your account.";
    elements.authMessage.style.color = "green";
    elements.authMessage.classList.remove("hidden");
    return;
  }
  currentUserId = data.user.id;
  await initApp(data.user.email);
}

async function signOut() {
  await supabaseClient.auth.signOut();
}

async function forgotPassword() {
  let email = elements.authEmail.value.trim();
  if (!email) {
    elements.authMessage.textContent = "Enter your email address above first.";
    elements.authMessage.style.color = "";
    elements.authMessage.classList.remove("hidden");
    return;
  }
  let { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });
  if (error) {
    elements.authMessage.textContent = error.message;
    elements.authMessage.style.color = "";
    elements.authMessage.classList.remove("hidden");
    return;
  }
  elements.authMessage.textContent = "Password reset email sent — check your inbox.";
  elements.authMessage.style.color = "green";
  elements.authMessage.classList.remove("hidden");
}

async function updatePassword() {
  let newPassword = elements.newPasswordInput.value;
  if (!newPassword) {
    elements.resetMessage.textContent = "Please enter a new password.";
    elements.resetMessage.style.color = "";
    elements.resetMessage.classList.remove("hidden");
    return;
  }
  let { error } = await supabaseClient.auth.updateUser({ password: newPassword });
  if (error) {
    elements.resetMessage.textContent = error.message;
    elements.resetMessage.style.color = "";
    elements.resetMessage.classList.remove("hidden");
    return;
  }
  isPasswordRecovery = false;
  elements.newPasswordInput.value = "";
  elements.resetPasswordPanel.classList.add("hidden");
  let { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    currentUserId = session.user.id;
    await initApp(session.user.email);
  }
  showStatusMessage("Password updated successfully.");
}
