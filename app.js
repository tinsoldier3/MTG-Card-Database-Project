const STORAGE_KEY = "mtgCollection";
const BUILDER_DECK_KEY = "mtgBuilderDeck";
const BUILDER_API_KEY_KEY = "mtgBuilderApiKey";
const COLLECTION_BATCH_SIZE = 1000;
const COLLECTION_LOAD_TIMEOUT_MS = 20000;
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
  "bumi unleased": "Bumi Unleashed",
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
let currentDeckDetail = "";
let pendingChatMessageEl = null;
let setNameCache = {};
let realtimeChannel = null;
let isPasswordRecovery = false;
const deckScryfallCache = {};

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
  if (hash === "builder") {
    currentView = "builder";
  } else if (hash === "boxes") {
    currentView = "boxes";
  } else if (hash === "sets") {
    currentView = "sets";
  } else if (hash.startsWith("deck/")) {
    currentView = "deck-detail";
    currentDeckDetail = normalizeDeckName(decodeURIComponent(hash.substring(5)));
  } else {
    currentView = "decks";
  }
  updateNavActive();
  const titles = {
    builder: "Deck Builder - My MTG Collection",
    boxes: "Collection Boxes - My MTG Collection",
    sets: "By Set - My MTG Collection",
    "deck-detail": getDeckDisplayLabel(currentDeckDetail) + " - My MTG Collection",
    decks: "Decks - My MTG Collection"
  };
  document.title = titles[currentView] || "My MTG Collection";
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
  elements.builderLink = document.getElementById("builderLink");
  elements.boxesLink = document.getElementById("boxesLink");
  elements.setsLink = document.getElementById("setsLink");
  elements.headerText = document.getElementById("headerText");
  elements.themeToggle = document.getElementById("themeToggle");
  elements.sortSelect = document.getElementById("sortSelect");
  elements.builderPanel = document.getElementById("builderPanel");
  elements.builderDeckSelect = document.getElementById("builderDeckSelect");
  elements.builderSourceFilter = document.getElementById("builderSourceFilter");
  elements.builderTypeFilter = document.getElementById("builderTypeFilter");
  elements.builderLegalOnlyToggle = document.getElementById("builderLegalOnlyToggle");
  elements.builderSummary = document.getElementById("builderSummary");
  elements.chatMessages = document.getElementById("chatMessages");
  elements.chatInput = document.getElementById("chatInput");
  elements.chatSendButton = document.getElementById("chatSendButton");
  elements.chatApiKeyInput = document.getElementById("chatApiKeyInput");
  elements.chatApiKeySave = document.getElementById("chatApiKeySave");
  elements.chatApiKeyClear = document.getElementById("chatApiKeyClear");
  elements.chatApiKeyMode = document.getElementById("chatApiKeyMode");
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
  elements.builderDeckSelect.addEventListener("change", function() {
    localStorage.setItem(BUILDER_DECK_KEY, elements.builderDeckSelect.value);
    clearDeckChat();
    displayCards();
  });
  elements.builderSourceFilter.addEventListener("change", displayCards);
  elements.builderTypeFilter.addEventListener("change", displayCards);
  elements.builderLegalOnlyToggle.addEventListener("change", displayCards);
  elements.chatSendButton.addEventListener("click", handleChatSend);
  elements.chatInput.addEventListener("keydown", function(e) {
    if (e.key === "Enter") handleChatSend();
  });
  elements.chatApiKeySave.addEventListener("click", saveChatApiKey);
  elements.chatApiKeyClear.addEventListener("click", clearChatApiKey);
  initChatApiKey();
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
  populateBuilderDeckSelect();
  displayCards();
}

function updateNavActive() {
  elements.decksLink.classList.toggle("active", currentView === "decks" || currentView === "deck-detail");
  elements.builderLink.classList.toggle("active", currentView === "builder");
  elements.boxesLink.classList.toggle("active", currentView === "boxes");
  elements.setsLink.classList.toggle("active", currentView === "sets");
}

async function loadCollection() {
  let selectQuery = supabaseClient.from("cards").select("*");

  // The real Supabase client returns a query builder; test mocks may return a Promise directly.
  if (!selectQuery || typeof selectQuery.eq !== "function") {
    let { data, error } = await withTimeout(selectQuery, COLLECTION_LOAD_TIMEOUT_MS, "Timed out loading collection.");
    if (error) {
      console.error("Unable to load collection.", error);
      throw error;
    }
    return safelyMapRowsToCards(data || []);
  }

  try {
    return await loadCollectionInBatches();
  } catch (error) {
    console.warn("Falling back to simple collection query.", error);
    return await loadCollectionWithSimpleQuery(error);
  }
}

async function loadCollectionInBatches() {
  let rows = [];
  let fromIndex = 0;

  while (true) {
    let query = supabaseClient
      .from("cards")
      .select("*")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: true })
      .range(fromIndex, fromIndex + COLLECTION_BATCH_SIZE - 1);

    let { data, error } = await withTimeout(query, COLLECTION_LOAD_TIMEOUT_MS, "Timed out loading collection.");
    if (error) {
      console.error("Unable to load collection.", error);
      throw error;
    }

    let batch = data || [];
    rows = rows.concat(batch);

    if (batch.length < COLLECTION_BATCH_SIZE) {
      break;
    }

    fromIndex += COLLECTION_BATCH_SIZE;
  }

  return safelyMapRowsToCards(rows);
}

async function loadCollectionWithSimpleQuery(originalError) {
  let simpleQuery = supabaseClient.from("cards").select("*");
  let { data, error } = await withTimeout(simpleQuery, COLLECTION_LOAD_TIMEOUT_MS, "Timed out loading collection.");

  if (error) {
    console.error("Unable to load collection with fallback query.", error);
    throw error;
  }

  if (originalError) {
    showStatusMessage("Loaded your cards with a compatibility fallback.");
  }

  return safelyMapRowsToCards(data || []);
}

function withTimeout(promise, timeoutMs, message) {
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

function getCollectionLoadErrorMessage(error) {
  let message = error && typeof error.message === "string" ? error.message.toLowerCase() : "";

  if (message.includes("jwt") || message.includes("token") || message.includes("auth")) {
    return "Your session expired while loading cards. Sign out and back in if a refresh doesn't fix it.";
  }

  if (message.includes("network") || message.includes("fetch") || message.includes("timeout")) {
    return "We couldn't reach Supabase to load your cards. Check your connection and try again.";
  }

  return "We couldn't load your cards from Supabase right now. Try refreshing the page in a moment.";
}

function saveCollection() {
  // Replaced by targeted Supabase operations — kept as no-op for safety
}

function normalizeStoredCard(card) {
  let safeCard = card || {};
  return {
    ...safeCard,
    id: safeCard.id || createCardId(),
    name: typeof safeCard.name === "string" ? safeCard.name : "",
    type: typeof safeCard.type === "string" ? safeCard.type : "",
    image: typeof safeCard.image === "string" ? safeCard.image : "",
    deck: normalizeDeckName(safeCard.deck || "unsorted"),
    foil: Boolean(safeCard.foil),
    quantity: Number.isFinite(Number(safeCard.quantity)) && Number(safeCard.quantity) > 0 ? Number(safeCard.quantity) : 1,
    colorIdentity: Array.isArray(safeCard.colorIdentity) ? safeCard.colorIdentity.filter(function(color) {
      return typeof color === "string" && color.length > 0;
    }) : [],
    set: typeof safeCard.set === "string" ? safeCard.set.toLowerCase() : "",
    collectorNumber: typeof safeCard.collectorNumber === "string" ? safeCard.collectorNumber : "",
    scryfallId: typeof safeCard.scryfallId === "string" ? safeCard.scryfallId : "",
    condition: typeof safeCard.condition === "string" ? safeCard.condition : "",
    acquiredDate: typeof safeCard.acquiredDate === "string" ? safeCard.acquiredDate : "",
    purchasePrice: safeCard.purchasePrice != null && Number.isFinite(Number(safeCard.purchasePrice)) ? Number(safeCard.purchasePrice) : null,
    notes: typeof safeCard.notes === "string" ? safeCard.notes : ""
  };
}

function createCardId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return "card-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function safelyMapRowsToCards(rows) {
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
    showStatusMessage("Skipped " + skippedRows.length + " invalid saved card" + (skippedRows.length === 1 ? "" : "s") + " while loading.");
  }

  return mappedCards;
}

