<template>
  <div class="builder-panel">
    <!-- Toolbar -->
    <div class="builder-toolbar">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end;">
        <div class="field-group">
          <label for="builderDeckSelect" style="font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; opacity:0.6; display:block; margin-bottom:4px;">Deck</label>
          <select id="builderDeckSelect" v-model="selectedDeck">
            <option v-if="builderDeckNames.length === 0" value="">No decks yet</option>
            <option v-for="deckName in builderDeckNames" :key="deckName" :value="deckName">
              {{ getDeckDisplayLabel(deckName) }}
            </option>
          </select>
        </div>

        <div class="field-group">
          <label for="builderSourceFilter" style="font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; opacity:0.6; display:block; margin-bottom:4px;">Source</label>
          <select id="builderSourceFilter" v-model="sourceFilter">
            <option value="">Full collection</option>
            <option value="spares">Unsorted only</option>
            <option value="other-decks">Other decks</option>
          </select>
        </div>

        <div class="field-group">
          <label for="builderTypeFilter" style="font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; opacity:0.6; display:block; margin-bottom:4px;">Type</label>
          <select id="builderTypeFilter" v-model="typeFilter">
            <option value="">All types</option>
            <option value="creature">Creatures</option>
            <option value="instant-sorcery">Instants &amp; Sorceries</option>
            <option value="artifact-enchantment">Artifacts &amp; Enchantments</option>
            <option value="planeswalker">Planeswalkers</option>
            <option value="land">Lands</option>
          </select>
        </div>

        <label class="builder-toggle">
          <input type="checkbox" v-model="legalOnly" />
          Commander-legal only
        </label>
      </div>

      <div class="builder-summary">{{ summaryText }}</div>
    </div>

    <!-- Two-column layout -->
    <div v-if="selectedDeck" class="builder-layout" style="margin-top:20px;">
      <!-- Left: In deck -->
      <section class="builder-column">
        <h2 class="deck-heading">In Deck ({{ deckCardCount }})</h2>
        <p class="deck-meta">Cards already assigned to {{ getDeckDisplayLabel(selectedDeck) }}</p>

        <div class="builder-card-grid">
          <p v-if="deckCards.length === 0" class="empty-state">No cards are assigned to this deck yet.</p>

          <article
            v-for="entry in deckCards"
            :key="entry.card.id"
            :class="['builder-card', { 'card-illegal': getDeckLegality(entry.card).checked && !getDeckLegality(entry.card).legal }]"
          >
            <img
              v-if="entry.card.image"
              :src="entry.card.image"
              :alt="entry.card.name + ' card image'"
              style="cursor:pointer;"
              @click="openModal(entry)"
            />
            <div class="card-name" style="cursor:pointer;" @click="openModal(entry)">{{ entry.card.name }}</div>
            <div class="card-type">{{ entry.card.type || 'Unknown type' }}</div>
            <div class="card-colors">Qty: {{ entry.card.quantity || 1 }} &bull; {{ getColorIdentityLabel(entry.card.colorIdentity) }}</div>
            <div v-if="getPrintLabel(entry.card)" class="card-print">Print: {{ getPrintLabel(entry.card) }}</div>
            <div
              v-if="getDeckLegality(entry.card).checked && !getDeckLegality(entry.card).legal"
              class="status-badge illegal"
            >Outside {{ getDeckDisplayLabel(selectedDeck) }} color identity</div>
            <div class="builder-card-actions">
              <button type="button" @click="store.moveCardToDeck(entry.index, 'unsorted')">Move to unsorted</button>
            </div>
          </article>
        </div>
      </section>

      <!-- Right: Available -->
      <section class="builder-column">
        <h2 class="deck-heading">Available Collection Cards ({{ availableCardCount }})</h2>
        <p class="deck-meta">Cards you can move into {{ getDeckDisplayLabel(selectedDeck) }}</p>

        <div class="builder-card-grid">
          <p v-if="availableCards.length === 0" class="empty-state">No other collection cards are available right now.</p>

          <article
            v-for="entry in availableCards"
            :key="entry.card.id"
            class="builder-card"
          >
            <img
              v-if="entry.card.image"
              :src="entry.card.image"
              :alt="entry.card.name + ' card image'"
              style="cursor:pointer;"
              @click="openModal(entry)"
            />
            <div class="card-name" style="cursor:pointer;" @click="openModal(entry)">{{ entry.card.name }}</div>
            <div class="card-type">{{ entry.card.type || 'Unknown type' }}</div>
            <div class="card-colors">Qty: {{ entry.card.quantity || 1 }} &bull; {{ getColorIdentityLabel(entry.card.colorIdentity) }}</div>
            <div class="card-deck-label">Currently in {{ getDeckDisplayLabel(entry.deckName) }}</div>
            <div v-if="getPrintLabel(entry.card)" class="card-print">Print: {{ getPrintLabel(entry.card) }}</div>
            <div
              v-if="COMMANDER_DECKS[selectedDeck] && !isCardLegalForCommander(entry.card, selectedDeck)"
              class="status-badge illegal"
            >Outside commander color identity</div>
            <div class="builder-card-actions">
              <button type="button" @click="store.moveCardToDeck(entry.index, selectedDeck)">Use in deck</button>
            </div>
          </article>
        </div>
      </section>
    </div>

    <div v-else style="margin-top:20px;">
      <p class="empty-state">No decks available yet. Create or import a deck first.</p>
    </div>

    <!-- Chat panel -->
    <div class="builder-chat">
      <div class="chat-messages" ref="chatMessagesEl">
        <p v-if="chatMessages.length === 0" class="chat-welcome">
          Ask me to suggest cards — try "add more ramp" or "find removal for this deck".
        </p>

        <div
          v-for="(msg, i) in chatMessages"
          :key="i"
          :class="['chat-message', 'chat-message-' + msg.role, { 'chat-message-pending': msg.pending }]"
        >
          <p class="chat-message-text">{{ msg.text }}</p>

          <div v-if="msg.cards && msg.cards.length > 0" class="chat-suggestions">
            <div
              v-for="card in msg.cards"
              :key="card.id || card.name"
              class="chat-suggestion-card"
            >
              <img
                v-if="getCardImageUri(card)"
                :src="getCardImageUri(card)"
                :alt="card.name + ' card image'"
              />
              <div class="chat-suggestion-name">{{ card.name }}</div>
              <div class="chat-suggestion-type">{{ card.type_line || '' }}</div>
              <button
                type="button"
                :disabled="isSuggestionInDeck(card) || isSuggestionOwned(card) || msg.addedCards && msg.addedCards.has(card.name)"
                @click="addSuggestedCard(card, msg, selectedDeck || 'unsorted')"
              >
                <span v-if="isSuggestionInDeck(card)">Already in deck</span>
                <span v-else-if="isSuggestionOwned(card)">In collection</span>
                <span v-else-if="msg.addedCards && msg.addedCards.has(card.name)">Added!</span>
                <span v-else>{{ selectedDeck ? 'Add to ' + getDeckDisplayLabel(selectedDeck) : 'Add to collection' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="chat-input-bar">
        <input
          type="text"
          v-model="chatInput"
          placeholder='e.g. "add more ramp" or "find card draw"'
          @keydown.enter="handleChatSend"
        />
        <button type="button" :disabled="chatSending" @click="handleChatSend">
          {{ chatSending ? 'Thinking…' : 'Send' }}
        </button>
      </div>

      <details class="chat-api-key-details">
        <summary>
          Claude AI suggestions
          <span class="chat-api-key-mode">{{ apiKey ? '(AI-powered)' : '(using Scryfall smart search)' }}</span>
        </summary>
        <p class="chat-api-key-hint">
          Add an Anthropic API key for AI-powered card suggestions. Without a key, Scryfall is used as a fallback.
        </p>
        <div class="chat-api-key-row">
          <input
            type="password"
            v-model="apiKeyInput"
            placeholder="sk-ant-..."
          />
          <button type="button" @click="saveApiKey">Save key</button>
          <button type="button" @click="clearApiKey">Clear</button>
        </div>
      </details>
    </div>

    <!-- Card details modal -->
    <CardDetailsModal
      v-if="modalEntry"
      :card-index="modalEntry.index"
      :card="modalEntry.card"
      @close="modalEntry = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useCollectionStore } from '../store/collection.js'
import { COMMANDER_DECKS, BUILDER_DECK_KEY, BUILDER_API_KEY_KEY } from '../utils/constants.js'
import {
  normalizeDeckName,
  getDeckDisplayLabel,
  getDeckLegality,
  isBoxOrBinder,
  getColorIdentityLabel,
  getPrintLabel,
  getCardImageUri,
  createStoredCard
} from '../utils/cards.js'
import CardDetailsModal from './CardDetailsModal.vue'

// ── Store ──────────────────────────────────────────────────────
const store = useCollectionStore()

// ── Filter state ───────────────────────────────────────────────
const selectedDeck = ref(localStorage.getItem(BUILDER_DECK_KEY) || '')
const sourceFilter = ref('')
const typeFilter = ref('')
const legalOnly = ref(false)

// Persist selected deck to localStorage
watch(selectedDeck, (val) => {
  if (val) localStorage.setItem(BUILDER_DECK_KEY, val)
})

// ── Chat state ─────────────────────────────────────────────────
const chatInput = ref('')
const chatSending = ref(false)
const chatMessages = ref([])
const chatMessagesEl = ref(null)
const apiKeyInput = ref(localStorage.getItem(BUILDER_API_KEY_KEY) || '')
const apiKey = ref(localStorage.getItem(BUILDER_API_KEY_KEY) || '')

// ── Modal state ────────────────────────────────────────────────
const modalEntry = ref(null)

// ── Derived deck names for builder ────────────────────────────
const builderDeckNames = computed(() => {
  const fromCollection = store.collection
    .map(card => normalizeDeckName(card.deck || 'unsorted'))
    .filter(deckName => deckName !== 'unsorted' && !isBoxOrBinder(deckName))

  const unique = Array.from(new Set(fromCollection))

  Object.keys(COMMANDER_DECKS).forEach(deckName => {
    if (!unique.includes(deckName)) unique.push(deckName)
  })

  unique.sort((a, b) => getDeckDisplayLabel(a).localeCompare(getDeckDisplayLabel(b)))
  return unique
})

// Ensure selectedDeck is valid whenever collection changes
watch(builderDeckNames, (names) => {
  if (names.length === 0) {
    selectedDeck.value = ''
    return
  }
  if (!names.includes(selectedDeck.value)) {
    selectedDeck.value = names[0]
    localStorage.setItem(BUILDER_DECK_KEY, names[0])
  }
}, { immediate: true })

// ── Card helpers ───────────────────────────────────────────────
function isCardLegalForCommander(card, commanderName) {
  if (!commanderName) return true
  const commander = COMMANDER_DECKS[normalizeDeckName(commanderName)]
  const commanderColors = commander ? commander.colors : null
  if (!commanderColors || !Array.isArray(card.colorIdentity)) return true
  return card.colorIdentity.every(color => commanderColors.includes(color))
}

function matchesSourceFilter(deckName, filter) {
  if (filter === 'spares') return deckName === 'unsorted'
  if (filter === 'other-decks') return deckName !== 'unsorted' && !isBoxOrBinder(deckName)
  return true
}

function matchesTypeFilter(card, filter) {
  if (!filter) return true
  const typeLine = (card.type || '').toLowerCase()
  if (filter === 'land') return typeLine.includes('land')
  if (filter === 'creature') return typeLine.includes('creature')
  if (filter === 'instant-sorcery') return typeLine.includes('instant') || typeLine.includes('sorcery')
  if (filter === 'artifact-enchantment') return typeLine.includes('artifact') || typeLine.includes('enchantment')
  if (filter === 'planeswalker') return typeLine.includes('planeswalker')
  return true
}

// ── Computed card lists ────────────────────────────────────────
const deckCards = computed(() => {
  if (!selectedDeck.value) return []
  return store.collection
    .map((card, index) => ({ card, index, deckName: normalizeDeckName(card.deck || 'unsorted') }))
    .filter(entry => entry.deckName === selectedDeck.value)
    .filter(entry => matchesTypeFilter(entry.card, typeFilter.value))
    .sort((a, b) => a.card.name.localeCompare(b.card.name))
})

const deckCardNames = computed(() => {
  if (!selectedDeck.value) return new Set()
  return new Set(
    store.collection
      .filter(card => normalizeDeckName(card.deck || 'unsorted') === selectedDeck.value)
      .map(card => card.name.toLowerCase())
  )
})

const availableCards = computed(() => {
  if (!selectedDeck.value) return []
  return store.collection
    .map((card, index) => ({ card, index, deckName: normalizeDeckName(card.deck || 'unsorted') }))
    .filter(entry => entry.deckName !== selectedDeck.value)
    .filter(entry => !deckCardNames.value.has(entry.card.name.toLowerCase()))
    .filter(entry => matchesSourceFilter(entry.deckName, sourceFilter.value))
    .filter(entry => matchesTypeFilter(entry.card, typeFilter.value))
    .filter(entry => {
      if (!legalOnly.value) return true
      if (!COMMANDER_DECKS[selectedDeck.value]) return true
      return isCardLegalForCommander(entry.card, selectedDeck.value)
    })
    .sort((a, b) => a.card.name.localeCompare(b.card.name))
})

const deckCardCount = computed(() =>
  deckCards.value.reduce((sum, e) => sum + (e.card.quantity || 1), 0)
)

const availableCardCount = computed(() =>
  availableCards.value.reduce((sum, e) => sum + (e.card.quantity || 1), 0)
)

const illegalInDeckCount = computed(() =>
  deckCards.value.filter(e => {
    const leg = getDeckLegality(e.card)
    return leg.checked && !leg.legal
  }).length
)

const summaryText = computed(() => {
  if (!selectedDeck.value) return 'No decks are available to build yet.'
  let text = `${deckCardCount.value} cards in deck, ${availableCardCount.value} matching candidates`
  if (sourceFilter.value === 'spares') text += ' from your unsorted cards'
  else if (sourceFilter.value === 'other-decks') text += ' from your other decks'
  else text += ' from your full collection'
  if (typeFilter.value) {
    const typeLabels = {
      land: 'lands', creature: 'creatures',
      'instant-sorcery': 'instants & sorceries',
      'artifact-enchantment': 'artifacts & enchantments',
      planeswalker: 'planeswalkers'
    }
    text += `, filtered to ${typeLabels[typeFilter.value] || typeFilter.value}`
  }
  if (legalOnly.value && COMMANDER_DECKS[selectedDeck.value]) text += ', commander-legal only'
  if (illegalInDeckCount.value > 0) text += `, ${illegalInDeckCount.value} outside commander color identity.`
  else text += '.'
  return text
})

// ── Modal ──────────────────────────────────────────────────────
function openModal(entry) {
  modalEntry.value = entry
}

// ── Chat helpers ───────────────────────────────────────────────
function scrollChatToBottom() {
  nextTick(() => {
    if (chatMessagesEl.value) {
      chatMessagesEl.value.scrollTop = chatMessagesEl.value.scrollHeight
    }
  })
}

function flattenCardName(name) {
  return (name || '').toLowerCase().replace(/[''‚‛′‵]/g, "'")
}

function isSuggestionInDeck(card) {
  if (!selectedDeck.value) return false
  const lower = flattenCardName(card.name)
  return Array.from(deckCardNames.value).some(n => n === lower)
}

function isSuggestionOwned(card) {
  const lower = flattenCardName(card.name)
  return store.collection.some(c => flattenCardName(c.name) === lower)
}

async function addSuggestedCard(scryfallCard, msg, targetDeck) {
  if (!msg.addedCards) msg.addedCards = new Set()
  msg.addedCards.add(scryfallCard.name)

  const newCard = createStoredCard(scryfallCard, { deck: targetDeck, foil: false, quantity: 1 })
  store.collection.push(newCard)
  store.showStatusMessage(`${newCard.name} added to ${getDeckDisplayLabel(targetDeck)}.`)
  try {
    await store.dbUpsertCards([newCard])
  } catch (error) {
    console.error('Could not save suggested card.', error)
    const idx = store.collection.indexOf(newCard)
    if (idx !== -1) store.collection.splice(idx, 1)
    msg.addedCards.delete(scryfallCard.name)
    store.showStatusMessage(`Could not add ${newCard.name}. Please try again.`)
  }
}

function saveApiKey() {
  const key = apiKeyInput.value.trim()
  if (!key) return
  localStorage.setItem(BUILDER_API_KEY_KEY, key)
  apiKey.value = key
}

function clearApiKey() {
  localStorage.removeItem(BUILDER_API_KEY_KEY)
  apiKeyInput.value = ''
  apiKey.value = ''
}

async function handleChatSend() {
  const prompt = chatInput.value.trim()
  if (!prompt || chatSending.value) return
  chatInput.value = ''
  chatSending.value = true

  chatMessages.value.push({ role: 'user', text: prompt })
  const pendingMsg = { role: 'assistant', text: 'Thinking…', pending: true, cards: [] }
  chatMessages.value.push(pendingMsg)
  scrollChatToBottom()

  const targetDeck = selectedDeck.value || ''

  try {
    if (apiKey.value) {
      await handleClaudeChat(prompt, targetDeck, pendingMsg)
    } else {
      await handleScryfallChat(prompt, targetDeck, pendingMsg)
    }
  } catch (error) {
    pendingMsg.text = 'Something went wrong: ' + error.message
    pendingMsg.pending = false
  } finally {
    chatSending.value = false
    scrollChatToBottom()
  }
}

async function handleScryfallChat(prompt, targetDeck, pendingMsg) {
  const commanderDeck = COMMANDER_DECKS[targetDeck]
  const colors = commanderDeck ? commanderDeck.colors : []
  const query = buildScryfallQuery(prompt, colors)

  try {
    const cards = await fetchScryfallSearch(query)
    if (cards.length === 0) {
      pendingMsg.text = 'No Scryfall results for that search. Try rephrasing, or add an Anthropic API key for AI suggestions.'
      pendingMsg.pending = false
      return
    }
    const label = getDeckDisplayLabel(targetDeck) || 'your deck'
    pendingMsg.text = `Here are Scryfall results for ${label} (sorted by EDHREC popularity). Add an Anthropic API key below for AI-powered suggestions.`
    pendingMsg.cards = cards.slice(0, 12)
    pendingMsg.pending = false
  } catch (err) {
    pendingMsg.text = 'Scryfall search failed: ' + err.message
    pendingMsg.pending = false
  }
}

async function handleClaudeChat(prompt, targetDeck, pendingMsg) {
  const commanderDeck = COMMANDER_DECKS[targetDeck]
  const colors = commanderDeck ? commanderDeck.colors : []
  const deckCardsList = store.collection
    .filter(c => normalizeDeckName(c.deck || 'unsorted') === targetDeck)
    .map(c => `${c.name} (${c.type || '?'})`)
    .join(', ') || 'none yet'

  const systemPrompt = 'You are an expert Magic: The Gathering Commander deckbuilding assistant.\n'
    + `Deck: ${getDeckDisplayLabel(targetDeck)}\n`
    + (commanderDeck ? `Commander(s): ${commanderDeck.commander.join(', ')}\n` : '')
    + `Color identity: ${colors.length > 0 ? colors.join('') : 'Colorless'}\n`
    + `Cards in deck: ${deckCardsList}\n\n`
    + 'Suggest 6-10 specific, real Magic card names that fit the color identity.\n'
    + 'Keep your response to 2-3 sentences of strategy, then end with exactly:\n'
    + 'CARDS: CardName1 | CardName2 | CardName3'

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey.value,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      const errMsg = (errData.error && errData.error.message) || ('API error ' + response.status)
      if (response.status === 401) {
        pendingMsg.text = 'Invalid API key — check your key below. Falling back to Scryfall search.'
      } else {
        pendingMsg.text = errMsg + ' — falling back to Scryfall search.'
      }
      pendingMsg.pending = false
      await handleScryfallChat(prompt, targetDeck, { text: '', pending: false, cards: pendingMsg.cards = [] })
      // Re-run Scryfall but append new message instead of replacing
      const commanderDeckFb = COMMANDER_DECKS[targetDeck]
      const colorsFb = commanderDeckFb ? commanderDeckFb.colors : []
      const query = buildScryfallQuery(prompt, colorsFb)
      const cards = await fetchScryfallSearch(query)
      pendingMsg.cards = cards.slice(0, 12)
      return
    }

    const data = await response.json()
    const fullText = data.content[0].text
    const cardNames = extractCardNames(fullText)
    const explanation = fullText.replace(/CARDS:.*$/m, '').trim()

    if (cardNames.length === 0) {
      pendingMsg.text = explanation || fullText
      pendingMsg.pending = false
      return
    }

    const scryfallCards = await fetchCardsByNames(cardNames)
    pendingMsg.text = explanation
    pendingMsg.cards = scryfallCards
    pendingMsg.pending = false
  } catch (err) {
    pendingMsg.text = 'Claude API error: ' + err.message + ' — falling back to Scryfall.'
    pendingMsg.pending = false
    await handleScryfallChat(prompt, targetDeck, pendingMsg)
  }
}

