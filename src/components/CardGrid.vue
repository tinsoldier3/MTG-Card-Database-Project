<template>
  <div>
    <!-- Filter controls (shown only in default/decks/boxes view) -->
    <div v-if="store.currentView !== 'sets'" style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end; margin-bottom:16px;">
      <div class="field-group">
        <label style="font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; opacity:0.6; display:block; margin-bottom:4px;">
          {{ store.currentView === 'boxes' ? 'Box / Binder' : 'Deck' }}
        </label>
        <select v-model="selectedDeckFilter">
          <option value="">{{ store.currentView === 'boxes' ? 'All boxes' : 'All decks' }}</option>
          <option v-for="deckName in deckFilterOptions" :key="deckName" :value="deckName">
            {{ getDeckDisplayLabel(deckName) }}
          </option>
        </select>
      </div>

      <div v-if="store.currentView !== 'boxes'" class="field-group">
        <label style="font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; opacity:0.6; display:block; margin-bottom:4px;">Commander</label>
        <select v-model="selectedCommanderFilter">
          <option value="">All cards</option>
          <option v-for="(info, deckName) in COMMANDER_DECKS" :key="deckName" :value="deckName">
            {{ info.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- Sets view -->
    <template v-if="store.currentView === 'sets'">
      <p v-if="Object.keys(setGroups).length === 0" class="empty-state">
        {{ props.search ? 'No cards match the current filters.' : 'No cards in your collection yet.' }}
      </p>
      <section
        v-for="(entries, setCode) in setGroups"
        :key="setCode"
        class="deck-section"
      >
        <h2 class="deck-heading">
          {{ getSetDisplayLabel(setCode, store.setNameCache) }} &mdash;
          {{ entries.reduce((sum, e) => sum + (e.card.quantity || 1), 0) }} cards
        </h2>
        <div class="card-grid">
          <div
            v-for="entry in sortEntries(entries)"
            :key="entry.card.id"
            class="card"
            @click="openModal(entry)"
            style="cursor:pointer;"
          >
            <img :src="entry.card.image" :alt="entry.card.name + ' card image'" />
            <div class="card-name">
              {{ entry.card.name }}
              <span
                v-if="entry.card.quantity && entry.card.quantity > 1"
                class="card-qty"
              >({{ entry.card.quantity }}x)</span>
            </div>
            <div v-if="entry.card.foil" class="card-foil">&#10024; Foil</div>
            <div class="card-type">{{ entry.card.type }}</div>
            <div v-if="getPrintLabel(entry.card)" class="card-print">Print: {{ getPrintLabel(entry.card) }}</div>
            <div class="card-colors">Color identity: {{ getColorIdentityLabel(entry.card.colorIdentity) }}</div>
            <div class="card-deck-label">Location: {{ getDeckDisplayLabel(normalizeDeckName(entry.card.deck || 'unsorted')) }}</div>
            <div class="card-controls" @click.stop>
              <div class="qty-stepper">
                <button type="button" @click="store.updateCardQuantity(entry.index, -1)" :aria-label="'Decrease quantity of ' + entry.card.name">&#8722;</button>
                <span class="qty-value">{{ entry.card.quantity || 1 }}</span>
                <button type="button" @click="store.updateCardQuantity(entry.index, 1)" :aria-label="'Increase quantity of ' + entry.card.name">+</button>
              </div>
              <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;">
                <input
                  type="text"
                  :list="'deckOptions-' + entry.index"
                  :value="entry.card.deck || 'unsorted'"
                  :id="'deckEdit-' + entry.index"
                  :aria-label="'Deck name for ' + entry.card.name"
                  style="flex:1; min-width:120px;"
                />
                <datalist :id="'deckOptions-' + entry.index">
                  <option v-for="dn in allDeckNames" :key="dn" :value="dn" />
                </datalist>
                <button type="button" @click="moveCard(entry.index)">Move to deck</button>
              </div>
              <div style="display:flex; gap:6px; margin-top:6px;">
                <input
                  type="number"
                  class="qty-input"
                  min="1"
                  :value="entry.card.quantity || 1"
                  :aria-label="'Quantity for ' + entry.card.name"
                  :data-qty-index="entry.index"
                />
                <button type="button" @click="setQty(entry.index, $event)">Set qty</button>
                <button type="button" @click="store.removeCard(entry.index)">Remove</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>

    <!-- Boxes view -->
    <template v-else-if="store.currentView === 'boxes'">
      <p v-if="Object.keys(boxGroups).length === 0" class="empty-state">
        {{ selectedDeckFilter ? 'No cards match the current filters.' : 'No boxes or binders in your collection yet.' }}
      </p>
      <section
        v-for="(entries, deckName) in boxGroups"
        :key="deckName"
        class="deck-section"
      >
        <h2 class="deck-heading">
          {{ getDeckDisplayLabel(deckName) }}
          ({{ entries.reduce((sum, e) => sum + (e.card.quantity || 1), 0) }} cards)
        </h2>
        <div class="card-grid">
          <div
            v-for="entry in sortEntries(entries)"
            :key="entry.card.id"
            class="card"
            @click="openModal(entry)"
            style="cursor:pointer;"
          >
            <img :src="entry.card.image" :alt="entry.card.name + ' card image'" />
            <div class="card-name">
              {{ entry.card.name }}
              <span v-if="entry.card.quantity && entry.card.quantity > 1" class="card-qty">
                ({{ entry.card.quantity }}x)
              </span>
            </div>
            <div v-if="entry.card.foil" class="card-foil">&#10024; Foil</div>
            <div class="card-type">{{ entry.card.type }}</div>
            <div v-if="getPrintLabel(entry.card)" class="card-print">Print: {{ getPrintLabel(entry.card) }}</div>
            <div class="card-colors">Color identity: {{ getColorIdentityLabel(entry.card.colorIdentity) }}</div>
            <div class="card-controls" @click.stop>
              <div class="qty-stepper">
                <button type="button" @click="store.updateCardQuantity(entry.index, -1)" :aria-label="'Decrease quantity of ' + entry.card.name">&#8722;</button>
                <span class="qty-value">{{ entry.card.quantity || 1 }}</span>
                <button type="button" @click="store.updateCardQuantity(entry.index, 1)" :aria-label="'Increase quantity of ' + entry.card.name">+</button>
              </div>
              <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;">
                <input
                  type="text"
                  :list="'deckOptions-' + entry.index"
                  :value="entry.card.deck || 'unsorted'"
                  :id="'deckEdit-' + entry.index"
                  :aria-label="'Deck name for ' + entry.card.name"
                  style="flex:1; min-width:120px;"
                />
                <datalist :id="'deckOptions-' + entry.index">
                  <option v-for="dn in allDeckNames" :key="dn" :value="dn" />
                </datalist>
                <button type="button" @click="moveCard(entry.index)">Move to deck</button>
              </div>
              <div style="display:flex; gap:6px; margin-top:6px;">
                <input
                  type="number"
                  class="qty-input"
                  min="1"
                  :value="entry.card.quantity || 1"
                  :aria-label="'Quantity for ' + entry.card.name"
                  :data-qty-index="entry.index"
                />
                <button type="button" @click="setQty(entry.index, $event)">Set qty</button>
                <button type="button" @click="store.removeCard(entry.index)">Remove</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>

    <!-- Default / decks view -->
    <template v-else>
      <p v-if="Object.keys(deckGroups).length === 0" class="empty-state">
        {{
          selectedCommanderFilter || selectedDeckFilter || props.search
            ? 'No cards match the current filters.'
            : 'No cards in your decks yet.'
        }}
      </p>
      <section
        v-for="(entries, deckName) in deckGroups"
        :key="deckName"
        class="deck-section"
      >
        <h2 class="deck-heading">
          <a :href="'#deck/' + encodeURIComponent(deckName)" class="deck-heading-link">
            {{ getDeckDisplayLabel(deckName) }}
          </a>
          ({{ entries.reduce((sum, e) => sum + (e.card.quantity || 1), 0) }} cards)
        </h2>
        <p v-if="COMMANDER_DECKS[deckName]" class="deck-meta">
          {{ deckIllegalCount(entries) > 0
            ? deckIllegalCount(entries) + ' card' + (deckIllegalCount(entries) === 1 ? '' : 's') + ' outside this commander\'s color identity.'
            : 'All visible cards match this commander\'s color identity.'
          }}
        </p>
        <div class="card-grid">
          <div
            v-for="entry in sortEntries(entries, deckName)"
            :key="entry.card.id"
            :class="['card', { 'card-illegal': getDeckLegality(entry.card).checked && !getDeckLegality(entry.card).legal }]"
            @click="openModal(entry)"
            style="cursor:pointer;"
          >
            <img :src="entry.card.image" :alt="entry.card.name + ' card image'" />
            <div class="card-name">
              {{ entry.card.name }}
              <span v-if="entry.card.quantity && entry.card.quantity > 1" class="card-qty">
                ({{ entry.card.quantity }}x)
              </span>
            </div>
            <div v-if="entry.card.foil" class="card-foil">&#10024; Foil</div>
            <div class="card-type">{{ entry.card.type }}</div>
            <div v-if="getPrintLabel(entry.card)" class="card-print">Print: {{ getPrintLabel(entry.card) }}</div>
            <div class="card-colors">Color identity: {{ getColorIdentityLabel(entry.card.colorIdentity) }}</div>
            <div
              v-if="getDeckLegality(entry.card).checked && !getDeckLegality(entry.card).legal"
              class="status-badge illegal"
            >Illegal for this deck</div>
            <div class="card-controls" @click.stop>
              <div class="qty-stepper">
                <button type="button" @click="store.updateCardQuantity(entry.index, -1)" :aria-label="'Decrease quantity of ' + entry.card.name">&#8722;</button>
                <span class="qty-value">{{ entry.card.quantity || 1 }}</span>
                <button type="button" @click="store.updateCardQuantity(entry.index, 1)" :aria-label="'Increase quantity of ' + entry.card.name">+</button>
              </div>
              <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;">
                <input
                  type="text"
                  :list="'deckOptions-' + entry.index"
                  :value="entry.card.deck || 'unsorted'"
                  :id="'deckEdit-' + entry.index"
                  :aria-label="'Deck name for ' + entry.card.name"
                  style="flex:1; min-width:120px;"
                />
                <datalist :id="'deckOptions-' + entry.index">
                  <option v-for="dn in allDeckNames" :key="dn" :value="dn" />
                </datalist>
                <button type="button" @click="moveCard(entry.index)">Move to deck</button>
              </div>
              <div style="display:flex; gap:6px; margin-top:6px;">
                <input
                  type="number"
                  class="qty-input"
                  min="1"
                  :value="entry.card.quantity || 1"
                  :aria-label="'Quantity for ' + entry.card.name"
                  :data-qty-index="entry.index"
                />
                <button type="button" @click="setQty(entry.index, $event)">Set qty</button>
                <button type="button" @click="store.removeCard(entry.index)">Remove</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>

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
import { ref, computed } from 'vue'
import { useCollectionStore } from '../store/collection.js'
import { COMMANDER_DECKS } from '../utils/constants.js'
import {
  normalizeDeckName,
  getDeckDisplayLabel,
  getDeckLegality,
  isBoxOrBinder,
  getColorIdentityLabel,
  getPrintLabel,
  getSetDisplayLabel
} from '../utils/cards.js'
import CardDetailsModal from './CardDetailsModal.vue'

const props = defineProps({
  search: {
    type: String,
    default: ''
  },
  sort: {
    type: String,
    default: 'name'
  }
})

const store = useCollectionStore()

// ── Filter state ───────────────────────────────────────────────
const selectedDeckFilter = ref('')
const selectedCommanderFilter = ref('')
const modalEntry = ref(null)

// ── All deck names for datalist ───────────────────────────────
const allDeckNames = computed(() => {
  const names = Array.from(new Set(
    store.collection.map(card => normalizeDeckName(card.deck || 'unsorted'))
  ))
  Object.keys(COMMANDER_DECKS).forEach(n => { if (!names.includes(n)) names.push(n) })
  return names.sort((a, b) => getDeckDisplayLabel(a).localeCompare(getDeckDisplayLabel(b)))
})

// ── Deck filter options (context-sensitive) ────────────────────
const deckFilterOptions = computed(() => {
  return Array.from(new Set(
    store.collection
      .map(card => normalizeDeckName(card.deck || 'unsorted'))
      .filter(deckName => {
        if (store.currentView === 'boxes') return isBoxOrBinder(deckName)
        return !isBoxOrBinder(deckName)
      })
  )).sort((a, b) => getDeckDisplayLabel(a).localeCompare(getDeckDisplayLabel(b)))
})

// ── Commander legality helper ──────────────────────────────────
function isCardLegalForCommander(card, commanderName) {
  if (!commanderName) return true
  const commander = COMMANDER_DECKS[normalizeDeckName(commanderName)]
  const commanderColors = commander ? commander.colors : null
  if (!commanderColors || !Array.isArray(card.colorIdentity)) return true
  return card.colorIdentity.every(color => commanderColors.includes(color))
}

// ── Filtered entries (shared base) ────────────────────────────
const filteredEntries = computed(() => {
  const query = (props.search || '').toLowerCase().trim()
  return store.collection
    .map((card, index) => ({ card, index, deckName: normalizeDeckName(card.deck || 'unsorted') }))
    .filter(entry => {
      // View-level filter
      if (store.currentView === 'boxes') return isBoxOrBinder(entry.deckName)
      if (store.currentView === 'decks') return !isBoxOrBinder(entry.deckName)
      return true
    })
    .filter(entry => {
      if (selectedDeckFilter.value && entry.deckName !== selectedDeckFilter.value) return false
      return true
    })
    .filter(entry => {
      if (!isCardLegalForCommander(entry.card, selectedCommanderFilter.value)) return false
      return true
    })
    .filter(entry => {
      if (!query) return true
      const nameMatch = entry.card.name.toLowerCase().includes(query)
      const typeMatch = (entry.card.type || '').toLowerCase().includes(query)
      const deckMatch = entry.deckName.toLowerCase().includes(query)
      return nameMatch || typeMatch || deckMatch
    })
})

// ── Sets view: group by set code ──────────────────────────────
const setGroups = computed(() => {
  if (store.currentView !== 'sets') return {}
  const groups = {}
  filteredEntries.value.forEach(entry => {
    const setCode = (entry.card.set || 'UNKNOWN').toUpperCase()
    if (!groups[setCode]) groups[setCode] = []
    groups[setCode].push(entry)
  })
  // Sort keys alphabetically
  return Object.fromEntries(
    Object.keys(groups).sort().map(k => [k, groups[k]])
  )
})

// ── Boxes view: group by deck ─────────────────────────────────
const boxGroups = computed(() => {
  if (store.currentView !== 'boxes') return {}
  const groups = {}
  filteredEntries.value.forEach(entry => {
    const dn = entry.deckName
    if (!groups[dn]) groups[dn] = []
    groups[dn].push(entry)
  })
  return Object.fromEntries(
    Object.keys(groups).sort((a, b) => a.localeCompare(b)).map(k => [k, groups[k]])
  )
})

// ── Default / decks view: group by deck ───────────────────────
const deckGroups = computed(() => {
  if (store.currentView === 'sets' || store.currentView === 'boxes') return {}
  const groups = {}
  filteredEntries.value.forEach(entry => {
    const dn = entry.deckName
    if (!groups[dn]) groups[dn] = []
    groups[dn].push(entry)
  })
  return Object.fromEntries(
    Object.keys(groups).sort((a, b) => a.localeCompare(b)).map(k => [k, groups[k]])
  )
})

// ── Sort entries ──────────────────────────────────────────────
function sortEntries(entries, deckName) {
  const sorted = [...entries]
  const sortMode = props.sort

  // Commanders always float to top within their deck
  const commanders = deckName && COMMANDER_DECKS[deckName]
    ? (COMMANDER_DECKS[deckName].commander || [])
    : []

  sorted.sort((a, b) => {
    const aIsCommander = commanders.includes(a.card.name)
    const bIsCommander = commanders.includes(b.card.name)
    if (aIsCommander !== bIsCommander) return aIsCommander ? -1 : 1

    switch (sortMode) {
      case 'type':
        return (a.card.type || '').localeCompare(b.card.type || '')
      case 'color':
        return ((a.card.colorIdentity || []).join('') || '').localeCompare(
          (b.card.colorIdentity || []).join('') || ''
        )
      case 'set':
        return (a.card.set || '').localeCompare(b.card.set || '')
      case 'collector':
        return (a.card.collectorNumber || '').localeCompare(
          b.card.collectorNumber || '', undefined, { numeric: true }
        )
      case 'name':
      default:
        return a.card.name.localeCompare(b.card.name)
    }
  })
  return sorted
}

// ── Illegal count for deck section heading ────────────────────
function deckIllegalCount(entries) {
  return entries.filter(entry => {
    const leg = getDeckLegality(entry.card)
    return leg.checked && !leg.legal
  }).length
}

// ── Card action helpers ───────────────────────────────────────
function moveCard(index) {
  const inputEl = document.getElementById('deckEdit-' + index)
  if (!inputEl) return
  const deckName = inputEl.value.trim()
  if (!deckName) return
  store.moveCardToDeck(index, deckName)
}

function setQty(index, event) {
  // Find the qty-input sibling by traversing the card-controls area
  const btn = event.currentTarget
  const controls = btn.closest('.card-controls')
  if (!controls) return
  const input = controls.querySelector('input[data-qty-index="' + index + '"]')
  if (!input) return
  const qty = parseInt(input.value, 10)
  if (!Number.isFinite(qty) || qty < 1) return
  const card = store.collection[index]
  if (!card) return
  const delta = qty - (card.quantity || 1)
  if (delta === 0) return
  store.updateCardQuantity(index, delta)
}

// ── Modal ──────────────────────────────────────────────────────
function openModal(entry) {
  modalEntry.value = entry
}
</script>