function getRowDebugId(row) {
  if (!row || typeof row !== "object") {
    return "unknown-row";
  }
  return row.id || row.name || "unknown-row";
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

function populateBuilderDeckSelect() {
  let selectedValue = elements.builderDeckSelect.value || localStorage.getItem(BUILDER_DECK_KEY) || "";
  let deckNames = getBuilderDeckNames();

  elements.builderDeckSelect.innerHTML = "";

  if (deckNames.length === 0) {
    let emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "No decks yet";
    elements.builderDeckSelect.appendChild(emptyOption);
    elements.builderDeckSelect.value = "";
    return;
  }

  deckNames.forEach(function(deckName) {
    let option = document.createElement("option");
    option.value = deckName;
    option.textContent = getDeckDisplayLabel(deckName);
    elements.builderDeckSelect.appendChild(option);
  });

  let nextValue = deckNames.includes(selectedValue) ? selectedValue : deckNames[0];
  elements.builderDeckSelect.value = nextValue;
  localStorage.setItem(BUILDER_DECK_KEY, nextValue);
}

function getBuilderDeckNames() {
  let deckNames = Array.from(new Set(collection
    .map(function(card) {
      return normalizeDeckName(card.deck || "unsorted");
    })
    .filter(function(deckName) {
      return deckName !== "unsorted" && !isBoxOrBinder(deckName);
    })));

  Object.keys(COMMANDER_DECKS).forEach(function(deckName) {
    if (!deckNames.includes(deckName)) {
      deckNames.push(deckName);
    }
  });

  return deckNames.sort(function(a, b) {
    return getDeckDisplayLabel(a).localeCompare(getDeckDisplayLabel(b));
  });
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
  updateViewVisibility();

  if (currentView === "builder") {
    displayDeckBuilder();
    return;
  }

  if (currentView === "deck-detail") {
    displayDeckDetail();
    return;
  }

  if (currentView === "decks") {
    displayDecksOverview();
    return;
  }

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
  }).reduce(function(sum, card) { return sum + (card.quantity || 1); }, 0);

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
    visibleCount += (card.quantity || 1);
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
      setHeader.textContent = getSetDisplayLabel(setCode) + " — " + sets[setCode].reduce(function(sum, e) { return sum + (e.card.quantity || 1); }, 0) + " cards";
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
          '<div class="card-name">' + safeCardName + ' <span class="card-qty" data-qty-badge="' + index + '"' + (card.quantity && card.quantity > 1 ? '' : ' style="display:none"') + '>(' + (card.quantity || 1) + 'x)</span></div>',
          (card.foil ? '<div class="card-foil">✨ Foil</div>' : ''),
          '<div class="card-type">' + safeTypeLine + '</div>',
          getPrintLabel(card) ? '<div class="card-print">Print: ' + escapeHtml(getPrintLabel(card)) + '</div>' : "",
          '<div class="card-colors">Color identity: ' + getColorIdentityLabel(card.colorIdentity) + '</div>',
          '<div class="card-deck-label">Location: ' + escapeHtml(deckDisplayLabel) + '</div>',
          '<div class="card-controls">',
          '<div class="qty-stepper">',
          '<button type="button" data-action="qty-down" data-index="' + index + '" aria-label="Decrease quantity of ' + safeCardName + '">−</button>',
          '<span class="qty-value" data-qty-index="' + index + '">' + (card.quantity || 1) + '</span>',
          '<button type="button" data-action="qty-up" data-index="' + index + '" aria-label="Increase quantity of ' + safeCardName + '">+</button>',
          '</div>',
          '<input type="text" id="' + deckInputId + '" list="deckOptions" value="' + safeDeckName + '" aria-label="Deck name for ' + safeCardName + '" />',
          '<button type="button" data-action="move" data-index="' + index + '">Move to deck</button>',
          '<input type="number" class="qty-input" min="1" value="' + (card.quantity || 1) + '" aria-label="Quantity for ' + safeCardName + '" data-qty-index="' + index + '" />',
          '<button type="button" data-action="set-qty" data-index="' + index + '">Set qty</button>',
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

    let deckCardCount = decks[deckName].reduce(function(sum, e) { return sum + (e.card.quantity || 1); }, 0);
    let deckHeader = document.createElement("h2");
    deckHeader.className = "deck-heading";
    let deckHeadingLink = document.createElement("a");
    deckHeadingLink.href = "#deck/" + encodeURIComponent(deckName);
    deckHeadingLink.className = "deck-heading-link";
    deckHeadingLink.textContent = getDeckDisplayLabel(deckName);
    deckHeader.appendChild(deckHeadingLink);
    deckHeader.appendChild(document.createTextNode(" (" + deckCardCount + " cards)"));
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
        '<div class="card-name">' + safeCardName + ' <span class="card-qty" data-qty-badge="' + index + '"' + (card.quantity && card.quantity > 1 ? '' : ' style="display:none"') + '>(' + (card.quantity || 1) + 'x)</span></div>',
        (card.foil ? '<div class="card-foil">✨ Foil</div>' : ''),
        '<div class="card-type">' + safeTypeLine + '</div>',
        getPrintLabel(card) ? '<div class="card-print">Print: ' + escapeHtml(getPrintLabel(card)) + '</div>' : "",
        '<div class="card-colors">Color identity: ' + getColorIdentityLabel(card.colorIdentity) + '</div>',
        legality.checked && !legality.legal ? '<div class="status-badge illegal">Illegal for this deck</div>' : "",
        '<div class="card-controls">',
        '<div class="qty-stepper">',
        '<button type="button" data-action="qty-down" data-index="' + index + '" aria-label="Decrease quantity of ' + safeCardName + '">−</button>',
        '<span class="qty-value" data-qty-index="' + index + '">' + (card.quantity || 1) + '</span>',
        '<button type="button" data-action="qty-up" data-index="' + index + '" aria-label="Increase quantity of ' + safeCardName + '">+</button>',
        '</div>',
        '<input type="text" id="' + deckInputId + '" list="deckOptions" value="' + safeDeckName + '" aria-label="Deck name for ' + safeCardName + '" />',
        '<button type="button" data-action="move" data-index="' + index + '">Move to deck</button>',
        '<input type="number" class="qty-input" min="1" value="' + (card.quantity || 1) + '" aria-label="Quantity for ' + safeCardName + '" data-qty-index="' + index + '" />',
        '<button type="button" data-action="set-qty" data-index="' + index + '">Set qty</button>',
        '<button type="button" data-action="remove" data-index="' + index + '">Remove</button>',
        "</div>"
      ].join("");
      deckGrid.appendChild(newCard);
    });

    elements.cardGrid.appendChild(deckSection);
  });

  bindCardActionButtons();
}

function updateViewVisibility() {
  elements.builderPanel.classList.toggle("hidden", currentView !== "builder");
  let hideControls = currentView === "decks" || currentView === "deck-detail";
  elements.sortSelect.classList.toggle("hidden", hideControls);
  elements.commanderFilter.closest(".field-group") && elements.commanderFilter.closest(".field-group").classList.toggle("hidden", hideControls);
  elements.deckFilter.closest(".field-group") && elements.deckFilter.closest(".field-group").classList.toggle("hidden", hideControls);
}

const DECK_TYPE_CATEGORIES = ["Commander", "Creatures", "Planeswalkers", "Instants", "Sorceries", "Artifacts", "Enchantments", "Lands", "Other"];