function extractCardNames(text) {
  const match = text.match(/CARDS:\s*(.+)$/m)
  if (!match) return []
  return match[1].split('|').map(s => s.trim()).filter(Boolean)
}

async function fetchScryfallSearch(query) {
  const url = 'https://api.scryfall.com/cards/search?q=' + encodeURIComponent(query)
  const response = await fetch(url)
  if (response.status === 404) return []
  if (!response.ok) throw new Error('Scryfall search failed (' + response.status + ')')
  const data = await response.json()
  return data.data || []
}

async function fetchCardsByNames(names) {
  if (names.length === 0) return []
  const identifiers = names.slice(0, 75).map(name => ({ name }))
  const response = await fetch('https://api.scryfall.com/cards/collection', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifiers })
  })
  if (!response.ok) return []
  const data = await response.json()
  return data.data || []
}

function buildScryfallQuery(prompt, colors) {
  const p = prompt.toLowerCase()
  const parts = []

  if (colors && colors.length > 0) {
    parts.push('id<=' + colors.join('').toLowerCase())
  }
  parts.push('format:commander')

  const wantsLands = /\bland(s|fix|base|ramp)?\b/.test(p)

  if (/\b(ramp|mana rock|mana dork|accelerat|mana fix)\b/.test(p)) {
    if (wantsLands && /\bland/.test(p)) {
      parts.push('(type:land or (oracle:"add {" -type:land) or oracle:"search your library for a basic land")')
    } else {
      parts.push('(oracle:"add {" or oracle:"search your library for a basic land" or (type:artifact oracle:"add"))')
      parts.push('-type:land')
    }
  } else if (/\b(board.?wipe|wrath|mass removal|all creatures|destroy all)\b/.test(p)) {
    parts.push('(oracle:"destroy all" or oracle:"exile all creatures" or oracle:"each creature gets" or oracle:"all creatures get")')
  } else if (/\b(removal|destroy|kill target|exile target|remove|spot removal)\b/.test(p)) {
    parts.push('(oracle:"destroy target" or oracle:"exile target creature" or oracle:"exile target permanent" or oracle:"deals damage to target creature")')
  } else if (/\b(counter(spell)?|counter target|counterspell)\b/.test(p)) {
    parts.push('type:instant oracle:"counter target"')
  } else if (/\b(draw|card draw|card advantage|cantrip)\b/.test(p)) {
    parts.push('(oracle:"draw a card" or oracle:"draw two cards" or oracle:"draw three cards" or oracle:"draw cards")')
    parts.push('-type:land')
  } else if (/\b(tutor|search your library)\b/.test(p)) {
    parts.push('oracle:"search your library"')
    parts.push('-type:land')
  } else if (/\bproliferat/.test(p)) {
    parts.push('oracle:proliferate')
  } else if (/\b(protection|hexproof|shroud|indestructible)\b/.test(p)) {
    parts.push('(keyword:hexproof or keyword:shroud or keyword:indestructible or oracle:"protection from")')
  } else if (/\b(flier|flyer|flying)\b/.test(p)) {
    parts.push('type:creature keyword:flying')
  } else if (/\b(token)\b/.test(p)) {
    parts.push('oracle:"creature token"')
  } else if (/\b(\+1\/\+1|plus one|counter(s)?)\b/.test(p) && !/counter target/.test(p)) {
    parts.push('oracle:"+1/+1 counter"')
  } else if (/\b(extra turn)\b/.test(p)) {
    parts.push('oracle:"extra turn"')
  } else if (/\b(life(gain)?|gain life)\b/.test(p)) {
    parts.push('oracle:"gain life"')
  } else if (/\b(haste)\b/.test(p)) {
    parts.push('keyword:haste type:creature')
  } else if (/\b(trample)\b/.test(p)) {
    parts.push('keyword:trample type:creature')
  } else if (/\b(reanimat|graveyard recursion|from (the|your) graveyard)\b/.test(p)) {
    parts.push('(oracle:"return target" oracle:"graveyard" or oracle:"from your graveyard")')
  } else if (wantsLands) {
    parts.push('type:land')
  } else if (/\b(artifact)\b/.test(p)) {
    parts.push('type:artifact')
  } else if (/\b(enchantment)\b/.test(p)) {
    parts.push('type:enchantment')
  } else if (/\b(creature)\b/.test(p)) {
    parts.push('type:creature')
  } else if (/\b(instant)\b/.test(p)) {
    parts.push('type:instant')
  } else if (/\b(sorcery)\b/.test(p)) {
    parts.push('type:sorcery')
  } else if (/\b(planeswalker)\b/.test(p)) {
    parts.push('type:planeswalker')
  } else {
    const words = prompt.trim().split(/\s+/).filter(w => w.length > 3)
    if (words.length > 0) {
      parts.push('oracle:"' + words[0].toLowerCase() + '"')
    }
  }

  if (/\b(cheap|low.?cost|1 mana|2 mana|cmc[<= ]+2)\b/.test(p)) parts.push('cmc<=2')
  else if (/\b(3 mana|cmc[<= ]+3)\b/.test(p)) parts.push('cmc<=3')

  return parts.join(' ') + ' order:edhrec'
}
</script>