function getDeckTypeCategory(card, deckName) {
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

function displayDecksOverview() {
  elements.cardGrid.innerHTML = "";

  let searchQuery = elements.searchInput.value.toLowerCase().trim();

  let deckNames = Array.from(new Set(
    collection
      .filter(function(card) { return !isBoxOrBinder(normalizeDeckName(card.deck || "unsorted")); })
      .map(function(card) { return normalizeDeckName(card.deck || "unsorted"); })
  ));

  Object.keys(COMMANDER_DECKS).forEach(function(deckName) {
    if (!deckNames.includes(deckName)) deckNames.push(deckName);
  });

  deckNames.sort(function(a, b) {
    return getDeckDisplayLabel(a).localeCompare(getDeckDisplayLabel(b));
  });

  if (searchQuery) {
    deckNames = deckNames.filter(function(deckName) {
      return getDeckDisplayLabel(deckName).toLowerCase().includes(searchQuery) || deckName.includes(searchQuery);
    });
  }

  let totalInDecks = collection.filter(function(card) {
    return !isBoxOrBinder(normalizeDeckName(card.deck || "unsorted"));
  }).reduce(function(sum, card) { return sum + (card.quantity || 1); }, 0);

  elements.headerText.innerHTML = '<span id="cardCount">' + totalInDecks + '</span> cards in your decks';
  elements.filterNote.textContent = searchQuery
    ? 'Showing decks matching "' + searchQuery + '".'
    : "Showing all decks.";

  if (deckNames.length === 0) {
    let empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = searchQuery ? "No decks match your search." : "No decks in your collection yet.";
    elements.cardGrid.appendChild(empty);
    return;
  }

  let grid = document.createElement("div");
  grid.className = "decks-overview-grid";

  deckNames.forEach(function(deckName) {
    let commanderDeck = COMMANDER_DECKS[deckName];
    let deckCards = collection.filter(function(card) {
      return normalizeDeckName(card.deck || "unsorted") === deckName;
    });
    let cardCount = deckCards.reduce(function(sum, card) { return sum + (card.quantity || 1); }, 0);
    let illegalCount = deckCards.filter(function(card) {
      let legality = getDeckLegality(card);
      return legality.checked && !legality.legal;
    }).length;

    let tile = document.createElement("a");
    tile.href = "#deck/" + encodeURIComponent(deckName);
    tile.className = "deck-tile";

    let tileName = document.createElement("div");
    tileName.className = "deck-tile-name";
    tileName.textContent = getDeckDisplayLabel(deckName);
    tile.appendChild(tileName);

    if (commanderDeck) {
      let tileCommander = document.createElement("div");
      tileCommander.className = "deck-tile-commander";
      tileCommander.textContent = commanderDeck.commander.join(" & ");
      tile.appendChild(tileCommander);

      let tileColors = document.createElement("div");
      tileColors.className = "deck-tile-colors";
      commanderDeck.colors.forEach(function(c) {
        let pip = document.createElement("span");
        pip.className = "color-pip color-pip-" + c.toLowerCase();
        pip.title = c;
        tileColors.appendChild(pip);
      });
      tile.appendChild(tileColors);
    }

    let tileStats = document.createElement("div");
    tileStats.className = "deck-tile-stats";
    tileStats.textContent = cardCount > 0 ? cardCount + " cards" : "No cards yet";
    if (illegalCount > 0) {
      tileStats.textContent += " • " + illegalCount + " illegal";
    }
    tile.appendChild(tileStats);

    grid.appendChild(tile);
  });

  elements.cardGrid.appendChild(grid);
}

function displayDeckDetail() {
  elements.cardGrid.innerHTML = "";

  let deckEntries = [];
  collection.forEach(function(card, index) {
    if (normalizeDeckName(card.deck || "unsorted") === currentDeckDetail) {
      deckEntries.push({ card: card, index: index });
    }
  });

  let displayLabel = getDeckDisplayLabel(currentDeckDetail);
  let commanderDeck = COMMANDER_DECKS[currentDeckDetail];
  let totalCards = deckEntries.reduce(function(sum, e) { return sum + (e.card.quantity || 1); }, 0);
  let illegalCount = deckEntries.filter(function(e) {
    let legality = getDeckLegality(e.card);
    return legality.checked && !legality.legal;
  }).length;

  elements.headerText.innerHTML = '<span id="cardCount">' + totalCards + '</span> cards in ' + escapeHtml(displayLabel);
  elements.filterNote.textContent = "Viewing " + displayLabel + ".";

  let backLink = document.createElement("a");
  backLink.href = "#decks";
  backLink.className = "deck-detail-back";
  backLink.textContent = "← All Decks";
  elements.cardGrid.appendChild(backLink);

  let layout = document.createElement("div");
  layout.className = "deck-detail-layout";

  // --- SIDEBAR ---
  let sidebar = document.createElement("aside");
  sidebar.className = "deck-detail-sidebar";

  if (commanderDeck) {
    let commanderEntry = deckEntries.find(function(e) {
      return commanderDeck.commander.some(function(name) { return name === e.card.name; });
    });
    if (commanderEntry && commanderEntry.card.image) {
      let artWrap = document.createElement("div");
      artWrap.className = "deck-detail-commander-art";
      let img = document.createElement("img");
      img.src = commanderEntry.card.image;
      img.alt = commanderEntry.card.name;
      artWrap.appendChild(img);
      sidebar.appendChild(artWrap);
    }
  }

  let sidebarInfo = document.createElement("div");
  sidebarInfo.className = "deck-detail-sidebar-info";

  let titleEl = document.createElement("h2");
  titleEl.className = "deck-detail-title";
  titleEl.textContent = displayLabel;
  sidebarInfo.appendChild(titleEl);

  if (commanderDeck) {
    let metaEl = document.createElement("div");
    metaEl.className = "deck-detail-meta";
    let colorPips = commanderDeck.colors.map(function(c) {
      return '<span class="color-pip color-pip-' + c.toLowerCase() + '" title="' + c + '"></span>';
    }).join("");
    metaEl.innerHTML = '<span class="deck-detail-commander">' + escapeHtml(commanderDeck.commander.join(" & ")) + '</span>'
      + '<span class="deck-detail-colors">' + colorPips + '</span>';
    sidebarInfo.appendChild(metaEl);
  }

  let statsEl = document.createElement("div");
  statsEl.className = "deck-detail-stats";
  statsEl.textContent = totalCards + " cards";
  if (illegalCount > 0) statsEl.textContent += " • " + illegalCount + " outside color identity";
  let priceSpan = document.createElement("span");
  priceSpan.className = "deck-detail-price";
  priceSpan.textContent = " • loading price…";
  statsEl.appendChild(priceSpan);
  sidebarInfo.appendChild(statsEl);
  sidebar.appendChild(sidebarInfo);

  let colorDistEl = buildColorDistributionEl(deckEntries);
  if (colorDistEl) sidebar.appendChild(colorDistEl);

  // Breakdown bars
  let groups = {};
  DECK_TYPE_CATEGORIES.forEach(function(cat) { groups[cat] = []; });
  deckEntries.forEach(function(entry) {
    let cat = getDeckTypeCategory(entry.card, currentDeckDetail);
    groups[cat].push(entry);
  });

  let nonEmpty = DECK_TYPE_CATEGORIES.filter(function(cat) { return groups[cat].length > 0; });
  if (nonEmpty.length > 0) {
    let breakdownEl = document.createElement("div");
    breakdownEl.className = "deck-detail-breakdown";
    let breakdownHeading = document.createElement("h4");
    breakdownHeading.className = "deck-detail-breakdown-heading";
    breakdownHeading.textContent = "Breakdown";
    breakdownEl.appendChild(breakdownHeading);

    let barsEl = document.createElement("div");
    barsEl.className = "breakdown-bars";
    nonEmpty.forEach(function(cat) {
      let catCount = groups[cat].reduce(function(sum, e) { return sum + (e.card.quantity || 1); }, 0);
      let pct = totalCards > 0 ? Math.max(2, Math.round((catCount / totalCards) * 100)) : 0;

      let barRow = document.createElement("a");
      barRow.href = "#detail-section-" + cat.toLowerCase();
      barRow.className = "breakdown-bar-row";

      let barLabel = document.createElement("div");
      barLabel.className = "breakdown-bar-label";
      barLabel.innerHTML = '<span class="breakdown-cat-name">' + escapeHtml(cat) + '</span>'
        + '<span class="breakdown-cat-count">' + catCount + '</span>';
      barRow.appendChild(barLabel);

      let barTrack = document.createElement("div");
      barTrack.className = "breakdown-bar-track";
      let barFill = document.createElement("div");
      barFill.className = "breakdown-bar-fill";
      barFill.style.width = pct + "%";
      barTrack.appendChild(barFill);
      barRow.appendChild(barTrack);
      barsEl.appendChild(barRow);
    });

    breakdownEl.appendChild(barsEl);
    sidebar.appendChild(breakdownEl);
  }

  let actionsEl = document.createElement("div");
  actionsEl.className = "deck-detail-sidebar-actions";
  let builderBtn = document.createElement("a");
  builderBtn.href = "#builder";
  builderBtn.className = "btn-deck-action";
  builderBtn.textContent = "Open in Deck Builder";
  builderBtn.addEventListener("click", function() {
    localStorage.setItem(BUILDER_DECK_KEY, currentDeckDetail);
  });
  actionsEl.appendChild(builderBtn);

  let decklistBtn = document.createElement("button");
  decklistBtn.type = "button";
  decklistBtn.className = "btn-deck-action btn-deck-action-secondary";
  decklistBtn.textContent = "Copy Decklist";
  decklistBtn.addEventListener("click", function() {
    let text = generateDecklist(groups);
    navigator.clipboard.writeText(text).then(function() {
      decklistBtn.textContent = "Copied!";
      setTimeout(function() { decklistBtn.textContent = "Copy Decklist"; }, 2000);
    }).catch(function() {
      alert("Deck list:\n\n" + text);
    });
  });
  actionsEl.appendChild(decklistBtn);
  sidebar.appendChild(actionsEl);

  layout.appendChild(sidebar);

  // --- MAIN CARD LIST ---
  let main = document.createElement("div");
  main.className = "deck-detail-main";

  let manaCurveEl = document.createElement("div");
  manaCurveEl.className = "deck-detail-mana-curve-section";
  if (deckEntries.length > 0) {
    manaCurveEl.innerHTML = '<h4 class="deck-detail-breakdown-heading">Mana Curve</h4><p class="deck-detail-loading-text">Loading…</p>';
    main.appendChild(manaCurveEl);
  }

  if (deckEntries.length === 0) {
    let empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No cards in this deck yet.";
    main.appendChild(empty);
  } else {
    DECK_TYPE_CATEGORIES.forEach(function(cat) {
      let entries = groups[cat];
      if (entries.length === 0) return;

      entries.sort(function(a, b) { return a.card.name.localeCompare(b.card.name); });
      let catCount = entries.reduce(function(sum, e) { return sum + (e.card.quantity || 1); }, 0);

      let section = document.createElement("section");
      section.className = "deck-detail-section";
      section.id = "detail-section-" + cat.toLowerCase();

      let heading = document.createElement("h3");
      heading.className = "deck-detail-section-heading";
      heading.textContent = cat + " (" + catCount + ")";
      section.appendChild(heading);

      let cardList = document.createElement("div");
      cardList.className = "deck-card-list";

      entries.forEach(function(entry) {
        let card = entry.card;
        let index = entry.index;
        let legality = getDeckLegality(card);

        let row = document.createElement("div");
        row.className = "deck-card-row" + (legality.checked && !legality.legal ? " deck-card-row-illegal" : "");
        row.dataset.cardIndex = String(index);

        let nameWrap = document.createElement("div");
        nameWrap.className = "deck-card-name-wrap";

        let nameEl = document.createElement("span");
        nameEl.className = "deck-card-name";
        nameEl.textContent = card.name;
        if (card.image) nameEl.dataset.cardImage = card.image;
        nameWrap.appendChild(nameEl);

        let typeEl = document.createElement("span");
        typeEl.className = "deck-card-type";
        typeEl.textContent = card.type || "";
        nameWrap.appendChild(typeEl);

        if (card.foil) {
          let foilEl = document.createElement("span");
          foilEl.className = "deck-card-foil";
          foilEl.title = "Foil";
          foilEl.textContent = "✨";
          nameWrap.appendChild(foilEl);
        }

        if (legality.checked && !legality.legal) {
          let badgeEl = document.createElement("span");
          badgeEl.className = "status-badge illegal deck-card-illegal-badge";
          badgeEl.textContent = "Illegal";
          nameWrap.appendChild(badgeEl);
        }

        if (card.condition) {
          let condBadge = document.createElement("span");
          condBadge.className = "deck-card-condition-badge";
          condBadge.textContent = card.condition;
          condBadge.title = getConditionLabel(card.condition);
          nameWrap.appendChild(condBadge);
        }

        row.appendChild(nameWrap);

        let controls = document.createElement("div");
        controls.className = "deck-card-controls";

        let stepper = document.createElement("div");
        stepper.className = "qty-stepper";
        stepper.innerHTML = [
          '<button type="button" data-action="qty-down" data-index="' + index + '" aria-label="Decrease quantity">−</button>',
          '<span class="qty-value" data-qty-index="' + index + '">' + (card.quantity || 1) + '</span>',
          '<button type="button" data-action="qty-up" data-index="' + index + '" aria-label="Increase quantity">+</button>',
        ].join("");
        controls.appendChild(stepper);

        let detailsBtn = document.createElement("button");
        detailsBtn.type = "button";
        detailsBtn.className = "deck-card-details-btn";
        detailsBtn.dataset.action = "edit-details";
        detailsBtn.dataset.index = String(index);
        detailsBtn.textContent = "Details";
        controls.appendChild(detailsBtn);

        let removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "deck-card-remove-btn";
        removeBtn.dataset.action = "remove";
        removeBtn.dataset.index = String(index);
        removeBtn.textContent = "Remove";
        controls.appendChild(removeBtn);

        row.appendChild(controls);
        cardList.appendChild(row);
      });

      section.appendChild(cardList);
      main.appendChild(section);
    });
  }

  layout.appendChild(main);
  elements.cardGrid.appendChild(layout);

  bindDeckDetailHoverPreview();
  bindCardActionButtons();
  if (deckEntries.length > 0) {
    loadDeckDetailAsyncStats(deckEntries, priceSpan, manaCurveEl);
  }
}

function buildColorDistributionEl(deckEntries) {
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

  let present = ["W", "U", "B", "R", "G", "C"].filter(function(c) { return counts[c] > 0; });
  if (present.length === 0) return null;

  let max = Math.max.apply(null, present.map(function(c) { return counts[c]; }));

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

function generateDecklist(groups) {
  let lines = [];
  DECK_TYPE_CATEGORIES.forEach(function(cat) {
    let entries = groups[cat];
    if (!entries || entries.length === 0) return;
    lines.push("// " + cat);
    entries
      .slice()
      .sort(function(a, b) { return a.card.name.localeCompare(b.card.name); })
      .forEach(function(e) {
        lines.push((e.card.quantity || 1) + " " + e.card.name);
      });
    lines.push("");
  });
  return lines.join("\n").trim();
}

async function loadDeckDetailAsyncStats(deckEntries, priceSpan, manaCurveEl) {
  let cacheKey = currentDeckDetail;
  let scryfallData = deckScryfallCache[cacheKey];
  if (!scryfallData) {
    scryfallData = await fetchDeckScryfallData(deckEntries);
    deckScryfallCache[cacheKey] = scryfallData;
  }

  let price = calcDeckPrice(deckEntries, scryfallData);
  priceSpan.textContent = price !== null ? " • $" + price + " est." : "";

  let curveData = buildManaCurveData(deckEntries, scryfallData);
  let curveChart = renderManaCurveEl(curveData);
  manaCurveEl.innerHTML = "";
  let heading = document.createElement("h4");
  heading.className = "deck-detail-breakdown-heading";
  heading.textContent = "Mana Curve";
  manaCurveEl.appendChild(heading);
  manaCurveEl.appendChild(curveChart);
}

async function fetchDeckScryfallData(deckEntries) {
  let ids = [];
  let seen = {};
  deckEntries.forEach(function(e) {
    let id = e.card.scryfallId;
    if (id && typeof id === "string" && id.length > 0 && !seen[id]) {
      ids.push(id);
      seen[id] = true;
    }
  });

  if (ids.length === 0) return {};

  let result = {};
  for (let i = 0; i < ids.length; i += 75) {
    let batch = ids.slice(i, i + 75);
    try {
      let response = await fetch("https://api.scryfall.com/cards/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers: batch.map(function(id) { return { id: id }; }) })
      });
      if (!response.ok) continue;
      let data = await response.json();
      if (data.object === "list" && Array.isArray(data.data)) {
        data.data.forEach(function(card) {
          result[card.id] = { cmc: card.cmc || 0, prices: card.prices || {} };
        });
      }
    } catch (e) {
      console.warn("Scryfall deck data fetch failed:", e);
    }
  }
  return result;
}

function buildManaCurveData(deckEntries, scryfallData) {
  let curve = { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6+": 0 };
  deckEntries.forEach(function(e) {
    let cat = getDeckTypeCategory(e.card, currentDeckDetail);
    if (cat === "Lands") return;
    let sfData = e.card.scryfallId ? scryfallData[e.card.scryfallId] : null;
    let cmc = sfData ? sfData.cmc : 0;
    let qty = e.card.quantity || 1;
    let bucket = cmc >= 6 ? "6+" : String(Math.floor(cmc));
    curve[bucket] = (curve[bucket] || 0) + qty;
  });
  return curve;
}

function renderManaCurveEl(curveData) {
  let buckets = ["0", "1", "2", "3", "4", "5", "6+"];
  let max = Math.max.apply(null, buckets.map(function(b) { return curveData[b] || 0; }));

  let wrap = document.createElement("div");
  wrap.className = "mana-curve-chart";

  buckets.forEach(function(b) {
    let count = curveData[b] || 0;

    let col = document.createElement("div");
    col.className = "mana-curve-col";

    let countEl = document.createElement("div");
    countEl.className = "mana-curve-count";
    countEl.textContent = count > 0 ? count : "";
    col.appendChild(countEl);

    let bar = document.createElement("div");
    bar.className = "mana-curve-bar";
    bar.style.height = max > 0 ? Math.max(2, Math.round((count / max) * 60)) + "px" : "2px";
    col.appendChild(bar);

    let label = document.createElement("div");
    label.className = "mana-curve-label";
    label.textContent = b;
    col.appendChild(label);

    wrap.appendChild(col);
  });

  return wrap;
}

function calcDeckPrice(deckEntries, scryfallData) {
  let total = 0;
  let hasAny = false;
  deckEntries.forEach(function(e) {
    let sfData = e.card.scryfallId ? scryfallData[e.card.scryfallId] : null;
    if (!sfData || !sfData.prices) return;
    let qty = e.card.quantity || 1;
    let priceStr = e.card.foil
      ? (sfData.prices.usd_foil || sfData.prices.usd || "0")
      : (sfData.prices.usd || sfData.prices.usd_foil || "0");
    let price = parseFloat(priceStr || "0");
    if (price > 0) {
      total += price * qty;
      hasAny = true;
    }
  });
  return hasAny ? total.toFixed(2) : null;
}

function bindDeckDetailHoverPreview() {
  let popup = document.getElementById("cardPreviewPopup");
  if (!popup) {
    popup = document.createElement("div");
    popup.id = "cardPreviewPopup";
    popup.className = "card-preview-popup hidden";
    let img = document.createElement("img");
    img.alt = "Card preview";
    popup.appendChild(img);
    document.body.appendChild(popup);
  }
  let popupImg = popup.querySelector("img");

  document.querySelectorAll(".deck-card-name[data-card-image]").forEach(function(el) {
    el.addEventListener("mouseenter", function() {
      let imageUrl = el.dataset.cardImage;
      if (!imageUrl) return;
      popupImg.src = imageUrl;
      let rect = el.getBoundingClientRect();
      let popupWidth = 220;
      let leftPos = rect.right + 16;
      if (leftPos + popupWidth > window.innerWidth - 8) {
        leftPos = rect.left - popupWidth - 16;
      }
      let topPos = Math.min(Math.max(8, rect.top - 20), window.innerHeight - 320);
      popup.style.left = leftPos + "px";
      popup.style.top = topPos + "px";
      popup.classList.remove("hidden");
    });
    el.addEventListener("mouseleave", function() {
      popup.classList.add("hidden");
    });
  });
}

function displayDeckBuilder() {
  let targetDeck = normalizeDeckName(elements.builderDeckSelect.value);
  let searchQuery = elements.searchInput.value.toLowerCase().trim();
  let sourceFilter = elements.builderSourceFilter.value;
  let typeFilter = elements.builderTypeFilter.value;
  let legalOnly = elements.builderLegalOnlyToggle.checked;

  elements.cardGrid.innerHTML = "";

  if (!targetDeck) {
    elements.headerText.innerHTML = "<span id='cardCount'>0</span> cards in your collection";
    elements.filterNote.textContent = "Create or import a deck first, then come back here to build with your collection.";
    elements.builderSummary.textContent = "No decks are available to build yet.";
    let emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "No decks available yet.";
    elements.cardGrid.appendChild(emptyState);
    return;
  }

  let deckCards = [];
  let availableCards = [];

  let deckCardNames = new Set(
    collection
      .filter(function(card) { return normalizeDeckName(card.deck || "unsorted") === targetDeck; })
      .map(function(card) { return card.name.toLowerCase(); })
  );

  collection.forEach(function(card, index) {
    let deckName = normalizeDeckName(card.deck || "unsorted");

    if (deckName === targetDeck) {
      deckCards.push({ card: card, index: index, deckName: deckName });
      return;
    }

    if (deckCardNames.has(card.name.toLowerCase())) {
      return;
    }

    if (!matchesBuilderSourceFilter(deckName, sourceFilter)) {
      return;
    }

    if (!matchesBuilderTypeFilter(card, typeFilter)) {
      return;
    }

    if (legalOnly && COMMANDER_DECKS[targetDeck] && !isCardLegalForCommander(card, targetDeck)) {
      return;
    }

    let nameMatch = !searchQuery || card.name.toLowerCase().includes(searchQuery);
    let typeMatch = !searchQuery || (card.type || "").toLowerCase().includes(searchQuery);
    let deckMatch = !searchQuery || deckName.toLowerCase().includes(searchQuery);
    if (searchQuery && !nameMatch && !typeMatch && !deckMatch) {
      return;
    }

    availableCards.push({ card: card, index: index, deckName: deckName });
  });

  if (searchQuery) {
    deckCards = deckCards.filter(function(entry) {
      return entry.card.name.toLowerCase().includes(searchQuery)
        || (entry.card.type || "").toLowerCase().includes(searchQuery);
    });
  }

  if (typeFilter) {
    deckCards = deckCards.filter(function(entry) {
      return matchesBuilderTypeFilter(entry.card, typeFilter);
    });
  }

  sortEntriesForView(deckCards);
  sortEntriesForView(availableCards);

  let deckCardCount = deckCards.reduce(function(sum, entry) {
    return sum + (entry.card.quantity || 1);
  }, 0);
  let availableCardCount = availableCards.reduce(function(sum, entry) {
    return sum + (entry.card.quantity || 1);
  }, 0);
  let illegalInDeckCount = deckCards.filter(function(entry) {
    let legality = getDeckLegality(entry.card);
    return legality.checked && !legality.legal;
  }).length;

  elements.headerText.innerHTML = "<span id='cardCount'>" + deckCardCount + "</span> cards in " + escapeHtml(getDeckDisplayLabel(targetDeck));
  elements.filterNote.textContent = searchQuery
    ? "Building " + getDeckDisplayLabel(targetDeck) + " with search results for \"" + searchQuery + "\"."
    : "Move cards from your collection into " + getDeckDisplayLabel(targetDeck) + ".";
  elements.builderSummary.textContent = deckCardCount + " cards in deck, "
    + availableCardCount + " matching candidates"
    + " from " + getBuilderSourceSummary(sourceFilter)
    + (typeFilter ? ", filtered to " + getBuilderTypeLabel(typeFilter).toLowerCase() : "")
    + (legalOnly && COMMANDER_DECKS[targetDeck] ? ", commander-legal only" : "")
    + (illegalInDeckCount > 0 ? ", " + illegalInDeckCount + " outside commander color identity." : ".");

  let builderLayout = document.createElement("div");
  builderLayout.className = "builder-layout";

  builderLayout.appendChild(createBuilderColumn(
    "In Deck",
    deckCards,
    "Cards already assigned to " + getDeckDisplayLabel(targetDeck),
    function(entry) { return createBuilderDeckCard(entry, targetDeck); },
    searchQuery ? "No deck cards match this search." : "No cards are assigned to this deck yet."
  ));

  builderLayout.appendChild(createBuilderColumn(
    "Available Collection Cards",
    availableCards,
    "Cards you can move into " + getDeckDisplayLabel(targetDeck),
    function(entry) { return createBuilderAvailableCard(entry, targetDeck); },
    searchQuery ? "No available cards match this search." : "No other collection cards are available right now."
  ));

  elements.cardGrid.appendChild(builderLayout);
  bindBuilderActionButtons();
}

function matchesBuilderSourceFilter(deckName, sourceFilter) {
  if (sourceFilter === "spares") {
    return deckName === "unsorted";
  }

  if (sourceFilter === "other-decks") {
    return deckName !== "unsorted" && !isBoxOrBinder(deckName);
  }

  return true;
}

function matchesBuilderTypeFilter(card, typeFilter) {
  if (!typeFilter) {
    return true;
  }

  let typeLine = (card.type || "").toLowerCase();

  if (typeFilter === "land") {
    return typeLine.includes("land");
  }

  if (typeFilter === "creature") {
    return typeLine.includes("creature");
  }

  if (typeFilter === "instant-sorcery") {
    return typeLine.includes("instant") || typeLine.includes("sorcery");
  }

  if (typeFilter === "artifact-enchantment") {
    return typeLine.includes("artifact") || typeLine.includes("enchantment");
  }

  if (typeFilter === "planeswalker") {
    return typeLine.includes("planeswalker");
  }

  return true;
}

function getBuilderSourceSummary(sourceFilter) {
  if (sourceFilter === "spares") {
    return "your unsorted cards";
  }

  if (sourceFilter === "other-decks") {
    return "your other decks";
  }

  return "your full collection";
}

function getBuilderTypeLabel(typeFilter) {
  if (typeFilter === "land") return "Lands";
  if (typeFilter === "creature") return "Creatures";
  if (typeFilter === "instant-sorcery") return "Instants & Sorceries";
  if (typeFilter === "artifact-enchantment") return "Artifacts & Enchantments";
  if (typeFilter === "planeswalker") return "Planeswalkers";
  return "All types";
}

function sortEntriesForView(entries) {
  let sortMode = elements.sortSelect.value;

  entries.sort(function(a, b) {
    let cardA = a.card;
    let cardB = b.card;

    switch (sortMode) {
      case "type":
        return (cardA.type || "").localeCompare(cardB.type || "");
      case "color":
        return ((cardA.colorIdentity || []).join("") || "").localeCompare((cardB.colorIdentity || []).join("") || "");
      case "set":
        return (cardA.set || "").localeCompare(cardB.set || "");
      case "collector":
        return (cardA.collectorNumber || "").localeCompare(cardB.collectorNumber || "", undefined, { numeric: true });
      case "name":
      default:
        return cardA.name.localeCompare(cardB.name);
    }
  });
}

function createBuilderColumn(title, entries, description, renderCard, emptyMessage) {
  let column = document.createElement("section");
  column.className = "builder-column";

  let heading = document.createElement("h2");
  heading.className = "deck-heading";
  heading.textContent = title + " (" + entries.reduce(function(sum, entry) {
    return sum + (entry.card.quantity || 1);
  }, 0) + ")";
  column.appendChild(heading);

  let detail = document.createElement("p");
  detail.className = "deck-meta";
  detail.textContent = description;
  column.appendChild(detail);

  let grid = document.createElement("div");
  grid.className = "builder-card-grid";
  column.appendChild(grid);

  if (entries.length === 0) {
    let emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = emptyMessage;
    grid.appendChild(emptyState);
    return column;
  }

  entries.forEach(function(entry) {
    grid.appendChild(renderCard(entry));
  });

  return column;
}

function createBuilderDeckCard(entry, targetDeck) {
  let card = entry.card;
  let legality = getDeckLegality(card);
  let safeCardName = escapeHtml(card.name);
  let cardElement = document.createElement("article");
  cardElement.className = "builder-card" + (legality.checked && !legality.legal ? " card-illegal" : "");
  cardElement.innerHTML = [
    card.image ? '<img src="' + escapeHtml(card.image) + '" alt="' + safeCardName + ' card image" />' : "",
    '<div class="card-name">' + safeCardName + "</div>",
    '<div class="card-type">' + escapeHtml(card.type || "Unknown type") + "</div>",
    '<div class="card-colors">Qty: ' + (card.quantity || 1) + " • " + escapeHtml(getColorIdentityLabel(card.colorIdentity)) + "</div>",
    getPrintLabel(card) ? '<div class="card-print">Print: ' + escapeHtml(getPrintLabel(card)) + "</div>" : "",
    legality.checked && !legality.legal ? '<div class="status-badge illegal">Outside ' + escapeHtml(getDeckDisplayLabel(targetDeck)) + " color identity</div>" : "",
    '<div class="builder-card-actions">',
    '<button type="button" data-builder-action="remove-from-deck" data-index="' + entry.index + '">Move to unsorted</button>',
    "</div>"
  ].join("");
  return cardElement;
}

function createBuilderAvailableCard(entry, targetDeck) {
  let card = entry.card;
  let safeCardName = escapeHtml(card.name);
  let locationLabel = getDeckDisplayLabel(entry.deckName);
  let legalForDeck = isCardLegalForCommander(card, targetDeck);
  let cardElement = document.createElement("article");
  cardElement.className = "builder-card";
  cardElement.innerHTML = [
    card.image ? '<img src="' + escapeHtml(card.image) + '" alt="' + safeCardName + ' card image" />' : "",
    '<div class="card-name">' + safeCardName + "</div>",
    '<div class="card-type">' + escapeHtml(card.type || "Unknown type") + "</div>",
    '<div class="card-colors">Qty: ' + (card.quantity || 1) + " • " + escapeHtml(getColorIdentityLabel(card.colorIdentity)) + "</div>",
    '<div class="card-deck-label">Currently in ' + escapeHtml(locationLabel) + "</div>",
    getPrintLabel(card) ? '<div class="card-print">Print: ' + escapeHtml(getPrintLabel(card)) + "</div>" : "",
    COMMANDER_DECKS[targetDeck] && !legalForDeck ? '<div class="status-badge illegal">Outside commander color identity</div>' : "",
    '<div class="builder-card-actions">',
    '<button type="button" data-builder-action="add-to-deck" data-index="' + entry.index + '" data-target-deck="' + escapeHtml(targetDeck) + '">Use in deck</button>',
    "</div>"
  ].join("");
  return cardElement;
}

function bindBuilderActionButtons() {
  document.querySelectorAll("[data-builder-action='add-to-deck']").forEach(function(button) {
    button.addEventListener("click", function() {
      moveCardToDeck(Number(button.dataset.index), button.dataset.targetDeck);
    });
  });

  document.querySelectorAll("[data-builder-action='remove-from-deck']").forEach(function(button) {
    button.addEventListener("click", function() {
      moveCardToDeck(Number(button.dataset.index), "unsorted");
    });
  });
}

// ============================================================
// DECK BUILDER CHAT
// ============================================================

function initChatApiKey() {
  let saved = localStorage.getItem(BUILDER_API_KEY_KEY);
  if (saved) {
    elements.chatApiKeyInput.value = saved;
    elements.chatApiKeyMode.textContent = "(AI-powered)";
  }
}

function saveChatApiKey() {
  let key = elements.chatApiKeyInput.value.trim();
  if (!key) return;
  localStorage.setItem(BUILDER_API_KEY_KEY, key);
  elements.chatApiKeyMode.textContent = "(AI-powered)";
}

function clearChatApiKey() {
  localStorage.removeItem(BUILDER_API_KEY_KEY);
  elements.chatApiKeyInput.value = "";
  elements.chatApiKeyMode.textContent = "(using Scryfall smart search)";
}

function clearDeckChat() {
  pendingChatMessageEl = null;
  elements.chatMessages.innerHTML = "";
  let welcome = document.createElement("p");
  welcome.className = "chat-welcome";
  welcome.textContent = "Ask me to suggest cards — try \"add more ramp\" or \"find removal for this deck\".";
  elements.chatMessages.appendChild(welcome);
}

function appendChatMessage(role, text, cards) {
  let el = document.createElement("div");
  el.className = "chat-message chat-message-" + role;

  let textEl = document.createElement("p");
  textEl.className = "chat-message-text";
  textEl.textContent = text;
  el.appendChild(textEl);

  if (cards && cards.length > 0) {
    let targetDeck = normalizeDeckName(elements.builderDeckSelect.value);
    el.appendChild(renderChatSuggestions(cards, targetDeck));
  }

  elements.chatMessages.appendChild(el);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  return el;
}

function showPendingChatMessage() {
  pendingChatMessageEl = appendChatMessage("assistant", "Thinking…");
  pendingChatMessageEl.classList.add("chat-message-pending");
}

function resolvePendingChatMessage(text, cards) {
  if (!pendingChatMessageEl) return;
  pendingChatMessageEl.classList.remove("chat-message-pending");
  pendingChatMessageEl.querySelector(".chat-message-text").textContent = text;
  if (cards && cards.length > 0) {
    let targetDeck = normalizeDeckName(elements.builderDeckSelect.value);
    pendingChatMessageEl.appendChild(renderChatSuggestions(cards, targetDeck));
  }
  pendingChatMessageEl = null;
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function renderChatSuggestions(scryfallCards, targetDeck) {
  let container = document.createElement("div");
  container.className = "chat-suggestions";

  function flattenCardName(name) {
    return (name || "").toLowerCase().replace(/[‘’‚‛′‵]/g, "'");
  }

  let deckCardNames = new Set(
    collection
      .filter(function(c) { return normalizeDeckName(c.deck || "unsorted") === targetDeck; })
      .map(function(c) { return flattenCardName(c.name); })
  );
  let ownedCardNames = new Set(collection.map(function(c) { return flattenCardName(c.name); }));

  scryfallCards.forEach(function(card) {
    let cardEl = document.createElement("div");
    cardEl.className = "chat-suggestion-card";

    let imageUri = getCardImageUri(card);
    if (imageUri) {
      let img = document.createElement("img");
      img.src = imageUri;
      img.alt = card.name + " card image";
      cardEl.appendChild(img);
    }

    let nameEl = document.createElement("div");
    nameEl.className = "chat-suggestion-name";
    nameEl.textContent = card.name;
    cardEl.appendChild(nameEl);

    let typeEl = document.createElement("div");
    typeEl.className = "chat-suggestion-type";
    typeEl.textContent = card.type_line || "";
    cardEl.appendChild(typeEl);

    let cardNameLower = flattenCardName(card.name);
    let alreadyInDeck = deckCardNames.has(cardNameLower);
    let alreadyOwned = !alreadyInDeck && ownedCardNames.has(cardNameLower);

    let btn = document.createElement("button");
    btn.type = "button";
    if (alreadyInDeck) {
      btn.textContent = "Already in deck";
      btn.disabled = true;
    } else if (alreadyOwned) {
      btn.textContent = "In collection";
      btn.disabled = true;
    } else {
      btn.textContent = targetDeck ? "Add to " + getDeckDisplayLabel(targetDeck) : "Add to collection";
      btn.addEventListener("click", function() {
        addSuggestedCard(card, targetDeck || "unsorted");
        btn.textContent = "Added!";
        btn.disabled = true;
      });
    }
    cardEl.appendChild(btn);

    container.appendChild(cardEl);
  });

  return container;
}

async function addSuggestedCard(scryfallCard, targetDeck) {
  let newCard = createStoredCard(scryfallCard, { deck: targetDeck, foil: false, quantity: 1 });
  collection.push(newCard);
  populateDeckFilter();
  populateBuilderDeckSelect();
  displayCards();
  showStatusMessage(newCard.name + " added to " + getDeckDisplayLabel(targetDeck) + ".");
  try {
    await dbUpsertCards([newCard]);
  } catch (error) {
    console.error("Could not save suggested card.", error);
    collection.splice(collection.indexOf(newCard), 1);
    populateDeckFilter();
    populateBuilderDeckSelect();
    displayCards();
    showStatusMessage("Could not add " + newCard.name + ". Please try again.");
  }
}

async function handleChatSend() {
  let prompt = elements.chatInput.value.trim();
  if (!prompt) return;
  elements.chatInput.value = "";
  elements.chatSendButton.disabled = true;

  appendChatMessage("user", prompt);
  showPendingChatMessage();

  let apiKey = localStorage.getItem(BUILDER_API_KEY_KEY);
  let targetDeck = normalizeDeckName(elements.builderDeckSelect.value);

  try {
    if (apiKey) {
      await handleClaudeChat(prompt, targetDeck, apiKey);
    } else {
      await handleScryfallChat(prompt, targetDeck);
    }
  } catch (error) {
    resolvePendingChatMessage("Something went wrong: " + error.message);
  } finally {
    elements.chatSendButton.disabled = false;
    elements.chatInput.focus();
  }
}

async function handleScryfallChat(prompt, targetDeck) {
  let commanderDeck = COMMANDER_DECKS[targetDeck];
  let colors = commanderDeck ? commanderDeck.colors : [];
  let query = buildScryfallQueryFromPrompt(prompt, colors);

  let cards = await fetchScryfallSearch(query);
  if (cards.length === 0) {
    resolvePendingChatMessage("No Scryfall results for that search. Try rephrasing, or add an Anthropic API key for AI suggestions.");
    return;
  }

  let label = getDeckDisplayLabel(targetDeck) || "your deck";
  resolvePendingChatMessage(
    "Here are Scryfall results for " + label + " (sorted by EDHREC popularity). Add an Anthropic API key below for AI-powered suggestions.",
    cards.slice(0, 12)
  );
}

async function handleClaudeChat(prompt, targetDeck, apiKey) {
  let commanderDeck = COMMANDER_DECKS[targetDeck];
  let colors = commanderDeck ? commanderDeck.colors : [];
  let deckCards = collection.filter(function(c) {
    return normalizeDeckName(c.deck || "unsorted") === targetDeck;
  });
  let cardListText = deckCards.map(function(c) {
    return c.name + " (" + (c.type || "?") + ")";
  }).join(", ") || "none yet";

  let systemPrompt = "You are an expert Magic: The Gathering Commander deckbuilding assistant.\n"
    + "Deck: " + getDeckDisplayLabel(targetDeck) + "\n"
    + (commanderDeck ? "Commander(s): " + commanderDeck.commander.join(", ") + "\n" : "")
    + "Color identity: " + (colors.length > 0 ? colors.join("") : "Colorless") + "\n"
    + "Cards in deck (" + deckCards.length + "): " + cardListText + "\n\n"
    + "Suggest 6-10 specific, real Magic card names that fit the color identity.\n"
    + "Keep your response to 2-3 sentences of strategy, then end with exactly:\n"
    + "CARDS: CardName1 | CardName2 | CardName3";

  let response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    let errData = await response.json().catch(function() { return {}; });
    let errMsg = (errData.error && errData.error.message) || ("API error " + response.status);
    if (response.status === 401) {
      resolvePendingChatMessage("Invalid API key — check your key below. Falling back to Scryfall search.");
    } else {
      resolvePendingChatMessage(errMsg + " — falling back to Scryfall search.");
    }
    await handleScryfallChat(prompt, targetDeck);
    return;
  }

  let data = await response.json();
  let fullText = data.content[0].text;
  let cardNames = extractCardNamesFromClaudeResponse(fullText);
  let explanation = fullText.replace(/CARDS:.*$/m, "").trim();

  if (cardNames.length === 0) {
    resolvePendingChatMessage(explanation || fullText);
    return;
  }

  let scryfallCards = await fetchCardsByNames(cardNames);
  resolvePendingChatMessage(explanation, scryfallCards);
}

function extractCardNamesFromClaudeResponse(text) {
  let match = text.match(/CARDS:\s*(.+)$/m);
  if (!match) return [];
  return match[1].split("|").map(function(s) { return s.trim(); }).filter(Boolean);
}

async function fetchScryfallSearch(query) {
  let url = "https://api.scryfall.com/cards/search?q=" + encodeURIComponent(query);
  let response = await fetch(url);
  if (response.status === 404) return [];
  if (!response.ok) throw new Error("Scryfall search failed (" + response.status + ")");
  let data = await response.json();
  return data.data || [];
}

async function fetchCardsByNames(names) {
  if (names.length === 0) return [];
  let identifiers = names.slice(0, 75).map(function(name) { return { name: name }; });
  let response = await fetch("https://api.scryfall.com/cards/collection", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifiers: identifiers })
  });
  if (!response.ok) return [];
  let data = await response.json();
  return data.data || [];
}

function buildScryfallQueryFromPrompt(prompt, colors) {
  let p = prompt.toLowerCase();
  let parts = [];

  if (colors && colors.length > 0) {
    parts.push("id<=" + colors.join("").toLowerCase());
  }
  parts.push("format:commander");

  let wantsLands = /\bland(s|fix|base|ramp)?\b/.test(p);

  if (/\b(ramp|mana rock|mana dork|accelerat|mana fix)\b/.test(p)) {
    if (wantsLands && /\bland/.test(p)) {
      parts.push("(type:land or (oracle:\"add {\" -type:land) or oracle:\"search your library for a basic land\")");
    } else {
      parts.push("(oracle:\"add {\" or oracle:\"search your library for a basic land\" or (type:artifact oracle:\"add\"))");
      parts.push("-type:land");
    }
  } else if (/\b(board.?wipe|wrath|mass removal|all creatures|destroy all)\b/.test(p)) {
    parts.push("(oracle:\"destroy all\" or oracle:\"exile all creatures\" or oracle:\"each creature gets\" or oracle:\"all creatures get\")");
  } else if (/\b(removal|destroy|kill target|exile target|remove|spot removal)\b/.test(p)) {
    parts.push("(oracle:\"destroy target\" or oracle:\"exile target creature\" or oracle:\"exile target permanent\" or oracle:\"deals damage to target creature\")");
  } else if (/\b(counter(spell)?|counter target|counterspell)\b/.test(p)) {
    parts.push("type:instant oracle:\"counter target\"");
  } else if (/\b(draw|card draw|card advantage|cantrip)\b/.test(p)) {
    parts.push("(oracle:\"draw a card\" or oracle:\"draw two cards\" or oracle:\"draw three cards\" or oracle:\"draw cards\")");
    parts.push("-type:land");
  } else if (/\b(tutor|search your library)\b/.test(p)) {
    parts.push("oracle:\"search your library\"");
    parts.push("-type:land");
  } else if (/\bproliferat/.test(p)) {
    parts.push("oracle:proliferate");
  } else if (/\b(protection|hexproof|shroud|indestructible)\b/.test(p)) {
    parts.push("(keyword:hexproof or keyword:shroud or keyword:indestructible or oracle:\"protection from\")");
  } else if (/\b(flier|flyer|flying)\b/.test(p)) {
    parts.push("type:creature keyword:flying");
  } else if (/\b(token)\b/.test(p)) {
    parts.push("oracle:\"creature token\"");
  } else if (/\b(\+1\/\+1|plus one|counter(s)?)\b/.test(p) && !/counter target/.test(p)) {
    parts.push("oracle:\"+1/+1 counter\"");
  } else if (/\b(extra turn)\b/.test(p)) {
    parts.push("oracle:\"extra turn\"");
  } else if (/\b(life(gain)?|gain life)\b/.test(p)) {
    parts.push("oracle:\"gain life\"");
  } else if (/\b(haste)\b/.test(p)) {
    parts.push("keyword:haste type:creature");
  } else if (/\b(trample)\b/.test(p)) {
    parts.push("keyword:trample type:creature");
  } else if (/\b(reanimat|graveyard recursion|from (the|your) graveyard)\b/.test(p)) {
    parts.push("(oracle:\"return target\" oracle:\"graveyard\" or oracle:\"from your graveyard\")");
  } else if (wantsLands) {
    parts.push("type:land");
  } else if (/\b(artifact)\b/.test(p)) {
    parts.push("type:artifact");
  } else if (/\b(enchantment)\b/.test(p)) {
    parts.push("type:enchantment");
  } else if (/\b(creature)\b/.test(p)) {
    parts.push("type:creature");
  } else if (/\b(instant)\b/.test(p)) {
    parts.push("type:instant");
  } else if (/\b(sorcery)\b/.test(p)) {
    parts.push("type:sorcery");
  } else if (/\b(planeswalker)\b/.test(p)) {
    parts.push("type:planeswalker");
  } else {
    let words = prompt.trim().split(/\s+/).filter(function(w) { return w.length > 3; });
    if (words.length > 0) {
      parts.push("oracle:\"" + words[0].toLowerCase() + "\"");
    }
  }

  if (/\b(cheap|low.?cost|1 mana|2 mana|cmc[<= ]+2)\b/.test(p)) parts.push("cmc<=2");
  else if (/\b(3 mana|cmc[<= ]+3)\b/.test(p)) parts.push("cmc<=3");

  return parts.join(" ") + " order:edhrec";
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

  document.querySelectorAll("[data-action='qty-up']").forEach(function(button) {
    button.addEventListener("click", function() {
      updateCardQuantity(Number(button.dataset.index), 1);
    });
  });

  document.querySelectorAll("[data-action='qty-down']").forEach(function(button) {
    button.addEventListener("click", function() {
      updateCardQuantity(Number(button.dataset.index), -1);
    });
  });

  document.querySelectorAll("[data-action='set-qty']").forEach(function(button) {
    button.addEventListener("click", function() {
      let index = Number(button.dataset.index);
      let input = document.querySelector(".qty-input[data-qty-index='" + index + "']");
      let qty = parseInt(input && input.value, 10);
      if (!qty || qty < 1) return;
      let delta = qty - (collection[index].quantity || 1);
      if (delta !== 0) updateCardQuantity(index, delta);
    });
  });

  document.querySelectorAll("[data-action='edit-details']").forEach(function(button) {
    button.addEventListener("click", function() {
      openCardDetailsModal(Number(button.dataset.index));
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

  elements.addCardButton.disabled = true;
  elements.addCardButton.textContent = "Looking up...";
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
  } finally {
    elements.addCardButton.disabled = false;
    elements.addCardButton.textContent = "Add card";
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
  await moveCardToDeck(index, nextDeckName);
}

async function moveCardToDeck(index, nextDeckName) {
  let previousCard = collection[index];
  let normalizedDeckName = nextDeckName;
  let updatedCard = { ...previousCard, deck: normalizedDeckName };
  collection[index] = updatedCard;
  populateDeckFilter();
  populateBuilderDeckSelect();
  displayCards();
  showStatusMessage(updatedCard.name + " moved from " + getDeckDisplayLabel(previousCard.deck || "unsorted") + " to " + getDeckDisplayLabel(normalizedDeckName) + ".");
  try {
    await dbUpsertCards([updatedCard]);
  } catch (error) {
    console.error("Could not move card.", error);
    collection[index] = previousCard;
    populateDeckFilter();
    populateBuilderDeckSelect();
    displayCards();
    showStatusMessage("Could not move " + updatedCard.name + ". Please try again.");
  }
}

async function updateCardQuantity(index, delta) {
  let card = collection[index];
  let currentQty = card.quantity || 1;
  let newQty = Math.max(1, currentQty + delta);
  if (newQty === currentQty) return;

  // Optimistic DOM update — avoid a full re-render for every +/- click
  let qtyValue = document.querySelector('[data-qty-index="' + index + '"]');
  let qtyBadge = document.querySelector('[data-qty-badge="' + index + '"]');
  if (qtyValue) qtyValue.textContent = newQty;
  if (qtyBadge) {
    qtyBadge.textContent = "(" + newQty + "x)";
    qtyBadge.style.display = newQty > 1 ? "" : "none";
  }

  let updatedCard = { ...card, quantity: newQty };
  collection[index] = updatedCard;
  showStatusMessage(card.name + " quantity set to " + newQty + ".");

  try {
    await dbUpsertCards([updatedCard]);
  } catch (error) {
    console.error("Could not update card quantity.", error);
    collection[index] = card;
    if (qtyValue) qtyValue.textContent = currentQty;
    if (qtyBadge) {
      qtyBadge.textContent = "(" + currentQty + "x)";
      qtyBadge.style.display = currentQty > 1 ? "" : "none";
    }
    showStatusMessage("Could not update " + card.name + " quantity. Please try again.");
  }
}

const CARD_CONDITIONS = [
  { value: "NM", label: "Near Mint (NM)" },
  { value: "LP", label: "Lightly Played (LP)" },
  { value: "MP", label: "Moderately Played (MP)" },
  { value: "HP", label: "Heavily Played (HP)" },
  { value: "DMG", label: "Damaged (DMG)" }
];

function getConditionLabel(value) {
  let found = CARD_CONDITIONS.find(function(c) { return c.value === value; });
  return found ? found.label : value;
}

function openCardDetailsModal(index) {
  let card = collection[index];
  if (!card) return;

  let existing = document.getElementById("cardDetailsModal");
  if (existing) existing.remove();

  let overlay = document.createElement("div");
  overlay.id = "cardDetailsModal";
  overlay.className = "card-details-modal-overlay";

  let modal = document.createElement("div");
  modal.className = "card-details-modal";

  let header = document.createElement("div");
  header.className = "card-details-modal-header";
  let title = document.createElement("h3");
  title.className = "card-details-modal-title";
  title.textContent = card.name;
  let closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "card-details-modal-close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "×";
  header.appendChild(title);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  let body = document.createElement("div");
  body.className = "card-details-modal-body";

  function makeField(labelText, inputEl) {
    let group = document.createElement("div");
    group.className = "card-details-field-group";
    let label = document.createElement("label");
    label.textContent = labelText;
    group.appendChild(label);
    group.appendChild(inputEl);
    return group;
  }

  let condSelect = document.createElement("select");
  condSelect.innerHTML = '<option value="">— Not set —</option>' +
    CARD_CONDITIONS.map(function(c) {
      return '<option value="' + c.value + '">' + c.label + '</option>';
    }).join("");
  condSelect.value = card.condition || "";
  body.appendChild(makeField("Condition", condSelect));

  let dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = card.acquiredDate || "";
  body.appendChild(makeField("Date Acquired", dateInput));

  let priceInput = document.createElement("input");
  priceInput.type = "number";
  priceInput.min = "0";
  priceInput.step = "0.01";
  priceInput.placeholder = "0.00";
  priceInput.value = card.purchasePrice != null ? card.purchasePrice : "";
  body.appendChild(makeField("Purchase Price ($)", priceInput));

  let notesInput = document.createElement("textarea");
  notesInput.rows = 3;
  notesInput.placeholder = "Any notes about this card…";
  notesInput.value = card.notes || "";
  body.appendChild(makeField("Notes", notesInput));

  modal.appendChild(body);

  let footer = document.createElement("div");
  footer.className = "card-details-modal-footer";
  let saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "card-details-save-btn";
  saveBtn.textContent = "Save";
  let cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "card-details-cancel-btn";
  cancelBtn.textContent = "Cancel";
  footer.appendChild(saveBtn);
  footer.appendChild(cancelBtn);
  modal.appendChild(footer);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function close() { overlay.remove(); }
  closeBtn.addEventListener("click", close);
  cancelBtn.addEventListener("click", close);
  overlay.addEventListener("click", function(e) { if (e.target === overlay) close(); });

  saveBtn.addEventListener("click", async function() {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    let rawPrice = parseFloat(priceInput.value);
    await updateCardMetadata(index, {
      condition: condSelect.value,
      acquiredDate: dateInput.value,
      purchasePrice: Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : null,
      notes: notesInput.value.trim()
    });
    close();
  });
}

async function updateCardMetadata(index, updates) {
  let card = collection[index];
  if (!card) return;
  let updatedCard = { ...card, ...updates };
  collection[index] = updatedCard;

  // Update condition badge in-place without a full re-render
  let row = document.querySelector(".deck-card-row[data-card-index='" + index + "']");
  if (row) {
    let nameWrap = row.querySelector(".deck-card-name-wrap");
    let existingBadge = nameWrap && nameWrap.querySelector(".deck-card-condition-badge");
    if (existingBadge) existingBadge.remove();
    if (updates.condition && nameWrap) {
      let badge = document.createElement("span");
      badge.className = "deck-card-condition-badge";
      badge.textContent = updates.condition;
      badge.title = getConditionLabel(updates.condition);
      nameWrap.appendChild(badge);
    }
  }

  showStatusMessage(card.name + " details saved.");
  try {
    await dbUpsertCards([updatedCard]);
  } catch (error) {
    console.error("Could not save card details.", error);
    collection[index] = card;
    showStatusMessage("Could not save details for " + card.name + ". Please try again.");
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

function consolidateImportIdentifiers(identifiers) {
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
        let uniqueUpdated = Array.from(new Map(updatedCards.map(function(c) { return [c.id, c]; })).values());
        await dbUpsertCards(uniqueUpdated);
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
  let identifiers = consolidateImportIdentifiers(parseDeckFileText(text));

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
    let addedCount = 0;
    let updatedCount = 0;
    allCards.forEach(function(entry) {
      let newCard = createStoredCard(entry.card, {
        deck: deckName,
        foil: entry.identifier ? entry.identifier.foil : false,
        set: entry.identifier ? entry.identifier.set : "",
        collectorNumber: entry.identifier ? entry.identifier.collector_number : "",
        quantity: entry.identifier ? entry.identifier.quantity : 1
      });

      if (mode === "merge") {
        let existingIndex = collection.findIndex(function(c) {
          return normalizeDeckName(c.deck || "unsorted") === deckName
            && c.name === newCard.name
            && c.foil === newCard.foil;
        });
        if (existingIndex !== -1) {
          let existing = collection[existingIndex];
          let mergedQty = Math.max(existing.quantity || 1, newCard.quantity || 1);
          let updatedCard = { ...newCard, id: existing.id, quantity: mergedQty };
          collection[existingIndex] = updatedCard;
          toUpsert.push(updatedCard);
          updatedCount++;
        } else {
          collection.push(newCard);
          toUpsert.push(newCard);
          addedCount++;
        }
      } else {
        collection.push(newCard);
        toUpsert.push(newCard);
        addedCount++;
      }
    });

    await dbUpsertCards(toUpsert);

    let summaryParts = [];
    if (addedCount > 0) summaryParts.push(addedCount + " new card" + (addedCount === 1 ? "" : "s") + " added");
    if (updatedCount > 0) summaryParts.push(updatedCount + " existing card" + (updatedCount === 1 ? "" : "s") + " updated");
    if (notFound.length > 0) summaryParts.push(notFound.length + " not found on Scryfall");
    elements.progressText.textContent = "Import complete — " + (summaryParts.join(", ") || "nothing changed") + ".";
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
    user_id: currentUserId,
    condition: card.condition || null,
    acquired_date: card.acquiredDate || null,
    purchase_price: card.purchasePrice != null ? card.purchasePrice : null,
    notes: card.notes || null
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
    image: row.image,
    condition: row.condition || "",
    acquiredDate: row.acquired_date || "",
    purchasePrice: row.purchase_price != null ? Number(row.purchase_price) : null,
    notes: row.notes || ""
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
      populateBuilderDeckSelect();
      displayCards();
    }
  } else if (eventType === "UPDATE") {
    let index = collection.findIndex(function(c) { return c.id === payload.new.id; });
    if (index !== -1) {
      let updated = rowToCard(payload.new);
      if (JSON.stringify(collection[index]) !== JSON.stringify(updated)) {
        collection[index] = updated;
        populateDeckFilter();
        populateBuilderDeckSelect();
        displayCards();
      }
    }
  } else if (eventType === "DELETE") {
    let index = collection.findIndex(function(c) { return c.id === payload.old.id; });
    if (index !== -1) {
      collection.splice(index, 1);
      populateDeckFilter();
      populateBuilderDeckSelect();
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
  elements.cardGrid.innerHTML = "<p class='empty-state'>Loading your collection...</p>";

  try {
    collection = await loadCollection();
  } catch (error) {
    collection = [];
    populateCommanderFilter();
    populateDeckFilter();
    populateBuilderDeckSelect();
    let loadErrorMessage = getCollectionLoadErrorMessage(error);
    elements.cardGrid.innerHTML = "<p class='empty-state'>" + escapeHtml(loadErrorMessage) + "</p>";
    showStatusMessage(loadErrorMessage);
    console.error("Collection load failed for user:", currentUserId, error);
    return;
  }

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
  populateBuilderDeckSelect();
  displayCards();
  refreshMissingColorIdentities();
  loadSetNames();
}

function friendlyAuthError(error) {
  let msg = (error && error.message) ? error.message.toLowerCase() : "";
  if (msg.includes("invalid login") || msg.includes("invalid credentials") || msg.includes("wrong password") || msg.includes("email not confirmed")) {
    return "Incorrect email or password. Double-check your credentials and try again.";
  }
  if (msg.includes("already registered") || msg.includes("user already exists")) {
    return "That email is already registered. Try signing in instead.";
  }
  if (msg.includes("weak password") || msg.includes("at least 6") || msg.includes("password should")) {
    return "Password must be at least 6 characters.";
  }
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return "Too many attempts — wait a minute then try again.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "Network error — check your connection and try again.";
  }
  return error.message || "Something went wrong. Please try again.";
}

function showAuthError(el, message) {
  el.textContent = message;
  el.classList.remove("hidden", "auth-message-success");
  el.classList.add("auth-message-error");
}

function showAuthSuccess(el, message) {
  el.textContent = message;
  el.classList.remove("hidden", "auth-message-error");
  el.classList.add("auth-message-success");
}

async function signIn() {
  let email = elements.authEmail.value.trim();
  let password = elements.authPassword.value;
  elements.authMessage.classList.add("hidden");
  elements.signInButton.disabled = true;
  elements.signUpButton.disabled = true;
  elements.signInButton.textContent = "Signing in...";

  let { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  elements.signInButton.disabled = false;
  elements.signUpButton.disabled = false;
  elements.signInButton.textContent = "Sign in";
  if (error) {
    showAuthError(elements.authMessage, friendlyAuthError(error));
    return;
  }
  currentUserId = data.user.id;
  await initApp(data.user.email);
}

async function signUp() {
  let email = elements.authEmail.value.trim();
  let password = elements.authPassword.value;
  elements.authMessage.classList.add("hidden");

  if (password.length < 6) {
    showAuthError(elements.authMessage, "Password must be at least 6 characters.");
    return;
  }

  elements.signInButton.disabled = true;
  elements.signUpButton.disabled = true;
  elements.signUpButton.textContent = "Creating account...";

  let { data, error } = await supabaseClient.auth.signUp({ email, password });
  elements.signInButton.disabled = false;
  elements.signUpButton.disabled = false;
  elements.signUpButton.textContent = "Create account";
  if (error) {
    showAuthError(elements.authMessage, friendlyAuthError(error));
    return;
  }
  if (data.user && !data.session) {
    showAuthSuccess(elements.authMessage, "Account created! Check your email to confirm before signing in.");
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
    showAuthError(elements.authMessage, "Enter your email address above first.");
    return;
  }
  let { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: "https://tinsoldier3.github.io/MTG-Card-Database-Project/"
  });
  if (error) {
    showAuthError(elements.authMessage, friendlyAuthError(error));
    return;
  }
  showAuthSuccess(elements.authMessage, "Password reset email sent — check your inbox.");
}

async function updatePassword() {
  let newPassword = elements.newPasswordInput.value;
  if (!newPassword) {
    showAuthError(elements.resetMessage, "Please enter a new password.");
    return;
  }
  if (newPassword.length < 6) {
    showAuthError(elements.resetMessage, "Password must be at least 6 characters.");
    return;
  }
  let { error } = await supabaseClient.auth.updateUser({ password: newPassword });
  if (error) {
    showAuthError(elements.resetMessage, friendlyAuthError(error));
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
